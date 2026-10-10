# Polar flip contact QA ? 2026-10-10

**Status: unaccepted WIP. Penetration acceptance fails.** CPU limits pass; the polar solve obeys its cap, but the settled handoff exceeds
the complete-step correction limit. This replacement does not meet all requested
acceptance criteria. Verification failures retain exit 1. Current captures show
remaining intersections at the collar; they are not evidence of visual acceptance.

## Approach and decisions

Production uses `src/carpet/polarContact.js`; the unchanged old solver is now
`src/carpet/selfCollisionOracle.js` and is imported only by tests and QA. One Ammo
integration replaces four integration/contact microsteps. Contact runs once per
fixed 60 Hz step, with two sweeps and a shared 5 mm accumulated path-length budget
per node. Position correction shifts Ammo history without inventing velocity.

The X-axis cylinder maps nodes to radius and angle using an atan approximation
(error below 0.000012 radians). Counting sort fills preallocated x/96-angle bins;
insertion sort orders their occupants. Adjacent x/angle bins avoid seams. Material
edges also fill angular occupancy between vertex bins, with radial interpolation
and mass-weighted two-endpoint reaction; there are no production triangles.
Three linked material rings are excluded, but distant same-sheet folds remain.
Previous nearest-neighbour IDs plus order bits break radial ties; rest labels
identify sheets without selecting their outside order.

Long hanging panels crowd angular bins, and radial motion runs along their
surfaces. A second fixed xy lookup uses the cheap z-graph layer separator there,
including old mirrored/neighbour rest pairs and the existing 60-degree normal
slope limit. Both polar paths share the cap, inelastic normal response and capped
mu=0.5 tangent friction. Grip patches before release and both supported crown
rows have zero contact inverse mass. An analytic cylinder intersection limits
inward contact correction rather than allowing a later pipe repair to exceed
its budget. The completion separator still has its old unrestricted correction.
No contact microstep structure or oracle solve remains in production.

Two additional physical cases were handled. The old travelling launch impulse
pointed inward on both hanging panels, bringing them through each other before
they reached the pipe. It now points outward while retaining its upward impulse,
column timing and bounded velocity. Final settled-layer cleanup could undo pipe
clearance; completion now checks the pipe again after its final layer pass.

## Before / after: full serial probe

`node scripts/verify-flip-contact.mjs`, 20 throws at each of 60/144 Hz,
both styles/directions, wind on throughout. Exit **1**. This run generated current nine-frame captures. Oracle sampling is excluded
from CPU timings; `metrics.json` is the final timing report.
`metrics-before-polar.json` preserves this tree's WIP HEAD measurements.

| Measurement | Before 60 Hz | Polar 60 Hz | Before 144 Hz | Polar 144 Hz |
|---|---:|---:|---:|---:|
| Deep events | 0 | 33865 | 0 | 34436 |
| p99 penetration (mm) | 0.001282 | 13.888232 | 0.001047 | 13.902486 |
| Added frame CPU (ms) | 23.123 | 0.825 | 9.847 | 0.343 |
| Reported solver cap (mm) | 10.000 | 5.000 | 10.000 | 5.000 |
| Contact solver (ms/step) | 3.541 | 0.662 | 3.601 | 0.673 |
| Max speed (m/s) | 6.000 | 4.851 | 6.000 | 4.737 |
| Recoveries | 0 | 0 | 0 | 0 |
| Full-step contact push including handoff (mm) | unmeasured | 105.740 | unmeasured | 106.751 |

The old 10 mm bound was per microstep. The polar solver shares a 5 mm budget
across both sweeps (floating-point error below 1e-12 metres), but the old settled
separator at completion is outside that budget. The verifier now sums polar
path length and the displacement of each completion-layer call per node in the
same fixed step; CPU instrumentation for that measurement is subtracted.
The acceptance metric remains unchanged: node/triangle separation against 14 mm
thickness, plus independent local-normal node pairs with overlapping half-cell
footprints. Deep means over 3 mm; p99 must be at most 1 mm. The new report has
`budgetPassed=true`, `penetrationPassed=false`, `physicsPassed=false`, `passed=false`.
Outside flips the measured polar dispatch count and CPU are both **zero**; the
existing settled separator continues unchanged. This meets the +0.3 ms outside-
flip target for additional polar work, not a claim about total settled physics.

## Remaining geometry failures

Most retained events occur at material rows 13 / 21, four rings from the crown,
plus the next collar rows and protected crown nodes. `examples` and `pairExamples`
in the report retain node IDs, ages, positions, face IDs and measured gaps.

At 60 Hz, protected nodes 409 / 517 have an oracle normal gap of 1.770 mm at age 0.650 s; both have zero contact inverse mass. Their contact pair cannot directly correct either position.

At 144 Hz, protected nodes 413 / 521 have an oracle normal gap of 0.549 mm at age 0.700 s; both have zero contact inverse mass. Their contact pair cannot directly correct either position.

This does not prove that all future polar approaches must fail. It establishes
that this implementation and the retained collar geometry do not meet the
specified surface metric. Changes to the collar's motion or surrounding free
surface geometry are still needed; freezing all supported rows removes a degree
of freedom the old solver used. A hash restricted to fast nodes far from the pipe
would not directly repair these protected, slowly moving collar pairs, so no
extra 3-D solver was added without evidence that it addresses the remaining case.

Earlier probes also found node/triangle contacts nearly a metre below the pipe.
The inward launch and z-graph fallback explain why a node-only radial ordering
model did not cover those contacts. An experimental bilinear occupancy pass
was rejected: `polar-occupancy-trial.json` records 7,837 deep events in two throws,
p99 13.770 mm and +2.447 ms/frame. Forcing both crown rows directly onto their
scheduled targets also failed (3,849 deep events in two throws); that change was
reverted and its report is `polar-collar-trial.json`. Neither trial is production.
A further diagnostic adds 42 mm of radial clearance to the outside second crown
row during its existing lift. It also fails (3,945 deep events in two throws;
`collar-rise-trial/metrics.json`) and is not applied in production. The verifier's
`--collar-extra=` and `--out=` options retain this isolated experiment.

`handoff-trial/metrics.json` exposed a 73.477 mm correction by the old settled
separator in the completion frame. Earlier reports that only sampled the polar
solver's 5 mm cap were incomplete. Default verification now includes that
handoff; the full 20-throw runs measure **105.740 / 106.751 mm** at 60 / 144 Hz,
so the entire-step 5 mm acceptance is also explicitly failed. Rest
labels at completion and the 26 mm settled gap are still a separate legacy
constraint; meeting this bound needs a bounded transition that also preserves
layer/bar clearance and successful completion, which is not implemented here.

A diagnostic with four native position iterations (one integration, no contact
microsteps) was also rejected: `integration-trial/metrics.json` has 3,217 deep
events in two throws and a 336.728 mm completion correction. Lower native
iteration count does not establish a safe flip or bounded handoff; production
keeps its native iteration settings. The verifier's `--flip-iterations=` flag
exists only for that isolated diagnostic.

## Profile

`node scripts/verify-flip-contact.mjs --profile --flips=2 --dt=60 --no-images`
(exit **1**), 196 fixed flip steps / 196 contact solves / 392 sweeps. The old
baseline profile used 196 fixed steps / 784 microsteps. See
`metrics-profile-before.json` (historical) and `metrics-profile.json` (current).

| Current instrumented phase | Calls | ms / fixed flip step |
|---|---:|---:|
| capture | 196 | 0.031 |
| read | 196 | 0.058 |
| build | 392 | 0.166 |
| visit | 392 | 0.471 |
| buildEdges | 392 | 0.037 |
| edge | 313206 | 0.303 |
| visitEdges | 392 | 0.629 |
| hanging | 392 | 0.325 |
| project | 196 | 1.687 |
| allowance | 137349 | 0.123 |
| resolve | 68154 | 0.328 |
| resolveEdge | 347 | 0.006 |

Nested phases overlap; do not sum them. Instrumenting every edge and allowance
query materially increases this small solver's timing. Use the uninstrumented
full-run solver time above (about 0.66?0.67 ms/step) and added frame CPU for budgets.
The historical oracle profile included QA reads/builds in some nested phases;
the current oracle is separate and does not contribute to these production rows.

## Current visual artifacts

`both-front.png`, `both-side.png`, `corner-front.png`, `corner-side.png` are
nine-frame wireframe sheets; matching `*-rendered.png` files use the production
renderer. `positions.json` contains the sampled nodes. Colours distinguish the
two rest halves. The panels separate during the outward launch, but the collar
still intersects. Stacking/dragging visual acceptance therefore remains unmet.
PNGs are ignored because these captures may include licensed local assets.

## Final validation

- `npm test`: **exit 0**, 47 files / 341 tests, including all 324 existing tests
  and 17 new polar tests. Tests cover angular error, current order, mass weighting,
  a shared cap, exhausted budgets, Ammo history, seams, hysteresis, remote folds,
  grips/crown protection, friction energy, hanging graphs, edge interpolation,
  pipe-blocked reaction, buffer reuse and outward travelling launch.
- `npm run build`: **exit 0**; the existing large-chunk warning remains. Import
  search confirms the oracle appears only in tests and QA, and a normalized byte
  comparison confirms it is unchanged from HEAD.
- `QA_OUT=docs/qa/flipcontact/flipwave node scripts/verify-flip-wave.mjs --no-images`:
  **exit 1**. All four variants have 20/20 monotonic crown throws and all 80
  game-clock flips finish with matching sides. Pipe, rest/crown, speed, extent and
  recovery checks pass. Contact CPU on no-constraint steps still exceeds the
  verifier's unchanged 0.5 ms threshold at 60 / 30 / hitch. That diagnostic is
  during flips and is separate from the zero polar dispatch outside flips.

| Frame variant | Monotonic throws | Added CPU (ms/frame) | No-constraint contact CPU (ms/frame) |
|---|---:|---:|---:|
| 60 | 20/20 | 0.794 | 0.652 |
| 144 | 20/20 | 0.337 | 0.269 |
| 30 | 20/20 | 1.618 | 1.289 |
| hitch | 20/20 | 0.832 | 0.645 |

- `node scripts/verify-contact-regressions.mjs`: **exit 0**, bar-clip, fold,
  layers and crown all pass; see `regressions.json` and their subdirectories.
- `node scripts/verify-longrun.mjs --out=docs/qa/flipcontact/longrun.json`: **exit 0**,
  all three variants (60 / 144 / hitch), each 225 simulated seconds, 13,500 steps,
  34 strikes and two completed flips. Zero recoveries, failures or browser errors.
  Maximum extent 1.727 m, speed 6.0000003 m/s and kinetic energy 5.532 J.
- `git diff --check`: **exit 0**. Git was used only for status, diff and show.

Correctness regressions and long runs ran together after the serial CPU probes;
their timing fields are not CPU acceptance benchmarks. The oracle remains
unchanged from HEAD, and its hash-capacity signature is absent from the built
bundle while the polar solver's signature is present. Existing owner files were
preserved. No commits or stashes were made.

