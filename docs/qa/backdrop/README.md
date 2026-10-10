# Soviet housing backdrop

The distant ring remains in the current [courtyard layout](../layout/README.md).
Coverage now includes the actual raised lawn, independent service/refuse pads,
sidewalk and access slabs as well as the large floor and far solids. The rack
and gameplay camera envelope remain fixed.

The courtyard now has a second, entirely local housing ring: five-storey
1-464 panel and 1-447 brick slabs, nine-storey II-49-like blocks with vertical
loggia stripes, two sixteen-storey P-44-like towers, a three-storey brick
school with a steel fence, and a red/white boiler-house chimney. An inner
96 m layer, overlapping 150 m perimeter and towers up to 192 m away give
streets and facade gaps several layers of depth. Birch/poplar rows stand
at 78, 124 and 170 m. The original enclosed courtyard remains in front.

Each building series has one deterministic startup canvas facade with all
its floors, panel seams/brickwork, recessed loggias and scattered warm lit
windows. Shared 12-triangle boxes preserve perspective. Tree species share
an atlas and crossed fixed cards; the vertex shader selects the atlas half
from instance width. Chimney stripe colours share one instanced batch.
The whole added ring costs **9 draws / 2,320 triangles**, including trees,
fence and chimney, and never enters the shadow pass. No stock photography,
external building assets or additional startup requests are required.

An analytic sky supplies a peach/pink horizon, violet upper sky, low sun
and broad glow behind the housing. The optional HDR supplies reflections;
its horizon sample is mixed with sunset peach for fog and sky colour.
Distance fog from 60?350 m, muted far facade colours, lower HDR intensity
and warm ambient light separate the layers. The sky sphere is 550 m,
the camera far clip is 600 m and the floor extends ?600 m.

## Verification and captures

`npm test`: **158 tests in 23 files pass**. `npm run build`: **passes**
with the existing three.js chunk-size advisory.

The new coverage regression casts screen rays against actual rendered far
solid meshes and the actual ground plane. A horizontal ray at the same
azimuth locates the far skyline. Sky is allowed only when the screen ray
passes above that building's roof; ground beyond the skyline is rejected.
An empty ring fails even when the large ground and sky remain. The unit
probe includes landscape, mobile and 75? wide FOV, ?35? yaw, a 2.22 m eye,
and ?1 m lateral displacement, conservatively covering camera movement.
The production aim moves the pointer/beater; flip does not move the camera.

Browser QA covers stock, procedural and all-optional-yard-assets-missing
startup, each at default, aim-left, aim-right, wide and mid-flip. It samples
81 ? 45 rays in each of the 15 views: **54,675 rays, zero gaps within 350 m**,
and zero page errors. Wide captures use 1920 ? 1080 / 75? FOV; default and
aim captures use 1468 ? 986 / 48? FOV. Screenshots are saved alongside this
README as `<mode>-<view>.png`. All PNGs here are ignored because local
licensed yard/carpet stock may appear even in procedural yard modes.

## Performance

155.0.8059.39; ANGLE (NVIDIA, NVIDIA GeForce RTX 2080 Ti (0x00001E07) Direct3D11 vs_5_0 ps_5_0, D3D11). Each view records 120 animation frames.
Counters include the whole scene and its shadow pass, not just the ring.

| Mode, default | Draw calls | Triangles | CPU frame mean / p95 | Render submission mean | Frame interval mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| stock | 128 | 554,677 | 18.06 / 24.10 ms | 1.57 ms | 31.25 ms |
| procedural | 103 | 335,244 | 16.74 / 22.30 ms | 1.12 ms | 31.25 ms |
| no-assets | 104 | 335,246 | 16.42 / 21.80 ms | 1.00 ms | 31.25 ms |

The maximum across every saved view is **138 draws**, below 140.
The stock wide view has 556,181 maximum triangles, 20.29 ms mean CPU frame,
22.20 ms p95 and a 440.60 ms maximum hitch (429.50 ms render submission).
The missing-assets wide view also has a 213.40 ms maximum hitch. These
hitches are retained in the report. CPU frame time includes physics and
render submission; it is not a GPU timer. Headless cadence is about 32 fps;
these results do not establish sustained 60 fps. Full distributions for
all views are in `performance.json`.

## Reproduction

Start Vite on 127.0.0.1:5178, then run `node scripts/verify-backdrop.mjs`.
Override YARD_URL or CHROME_PATH if needed. Restart Vite after edits inside
this worktree because its existing `.claude` watch exclusion hides changes.

## Decisions

- Use instanced solid boxes with local facade textures for stable perspective
  throughout the camera range; reserve alpha cards for far trees.
- Keep existing courtyard housing and add two overlapping distance layers,
  towers and community infrastructure behind it.
- Keep the HDR for reflections and use an explicit sunset sky/direct light
  to avoid depending on the optional HDR's solar elevation.
- Test geometry/skyline coverage within 350 m; extend ground and clipping
  while retaining the existing gameplay camera framing.
- Ignore licensed QA PNGs and retain reproducible scripts and JSON metrics.
