import * as THREE from "three";
import { seededRandom } from "./random.js";
import { carpetGeometry } from "./assets.js";
import { createSmoothGeometry } from './smoothGeometry.js';
import { Cloth } from "./cloth.js";
import { CARPET_HALF_THICKNESS } from './barGeometry.js';
import { DirtMap, createDirtNoise } from "./dirt.js";
import { createLayerOcclusion } from './occlusion.js';
import { createThicknessStrip } from './thickness.js';
import { createFringe } from './fringe.js';

export function createCarpet(seed, clothOptions = {}) {
  if (!clothOptions.map) throw new Error("A loaded rug scan is required");
  const grid = carpetGeometry(clothOptions, clothOptions.aspect);
  if (clothOptions.mobile) {
    grid.cols = Math.max(12, Math.round(grid.cols * .75 / 2) * 2);
    grid.rows = Math.max(12, Math.round(grid.rows * .75 / 2) * 2);
  }
  const cloth = new Cloth({seed,...clothOptions, ...grid});
  const dirt = new DirtMap({ dirtAmount: clothOptions.dirtAmount, foldAxis: cloth.foldAxis, width: cloth.width, height: cloth.height });
  const map = clothOptions.map;
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.repeat.set(1, 1);
  map.offset.set(0, 0);
  map.rotation = 0;
  const pile = document.createElement("canvas");
  pile.width = pile.height = 256;
  const ctx = pile.getContext("2d"),
    image = ctx.createImageData(256, 256);
  const random = seededRandom(`${seed}:normal`);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = 100 + Math.floor(random() * 55);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const bumpMap = new THREE.CanvasTexture(pile);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(8, 11);
  const material = new THREE.MeshPhysicalMaterial({
    name: 'carpet-wool',
    sheen: 0,
    sheenColor: '#c7b9a5',
    sheenRoughness: 1,
    specularIntensity: .08,
    map,
    bumpMap,
    bumpScale: clothOptions.pile ?? 0.006,
    roughness: 0.97,
    metalness: 0,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
  });
  const dirtNoise = createDirtNoise();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.dirtMap = { value: dirt.texture };
    shader.uniforms.dirtNoise = { value: dirtNoise };
    shader.uniforms.dirtyZone = { value: new THREE.Vector2(.5,.5) };
    material.userData.dirtyZone = shader.uniforms.dirtyZone;
    shader.uniforms.dirtyHint = { value: 0 };
    material.userData.dirtyHint = shader.uniforms.dirtyHint;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vDirtUv;\nattribute vec2 clothOcclusion;\nvarying vec2 vClothOcclusion;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvDirtUv = uv;\nvClothOcclusion = clothOcclusion;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\ntransformed += objectNormal * ${CARPET_HALF_THICKNESS};`);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nuniform sampler2D dirtMap;\nuniform sampler2D dirtNoise;\nuniform vec2 dirtyZone;\nuniform float dirtyHint;\nvarying vec2 vDirtUv;\nvarying vec2 vClothOcclusion;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float dirt = texture2D(dirtMap, vDirtUv).r;
      float film = smoothstep(0.0, 1.0, dirt);
      float speckle = texture2D(dirtNoise, vDirtUv * vec2(19.0, 27.0)).r;
      float pileLuma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
      vec3 dustPile = mix(diffuseColor.rgb, pileLuma * vec3(1.04, 1.0, .92), film * .90);
      diffuseColor.rgb = dustPile * (1.0 - film * (.58 + (speckle - .5) * .08));
      float hintZone = 1.0 - smoothstep(.035, .18, distance(vDirtUv, dirtyZone));
      diffuseColor.rgb *= 1.0 - dirtyHint * hintZone * smoothstep(.1, .4, dirt) * .12;
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
      float clothAO = gl_FrontFacing ? 1.0 : vClothOcclusion.x * vClothOcclusion.y;
      reflectedLight.indirectDiffuse *= clothAO;
      reflectedLight.indirectSpecular *= clothAO;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 woolIrradiance = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb, vec3(0.0001));
      float woolIlluminance = dot(woolIrradiance, vec3(.2126, .7152, .0722));
      vec3 woolBalanced = mix(vec3(woolIlluminance), woolIrradiance, .04);
      outgoingLight = diffuseColor.rgb * min(woolBalanced * 1.75, vec3(.96)) + (reflectedLight.directSpecular + reflectedLight.indirectSpecular) * .08;
      #include <opaque_fragment>
      gl_FragColor.a = 0.0;
    `);
  };
  // The compositor carries an opaque coverage mask in alpha (0 = wool).
  // Preserve physical diffuse light/shadow variation, with textile-specific
  // exposure and white balance. Additive specular must not bleach dark dyes.
  material.customProgramCacheKey = () => "coverhit-carpet-colour-dust-v5";
  const mesh = new THREE.Mesh(cloth.geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "carpet";
  const updateAO=createLayerOcclusion(cloth), strip=createThicknessStrip(cloth);
  mesh.add(strip.mesh);
  const fringe=createFringe(cloth,{seed,type:clothOptions.id,map});
  if(fringe.mesh)mesh.add(fringe.mesh);
  cloth.fringe=fringe;
  cloth.updateShading=()=>{updateAO();strip.update();fringe.update();};
  cloth.updateShading();
  const smooth=createSmoothGeometry(cloth);
  mesh.geometry=smooth.geometry;
  cloth.updateRenderGeometry=smooth.update;
  cloth.renderGeometry=smooth.geometry;
  // Match the displaced visible surface in the shadow pass; otherwise the
  // 6 mm mismatch detaches the pipe contact and causes cloth self-shadow acne.
  const depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  depthMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed += normalize(normal) * ${CARPET_HALF_THICKNESS};`);
  };
  depthMaterial.customProgramCacheKey=()=> 'coverhit-cloth-depth-thickness-v1';
  mesh.customDepthMaterial=depthMaterial;
  return {
    mesh,
    cloth,
    dirt,
    fringe,
    dispose() {
      cloth.dispose();
      material.dispose();
      depthMaterial.dispose();
      strip.dispose();
      fringe.dispose();

      bumpMap.dispose();
      dirt.texture.dispose();
      dirtNoise.dispose();
    },
  };
}
