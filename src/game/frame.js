export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = .5;
export const MAX_SUBSTEPS = 30;
const cachedDirt = new WeakSet();

// Dirt changes publish texture.version. Share exact sums between game substeps
// and the HUD without rescanning 16,384 unchanged cells multiple times a frame.
export function cachePhoneCleanliness(dirt) {
  if(!dirt?.texture || !dirt.halfCleanliness || cachedDirt.has(dirt))return;
  cachedDirt.add(dirt);
  const original=dirt.halfCleanliness,values=new Float64Array(2);
  let version=-1,grid=null,axis=null,size=0;
  dirt.halfCleanliness=function(side) {
    if(version!==this.texture.version||grid!==this.grid||axis!==this.foldAxis||size!==this.size){
      version=this.texture.version;grid=this.grid;axis=this.foldAxis;size=this.size;values.fill(NaN);
    }
    const index=side===0?0:1;
    if(Number.isNaN(values[index]))values[index]=original.call(this,side);
    return values[index];
  };
}

export function frameSubstepLimit(profile = 'full', elapsed = 0) {
  return profile === 'minimal' ? (elapsed > .020 ? 1 : 2) : profile === 'lite' ? 1 : MAX_SUBSTEPS;
}

// Keep the frame timing policy shared with input/impact regression tests.
export function advanceGameplayFrame({ game, beater, cloth, mesh }, elapsed, accumulator = 0) {
  if (!Number.isFinite(elapsed) || elapsed < 0) return accumulator;
  // Interleave elapsed clocks with fixed solves. Advancing a whole hitch before
  // all its solves used to seat every hand step at the same future flip pose.
  accumulator = Math.max(0, Number.isFinite(accumulator) ? accumulator : 0);
  let remaining=Math.min(elapsed,MAX_FRAME_DT);
  let stepped = false;
  let substeps = 0;
  const profile=globalThis.window?.__coverhit?.renderPipeline?.profile ?? cloth.profile ?? 'full';
  cloth.profile=profile;
  const api=globalThis.window?.__coverhit;
  if(profile!=='full' && api?.cloth===cloth)cachePhoneCleanliness(api.dirt);
  const limit=frameSubstepLimit(profile,elapsed);
  // Match phone physics to its production 30 Hz render cadence; full stays 60.
  const fixedDt=profile==='full'?FIXED_DT:1/30;
  if(profile!=='full' && elapsed<=.05){
    // A normal phone frame has one solve. Advance its clocks once rather than
    // emitting duplicate timer/HUD work for the accumulator's small remainder.
    game.update(elapsed);beater.update(elapsed);accumulator+=elapsed;
    while(accumulator+1e-10>=fixedDt && substeps<limit){
      beater.beforePhysics(cloth,mesh);cloth.integrate(fixedDt);beater.afterPhysics(cloth);
      accumulator=Math.max(0,accumulator-fixedDt);substeps++;stepped=true;
    }
    if(accumulator>=fixedDt)accumulator%=fixedDt;
    if(stepped)cloth.refreshGeometry();
    return accumulator;
  }
  while(remaining>1e-10 && substeps<limit){
    const h=Math.min(remaining,Math.max(0,fixedDt-accumulator));
    game.update(h);beater.update(h);remaining-=h;accumulator+=h;
    if(accumulator+1e-10>=fixedDt){
      beater.beforePhysics(cloth,mesh);cloth.integrate(fixedDt);beater.afterPhysics(cloth);
      accumulator=Math.max(0,accumulator-fixedDt);substeps++;stepped=true;
    }
  }
  const dropped=remaining+Math.max(0,elapsed-MAX_FRAME_DT);
  if(dropped>0){game.update(dropped);beater.update(dropped);}
  if (stepped) cloth.refreshGeometry();
  return Math.max(0,accumulator);
}
