# Touch UI verification

Run Vite, then `node scripts/verify-touch-ui.mjs` (optional `UI_URL`). Requires Playwright Chromium/Chrome and WebKit. `results.json` records the assertions; all PNGs in this directory are ignored.

Results (2026-10-11): 240 menu/playing captures across both engines and six sizes, zero UI overflow/safe-zone/page-error failures. All six Chromium holds increased score from 0 to 12 and visible-side cleanliness from 0 to approximately 9.4–10.7%; flip, audio resume, pinch scale 1 and rotation preservation passed. WebKit Start/flip, layout and rotation checks passed. `npm test`: 51 suites passed, 344 tests passed, 12 existing skips. `npm run build` passed, with the existing bundle-size warning. `MOBILE_ENGINES=webkit` can rerun one engine while retaining the other engine's results.

The harness uses touch-enabled Android Chrome and iPhone 14 Pro WebKit contexts at DPR 3: 320×740, 360×740, 390×844, 430×932, 844×390 and 740×360. Every setup/credit page and the playing HUD is captured in both engines, with Google Fonts blocked to exercise local fallback fonts. It checks visible rectangles and horizontal overflow, the central 60% × 50% carpet zone, touch Start/flip buttons, audio-context resume, pinch scale and preservation of the session when rotating. Chromium CDP performs a real 500 ms held touch, advances the same interval on the controlled game clock, then releases and verifies score and visible-side cleanliness increase. The game clock stays paused during screenshots; explicit frame advances avoid round expiry and continuous SwiftShader rendering during captures.

The unit tests cover CSS-pixel aim offset, clamping, pen/mouse behavior, hybrid modality changes, secondary-pointer rejection, dragging, cancellation and leaving the captured canvas. The HUD layout test includes portrait phones and short landscape screens, with simulated 44 px notch and 21 px home-indicator insets. Existing contrast and desktop tests remain part of `npm test`.

Decisions:

- Default touch aim is 48 CSS px above the finger; `Beater` accepts `touchAimOffset` for tuning. Reticle and strike use the same ray. Touch beater motion follows that aim with smoothing.
- One carpet pointer owns the charge. Independent button touches retain their normal actions. Strong charge provides one guarded vibration tick.
- Narrow/short menus split instructions, rules and settings into short pages, and show a page counter instead of wrapping dots. Credits use two cards per phone page; desktop retains four.
- Phone controls are at least 48 px. Flip and pause occupy bottom corners; sound and reticle stay at the top/right edge. Landscape status controls fit into side bands. Safe-area insets and the visual viewport variable handle notches, rotation and toolbar changes.
- F/R/M/Esc continue to work; hints follow pointer modality on hybrid devices. No changes were necessary in `src/main.js`: its existing `onFlip` callback and capture-phase `pointerdown → Sfx.unlock()` path work for touch. No boot, scene, camera or asset code was edited.

These are browser-emulation checks, not physical iPhone/Android performance measurements. Boot/lite-rendering changes belong to the parallel stream.

Integration limitations: this Windows Playwright WebKit build exposes neither AudioContext nor webkitAudioContext. The audio-resume assertion therefore runs only when that API exists; Chromium exercises the actual resume path. A standalone WebKit probe confirmed pointerdown, touchstart, touchend and click arrive from a trusted touchscreen tap.

WebKit's captured 3D background remains a flat clear color while the HUD works. This also occurs with the normal continuous render loop and with a direct `renderer.render(scene, camera)` diagnostic, rather than only with paused QA frames. `webkit-continuous-playing.png`, `webkit-direct-render-probe.png` and `webkit-render-probe.json` retain evidence for the parallel renderer owner: WebGL 2.0, zero failed shader programs/console errors, 92 draw calls and 349,736 triangles in the diagnostic frame. Root cause is unconfirmed; the UI checks do not establish full 3D playability in WebKit or on physical iPhones. No rendering/boot/camera files were changed by this stream.
