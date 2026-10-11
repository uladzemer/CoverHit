import { setBootStep, setAssetProgress, showBootError, diagnostics } from './boot/bootGuard.js';
import { detectDeviceProfile, probeWebGL } from './boot/deviceProfile.js';
import { setAssetProfile } from './boot/mobileAssets.js';
import { cameraFraming } from './boot/framing.js';
import { reduceMobileScene } from './scene/mobileScene.js';
import * as THREE from "three";
import {wind} from "./scene/wind.js";
import {bindYardWindResponses} from './scene/windResponses.js';
import { createCarpet } from "./carpet/carpetMesh.js";
import { DustSystem } from "./fx/dust.js";
import { DirtyHints } from "./fx/dirtyHints.js";
import { MothSystem } from "./fx/moths.js";
import { BEATERS } from "./input/beaters/index.js";
import { Progression } from "./game/progression.js";
import { createCarpetActions } from "./game/carpetActions.js";
import { difficultyFor } from "./game/difficulty.js";
import { carpetType } from "./carpet/types.js";
import { loadCarpetAssets, fitCarpetSize, foldLayout, carpetEntryType } from "./carpet/assets.js";
import { Reticle } from "./fx/reticle.js";
import { Beater } from "./input/beater.js";
import { createYard, loadYardAssets } from "./scene/yard.js";
import { Sfx } from "./audio/sfx.js";
import { createStrikeLog } from "./game/strikeLog.js";
import { bindClothFlip } from "./game/clothFlip.js";
import { feel as gameFeel, strikeQuality, shakeAmount, soundIntensity, installFeel } from './game/feel.js';
import { Game } from "./game/state.js";
import { advanceGameplayFrame } from "./game/frame.js";
import { Hud } from "./ui/hud.js";
import "./style.css";
import { rackSpan, BAR_HEIGHT, CLOTH_BAR_OFFSET } from './carpet/barGeometry.js';
import { loadAmmo } from "./carpet/cloth.js";
import { createRenderPipeline } from './scene/renderPipeline.js';
import { optimizeYard } from './scene/yard/performance.js';
import { createLightingState, applyPhoneLighting } from './scene/lighting.js';
import {setFacadeMode} from './scene/yard/facade.js';

setBootStep('modules loaded');
async function boot() {
  const container = document.querySelector("#app");
  const loading = document.createElement("div");
  loading.className = "physics-loading";
  loading.setAttribute("role", "status");
  loading.textContent =
    "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0444\u0438\u0437\u0438\u043a\u0438 \u043a\u043e\u0432\u0440\u0430\u2026";
  container.append(loading);
  let ammo;
  try {
    ammo = await loadAmmo();
    setBootStep('ammo ready');
  } catch (error) {
    loading.textContent =
      "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0444\u0438\u0437\u0438\u043a\u0443. \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.";
    throw error;
  }
  // All pipelines present an opaque final pass; wool's alpha mask stays offscreen.
  // Request an opaque context as well, avoiding browser blending of the game.
  const canvas = document.createElement("canvas");
  const glContext = canvas.getContext("webgl2", {
    alpha: false, antialias: false, stencil: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false,
  });
  const renderer = new THREE.WebGLRenderer(
    glContext
      ? { canvas, context: glContext, antialias: false, alpha: false }
      : { antialias: false, alpha: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false },
  );
  const device = detectDeviceProfile(renderer.getContext());
  setAssetProfile(device.name, device.mobile);
  diagnostics.caps = probeWebGL(renderer.getContext()); diagnostics.profile = device.name;
  window.__coverhitLiteVignette = device.name !== 'full';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, device.dpr));
  setBootStep('renderer created');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
  const assets = await loadCarpetAssets(renderer);
  setBootStep('carpets manifest');
  if (device.name !== 'full') void assets.preload();
  const barLength = rackSpan(assets.manifest.map(c => foldLayout(fitCarpetSize(carpetEntryType(c), c.aspect)).span));
  const yard = createYard(scene, {barLength});
  bindYardWindResponses(yard.root);
  const yardAssets = await loadYardAssets(yard, renderer, (done, total) => {
    setAssetProgress(done,total); setBootStep(`yard assets ${done}/${total}`);
    loading.textContent = `Загрузка двора… ${done}/${total}`;
  });
  const baseCamera = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  let viewOffset = 0, desiredViewOffset = 0;
  let desiredFov = 48, framingReady = false, phoneFraming = false;
  if (yard.renderFallback) { device.name = 'lite'; setAssetProfile('lite'); }
  // Soft courtyard bounce lights the front; the pipeline cascades own sun shadows.
  const fill = new THREE.DirectionalLight("#d4dce1", 0.35);
  fill.position.set(1, 4, 6);
  fill.target.position.copy(yard.barPosition).add(new THREE.Vector3(0, -1, 0));
  if (device.name === 'full') scene.add(fill, fill.target);
  const lighting = device.name === 'full' ? createLightingState(scene, yard.sun, fill, yard) : {applyPhone:()=>applyPhoneLighting(scene,yard.sun,yard)};
  const pipeline = createRenderPipeline(renderer, scene, camera, yard.sun, lighting, device);
  setBootStep('pipeline created');
  const yardPerformance=optimizeYard(yard);
  yardPerformance.apply(); reduceMobileScene(yard, pipeline.profile);
  let yardQuality=pipeline.quality;
  const dust = new DustSystem({capacity:device.name==='full'?2760:1380});
  scene.add(dust.points);
  const dirtyHints = new DirtyHints(); scene.add(dirtyHints.points);
  const moths = new MothSystem(scene, { mobile: pipeline.profile !== 'full' });
  const sfx = new Sfx({ mobile: () => pipeline.profile !== 'full' });
  let carpet,
    shake = 0,
    elapsed = 0,
    muted = false,
    lastCombo = 1;
  const firstSeed =
    new URLSearchParams(location.search).get("seed") || "coverhit-08";
  let seedSequence = 0;
  const progression = new Progression(BEATERS);
  let currentType, currentEntry, game;
  async function replaceCarpet(
    seed = `${firstSeed}:${++seedSequence}:${Math.random()}`,
    type,
    carpetNumber = (game?.carpetIndex ?? 0) + 1,
  ) {
    const selected = await assets.next(type?.id, type?.assetId);
    type = selected.type;
    currentEntry = selected.entry;
    moths.clear();
    if (carpet) {
      scene.remove(carpet.mesh);
      carpet.dispose();
    }
    currentType = type;
    carpet = createCarpet(seed, {
      ammo,
      mobile: pipeline.profile !== 'full',
      map: selected.map,
      aspect: selected.entry.aspect,
      ...type,
      ...type.size,
      dirtAmount: type.dirtAmount * difficultyFor(carpetNumber).dirtAmount,
      barPosition: new THREE.Vector3(0, 0, CLOTH_BAR_OFFSET),
      barLength: yard.barLength,
    });
    carpet.mesh.position.copy(yard.barPosition);
    scene.add(carpet.mesh);
    carpet.mesh.updateMatrixWorld();
    hud?.setCleanliness(0);
    hud?.setCarpetType(type.nameRu, currentEntry.title);
    resize();
  }
  // Initialized before the first carpet so replacement can also update the HUD.
  let hud;
  await replaceCarpet(firstSeed);
  loading.remove();
  game = new Game({ getCleanliness: () => carpet.dirt.cleanliness(), getHalfCleanliness: side => carpet.dirt.halfCleanliness(side) });
  const {start,nextCarpet}=createCarpetActions({game,assets,replaceCarpet,hud:{toast:(...args)=>hud.toast(...args)}});
  function toggleMute() {
    muted = !muted;
    sfx.setVolume(muted ? 0 : (hud?.volume || 0.8));
    hud.setMuted(muted);
  }
  hud = new Hud({
    container,
    onStart: start,
    onNextCarpet: nextCarpet,
    onMute: toggleMute,
    onVolume: value => { muted = value === 0; sfx.setVolume(value); hud.setMuted(muted); },
    onFlip: () => game.flip(),
    beaters: BEATERS,
    progression,
    credits: assets.manifest,
    stockCredits: yard.stockCredits,
    onSelectBeater: (id) => setBeater(id),
  });
  hud.bind(game);
  setBootStep('hud ready');
  hud.setCarpetType(currentType.nameRu, currentEntry.title);

  function unlock() {
    void sfx.unlock();
  }
  function keydown(event) {
    if (hud.blocking) return;
    unlock();
    if(event.code === "KeyF" && !event.repeat) game.flip();
    if (event.code === "KeyM" && !event.repeat) toggleMute();
  }
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", keydown);
  game.on("state", (state) => {
    sfx.ambience(state === "playing");
    if (state !== "playing") moths.clear();
  });
  game.on("combo", (level) => {
    if (level > lastCombo) sfx.combo(level);
    lastCombo = level;
  });
  for (const event of ["neighborWarning", "neighborPenalty"])
    game.on(event, () => sfx.neighbor());
  bindClothFlip(game,()=>carpet);
  game.on('flipStart',()=>{
    beater.enabled=false;beater.cancel();moths.clear();
  });
  game.on('flipThrow',({to})=>{
    const amount=.03*(1-carpet.dirt.halfCleanliness(to));
    for(const u of [.2,.5,.8]) dust.emit((carpet.cloth.foldAxis==='u' ? sampleSurface(.5,u) : sampleSurface(u,.5)).point,new THREE.Vector3(0,1,.2),amount);
  });
  game.on('flipEnd', ()=>{
    beater.enabled=game.state === "playing";sfx.flip();
  });
  game.on('mothUv', event=>{
    if(carpet.cloth.foldAxis==='u')event.u=game.visibleSide===0 ? .5+event.u*.5 : event.u*.5;
    else event.v=game.visibleSide===0 ? event.v*.5 : .5+event.v*.5;
  });
  game.on('mothSpawn', event=>moths.spawn(event,sampleSurface(event.u,event.v).point));
  game.on("mothEscaped", ({ id }) => moths.exit(id, "escaped"));
  game.on("mothCaught", ({ id }) => {
    sfx.moth();
    const point = moths.exit(id, "caught");
    if (point) dust.emit(point, new THREE.Vector3(0, 0, 1), 0.004);
  });
  game.on("carpetDone", () => {
    const unlocked = progression.completeCarpet();
    hud.refreshBeater();
    if (unlocked.length) hud.showUnlock(unlocked);
    sfx.carpetDone();
    for (const u of [0.15, 0.5, 0.85]) {
      const { point, normal } = sampleSurface(u, 0.6);
      dust.emit(point, normal, 0.06);
    }
  });

  const strikeLog=createStrikeLog({dev:import.meta.env.DEV,search:location.search});
  function strike({ point, normal, uv, strength, physicalContact = false }) {
    if (
      !Number.isFinite(strength) ||
      strength <= 0 ||
      (game.state !== "playing" || game.flipping)
    )
      return 0;
    strength = THREE.MathUtils.clamp(strength, 0, 1);
    if(!carpet.dirt.isOnSide(uv.x,uv.y,game.visibleSide)) return 0;
    const feel = beater.entry.feel;
    const { mesh, cloth, dirt } = carpet;
    const localPoint = mesh.worldToLocal(point.clone());
    carpet.fringe.shake(localPoint,strength);
    const localDirection = normal
      .clone()
      .negate()
      .transformDirection(mesh.matrixWorld.clone().invert());
    if (!physicalContact)
      cloth.applyImpulse(
        localPoint,
        localDirection,
        strength * feel.swingMass,
        (0.28 + 0.045 * strength) * feel.headRadius,
      );
    // Charge controls cleaning as well as physical impulse.
    const cleaningStrength = strength;
    const amount = dirt.hit(uv.x, uv.y, cleaningStrength, feel.headRadius);
    dust.emit(point, normal, amount);
    sfx.hit(soundIntensity(strength), beater.entry.sound.preset);
    // BEGIN feel camera/impact hook
    shake = shakeAmount(shake, strength, strikeFeel.reduced());
    strikeFeel.impact(point, normal, strength);
    // END feel camera/impact hook
    if (game.state === "playing") {
      const points = game.onHit({ strength, dust: amount, uv });
      const projected = point.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      hud.popScore((projected.x + 1) * rect.width / 2, (1 - projected.y) * rect.height / 2,
        points, strikeQuality(strength));
      strikeLog?.hit({time:game.time,wall:performance.now()/1000,multiplier:game.comboMultiplier,uv:uv.toArray()});
    }
    return amount;
  }

  function sampleSurface(u, v) {
    const { cloth, mesh } = carpet;
    const x = u * cloth.cols,
      y = (1 - v) * cloth.rows;
    const x0 = Math.min(cloth.cols - 1, Math.floor(x)),
      y0 = Math.min(cloth.rows - 1, Math.floor(y));
    const tx = x - x0,
      ty = y - y0;
    const point = new THREE.Vector3(),
      positions = cloth.positions;
    for (const [dx, dy, weight] of [
      [0, 0, (1 - tx) * (1 - ty)],
      [1, 0, tx * (1 - ty)],
      [0, 1, (1 - tx) * ty],
      [1, 1, tx * ty],
    ]) {
      const index = ((y0 + dy) * (cloth.cols + 1) + x0 + dx) * 3;
      point.addScaledVector(
        new THREE.Vector3().fromArray(positions, index),
        weight,
      );
    }
    const index = (y0 * (cloth.cols + 1) + x0) * 3;
    const origin = new THREE.Vector3().fromArray(positions, index);
    const right = new THREE.Vector3()
      .fromArray(positions, index + 3)
      .sub(origin);
    const down = new THREE.Vector3()
      .fromArray(positions, index + (cloth.cols + 1) * 3)
      .sub(origin);
    mesh.updateWorldMatrix(true, false);
    const normal = down
      .cross(right)
      .normalize()
      .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
    return {
      point: mesh.localToWorld(point),
      normal,
      uv: new THREE.Vector2(u, v),
    };
  }
  function hitAtUv(u, v, strength = 0.65) {
    if (
      ![u, v, strength].every(Number.isFinite) ||
      u < 0 ||
      u > 1 ||
      v < 0 ||
      v > 1
    )
      return 0;
    return strike({ ...sampleSurface(u, v), strength });
  }
  function resize() {
    pipeline.resize();
    const rect = renderer.domElement.getBoundingClientRect();
    camera.aspect = rect.width / Math.max(1,rect.height);
    phoneFraming = device.mobile || camera.aspect < 1.3;
    const framing = cameraFraming(camera.aspect, yard.barLength, carpet.cloth.drop, BAR_HEIGHT, phoneFraming, carpet.cloth.span);
    desiredFov = framing.fov;
    desiredViewOffset = framing.viewOffset || 0;
    desiredCamera.set(framing.x, framing.y, framing.distance);
    desiredTarget.copy(yard.barPosition).add(new THREE.Vector3(0, -carpet.cloth.drop / 2, 0));
    if (framing.phone) desiredTarget.y = framing.targetY;
    if (!framingReady || !phoneFraming) {
      baseCamera.copy(desiredCamera);
      lookTarget.copy(desiredTarget);
      camera.fov = desiredFov;
      viewOffset = desiredViewOffset;
      camera.position.copy(baseCamera);
      camera.lookAt(lookTarget);
      framingReady = true;
    }
    if (phoneFraming) camera.setViewOffset(rect.width, rect.height, 0, viewOffset * rect.height, rect.width, rect.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    pipeline.updateCameraFraming();
    camera.updateMatrixWorld();
    if (dust.points.material.uniforms?.scale)
      dust.points.material.uniforms.scale.value =
        pipeline.renderHeight /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  window.visualViewport?.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("scroll", resize);
  resize();
  const beater = new Beater(camera, renderer.domElement, () => carpet.mesh);
  beater.setBeater(progression.selected);
  beater.enabled = game.state === "playing";
  game.on("state", (state) => { beater.enabled = state === "playing"; beater.cancel(); });
  scene.add(beater.group);
  const reticle = new Reticle(camera, renderer.domElement);
  scene.add(reticle.mesh);
  function setBeater(id) {
    if (!progression.select(id)) return false;
    beater.setBeater(id); hud.beaterIndex = BEATERS.findIndex(entry => entry.id === id); hud.refreshBeater(); return true;
  }
  async function setCarpetType(id) {
    const type = carpetType(id); if (!type) return false;
    await replaceCarpet(undefined, type); return true;
  }
  beater.isVisibleUv=uv=>carpet.dirt.isOnSide(uv.x,uv.y,game.visibleSide);
  beater.onHit(strike);
  beater.interceptSwing = (raycaster) =>
    game.state === "playing" &&
    moths.intercept(raycaster, carpet.mesh, (id) => game.catchMoth(id));
  beater.onMiss = () => {strikeLog?.miss(game.time);game.onHit({miss:true});};
  // BEGIN feel visual-clock integration (Bullet/Game retain real fixed dt).
  const strikeFeel = installFeel({ scene, beater, dust, game, hud });
  // END feel visual-clock integration
  window.__coverhit = {
    feel: gameFeel,
    yard, renderer, scene, wind,
    setFacades: mode => {const changed=setFacadeMode(yard.root,mode);if(changed)window.dispatchEvent(new CustomEvent('coverhit-facades',{detail:{mode}}));return changed;},
    get facades(){return yard.root.userData.facadeMode||'photo';},
    setQuality: level => { const changed = pipeline.setQuality(level); if (changed) {yardPerformance.apply(); reduceMobileScene(yard, pipeline.profile);yardQuality=pipeline.quality;resize();} return changed; },
    get quality() { return pipeline.quality; },
    renderPipeline: pipeline,
    camera, lookTarget, baseCamera,
    flip:()=>game.flip(),
    ...(strikeLog ? {strikeLog:strikeLog.entries} : {}),
    get cloth() {
      return carpet.cloth;
    },
    get dirt() {
      return carpet.dirt;
    },
    dust,
    game, hud,
    hit: hitAtUv,
    start,
    setBeater,
    setCarpetType,
    async setCarpet(id) { await replaceCarpet(undefined, {assetId:id}); },
    get carpetEntry() { return currentEntry; },
    get beater() { return beater; },
    get carpetType() { return currentType; },
    progression,
    // Render counters and measured frame time are available without a debug overlay.
    performance: { drawCalls: 0, frameMs: 0, intervalMs: 0, triangles: 0, physicsMs: 0, renderMs: 0, gpuMs: null },
  };
  let previous = null,
    accumulator = 0,
    frameId, firstFrame = false, lastDraw = -Infinity;
  function frame(now) {
    if (pipeline.profile !== 'full' && now-lastDraw < 1000/30-1) { frameId=requestAnimationFrame(frame); return; }
    lastDraw=now;
    const elapsedDt = previous===null?0:(now - previous) / 1000;
    const dt = Math.max(0,elapsedDt);
    previous = now;
    elapsed += dt * strikeFeel.scale();
    wind.update(dt);
    const frameStart = performance.now();
    if (!hud.blocking) accumulator = advanceGameplayFrame({ game, beater, cloth: carpet.cloth, mesh: carpet.mesh }, elapsedDt, accumulator);
    else carpet.cloth.windTimeOrigin=wind.time-carpet.cloth.time;
    window.__coverhit.performance.physicsMs = performance.now() - frameStart;
    // BEGIN feel camera clock (visual only)
    strikeFeel.update(dt);
    shake = strikeFeel.reduced() ? 0 : shake * Math.exp(-dt * strikeFeel.scale() * gameFeel.shake.decay);
    // END feel camera clock
    if (phoneFraming) {
      const blend = 1 - Math.exp(-Math.min(dt, .1) * 10);
      baseCamera.lerp(desiredCamera, blend);
      lookTarget.lerp(desiredTarget, blend);
      if (Math.abs(desiredFov - camera.fov) > 1e-6 || Math.abs(desiredViewOffset - viewOffset) > 1e-6) {
        viewOffset += (desiredViewOffset - viewOffset) * blend;
        const rect = renderer.domElement.getBoundingClientRect();
        camera.setViewOffset(rect.width, rect.height, 0, viewOffset * rect.height, rect.width, rect.height);
        camera.fov += (desiredFov - camera.fov) * blend;
        camera.updateProjectionMatrix();
        pipeline.updateCameraFraming();
        if (dust.points.material.uniforms?.scale)
          dust.points.material.uniforms.scale.value = pipeline.renderHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      }
    }
    camera.position
      .copy(baseCamera)
      .add(
        new THREE.Vector3(
          Math.sin(elapsed * 0.6) * 0.016 + Math.sin(elapsed * gameFeel.shake.frequencyX) * shake,
          Math.sin(elapsed * 0.8) * 0.009 + Math.cos(elapsed * gameFeel.shake.frequencyY) * shake,
          0,
        ),
      );
    // Impact shake must respect the phone's six-degree ceiling too.
    if (phoneFraming) camera.position.y = Math.min(camera.position.y,
      lookTarget.y + Math.hypot(camera.position.x - lookTarget.x, camera.position.z - lookTarget.z) * Math.tan(Math.PI / 30));
    camera.lookAt(lookTarget);
    camera.updateMatrixWorld();
    moths.update(dt);
    dust.update(dt);
    dirtyHints.update(carpet.dirt, sampleSurface, elapsed, game.state === 'playing', strikeFeel.reduced());
    carpet.mesh.material.userData.dirtyZone?.value.copy(dirtyHints.zone);
    if (carpet.mesh.material.userData.dirtyHint)
      carpet.mesh.material.userData.dirtyHint.value = dirtyHints.pulse;
    yard.update(dt);
    if(yardQuality!==pipeline.quality){yardPerformance.apply(); reduceMobileScene(yard, pipeline.profile);if(pipeline.profile!=='full')yardAssets.releaseEnvironment();yardQuality=pipeline.quality;}
    hud.setCleanliness(game.state === "menu" ? 0 : carpet.dirt.halfCleanliness(game.visibleSide));
    hud.setSide(game.visibleSide,game.flipping);
    hud.update(dt);
    reticle.update(dt, beater, { flipping: game.flipping, size: hud.reticleSize, moth: () => {
      const picks = [...moths.moths.values()].filter(m => m.state === 'flying').map(m => m.pick);
      if(!picks.length)return false;
      for (const pick of picks) pick.updateWorldMatrix(true, false);
      return beater.raycaster.intersectObjects([carpet.mesh, ...picks], false)[0]?.object.userData.mothId !== undefined;
    } });
    const renderStart = performance.now();
    window.__coverhit.performance.gpuMs = pipeline.render(dt);
    if (!firstFrame) { firstFrame=true; setBootStep('first frame rendered'); }
    window.__coverhit.performance.renderMs = performance.now() - renderStart;
    window.__coverhit.performance.drawCalls = renderer.info.render.calls;
    window.__coverhit.performance.frameMs = performance.now() - frameStart;
    window.__coverhit.performance.intervalMs = elapsedDt * 1000;
    window.__coverhit.performance.triangles = renderer.info.render.triangles;
    pipeline.sampleFrame(elapsedDt * 1000);
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  function resetClock() {
    previous = performance.now();
    accumulator = 0;
  }
  document.addEventListener("visibilitychange", resetClock);
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("visibilitychange", resetClock);
      hud.dispose();
      moths.dispose();
      reticle.dispose();
      beater.dispose();
      dust.dispose();
      dirtyHints.dispose();
      strikeFeel.dispose();
      carpet.dispose();
      assets.dispose();
      yard.root.userData.laundry?.dispose();
      yardAssets.dispose();
      sfx.ambience(false);
      sfx.dispose();
      scene.remove(beater.group, dust.points, carpet.mesh);
      const sceneAssets = new Set();
      scene.traverse((object) => {
        if (object.geometry) sceneAssets.add(object.geometry);
        for (const material of object.material
          ? [object.material].flat()
          : []) {
          sceneAssets.add(material);
          for (const value of Object.values(material))
            if (value?.isTexture) sceneAssets.add(value);
        }
        object.shadow?.map?.dispose();
      });
      for (const asset of sceneAssets) asset.dispose();
      pipeline.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete window.__coverhit;
    });
}
void boot().catch(error => { showBootError(error); console.error(error); });
