# Laundry stream report — 2026-10-10

Implemented deterministic shared wind and offline cloth/rope VAT playback. Ten
garments and two ropes use two instanced colour submissions; cloth adds one
animated shadow submission per intersecting cascade. No laundry simulation,
vertex uploads, instance uploads or additional Ammo bodies run per frame.

## Files changed

- `src/scene/wind.js`: exact shared wind contract plus independent replay factory.
- `src/scene/yard/laundry.js`: static drape, optional validated VAT loading,
  frame/strength blending, neighbouring-sample normals, free-edge flutter, slight
  yaw, printed fabric atlas, weave bump, warm backlight, clothespins and animated
  depth material. Shared yard material prevents accidental static optimization.
- `scripts/bake-laundry.mjs`, `public/yard/laundry/{positions.bin,manifest.json,SOURCES.md}`:
  deterministic seeded bake, reusable templates, three closed five-second clips,
  bounds, pins and rope rest transforms. No downloaded assets or credits JSON.
- `src/scene/yard/details.js`: replace only laundry; share wind with existing
  grass and procedural foliage hooks. `props.js`: remove only old segmented rope,
  retain existing T-poles. No stock sway hooks existed to update.
- `src/main.js`: wind import, one frame update, QA exposure and disposal.
- `src/carpet/cloth.js`, `src/carpet/fringe.js`: minimal wind-source edits explicitly
  requested in task item 5(b). Carpet samples once per step; the existing force
  loop loses per-node trig/vector construction and retains the same Ammo workload.
- `tests/wind.test.js`, `tests/laundryBake.test.js`: determinism, finite values,
  bounds, spatial variance, exact loop closure, byte budget, placement, Node
  fallback and static-optimizer regression. Existing placement test unchanged.
- `docs/research/laundry-wind.md`; this QA directory; `.gitignore`: only recursive
  laundry PNG ignore patterns, because full-game captures contain personal stock.

## Verification

`npm test -- --maxWorkers=2`: **36 files / 254 tests passed**. Unrestricted worker
runs hit the existing beater test's five-second timeout while concurrent jobs
were active; no test/config outside this stream was changed to mask that timeout.
`npm run build`: passed (existing large-chunk warning only).

`node docs/qa/laundry/verify.mjs` against Vite on port 5182: passed; zero browser
errors. Both live VAT batches remain visible after the courtyard optimizer.
Aborting laundry requests retains the static drape and starts successfully.

`contact-sheet.png`: eight frames over six seconds; rows calm / breeze / strong.
`fallback.png`: no VAT; `default-view.png`: original game camera, HUD hidden only
for capture. Laundry stays behind the rack at left and clears the central carpet.
All PNGs are intentionally ignored. Reproduce with Vite on 5182 and the command
above; `LAUNDRY_URL` / `CHROME_PATH` override environment defaults.

## Measurements

Full raw details and GPU identifier are in `performance.json`.

| Measurement | Result |
| --- | --- |
| Position atlas | 1,391,616 bytes (1.33 MiB); no normal atlas |
| Loop closure | Encoded first/final frames identical, every template/clip |
| Laundry simulation CPU | 0 ms/frame |
| Laundry vertex/instance uploads | 0 per frame |
| Isolated CPU render submission, including one shadow pass | 0.062 ms/frame mean |
| Colour / isolated shadow submissions | 2 / 1 |
| High full-scene submissions / triangles | 144 / 546,974 |
| High full-scene CPU / GPU | 6.31 / 7.04 ms mean |
| Medium submissions / triangles | 145 / 546,975 |
| Low submissions / triangles | 92 / 418,150 |

Hardware: RTX 2080 Ti, Chrome headless, ANGLE D3D11, 1100×760 full-game viewport.
Geometry and High GPU budgets pass. Full-scene CPU narrowly exceeds 6 ms in this
sample; Medium/Low GPU and interval timings vary dramatically across repeated
quality switches (see JSON). There is no trustworthy isolated before/after
full-game timing comparison on this shared machine. A quiet merged-scene
performance run remains required to certify CPU and Medium/Low non-regression.
No changes to other streams' rendering pipeline were made.

## Decisions and limits

1. Original Node constraint bake → RGBA8 VAT, no Blender or external VAT code.
2. Four reusable templates instead of separate atlases per garment keep decoded
   GPU storage under 2 MiB. Shirt and trousers retain constant topology; trousers
   use a matching colour/depth silhouette cutout. Small socks use narrow cloth
   templates; these are stylized silhouettes rather than tailored garment meshes.
3. Normals are calculated from adjacent VAT samples; frame interpolation is
   manual, filtering nearest, mipmaps disabled and small batches uncullable.
4. Use dynamic animated shadows rather than static proxies. Two colour calls
   are the laundry-plus-rope total; cascade shadow calls are additional.
5. Retain pad/T-pole placement and bound billow amplitude to protect the play
   view. Garment pins are fixed in their template bake; ropes have independent
   baked sway. Templates approximate attachment rather than a coupled rope/cloth
   solver, and do not model garment collisions or self-collision.
6. No network assets were downloaded; no new attribution-panel manifest needed.
7. No commits, stashes, ref changes, car edits or building/backdrop edits.
