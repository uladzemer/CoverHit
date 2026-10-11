| Device | CPU | FPS | Physics/game mean / p95 | Ammo | Post-solve* | Geometry | Flip contact* | Dust | Moths | Frame p95 / p99 | Dropped | Heap growth | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| iPhone 14 Pro | 1× | 30.01 | 1.17 / 1.80 | 0.44 | 0.20 | 0.28 | 0.02 | 0.00 | 0.01 | 4.00 / 5.40 | 0.00% | -623784 B | true |
| iPhone 14 Pro | 4× | 29.94 | 7.25 / 11.80 | 2.41 | 1.45 | 1.73 | 0.16 | 0.01 | 0.08 | 25.70 / 33.10 | 0.33% | -546996 B | false |
| iPhone 14 Pro | 6× | 29.48 | 8.78 / 16.10 | 2.97 | 1.81 | 2.03 | 0.19 | 0.02 | 0.12 | 32.50 / 41.70 | 2.37% | 514784 B | false |
| Pixel 7 | 1× | 30.01 | 1.35 / 2.40 | 0.49 | 0.23 | 0.30 | 0.02 | 0.00 | 0.01 | 5.40 / 7.30 | 0.00% | -800404 B | true |
| Pixel 7 | 4× | 29.99 | 5.25 / 8.30 | 1.85 | 0.89 | 1.14 | 0.09 | 0.00 | 0.06 | 15.10 / 19.20 | 0.17% | -214652 B | false |
| Pixel 7 | 6× | 29.95 | 7.78 / 12.30 | 2.83 | 1.44 | 1.73 | 0.13 | 0.01 | 0.10 | 23.30 / 28.90 | 0.61% | 480376 B | false |

*Post-solve timings include flip contact and nested clearance calls; do not add overlapping phases. Frame time is JS CPU, interval is wall time. Dropped frames are relative to the production 30 Hz phone cadence. Forced-GC retained JS heap includes QA wrappers and excludes preallocated typed sample storage; it is not an allocation-rate measurement.
