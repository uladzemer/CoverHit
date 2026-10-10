# Photos stream verification

The civilian-paint / exposure follow-up supersedes this report's livery,
window-light and colour limitations. See [../exposure/README.md](../exposure/README.md)
for normalized atlas measurements, reference provenance and acceptance results.

Resumed and completed the existing photo-assets implementation. The owner-visible change is three proportioned, photograph-projected Zhiguli and five photographic wall families across near housing and the distant box impostors. Missing photos preserve the procedural car and windows; missing all yard assets still starts the game.

## Evidence

`npm test`: **256 tests passed, 35 files**. Photo tests cover inventory/attribution schema, dimensions, complete car triangle count, metre UVs, synthetic glass-mask cleanup, homography and degenerate corners, Node fallback and texture memory. `npm run build` passed; its existing chunk-size advisory remains. `git diff --check` passed.

Run `npm run dev -- --host 127.0.0.1 --port 5183`, then `node docs/qa/photos/verify.mjs`. Optional `PHOTOS_URL` and `CHROME_PATH` override the defaults. The probe blocks yard stock and the local carpet manifest, so the eight PNGs contain no Envato assets. Screenshots: `photos-default.png`, `photos-aim-left.png`, `photos-aim-right.png`, `photos-wide.png`, `photos-car-close.png`, `photos-facade-close.png`, `fallback-default.png`, `missing-default.png`. Left/right captures inspect a conservative ±35° camera yaw; ordinary in-game aiming moves the beater without moving the camera.

Browser: Chrome 155.0.8059.39, headless, ANGLE / Direct3D11 / **NVIDIA RTX 2080 Ti**. Viewport 1468×986. [performance.json](performance.json) retains full statistics and quality switches; no page or shader errors occurred in any mode. All photo materials loaded in photo mode, and none loaded in either blocked mode.

Warmed High default view, 120 frames each:

| Mode | Draws | Triangles | CPU submission mean | Whole frame CPU mean | GPU mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| Photos | 119 | 328,502 | 1.536 ms | 7.730 ms | 7.299 ms |
| Photos missing, ordinary yard assets | 124 | 386,304 | 1.568 ms | 7.623 ms | 6.778 ms |
| All optional yard assets missing | 124 | 386,304 | 1.420 ms | 7.686 ms | 7.345 ms |

The matched default difference is -5 draws, -57,802 triangles, -0.033 ms CPU submission, +0.107 ms total CPU and +0.521 ms GPU. The GPU delta is marginally above the requested 0.5 ms guard in this one view; this run alone cannot certify that guard on every view/device. Physics code and runtime body count are unchanged.

All quality levels satisfy the geometry budget. Photo draws/triangles are High **119 / 328,502**, Medium **120 / 328,503**, Low **73 / 199,406**. Their fallback counterparts are **124 / 386,304**, **125 / 386,305**, **78 / 257,208**. Paired photo/fallback total CPU means were High 7.480 / 7.809 ms, Medium 7.962 / 7.973 ms, Low 7.419 / 7.446 ms. Paired GPU means were High 7.825 / 7.726 ms, Medium 7.238 / 6.986 ms, Low 5.303 / 6.055 ms: differences +0.099, +0.252 and -0.752 ms. Medium retained a 135.870 ms GPU query and 3,866.9 ms interval during shader compilation; missing-assets Medium also retained a 1,873.093 ms GPU query and 3,317 ms interval. These transition outliers are preserved, and are not stable draw-frame costs.

## Assets and implementation decisions

[assets.json](assets.json): **1,072,800 bytes** delivered, **22,020,096 bytes** estimated GPU texture storage including RGBA8 mipmaps (about 21 MiB). Five 1024×512 albedos, fifteen 256×256 detail/mask maps and one 1024×512 car atlas are shared through the texture cache; reference photographs are not uploaded. The **2,312-triangle car uses two material draws**, shared across all three cars. Body dimensions are 4.17×1.61×1.40 m; wheel centres are 2.42 m apart; the underside is 0.17 m clear of the ground. Hardware makes the overall bumper extents slightly larger, still within 3%.

Decisions: retain cached Commons originals and verified licences; use the 2101 side/matching front plus a rectified 2106 rear as a hybrid Zhiguli; use procedural lathed tyres/rims and chrome hardware; tint pale paint while preserving dark glass; use mirrored opposite-side projection with a narrow shader fade into sampled paint at the fender edges; keep reference-only originals small; process facade crops at full original resolution; repeat upright floors at 2.7 m and bays at 3.0–3.2 m; share those same photo atlases on twelve-triangle distant boxes instead of allocating separate bake render targets. Existing entrances, roof details and broad rain streaks remain; successful loads hide procedural window duplicates and balconies already present in the brick photograph. Photo loading completes before static-batch merging through the minimal yard.js wrapper.

Credits to integrate from this stream: **public/yard/photos/credits.json** (`title`, `author`, `url`, `license`). Every delivered file is inventoried in public/yard/SOURCES.md; [provenance-verification.json](provenance-verification.json) verifies twelve source licences/URLs against the live Commons API. The append section has end markers so future regeneration preserves later streams' provenance.

## Files and remaining limits

New: src/scene/yard/car.js; src/scene/yard/facade.js; scripts/download-yard-photos.mjs; tests/yardPhotos.test.js; public/yard/photos/*; docs/research/photos.md; docs/qa/photos/*.

Edited: src/scene/yard/buildings.js (photo wall materials/UVs and duplicate-window tags); src/scene/yard/backdrop.js (photo impostor materials/UVs); src/scene/yard/props.js (car factory call); src/scene/yard.js (await loads before optimization and pass root); public/yard/SOURCES.md (photo section); .gitignore (explicit stock-containing photo capture patterns). The pre-existing public/carpets/manifest.json working-tree flag was present on resume; no carpet source was edited. The common build regenerates carpet output as usual.

Unfinished exact-spec limits: the whole application still exceeds **6 ms total CPU/frame**, including in the procedural fallback; addressing that would require work outside this stream. Quality-switch compilation stalls and the marginal +0.521 ms default-view GPU delta need further controlled pipeline-level profiling. Photographs form a hybrid 2101/2106 and mirrored side lettering is visible close up; this is not an exact same-vehicle three-view reconstruction. Exterior illumination is normalized with bounded blurred-luminance correction, not a complete inverse-lighting reconstruction. Distant boxes share processed photographic atlases rather than a newly rendered full-building impostor bake. Source building series labels are visual game variants, not certified classifications. Stock-enabled final integration/credits and screenshots are for the architect/UI stream to verify after merging.

No commits, stash, branch changes or git writes were performed.
