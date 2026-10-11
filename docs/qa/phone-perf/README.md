# Phone physics and CPU QA

Run `node scripts/verify-phone-perf.mjs --baseline --phase=before`, then
`node scripts/verify-phone-perf.mjs`. Each command starts and closes its own
Vite server and Chromium. `CHROME_PATH` overrides the Chrome executable.
Run serially, without tests or a build competing for the CPU.

Each fresh page uses a 393 × 852 iPhone 14 Pro or 412 × 915 Pixel 7 viewport,
touch/mobile emulation, DPR 1 and `?lite=1`. Warmup includes four idle seconds,
one strike, a scheduled moth and two flips to exercise lazy shader/contact
allocations before the heap check. Both baseline and optimized runs use this
warmup. CDP then applies 1×, 4× or 6× CPU throttling. The 60-second scenario contains 20
seconds of idle with wind, twelve calls to the real `window.__coverhit.hit`,
two game-clock flips at 32 and 40 seconds, and settling. The report stores
whole-run and idle/hit/flip/settling phase statistics. Measurements wrap the
actual Ammo step, post-solve projections, geometry refresh, polar flip contact,
game, hit, dust and moth methods. CPU frame time and wall frame interval are
separate. Inclusive timings overlap; post-solve includes flip contact and
nested clearance. Do not sum those columns.

The heap check collects garbage with CDP before and after 60 seconds and
requires less than 1,000,000 bytes retained JS-heap growth. A fixed typed sample buffer
is allocated before the first collection, so collecting QA samples does not
grow the measured heap. This checks retained growth, not zero temporary
allocation or total WASM/GPU memory. The report retains source SHA-256 values,
Chrome/CPU/GPU information, grid, wind and dust capacity. Browser viewport
emulation and desktop CPU throttling do not establish physical iPhone or
Android hardware performance.

`--rates=4`, `--devices=iphone`, `--profile=minimal` and `--phase=minimal` select additional probes.
The scenario must run for at least 60 seconds. `report.json` is the latest
comparison, aggregating `before`, `after` and `minimal` runs; `before.json` / `after.json` and their Markdown tables
retain the matched comparison. Each case also links its flat per-frame sample
file, whose `columns` describes each consecutive row in `data`. A failed 4×
acceptance condition or a browser error keeps exit 1; 1×/6× are diagnostics.
The FPS threshold is 30. Physics/game includes the scripted hit's CPU work;
the acceptance gate conservatively requires ≤8 ms p95 in every scenario stage.
All frames, outliers, p99 and dropped-frame estimates are retained. Dropped
frames are estimated against the production 30 Hz phone rendering cadence.

Decisions:

- Full keeps its original grid, solver settings, 60 Hz solves, 30-step hitch
  limit and geometry cadence. Phone grids use 24 (lite) or 18 (minimal) long-axis
  intervals and an even aspect-derived short axis capped at 16/12, with at least eight short
  intervals. Physical dimensions, crown chord spacing and image UV endpoints
  remain exact; hanging panel intervals are uniform.
- Position/velocity/collision iterations are 8/2/2 on lite and 6/2/2 on
  minimal. The full profile retains its 16-or-explicit-higher/4/6 settings.
- Both phone profiles use 30 Hz solves. Lite permits one per render; minimal
  permits at most one when a frame exceeds 20 ms. Game/input clocks consume
  all elapsed time after the bounded work; physical time is not halved at
  the normal 30 Hz phone cadence. Normal phone frames advance their game/input
  clocks once, avoiding repeated timer/HUD events for a small accumulator remainder.
- Keep cylinder projection and all contact refinements. Squared-distance
  rejection avoids square roots outside pipe contact and below speed limits.
  Layer separation visits a reusable active-constraint list: outward corrections
  cannot activate initially separated constraints. Contact-frame refinement
  still checks every pair and retains all six sweeps and 24 refinements.
- Validated Ammo vector addresses support bulk position/velocity reads and
  direct heap audits, including replacement heap views; unsupported bindings
  retain the original vector access. Phones alternate heavy history/force audits
  and the extra pre-solve watchdog audit. Position/velocity/extent checks remain
  mandatory before publishing every step. Full retains both complete audits.
- The phone polar search uses 48 angular bins (full retains 96), the same
  correction/pipe guards and a correct 1/30 s contact interval. The previous
  default 1/60 s contact interval doubled inferred supported-crown velocities
  when paired with a 30 Hz phone solve.
- Polar edge bounds reject candidates outside the complete chord's radial/X
  range, including its closest approach to the pipe axis. Bounds include the
  full shared 5 mm correction budget so earlier contacts cannot invalidate
  the rejection. Velocity clamps also use validated bulk heap access.
- Minimal refreshes geometry/normals every second rendered frame, forcing a
  refresh at flip boundaries, side changes and watchdog recovery. Lite positions
  refresh each rendered frame, with normals/AO/fringe every second frame. Fringe's
  existing elapsed-time integration consumes the accumulated cloth time.
- Reuse beater pose vectors and cache the crown count. Structural damping no
  longer creates a callback every solve. Smooth interpolation stores only
  nonzero Catmull-Rom weights; this preserves the existing full-profile surface.
  Phones render their coarse geometry directly, copying its normals and bounds
  into stable render attributes instead of computing a subdivided surface.
- Unchanged phone cleanliness sums are cached by texture version, grid, size
  and fold axis, shared by game and HUD consumers. Hits invalidate immediately
  through the existing texture update contract. No dirt/UI source hook was needed.
- Existing phone FX caps are retained: 1,380 main GPU dust slots, 15 moths and
  120 moth-scale slots (desktop 2,760 / 30 / 240). Dust update remains constant
  CPU work with GPU particle integration; moth updates follow the active capped
  population. The probe measures both systems without editing their files.
- No rendering, UI or input source hooks were needed. The QA server removes
  an embedded BOM from the existing asset module to work around Vite dev import
  analysis leaving its following bare `three` import unresolved. Production
  sources are unchanged by that QA-only normalization.
- No external assets were added. Existing global `docs/qa/**/*.png` and JPEG
  ignores already cover this QA directory. The Pages build's generated
  optional-source metadata was restored from read-only `git show` to avoid
  unrelated generated-file changes.

Regression coverage is in `tests/phonePerf.test.js`: both phone grids retain
exact UV endpoints, hanging spacing and even folds; frame caps preserve game
clocks; bulk reads survive heap growth; cleanliness caching stays exact after
hits; render attributes retain exact positions/UVs/normals. Real packaged Ammo
runs through the production game/frame and flip-clock paths for 225 seconds with repeated hits and two throw
styles/directions, requiring no pipe tunnelling, each throw ≥0.45 m above the
pipe, monotonic crown-column wave order and zero watchdog recoveries.

## Final measured result

The 4x acceptance gate remains unmet for both profiles. The probe exits 1,
preserving every outlier; these changes must not be described as meeting the
30 fps / 8 ms per-frame target. Full-profile guarantees and phone stability
regressions pass. Actual phone hardware has not been measured.

| Profile | Viewport | FPS | Physics/game mean / p95 | Hit p95 | Flip p95 | Retained heap growth |
|---|---|---:|---:|---:|---:|---:|
| lite | iPhone 14 Pro | 29.94 | 7.25 / 11.80 ms | 13.30 ms | 17.00 ms | -546996 B |
| lite | Pixel 7 | 29.99 | 5.25 / 8.30 ms | 10.10 ms | 10.70 ms | -214652 B |
| minimal | iPhone 14 Pro | 29.86 | 4.03 / 6.80 ms | 9.60 ms | 8.60 ms | 974076 B |
| minimal | Pixel 7 | 29.92 | 3.54 / 5.90 ms | 6.20 ms | 8.60 ms | 802764 B |

[Before/after comparison](comparison.md) links complete 1x/4x/6x phase tables
and the raw per-frame samples. Measured lite draw calls never exceeded 64.
At 4x, the residual cost includes Ammo, post-solve contact and geometry; hit
and flip spikes remain the limiting phases. Minimal reduces the ordinary
cost further, but does not remove those spikes.

Validation: `npm test -- --maxWorkers=2` passed 54 files, 366 tests with seven
skips. `COVERHIT_BASE=/CoverHit/ npm run build` passed; the existing large
bundle warning remains. No rendering/UI/input source files were edited.
No commits, stash or ref checkout were performed.
