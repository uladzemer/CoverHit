/** CSS size limits become framebuffer pixels at the current render DPR. */
export const DUST_PROFILES = Object.freeze({
  full: Object.freeze({count:1,size:1,alpha:1,hazeLife:1,expansion:3.5}),
  phone: Object.freeze({count:.65,size:1.4,alpha:.6,hazeLife:.3,expansion:1,
    diameter:.22,hazeDiameter:.14,peakCoverage:.35,settledCoverage:.12}),
});

export function screenSizeClamp(projectedDiameter, width, dpr = 1, haze = false) {
  if (![projectedDiameter,width,dpr].every(Number.isFinite) || width<=0 || dpr<=0) return 0;
  return Math.max(0,Math.min(projectedDiameter,width*dpr*(haze?DUST_PROFILES.phone.hazeDiameter:DUST_PROFILES.phone.diameter)));
}

/** Sum bounding-square area × maximum alpha: conservative even for rotated quads. */
export function coverageCap(sprites, width, height, youngestAge = 0) {
  const area=width*height;
  const {peakCoverage,settledCoverage}=DUST_PROFILES.phone;
  const limit=settledCoverage+(peakCoverage-settledCoverage)*(1-Math.min(1,Math.max(0,youngestAge)/1.5))**2;
  let sum=0;
  for(const {diameter,alpha} of sprites) {
    if(Number.isFinite(diameter)&&Number.isFinite(alpha)) sum+=Math.max(0,diameter)**2*Math.max(0,Math.min(1,alpha));
  }
  const requested=area>0?sum/area:0;
  const scale=requested>limit?limit/requested:1;
  return {requested,limit,scale,applied:Math.min(1,requested*scale)};
}
