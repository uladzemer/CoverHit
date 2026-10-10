/** Incident propagation and particle-to-camera directions: positive = backlit. */
export function hgPhase(cosTheta, g = 0.6) {
  const c = Number.isFinite(cosTheta) ? Math.max(-1, Math.min(1, cosTheta)) : 0;
  g = Number.isFinite(g) ? Math.max(-0.95, Math.min(0.95, g)) : 0.6;
  return (1 - g * g) / (4 * Math.PI * (1 + g * g - 2 * g * c) ** 1.5);
}
export function dustColor(cosTheta) {
  const light = Math.min(1, hgPhase(cosTheta) * 1.5);
  return [0.30 + 0.42 * light, 0.27 + 0.29 * light, 0.22 + 0.16 * light];
}
