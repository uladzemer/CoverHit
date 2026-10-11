// Conservative fit for both posts, their feet and the hanging cloth; shake reserve.
export function cameraFraming(aspect, barLength, drop, barHeight = 2.15, phone = false, span = barLength) {
  if (phone) return phoneFraming(aspect, barLength, drop, barHeight, span);
  const fov = aspect < .8 ? Math.min(68, 56 + (.8 - aspect) * 24) : 48;
  const tan = Math.tan(fov * Math.PI / 360);
  const portrait = aspect < .8;
  const targetHeight = barHeight - drop / 2;
  const distance = Math.max(2.9, drop / (tan * 1.08), (barLength + .4) / (2 * tan * aspect * .86),
    Math.max(targetHeight, barHeight - targetHeight) / (tan * .84) + .4);
  return { fov, distance, x: .2, y: barHeight - .33 + (portrait ? .12 : 0) };
}

// A fixed rack limits the zoom for narrow rugs. Keep both post radii and a
// motion reserve visible rather than changing the physical rack or aim mapping.
function phoneFraming(aspect, barLength, drop, barHeight, span) {
  const portrait = aspect < 1.3;
  const y = 2.7;
  const distanceFor = fov => {
    const tan = Math.tan(fov * Math.PI / 360);
    const pose = distance => {
      let lower = 0, upper = Math.PI / 3;
      const projectY = (height, tilt) => .5 - ((height - y) * Math.cos(tilt) + distance * Math.sin(tilt)) / (2 * tan * (distance * Math.cos(tilt) + (y - height) * Math.sin(tilt)));
      // Centre the projected hanging panel, accounting for perspective rather
      // than just placing its world-space midpoint on the desired screen row.
      for (let i = 0; i < 24; i++) {
        const angle = (lower + upper) / 2;
        if ((projectY(barHeight, angle) + projectY(barHeight - drop, angle)) / 2 > .4) lower = angle; else upper = angle;
      }
      const tilt = (lower + upper) / 2;
      const depth = height => distance * Math.cos(tilt) + (y - height) * Math.sin(tilt);
      const screenY = height => .5 - ((height - y) * Math.cos(tilt) + distance * Math.sin(tilt)) / (2 * tan * depth(height));
      return { tilt, depth, height: screenY(barHeight - drop) - screenY(barHeight) };
    };
    let lo = 3.2, hi = 30;
    for (let i = 0; i < 40; i++) {
      const d = (lo + hi) / 2, p = pose(d);
      // Six percent cloth margin, with an independent fit for the fixed posts.
      // Landscape HUD columns occupy the outer 20% on each side. A 60%
      // panel fit keeps the top digits and bottom strip clear even on SE.
      const clothFraction = portrait ? .85 : .60;
      // Portrait is carpet-first: the hanging cloth fills ~85% of the width and the posts may run off the
      // screen edges (the bar still reads as a pipe crossing the frame). Landscape keeps both posts visible.
      const needed = portrait ? span * 1.06 / clothFraction : Math.max(span * 1.06 / clothFraction, (barLength + .16) / .94);
      const width = needed / (2 * tan * aspect * p.depth(barHeight));
      if (width > 1 || (!portrait && p.height > .70)) lo = d; else hi = d;
    }
    return {distance:hi, ...pose(hi)};
  };
  // Portrait retains a natural 52 degree lens. Landscape uses the drop to
  // choose a tighter lens at the existing beater-safe minimum distance.
  const fov = portrait ? 52 : Math.min(48, 2 * Math.atan(drop / (2 * 3.4 * .70)) * 180 / Math.PI);
  const p = distanceFor(fov);
  return {fov, distance:p.distance, x:0, y, targetY:y - p.distance * Math.tan(p.tilt), phone:true};
}
