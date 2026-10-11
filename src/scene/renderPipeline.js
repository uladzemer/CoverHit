import * as THREE from 'three';
import { diagnostics, setBootStep } from '../boot/bootGuard.js';
import { PROFILES } from '../boot/deviceProfile.js';
import { estimateTextureBytes, setAssetProfile } from '../boot/mobileAssets.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, SMAAPreset, BloomEffect, ToneMappingEffect, ToneMappingMode, LUT3DEffect, LookupTexture } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { injectSoftShadows } from './softShadows.js';
import { createPresentPass } from './presentPass.js';
import { fitPhoneSunShadow, registerPhoneCarpet } from './lighting.js';

export const QUALITY = Object.freeze({
  high: { label: 'Графика: высокая', pixelRatio: 1.5, cascades: 3, shadowSize: 2048, halfRes: false },
  medium: { label: 'Графика: средняя', pixelRatio: 1, cascades: 3, shadowSize: 1536, halfRes: true },
  low: { label: 'Графика: низкая', pixelRatio: 1, cascades: 1, shadowSize: 1024, halfRes: true },
});
export function createWarmGrade() {
  const lut = LookupTexture.createNeutral(16);
  const data = lut.image.data, stride = data.length / 16 ** 3;
  for (let i = 0; i < data.length; i += stride) {
    const y = data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722;
    const shadow = (1 - y) ** 3, highlight = y ** 2;
    data[i] = THREE.MathUtils.clamp(data[i] + .035 * highlight + .012 * y - .002 * shadow, 0, 1);
    data[i + 1] = THREE.MathUtils.clamp(data[i + 1] + .006 * highlight, 0, 1);
    data[i + 2] = THREE.MathUtils.clamp(data[i + 2] + .003 * shadow - .035 * highlight - .012 * y, 0, 1);
  }
  lut.needsUpdate = true;
  return lut;
}

// Nonblocking WebGL2 elapsed queries: CPU submission is reported separately.
function gpuTimer(renderer) {
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = []; let active, gpuMs = null;
  return {
    begin() {
      if (!ext) return;
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        pending.splice(0).forEach(q => gl.deleteQuery(q)); gpuMs = null;
      }
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift(); gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q);
      }
      if (pending.length < 8) { active = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, active); }
    },
    end() { if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; } return gpuMs; },
    reset() { pending.splice(0).forEach(q => gl.deleteQuery(q)); gpuMs = null; },
    dispose() { this.reset(); },
  };
}

function createFullPipeline(renderer, scene, camera, sun, lighting, phone = false) {
  const allocated = []; let releaseOnFailure = () => {};
  try {
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = .85;
  renderer.info.autoReset = false;
  const composer = new EffectComposer(renderer, { multisampling: 0, frameBufferType: THREE.HalfFloatType });
  allocated.push(composer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new N8AOPostPass(scene, camera, 1, 1);
  ao.setQualityMode('Medium');
  Object.assign(ao.configuration, { aoRadius: .22, distanceFalloff: .85, intensity: .65, gammaCorrection: false, transparencyAware: false });
  composer.addPass(ao);
  const bloom = new BloomEffect({ intensity: .075, luminanceThreshold: 1.0, luminanceSmoothing: .1, mipmapBlur: true });
  // Wool writes alpha=0 without blending: this masks incoming bloom as well
  // as tone mapping and grading, without another scene render or texture.
  bloom.setFragmentShader(bloom.getFragmentShader().replace('texture2D(map,uv)*intensity', 'vec4(texture2D(map,uv).rgb*intensity*inputColor.a,0.0)'));
  const bloomPass = new EffectPass(camera, bloom); composer.addPass(bloomPass);
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  tone.setFragmentShader(tone.getFragmentShader().replace('toneMapping(inputColor.rgb)', 'mix(inputColor.rgb,toneMapping(inputColor.rgb),inputColor.a)'));
  composer.addPass(new EffectPass(camera, tone));
  const lut = createWarmGrade(); allocated.push(lut);
  const grade = new LUT3DEffect(lut, { inputColorSpace: THREE.LinearSRGBColorSpace });
  grade.setFragmentShader(grade.getFragmentShader().replace('vec4(c,inputColor.a)', 'vec4(mix(inputColor.rgb,c,inputColor.a),1.0)'));
  const gradePass = new EffectPass(camera, grade);
  composer.addPass(gradePass);
  // Final output must be opaque even on Low, where the grade pass is disabled.
  const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH });
  smaa.setFragmentShader(smaa.getFragmentShader().replace('outputColor=color;', 'outputColor=vec4(color.rgb,1.0);'));
  composer.addPass(new EffectPass(camera, smaa));
  const timer = gpuTimer(renderer), originals = new Map(); allocated.push(timer);
  const sunIntensity = sun.intensity;
  const direction = sun.target.position.clone().sub(sun.position).normalize();
  sun.castShadow = false; sun.intensity = 0; sun.shadow.map?.dispose(); sun.shadow.map = null;
  let csm, quality, manual = false, frames = 0, frameTotal = 0, outputSized = false;
  function registerMaterials() {
    scene.traverse(object => {
      for (const material of object.material ? [object.material].flat() : []) {
        if (!(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) || csm.shaders.has(material)) continue;
        if (!originals.has(material)) {
          const onDispose = () => { originals.delete(material); csm?.shaders.delete(material); material.removeEventListener('dispose', onDispose); };
          originals.set(material, { compile: material.onBeforeCompile, cache: material.customProgramCacheKey, onDispose });
          material.addEventListener('dispose', onDispose);
        }
        const original = originals.get(material);
        csm.setupMaterial(material); const csmCompile = material.onBeforeCompile;
        material.onBeforeCompile = function(shader, renderer) { original.compile.call(this, shader, renderer); csmCompile.call(this, shader, renderer); injectSoftShadows(shader,quality); };
        material.customProgramCacheKey = function() { return `${original.cache.call(this)}:csm:${quality}`; };
        material.needsUpdate = true;
      }
    });
  }
  function releaseCSM() {
    if (!csm) return;
    csm.remove(); csm.lights.forEach(light => light.shadow.map?.dispose()); csm.dispose();
    for (const [material, original] of originals) { material.onBeforeCompile = original.compile; material.customProgramCacheKey = original.cache; }
  }
  function setQuality(level, automatic = false) {
    if (!QUALITY[level]) return false;
    if (!automatic) manual = true;
    if (quality === level) return true;
    releaseCSM(); quality = level; const settings = QUALITY[level];
    const lightState=lighting?.apply(level)||{direction,color:sun.color,intensity:sunIntensity};
    renderer.shadowMap.type=level==='high'?THREE.BasicShadowMap:THREE.PCFShadowMap;
    if(!phone||!outputSized)renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    csm = new CSM({ camera, parent: scene, cascades: settings.cascades, maxFar: 220,
      mode: 'custom', customSplitsCallback: (count, near, far, target) => target.push(...(count === 1 ? [1] : [14 / far, 55 / far, 1])),
      shadowMapSize: settings.shadowSize, shadowBias: -.000015, lightDirection: lightState.direction, lightIntensity: lightState.intensity,
      lightNear: .1, lightFar: 500, lightMargin: 100 });
    function tuneShadows(){for (const [i,light] of csm.lights.entries()) {
      light.color.copy(lightState.color);
      const width=light.shadow.camera.right-light.shadow.camera.left;
      light.shadow.normalBias=level==='low'?.0015:[.003,.012,.04][i];
      light.shadow.bias=level==='low'?-.000015:-.001/(light.shadow.camera.far-light.shadow.camera.near);
      // Keep thin sunset post shadows legible; PCSS still widens with separation.
      light.shadow.radius=level==='high'?(light.shadow.camera.far-light.shadow.camera.near)*.00465/width:level==='medium'?2.5:1;
    }}
    csm.userDataTune=tuneShadows;tuneShadows();
    ao.enabled = level !== 'low'; ao.configuration.halfRes = settings.halfRes;
    bloomPass.enabled = level !== 'low'; gradePass.enabled = level !== 'low';
    registerMaterials(); resize(); timer.reset();
    try { localStorage.setItem('coverhit-quality', level); } catch {}
    window.dispatchEvent(new CustomEvent('coverhit-quality', { detail: { level, label: settings.label } }));
    return true;
  }
  function resize() {
    if(phone){
      // The explicit full override has the same WebKit buffer-resize failure
      // as direct profiles. Retain composer/output resolution after startup;
      // camera projection follows the CSS rect, so rotation still maps exactly.
      if(!outputSized)renderer.setSize(window.innerWidth,window.innerHeight);
      outputSized=true;renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';
      const size=renderer.getSize(new THREE.Vector2());composer.setSize(size.x,size.y);
    }else{renderer.setSize(window.innerWidth,window.innerHeight);composer.setSize(window.innerWidth,window.innerHeight);}
    csm?.updateFrustums();csm?.userDataTune?.();
  }
  releaseOnFailure = releaseCSM;
  let saved; try { saved = localStorage.getItem('coverhit-quality'); } catch {}
  setQuality(QUALITY[saved] ? saved : 'high', true);
  return {
    composer, ao, tone, get quality() { return quality; }, setQuality, resize,
    updateCameraFraming(){csm?.updateFrustums();csm?.userDataTune?.();},
    setToneMapping(name) { if (!(name in ToneMappingMode)) return false; tone.mode = ToneMappingMode[name]; return true; },
    render(dt) { lighting?.register(); registerMaterials(); csm.update(); renderer.info.reset(); timer.begin(); composer.render(dt); return timer.end(); },
    sampleFrame(ms) { if (frames < 120) { frameTotal += ms; if (++frames === 120 && !manual && quality === 'high' && frameTotal / frames > 20) setQuality('medium', true); } },
    dispose() { releaseCSM(); for (const [material, original] of originals) material.removeEventListener('dispose', original.onDispose); originals.clear(); timer.dispose(); composer.dispose(); lut.dispose(); },
  };
  } catch (error) {
    try { releaseOnFailure(); } catch {}
    for (const resource of allocated.reverse()) try { resource.dispose(); } catch {}
    throw error;
  }
}


// A stable facade lets quality fall back while the scene and input keep running.
export function createRenderPipeline(renderer, scene, camera, sun, lighting, device = {name:'full'}) {
  let profile = device.name, inner, badFrames = 0, warmup = 0, samples = 0, total = 0, adapted = false;
  const originalSun = {intensity:sun.intensity, position:sun.position.clone()};
  let outputSized = false, renderPixelRatio;
  function direct() {
    lighting?.apply?.('low');
    const otherSuns=[];scene.traverse(o=>{if(o.isDirectionalLight&&o!==sun)otherSuns.push(o);});
    otherSuns.forEach(light=>{light.removeFromParent();light.target.removeFromParent();});
    lighting?.applyPhone?.();
    if(scene.userData.phoneGroundFill)scene.userData.phoneGroundFill.value=profile==='minimal'?.05:.25;
    renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
    // EffectComposer disables autoClear; a downgraded scene target needs fresh
    // colour and depth every frame, including moving/flipping carpet geometry.
    renderer.autoClear = true; renderer.autoClearColor = true; renderer.autoClearDepth = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; renderer.info.autoReset = false;
    if(!lighting?.applyPhone){sun.intensity = originalSun.intensity;sun.position.copy(originalSun.position);sun.target.position.set(0,1,0);}
    sun.castShadow = true;
    sun.shadow.map?.dispose(); sun.shadow.map = null;
    sun.shadow.mapSize.setScalar(PROFILES[profile].shadow);
    // Keep thin posts legible at each texel density; PCF supplies the soft edge.
    sun.shadow.radius = profile === 'minimal' ? .1 : 1;
    fitPhoneSunShadow(sun);
    scene.environment = null;
    const present = createPresentPass(renderer);
    return { quality:profile, grade:present.uniforms, get renderHeight(){return present.height;}, resize() {
      renderPixelRatio = Math.min(window.devicePixelRatio || 1,PROFILES[profile].dpr);
      // WebKit stops presenting an existing canvas after its drawing buffer is
      // resized (readPixels still works). Size it only before the first draw;
      // subsequent quality/orientation changes resize the scene target instead.
      if(!outputSized && warmup===0) {renderer.setPixelRatio(renderPixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);}
      outputSized = true;
      renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';
      const rect=renderer.domElement.getBoundingClientRect?.()||{width:window.innerWidth,height:window.innerHeight};
      present.resize(rect.width,rect.height,renderPixelRatio);
    },
      render() { registerPhoneCarpet(scene); renderer.info.reset(); present.render(scene,camera); return null; }, dispose() {present.dispose();} };
  }
  function announce(reason) {
    diagnostics.profile = profile; diagnostics.reasons.push(reason); setAssetProfile(profile);
    setBootStep(`quality ${profile}: ${reason}`);
    if(reason === 'manual')try{localStorage.setItem('coverhit-profile',profile);}catch{}
    window.__coverhitLiteVignette = profile !== 'full';
    document.documentElement.dataset.coverhitProfile = profile;
    window.dispatchEvent(new CustomEvent('coverhit:quality',{detail:{profile,reason,label:'\u0413\u0440\u0430\u0444\u0438\u043a\u0430 \u0441\u043d\u0438\u0436\u0435\u043d\u0430',vignette:profile!=='full'}}));
  }
  function downgrade(reason) {
    if (profile === 'minimal') return false;
    inner?.dispose(); profile = profile === 'full' ? 'lite' : 'minimal';
    // CSM shader defines must be removed before the single-light path compiles.
    scene.traverse(o=>{for(const m of [o.material].flat())if(m){if(m.defines){delete m.defines.USE_CSM;delete m.defines.CSM_CASCADES;delete m.defines.CSM_FADE;}m.needsUpdate=true;}});
    inner = direct(); inner.resize(); announce(reason); badFrames = 0; return true;
  }
  if (profile === 'full') {
    try { inner = createFullPipeline(renderer,scene,camera,sun,lighting,device.mobile); }
    catch(error) { downgrade(`pipeline creation: ${error.message}`); }
  } else { inner = direct(); inner.resize(); }
  announce('device profile');
  return { get profile(){return profile;},get quality(){return inner.quality;},get composer(){return inner.composer;},get ao(){return inner.ao;},get tone(){return inner.tone;},
    get renderPixelRatio(){return profile==='full'?renderer.getPixelRatio():renderPixelRatio;},get renderHeight(){return inner.renderHeight??renderer.domElement.height;},get grade(){return inner.grade;},
    get vignette(){return profile!=='full';},downgrade,
    setQuality(level) { if(PROFILES[level]) {if(level===profile)return true;if(level==='lite'&&profile==='full')return downgrade('manual');if(level==='minimal'){while(profile!=='minimal')downgrade('manual');return true;}return false;}return inner.setQuality?.(level)||false; },
    setToneMapping(name){return inner.setToneMapping?.(name)||false;},resize(){inner.resize();},updateCameraFraming(){inner.updateCameraFraming?.();},
    render(dt) {
      if(renderer.getContext().isContextLost())return null;
      let result;
      try {result=inner.render(dt);} catch(error) {if(!downgrade(`render: ${error.message}`))throw error;result=inner.render(dt);}
      const gl=renderer.getContext();let error=gl.getError();
      if(error!==gl.NO_ERROR){badFrames++;for(let i=0;i<16&&gl.getError()!==gl.NO_ERROR;i++);}else badFrames=0;
      if(badFrames>=30&&!downgrade(`GL errors for 30 frames: ${error}`))throw Error('Persistent WebGL framebuffer errors');
      if(++warmup===1||warmup%60===0)diagnostics.textureMB=Math.round(estimateTextureBytes(scene)/1048576*10)/10;
      return result;
    },
    sampleFrame(ms) {
      if(warmup<120||adapted||!Number.isFinite(ms)||ms>250||document.hidden)return;
      total+=ms;if(++samples>=120){if(total/samples>(profile==='full'?24:40)&&profile!=='minimal'){adapted=true;downgrade(`average frame ${Math.round(total/samples)} ms`);}samples=0;total=0;}
    },dispose(){inner.dispose();},
  };
}
