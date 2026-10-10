# CoverHit architecture

CoverHit is a browser 3D arcade about beating a Soviet carpet hanging on a courtyard pull-up bar. It uses Vite 6, vanilla ES modules, three exactly 0.186.1, and Bullet soft-body physics through the vendored Ammo.js WASM build from three 0.170.0. Carpet albedo comes from licensed museum scans and public-domain paintings; procedural patterns are a texture-load fallback. Audio and pile detail remain procedural.

## Modules and contracts

| Module | Responsibility / public surface |
| --- | --- |
| `main.js` | Async physics startup, yard integration, centralized hit pipeline, fixed-step accumulator and render loop |
| `carpet/cloth.js` | `loadAmmo()`, pure `clothParameters` / `impulseWeight`, `Cloth({ammo,...})` with `step(dt)`, `applyImpulse(point,dir,strength,radius)`, stable `geometry` and `positions` |
| `carpet/carpetMesh.js` | `createCarpet(seed,clothOptions)` returns `{mesh,cloth,dirt,dispose}`; disposal removes Bullet bodies and destroys native allocations |
| `carpet/assets.js` | Async manifest/texture loading, next-image preload, aspect fit, shared texture ownership |
| `carpet/pattern.js` | Seeded procedural carpet patterns used only on texture failure |
| `scripts/build-carpets.mjs` | Sharp crop/restoration pipeline, WebP/thumbnail/manifest generation and 8 MiB budget enforcement |
| `carpet/dirt.js` | `DirtMap.hit(u,v,strength)` returns removed dirt; `cleanliness()` and a shader texture |
| `input/beater.js` | Contract-driven model selection and swing; `setBeater(id)`, `onHit(cb)`, `update(dt)`, `beforePhysics(cloth,mesh)` / `afterPhysics(cloth)` |
| `fx/dust.js` | Separate effects implementation; continue `dust.emit(point,normal,amount)` and `dust.update(dt)` |
| `fx/moths.js` | Spawn, intercept closest ray target, catch/escape visual effects; scoring remains in Game |
| `scene/yard.js` | Courtyard, static visual bar, light and environment |
| `scene/yard/*.js` | Geometry batches, housing, courtyard props and optional CC0 texture/HDR/model loading |
| `scene/yard/stock.js` | Optional personal Envato manifest, independent GLB fallbacks, instanced models, warm lamps and conditional credits |
| `scripts/import-yard-stock.mjs` | Safe local ZIP extraction, Node FBX/OBJ/glTF conversion, metre calibration, meshoptimizer budgets and WebP textures; all licensed output ignored |
| `audio/sfx.js` | Synthesized WebAudio hits, combos, moths and ambience |
| `game/state.js` | Scores, unchanged 0.35-0.7 s combo windows, difficulty-driven rounds, 90% cleanliness completion and moth lifetime |
| `game/difficulty.js` | Session difficulty: dirt multiplier 0.40–1.25 and round duration 90–85 s, capped at carpet six |
| `carpet/types.js` | Flat-weave, wool, runner and 2.5 kg tapestry physical parameters; legacy type-bag helper |
| `game/progression.js` | Lifetime carpet totals and unlocked beater selection, persisted through guarded localStorage calls |
| `fx/dirtyHints.js` | Rising procedural motes in the remaining dirty zones above 85% cleanliness |
| `ui/hud.js` | Menu after physics readiness, scores, cleanliness, mute and round results |

## Physics

Each carpet owns a `btSoftRigidDynamicsWorld` with mesh-local positions. The image's short side spans the bar; the long side is bisected (u for landscape, v for portrait). Physical scaling preserves aspect while fitting a 2.4?3.2 m long dimension, additionally limited by twice the rack height minus ground clearance, cloth thickness and a motion reserve (see CORE.md). The even folding-axis grid wraps over a rounded crown with exact structural chord lengths, anchored every four nodes at its middle line. Both halves hang equally, with full continuous image UVs.

The structural material retains type stiffness and separate distance-two bending material. Bullet uses at least 24 position, 12 collision and 8 velocity iterations, SDF_RS, gravity 9.81 m/s? and two-sided aerodynamics. The static X-axis cylinder matches the visible 0.024 m radius pipe, with a 0.016 m collision margin and extents compensating for the pinned SDF's implicit-shape evaluation. Post-solve projection guarantees every node clears radius + 0.012 m carpet thickness, retains its topology-defined side at the crown and removes inward radial velocity while writing m_x and m_q. Speed limits before/after solving and attenuated crown hits protect against tunnelling. The rendered surface has a 0.006 m normal offset and standard depth testing. `docs/CORE.md` specifies flip handling and exact bounds.

The beater is a zero-mass kinematic rigid body with a compound of 32 overlapping spheres following the woven loop. Its pose is updated before each Bullet step. SDF_RS soft/rigid collisions and CCD are enabled. On the impact step, the ray supplies point/normal/UV and exactly one event. Registered rigid contact suppresses the fallback; because this Ammo build does not expose soft-body rcontacts, unconfirmed contacts receive a bounded localized velocity impulse as tunnelling insurance. Native collision response still runs.

Main accumulates 1/60 s steps, at most two per render, discarding excess catch-up after slow frames. Model animation and kinematic poses use the same clock. Node positions update in-place after each step; smooth normals and bounds refresh once per render. Geometry and position attribute identity remain stable. Carpet replacement tears down its entire physics world.

The bounded localized hit impulse is split between an initial 30% velocity kick and a 150 ms contact-force pulse carrying the remaining 70%. This keeps a dent readable around 100 ms instead of letting a single-step kick spring back immediately. Forces act on the original weighted node neighborhood, skip anchors, preserve total momentum across fixed steps away from speed limits and crown attenuation, and leave Bullet to propagate the wave and swing. At most eight pulses coexist during input bursts.

## Controls and hit integration

Hold the primary pointer button to wind back and up around an imaginary wrist, slightly right of the aim. Charge eases out over 0.6 s; full charge has a slight tremble and a thin cursor arc. Release locks the cursor ray and accelerates through an 85 ms strike, then rebounds and recovers by 280 ms. Strength is `0.25 + 0.75 * charge`. A 220 ms moderate hold plus recovery is a 500 ms cycle, inside the existing combo window. Full-charge cycles are intentionally slower. The loop flexes with a damped spring on impact. Pointer cancellation/blur cancels wind-up.

The beater's idle camera-relative distance is derived from model height to occupy roughly 30% of viewport height. Wind-up moves the head up-right toward the camera and partly above the frame. Four transparent, fading copies share the model geometry during the strike. New holds can interrupt recovery after contact dispatch, fixing dropped alternate presses in a 350 ms hold / 250 ms gap cadence. Rhythm remains timestamped at the actual impact callback, with the original 0.35–0.7 s window.

`Beater.interceptSwing(raycaster)` runs before carpet hit handling and preserves moth catching. `onMiss()` preserves combo misses. Hit events retain `{point,normal,uv,strength}` and add optional `physicalContact`. Main transforms hits into mesh-local physics coordinates, applies insurance only when needed, then cleans dirt, emits dust, plays the selected beater sound preset and updates Game once. Cleaning accepts normalized strength and the selected head radius. Input, physics contact and debug hits cannot clean or score outside play.

`window.__coverhit` retains live cloth/dirt getters, dust, game, `hit(u,v,strength=0.65)`, `start()` and render performance counters, plus `setBeater(id)`, `setCarpetType(id)`, live `beater`, `carpetType` and `progression`. Beater selection obeys unlocks. `createCarpet(seed,{map,...})` can borrow an arbitrary texture; its dirt overlay remains independent and disposal preserves the supplied texture. three r186 uses PCFShadowMap.

## Validation

The yard uses locally served CC0 Poly Haven assets in `public/yard/`, with a per-file inventory in `SOURCES.md`. `createYard` remains synchronous and works in Node with fallback materials; `loadYardAssets(yard,renderer,onProgress)` upgrades it before the menu appears. Each download has a 12-second timeout and an independent fallback. The 2k HDR drives both the visible background and PMREM environment; the actual brightest texel sets the directional sun elevation and hue, with matching background/environment rotation. World-size texture coordinates and a grass/asphalt color, roughness and normal splat avoid stretched scans. Static boxes, windows, garages and tree primitives use geometry/material instancing. A shared vertex uniform sways the trees without per-frame instance uploads. Contact AO decals and local window halos avoid full-screen SSAO/bloom passes. The dynamic 1024px shadow map covers the play area, and rack geometry shares its 2.0 m centreline and 0.024 m radius with the cloth collision contract. Revision 4 encloses the courtyard with rotated near housing and shared textured far boxes, keeping distant geometry out of the play-area shadow pass.

`node scripts/download-yard.mjs` regenerates the scanned textures and simplified, WebP-packed tree model; source geometry stays under ignored `artifacts/yard-source`. `node scripts/verify-yard.mjs` against Vite at port 5180 captures default, wider and garage views, records renderer/CPU/frame-interval counters, and blocks all public yard assets to verify successful fallback startup. `YARD_UNCAPPED=1` additionally measures without the headless browser's refresh cap. Reports include the actual GPU and browser flags; render submission timing is CPU time, not a GPU timer. No input or UI modules are changed by the yard integration.

`npm test` uses Node-only pure helpers (no WASM or WebGL), including physics parameters, falloff, charge strength and accelerated swing keyframes. Run `npm run build` for bundling. Browser verification must cover startup, repeated varied charges, finite cloth and recoil, console errors and performance. WASM binaries are served from `public/vendor/ammo/`; see that directory's README and license.

See CARPETS.md for per-file crop decisions, reproducible image generation, credits and browser evidence. The start menu awaits the first texture and shows credits for every manifest entry. Image cache owns museum textures; carpet replacement preserves them, and HMR disposes the cache.


Bar collision and crosswise fold regression evidence: `node scripts/verify-bar-clip.mjs`, `docs/qa/bar-clip/browser.json`, and `docs/qa/fold/crosswise.json`. The native contact probe compares SDF_RS on/off without post-solve projection.

The original anchors passed `disableCollisionBetweenLinkedBodies=true`, suppressing soft-body contact with the entire bar despite SDF_RS. Anchors now pass false. Browser probes verify both cases with projection disabled: contact responds with false and passes through with true.


## Render polish (2026-10-09; supersedes the single-shadow/no-postprocessing notes)

`scene/renderPipeline.js` owns one pmndrs EffectComposer (`postprocessing` exactly
6.39.5, compatible with three 0.186.1) and `n8ao` exactly 2.0.1. The renderer and
composer both disable MSAA; the chain is RenderPass ? N8AOPostPass ? thresholded
Bloom ? Neutral tone mapping ? procedural 16? warm-highlight/teal-shadow LUT and
subtle vignette ? SMAA/output. Separate passes preserve HDR bloom before tone
mapping and display grading afterward. No external LUT files are loaded.
Grass alpha-to-coverage is disabled with MSAA off, avoiding luminous card edges.
N8AO uses Medium samples, a 0.28 m radius and 1.1 intensity. Transparency-aware
rerenders are disabled to avoid extra scene submissions for dust and aim overlays;
opaque depth supplies courtyard contact AO. Carpet inner-layer/pipe AO remains.

CSM replaces the original sun's shadow map and lighting with three directional
cascades, split at 8 m / 40 m / 220 m, with 0.0015 m normal bias. Original custom
material hooks and program cache keys are retained for carpet AO, world-space
textures, grass and foliage animation. Distant facades use lit shadow-receiving
materials; billboard trees remain unshadowed. Dynamic material registration handles
carpet replacement, beater changes and trail clones, and removes disposed materials.

The HUD contract is `window.__coverhit.setQuality('high'|'medium'|'low')`, with a
live `quality` getter, guarded `coverhit-quality` localStorage persistence and a
`coverhit-quality` CustomEvent (`detail.level`, `detail.label`). Labels are
????????: ???????/???????/???????. High uses 3 ? 2048 shadows, full-resolution AO
and device pixel ratio capped at 1.5. Medium uses 3 ? 1536 shadows, half-resolution
AO and ratio capped at 1. Low uses one 1024 shadow, SMAA and tone mapping with AO,
bloom, LUT and vignette bypassed. After 120 rendered frames, a mean frame interval
above 20 ms automatically selects medium if still on high; an explicit setting
in that session prevents auto-overrides. Quality changes dispose previous shadow
maps and recompile CSM defines. Resize updates composer targets and CSM frustums.

`performance.gpuMs` measures the entire render pipeline through nonblocking
EXT_disjoint_timer_query_webgl2 queries; unsupported/disjoint readings are null.
`renderMs` measures CPU submission, `frameMs` measures total frame CPU work,
`intervalMs` is wall-clock frame spacing; draw calls/triangles include all shadow
and postprocessing passes. Run `node scripts/verify-polish.mjs` with Vite at 5180
(or POLISH_URL / CHROME_PATH overrides). Reports and ignored licensed captures
are in `docs/qa/polish/`.
