| Device | CPU | FPS | Physics/game mean / p95 | Ammo | Post-solve* | Geometry | Flip contact* | Dust | Moths | Frame p95 / p99 | Dropped | Heap growth | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| iPhone 14 Pro | 1× | 29.99 | 5.69 / 7.70 | 2.25 | 1.13 | 1.04 | 0.06 | 0.00 | 0.02 | 10.30 / 12.10 | 0.06% | 454916 B | false |
| iPhone 14 Pro | 4× | 20.59 | 37.63 / 75.40 | 15.06 | 8.56 | 5.25 | 0.44 | 0.01 | 0.09 | 85.50 / 145.60 | 26.91% | 808684 B | false |
| iPhone 14 Pro | 6× | 2.09 | 454.95 / 685.80 | 205.34 | 119.60 | 15.02 | 5.43 | 0.02 | 0.27 | 701.10 / 800.70 | 93.04% | -114720 B | false |
| Pixel 7 | 1× | 29.99 | 5.63 / 7.80 | 2.29 | 1.07 | 0.99 | 0.06 | 0.00 | 0.01 | 10.30 / 12.40 | 0.22% | 1200244 B | false |
| Pixel 7 | 4× | 17.04 | 46.77 / 112.90 | 18.73 | 11.09 | 5.50 | 0.56 | 0.01 | 0.11 | 121.50 / 187.20 | 42.45% | 358612 B | false |
| Pixel 7 | 6× | 1.88 | 506.17 / 947.80 | 224.53 | 136.88 | 15.70 | 6.59 | 0.02 | 0.33 | 968.10 / 1616.60 | 93.73% | 903564 B | false |

*Post-solve timings include flip contact and nested clearance calls; do not add overlapping phases. Frame time is JS CPU, interval is wall time. Dropped frames are relative to the production 30 Hz phone cadence. Forced-GC retained JS heap includes QA wrappers and excludes preallocated typed sample storage; it is not an allocation-rate measurement.
