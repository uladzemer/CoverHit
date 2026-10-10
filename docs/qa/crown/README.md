# Crown seating regression

The visual rack and physics already used the same 2.15 m axis height and
24 mm pipe radius. The root cause was `clothRestPosition`: it selected a
crown segment count using `BAR_RADIUS + CARPET_THICKNESS + .016`, then
computed its actual radius from the coarse cloth link length:

`radius = step / (2 * sin(pi / (4 * crown)))`

Consequently, changing carpet size or grid resolution changed the support
radius. Shipped museum scans had initial inner crown gaps of 28.9–76.1 mm
(35.1 mm for the 3.5 m wool scan). Sparse anchors and the minimum-height
projection envelope preserved the oversized rest shape. Bullet's native
contact padding could additionally lift unanchored crown vertices.

`src/carpet/barGeometry.js` now owns rack height, radius, post radius, span
calculation, thickness, projection/contact radius and native SDF padding.
The yard mesh, cloth cylinder, fold layout, render offset, layer separation
and camera consume it. The app passes the actual yard span into physics.

Four small circumscribed crown chords follow the pipe dimensions. Links
are built in flat material coordinates with those small intervals before
wrapping, and UVs follow material distance. Remaining panel intervals retain
the carpet's exact total length. Projection seats the supported collar,
including both side tangencies, while the hanging panels stay dynamic.
The inner crown clearance is 2.58 mm at its top and side vertices, and
0.10 mm at the closest points inside the facets.

`tests/crown.test.js` constructs real Ammo bodies headlessly for all four
material types in portrait and landscape orientations and all ten shipped
scans. It checks initial and settled crown gaps, side tangencies, facet
clearance, and the actual yard crossbar mesh's radius, height and span.

Evidence:

- `browser.json`: three carpet types settled for three seconds, all crown
  gaps 2.58 mm; no browser errors.
- `palas-front.png`, `palas-side.png`, `wool-front.png`, `wool-side.png`,
  `runner-front.png`, `runner-side.png`: rendered evidence. The axial side
  view hides rack uprights to expose the crown.
- `fold/browser.json`: fold, flip, both halves, scan orientation and gameplay.
- `bar-clip/browser.json`: native SDF contact and 40 impulse / 40 pointer
  strike checks; zero pipe penetrations and zero wrong-side crossings.
- `layers/browser.json`: both fold axes, native clusters enabled/disabled,
  30 hits and two flips; zero layer and pipe violations.
- `longrun.json`: 60 Hz, 144 Hz and hitch timing; 180 seconds idle, 34 actual
  pointer strikes and two flips per timing variant.

All crown PNGs are ignored because captures may contain licensed local
carpet and yard stock. JSON metrics and this report contain no stock pixels.

Reproduce with a dev server on port 5173:

```
node scripts/verify-crown.mjs
QA_OUT=docs/qa/crown/fold node scripts/verify-fold.mjs
QA_OUT=docs/qa/crown/bar-clip node scripts/verify-bar-clip.mjs
QA_OUT=docs/qa/crown/layers node scripts/verify-layers.mjs
node scripts/verify-longrun.mjs --out=docs/qa/crown/longrun.json
npm test
npm run build
```

On PowerShell, set `QA_OUT` using `$env:QA_OUT='...'` before each command.

Validation complete: 177 tests passed; production build passed; fold,
bar-clip, layers and all three longrun variants passed. Each longrun variant
completed 225 simulated seconds with 34 strikes, two flips, zero watchdog
recoveries and zero browser errors.
