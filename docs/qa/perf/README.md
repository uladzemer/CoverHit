# CoverHit performance wave

Measured on Chrome 155.0.8059.39, Intel(R) Core(TM) i9-10900KF CPU @ 3.70GHz, hardware RTX 2080 Ti / ANGLE D3D11, at **1440 x 900**. Every saved performance run identifies the GPU; none uses SwiftShader.

**High passes the requested CPU/GPU and rendering budgets in these samples**, including repeated hits on the largest rug: maximum CPU 14.30 ms, maximum GPU 9.40 ms, at most 149 draws / 592,596 triangles. This is a finite browser sample, not a guarantee against every OS or driver stall. **Medium on a separate mid laptop is unverified**: that hardware is unavailable here. Largest-rug Medium also has occasional >16.6 ms CPU/GPU frames on this PC; see the maximum column below.

## Measurement and reproducibility

The initial profile was collected before optimization: [before.json](before.json). High averaged 12.95 ms in the physics/frame bucket and 16.45 ms total CPU, with 327 draws / 1,348,021 triangles. Ammo was 4.96 ms, layers 2.36 ms and watchdog checks 3.13 ms. This identified JS allocation and wrapper work in addition to the native solver. Early zero dust/fringe fields were uninstrumented, not measured zero; the complete later comparison below measures those passes.

The final comparison uses a fresh page per quality, quality selected before boot, five seconds of warmup and 240 consecutive RAF samples. [before-final.json](before-final.json) and [after-final.json](after-final.json) use the same local stock rug, envato-B7PV8QR, assets, lighting and viewport. The script reconstructs pre-wave source **in memory** using read-only `git diff` for the five modified app/physics source files. It does not reset files or touch another agent's lighting changes. Baseline comparison therefore requires this wave's uncommitted diff; saved baseline JSON remains the reference after commit.

GPU time comes from the existing nonblocking EXT_disjoint_timer_query_webgl2 pipeline timer. CPU timers wrap actual Ammo/post-solve/geometry/fringe/dust/raycast work; renderer counters include the complete render and shadow passes. FPS is 1000 / mean wall-clock frame interval. GPU samples are the most recently completed asynchronous query, so they do not necessarily correspond to the CPU sample in the same row.

Final throughput runs pass `--disable-frame-rate-limit --disable-gpu-vsync`. Chrome's default RAF cadence here is approximately 32 fps even with ample CPU/GPU headroom; capped/quality-switch evidence is retained in [before-capped.json](before-capped.json) and [after.json](after.json). The earlier same-page quality-switch runs contain substantial timing outliers; they are retained rather than silently filtered. Fresh-page runs separate steady gameplay from that transition/startup cost. Uncapped FPS is throughput, not a display refresh-rate claim.

```powershell
node scripts/verify-perf.mjs --phase=before-final --baseline --uncapped
node scripts/verify-perf.mjs --phase=after-final --uncapped
node scripts/verify-perf.mjs --phase=after-active --uncapped --active
node scripts/verify-perf.mjs --phase=largest --carpet=05 --uncapped --active
```

Run these serially without concurrent QA/build workloads. Omit `--uncapped` to retain Chrome's ordinary cadence. `--active` sends a 0.9-strength gameplay hit every 36 sampled frames, including impulses, dirt and dust. It is a burst stress workload; native pointer timing is tested separately. The production build succeeded but its existing asset builder removes ignored local carpets when source photos are missing in the worktree. Those assets were restored from the owner's main checkout before the final matched comparison.

## Before / after per quality

Means, before -> after. CPU "physics" is the existing `advanceGameplayFrame` bucket: game/beater updates, fixed solves and geometry/shading refresh. "Other" is total CPU minus that bucket and includes render submission. Faster rendering means fewer fixed solves per render frame; normalized solve costs are reported separately.

| Quality | CPU physics / other (ms/frame) | Total CPU (ms/frame) | GPU (ms) | Draws | Triangles | FPS |
| --- | --- | --- | --- | --- | --- | --- |
| High | 4.39 / 3.28 -> 1.06 / 1.94 | 7.67 -> 3.00 | 3.52 -> 2.55 | 327 -> 146 | 1,348,021 -> 543,536 | 124.8 -> 307.2 |
| Medium | 4.66 / 3.32 -> 1.01 / 1.87 | 7.98 -> 2.88 | 3.57 -> 2.26 | 328 -> 147 | 1,348,022 -> 543,537 | 119.9 -> 322.0 |
| Low | 3.39 / 2.30 -> 0.95 / 1.62 | 5.69 -> 2.57 | 2.71 -> 1.81 | 166 -> 102 | 599,001 -> 418,776 | 165.7 -> 355.8 |

| Quality | Complete integrate (ms/fixed step), before -> after | CPU p95 (ms), before -> after | GPU p95 (ms), before -> after |
| --- | --- | --- | --- |
| High | 8.02 -> 2.30 | 13.00 -> 6.10 | 4.57 -> 3.02 |
| Medium | 8.20 -> 2.22 | 13.30 -> 5.90 | 4.63 -> 2.59 |
| Low | 8.16 -> 2.23 | 11.90 -> 5.60 | 3.64 -> 2.36 |

Complete High integration falls from 8.02 to 2.30 ms per fixed step (71%). Stock physics grid: [46, 28] / 1363 nodes -> [36, 22] / 851 nodes. Physics remains fixed at 60 Hz, with at most two catch-up solves and the original wall-clock/input policy.

## Per-pass breakdown

High, ordinary capped cadence, means in milliseconds per rendered frame from [before-capped.json](before-capped.json) -> [after.json](after.json). These inclusive timers **must not be summed**: readNodes includes its watchdog; integrate includes Ammo/post-solve/readNodes; refreshGeometry includes normals and shading; shading includes fringe.

| Pass | Before | After |
| --- | ---: | ---: |
| Ammo stepSimulation | 5.020 | 2.321 |
| Bar projection + post-solve clamp | 0.698 | 0.178 |
| Layer separation | 2.336 | 0.452 |
| Pre-solve velocity clamp | 0.337 | 0.133 |
| Watchdog checks (both) | 3.193 | 0.415 |
| Read/copy nodes (includes second watchdog) | 1.615 | 0.221 |
| Geometry + normals + shading + subdivision | 0.635 | 1.109 |
| Coarse normals | 0.284 | 0.150 |
| Subdivided normals | 0.000 | 0.282 |
| Fringe | 0.181 | 0.185 |
| Dust update | 0.013 | 0.019 |
| Raycasts | 0.169 | 0.000 |
| Render submission | 2.658 | 1.637 |
| GPU complete render | 10.881 | 10.350 |

The absent baseline subdivided-normal pass is zero by construction. Idle raycasts are skipped when there are no flying moth picks. Hit/flip/native beater paths remain covered by browser probes.

## Active and largest-rug samples

Means / maxima include every measured sample, without dropping outliers. [after-active.json](after-active.json) is the stock rug with repeated gameplay hits. [largest.json](largest.json) is scan 05 (2.765554 x 3.5 m) with the same burst stress.

| Rug / quality | CPU mean / p95 / max (ms) | GPU mean / p95 / max (ms) | Maximum draws / triangles | FPS |
| --- | --- | --- | --- | --- |
| Stock / high | 3.29 / 6.40 / 10.70 | 2.69 / 3.52 / 4.05 | 146 / 543,536 | 281.2 |
| Stock / medium | 3.04 / 6.20 / 8.10 | 2.36 / 2.75 / 3.02 | 147 / 543,537 | 229.6 |
| Stock / low | 2.54 / 5.60 / 6.00 | 1.79 / 2.23 / 2.78 | 102 / 418,776 | 360.5 |
| Largest / high | 5.34 / 9.40 / 14.30 | 3.43 / 4.56 / 9.40 | 149 / 592,596 | 172.3 |
| Largest / medium | 7.07 / 15.20 / 22.50 | 4.10 / 6.61 / 21.49 | 150 / 592,307 | 130.2 |
| Largest / low | 6.71 / 13.10 / 15.70 | 3.97 / 5.56 / 20.74 | 105 / 448,540 | 136.7 |

## Implementation decisions

- Keep the proven 1/60 s fixed solver and maximum two substeps; 1/120 s would double native work without evidence of a quality benefit. Solver iterations are 16 position / 4 velocity / 6 collision, with higher explicit position iterations honored. The independent native cylinder fixture still uses its original 24/12 settings.
- Prefer 34-48 long-axis intervals with cell-aspect error <0.5%, retaining the bounded exact-aspect fallback for unusual scans. This produces 36 x 22 for the stock rug and 27 x 34 for scan 05. Material lengths and endpoint UVs are unchanged.
- Discover each native vector address with the vendor binding, validate all three float components, then use cached HEAPF32 access. Each access reads the current heap view to survive WASM memory growth. Unsupported layouts retain cached WebIDL vectors; no guessed Node offsets or vendor changes.
- Reuse typed position/mid-surface/normal/gap/velocity buffers for layer separation. Keep six symmetric sweeps, monotone cleanup and 24 bounded contact-frame refinements, the slope guard, history updates, momentum transfer and watchdog. Skip non-contact bar work below the collar while retaining velocity clamps. Both projections remain O(nodes), with a fixed topology neighbourhood and bounded pass count.
- Render a separate 2x-per-axis Catmull-Rom surface on the CPU. Linear crown subdivision preserves safe circumscribed chords and nonuniform material UV spacing; linear outer-boundary subdivision keeps fringe roots and the thickness strip attached during dents. Interpolate AO and preserve winding on flips. Refresh smooth normals every other geometry update and immediately during flips, side changes and recovery. Coarse physics, fringe and thickness topology stay intact.
- Merge static yard transforms by material/compatible attributes after stock substitution and AO baking. Preserve per-vertex/instance tint, normals and UVs; compute bounds for frustum culling. Keep existing far facade box LOD and instanced tree cards. Nearby rack, bench and clothesline batches cast; distant houses, trees and decorative props do not enter CSM caster passes. This sacrifices those distant decorative shadows to meet the measured rendering budget.
- Keep physics on the main thread: measured integration cost is now small enough that a worker's transport/ownership complexity is unnecessary for the tested PC. No edits to lighting.js, renderPipeline.js, softShadows.js or carpet material code; carpetMesh changes are geometry/update hooks only. Shadow map size/cascade configuration remains owned by the parallel lighting work.

## Regression evidence

`npm test`: **241 passed, 7 skipped**, 34 files. `npm run build`: passed. New regressions verify WASM memory-growth/fallback access, subdivision UV/crown/winding guarantees, and static transform/tint/caster preservation.

- [Bar clip](bar/browser.json): native collision enabled/disabled comparisons, all-image fold geometry, 40 near-bar impulse stresses / 480 steps, 40 charged pointer strikes; zero penetration, wrong-side crown nodes or misses.
- [Layers](layers/browser.json): both fold axes with native clusters on/off, 30 strikes / 1,140 steps per case; zero layer/bar violations, back-edge motion 26.9-27.8 cm.
- [Fold](fold/browser.json): exact scan aspect/UV range, both sides, flips, combo and moth half selection pass.
- [Crown](crown/browser.json): palas, wool and runner supported-crown gaps pass.
- [Fringe](fringe/browser.json): three rugs retain finite transforms, <6e-8 m root attachment error, hit motion and mid-flip stability. The original licensed reference photo was read from the main checkout through `FRINGE_SOURCE_ROOT`; no source photo was modified.
- [Difficulty](difficulty.json): seeded museum/local rotations and thirty-seed first-rug budgets pass.

`node scripts/verify-longrun.mjs --out=docs/qa/perf/longrun-final.json` passed all variants on scan 05:

| Timing variant | Simulated seconds / solves | Charged strikes / flips | Max extent (m) | Max speed (m/s) | Recoveries / errors |
| --- | --- | --- | --- | --- | --- |
| 60 | 225 / 13500 | 34 / 2 | 1.799237 | 3.946068 | 0 / 0 |
| 144 | 225 / 13500 | 34 / 2 | 1.798926 | 3.274047 | 0 / 0 |
| hitch | 225 / 13500 | 34 / 2 | 1.799315 | 6.000000 | 0 / 0 |

Full energy/time samples: [longrun-final.json](longrun-final.json). Local screenshots under this directory are ignored because they can contain the owner's licensed assets.
