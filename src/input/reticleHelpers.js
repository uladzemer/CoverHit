const clamp = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
export const RETICLE_SIZE_KEY = 'coverhit.reticleSize';
export function chargeArc(charge) { return clamp(charge) * Math.PI * 2; }
// Keep the 13 cm ring at nearby distances, with a 26 px minimum at long range.
export function reticleScale(distance, fov, height, size = 'normal') {
  const pixelDiameter = 2 * Math.max(0, distance) * Math.tan(fov * Math.PI / 360) * 26 / Math.max(1, height);
  return Math.max(0.13, pixelDiameter) / 0.13 * (size === 'large' ? 1.5 : 1);
}
export function reticleState({ enabled = true, flipping = false, onCarpet = false, moth = false, charging = false, charge = 0, strikeAge = Infinity }) {
  return { visible: enabled || flipping, surface: onCarpet, target: moth,
    opacity: flipping ? 0.28 : onCarpet || moth ? 0.92 : 0.38,
    arc: charging ? chargeArc(charge) : 0, pulse: charging && charge >= 1,
    snap: strikeAge >= 0 && strikeAge < 0.16 ? Math.sin(strikeAge / 0.16 * Math.PI) : 0 };
}
export function readReticleSize(storage) {
  try { return storage.getItem(RETICLE_SIZE_KEY) === 'large' ? 'large' : 'normal'; } catch { return 'normal'; }
}
export function saveReticleSize(storage, size) { try { storage.setItem(RETICLE_SIZE_KEY, size); } catch { /* Storage may be unavailable. */ } }
