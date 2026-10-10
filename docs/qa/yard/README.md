# Courtyard visual and performance QA

Validated 2026-10-08 at 1440 × 900 in Chrome on NVIDIA RTX 2080 Ti / ANGLE D3D11.

- [Default fixed game view](default.png)
- [Wider courtyard view](wide.png)
- [Garages and Zhiguli view](garages.png)

The first visual pass was too dark and used a heavily cracked wall scan. The final pass uses weathered concrete, a sun rotated with the HDRI to illuminate the facade, a reduced tree LOD, less reflective irregular puddles and a car with wheel arches/chrome trim. Wider/garage cameras only change the existing debug camera fields in the QA browser page. The shipped game keeps its fixed camera.

## Measurement

The normal headless browser delivers a near-exact 31.25ms refresh interval (32 Hz) in this Windows session. This is not a 60fps validation by itself. [performance.json](performance.json) preserves that measurement: default CPU frame 17.10ms, default frame interval 31.25ms.

[performance-uncapped.json](performance-uncapped.json) disables frame rate limiting and GPU vsync, using the same scene and physics. Each view measures at least 180 frames and 3 seconds after settling. The uncapped default mean and p95 frame interval fit the 16.67ms target; the maximum is 20.20ms, so this is a target rather than a claim that every frame completes within 16.67ms. Rendering submission is CPU timing, not a GPU timer. Physics updates keep their existing 1/60s accumulator and can run zero, one or two steps per displayed frame. Draw calls include the dynamic directional shadow pass.

| View | Max calls | Mean CPU frame ms | Mean frame interval ms | p95 frame interval ms | Mean render submission ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| normal | 82 | 3.49 | 3.89 | 12.40 | 0.80 |
| wide | 81 | 3.13 | 3.51 | 11.70 | 0.76 |
| garages | 78 | 3.82 | 4.29 | 13.30 | 0.84 |

## Validation and decisions

- npm test: 20 test files / 137 tests passed, including the per-file sources/budget test and headless yard/bar geometry test.
- npm run build: passed.
- Browser: no page errors or renderer shader errors. All 20 external assets loaded.
- Deliberately aborting all public yard assets still starts a playing game with the exact [0,3.15,0] bar position.
- Shipped yard directory: 13,725,616 bytes including inventory/manifest, below the 20,000,000-byte limit. All external assets are CC0; textures are 1k and the HDR is 2k.
- Use instancing, a 1024px play-area shadow map, 1.5 maximum DPR, shared shader wind, ARM maps/contact AO decals and local window halos to meet the rendering budget. No full-screen SSAO or bloom pass.
- The tree is a generic deciduous CC0 scan rather than a species-authentic birch/poplar; the vehicle and courtyard props are locally built geometry.
- Carpet, beater and dust behaviour, bar collision dimensions and input/UI files remain unchanged.

Reproduce with Vite at port 5180: node scripts/verify-yard.mjs. Set YARD_UNCAPPED=1 for the uncapped report. CHROME_PATH and YARD_URL can override the browser and server. Rebuild source assets with node scripts/download-yard.mjs.

Unfinished: none within the requested scope. Performance evidence covers the GPU/resolution above, not every browser/device.
