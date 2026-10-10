The facades and Zhiguli now use constructive photographic mapping. The changes are local; the published GitHub Pages game has not been deployed from this worktree.

The wall uses one EXIF-upright original per visual family: Tyumen (7) for panel 1-464, Valday (11) for panel 1-335, Bor (8) for silicate brick 1-447, and Pavlovsky Posad (6) for nine-storey/loggia. Manually specified source quadrilaterals in `scripts/facade-grid.json` produce independent wall and window homographies. Pane sub-quads are rectified independently before the frontal composite is assembled. The Valday crop is softer than Tyumen: constructive framing fixes alignment but does not invent native detail or certify historical series identity.

Each 2048px atlas contains four 1008px cells with 8px replicated gutters: ground, typical, end-bay/glass variation, top. Frames, openings, sill and joints have identical coordinates in every slot. All walls use 2.7m floors and whole metric bays (3.1m panel, 3.0m brick, 3.2m loggia). Seeded selection changes glass, without reflecting cells or changing wall brightness/density. Near photographic openings are thin parallel layers in the same batch, sampled with their cell's emission mask. Balcony slabs attach to the wall on floor lines at bay centres; thickness is 0.15m and each has one consistent railing. Legacy duplicate boxes and stains are removed/hidden with the procedural window batches. Distant impostors select whole-cell ranges at the same metric pitch, including school floors, instead of stretching a complete building across arbitrary widths. Photo UVs have half-texel inset, clamp-to-edge, trilinear mipmaps and anisotropy 16 on this QA device. The shared concrete normal still repeats and fades under minification.

The car uses a bevelled painted volume and a simple cabin, reflective glass, lathe tyres, photo rim crops and primitive lights/bumpers. Side photographs are flat cards at x=+/-0.818m; front/rear cards are flat too. Source wheel and cabin landmarks are mapped piecewise in image space to a 2.42m wheelbase. Manual silhouette coverage and wheel-arch alpha reject the background. There is no photographed UV projection on the body volume. The exposure-cleaned civilian atlas remains the input and is unchanged; its paint-mask alpha is separate from the new coverage alpha. The vehicle is 1,792 triangles plus 12 triangles for the runtime glass primitive, below 2k. Paint has bounded 0.8% noise. Photo cards, rims and end views share one atlas/batch.

Independent shipped-WebP frame acceptance is in [cell-quality.json](cell-quality.json). Independent WebGL render acceptance is in [geometry-quality.json](geometry-quality.json): front and elevated orthographic views, five full floors for panel/brick and nine full floors for the nine-storey family. Five-storey captures are 2000px; nine-storey captures are 3600px, preserving the same pixels/metre. The elevated camera's vertical cosine is accounted for when measuring pitch. Floor pitch is measured from repeated detected frame-top edges, which avoids confusing brick mortar courses with structural floors. Raw joint candidates are also disclosed. Straightness selects the longest connected frame edge in a narrow search strip, rather than cancelling signed deviations across unrelated photo edges.

| Family | Front maximum edge angle | Elevated maximum edge angle | Largest pitch error, px | Elevated pitch variance, px^2 | Front detected opening aspect |
| --- | --- | --- | --- | --- | --- |
| 1-464 | 0.257 degrees | 0.141 degrees | 0.480 | 0.216 | 1.065 |
| 1-335 | 0.193 degrees | 0.212 degrees | 0.508 | 0.241 | 1.070 |
| 1-447 | 0.047 degrees | 0.046 degrees | 0.381 | 0.133 | 1.043 |
| Nine-storey | 0.031 degrees | 0.053 degrees | 0.353 | 0.080 | 1.710 |

Every edge angle passes <=0.3 degrees and every pitch error passes +/-1px. Planned opening aspects are 1.078 (panels), 1.043 (brick), 1.724 (loggia); pixel measurements include frame thickness and rasterisation. This certifies constructed frames/grid, not every curtain fold or weathered grain in the source photo.

The car sill has 0.0px maximum deviation and 0.041 degrees edge angle. Tyre ellipse aspects are 1.00032, 1.00045. Wheel contours explicitly exclude the chassis connection; the unfiltered dark component also contains the chassis bar (264x248px) and is not a wheel contour. The fitted tyre axes and method are disclosed in the JSON.

Exposure, frame timing and texture inventory are in [performance.json](performance.json), compared with the incoming-tree [baseline](baseline.json). Chrome 155.0.8059.39, High, 1440x900, seed `colour-1986`, carpet 09; 240 warmed samples per view. Default photo draws are 124 versus 122 baseline (**+2**). Procedural High is 143, missing-photo High is 142 and all quality modes remain <=150. The photo switch, restoration, UI selector, saved mode and all-missing-photo fallback pass, with no browser/shader errors.

Mean of initial/restored default minus baseline: total CPU -0.809ms, submission +0.070ms, GPU -1.862ms. The <=0.5ms regression guard passes on this QA device; quality transitions still have existing multi-second shader compilation and are not warmed timings.

| Exposure region | Fixed reference | Final | Change |
| --- | --- | --- | --- |
| pad | 0.2162 | 0.2488 | +15.1% |
| lawn | 0.2023 | 0.2053 | +1.5% |
| facade | 0.2356 | 0.2669 | +13.3% |

All regions pass +/-20%; clipped default pixels: 0%. The [carpet colour report](colour/after.json) passes the full verifier, including quality changes, bloom and shadows; hue shift is <=0.606 degrees, saturation retention >=98.26%, carpet/canvas clipping 0%. Global exposure, lighting and carpet/UI/game source files were not edited. Build-generated unrelated public carpet metadata was restored from `git show`.

Before/after captures block optional yard stock and the local carpet manifest, so these attributed CC captures may be versioned. Colour probes that may contain stock remain ignored. All source authors/licences remain in `credits.json`; Valday's existing CC BY 3.0 credit now covers the active panel335 composite. Derivative source IDs, including impostors and the PD silhouette, are updated in the manifest, SOURCES and NOTICE.

| View | Before | After |
| --- | --- | --- |
| Default | [Before](baseline-default.png) | [After](photo-default.png) |
| Wide | [Before](baseline-wide.png) | [After](photo-wide.png) |
| Aim left | [Before](baseline-aim-left.png) | [After](photo-aim-left.png) |
| Aim right | [Before](baseline-aim-right.png) | [After](photo-aim-right.png) |
| House close | [Before](baseline-facade-close.png) | [After](photo-facade-close.png) |
| House middle | [Before](baseline-facade-mid.png) | [After](photo-facade-mid.png) |
| House far | [Before](baseline-facade-far.png) | [After](photo-facade-far.png) |
| Car side | [Before](baseline-car-side.png) | [After](photo-car-side.png) |
| Car front | [Before](baseline-car-front.png) | [After](photo-car-front.png) |
| Car 3/4 | [Before](baseline-car-three-quarter.png) | [After](photo-car-three-quarter.png) |

`npm test`: 48 files passed, 332 tests passed, 7 optional skipped. `npm run build`: passed (existing chunk-size advisory). `git diff --check`: passed. Git operations were limited to status/diff/show; no commit or stash. No files in `src/carpet/**`, `src/game/**` or `src/ui/**` changed.

Reproduce with Python dependencies from `scripts/facades-requirements.txt`: `node scripts/build-facade-modules.mjs`, then `node scripts/build-car-planes.mjs`. Run Vite on 5187, then `node docs/qa/facades3/orthographic.mjs`, `python docs/qa/facades3/measure.py`, and `node docs/qa/facades3/verify.mjs` (capture `--baseline` before changing an incoming tree). For colour use `COLOUR_OUT=docs/qa/facades3/colour` and `COLOUR_URL=http://127.0.0.1:5187/?seed=colour-1986` with `node scripts/verify-carpet-colour.mjs after`. The download pipeline still rebuilds the grid and its civilian cleanup rebuilds the flat cards.

Decisions:

- Use manually rectified frontal composites with identical metric cells; restore Valday for its own panel335 appearance and disclose softness.
- Use one aligned balcony slab/railing per grid position, and flat car cards over an independent painted volume.
- Keep existing source licences and exposure/carpet treatment; preserve the switch, missing-photo fallback and sidewalk frontage.
