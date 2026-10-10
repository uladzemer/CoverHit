# Render and beater polish QA - 2026-10-09

Validated in hardware-backed headless Chrome at 1468 x 986, device pixel ratio 1.
GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 2080 Ti (0x00001E07) Direct3D11 vs_5_0 ps_5_0, D3D11).

Run `node scripts/verify-polish.mjs` against Vite at port 5180. Optional environment
overrides: `POLISH_URL` and `CHROME_PATH`. Playwright is resolved from the installed
package or the existing local npm cache. No browser flags disable GPU acceleration.

| Quality | Draw calls (mean) | GPU ms (mean / p95) | CPU frame ms (mean / p95) | Physics ms (mean) | Render submit ms (mean) |
| --- | ---: | ---: | ---: | ---: | ---: |
| high | 308.3 | 14.22 / 14.91 | 24.85 / 36.30 | 17.30 | 6.42 |
| medium | 306.0 | 10.10 / 15.70 | 24.90 / 39.90 | 19.59 | 3.99 |
| low | 162.8 | 11.52 / 16.64 | 24.57 / 42.40 | 18.92 | 4.45 |

GPU time is EXT_disjoint_timer_query_webgl2 elapsed time around the entire
composer, including shadows. CPU time includes gameplay and Bullet physics; render
submit time is CPU work only. Counts sum every shadow, scene and fullscreen draw.
180 live-play frames were sampled per quality after warm-up. Refresh spacing is
roughly 31 ms in this headless run. This is not evidence of sustained 60 fps.
Physics is the dominant CPU cost and was kept outside this render-only task.
Low GPU mean was higher than medium in this run despite half the draw calls;
host contention, clock changes and scene activity make this a measurement, not
a monotonic hardware performance guarantee. See performance.json for all samples
and the automatic medium selection, persisted quality and pose assertions.

## Decisions

- Pin postprocessing 6.39.5 (peer three >=0.168 <0.187) and n8ao 2.0.1.
- Select Neutral at exposure 1.02: default-view AgX softened the red carpet and
  made sunset/windows less warm; ACES compressed bright window colours more.
  Captures: tone-agx.png, tone-neutral.png, tone-aces_filmic.png.
- Use a procedural 16-cubed LUT after tone mapping, in linear input space, with
  gentle warm highlights and teal shadows. No external LUT assets.
- Keep Medium N8AO samples, full resolution on high, half resolution on medium.
  Radius 0.28 m, intensity 1.1. Bypass transparent-object rerenders to preserve
  the budget; carpet inner-layer/pipe AO and transparent dust remain intact.
- Use CSM 8 / 40 / 220 m splits; 2048 high and 1536 medium maps. Low has one
  1024 map and SMAA with final tone mapping, bypassing AO/bloom/grade/vignette.
- Disable alpha-to-coverage on grass with MSAA off; SMAA handles the edges.
- Close loop curves without duplicate endpoints and close transported tube
  frames. Remove bamboo tube flattening, narrow Sonne/rattan for visible width
  (including reeds), and retain physical 10 x 4 mm molded plastic ribbon sections.
  Object and swing scale were already uniform; tests now enforce it for all tools.
- Use documented historical width/length ratios for Soviet/rattan/Sonne.
  BEATERS.md explicitly records procedural reference widths for the three models
  whose source descriptions only specify total length; tests enforce +/-10%.
- Slightly oxidized steel uses metalness 0.85 for readable shadowed strands.
- Preserve all UI code; provide quality labels, getter, setter and a change event.
- Ignore every QA PNG because local licensed carpet/yard stock can appear.

## Evidence

`before.png` was captured before the pipeline change with the original ACES
renderer. `after.png` and high.png show the finished default view. medium.png and
low.png show the other tiers. beater-<id>-idle/charging/strike.png covers all six
models, carousel.png shows the game selection screen, beaters-preview.png shows
all six models on beaters.html, and mobile.png covers resize/portrait rendering.
Before and after use the same default carpet/camera and viewport; cloth, UI timer
and ambient motion are live, so individual pixels are not deterministic.

Browser QA: no page/console errors; MSAA=0 at all levels; invalid levels rejected;
quality survives reload; all 18 captured poses have uniform world matrix scale;
all six preview models load. npm test: 217 tests in 28 files pass. npm run build
passes; Vite retains its non-fatal >500 kB chunk warning.

Library references: [pmndrs postprocessing](https://github.com/pmndrs/postprocessing),
[N8AO](https://github.com/N8python/n8ao),
[three CSM](https://threejs.org/docs/#CSM).
