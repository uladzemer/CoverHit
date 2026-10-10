import * as THREE from 'three';

// Keep wool's alpha mask inside the scene buffer. Only opaque coverage reaches
// the browser compositor, just as with the full pipeline's final effect pass.
export function createPresentPass(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
    depthBuffer: true, stencilBuffer: false,
  });
  target.texture.name = 'phone-scene';
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { sceneColor: { value: target.texture } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D sceneColor;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(texture2D(sceneColor, vUv).rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const screen = new THREE.Scene(), camera = new THREE.Camera();
  const quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false;
  screen.add(quad);
  return {
    resize(width, height, dpr) { target.setSize(Math.max(1,Math.floor(width*dpr)), Math.max(1,Math.floor(height*dpr))); },
    get height() { return target.height; },
    render(scene, sceneCamera) {
      renderer.setRenderTarget(target);
      try { renderer.render(scene, sceneCamera); }
      finally { renderer.setRenderTarget(null); }
      renderer.render(screen, camera);
    },
    dispose() { target.dispose(); material.dispose(); geometry.dispose(); },
  };
}
