# Centered fold QA

Run Vite, then `node scripts/verify-fold.mjs`. The script uses locally installed Playwright and Chrome with real Ammo WASM and checks all ten shipped museum scans. Captured at 1280 x 900. Wind is zero for reproducible equal-length measurements; ordinary play keeps its breeze. No page errors occurred.

## Evidence

- [Front at rest](front-rest.png): side 1, exact scan UVs, middle over the bar.
- [Mid-flip](mid-flip.png): trailing half lifted over the crown, dust, disabled input.
- [After flip](after-flip.png): side 2 in front, same gameplay camera.
- [Side view](side-view.png): exact camera (4, 1.6, 0), looking at (0, 3.15, 0). Both yard posts are hidden only for this diagnostic capture, since they align with and obscure the cloth. Bar and cloth remain visible.
- [Original side view](side-view-occluded.png): unchanged yard with the obstructing post.
- [Oblique side view](side-oblique.png): camera (4, 1.6, 1.2), complete yard restored.
- [Browser data](browser.json): dimensions, equal-edge measurements, input timestamps, impact intervals, flip state, ignored hit result, visible-half moth checks, and two-half completion.

Front/back bottom heights differ by 0.68% of the half-drop, below the requested 2%. Rug 09 uses a u=0.5 fold: original physical size 2.075814 x 2.400000 m; bar span 2.40 m; half length 1.037907 m. Every scan retains exact physical width/height aspect, with finite Ammo node coordinates. All ten moth spawn checks fall on the visible half.

## Real combo reproduction

Twelve trusted mouse strikes, each held 400 ms and followed by a 250 ms gap, produced multipliers [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]. It reaches x3 at strike 9. Actual game-time inter-impact intervals, seconds: [0.5629, 0.6873, 0.6563, 0.6873, 0.6565, 0.6560, 0.6876, 0.6873, 0.6877, 0.6562, 0.6873]. Wall-clock intervals, seconds: [0.5549, 0.6894, 0.6515, 0.6872, 0.6570, 0.6553, 0.6890, 0.6862, 0.6879, 0.6573, 0.6856]. Browser event delivery and frame boundaries account for the small variance from nominal 0.650 s. All measured intervals stay within the unchanged 0.35-1.1 s rhythm window.

The raycast now filters to the visible half. When the back panel swings closer to the camera, it cannot consume a front-panel strike or silently lose scoring. The regression test uses two overlapping panels, with the hidden one nearest the camera. `window.__coverhit.strikeLog` exposes impact game/wall times, both interval measurements, UVs, misses, and multipliers.

## Decisions and fold rule

1. Keep each scan's original physical dimensions and full UV extent. Prefer half-drops in 1.0-1.6 m, then the larger span along the bar; otherwise choose the smallest error outside that range. Thus landscape rugs normally use v=0.5, and broad portrait 09 uses u=0.5.
2. Fit the yard bar to max(3.2 m, largest selected span + 0.6 m): 0.3 m clearance at each end. Use an even interval count along the fold and spaced middle-line anchors; both hanging halves remain free.
3. Use a 1.2 s kinematic pull of the trailing half over the crown, followed by normal soft-body simulation. Reverse face winding with the visible side so the scanned face points outward. Dust starts at the fold; the low thump accompanies the landing. The gameplay camera stays in place.
4. Automatically flip each half once on its first clean threshold, preserving voluntary flips back to an already-clean half. F and the HUD button can flip either way. Ignore cleaning/scoring during the pull. Both halves must reach 90% to finish.
5. Retune whole-carpet difficulty: first museum seeded simulation is 22 hits (11 + 11); thirty seeds average 27.83 total (13.92 per half). The easy first stock scan's seeded simulation is 23 (11 + 12). Later museum seeded totals are 35, 41, 45, 60, 72, 72, 72. Timers include both halves and the flip with a 1.6x margin; retain the previous timers as a minimum, raising the cap to 119 s.
6. Keep the original occluded side screenshot and explicitly label the diagnostic post removal. QA assets contain shipped museum pixels only.

Validation: `npm test` passes 76 tests; `npm run build` passes. Browser checks ignore dirt/score during a flip, allow flipping back via the HUD button, and verify that cleaning one half remains playing while cleaning the second ends the carpet. Random placement has normal seed variance; the 22-30 requirement is the tuned target and retained seeded regression, not a guarantee for arbitrarily repeated locations.
