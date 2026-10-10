# Border audit

Widths are source-scale rectified pixels in L / R / T / B order. Mismatch is |a−b| / mean(a,b), L/R then T/B. RGB gradients in 41 perpendicular scanlines track independently reviewed source field boundaries (±8 px at 1600 px resolution); the median rejects motifs and pile noise. Search landmarks choose the same nested frame before and after. Missing originals are skipped. Disabled fragments have no enclosing border to measure.

| Carpet | Before L/R/T/B (px) | After L/R/T/B (px) | Before mismatch L/R, T/B | After mismatch L/R, T/B |
|---|---:|---:|---:|---:|
| 01 | 230.0 / 227.6 / 217.9 / 180.2 | 230.0 / 227.6 / 217.9 / 180.2 | 1.06% / 18.96% | 1.06% / 18.96% |
| 02 | 267.3 / 237.9 / 270.8 / 274.2 | 268.5 / 237.1 / 270.7 / 261.7 | 11.66% / 1.25% | 12.44% / 3.38% |
| 03 | 149.9 / 157.8 / 240.8 / 186.2 | 152.0 / 155.0 / 90.0 / 56.0 | 5.17% / 25.53% | 1.95% / 46.58% |
| 04 | 154.8 / 133.4 / 100.0 / 302.4 | 152.7 / 133.3 / 15.3 / 113.0 | 14.88% / 100.59% | 13.52% / 152.38% |
| 05 | 96.2 / 89.5 / 51.9 / 39.8 | 96.2 / 89.5 / 51.9 / 39.8 | 7.14% / 26.51% | 7.14% / 26.51% |
| 06 | 175.4 / 173.1 / 148.3 / 107.1 | 175.4 / 173.1 / 148.3 / 107.1 | 1.35% / 32.26% | 1.35% / 32.26% |
| 07 | 223.8 / 178.4 / 330.7 / 360.3 | 223.8 / 178.4 / 330.7 / 360.3 | 22.60% / 8.55% | 22.60% / 8.55% |
| 08 | 154.0 / 150.4 / 137.0 / 133.4 | 154.0 / 150.4 / 137.0 / 133.4 | 2.39% / 2.69% | 2.39% / 2.69% |
| 09 | 241.1 / 229.4 / 291.5 / 203.7 | 241.1 / 229.4 / 291.5 / 203.7 | 4.98% / 35.46% | 4.98% / 35.46% |
| 10 | 208.1 / 209.2 / 122.1 / 122.1 | 208.1 / 209.2 / 122.1 / 122.1 | 0.56% / 0.00% | 0.56% / 0.00% |
| envato-2K7L5EB | — | — | — | — |
| envato-6325SWE | 518.6 / 442.4 / 682.9 / 665.3 | 518.6 / 442.4 / 682.9 / 665.3 | 15.85% / 2.61% | 15.85% / 2.61% |
| envato-B7PV8QR | 387.8 / 369.9 / 441.7 / 423.8 | 387.8 / 369.9 / 441.7 / 423.8 | 4.72% / 4.14% | 4.72% / 4.14% |
| envato-EPRJ58X | 670.7 / 690.2 / 744.5 / 650.9 | 670.7 / 690.2 / 744.5 / 650.9 | 2.87% / 13.41% | 2.87% / 13.41% |
| envato-QSMGCAP | — | — | — | — |
| envato-RBFEDY2 | 259.2 / 364.8 / 316.7 / 468.3 | 178.8 / 180.4 / 137.3 / 137.3 | 33.85% / 38.63% | 0.89% / 0.00% |
| envato-T834FYR | 317.6 / 366.8 / 665.3 / 643.4 | 317.6 / 366.8 / 665.3 / 643.4 | 14.40% / 3.35% | 14.40% / 3.35% |

- **01**: Intact outer woven border. The original lower end frame is narrower than the upper frame; retain the handmade design.
- **02**: Displayed worn rug: side frames differ in the photograph. Bottom display-mat sliver removed; woven borders retained.
- **03**: Plain kilim extensions removed at both ends. The photographed patterned end frames themselves differ in width; side symmetry is 1.95%.
- **04**: Plain kilim extensions removed. The upper patterned frame is nearly absent in this worn asymmetric original; its lower frame survives. Equality would require deleting intact lower motifs.
- **05**: Intact outer border. Original end frames are narrower than side frames, with wear and small top/bottom differences.
- **06**: Intact outer border. The original upper patterned end frame is deeper than the lower one.
- **07**: Intact outer border and selvedge. Original side frame widths differ; field is off-centre in the weaving.
- **08**: Intact outer border. Small residual differences reflect non-straight woven edges and wear.
- **09**: Intact outer border. Upper woven edge bows downward in the middle; a four-corner crop retains that edge and some background rather than deleting its corners.
- **10**: Intact outer border: both opposing pairs already within 2%.
- **envato-2K7L5EB**: Disabled fragment: no complete enclosing border exists in source.
- **envato-6325SWE**: Frame fills source. Left and right patterned border widths already differ in the photograph; cropping the left edge would delete intact outer motifs.
- **envato-B7PV8QR**: Reviewed quad retains original outer frame. Small residual border differences exist in the photographed design.
- **envato-EPRJ58X**: Frame fills source. Original upper and lower blue floral bands differ in depth; no unused margin can be cropped to equalize them.
- **envato-QSMGCAP**: Disabled fragment: no complete enclosing border exists in source.
- **envato-RBFEDY2**: Retained complete inner frame meets 2% on both opposing pairs. The source clips the original outer motif frame at left/top, so preserving that entire frame is impossible.
- **envato-T834FYR**: Reviewed studio crop follows inner envelope of bowed woven edges, avoiding white slivers. The original left/right kilim side bands differ in width.

RBFEDY2 limitation: the source photograph already truncates the original outer motif border on its left and top. The crop retains the outermost complete inner frame. It cannot both preserve the full original outer border and meet the requested symmetry; those pixels are absent. Other residual mismatches include intrinsic hand weaving, bowed edges, and wear; borders are not repainted or independently stretched.
