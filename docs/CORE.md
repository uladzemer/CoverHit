# Core integration

Optional personal Envato 3D assets: run `npm run yard:stock` before starting Vite.
In a `.claude/worktrees/` checkout, the importer also finds the owner's main
checkout sources; `-- --source=D:/path/to/zips` overrides that location.
ZIPs are read-only inputs; only interchange geometry and image data are extracted
to fresh ignored `assets-src/yard/_work/` directories. No archive code runs.
Generated `public/yard/stock/` GLBs and local manifests are ignored, and the build
removes that whole directory unless `COVERHIT_INCLUDE_STOCK=1` is explicitly set,
matching the carpet stock rule. Licensed QA PNGs under `docs/qa/yard3/` and recursively under `docs/qa/yard4/` are ignored.
Missing, HTML, invalid JSON and malformed manifests use procedural geometry;
failed individual GLBs preserve just their corresponding fallback and add no
stock credit. See `docs/qa/yard3/README.md` for conversion and browser evidence.

Run `npm install`, `npm run dev`, `npm test` and `npm run build`. The exact three dependency is 0.186.1. `public/vendor/ammo/` contains the unchanged Ammo loader and WASM binary copied before upgrading from three 0.170.0. Serve them with the Vite app, including when deployed under a base URL.

Startup awaits `loadAmmo()`, the carpet manifest, the first image and optional yard assets before showing the HUD menu. The existing loading status reports yard asset progress; missing yard textures, HDR or tree models use independent fallback materials/geometry and do not prevent play. Physics failure shows a reload message. `createCarpet(seed,{ammo,map,...})` requires resolved Ammo and borrows its museum texture from the asset cache. A failed carpet image uses pattern.js. See ARCHITECTURE.md for parameter values, yard rendering and Bullet world ownership. Run `npm run carpets` after editing source scans or crop config; generated public/carpets files are intended for version control.

The yard rack centreline is 2.15 m high, with a 0.024 m crossbar radius (48 mm outside diameter) and 0.036 m post radius (72 mm outside diameter). `src/carpet/barCollision.js` owns these dimensions for the visual rack, Bullet cylinder, crown wrap and projection. Capped, welded blue pipes and their existing materials and footings are retained. Every rug folds CROSSWISE: its short dimension lies along the bar and the fold bisects the long dimension. Landscape images fold at u=0.5; portrait and square images fold at v=0.5. Physical sizing uses the type's long side and the exact image aspect, with no ground-clearance shrink or 2.4-3.2 m clamp. Nominal wool is 2 x 3 m; the largest wool scan (05, Salor) uses a per-entry 2.5 x 3.5 m size. Palas is nominally 1.5 x 2.2 m and runner 0.9 x 3 m. The retained tapestry type uses its existing 2.7 m long side. Short sides come from scan aspect, so actual 05 spans 2.765554 m and the current runner scan spans 1.572382 m. Rack span is the largest scan's short side plus 0.6 m, rounded upward to 0.1 m, with a 3.2 m minimum: currently 3.4 m, giving 0.317223 m at each end of 05. The largest 1.75 m half has a conservative 0.388 m clearance including cloth thickness (0.288 m after the existing 0.1 m motion reserve), above the 0.25 m requirement.

The grid has an even interval count along the folding axis. Structural links are built flat, then wrapped around a rounded crown with equal-length chords; the crown clears the cylinder and maintains both equal half lengths. Spaced middle-line anchors prevent sliding. Scan UVs remain (0,0) bottom left to (1,1) top right across the whole sheet, placing half the medallion at the top of the upright front panel. Main translates the mesh to the bar; physics uses local coordinates.

The bar is a static btCylinderShapeX, with a 0.016 m rigid margin (half the 0.012 m carpet thickness plus 1 cm). Its extents compensate for this Ammo build's SDF evaluating the implicit shape without the rigid margin. SDF_RS is enabled. The performance wave uses at least 16 position iterations, 6 collision iterations and 4 velocity iterations; the separate native cylinder fixture retains its 24/12 settings. A separate native soft patch, without projection, verifies contact against the cylinder, compared with collisions disabled.

After every solve, all nodes inside barRadius + carpetThickness are projected outside, choosing front/back from the original fold topology and the intentional flip state rather than current position. Wrong-side nodes in the crown region are also corrected. A rounded collar envelope preserves the crown profile and minimum outward separation in the upper 30 cm: otherwise triangles between individually safe nodes could still cut through the pipe. The lower hanging panels remain free to bend. Both m_x and m_q are updated and inward radial velocity is removed. Per-node speed is limited to 0.9 m/s within 30 cm of the axis and 6 m/s elsewhere, before and after solving. Impulses within 25 cm are attenuated from 20% at the axis to full strength at 25 cm; kinematic beater travel and hardness are also reduced near the crown. The render surface offsets 0.006 m along outward normals with normal depth testing and depth writing, without polygonOffset.

Dirt covers the full UV sheet, with half-specific cleanliness and clipped cleaning kernels. HUD shows the visible half; both halves must reach 90%. The first museum carpet needs 23 seeded random 0.75-strength hits (11 + 12) in the size QA simulation. The easy stock first carpet needs 22 (11 + 11) in the size QA simulation. Cleaning uses an equivalent physical radius proportional to sqrt(carpet area), converted to the existing normalized UV kernel, preserving the cleaning footprint fraction and gameplay budgets. Thirty-seed first-carpet averages are 28.4 museum and 27.83 local stock. Difficulty budgets refer to both halves and include a 1.2 s flip with at least 1.6 times expected playing time. Existing 90?115 s timers are retained as a minimum; the cap is now 119 s.

F or the HUD button starts a seeded hand throw lasting up to 1.65 s. Two three-node grip patches on the back hem are the default; 30% of gestures use one corner patch. The hands scoop down/back, then above the pipe and forward. The remaining hanging nodes stay dynamic, with a bounded travelling launch pulse. Crown anchor influence releases progressively, and the supported collar peels along the bar with 0.20 s (two hands) or 0.32 s (corner) delay from end to end. The supported crown retains its positional contact envelope; it is not an extra hand or native body. Bar projection remains active throughout, with crown passage and a 4 mm hysteresis band determining per-node bar sides. During throws, polar and below-pipe graph contacts follow current geometry; the rest separator returns at completion. `flipThrow` fires at hand release (0.95 s), with crown dust proportional to thrown-side dirt; `flipEnd` retains the landing sound. The visible game half changes when the centre crown node passes, but hits stay gated until release and speed below 0.6 m/s (after the 1.4 s minimum gesture), or the 0.7 s release timeout. A half automatically flips once when it first reaches the threshold. Manual flips work both ways at any time during play. Dirt and scoring ignore hits during the pull; physics resumes afterward, and the camera stays in place. Moths and late-round hints use only the visible half. Raycasting also selects only that half, even when the panels swing across each other.

Hold mouse/touch to wind up, release to strike. Charge reaches full strength in 0.6 s, with a subtle cursor arc; quick clicks are 0.25-strength taps. The 85 ms accelerating strike and 280 ms total recovery preserve a roughly 0.5 s moderate-charge rhythm. The hit ray is captured on release. Moth interception occurs once at impact before carpet scoring. `game/state.js` timing windows are unchanged. `window.__coverhit.strikeLog` records game-time intervals, wall times, UVs, misses and multipliers. Browser QA at 400 ms hold + 250 ms gap reaches ?3 at strike 9 and retains it through strike 12.

Recovery accepts the next hold after impact, so a 350 ms hold plus 250 ms gap builds combo. The browser debug `setCarpetType(id)` now returns a promise; `setCarpet(id)` selects a museum image by ID, and `carpetEntry` exposes its manifest entry. The regular sequence starts with Kazak stars (09), then Tekke (03), then the forest tapestry (11), and includes every image before repeating. The first carpet's dirt/duration use the existing easy difficulty curve.

The kinematic beater's compound sphere loop collides through Bullet SDF_RS. Set its pose before each physics step, then finish hit dispatch after that step. `physicalContact` is optional: false/unconfirmed triggers a localized impulse in main, while dirt/dust/audio/score always consume the single hit event. The vendor binding lacks soft rcontact access, so insurance may supplement an actual soft-body collision. Impulse strength is bounded to 0-1 and distributed by squared radial falloff; it never moves positions directly.

Carpet replacement and HMR disposal release native bodies, shapes, motion states, world and solvers as well as GPU resources. Keep dust integration at `emit(point,normal,amount)` and `update(dt)`; dust is maintained separately. Procedural patterns, pile, sounds and scoring retain their existing contracts.

Node tests deliberately avoid WASM. Projection tests use deterministic node mocks and verify positions, side retention, velocities and solver history. They verify helper mapping, invalid parameters, local impulse falloff, charge strength, swing acceleration/impact/recovery, as well as pattern, dirt, difficulty, progression, game and audio logic. Browser testing exercises the real WASM path. Physics receives at most 1/30 s per frame, with an explicit maximum of two 1/60 s substeps; game/input clocks continue to use elapsed wall time. Physics-grid normals are computed once per geometry refresh. The separate subdivided render surface computes normals every other refresh, and immediately at flip start/end, side changes or watchdog recovery. See WAVE5-VERIFICATION.md for the resumed implementation and browser evidence.


Run `node scripts/verify-bar-clip.mjs` (Vite at 127.0.0.1:5173; Playwright and Chrome available, optional CHROME_PATH) for native collision verification, all-image crosswise geometry checks, 40 deterministic full-strength near-bar impulses over 480 steps plus 40 pointer-driven full-charge beater strikes, and screenshots in docs/qa/bar-clip/ and docs/qa/fold/.

The original anchors passed `disableCollisionBetweenLinkedBodies=true`, suppressing soft-body contact with the entire bar despite SDF_RS. Anchors now pass false. Browser probes verify both cases with projection disabled: contact responds with false and passes through with true.

Layer contact follows bar projection on every physics step. Settled cloth retains
its mirrored/neighbour rest-pose separator and 26 mm graph clearance. Throws now
use `src/carpet/polarContact.js`, with one Ammo integration and two contact sweeps
per fixed 60 Hz step. The old node/triangle solver is preserved unchanged as
`selfCollisionOracle.js`, imported only by tests and the browser QA script.
There are no production triangle queries or contact integration microsteps.

The cylindrical axis is X. Preallocated typed buffers store x, radius and angle;
a bounded atan approximation feeds a 96-bin angular grid and counting sort.
Insertion sort orders each occupied cell by current radius. Queries cover adjacent
x/angle bins and interpolate material-edge occupancy where vertices span several
angular bins. Three linked material rings are excluded; remote same-sheet folds
remain candidates. Previous nearest-neighbour IDs and order bits disambiguate
near-equal radii without using rest labels to select the outside sheet.

Below the pipe, a uniform xy lookup drives the cheap z-graph layer separator,
including mirrored rest neighbours. Angular bins become crowded on long vertical
panels, and radius there measures distance along the panel rather than its
thickness. Graph normals retain the existing 60-degree slope bound. All polar contact
paths share a cumulative 5 mm per-node budget across both sweeps, mass-weighted
correction, shifted m_q history, inelastic normal response and capped mu=0.5
friction. Grip patches until release and both supported crown rows have zero
contact inverse mass. Pipe intersections restrict inward contact correction.
The launch pulse now points outward: its previous inward direction could send
hanging panels through each other before reaching the pipe. Flip completion
checks pipe clearance again after the final settled-layer pass.

**Polar replacement is still an unaccepted WIP.** It reaches the requested CPU target and clamps
the polar solve to 5 mm, but fails the independent node/node and node/triangle
penetration metric. The pre-existing settled-layer handoff also exceeds the
total fixed-step correction limit; QA now includes that handoff. Failures concentrate in collar rows; examples
also include pairs of protected crown nodes. Fast node ordering, including edge
occupancy interpolation, does not establish clearance of the complete moving
surface. The nine-frame captures show remaining collar intersections.

The final serial 20-throw comparison at 60 / 144 Hz changes added frame CPU
from +23.123 / +9.847 ms to +0.825 / +0.343 ms. The solver itself takes
0.662 / 0.673 ms per fixed step and accumulates at most 5 mm polar-solver push,
with zero polar calls outside flips. Correctness regresses: 33,865 / 34,436
oracle events exceed 3 mm, and p99 is 13.888 / 13.902 mm instead of the
previous 0.001282 / 0.001047 mm. The completion handoff moves a node by 105.740 / 106.751 mm in the full probe;
that legacy separator is outside the polar budget. These results fail acceptance.
The two-throw diagnostic profile records 196 solves / 392 sweeps: capture
0.031 ms/step, read 0.058, bin/normal build 0.166, node-bin visit 0.471,
edge visit 0.629, hanging rest neighbours 0.325, total instrumented projection
1.687. Nested timings overlap and instrumentation inflates this short solve;
use the uninstrumented full-run timings for CPU acceptance.

`node scripts/verify-flip-contact.mjs` runs 20 throws per 60/144 Hz variant,
alternating both styles/directions with wind on, sampling the retained oracle
once after each fixed contact step. QA sampling is excluded from CPU timings.
It requires zero events deeper than 3 mm, p99 at most 1 mm, at most 5 mm contact
push per fixed step and at most +3 ms per flip frame. Failures retain exit 1.
The polar dispatch is absent outside flips; the pre-existing settled separator
continues there. `docs/qa/flipcontact/README.md` records before/after numbers,
profiles, remaining failures, command exits and current front/side captures.


Root cause of the merged/inert back half: SDF_RS handles rigid contacts only; front-only hit selection had no layer contact to transfer momentum. Existing fold-only anchors and uniform mass/aerodynamic forces were correct and are retained. Native 32-cluster CL_SS | CL_SELF is optional via clusterSelfCollision:true and generated after wrapping, alongside SDF_RS; it defaults off. Explicit projection remains mandatory. Earlier browser timing on this machine measured 5.9-7.0 ms mean physics steps without clusters and 7.1-8.0 ms with clusters (native p95 9.6-10.2 ms in the saved run), within a 16.67 ms step budget. This measures complete Cloth.integrate, not GPU/render frame time.

Run `node scripts/verify-layers.mjs` with Vite at 127.0.0.1:5173 and Playwright/Chrome available. It compares native collision on/off in both fold orientations, performs 30 full-strength centre impulses per case, samples every mirrored/neighbour pair and bar clearance over 1140 steps including both flip directions, and requires back bottom-edge movement above 2 cm after the first hit. Results and side-view before/after screenshots are in docs/qa/layers/. These are deterministic physics strikes through applyImpulse, not pointer/beater timing tests.

The infinite-plane regression was introduced by f32cc76. Its z-only layer projection solved a local plane equation by dividing by normal.z; the accepted normal could be almost edge-on (normal.z just above 1e-6). Repeated contact-frame refinement then amplified the displacement, stretching structural links without a corresponding velocity spike. Velocity clamps and NaN checks therefore could not stop it. `layerContactNormal` now restricts the contact-frame slope to 60 degrees (normal.z >= 0.5), keeping the z-only solve well conditioned while retaining ordinary tilted-panel normals and tangent offsets. Degenerate and non-finite frames use the z axis. This addresses the reciprocal-normal singularity before displacement is computed, independently of recovery.

The separate physics watchdog checks m_x/m_q/m_v/m_f before solving and before copying nodes into render positions. Any non-finite component, node more than 4 m from the bar along any axis, or speed above 30 m/s restores the entire cloth to `clothRestPosition` for its current visible side in that frame. It clears velocities, forces, solver history, queued strikes and the driven flip, refreshes native normals/bounds, and logs once per cloth instance. Dirt and visible-side state are preserved. `watchdogRecoveries` counts all recoveries, so the long-run verifier fails even if recovery conceals a subsequent physics regression.

Run `node scripts/verify-longrun.mjs` (Playwright/Chrome installed, optional CHROME_PATH). It starts and closes its own Vite server, freezes RAF, seeds random input, selects local envato-B7PV8QR when available or the first museum rug, and uses the real beater hold/release, collider and impulse paths. The deterministic sequence is one second of warmup, four centre strikes (600 ms hold, 500 ms gap), at least 180 seconds of simulated idle, 30 more strikes, and two flips with settling. Scoring/round expiry are excluded so physics continues for the entire experiment. Variants are 1/60 s, 1/144 s, and 1/60 s with a 250 ms hitch every 120 frames. All use the production accumulator and fixed solver steps. Node bounds and speeds are checked after every substep; kinetic, gravitational potential and their sum are sampled every simulated second (elastic strain energy is not included). Output is `docs/qa/longrun/current.json`. The probe also fails on page errors, a watchdog recovery, or fewer than 34 dispatched strikes. Options: `--dt=60,144,hitch`, `--root=<detached-worktree>`, `--out=<report.json>`.

Historical runs with the identical 60 Hz browser probe: 4b7194c passed (max extent 2.084 m, speed 4.605 m/s), 79f6e73 passed (1.730 m, 5.086 m/s), 15b5a49 passed (1.741 m, 5.947 m/s); each completed 13,500 steps / 225 simulated seconds, 34 strikes and both flips. Unmodified f32cc76 failed at 2.283 simulated seconds with extent 61,341.594 m and peak speed only 4.790 m/s. The stronger deterministic beater probe exposes the same position explosion sooner than the owner's idle repro. The root fix alone, before adding the watchdog, passed the complete sequence (max extent 1.744 m, speed 6.000 m/s). Reports are preserved alongside the final timing-variant report in `docs/qa/longrun/`.

Final validation: all 121 original tests plus 14 regression tests passed (135 total); `npm run build` passed. All three long-run variants completed 225 simulated seconds / 13,500 steps, 34 charged strikes and two flips, with no page errors, threshold violations or watchdog recoveries:

| Frame dt | Max extent (m) | Max speed (m/s) | Max kinetic energy (J) | Recoveries |
| --- | ---: | ---: | ---: | ---: |
| 1/60 s | 1.744085 | 6.000000 | 0.839863 | 0 |
| 1/144 s | 1.743433 | 4.417874 | 0.822754 | 0 |
| 1/60 s + 250 ms hitches | 1.742583 | 6.000000 | 15.729326 | 0 |

The hitch case intentionally advances input/charge/swing clocks by the whole hitch while dropping excess physics time; its transient kinetic-energy maximum is higher, but node bounds/speeds remain within limits. A separate real-Ammo browser recovery probe injected a 1,000 m position, a 31 m/s velocity, and a NaN position. Each restored the exact current-side rest pose in one read/render frame, retained dirt/side, and stayed stable for 120 further physics steps; see `docs/qa/longrun/watchdog.json`.


Courtyard revision 4: a rotated brick 1-447 closes the right side; overlapping panel 1-464 / brick 1-447 far blocks close the perimeter, including a nine-storey panel variant. Far blocks use shared baked window atlases and 12-triangle boxes, outside the play-area shadow pass. Fog starts at 48 m and reaches the HDR horizon tint at 135 m. The default camera is 1.82 m high (+0.32 m), looks down toward the hanging panel centre, and fits its height near 50% of the landscape frame. Narrow viewports prioritize fitting the whole short-side span. Cream HUD labels have rgba(20,18,24,0.7) panels with 8 px backdrop blur; opaque poster, credits and toast surfaces retain dark ink and red accents. Disabled flip labels retain text opacity.

Run `node scripts/verify-yard4.mjs` against Vite at 127.0.0.1:5173 for stock, procedural and all-assets-missing startup; default and extreme pointer positions; raised-eye skyline rays; menu, playing, credits, carpet done, game over, urgent timer, toast, retry and mobile screenshots; worst-white-background WCAG contrast; and 120-frame renderer/CPU/interval samples. Aim moves the pointer/beater, not the camera. Reports and ignored licensed screenshots are in `docs/qa/yard4/`. For physics evidence set `QA_OUT=docs/qa/yard4/bar`, `.../fold` or `.../layers` when running the respective verification scripts. See `docs/qa/yard4/README.md` for measured results.


Carpet size QA: run `node scripts/verify-size.mjs` against Vite at 127.0.0.1:5173 for default-camera screenshots of palas, ordinary wool, largest wool and runner, with exact-aspect, floor-clearance, end-margin, frame bounds and zero-recovery assertions. The camera retains the 48-degree field of view and 1.82 m eye height, uses a 2.9 m minimum distance to keep the idle beater away from the shorter palas, targets about 55% frame height for 3.0-3.5 m carpets, and fits the complete rack horizontally on narrow viewports. Palas occupies about 43% at 1280 x 900 because its specified long side is only 2.2 m. Images and measurements are in docs/qa/size/. PNGs there are ignored because captures include the owner's licensed yard stock; JSON evidence is retained. `node scripts/simulate-difficulty.mjs` writes museum and local rotation hit counts and thirty-seed first-carpet averages. Size-wave bar-clip stresses rug 05; layer QA uses 2.5 x 3.5 m cloth in both orientations. Long-run QA now defaults to rug 05 and accepts `--carpet=envato-B7PV8QR` for the owner's stock rug; use `--out=docs/qa/size/biggest-longrun.json` to retain the size-wave evidence separately.

Size-wave final validation: all 155 unit tests and the production build pass. Default-camera size, fold, largest-scan bar-clip and 2.5 x 3.5 m layer probes pass. Both scan 05 and the local stock rug completed all three 225-second timing variants with 34 charged strikes, two flips and no recoveries. An additional 225-second scan-05 run with the final default camera also passed. See docs/qa/size/README.md and its JSON evidence.

Distant backdrop revision: `src/scene/yard/backdrop.js` adds a staggered 96 m
housing layer, an overlapping 150 m perimeter, two sixteen-storey P-44-like
towers, nine-storey II-49-like loggia facades, five-storey panel/brick slabs,
a fenced three-storey school and striped boiler chimney. Three tree rows use
crossed birch/poplar alpha cards. Locally generated deterministic window
textures and shared instanced boxes keep the complete new ring at 9 draws /
2,320 triangles, without shadow rendering or network assets. These budgets
exclude the existing courtyard and sky.

The visible sky is now an analytic sunset gradient with a low solar disc and
broad glow; the optional HDR remains the reflection environment. Its horizon
sample, mixed toward sunset peach, supplies fog and sky colour. Warm ambient
light, reduced HDR intensity and distance fog (60–350 m) separate the layers.
The ground extends to 600 m in each direction and camera clipping to 600 m.

`npm test` includes screen-ray coverage against the actual far solids and
floor, with sky allowed only above the far skyline. It tests landscape,
mobile, wide FOV and a conservative ±35° yaw / raised / displaced camera
envelope. The regression fails if the enclosing ring is absent even with the
large floor. `node scripts/verify-backdrop.mjs` (Vite on 127.0.0.1:5178,
optional YARD_URL / CHROME_PATH) saves default, extreme aim, wide and mid-flip
screenshots, samples 120 frames per view, asserts ?140 total draws and zero
coverage gaps within 350 m, for stock, procedural and missing-assets modes.
See docs/qa/backdrop/README.md and performance.json. PNGs are ignored because
captures can contain personal licensed stock assets.


Rendering quality integration (2026-10-09): the HUD can call
window.__coverhit.setQuality("high"|"medium"|"low") and read .quality.
The setter returns false for invalid levels and dispatches coverhit-quality
with {level,label} detail. Persistence is guarded against unavailable storage.
See ARCHITECTURE.md Render polish and docs/qa/polish/README.md for pipeline
order, quality budgets, tone comparison and measured GPU/CPU timings.


Courtyard layout revision (2026-10-09): the rack remains at world (0, 0),
with unchanged physics, carpet code and gameplay camera. Its own 6 x 5 m
asphalt service pad has three mesh fence sides, an open front, and lengthwise
T-pole clotheslines with the existing laundry. Concrete access slabs lead
around the fence to a 90 cm worn shortcut and the frontage sidewalk. The
3.8 m driveway runs parallel to the main slab at z=-18..-21.8, with three
parallel parked Zhiguli, lamps, a 2.2 m sidewalk, entrance aprons and existing
steps/benches. It turns away beyond the slab's right end. The refuse bins
occupy their own fenced rear pad, and garages keep a separate apron.
Side/perimeter slabs move clear of circulation; the distant backdrop ring
is retained. Shared placement constants keep stock and procedural props
aligned. Small background pipes use eight sides; the original twelve-sided
rack is retained and all three cars share geometry/material instance batches.
The optional panel-block GLB's invalid triangle is filtered at runtime to
prevent NaN positions/normals from poisoning bloom; finite faces remain.

`node scripts/verify-layout.mjs` against Vite on 127.0.0.1:5178 captures stock,
procedural and missing-assets default / +/-35 degree inspection views and
annotated top-down orthographic plans. It asserts actual floor/skyline
coverage, nonblank postprocessed frames, zero browser errors, and <=5%
matched-view draw/triangle regression. See docs/qa/layout/README.md, baseline.json
and performance.json. Licensed captures are ignored. The ground and backdrop
QA READMEs describe earlier revisions; layout QA is the current placement map.

Performance wave: the factory prefers 34-48 intervals along the long axis with
cell-aspect error below 0.5%, retaining the existing bounded-grid fallback for
unusual scan aspects. A separate 2x-per-axis Catmull-Rom surface preserves scan
UVs; the crown uses linear subdivision to retain safe circumscribed chords,
and outer boundaries stay linear to keep fringe and thickness attached.
Physics, fringe and thickness ownership stay on the coarse grid. Validated Ammo
vector pointers access the current HEAPF32 view, with cached WebIDL-vector
fallback; layer contact reuses typed buffers and retains all six contact sweeps
and 24 bounded refinements. Static yard instances merge by material/attribute
layout after stock replacement and AO baking. Only nearby rack, benches and
clothesline batches cast; distant ring/tree cards keep their existing LOD.
See docs/qa/perf/README.md and scripts/verify-perf.mjs for measured Chrome CPU,
GPU and draw budgets, limitations and native regression evidence.


Hand-throw QA: `node scripts/verify-flip-wave.mjs` starts its own Vite server and
uses the largest museum rug (05). It checks 20 alternating-direction throws per
frame variant (30/60/144 Hz and 250 ms hitches), then a production game-clock spam
sequence, with wind on the latter half of the physical sequence. Node clearance
is checked after every solve during throws against pipe radius + full thickness;
normal rest contact retains radius + half thickness so existing close-crown QA
continues to apply. The wave metric is the crown-adjacent material row's crossing
of the bar plane in every column; hem and whole-panel column crossing times are
also recorded separately. This metric describes the travelling peel at the pipe,
not a claim that every free node crosses simultaneously within its column.
`docs/qa/flipwave/metrics.json`, `positions.json`, rendered and wireframe nine-frame
front/side sheets, and the regression probe reports provide the evidence. All
PNGs below that directory are ignored because local assets may be licensed.
