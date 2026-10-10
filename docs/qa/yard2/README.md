# Courtyard revision QA

Verified 2026-10-08 in real hardware Chrome at 1468 x 986, NVIDIA GeForce RTX 2080 Ti / ANGLE Direct3D11; no SwiftShader flags. Raw 180-frame samples per view and browser errors are in performance.json.

| View | Max calls | Max triangles | Mean CPU frame | Mean frame interval |
| --- | ---: | ---: | ---: | ---: |
| Default | 93 | 281,238 | 18.65 ms | 31.25 ms |
| Wide | 101 | 286,032 | 23.53 ms | 33.51 ms |
| Garages | 84 | 251,376 | 21.62 ms | 31.25 ms |

The measured rate is about 30-32 fps in this browser session; these are observed frame intervals, not an uncapped GPU throughput claim. Cloth physics accounts for most measured CPU time. Vegetation geometry is 19,740 triangles (12,000 foliage cards, 1,500 grass cards, 6,240 trunks/branches), below 200k. public/yard totals 11,734,207 bytes including attribution and manifest.

22/22 external assets loaded; zero browser errors. Blocking every yard download still starts a playable fallback with the original collision bar. npm test: 21 files / 142 tests passed. npm run build passed.

Reticle snapshots use real mouse holds. Only beater integration is temporarily frozen when each time threshold is reached, so screenshot transport cannot advance the arc beyond the measured hold. At 156 ms: charge 0.453, arc 2.844 radians; at 406 ms: charge 0.896, arc 5.628 radians. Both surface reticles are visible, depthTest=false, renderOrder=10000. Screenshots include default.png, wide.png, garages.png, reticle-150ms.png and reticle-mid-charge.png.

Decisions: rear block uses 1-464 panel bays, left block uses 1-447-inspired pale silicate brick. Poly Haven Concrete Wall 008 and Brick Wall 13 use 1k PBR maps; brick diffuse is neutralized and lifted rather than introducing red brick. Existing Industrial Sunset 02 HDR remains both background and environment, rotated to put its low solar glow behind-left. Pale fill light preserves carpet saturation. Car uses bevelled side-profile body and trapezoidal glasshouse because no suitable photoreal CC0 1970s sedan was found in reviewed catalogs. Dense locally generated birch/poplar foliage replaces the sparse downloaded tree; local alpha atlases keep vegetation inexpensive. Corrugations, chain links, furniture and ground detail use shared instanced batches. Ring geometry grows 30%; charge uses a thicker amber arc without tone mapping; HUD separator uses the middle dot.

Visual review: this is a more plausible Soviet courtyard with sunset sky, weathered facades and dense trees, but it remains a constructed real-time scene; the car, repeated windows and ground cover still show CG cues. The screenshots document that limitation rather than claiming photographic equivalence.
