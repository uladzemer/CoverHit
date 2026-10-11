# Mobile startup and rendering

`src/boot/bootGuard.js` is main's first import. It records `window.__boot`, exposes
`__bootDiagnostics` and `__bootDiagnosticsText()`, and shows a standalone Russian
recovery panel on errors, rejected promises, context loss or a 25-second HUD
watchdog. Its DOM/inline styles survive renderer/UI failure. Context loss is
remembered in sessionStorage; the next boot uses minimal. `?lite=1` / `?minimal=1` / `?full=1`
override and save the device choice, while capability failures and prior context
loss take priority. Unavailable storage is harmless.

## Parallel HTML/UI integration

A first module import cannot catch failed module downloads, parse/link errors,
or a killed browser process. The parallel HTML agent's inline non-module head
guard must cover pre-module failures; it may read the same breadcrumbs and
diagnostics. No script can guarantee recovery inside an OS-terminated tab.

The CSS vignette uses `html[data-coverhit-profile="lite"]` / `"minimal"` or
`window.__coverhitLiteVignette`, with `pointer-events:none`. The UI toast hook is
window event `coverhit:quality`, detail `{profile, reason, label: 'Графика снижена',
vignette}`. The existing `coverhit-quality` event still serves desktop controls.

## Profiles and resources

Detection checks coarse pointers, mobile UA, screen size, deviceMemory and CPU
concurrency. WebGL2 probes allocate 4×4 RGBA16F and RGBA32F textures, attach each
to a framebuffer, check completeness, restore bindings and release objects.
Extension names alone are insufficient. Diagnostics include caps, DPR, viewport,
profile, failure reasons, asset counts and a texture memory estimate.

Full retains the desktop composer, N8AO, bloom, grading and CSM. Lite/minimal use
a depth-backed RGBA8 scene target and an opaque fullscreen grade with a wool
coverage mask, plus one PCF directional sun
shadow (1024/512, intensity 0.4). Both use the warm procedural sky, hemisphere,
ambient and a small unshadowed sun bounce, skipping
HDR/PMREM, static AO bake, VAT laundry download and licensed stock manifests.
Licensed stock manifests are also skipped on phones with the `?full=1` override.
The first phone carpet image preloads alongside yard assets, avoiding a second
download queue after yard loading on slow connections.
Scene DPR caps are 1/.75, refreshed on resize, orientation and visualViewport
changes. The presented canvas drawing buffer remains fixed after its first
frame: resizing an existing WebKit canvas loses presentation despite valid GL
pixels. Quality/viewport changes resize the scene target instead. The canvas
uses 100% CSS dimensions and the camera follows the current viewport. A live
full-to-lite downgrade retains the existing output buffer. See CORE.md for the
DPR bisect and screenshot regression criteria.
The explicit full override also retains its output/composer resolution on
phones after startup: WebKit loses presentation on full-profile rotation too.
Its camera still follows the current CSS rect. Desktop full keeps normal
composer resizing and quality DPR selection.
Full→lite→minimal fallback preserves the scene on creation/render exceptions or
30 consecutive GL-error frames; persistent minimal errors show the panel.
After 120 warm-up frames, a 120-frame average over 24ms (full) or 40ms (lite)
triggers one adaptive downgrade. Phone draws target 30fps; fixed 60Hz physics
substeps, flip controller and contact solver are retained. Grass/foliage, laundry,
dust and moth pools are reduced. Phone cloth interval counts are 75% of full,
rounded to even values on both axes. Portrait FOV grows toward 68°; camera tests
cover post width, feet, short/long rugs and projected aim rays with ≥6% margins.

`npm run assets:lite` uses sharp to build ≤1024px WebP q75 museum/CC derivatives,
excluding stock, local manifests and source references. `npm run build` runs it
after carpets. All derivatives total about 5.30 MB, below the 10 MB added-assets
cap. Normal first-load transfer must stay below 8 MB. Missing derivatives fall
back to full counterparts resized before upload; missing every derivative may
exceed the normal transfer budget. No extra HDR is committed.

Texture estimates count unique material/uniform/environment maps with four
bytes per RGBA8 texel plus mip overhead, and larger float element sizes. They
are estimates, not total driver/geometry/shadow/browser-process memory. JS heap
is null where the browser does not expose performance.memory.

## Verification

Run `npm run build`, then keep
`npm run preview -- --host 127.0.0.1 --port 5187` running in a separate terminal.
Run `npm run verify:mobile` against that preview, or provide `MOBILE_URL` for an
already running development/production server.

`npm run verify:mobile` tests WebKit iPhone 14 Pro/SE and Chromium Pixel 7 in both
orientations: auto/lite, hidden float/timer extensions, context loss at five
seconds and HDR/lite 404s. Pixel uses CDP 4× CPU and Fast 3G. It asserts rendered
composited canvas pixels with the HUD hidden (luminance/body/sky/green checks),
no uncaught errors and phone texture budget; only the deliberate context-loss
scenario may pass with a recovery panel;
prints TTI/transfer/heap/texture values, and writes report.json plus ignored PNGs.
All scenarios block optional licensed stock. Set `MOBILE_URL` for a preview
under `/CoverHit/`, or `MOBILE_SCENARIOS=auto,lite,...` for focused reruns.
`MOBILE_DEVICES=Pixel 7` and `MOBILE_OUT=docs/qa/mobile/recheck` can further scope
a run and preserve the main report. Photo upgrades settle before memory/transfer
measurements. Unexpected startup error panels fail verification.

`npm run verify:canvas-presented` adds explicit full/lite/minimal/auto phone
checks after 15 seconds, live/adaptive downgrades, rotation, touch controls and
a hidden-canvas negative control. See `../mobile-presented/README.md` for the
DPR-only bisect and pixel measurements.

Run `npm test` for physics/contact/flip regressions, framebuffer/profile/texture
budget checks, camera/raycast tests, watchdog panel and fallback/adaptive tests.
Physical iOS ≥16 and Android require owner-device validation: desktop emulation
cannot reproduce OS memory termination or identical mobile GPU drivers.
