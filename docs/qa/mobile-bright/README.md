# Phone brightness QA

Frozen default camera and clean cloth, iPhone 14 Pro WebKit, CSS screenshots. Source is the GPU-filtered scan at the same visible UVs; silhouette eroded by 2 CSS px. Luminance is mean Rec.709 sRGB (0–1). All screenshots remain locally in this folder (ignored because yard assets can be licensed).

| View | Profile | Rug | Before wool L | After wool L | Full wool L | Wool Δ full | Centre Δ full | Hue shift | Sat retention | Clipping |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 393×852 | lite | 03 | 0.0336 | 0.1245 | 0.1168 | 6.65% | -5.88% | 0.45° | 107.84% | 0.00% |
| 393×852 | lite | 05 | 0.0466 | 0.1953 | 0.1836 | 6.37% | -4.74% | 0.75° | 108.55% | 0.00% |
| 393×852 | lite | 09 | 0.0554 | 0.1930 | 0.1781 | 8.39% | -4.99% | 0.87° | 104.42% | 0.00% |
| 393×852 | minimal | 03 | 0.0345 | 0.1276 | 0.1168 | 9.27% | -2.22% | 0.28° | 107.84% | 0.00% |
| 393×852 | minimal | 05 | 0.0463 | 0.1958 | 0.1836 | 6.62% | -1.20% | 0.72° | 108.55% | 0.00% |
| 393×852 | minimal | 09 | 0.0569 | 0.2008 | 0.1781 | 12.76% | -1.55% | 0.60° | 109.40% | 0.00% |
| 852×393 | lite | 03 | 0.0335 | 0.1233 | 0.1156 | 6.61% | 7.54% | 0.42° | 107.76% | 0.00% |
| 852×393 | lite | 05 | 0.0469 | 0.1930 | 0.1818 | 6.18% | 6.89% | 0.77° | 108.64% | 0.00% |
| 852×393 | lite | 09 | 0.0555 | 0.1919 | 0.1760 | 9.01% | 7.43% | 0.91° | 104.06% | 0.00% |
| 852×393 | minimal | 03 | 0.0335 | 0.1245 | 0.1156 | 7.70% | 9.81% | 0.40° | 107.98% | 0.00% |
| 852×393 | minimal | 05 | 0.0465 | 0.1957 | 0.1818 | 7.66% | 8.32% | 0.72° | 108.54% | 0.00% |
| 852×393 | minimal | 09 | 0.0568 | 0.2004 | 0.1760 | 13.85% | 10.05% | 0.43° | 108.99% | 0.00% |

Desktop 1440×900 full profile: mean absolute channel-code screenshot difference (<0.5/255 acceptance):

- Rug 03: 0.2343/255; 0.6664% channels differ by >4.
- Rug 05: 0.2989/255; 0.8407% channels differ by >4.
- Rug 09: 0.1344/255; 0.3284% channels differ by >4.

Decisions: use museum 03/05/09 (phone profiles exclude personal stock); preserve wool alpha as a grade mask; +10% final saturation; scene exposure 0.4, shadow lift 0.006, contrast 1.04, gamma 1.0. No composer, IBL, PMREM, AO bake or additional texture; ambient and a nonshadowing bounce supplement the existing hemisphere/sun. Shadow intensity 0.4.

The locally present red medallion B7PV8QR is also checked, using a QA-only replacement of museum slot 01 in the intercepted manifest. Production phone downloads still exclude personal stock; no private asset is committed. The three museum carpets above retain true before/after evidence.

| Local red view | Profile | Wool L | Full wool Δ | Centre Δ | Hue shift | Sat retention | Clipping |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 393×852 | lite | 0.4141 | 6.89% | -3.83% | 0.22° | 108.75% | 0.00% |
| 393×852 | minimal | 0.4216 | 8.85% | -0.48% | 0.35° | 108.59% | 0.00% |
| 852×393 | lite | 0.4100 | 7.16% | 7.16% | 0.20° | 108.77% | 0.00% |
| 852×393 | minimal | 0.4143 | 8.27% | 8.93% | 0.20° | 108.83% | 0.00% |
