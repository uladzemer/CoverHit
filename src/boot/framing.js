// Conservative fit for both posts, their feet and the hanging cloth; shake reserve.
export function cameraFraming(aspect, barLength, drop, barHeight = 2.15) {
  const fov = aspect < .8 ? Math.min(68, 56 + (.8 - aspect) * 24) : 48;
  const tan = Math.tan(fov * Math.PI / 360);
  const portrait = aspect < .8;
  const targetHeight = barHeight - drop / 2;
  const distance = Math.max(2.9, drop / (tan * 1.08), (barLength + .4) / (2 * tan * aspect * .86),
    Math.max(targetHeight, barHeight - targetHeight) / (tan * .84) + .4);
  return { fov, distance, x: .2, y: barHeight - .33 + (portrait ? .12 : 0) };
}
