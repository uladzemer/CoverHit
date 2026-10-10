# Courtyard ground and nearby dressing

The placement map below records the earlier ground revision. The current
service pad, frontage driveway and shortcut layout is documented in
[layout QA](../layout/README.md); grass scans, raised soil and sandbox assets
are retained.

The former beige terrain is replaced by raised summer lawns using Poly Haven's
[Leafy Grass](https://polyhaven.com/a/leafy_grass), CC0 diffuse/normal/ARM maps at
3 m world-space tiling. A rotated secondary sample and broad colour modulation
break repetition. The scan is tinted green-yellow in the material; the shipped
maps remain unmodified. The seven PBR surfaces still require 21 maps plus one
HDR, with no additional startup requests. Provenance is in
`public/yard/SOURCES.md` and `manifest.json`; retired Sparse Grass maps are removed.

Lawns sit 9 cm above grey asphalt. Concrete curb stones separate the central
walk, cross street and garage apron. Grass blends into a narrow soil lip at the
curbs. A roughly 90 cm diagonal worn shortcut runs from (-4.1, -3) to
(-19, -14.3), with feathered, irregular edges and pedestrian curb openings.
Its earth surface reuses the sand scan with a dirt tint inside the lawn shader.
There are no separate path decals.

Short crossed grass clumps have their roots buried 14 mm in the lawn. Their
soft alpha uses antialiasing coverage; tips sway while roots stay fixed. Clumps
concentrate at curbs and fences, and are excluded from asphalt, the shortcut,
sandpit and playground equipment. They do not cast dark card shadows.

The sandpit is a square timber box, 30 cm above lawn level, with two courses of
painted boards, 34 cm wide ochre seat planks, green walls and pale textured sand.
It was moved left to clear the low green pipe half-hoops along the lawn edge.
Neutral sky/ground bounce replaces pink ambient lighting; the low warm sun,
sunset sky and distance fog remain. Fog begins at 60 m and does not colour the
near-camera ground.

## Nearby object audit

Default, left and right inspection covers the objects within 25 m of the eye.

| Object | Result |
| --- | --- |
| Lawn, shortcut, asphalt | Separate heights/materials, curb openings, no scattered field cards or grass on roads |
| Sandpit and lawn fence | Pale infill, broad wooden seats, clear fence gap; bounds regression prevents intersections |
| Front bench and litter bin | Moved fully onto lawn; stock bench placement moved too |
| Trees and stock tree guards | Trunks meet the soil; surrounding concrete tree guards remain recognizable |
| Rocket slide, ladder and swing | Retained recognizable steel playground silhouettes; grass excluded from play footprints |
| Clothesline and laundry | Retained posts, sagging lines and attached cloth |
| Rack and footings | Human-height carpet rack preserved |
| Manhole, repairs and puddles | Retained on asphalt; puddle moved off lawn; contact shading follows ground height |
| Zigzag raised cracks and square fallen-leaf cards | Removed; the asphalt scan supplies its own surface wear |
| Car, garages, lamp and bins toward the back | Retained readable silhouettes and road/apron placement |

## Verification and screenshots

`npm test`: **179 tests in 25 files pass**. `npm run build`: **passes**, with the
existing three.js chunk-size advisory. New geometry checks verify grass roots,
road/path/sandpit exclusion, sandpit height, seat width and fence clearance.

Start Vite on 127.0.0.1:5178 and run `node scripts/verify-ground.mjs`.
Restart Vite after scene edits because this worktree is under its `.claude`
watch exclusion. `YARD_URL` and `CHROME_PATH` can override defaults.

The browser checks stock, procedural and all-yard-assets-missing modes at
1468 × 986 and 48° FOV, with default and ±35° yaw views. Pointer aim in the
game does not rotate the camera, so QA rotates the shared look target to
inspect far left/right while keeping the original eye position and pitch.
Each view samples 120 frames. All nine views pass the 10% draw/triangle
regression limit; no page or shader errors occur. Stock/procedural modes load
all 22 optional surface/HDR assets; missing-assets mode remains playable.

Files are `<mode>-default.png`, `<mode>-aim-left.png`, `<mode>-aim-right.png`
and an additional `<mode>-sandbox-detail.png`. Baseline images have a
`before-` prefix. All PNGs are gitignored because licensed carpet/yard stock
may appear. Baseline counters and final distributions are retained in
`baseline.json` and `performance.json`.

## Performance

Chrome 155.0.8059.39, headless on the same machine before and after. Counters
include the whole game scene and shadow pass. This table is the default view;
the JSON contains all nine measured views and CPU/submission timing.

| Mode | Draw calls before → after | Triangles before → after |
| --- | ---: | ---: |
| Stock | 128 → 133 (+3.91%) | 554,677 → 536,009 (-3.37%) |
| Procedural | 103 → 108 (+4.85%) | 335,244 → 316,576 (-5.57%) |
| No assets | 104 → 108 (+3.85%) | 335,246 → 316,576 (-5.57%) |

Worst draw-call increase across matched views is **5.38%** (procedural left).
Triangles decrease in every view, by **3.37–5.81%**. Maximum final counters
are **133 draws / 536,009 triangles**. Frame timing is a headless CPU measure,
not a GPU timer or a claim of sustained 60 fps.

## Decisions

- Keep one CC0 grass scan at 3 m scale and reuse the existing sand scan for dirt.
- Use raised geometry and concrete curbs for the road/lawn boundary.
- Concentrate rooted grass at edges; remove ambiguous raised debris.
- Use a low square timber sandpit with ochre seats and green half-hoop fences.
- Keep the sunset sky/direct sun and neutralize near-ground ambient light.
- Preserve gameplay framing; turn the camera only in the inspection script.
- Ignore licensed screenshots while retaining reproducible QA and metrics.
