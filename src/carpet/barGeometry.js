// Rack dimensions in metres. All consumers use this geometry, including local
// cloth coordinates (the mesh is translated to the rack in the yard).
export const BAR_HEIGHT = 2.15;
export const BAR_RADIUS = .024;
export const BAR_POST_RADIUS = .036;
export const BAR_MIN_SPAN = 3.2;
export const BAR_END_CLEARANCE = .3;
export const CARPET_THICKNESS = .012;
export const CARPET_HALF_THICKNESS = CARPET_THICKNESS / 2;
export const CARPET_GROUND_CLEARANCE = .25;
export const BAR_CONTACT_RADIUS = BAR_RADIUS + CARPET_HALF_THICKNESS + .0001;
export const BAR_FLIP_RADIUS = BAR_RADIUS + CARPET_THICKNESS + .0001;
// Bullet SDF omits the rigid margin; retain its measured contact padding.
export const BAR_SDF_MARGIN = CARPET_HALF_THICKNESS + .01;
export const CLOTH_BAR_OFFSET = .06;
export function rackSpan(spans) {
  return Math.ceil(10 * Math.max(BAR_MIN_SPAN, ...spans.map(span => span + 2 * BAR_END_CLEARANCE))) / 10;
}
