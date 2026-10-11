| Device | CPU | FPS before → after | Physics/game mean before → after | Physics/game p95 before → after | JS frame p95 / p99 before → after | Heap growth before → after |
|---|---:|---:|---:|---:|---:|---:|
| iPhone 14 Pro | 1× | 29.99 → 30.01 | 5.69 → 1.17 ms | 7.70 → 1.80 ms | 10.30 / 12.10 → 4.00 / 5.40 ms | 454916 → -623784 B |
| iPhone 14 Pro | 4× | 20.59 → 29.94 | 37.63 → 7.25 ms | 75.40 → 11.80 ms | 85.50 / 145.60 → 25.70 / 33.10 ms | 808684 → -546996 B |
| iPhone 14 Pro | 6× | 2.09 → 29.48 | 454.95 → 8.78 ms | 685.80 → 16.10 ms | 701.10 / 800.70 → 32.50 / 41.70 ms | -114720 → 514784 B |
| Pixel 7 | 1× | 29.99 → 30.01 | 5.63 → 1.35 ms | 7.80 → 2.40 ms | 10.30 / 12.40 → 5.40 / 7.30 ms | 1200244 → -800404 B |
| Pixel 7 | 4× | 17.04 → 29.99 | 46.77 → 5.25 ms | 112.90 → 8.30 ms | 121.50 / 187.20 → 15.10 / 19.20 ms | 358612 → -214652 B |
| Pixel 7 | 6× | 1.88 → 29.95 | 506.17 → 7.78 ms | 947.80 → 12.30 ms | 968.10 / 1616.60 → 23.30 / 28.90 ms | 903564 → 480376 B |

Complete per-phase means: [before](before.md), [after](after.md). Minimal: [minimal](minimal.md). Acceptance and source hashes: [report](report.json).
