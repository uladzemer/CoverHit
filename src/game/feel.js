import * as THREE from 'three';

export const feel = Object.freeze({
  idealWindow: Object.freeze([.62, .82]),
  goodCharge: .4,
  excellentBonus: 1.25,
  hitStop: Object.freeze({ min: .040, max: .060, timeScale: .08 }),
  shake: Object.freeze({ gain: .009, max: .035, decay: 16, frequencyX: 87, frequencyY: 73 }),
  impactSeconds: .120,
  hintCleanliness: .70,
});
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const chargeFromStrength = strength => clamp((strength - .25) / .75);
export function strikeQuality(strength) {
  const charge = chargeFromStrength(strength);
  if (charge >= feel.idealWindow[0] - 1e-9 && charge <= feel.idealWindow[1] + 1e-9) return 'excellent';
  return charge >= feel.goodCharge ? 'good' : 'weak';
}
export const hitStopSeconds = strength => feel.hitStop.min + (feel.hitStop.max - feel.hitStop.min) * clamp(strength);
export const soundIntensity = strength => clamp(strength);
export const shakeAmount = (current, strength, reduced = false) => reduced ? 0 : Math.min(feel.shake.max, current + clamp(strength) * feel.shake.gain);
export const effectTimeScale = (remaining, reduced = false) => !reduced && remaining > 0 ? feel.hitStop.timeScale : 1;

// Own the visual clock only. The fixed-step Game/Bullet clocks still receive real dt.
export function installFeel({ scene, beater, dust, game, hud }) {
  const motion = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motion.matches || hud.reduceMotion;
  let until = 0, impactAge = Infinity;
  const scale = () => effectTimeScale(until - performance.now() / 1000, reduced());
  const originalUpdate = beater.update;
  beater.update = function(dt) { return originalUpdate.call(this, dt * scale()); };
  const originalDustUpdate = dust.update;
  dust.update = function(dt) { return originalDustUpdate.call(this, dt * scale()); };
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,235,199,.35)'); gradient.addColorStop(.55,'rgba(255,235,199,0)');
  gradient.addColorStop(.7,'rgba(255,235,199,.8)'); gradient.addColorStop(.84,'rgba(255,235,199,0)');
  ctx.fillStyle=gradient; ctx.fillRect(0,0,64,64);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map:texture, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false, toneMapped:false });
  const sprite = new THREE.Sprite(material); sprite.name='strike-impact'; sprite.visible=false; scene.add(sprite);
  const off = game.on('hit', ({ strength, quality }) => {
    if (reduced()) return;
    until = performance.now()/1000 + hitStopSeconds(strength);
    if (game.comboMultiplier > 1) hud.bump(hud.nodes.combo);
    if (quality === 'excellent') hud.bump(hud.nodes.score);
  });
  return {
    scale, reduced,
    impact(point, normal, strength) {
      if (reduced()) return;
      sprite.position.copy(point).addScaledVector(normal,.025);
      sprite.userData.strength = clamp(strength); sprite.scale.setScalar(.12); material.opacity=.65; impactAge=0; sprite.visible=true;
    },
    update(dt) {
      impactAge += dt;
      sprite.visible = !reduced() && impactAge < feel.impactSeconds;
      if (!sprite.visible) return;
      const age = impactAge/feel.impactSeconds;
      sprite.scale.setScalar((.12 + age*.26) * (.65 + sprite.userData.strength*.35));
      material.opacity = (1-age)*.65;
    },
    dispose() { off(); beater.update=originalUpdate; dust.update=originalDustUpdate; sprite.removeFromParent(); material.dispose(); texture.dispose(); },
  };
}
