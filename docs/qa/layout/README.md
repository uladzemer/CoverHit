# Courtyard layout QA

The fixed rack at world (0, 0) now belongs to a separate 6 x 5 m asphalt
household service pad in the lawn. Three 1.5 m steel-post / diamond mesh fence
sides leave the front open. The original T-poles and six laundry pieces run
lengthwise down its left edge, clear of the carpet. Six concrete access slabs
lead around the fence to a roughly 90 cm worn path ending at the sidewalk.

The 3.8 m driveway runs along the main five-storey facade, from x=-28 to 68
at z=-21.8..-18. It turns away at x=64.2..68 and continues behind the building
end to z=-72. A 2.2 m sidewalk and small asphalt aprons serve the four entrances
at x=10, 25, 40 and 55; existing steps and entrance benches remain. Three
parallel Zhiguli and three lamps follow the driveway. The sandbox, steel
rocket/slide and swings occupy the lawn to the left. Refuse containers have
a separate fenced 6 x 5 m rear pad at x=-4..2, z=-29..-24. The seven procedural
garages / two optional garage rows retain a separate apron to the rear-left.
Side and intermediate slabs move clear of the road and its exit; the enclosing
distant microdistrict ring, school, chimney and tree rows are retained.

No asphalt axis runs from an entrance through the rack toward the camera.
The rack, bar dimensions, carpet code, physics and production camera rig stay
fixed. Shared placement constants align optional stock with procedural props.
Optional garage rows fit their footprint with width-only scaling; height and
depth remain unchanged. Containers are spaced to fit the stock model as well.

## Validation and captures

- `npm test`: **238 tests in 30 files pass**.
- `npm run build`: **passes**, with the existing chunk-size advisory.
- All eight optional stock models and 22 surface/HDR assets load in stock mode.
  Procedural and all-yard-assets-missing modes start and render successfully.
- All nine perspective views pass actual floor/skyline coverage: **32,805 rays,
  zero gaps within 350 m**, zero page/shader errors and no blank output frames.
- Unit coverage retains mobile, wide FOV, +/-35 degree yaw, raised eye and
  lateral displacement; a missing ring still fails with the large floor.
  Layout tests check the pad, grass/path exclusion, parked-car footprints,
  offset entrances, and buildings clear of both driveway segments.

Run Vite on 127.0.0.1:5178, then `node scripts/verify-layout.mjs`. Override
`YARD_URL` / `CHROME_PATH` if needed. Restart Vite after scene edits in this
worktree because its `.claude` watch exclusion hides changes. The baseline
was captured from the unmodified checkout before layout edits using `--baseline`.

Each mode has `<mode>-default.png`, `<mode>-aim-left.png`, `<mode>-aim-right.png`
and an annotated `<mode>-plan.png`. The perspective captures use 1468 x 986;
left/right inspection rotates the shared look target by +/-35 degrees while
keeping the eye and pitch. Production pointer aim itself does not rotate the
camera. The orthographic plan is a direct scene render with world-position
labels, separate from the gameplay camera. Captures include the HUD where
applicable and read a completed WebGL frame before its buffer is discarded.
All PNGs here are ignored because optional licensed yard/carpet stock can appear.

Open [default](stock-default.png), [left](stock-aim-left.png),
[right](stock-aim-right.png), [orthographic plan](stock-plan.png).

## Performance

Matched 120-frame samples per mode/view include the entire scene, cascaded
shadow passes and current postprocessing pipeline. These counters are compared
against this checkout's `baseline.json`, rather than earlier QA from before
render polish. `performance.json` retains distributions, quality level, asset
status and coverage for every view. The final run was isolated from tests/build.

| Mode, default | Draw calls before -> after | Triangles before -> after | CPU frame mean / p95 (ms) | Submission mean (ms) |
| --- | ---: | ---: | ---: | ---: |
| stock | 306 -> 310 | 1,050,176 -> 1,041,317 | 20.75 / 22.60 | 6.63 |
| procedural | 267 -> 274 | 689,545 -> 684,739 | 18.92 / 24.40 | 4.33 |
| no-assets | 267 -> 274 | 689,545 -> 684,739 | 18.11 / 22.90 | 3.74 |

Worst matched-view increases are **2.62% draws** and
**3.13% triangles**, both below the required 5% limit.
The verifier enforces that limit for every mode and view. Existing geometry /
material instance batches are retained; all three cars reuse one set of assets
without three separate sets of draw calls. Small background pipes use eight
sides, while the carpet rack retains its original twelve-sided visual pipe.
The added mesh fence shares one alpha-tested material and one instance batch.

CPU/submission timing is a headless measurement, not a sustained-fps or GPU
claim. Startup/visibility shader hitches remain in the full distributions.
Automatic quality selection remains enabled, and captured levels are recorded;
its high/medium settings both retain three shadow cascades.

## Stock rendering repair

The locally supplied panel-block GLB has one triangle with a non-finite vertex
position and normal. The newly exposed facade caused those values to poison
HDR bloom, producing a black default frame despite a valid direct scene render.
Loading now filters that invalid triangle and compacts the remaining attributes
so bounds stay finite. Every finite face and all model materials remain; the
licensed GLB on disk is untouched. A synthetic regression verifies that repair,
and browser QA asserts visible postprocessed output in every perspective view.

## Decisions

- Keep the rack, carpet/physics coordinates and gameplay camera fixed.
- Place the rack off the entrance axis, on its own fenced service pad.
- Run circulation parallel to the facade and turn it away beyond the slab end.
- Keep laundry along the pad edge and playground silhouettes on the left.
- Separate refuse from the carpet pad and preserve garage access.
- Share procedural/stock placements and reuse static instance batches.
- Filter the invalid stock triangle, preserving the rest of the asset.
- Keep licensed screenshots local and retain QA scripts and JSON evidence.
