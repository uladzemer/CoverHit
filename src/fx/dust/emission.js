/** DirtMap.hit returns a fraction of the entire carpet, not normalized hit strength. */
export function emissionProfile(amount) {
  const dirt = Number.isFinite(amount) ? Math.max(0, Math.min(0.08, amount)) : 0;
  const intensity = dirt / 0.025;
  const cloud = Math.floor(60 * Math.min(1, intensity));
  const specks = Math.floor(Math.min(400, 160 * intensity));
  const haze = Math.floor(4 * Math.min(1, intensity));
  const edge = Math.floor(12 * Math.min(1, Math.max(0, intensity - 0.65)));
  return {
    cloud, specks, haze, edge, total: cloud + specks + haze + edge,
    size: dirt === 0 ? 0 : Math.min(1.7, Math.max(0.15, Math.sqrt(intensity))),
  };
}

export function particleBudget(capacity = 3000) {
  return Number.isFinite(capacity) ? Math.max(0, Math.min(3000, Math.floor(capacity))) : 3000;
}

/** Reserve room for lingering haze even during sustained hits. */
export function allocateEmission(profile, capacity, live = {}) {
  const budget = particleBudget(capacity);
  const limits = { cloud: Math.floor(budget * 0.55), haze: Math.floor(budget * 0.08) };
  limits.specks = budget - limits.cloud - limits.haze;
  const room = key => Math.max(0, limits[key] - Math.max(0, Math.ceil(live[key] || 0)));
  const wantedCloud = profile.cloud + profile.edge;
  const admittedCloud = Math.min(wantedCloud, room('cloud'));
  const edge = wantedCloud ? Math.floor(admittedCloud * profile.edge / wantedCloud) : 0;
  const cloud = admittedCloud - edge;
  const haze = Math.min(profile.haze, room('haze'));
  const specks = Math.min(profile.specks, room('specks'));
  return { cloud, edge, haze, specks, total: admittedCloud + haze + specks };
}
