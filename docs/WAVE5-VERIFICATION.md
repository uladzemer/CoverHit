# Core wave 5 resume verification

Completed the interrupted work without recreating the existing scene, dust or models. Used only git status/diff; did not create commits, stashes, image or audio files.

## Changes in this resume

- Finished the HUD type label and menu carousel, including cached 3D previews, locked silhouettes, remaining unlock count and persisted selection integration.
- Repaired Russian type names, temporary beater labels and unlock toast.
- Added one session difficulty curve and 90% completion; late dirt gains contrast and rising motes after 85% cleanliness.
- Made carpet framing adapt to type dimensions; adjusted full wind-up to leave part of the head visible above-right.
- Added arbitrary texture support under the dirt shader, preserving externally owned textures on disposal.
- Fixed the old beater geometry test to consume the model contract and assert flat face alignment and head placement at impact. Added progression persistence tests.
- Reduced fixed physics stepping to 60 Hz (two catch-up steps maximum) and sun shadows to 1024 square to preserve render budget.

## Tuning and decisions

Difficulty depends on carpets in the current session, while unlocks depend on lifetime completions. Dirt multiplier interpolates from 0.40 on carpet one to 1.25 on carpet six; timers interpolate from 90 to 85 seconds and both cap there. Type dirt factors remain 0.95 / 1.05 / 1.00. Completion is 90%.

Cleaning retains the existing smooth Gaussian removal and natural diminishing returns, with no additional repeat-hit penalty. Radius is 0.068 + 0.010 * sqrt(strength), scaled by beater headRadius, with a 2.8-radius influence cutoff. Default-head full-charge six-by-six spread sweeps reach completion in 33–34 hits on carpet one and 84–93 on carpet six across all three types. Quick taps deliberately clean less.

Camera FOV is 48 degrees and distance adapts to width and height (minimum 4.4 m); wool occupies about half the frame height. No bloom was added. Existing procedural sky, fog, yard scenery, backlight and dust are retained. The thin flat-weave pattern is already implemented; no new pattern work was needed.

## Verification

- npm test: 43 tests passed, nine files.
- npm run build: passed; existing three vendor chunk size warning remains.
- Chrome headless, 1280 by 800: no page or console errors; menu score/cleanliness are zero and debug menu hits return zero.
- Real pointer hold/release: visible partly clipped wind-up, one scored impact on the cursor target, flat head contact and recovery.
- 30 spread full-strength hits: 86.86% cleanliness, active round, remaining dirt cues visible. Captured menu, wind-up, impact and 30-hit screenshots in memory only.
- Repeated hits on palas, wool and runner: finite cloth nodes; top anchor displacement approximately 1.2–1.4 cm. No inverted corner observed in inspected frames.
- Frame work at final settings: median 6.3 ms, p95 7.7 ms, 79 draw calls. Browser frame median 30.8 ms; a blank page measured 31.3 ms, so this environment does not validate a 60 fps presentation rate. GPU was NVIDIA RTX 2080 Ti via ANGLE/D3D11.

## Remaining integration

The single-entry temporary beater adapter awaits replacement by the parallel agent's six models; its labels are repaired here. Audio files were untouched; main supplies the optional sound preset argument, while the current audio implementation still awaits the parallel sound preset work. Hardware/browser verification at a 60 Hz presentation rate remains outstanding.

## Files changed in this resume

- src/main.js
- src/carpet/carpetMesh.js, src/carpet/types.js
- src/game/difficulty.js, src/game/state.js
- src/fx/dirtyHints.js
- src/input/beater.js, src/input/beaters/index.js (temporary adapter labels only)
- src/scene/yard.js
- src/ui/hud.js, src/ui/hud.css
- tests/beater.test.js, tests/dirt.test.js, tests/game.test.js, tests/difficulty.test.js, tests/progression.test.js
- docs/ARCHITECTURE.md, docs/CORE.md, docs/WAVE5-VERIFICATION.md
