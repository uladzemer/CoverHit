# Hand throw evidence

Run `node scripts/verify-flip-wave.mjs` from the repository root. It starts and
closes Vite and headless Chrome itself; `CHROME_PATH` overrides Chrome's path.
`--dt=60,144,30,hitch` selects frame variants. Production physics remains fixed
at 60 Hz with at most two substeps and the existing hitch catch-up limit.

`metrics.json` checks 20 physical flips with two seconds of rest measurement
between flips, followed by 20 production game-clock flips immediately after each
preceding flip finishes. Spam during an active throw is rejected and hits stay
gated. Both directions and both styles are exercised; wind is enabled in the
second half of the physical sequence and during the game-clock spam sequence.
Node clearance, speed, extent and kinetic energy are checked every substep.
The report includes complete frame CPU timings (physics and geometry refresh,
excluding GPU submission) in addition to physics-only timings. The probe's
identical per-step node sampling overhead is present in both timing groups;
timings are means on this host and are sensitive to other CPU work.

The primary monotonic wave metric samples the crown-adjacent material row in
every short-side column, with a 4 mm bar-plane dead band. This measures the
travelling peel at the supported pipe boundary. Whole-panel column averages and
hem crossing times are recorded independently; freely moving hems can whip back
and forth and are not required to have monotonic first crossings. The physical
column data is not replaced with the gesture's scheduled crossing times.

`positions.json` contains all node positions for nine snapshots of each style.
`both-front-rendered.png`, `both-side-rendered.png`,
`corner-front-rendered.png`, and `corner-side-rendered.png` are nine-frame
textured contact sheets. The corresponding files without `-rendered` show the
physics grid in front and side orthographic views. PNGs are ignored, recursively,
because the rendered scene can contain the owner's licensed stock assets.

Existing probe evidence is retained in `bar/`, `layers/`, `fold/`, `crown/`, and
`longrun.json`. The long-run file covers 225 simulated seconds per frame variant,
34 real charged beater strikes and two flips, with all node checks active.

Decisions:

- Use two three-node grip patches at 15/85 percent of the back hem, with a seeded
  30 percent chance of a two-node corner patch. No extra Ammo bodies, mass changes
  or stiffness changes are introduced. Per-flip native allocations are zero;
  anchor wrappers are cached at construction and existing body disposal owns them.
- Keep the existing crown contact envelope as a positional support constraint,
  peeling it progressively together with the native anchor influence release.
  The hanging panels receive only a bounded travelling velocity pulse; their
  positions are never assigned by a whole-sheet animation or a rest-pose reset.
- Use a 0.25 s wind-up and a 0.70 s hand arc for the largest hem's travel, followed
  by at most 0.70 s after release. A settled throw may finish from 1.4 s; the hard
  timeout is 1.65 s. The longer arc retains the velocity cap for the large rug.
- During a throw use pipe radius + full cloth thickness + 0.1 mm clearance.
  Normal rest retains the existing half-thickness contact radius and close crown
  profile, so previous crown, fold, bar and layer requirements remain applicable.
- Determine gameplay visibility from actual centre crown passage. Track each
  node's bar side with crown clearance and hysteresis, and separately fade layer
  pairs according to actual final-side arrival. Keep dust and landing hooks;
  dust uses the thrown half's dirt and the landing sound is shorter and softer.
- Refresh subdivided render normals on alternate geometry updates, with immediate
  refresh at flip start/end, side changes and watchdog recovery. This avoids an
  extra normal pass on every throw frame.

Final measurements (largest rug 05, 2.681452 ? 3.5 m, 945 nodes):

| Frame variant | Added frame CPU (ms) | Peak kinetic energy (J) | Minimum throw clearance (mm) | Recoveries |
| --- | ---: | ---: | ---: | ---: |
| 60 | -0.770 | 20.120 | 0.100 | 0 |
| 144 | 0.046 | 20.120 | 0.100 | 0 |
| 30 | 0.288 | 20.651 | 0.100 | 0 |
| hitch | 0.167 | 30.017 | 0.100 | 0 |

All 160 throws passed the bar/speed/extent checks, including 80 consecutive
production game-clock throws. Peak node speed was 6.000001 m/s (f32 rounding),
crown-row crossing spread was 0.200 s for two hands and 0.333?0.350 s for corners,
and maximum resting half-bottom mismatch was below 3.5 mm. Wind-free rest RMS
error was below 1.6 cm, or below 5.3 cm with wind. Existing fold/bar/layer/crown
browser probes and all three 225-second long-run variants passed. Unit validation:
294 tests in 41 files; production build passed. Negative timing differences are
measured means, not an assertion of a guaranteed speed-up on every host.
