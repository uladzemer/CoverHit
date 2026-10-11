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
    uniforms: { sceneColor: { value: target.texture }, exposure:{value:.4}, gamma:{value:1}, saturation:{value:1.1}, lift:{value:.006}, contrast:{value:1.04} },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D sceneColor;
      uniform float exposure,gamma,saturation,lift,contrast;
      varying vec2 vUv;
      void main() {
        vec4 sampleColor=texture2D(sceneColor,vUv);
        // Wool's alpha mask also bypasses the desktop tone curve. Respect it
        // here so dark dyes retain their scan hue and saturation.
        vec3 c=sampleColor.rgb;
        vec3 graded=c*exposure;
        graded=graded/(vec3(1.0)+graded*.22);
        graded=mix(graded,graded*graded*(3.0-2.0*graded),contrast-1.0);
        graded+=lift*pow(vec3(1.0)-graded,vec3(3.0));
        c=mix(c,graded,sampleColor.a);
        float y=dot(c,vec3(.2126,.7152,.0722));
        c=mix(vec3(y),c,saturation);
        gl_FragColor = vec4(pow(clamp(c,0.0,1.0),vec3(1.0/gamma)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const screen = new THREE.Scene(), camera = new THREE.Camera();
  const quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false;
  screen.add(quad);
  return {
    uniforms:material.uniforms,
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
