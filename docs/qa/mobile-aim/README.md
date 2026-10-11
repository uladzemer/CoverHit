# Touch aim QA

Actual Chromium CDP touches and WebKit hasTouch taps, 3×3 grid over real rug 05. Hit event is dispatched through the beater; projection uses the canvas CSS rect. WebKit rounds tap coordinates to integral CSS pixels. Screenshots are stored locally in this folder.

| Engine | Viewport | DPR | Profile | Max hit error (px) | Max reticle error (px) | Max head target error (px) |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| chromium | 320×568 | 2 | lite | 0.0109 | 0.0000 | 0.0109 |
| chromium | 320×568 | 2 | minimal | 0.0109 | 0.0000 | 0.0109 |
| chromium | 393×852 | 3 | lite | 0.0101 | 0.0000 | 0.0101 |
| chromium | 393×852 | 3 | minimal | 0.0101 | 0.0000 | 0.0101 |
| chromium | 430×932 | 3 | lite | 0.0111 | 0.0000 | 0.0111 |
| chromium | 430×932 | 3 | minimal | 0.0111 | 0.0000 | 0.0111 |
| chromium | 844×390 | 2 | lite | 0.0414 | 0.0000 | 0.0414 |
| chromium | 844×390 | 2 | minimal | 0.0414 | 0.0000 | 0.0414 |
| webkit | 320×568 | 2 | lite | 1.0578 | 1.0543 | 1.0578 |
| webkit | 320×568 | 2 | minimal | 1.0578 | 1.0543 | 1.0578 |
| webkit | 393×852 | 3 | lite | 1.3222 | 1.3245 | 1.3222 |
| webkit | 393×852 | 3 | minimal | 1.3222 | 1.3245 | 1.3222 |
| webkit | 430×932 | 3 | lite | 1.2868 | 1.2884 | 1.2868 |
| webkit | 430×932 | 3 | minimal | 1.2868 | 1.2884 | 1.2868 |
| webkit | 844×390 | 2 | lite | 1.2019 | 1.1898 | 1.2019 |
| webkit | 844×390 | 2 | minimal | 1.2019 | 1.1898 | 1.2019 |

Unit tests cover DPR 2/3, target pixel ratio 0.75/1, viewport offsets 0/48, inset/letterboxed canvas and all four viewports (288 ray round trips). Browser checks also verify the menu setting changes the offset to −40 and saves it, then restores zero. Default client coordinates and DOM rect already share the layout viewport; adding visualViewport offsets twice would create an error. Camera and render target follow that same rect; the fixed WebKit output buffer is retained through rotation.
