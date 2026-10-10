import * as THREE from 'three';
import { reticleScale, reticleState } from '../input/reticleHelpers.js';

export class Reticle {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom; this.time = 0; this.strikeAge = Infinity;
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, toneMapped: false,
      uniforms: { opacity: { value: 1 }, arc: { value: 0 }, target: { value: 0 }, flash: { value: 0 } },
      vertexShader: 'varying vec2 p; void main(){p=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec2 p; uniform float opacity,arc,target,flash;
        void main(){
          float r=length(p), aa=max(fwidth(r),0.002);
          float ring=1.0-smoothstep(0.067-aa,0.067+aa,abs(r-0.65));
          float light=1.0-smoothstep(0.032-aa,0.032+aa,abs(r-0.65));
          float dot=1.0-smoothstep(0.045-aa,0.045+aa,r);
          float dotEdge=1.0-smoothstep(0.075-aa,0.075+aa,r);
          vec2 q=abs(p);
          float ticks=target*(1.0-smoothstep(0.035,0.05,min(q.x,q.y)))*step(0.77,max(q.x,q.y))*step(max(q.x,q.y),0.98);
          float tickLight=target*(1.0-smoothstep(0.013,0.025,min(q.x,q.y)))*step(0.79,max(q.x,q.y))*step(max(q.x,q.y),0.96);
          float angle=mod(atan(p.x,p.y)+6.2831853,6.2831853);
          float progress=step(angle,arc)*step(0.0001,arc);
          float arcEdge=(1.0-smoothstep(0.07-aa,0.07+aa,abs(r-0.84)))*progress;
          float arcInner=(1.0-smoothstep(0.047-aa,0.047+aa,abs(r-0.84)))*progress;
          float alpha=max(max(ring,dotEdge),max(ticks,arcEdge));
          vec3 color=mix(vec3(0.035,0.03,0.035),vec3(0.953,0.902,0.784),max(max(light,dot),tickLight));
          color=mix(color,vec3(1.0,0.52,0.08),arcInner);
          color=mix(color,vec3(1.0),flash*0.8);
          gl_FragColor=vec4(color,alpha*opacity);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), this.material);
    this.mesh.name = 'carpet-aim-reticle'; this.mesh.renderOrder = 10000;
    this.mesh.frustumCulled = false;
    this.fallback = document.createElement('div'); this.fallback.className = 'ch-reticle-fallback';
    document.body.append(this.fallback);
  }
  update(dt, beater, { flipping = false, moth = false, size = 'normal' } = {}) {
    this.time += dt; this.strikeAge += dt;
    if (beater.didHit && !this.wasHit && beater.phase === 'strike') this.strikeAge = 0;
    this.wasHit = beater.phase === 'strike' && beater.didHit;
    // Recast after cloth integration and camera motion, using the same aim logic as the beater.
    const pointer = beater.phase === 'strike' ? beater.swingPointer : beater.pointer;
    const hit = beater.aim(pointer);
    moth = typeof moth === 'function' ? moth() : moth;
    const state = reticleState({ enabled: beater.enabled, flipping, onCarpet: !!hit, moth,
      charging: beater.phase === 'charging', charge: beater.charge, strikeAge: this.strikeAge });
    this.mesh.visible = state.visible && state.surface;
    this.fallback.hidden = !state.visible || state.surface;
    const rect = this.dom.getBoundingClientRect();
    this.fallback.style.left = `${rect.left + (pointer.x + 1) * rect.width / 2}px`;
    this.fallback.style.top = `${rect.top + (1 - pointer.y) * rect.height / 2}px`;
    this.fallback.style.opacity = state.opacity;
    this.fallback.classList.toggle('ch-reticle-large', size === 'large');
    this.fallback.classList.toggle('ch-reticle-target', moth);
    if (!hit) return;
    const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    if (normal.dot(beater.raycaster.ray.direction) > 0) normal.negate();
    this.mesh.position.copy(hit.point).addScaledVector(normal, 0.002);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    // Camera depth, rather than radial distance, gives consistent screen size.
    const depth = -hit.point.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    const scale = reticleScale(depth, this.camera.fov, rect.height, size);
    this.mesh.scale.setScalar(1.3 * 1.3 * scale * (1 - state.snap * 0.28) * (state.pulse ? 1 + 0.055 * Math.sin(this.time * 12) : 1));
    this.material.uniforms.opacity.value = state.opacity;
    this.material.uniforms.arc.value = state.arc;
    this.material.uniforms.target.value = moth ? 1 : 0;
    this.material.uniforms.flash.value = this.strikeAge < 0.16 ? 1 - this.strikeAge / 0.16 : 0;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.material.dispose(); this.fallback.remove(); }
}
