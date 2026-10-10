import * as THREE from "three";
import { pointerAim, TOUCH_AIM_OFFSET } from "./touch.js";
import { BEATERS, createBeaterModel } from "./beaters/index.js";

export function createLegacyModel() {
  const group = new THREE.Group();
  group.name = "rattan-beater";
  const wicker = new THREE.MeshStandardMaterial({
    color: "#c69b5b",
    roughness: 0.84,
  });
  const light = new THREE.MeshStandardMaterial({
    color: "#e1bb7c",
    roughness: 0.8,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#755332",
    roughness: 0.95,
  });
  const knots = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    knots.push(
      new THREE.Vector3(
        0.255 * Math.sin(t),
        0.28 * Math.sin(2 * t) + 0.055,
        0.02 * Math.cos(t),
      ),
    );
  }
  const loop = new THREE.CatmullRomCurve3(knots, true, "centripetal");
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(loop, 160, 0.012, 7, true),
    wicker,
  );
  group.add(tube);
  // Two narrow strands wind around the thick cane to make an actual twisted silhouette.
  for (const phase of [0, Math.PI]) {
    const strand = [];
    for (let i = 0; i < 360; i++) {
      const t = i / 360;
      const center = loop.getPointAt(t);
      const tangent = loop.getTangentAt(t);
      const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      const angle = t * Math.PI * 2 * 27 + phase;
      center.addScaledVector(side, Math.cos(angle) * 0.013);
      center.z += Math.sin(angle) * 0.013;
      strand.push(center);
    }
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(strand, true),
          480,
          0.004,
          5,
          true,
        ),
        light,
      ),
    );
  }
  for (const x of [-0.012, 0.012]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, -0.84, 0),
      new THREE.Vector3(x, -0.46, 0),
      new THREE.Vector3(x, -0.2, 0),
      new THREE.Vector3(x, 0, 0.025),
    ]);
    group.add(
      new THREE.Mesh(new THREE.TubeGeometry(path, 32, 0.017, 8), wicker),
    );
  }
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.035, 0.25, 12),
    dark,
  );
  grip.position.set(0, -0.735, 0);
  group.add(grip);
  for (let i = 0; i < 13; i++) {
    const binding = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.003, 4, 12),
      light,
    );
    binding.rotation.x = Math.PI / 2;
    binding.position.y = -0.62 - i * 0.019;
    group.add(binding);
  }
  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  for (const child of group.children) child.position.y += 0.735;
  return group;
}

export const CHARGE_SECONDS = 0.6;
export const IMPACT_SECONDS = 0.085;
export const SWING_SECONDS = 0.28;
export function chargeAt(seconds, swingMass = 1) {
  const t = THREE.MathUtils.clamp(seconds / (CHARGE_SECONDS * swingMass), 0, 1);
  return 1 - (1 - t) ** 2;
}
export function strengthAt(charge) {
  return 0.25 + 0.75 * THREE.MathUtils.clamp(charge, 0, 1);
}
export function swingArc(seconds, charge) {
  const windAngle = 0.35 + 1.35 * charge;
  if (seconds <= IMPACT_SECONDS) {
    const t = THREE.MathUtils.clamp(seconds / IMPACT_SECONDS, 0, 1);
    return {
      angle: windAngle * (1 - t * t),
      depth: 0.8 * (1 - t * t),
      impact: t === 1,
    };
  }
  const t = THREE.MathUtils.clamp(
    (seconds - IMPACT_SECONDS) / (SWING_SECONDS - IMPACT_SECONDS),
    0,
    1,
  );
  return {
    angle: 0.35 * Math.sin(t * Math.PI) - 0.22 * t,
    depth: 0.63 * (t * t * (3 - 2 * t)),
    impact: false,
  };
}

export class Beater {
  constructor(camera, dom, carpetMeshGetter, { touchAimOffset = TOUCH_AIM_OFFSET } = {}) {
    this.touchAimOffset = touchAimOffset; this.activePointer = null; this.touchInput = false;
    this.camera = camera; this.dom = dom; this.carpetMeshGetter = carpetMeshGetter;
    this.group = new THREE.Group(); this.callbacks = new Set();
    this.pointer = new THREE.Vector2(0.38, -0.2); this.swingPointer = this.pointer.clone();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.06);
    this.target = new THREE.Vector3(); this.phase = 'idle'; this.charge = 0;
    this.chargeTime = 0; this.swingTime = Infinity; this.flexAmount = 0; this.flexVelocity = 0;
    this.flexNormal = new THREE.Vector3(0, 0, 1); this.enabled = true;
    this.indicator = document.createElement('div'); this.indicator.className = 'beater-charge';
    document.body.append(this.indicator);
    this.setBeater(BEATERS[0].id);
    this.move = e => {
      if (this.activePointer !== null && e.pointerId !== this.activePointer) return;
      if (e.pointerType === 'touch' && e.pointerId !== this.activePointer) return;
      if (this.activePointer !== null) {
        const r = dom.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.left + r.width || e.clientY < r.top || e.clientY > r.top + r.height) {
          this.cancel(e); return;
        }
      }
      this.readPointer(e);
    };
    this.down = e => {
      // After impact, a new hold can interrupt recovery; a 250 ms gap must not drop every second hit.
      if (this.activePointer !== null || !this.enabled || e.button !== 0 || (this.phase === 'strike' && (!this.didHit || this.contactPending))) return;
      this.activePointer = e.pointerId; this.touchInput = e.pointerType === 'touch'; this.hapticTick = false;
      if (this.touchInput) e.preventDefault?.(); this.readPointer(e); this.phase = 'charging'; this.chargeTime = 0; this.charge = 0;
      if (e.isTrusted) dom.setPointerCapture?.(e.pointerId);
    };
    this.up = e => {
      if (e.pointerId !== this.activePointer || !this.enabled || this.phase !== 'charging') return;
      this.activePointer = null; if (this.touchInput) e.preventDefault?.();
      this.readPointer(e); this.swingPointer.copy(this.pointer);
      const contact = this.aim(this.swingPointer);
      this.lockedHit = null;
      if (contact?.uv) {
        const normal = contact.face.normal.clone().applyNormalMatrix(
          new THREE.Matrix3().getNormalMatrix(this.carpetMeshGetter().matrixWorld)).normalize();
        if (normal.dot(this.raycaster.ray.direction) > 0) normal.negate();
        this.lockedHit = { point: contact.point.clone(), normal, uv: contact.uv.clone(),
          strength: strengthAt(this.charge) };
      }
      this.lockedTarget = this.target.clone(); this.phase = 'strike'; this.swingTime = 0;
      this.didHit = false; this.contactPending = false;
    };
    this.cancel = e => { if (e?.pointerId != null && e.pointerId !== this.activePointer) return; this.activePointer = null; this.charge = 0; this.chargeTime = 0; this.phase = 'idle'; this.contactPending = false; this.indicator.style.opacity = 0; };
    dom.addEventListener('pointermove', this.move); dom.addEventListener('pointerdown', this.down);
    dom.addEventListener('pointerleave', this.cancel); dom.addEventListener('lostpointercapture', this.cancelHold = e => { if (this.phase === 'charging') this.cancel(e); });
    dom.addEventListener('pointerup', this.up); dom.addEventListener('pointercancel', this.cancel);
    window.addEventListener('blur', this.cancel); this.update(0);
  }
  setBeater(id) {
    const entry = BEATERS.find(b => b.id === id); if (!entry) return false;
    this.model?.group.removeFromParent(); this.model?.dispose();
    for (const ghost of this.ghosts || []) { ghost.removeFromParent(); ghost.traverse(o=>o.material?.dispose()); }
    this.entry = entry; this.model = createBeaterModel(id);
    this.modelHeight = new THREE.Box3().setFromObject(this.model.group).getSize(new THREE.Vector3()).y;
    this.group.add(this.model.group);
    this.headCenter = new THREE.Vector3();
    for (const c of this.model.colliders) this.headCenter.add(c.offset);
    this.headCenter.divideScalar(Math.max(1, this.model.colliders.length));
    this.ghosts = Array.from({length:4},(_,i)=>{
      const ghost=this.model.group.clone(); ghost.visible=false;
      ghost.traverse(o=>{if(o.isMesh) {o.material=o.material.clone();o.material.transparent=true;o.material.opacity=0.17*(1-i/5);o.material.depthWrite=false;o.castShadow=false;}});
      this.group.add(ghost); return ghost;
    });
    this.poseHistory=[];
    this.colliderRevision = (this.colliderRevision || 0) + 1; this.boundCloth = null;
    this.phase = 'idle'; this.contactPending = false; return true;
  }
  readPointer(e) {
    const r = this.dom.getBoundingClientRect(); if (!r.width || !r.height) return;
    const aim = pointerAim(e, r, this.touchAimOffset);
    this.pointer.set(aim.nx, aim.ny);
    this.indicator.style.left = `${aim.x}px`; this.indicator.style.top = `${aim.y}px`;
  }
  onHit(cb) { this.callbacks.add(cb); return () => this.callbacks.delete(cb); }
  aim(pointer) {
    const mesh = this.carpetMeshGetter(); if (mesh) this.plane.constant = -(mesh.position.z + 0.06);
    this.raycaster.setFromCamera(pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.target); mesh?.updateWorldMatrix(true, false);
    const hit = mesh ? this.raycaster.intersectObject(mesh, false).find(hit=>!this.isVisibleUv || this.isVisibleUv(hit.uv)) : null;
    if (hit) this.target.copy(hit.point); return hit;
  }
  update(dt) {
    if (this.phase === 'charging') { this.chargeTime += dt; this.charge = chargeAt(this.chargeTime, this.entry.feel.swingMass); }
    if (this.touchInput && this.phase === 'charging' && this.charge >= 0.75 && !this.hapticTick) {
      this.hapticTick = true; try { globalThis.navigator?.vibrate?.(8); } catch {}
    }
    if (this.phase === 'strike') this.swingTime += dt;
    this.aim(this.phase === 'strike' ? this.swingPointer : this.pointer);
    const cameraRotation = this.camera.getWorldQuaternion(new THREE.Quaternion());
    // Idle grip and the imaginary elbow remain below-right in camera space.
    // A fixed camera-relative distance makes every beater read at about 30% viewport height.
    const toolDistance = this.modelHeight / (0.30 * 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    const idleHead = new THREE.Vector3(toolDistance*0.30, -toolDistance*0.10, -toolDistance).applyQuaternion(cameraRotation).add(this.camera.position);
    const idleRotation = cameraRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, -0.25, -0.55)));
    const q = this.charge;
    const windHead = new THREE.Vector3(toolDistance*(0.30+0.015*q), toolDistance*(-0.10+0.36*q), -toolDistance*(1-0.30*q))
      .applyQuaternion(cameraRotation).add(this.camera.position);
    const windRotation = cameraRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35-0.9*q, 0.20+0.35*q, -0.7-0.6*q)));
    if (q > 0.9 && this.phase === 'charging') windHead.x += Math.sin(this.chargeTime*65)*0.016*(q-0.9)*10;
    if (this.touchInput) {
      this.followTarget ??= this.target.clone(); this.followTarget.lerp(this.target, 1 - Math.exp(-dt * 14));
      const follow = this.followTarget.clone().sub(idleHead).multiplyScalar(0.35);
      idleHead.add(follow); windHead.add(follow);
    }
    let head = idleHead.clone(), rotation = idleRotation.clone();
    if (this.phase === 'charging') { head.copy(windHead); rotation.copy(windRotation); }
    if (this.phase === 'strike') {
      const hit = this.lockedHit;
      const impactHead = this.lockedTarget.clone().addScaledVector(hit?.normal || new THREE.Vector3(0,0,1), 0.018);
      const impactRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), hit?.normal || new THREE.Vector3(0,0,1));
      impactRotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), -0.35));
      if (this.swingTime <= IMPACT_SECONDS) {
        const t = Math.min(1,this.swingTime/IMPACT_SECONDS)**2;
        head.copy(windHead).lerp(impactHead,t);
        // Bow the accelerated path around the elbow; endpoints stay exact.
        head.x += Math.sin(t*Math.PI)*0.22; head.y += Math.sin(t*Math.PI)*0.25;
        rotation.copy(windRotation).slerp(impactRotation,t);
      } else {
        const t = THREE.MathUtils.clamp((this.swingTime-IMPACT_SECONDS)/(0.035*this.entry.feel.swingMass),0,1);
        head.copy(impactHead).addScaledVector(hit?.normal || new THREE.Vector3(0,0,1),0.15*t);
        rotation.copy(impactRotation);
        const recovery = THREE.MathUtils.clamp((this.swingTime-IMPACT_SECONDS-0.035*this.entry.feel.swingMass)/(0.16*this.entry.feel.swingMass),0,1);
        head.lerp(idleHead,recovery*recovery*(3-2*recovery)); rotation.slerp(idleRotation,recovery);
      }
      if (this.swingTime >= IMPACT_SECONDS && !this.didHit) {
        this.didHit = true;
        // Hold a physics step exactly at contact before the short recoil.
        head.copy(impactHead); rotation.copy(impactRotation);
        if (!this.interceptSwing?.(this.raycaster)) {
          if (hit) { this.pendingHit = hit; this.contactPending = true; this.flexVelocity = 2.6*hit.strength; }
          else this.onMiss?.();
        }
      }
      if (this.swingTime >= IMPACT_SECONDS + 0.195*this.entry.feel.swingMass) this.phase = 'idle';
    }
    this.group.quaternion.copy(rotation);
    this.group.position.copy(head).sub(this.headCenter.clone().applyQuaternion(rotation));
    // The visual spring uses small steps even when the input clock catches up.
    const flexDt = Math.min(dt, 1 / 60);
    this.flexVelocity += (-260*this.flexAmount - 30*this.flexVelocity)*flexDt;
    this.flexAmount += this.flexVelocity*flexDt;
    this.model.flex(THREE.MathUtils.clamp(Math.abs(this.flexAmount)*8,0,1), this.flexNormal);
    this.group.updateMatrixWorld(true);
    for (const [i,ghost] of this.ghosts.entries()) {
      const pose=this.poseHistory[i]; ghost.visible=this.enabled && this.phase==='strike' && this.swingTime<0.15 && !!pose;
      if(ghost.visible) {
        ghost.position.copy(this.group.worldToLocal(pose.position.clone()));
        ghost.quaternion.copy(this.group.quaternion).invert().multiply(pose.rotation);
      }
    }
    this.poseHistory.unshift({position:this.group.position.clone(),rotation:this.group.quaternion.clone()}); this.poseHistory.length=Math.min(4,this.poseHistory.length);
    this.indicator.style.opacity = '0';
    this.indicator.style.setProperty('--charge', `${this.phase === 'charging' ? this.charge*360 : 360}deg`);
  }
  beforePhysics(cloth, mesh) {
    if (cloth !== this.boundCloth) { cloth.setBeaterColliders?.(this.model.colliders); this.boundCloth = cloth; }
    const position = mesh.worldToLocal(this.group.position.clone());
    const quaternion = mesh.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(this.group.quaternion);
    // Disabled input cannot touch the menu carpet through Bullet either.
    if (!this.enabled) position.z += 100;
    cloth.setBeaterPose(position, quaternion);
  }
  afterPhysics(cloth) {
    if (!this.contactPending) return;
    const event = { ...this.pendingHit, physicalContact: cloth.hasBeaterContact(this.pendingHit.point) };
    this.contactPending = false; this.pendingHit = null;
    for (const cb of this.callbacks) cb(event);
  }
  dispose() {
    for (const ghost of this.ghosts || []) ghost.traverse(o=>o.material?.dispose());
    for (const [name, fn] of [['pointermove',this.move],['pointerdown',this.down],['pointerup',this.up],['pointercancel',this.cancel],['pointerleave',this.cancel],['lostpointercapture',this.cancelHold]]) this.dom.removeEventListener(name,fn);
    window.removeEventListener('blur',this.cancel); this.indicator.remove(); this.model.dispose(); this.callbacks.clear();
  }
}
