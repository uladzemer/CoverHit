# Phone framing QA

The phone camera fits the actual crosswise cloth span plus 6%, with a separate fit for the fixed rack. Portrait uses 52 degrees and a 2.7 m eye. The nominal projected panel centre is 40%; measured render-mesh bounds include the rounded crown. Landscape retains the existing outer 20% HUD columns. Position, target and FOV blend exponentially (10/s, elapsed step capped at 100 ms). Canvas aspect always follows its CSS rect immediately. The yard, rack dimensions, input math and beater pose are unchanged.

## Measurements

Frozen real cloth, production camera updates, CSS compositor screenshots. iPhone 14 Pro is explicitly 393 x 852 (the Playwright preset has a shorter toolbar viewport); SE is 320 x 568, Pixel 7 is 412 x 839. Landscape swaps those dimensions. 09 is the first palas, 05 is the largest 2.5 x 3.5 m entry (actual crosswise span 2.765554 m); runner uses its real scan aspect. Width and height below measure the cloth mesh, not the rack. Distance is camera z, metres in front of the bar.

| Device | View | Rug | Cloth width | Cloth height | Centre from top | FOV | Distance |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| iPhone 14 Pro | Portrait | 09 | 53.3% | 13.5% | 39.6% | 52.0 deg | 8.27 m |
| iPhone 14 Pro | Portrait | 05 | 73.4% | 21.2% | 39.6% | 52.0 deg | 8.33 m |
| iPhone 14 Pro | Portrait | runner | 41.2% | 18.3% | 39.6% | 52.0 deg | 8.30 m |
| iPhone 14 Pro | Landscape | 09 | 53.8% | 60.4% | 38.2% | 26.0 deg | 3.69 m |
| iPhone 14 Pro | Landscape | 05 | 55.2% | 64.3% | 38.9% | 40.4 deg | 3.20 m |
| iPhone 14 Pro | Landscape | runner | 35.8% | 65.9% | 38.7% | 35.0 deg | 3.20 m |
| iPhone SE | Portrait | 09 | 53.4% | 16.4% | 39.5% | 52.0 deg | 6.78 m |
| iPhone SE | Portrait | 05 | 73.6% | 25.5% | 39.5% | 52.0 deg | 6.84 m |
| iPhone SE | Portrait | runner | 41.3% | 22.1% | 39.5% | 52.0 deg | 6.81 m |
| iPhone SE | Landscape | 09 | 53.6% | 50.5% | 38.5% | 26.0 deg | 4.51 m |
| iPhone SE | Landscape | 05 | 57.6% | 57.2% | 39.0% | 40.4 deg | 3.73 m |
| iPhone SE | Landscape | runner | 41.6% | 63.5% | 38.8% | 35.0 deg | 3.35 m |
| Pixel 7 | Portrait | 09 | 53.3% | 14.4% | 39.5% | 52.0 deg | 7.77 m |
| Pixel 7 | Portrait | 05 | 73.5% | 22.5% | 39.6% | 52.0 deg | 7.83 m |
| Pixel 7 | Portrait | runner | 41.2% | 19.4% | 39.6% | 52.0 deg | 7.81 m |
| Pixel 7 | Landscape | 09 | 53.7% | 57.1% | 38.3% | 26.0 deg | 3.93 m |
| Pixel 7 | Landscape | 05 | 57.7% | 63.4% | 38.9% | 40.4 deg | 3.26 m |
| Pixel 7 | Landscape | runner | 38.1% | 65.9% | 38.7% | 35.0 deg | 3.20 m |

First rug at 393 x 852: width 45.7% -> 53.3%, height 11.7% -> 13.5%, centre 49.6% -> 39.6%. Portrait rack centreline span is approximately 90% of width, with both complete post radii inside the horizontal edges. The first-rug rack bar-to-ground projection increases from 22.5% to 26.2% of frame height.

All 18 phone/rug cases pass horizontal post bounds, cloth bounds and zero rectangle overlap with visible HUD zones, including a conservative 8 cm fringe reserve. All replacement checks have zero immediate camera pose/FOV change. Six rotation/resize checks also have zero immediate pose/FOV change and aspect error < 1e-6. These are camera continuity checks; the viewport shape itself changes immediately. Landscape post feet can extend below the frame; the post-to-post span remains inside both horizontal edges.

## Desktop comparison

1440 x 900, full profile, same deterministic cloth and aim-independent camera. Camera and mesh projections are identical before/after. Mean absolute screenshot channel difference (<0.5/255 acceptance):

- 09: 0.1367/255.
- 05: 0.3098/255.
- runner: 0.1336/255.

## Touch aim

The existing 3 x 3 real touch grid runs after the production size transition settles. Its mesh is held still only during camera preparation; production raycast, reticle, head target and dispatched strikes retain their original checks.

| Engine | Viewport | Profile | Max hit px | Max reticle px | Max head target px |
| --- | --- | --- | ---: | ---: | ---: |
| chromium | 320 x 568 | lite | 0.0239 | 0.0000 | 0.0239 |
| chromium | 320 x 568 | minimal | 0.0239 | 0.0000 | 0.0239 |
| chromium | 393 x 852 | lite | 0.0240 | 0.0000 | 0.0240 |
| chromium | 393 x 852 | minimal | 0.0240 | 0.0000 | 0.0240 |
| chromium | 430 x 932 | lite | 0.0263 | 0.0000 | 0.0263 |
| chromium | 430 x 932 | minimal | 0.0263 | 0.0000 | 0.0263 |
| chromium | 844 x 390 | lite | 0.0946 | 0.0000 | 0.0946 |
| chromium | 844 x 390 | minimal | 0.0946 | 0.0000 | 0.0946 |
| webkit | 320 x 568 | lite | 1.1619 | 1.1536 | 1.1619 |
| webkit | 320 x 568 | minimal | 1.1619 | 1.1536 | 1.1619 |
| webkit | 393 x 852 | lite | 0.8368 | 0.8317 | 0.8368 |
| webkit | 393 x 852 | minimal | 0.8368 | 0.8317 | 0.8368 |
| webkit | 430 x 932 | lite | 1.3580 | 1.3508 | 1.3580 |
| webkit | 430 x 932 | minimal | 1.3580 | 1.3508 | 1.3580 |
| webkit | 844 x 390 | lite | 1.2015 | 1.1927 | 1.2015 |
| webkit | 844 x 390 | minimal | 1.2015 | 1.1927 | 1.2015 |

## Validation

- `npm test -- --maxWorkers=2`: 399 tests / 53 files pass. Default concurrency hit CPU-contention timeouts during simultaneous browser captures; the bounded-worker rerun passed.
- `npm run build`: pass.
- `node scripts/verify-touch-aim.mjs`: 16 grids / 144 points pass; raised-aim persistence checks pass.
- `node scripts/verify-canvas-presented.mjs`: all eight WebKit device/profile cases pass on the production preview, including full/lite/minimal, automatic downgrade, rotation, live transitions, blank-canvas rejection and touch buttons. Green leakage is 0% in all captures.

Screenshots are local ignored PNGs under this directory, including `presented/` and `aim/`. Numeric evidence: [phone projections](after.json), [desktop diff](after-desktop.json), [canvas presentation](presented/report.json), [touch aim](aim/report.json). Reproduce with `FRAME_URL` / `AIM_URL` for a fresh Vite process and `MOBILE_URL` for the built preview; set `AIM_OUT=docs/qa/mobile-frame/aim` and `PRESENTED_OUT=docs/qa/mobile-frame/presented`. Run `verify-frame.mjs --before --desktop` against the original camera before editing, then `verify-frame.mjs --desktop` and `verify-frame.mjs` against the changed camera. Vite ignores this worktree parent, so camera edits require a fresh server process.

## Decisions and unmet numeric targets

1. Retain the physical rack, natural perspective, exact aim and horizontal post visibility. A 3.4 m rack cannot fit at 393 x 852 with a 40-52 degree vertical lens and 3.2-4.2 m distance: even 52 degrees / 4.2 m exposes only about 1.9 m horizontally. Portrait therefore uses 6.78-8.33 m.
2. Treat rack width and cloth width separately. At 90% rack coverage, first-rug and runner spans inherently cover only about 53% and 41%; the largest cloth covers about 73%. Achieving 80-90% cloth coverage for every rug requires cropping/moving the fixed posts or changing geometry/projection. Those width targets remain unmet.
3. Preserve the existing HUD safe zones over the landscape 65-75% height target. The measured range is 50.5-65.9% across these rugs/devices; the largest SE carpet needs extra distance for clearance.
4. Keep the desktop camera formula and the existing input/beater implementation. Increase phone rack presence through framing only, use actual cloth width plus 6%, and ease position/target/lens after rug or viewport changes.
