# Phone sunset QA

The phone direct path now uses the desktop 7.5° behind-left sun, its analysed 3500–4000 K colour (3500 K fallback), and intensity 6. It has one directional shadow map, two inexpensive hemisphere fills, and the existing scene/present pair. No composer, CSM, HDRI, N8AO, or new fullscreen pass is used on lite/minimal. Camera and input source files were not edited.

## Sun presence, default start state

CSS compositor screenshots, deterministic `colour-1986` seed, frozen production frame/camera, production assets. Right-hand facade pixels are classified by world normal against the shared sun direction. The ground mask covers visible asphalt/lawn in the lower half. Shadow coverage is the fraction below 70% of a lit neighbour: brightest ground sample among six offsets of 20/35 CSS px at width 393 (scaled with viewport width). Texture variation also contributes; the no-shadow comparison independently confirms actual directional shadow attenuation. R/B is the ratio of mean red to mean blue, not a Kelvin estimate.

| Portrait device/profile | Lit/shade luminance | Shadow coverage | Lit R/B | Shade R/B |
|---|---:|---:|---:|---:|
| iPhone 14 Pro, before lite | 0.83× | 2.7% | 1.46 | 1.34 |
| iPhone 14 Pro, full reference | 1.81× | 14.3% | 2.09 | 0.95 |
| iPhone 14 Pro, lite | 2.10× | 12.9% | 1.71 | 0.79 |
| iPhone 14 Pro, minimal | 2.07× | 12.3% | 1.71 | 0.79 |
| iPhone SE, full reference | 1.89× | 15.8% | 2.08 | 0.97 |
| iPhone SE, lite | 2.16× | 11.9% | 1.71 | 0.79 |
| iPhone SE, minimal | 2.13× | 11.1% | 1.71 | 0.80 |
| Pixel 7 Chromium, full reference | 1.83× | 15.7% | 2.08 | 0.95 |
| Pixel 7 Chromium, lite | 2.10× | 13.3% | 1.71 | 0.79 |

The requested iPhone 14 Pro acceptance thresholds and all four ±20% comparisons pass for both lite and minimal. SE satisfies the absolute thresholds; its shadow coverage differs from full by more than 20%. Landscape screenshots are also saved; the close landscape framing contains no usable lit right-facade sample, so its temperature/contrast are reported as unavailable rather than tested against empty masks. The iPhone 14 Pro lite landscape ground coverage is 9.2%, Pixel lite 10.2%.

On iPhone 14 Pro, turning directional shadows off changes over one channel code of luminance on 41.1% of lite foreground ground pixels and 30.6% of minimal pixels. The 10–35% acceptance metric counts the deeper dark pixels relative to neighbouring lit pixels, not all penumbra.

## Clean carpet colour and brightness

Three museum carpets (03, 05, 09), portrait and landscape, eroded GPU silhouette and the same UV-filtered source scan. Full and lite use the same frozen camera/framing. No channel reaches 255 on the measured cloth.

| Lite device | Maximum hue shift | Minimum saturation retained | Maximum centre luminance deviation from full | Clipping |
|---|---:|---:|---:|---:|
| iPhone 14 Pro WebKit | 0.35° | 95.2% | 8.5% | 0% |
| iPhone SE WebKit | 0.35° | 97.2% | 8.9% | 0% |
| Pixel 7 Chromium | 0.29° | 94.4% | 9.7% | 0% |

`verify-carpet-colour.mjs --engine=webkit --profile=lite --sun --strict-sun` and the Chromium colour run pass. Original and final CSS screenshots remain local, ignored by `.gitignore`. Baselines are rendered from HEAD versions of only the three lighting/pipeline source files, leaving the production camera unchanged.

## Other checks and limits

- `npm test`: PASS, 59 files, 449 tests passed, 7 skipped. A heavily concurrent intermediate run timed out in unrelated baking/physics/layout tests; the final normal run passed in 22.95 s without changing timeouts.
- `npm run build`: PASS. The final build contains `phoneGroundFill`; generated public manifests/budgets were restored to their original content after the build.
- `verify-canvas-presented.mjs`: PASS on iPhone 14 Pro and SE, full/lite/minimal/auto, portrait/landscape, downgrade/rotation and touch UI checks. See `presented/report.json`.
- `verify-touch-aim.mjs`: Chromium PASS at every tested size, maximum hit error 0.13 px. WebKit FAIL at 320×568: 66.01 px dispatched hit error, despite 0.033 px reticle and 0.025 px target error. The original phone lighting also fails this case (66.03 px). See `touch-aim-failure.json`; no camera, strike or pointer files were changed.
- Additional Pixel default-state compositor checks: portrait PASS; landscape fails the helper's `carpetSkyDeltaE > 8` assertion (5.49 lite / 5.78 minimal). Its fixed “sky” sample at the top centre actually lies inside the black/white carpet in this landscape framing. Screenshots clearly contain the textured scene; measured canvas luminance SD is >30 and green leakage is 0%. The checker is left unchanged; this remains a failed heuristic, not a claimed PASS.
- Physical-phone GPU timing is unavailable in this Windows Playwright environment. The ≤+1 ms hardware ceiling is **not verified**. Cost is bounded architecturally: unchanged 1024²/512² single map and existing present pass, one additional shadow-only batch (~4,160 triangles), fewer analytic lights than before, no extra texture sampling in the grade. Emulated browser time cannot establish a phone GPU limit.
- At 7.5°, a 2 m caster projects 15.2 m. Much of the hanging carpet's physical shadow lies beyond the small pad; its caster remains enabled and its shadow is rendered on the ground/lawn. Camera framing affects whether that footprint is visible.

## Reproduce

Start Vite freshly in this worktree (its watch rule ignores `.claude` paths), set `COLOUR_URL` / `MOBILE_URL` / `AIM_URL` to that server, then run:

```sh
node scripts/verify-carpet-colour.mjs --engine=webkit --profile=lite --sun --strict-sun --out=docs/qa/mobile-sun/colour
node scripts/mobile-probes/verify-bright.mjs --portrait --sun --sun-only --strict-sun --out=docs/qa/mobile-sun/acceptance
node scripts/mobile-probes/verify-bright.mjs --device=se --sun --sun-only --out=docs/qa/mobile-sun/se-sun
node scripts/verify-carpet-colour.mjs --engine=chromium --profile=lite --sun --out=docs/qa/mobile-sun/after-pixel
node scripts/mobile-probes/verify-bright.mjs --baseline --phase=before --profile=lite --sun --sun-only --out=docs/qa/mobile-sun/before
node scripts/verify-canvas-presented.mjs
node scripts/verify-touch-aim.mjs
node docs/qa/mobile-sun/verify-pixel-presented.mjs
npm test
npm run build
```

## Decisions

1. Share the analysed sun colour/intensity/direction; use a fixed 3500 K fallback without loading an HDR on phones.
2. Fit light-space bounds to world footprint x=[−16,18], z=[−18,24], y=[0,12]. Retain nearby tree branches/trunks, fence rails/posts and lamp geometry in one shadow-only batch so yard optimization cannot remove them. Keep carpet, rack and bench casters.
3. Use PCF, shadow intensity 0.6, radius 1 on lite and 0.1 on minimal, bias −0.00002 and normal bias 0.008. Minimal uses less ground fill to retain contrast at 512².
4. Use cool sky fill, weak warm ground bounce, and a local warm diffuse reflection for the backlit carpet front. Preserve the wool shader's scan white balance/exposure cap; add a small Fresnel rim to fringe.
5. Compensate the cheap ground BRDF at grazing sunlight with a ground-only direct-light gain, rather than another sun. Put highlight warmth, cool shadows, contrast and a 3.5% vignette in uniforms of the existing present pass; keep wool excluded from the background tone curve.
