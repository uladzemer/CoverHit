# Portrait camera: carpet closer

Follow-up to [the frontal-camera report](FRONTAL-REPORT.md). Before means the owner's reviewed frontal camera, not the earlier overhead camera. All 18 phone captures were rerun locally: WebKit iPhone 14 Pro (393×852), WebKit SE (320×568), Chrome/SwiftShader Pixel 7 (393×727), both orientations, lite profile, seed frame-qa. Physics is held fixed while the production camera settles. Screenshots use CSS pixels.

Portrait carpet width is **97.2–99.9%**, centre **41.6–42.0%**, eye **1.80 m**, downward pitch **0.62–4.64°**. The largest carpet keeps 100% of its width visible and its entire fringe in frame. All phone captures clear the HUD, including the runner on SE. Landscape camera parameters and measurements are unchanged.

**The ≤35% bottom-ground requirement is not met for all carpets.** The conservative band below the projected cloth plus fringe is 28.5–43.4%. All three runner captures meet 35%; the six wider-rug captures do not. This is not a pixel segmentation: the fence and other objects occupy part of this band. The existing distant-building ground proxy remains 59.7–68.1%, including ground hidden by cloth and scenery. Neither metric is presented as a successful asphalt-area measurement.

With an upright frontal perspective, cloth screen height is approximately width × viewport aspect × drop/span. On iPhone 14 Pro, carpet 09 at 100% width occupies about 26% height; at a centre of 42%, its bottom is near 55%, leaving about 45% below it. A bottom at 65% would require about 46% height at that centre, hence roughly 175% width. That exceeds the allowed crop. Narrowing the lens while moving back preserves this ratio. The allowed eye height and shallow pitch cannot supply that missing height. Achieving all targets requires relaxing the centre/width limits or changing the scene/layout; those changes were outside this follow-up's allowed scope.

## Before → after measurements

Projected real cloth bounds include thickness. Fringe clearance uses the same 0.08 m reserve as the prior probe. Values are percentages unless labelled metres/degrees.

| Device / orientation / carpet | Width | Height | Centre | Distance m | Eye m | Pitch ° | Bottom band |
|---|---:|---:|---:|---:|---:|---:|---:|
| iPhone 14 Pro / portrait / 09 | 83.2 → 99.4 | 21.9 → 26.3 | 39.7 → 41.6 | 5.55 → 4.65 | 1.95 → 1.80 | 2.06 → 0.62 | 47.8 → 43.4 |
| iPhone 14 Pro / portrait / 05 | 83.3 → 99.7 | 24.8 → 29.7 | 39.7 → 41.7 | 7.64 → 6.40 | 1.95 → 1.80 | 3.93 → 3.35 | 46.7 → 42.1 |
| iPhone 14 Pro / portrait / runner | 84.8 → 97.2 | 38.2 → 44.0 | 39.7 → 42.0 | 4.29 → 3.75 | 1.95 → 1.80 | 5.32 → 3.81 | 39.2 → 33.7 |
| iPhone 14 Pro / landscape / 09 | 52.0 → 52.0 | 64.4 → 64.4 | 45.1 → 45.1 | 3.80 → 3.80 | 1.85 → 1.85 | 1.51 → 1.51 | 18.1 → 18.1 |
| iPhone 14 Pro / landscape / 05 | 46.3 → 46.3 | 63.5 → 63.5 | 45.4 → 45.4 | 3.80 → 3.80 | 1.81 → 1.81 | 5.80 → 5.80 | 19.9 → 19.9 |
| iPhone 14 Pro / landscape / runner | 30.3 → 30.3 | 64.2 → 64.2 | 45.6 → 45.6 | 3.80 → 3.80 | 1.85 → 1.85 | 4.51 → 4.51 | 19.0 → 19.0 |
| iPhone SE / portrait / 09 | 83.3 → 99.4 | 26.8 → 32.1 | 39.7 → 41.6 | 4.55 → 3.81 | 1.95 → 1.80 | 2.52 → 0.75 | 45.1 → 40.1 |
| iPhone SE / portrait / 05 | 83.5 → 99.9 | 30.2 → 36.2 | 39.7 → 41.6 | 6.26 → 5.25 | 1.95 → 1.80 | 4.79 → 4.09 | 43.8 → 38.6 |
| iPhone SE / portrait / runner | 83.2 → 97.6 | 45.5 → 53.6 | 39.7 → 41.9 | 3.60 → 3.08 | 1.92 → 1.80 | 5.80 → 4.64 | 35.2 → 28.5 |
| iPhone SE / landscape / 09 | 57.7 → 57.7 | 58.5 → 58.5 | 45.2 → 45.2 | 3.80 → 3.80 | 1.85 → 1.85 | 1.51 → 1.51 | 21.4 → 21.4 |
| iPhone SE / landscape / 05 | 56.6 → 56.6 | 63.5 → 63.5 | 45.4 → 45.4 | 3.80 → 3.80 | 1.81 → 1.81 | 5.80 → 5.80 | 19.9 → 19.9 |
| iPhone SE / landscape / runner | 37.0 → 37.0 | 64.2 → 64.2 | 45.6 → 45.6 | 3.80 → 3.80 | 1.85 → 1.85 | 4.51 → 4.51 | 19.0 → 19.0 |
| Pixel 7 / portrait / 09 | 83.3 → 99.4 | 23.3 → 28.0 | 39.7 → 41.6 | 5.22 → 4.37 | 1.95 → 1.80 | 2.20 → 0.66 | 47.0 → 42.4 |
| Pixel 7 / portrait / 05 | 83.4 → 99.8 | 26.4 → 31.6 | 39.7 → 41.7 | 7.18 → 6.01 | 1.95 → 1.80 | 4.18 → 3.57 | 45.9 → 41.1 |
| Pixel 7 / portrait / runner | 84.9 → 97.3 | 40.6 → 46.8 | 39.7 → 42.0 | 4.03 → 3.52 | 1.95 → 1.80 | 5.66 → 4.06 | 37.8 → 32.2 |
| Pixel 7 / landscape / 09 | 55.4 → 55.4 | 64.4 → 64.4 | 45.1 → 45.1 | 3.80 → 3.80 | 1.85 → 1.85 | 1.51 → 1.51 | 18.1 → 18.1 |
| Pixel 7 / landscape / 05 | 49.3 → 49.3 | 63.5 → 63.5 | 45.4 → 45.4 | 3.80 → 3.80 | 1.81 → 1.81 | 5.80 → 5.80 | 19.9 → 19.9 |
| Pixel 7 / landscape / runner | 32.2 → 32.2 | 64.2 → 64.2 | 45.6 → 45.6 | 3.80 → 3.80 | 1.85 → 1.85 | 4.51 → 4.51 | 19.0 → 19.0 |

## Same backdrop measurements

Same geometry proxies as before: distant block roof at 13.5 m and base 62 m behind the rack; slab centreline z −3 to 2 m. Sky/buildings/ground are bands, not visible pixel areas. Buildings, trees and sky remain visible above the portrait carpet in the captures.

| Device / orientation / carpet | Sky | Buildings | Ground | Horizon after | Pad after |
|---|---:|---:|---:|---:|---:|
| iPhone 14 Pro / portrait / 09 | 14.8 → 18.5 | 21.6 → 21.8 | 63.6 → 59.7 | 37.4 | 37.6 |
| iPhone 14 Pro / portrait / 05 | 12.6 → 14.7 | 21.1 → 21.4 | 66.4 → 63.8 | 33.3 | 22.5 |
| iPhone 14 Pro / portrait / runner | 7.4 → 11.8 | 22.3 → 22.3 | 70.2 → 65.9 | 31.2 | 40.8 |
| iPhone 14 Pro / landscape / 09 | 0.0 → 0.0 | 38.0 → 38.0 | 62.0 → 62.0 | 32.0 | 10.3 |
| iPhone 14 Pro / landscape / 05 | 2.4 → 2.4 | 28.8 → 28.8 | 68.7 → 68.7 | 27.5 | 36.9 |
| iPhone 14 Pro / landscape / runner | 0.0 → 0.0 | 32.2 → 32.2 | 67.8 → 67.8 | 27.7 | 30.0 |
| iPhone SE / portrait / 09 | 13.0 → 17.3 | 21.9 → 22.0 | 65.0 → 60.7 | 36.4 | 35.5 |
| iPhone SE / portrait / 05 | 10.1 → 12.5 | 21.6 → 21.9 | 68.3 → 65.6 | 31.5 | 34.1 |
| iPhone SE / portrait / runner | 5.7 → 9.2 | 22.6 → 22.7 | 71.7 → 68.1 | 28.9 | 40.1 |
| iPhone SE / landscape / 09 | 0.0 → 0.0 | 38.8 → 38.8 | 61.2 → 61.2 | 33.3 | 14.4 |
| iPhone SE / landscape / 05 | 2.4 → 2.4 | 28.8 → 28.8 | 68.7 → 68.7 | 27.5 | 36.9 |
| iPhone SE / landscape / runner | 0.0 → 0.0 | 32.2 → 32.2 | 67.8 → 67.8 | 27.7 | 30.0 |
| Pixel 7 / portrait / 09 | 14.3 → 18.2 | 21.7 → 21.9 | 64.0 → 60.0 | 37.1 | 36.9 |
| Pixel 7 / portrait / 05 | 11.8 → 14.1 | 21.3 → 21.6 | 66.9 → 64.4 | 32.8 | 25.6 |
| Pixel 7 / portrait / runner | 6.5 → 11.0 | 22.5 → 22.4 | 71.0 → 66.5 | 30.5 | 40.5 |
| Pixel 7 / landscape / 09 | 0.0 → 0.0 | 38.0 → 38.0 | 62.0 → 62.0 | 32.0 | 10.3 |
| Pixel 7 / landscape / 05 | 2.4 → 2.4 | 28.8 → 28.8 | 68.7 → 68.7 | 27.5 | 36.9 |
| Pixel 7 / landscape / runner | 0.0 → 0.0 | 32.2 → 32.2 | 67.8 → 67.8 | 27.7 | 30.0 |

## Screenshots

| Device / orientation | 09 before / after | Largest 05 before / after | Runner before / after |
|---|---|---|---|
| iPhone 14 Pro / portrait | [before](closer-before-iPhone-14-Pro-portrait-09.png) / [after](after-iPhone-14-Pro-portrait-09.png) | [before](closer-before-iPhone-14-Pro-portrait-05.png) / [after](after-iPhone-14-Pro-portrait-05.png) | [before](closer-before-iPhone-14-Pro-portrait-runner.png) / [after](after-iPhone-14-Pro-portrait-runner.png) |
| iPhone 14 Pro / landscape | [before](closer-before-iPhone-14-Pro-landscape-09.png) / [after](after-iPhone-14-Pro-landscape-09.png) | [before](closer-before-iPhone-14-Pro-landscape-05.png) / [after](after-iPhone-14-Pro-landscape-05.png) | [before](closer-before-iPhone-14-Pro-landscape-runner.png) / [after](after-iPhone-14-Pro-landscape-runner.png) |
| iPhone SE / portrait | [before](closer-before-iPhone-SE-portrait-09.png) / [after](after-iPhone-SE-portrait-09.png) | [before](closer-before-iPhone-SE-portrait-05.png) / [after](after-iPhone-SE-portrait-05.png) | [before](closer-before-iPhone-SE-portrait-runner.png) / [after](after-iPhone-SE-portrait-runner.png) |
| iPhone SE / landscape | [before](closer-before-iPhone-SE-landscape-09.png) / [after](after-iPhone-SE-landscape-09.png) | [before](closer-before-iPhone-SE-landscape-05.png) / [after](after-iPhone-SE-landscape-05.png) | [before](closer-before-iPhone-SE-landscape-runner.png) / [after](after-iPhone-SE-landscape-runner.png) |
| Pixel 7 / portrait | [before](closer-before-Pixel-7-portrait-09.png) / [after](after-Pixel-7-portrait-09.png) | [before](closer-before-Pixel-7-portrait-05.png) / [after](after-Pixel-7-portrait-05.png) | [before](closer-before-Pixel-7-portrait-runner.png) / [after](after-Pixel-7-portrait-runner.png) |
| Pixel 7 / landscape | [before](closer-before-Pixel-7-landscape-09.png) / [after](after-Pixel-7-landscape-09.png) | [before](closer-before-Pixel-7-landscape-05.png) / [after](after-Pixel-7-landscape-05.png) | [before](closer-before-Pixel-7-landscape-runner.png) / [after](after-Pixel-7-landscape-runner.png) |

## Verification

- Phone geometry: 18 cases completed; width, centre, eye, pitch, full fringe, HUD clearance, immediate replacement pose, rotation continuity and canvas aspect checks pass. Bottom-ground compliance is recorded separately as groundTargetMet in after.json; it fails 6 of 9 portrait cases.
- Touch aim: 16 engine/viewport/profile cases, reduced motion disables hit-stop; maximum hit/reticle/target error 1.246 CSS px (limit 4 px).
- Desktop: 3 cases; maximum screenshot mean channel difference 0.317/255.
- Final npm test -- --pool=threads --maxWorkers=1 --no-file-parallelism: 458 tests in 58 files pass.
- Final npm run build: pass; existing chunk-size advisory.
- git diff --check: pass. No commit or stash. Pre-existing package-lock.json and src/main.js changes were left untouched.

Evidence: [before](closer-before.json), [after](after.json), [desktop](after-desktop.json), [aim](touch-aim/report.json). The previous report and screenshots are preserved separately.

## Decisions

1. Move the portrait camera physically closer with a 50° lens: nominal width 98% for wide rugs, 94% for tall runners to clear the SE HUD; real rendered widths meet 94–100%.
2. Use the minimum permitted 1.8 m portrait eye and the existing lens shift to place measured centres within 36–42%, retaining the shared rendering/touch projection and camera blend.
3. Preserve landscape and desktop camera math. Permit posts to leave portrait captures; retain the entire cloth and fringe.
4. Report the unmet ground target explicitly; do not stretch the cloth, alter yard geometry, or disguise a geometry band as pixel segmentation.
5. Use reduced motion during the touch probe, and finish the asset build before the final browser probes to avoid development-server reloads interrupting them.
