# Natural dust and moths — FX handoff

Implemented within FX ownership; shared edits only remove the unused quarks dependency (package + lock), ignore QA PNGs, and supply the explicitly permitted wind-contract stub. `src/main.js`, UI, physics, audio, laundry, cars and facades are untouched.

## Behaviour and decisions

- Dust public API and legacy `points.material.uniforms.scale` hook retained. One fixed instanced-quad batch, with reserved plume/mote/lint slots so long-lived motes cannot starve impacts. Main pool 2,760 + moth scale pool 240 = **3,000 total**. No per-frame CPU particle iteration, uploads, sorting, allocations, physics, or extra depth render.
- Impact plumes use 20–60 main sprites for typical dirt-removing hits, plus a small tail and strong-hit lower-boundary puffs. Initial velocity follows the supplied carpet normal; exponential drag, shader curl displacement, integrated wind drift, 2.5–5 s life and growth to 5x initial size. Fine motes persist 6–12 s with forward scattering/twinkle; a few rotating lint streaks settle faster. Counts use actual dirt removed, including essentially no emission on a repeatedly cleaned spot.
- Kenney CC0 smoke frames are blended with random phase/rotation. 512 px 4x4 WebP, **186,200 bytes**. Source and reproducible builder documented in `public/fx/SOURCES.md`; no attribution-required downloads or extra credits manifest. Transparent contain-padding was verified visually; opaque padding caused faint quad outlines and was corrected.
- Shader HG g=.6 warms backlighting; ambient/front-lit dust stays grey-beige. Analytical ground/tangent-plane fades replace the previous carpet depth pass. Normal transparency with depth testing and no depth writes; this is approximate intersection softening, not scene-depth tracking or volumetric shadowing. Shader curl is bounded displacement from a noise vector potential, not a fluid solver.
- Generic nocturnal/pantry-inspired moth, buff/cream and copper wings. True clothes moths avoid light. Display wingspan **5.6 cm** is deliberately enlarged. Narrow alpha-fringed procedural wings, lathed body, head and long antennae: 48 wing + 140 body triangles per moth. Shader flap 10–14 Hz with glides, single-pass double-sided wings; instanced wing/body/shadow batches cap at 30. Picks remain individual invisible meshes with the original moth IDs/raycast behaviour.
- Seeded 120 Hz flight integration: correlated turn noise, rare bounded heavy-tail turns, target speed .7–1.2 m/s capped at 1.4 (slows during turns/repulsion), upward bias, bank/pitch, soft containment, rack/post/fence-side avoidance and optional spherical obstacles. Wind sampled at each moth. Default lamp positions read the existing yard layout; callers can pass `lights`/`obstacles`/`bounds`. Game still owns the ~4 s lifecycle. Emergence/catch scales, reachable flying volume, caught tumble and lamp-directed fade retained.
- No sediment decals or wing audio, per resource priority/addendum. `src/scene/wind.js` is an **integration stub: replace it with the wind stream on merge**. Dust samples shared wind once at the pad; this intentionally approximates spatial wind across its small cloud. Moths sample spatial wind separately.

## Validation and measurements

`npm test`: 255 tests / 36 files pass. `npm run build` passes. One intermediate concurrent test run timed out in the unchanged beater suite under load; a subsequent plain `npm test` passed. No test timeout settings or unrelated code changed.

`node scripts/verify-fx.mjs` starts a fresh temporary Vite server (important because the project's watcher ignores `.claude` worktrees). Chrome headless, 1280x900, native RTX 2080 Ti / ANGLE D3D11. `performance.json` retains all raw mean/p95 figures, including GPU-query outliers in hidden Medium/Low samples. No browser/shader errors.

| Quality | FX visible draws | Triangles | Mean GPU ms | Mean complete CPU ms | FX hidden CPU ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| High | 145 | 547,404 | 7.02 | 8.57 | 8.53 |
| Medium | 146 | 547,405 | 6.46 | 7.00 | 7.52 |
| Low | 95 | 422,188 | 6.66 | 6.74 | 6.22 |

This comparison hides FX rendering in the same implementation, not a benchmark of the previous git revision. Whole-game CPU still exceeds 6 ms even with FX hidden. High physics alone averaged 5.30 ms. The complete scene budget cannot be claimed green; physics/main work is outside this stream. Medium/Low raw GPU baselines include large outliers, so their means do not establish precise regression deltas.

`node scripts/measure-fx-peak.mjs` isolates **3,000 live particles + 30 moths**: **5 FX draws / 11,700 triangles**, 0.057 ms mean saturated emission, **0.023 ms combined CPU update**, **0.282 ms mean GPU / 0.308 ms max** over 20 timer queries at 1280x900. Dust alone adds one draw; moth scales one, wing/body/shadow three. In the full High scene, 30 moths would add three draws / 5,700 triangles to the measured no-moth scene: projected **148 / 553,104** (projection, not a whole-game peak timing measurement). Procedural fallback texture also rendered with no shader errors. `peak.json` records the measurements.

The separate 600-frame, 30-moth normal-60-Hz fixture averaged 0.074 ms CPU update (max 0.50 ms). Dust uniform-only update averaged <0.001 ms. Microbenchmarks use browser timer resolution and are indicative, not hardware-independent guarantees.

Captures, visually reviewed: `impact-0.1.png`, `impact-0.5.png`, `impact-1.5.png`, `impact-3.png`, `moth-closeup.png`. Controlled backlit fixture uses original untextured carpet/ground geometry, with no stock photos. PNGs are nevertheless gitignored to cover future in-game captures. Research is in `docs/research/dust-moths.md`.

## Files changed

`src/fx/dust.js`, `src/fx/dust/emission.js`, new `src/fx/dust/shaders.js` / `lighting.js`, removed obsolete `src/fx/dust/textures.js`; `src/fx/moths.js`, new `src/fx/mothFlight.js`; permitted `src/scene/wind.js` stub; `public/fx/dust-flipbook.webp` / `SOURCES.md`; `scripts/build-dust-flipbook.mjs`, `verify-fx.mjs`, `measure-fx-peak.mjs`; `tests/dust.test.js`, `dustRenderer.test.js`, new `dust-gpu.test.js`, `moth-flight.test.js`; this QA folder and `docs/research/dust-moths.md`; `.gitignore`, `package.json`, `package-lock.json`. Build-generated carpet manifest changes were restored to their original bytes. The pre-existing shared research brief is untouched.

## Remaining integration / limits

Replace the wind stub on merge. Full-game CPU target remains unmet in the unchanged base workload. Exact scene-depth soft particles, wind-per-particle spatial integration, actual fence collision, deforming-carpet shadow projection, feather/fur microgeometry, and wing audio are intentionally approximated or omitted. No commits, staging, stashes, ref changes, or Git mutations were performed.
