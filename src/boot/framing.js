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

// Frame the cloth with a frontal eye line. Moving the lens window vertically
// keeps the projected view and touch rays on the same camera.
function phoneFraming(aspect, barLength, drop, barHeight, span) {
  const portrait = aspect < 1.3;
  const targetY = barHeight - drop / 2 + .15;
  // Tall runners need a little less width to clear the SE's top HUD.
  const runner = drop / span > .8;
  const portraitWidth = runner ? .94 : .98;
  // Fit the cloth, not the rack. Thickness adds a small amount to the nominal
  // 98% width; portrait posts can leave the frame.
  const distance = portrait
    ? span / (2 * Math.tan(50 * Math.PI / 360) * aspect * portraitWidth) + .04
    : 3.8;
  const y = portrait ? 1.8 : Math.max(1.7, Math.min(1.85, targetY + distance * Math.tan(5.8 * Math.PI / 180)));
  const tilt = Math.atan2(y - targetY, distance);
  const depth = height => distance * Math.cos(tilt) + (y - height) * Math.sin(tilt);
  // Keep the cloth between the landscape HUD columns on the shorter SE.
  const panelHeight = Math.min(.62, .56 * aspect * drop / span);
  const fov = portrait ? 50 : 2 * Math.atan(
    drop * distance / (depth(barHeight) * depth(barHeight - drop) * 2 * panelHeight)
  ) * 180 / Math.PI;
  const tan = Math.tan(fov * Math.PI / 360);
  const screenY = height => .5 - ((height - y) * Math.cos(tilt) + distance * Math.sin(tilt)) / (2 * tan * depth(height));
  const viewOffset = (screenY(barHeight) + screenY(barHeight - drop)) / 2 - (portrait ? (runner ? .423 : .42) : .46);
  return { fov, distance, x: 0, y, targetY, viewOffset, phone: true };
}
