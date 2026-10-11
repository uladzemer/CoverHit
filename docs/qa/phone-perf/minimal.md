| Device | CPU | FPS | Physics/game mean / p95 | Ammo | Post-solve* | Geometry | Flip contact* | Dust | Moths | Frame p95 / p99 | Dropped | Heap growth | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| iPhone 14 Pro | 4× | 29.86 | 4.03 / 6.80 | 1.12 | 0.59 | 1.04 | 0.06 | 0.01 | 0.07 | 17.80 / 26.50 | 0.94% | 974076 B | false |
| Pixel 7 | 4× | 29.92 | 3.54 / 5.90 | 1.03 | 0.50 | 0.94 | 0.06 | 0.01 | 0.06 | 13.00 / 17.60 | 0.39% | 802764 B | false |

*Post-solve timings include flip contact and nested clearance calls; do not add overlapping phases. Frame time is JS CPU, interval is wall time. Dropped frames are relative to the production 30 Hz phone cadence. Forced-GC retained JS heap includes QA wrappers and excludes preallocated typed sample storage; it is not an allocation-rate measurement.
