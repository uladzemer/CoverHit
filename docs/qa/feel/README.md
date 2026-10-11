# Visible dirt and strike feel

The carpet's per-side R32F dirt map now controls a warm matte grey-beige film.
A smoothstep fades its desaturation/darkening to an exact identity at zero dirt;
a deterministic 32 x 32 single-channel repeating texture supplies fine UV speckle.
This costs one additional texture lookup, no additional carpet passes or draws.
It does not change cloth physics, albedo scans, or pile/specular properties.

At 70% cleanliness of the displayed half, the exact remaining dirt peaks select
three mote zones and one softly pulsing darker zone. Peak selection is cached by
texture upload version and visible side. Per-side cleanliness totals are also cached
between mask edits; direct debug/QA edits invalidate them with `texture.needsUpdate`. Reduced motion uses a static hint and no motes.

`src/game/feel.js` owns the 62?82% ideal charge window, +25% excellent score,
40?60 ms strength-scaled stop at 8% visual speed, 120 ms additive impact ring,
shake gain/cap/decay and sound strength mapping. Hit-stop wraps beater animation
and dust clocks; the camera's effect clock slows too. Game time and every Bullet
fixed solve keep real elapsed time, including catch-up frames. The ring uses a
single reused procedural sprite (one draw while visible). Existing HUD `popScore`
and `bump` provide quality labels and combo/score feedback. Reduced motion skips
these new motion effects, ring and shake; scoring is unchanged.

## Evidence

`node scripts/verify-carpet-colour.mjs --dirty` checks two museum rugs in full
(1000 x 800), lite and minimal (390 x 844). It compares the same frozen cloth and
camera at dirt=0 and dirt=1, using an eroded carpet silhouette and mean Rec.709
sRGB luminance / mean HSV saturation. Before captures substitute only the
previous dirt shader, leaving the rest of the current scene identical.
`metrics.json` records zero browser errors, menu side initialization, next-carpet
side/percent reset, the 89.9% below-threshold label, actual visual-clock slowdown,
continued Game/Bullet time, impact expiry and reduced-motion bypass.

| Profile | Rug | Luminance drop (minimum 18%) | Saturation drop (minimum 30%) |
| --- | --- | --- | --- |
| full | 01 | 36.2% | 76.3% |
| full | 03 | 32.3% | 69.8% |
| lite | 01 | 88.0% | 73.5% |
| lite | 03 | 85.4% | 74.0% |
| minimal | 01 | 88.6% | 52.3% |
| minimal | 03 | 85.2% | 42.4% |

The phone lighting/presentation baseline is still the concurrently owned lighting
stream: its clean absolute luminance is low (about .034?.060 here). These tests
establish the dirt-versus-clean contrast on that baseline, not phone scan-colour
fidelity. Rerun this probe after that stream is integrated.

`colour/after.json` is the existing clean scan-colour probe. It passes for rugs
01, 03 and 09: hue shifts .21?.52 degrees, saturation ratios .992?1.001, no clipped
carpet pixels, and all existing bloom/shadow/exposure assertions. The probe pins
its requested profile so adaptive fallback cannot invalidate a frozen comparison.

All captures are covered by the existing `docs/qa/**/*.png` ignore rule and stay
local because the scene can contain personal licensed stock. No external assets
were added. Sample full-profile pairs:

| Rug | Before dirty | After dirty | Half-clean | Clean |
| --- | --- | --- | --- | --- |
| 01 | [before](full-01-before-dirty.png) | [dirty](full-01-after-dirty.png) | [half](full-01-after-half-clean.png) | [clean](full-01-after-clean.png) |
| 03 | [before](full-03-before-dirty.png) | [dirty](full-03-after-dirty.png) | [half](full-03-after-half-clean.png) | [clean](full-03-after-clean.png) |

`npm test`: 54 files passed; 362 tests passed, 12 skipped (optional local-stock
coverage varies with assets available during the build). The Pages build passes
with `COVERHIT_BASE=/CoverHit/`. Build-generated metadata was restored to its
original contents after verification to avoid unrelated asset inventory changes.

## Performance acceptance gap

`node scripts/verify-feel-performance.mjs --uncapped` measures 240 real High
frames per case after five seconds of warmup on RTX 2080 Ti / ANGLE D3D11.
Maximum draws are 146 idle / 147 with strikes, within the 150-draw limit.
The CPU <=6 ms requirement **does not pass**: mean entire-frame CPU is
6.84 ms idle / 9.30 ms with strikes. Its physics/Game/input bucket is 3.21 / 5.18 ms,
and render submission is 2.65 / 3.03 ms. No frames/outliers are removed.
`performance.json` retains the failure; the script exits nonzero on this budget.

`--uncapped --baseline` loads the original five feel-related modules using
read-only `git show HEAD:path` into an in-memory Vite transform, keeping all
other source/assets identical. That baseline also fails at 8.47 / 9.46 ms CPU
(`performance-baseline.json`). Caching repeated dirt summaries improves idle
CPU; it does not solve the broader existing CPU excess. The earlier uncached ordinary capped
Chrome sample is retained in `performance-capped.json` (12.51 / 13.84 ms), where
slower frame cadence requires more fixed physics catch-up per render. The stream
adds no carpet draws and at most one temporary ring draw. Physics and the
concurrently owned render pipeline remain untouched; CPU acceptance remains open.

## Decisions and architect handoff

- Excellent is inclusive at charge .62 and .82. Overcharge is good, not excellent.
  Strength converts to charge through `(strength - .25) / .75`.
- Game derives quality and emits `hit: { strength, dust, uv, quality, points }`;
  HUD quality uses the same helper. The +25% bonus applies before score rounding.
- The reticle owner can import `feel.idealWindow` or read
  `window.__coverhit.feel.idealWindow` to add arc ticks. The reticle was untouched.
- Existing menu/next-rug/percentage fixes were verified and retained.
- `main.js` has delimited visual-clock/camera/impact hooks, quality popup wiring,
  hint uniform wiring and disposal. Protected lighting/input/HUD CSS files were
  untouched. One extra one-line fix removes an embedded BOM before the `three`
  import in `src/carpet/assets.js`, which blocked Vite browser startup.
- Vite's watcher ignores `.claude` paths, including this worktree. Restart the
  dev server after edits before rerunning browser QA; otherwise it serves stale
  transformed modules.
