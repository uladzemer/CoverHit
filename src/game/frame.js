export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = .5;
export const MAX_SUBSTEPS = 30;

// Keep the frame timing policy shared with input/impact regression tests.
export function advanceGameplayFrame({ game, beater, cloth, mesh }, elapsed, accumulator = 0) {
  if (!Number.isFinite(elapsed) || elapsed < 0) return accumulator;
  // Interleave elapsed clocks with fixed solves. Advancing a whole hitch before
  // all its solves used to seat every hand step at the same future flip pose.
  accumulator = Math.max(0, Number.isFinite(accumulator) ? accumulator : 0);
  let remaining=Math.min(elapsed,MAX_FRAME_DT);
  let stepped = false;
  let substeps = 0;
  while(remaining>1e-10 && substeps<MAX_SUBSTEPS){
    const h=Math.min(remaining,Math.max(0,FIXED_DT-accumulator));
    game.update(h);beater.update(h);remaining-=h;accumulator+=h;
    if(accumulator+1e-10>=FIXED_DT){
      beater.beforePhysics(cloth,mesh);cloth.integrate(FIXED_DT);beater.afterPhysics(cloth);
      accumulator=Math.max(0,accumulator-FIXED_DT);substeps++;stepped=true;
    }
  }
  const dropped=remaining+Math.max(0,elapsed-MAX_FRAME_DT);
  if(dropped>0){game.update(dropped);beater.update(dropped);}
  if (stepped) cloth.refreshGeometry();
  return Math.max(0,accumulator);
}
