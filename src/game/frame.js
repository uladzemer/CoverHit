export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 1 / 30;
export const MAX_SUBSTEPS = 2;

// Keep the frame timing policy shared with input/impact regression tests.
export function advanceGameplayFrame({ game, beater, cloth, mesh }, elapsed, accumulator = 0) {
  if (!Number.isFinite(elapsed) || elapsed < 0) return accumulator;
  // Input and arcade clocks follow elapsed time, even when rendering is slow.
  // Only the expensive cloth simulation drops catch-up steps.
  game.update(elapsed);
  beater.update(elapsed);
  accumulator = Math.min(Math.max(0, Number.isFinite(accumulator) ? accumulator : 0) + Math.min(elapsed, MAX_FRAME_DT), FIXED_DT * MAX_SUBSTEPS);
  let stepped = false;
  let substeps = 0;
  while (accumulator >= FIXED_DT && substeps++ < MAX_SUBSTEPS) {
    beater.beforePhysics(cloth, mesh);
    cloth.integrate(FIXED_DT);
    beater.afterPhysics(cloth);
    accumulator -= FIXED_DT;
    stepped = true;
  }
  if (stepped) cloth.refreshGeometry();
  return accumulator;
}
