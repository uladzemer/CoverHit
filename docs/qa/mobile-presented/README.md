# Canvas presentation regression

Build and preview with `COVERHIT_BASE=/CoverHit/`, then set `MOBILE_URL` to the
preview's `/CoverHit/` URL and run `npm run verify:canvas-presented` and
`npm run verify:mobile`. Screenshots use CSS pixels and hide HUD overlays during
measurement. PNGs are ignored; JSON reports record the measurements.

The DPR bisect is `node scripts/mobile-probes/bisect-resize.mjs`. Changing only
the output drawing buffer from 393x660 to 294x495 reproduced the salmon page:
central SD 3.74, body matches 99.01%, carpet/sky Delta E 0, green leakage 99.59%.
Both direct rendering and an opaque copy pass failed after that mutation.
`readPixels` still returned red values 0..201 (direct) / 0..196 (copy), with
GL error 0 and context loss false. The control without a resize stayed visible.
The fixed pipeline's minimal downgrade retains output 393x660 and instead
resizes the RGBA8 scene target; SD 38.84, body matches 1.00%, green leakage 0%.

WebKit checks after 15 seconds:

| Device | Profile | Luminance SD | Body % | Carpet/sky Delta E | Green % |
| --- | --- | ---: | ---: | ---: | ---: |
| iPhone 14 Pro | full | 37.47 | 0.00 | 36.65 | 0.00 |
| iPhone 14 Pro | lite | 37.12 | 0.51 | 44.02 | 0.00 |
| iPhone 14 Pro | minimal | 38.61 | 0.96 | 44.00 | 0.00 |
| iPhone 14 Pro | auto | 37.12 | 0.51 | 44.01 | 0.00 |
| iPhone SE | full | 36.78 | 0.00 | 36.69 | 0.00 |
| iPhone SE | lite | 37.22 | 0.48 | 44.17 | 0.00 |
| iPhone SE | minimal | 38.64 | 0.91 | 44.16 | 0.00 |
| iPhone SE | auto | 37.24 | 0.48 | 44.17 | 0.00 |

Live full -> lite -> minimal, automatic downgrade, and subsequent rotation all
passed with 0% green leakage. Lite mute/flip/menu touch buttons worked on both
phones. Deliberately hiding the canvas failed the checker on both phones,
including when the restored HUD was visible. Wool's alpha mask never reaches
the presented surface. The full composer implementation is unchanged.

The mobile scene target follows viewport and quality DPR, while the output
drawing buffer stays fixed. Rotation can soften the growing screen axis; camera
framing and touch coordinates follow the new viewport.

`verify-mobile.mjs`: 30/30 PASS (24 presented-canvas checks and 6 deliberate
context-loss recovery checks). All presented checks had 0% green leakage.

| Device | Orientation | Luminance SD range | Body % range | Carpet/sky Delta E range |
| --- | --- | ---: | ---: | ---: |
| iPhone 14 Pro | portrait | 36.87-38.64 | 0.49-0.97 | 44.03-44.09 |
| iPhone 14 Pro | landscape | 28.13-29.13 | 0.32-0.56 | 40.48-40.58 |
| iPhone SE | portrait | 37.06-38.65 | 0.47-0.90 | 44.17-44.23 |
| iPhone SE | landscape | 28.39-28.76 | 0.30-0.51 | 39.84-39.87 |
| Pixel 7 | portrait | 37.74-41.41 | 0.46-0.73 | 44.42-44.49 |
| Pixel 7 | landscape | 29.98-30.56 | 0.26-0.46 | 37.82-38.30 |

Desktop Chromium full at 1440x900: composer retained, luminance SD 37.03, body
matches 0.01%, carpet/sky Delta E 35.54, green leakage 0%. `npm test`: 53 files,
364 tests passed. Production build with `/CoverHit/` base passed.
