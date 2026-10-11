Phone dust retune verification, 2026-10-11.

WebKit / Playwright iPhone 14 Pro (393 x 852 portrait, 852 x 393 landscape),
iPhone SE (320 x 568 portrait, 568 x 320 landscape), and desktop full profile
(1440 x 900). These are browser device emulations.

Each scenario starts with a fully dirty carpet. Four full-strength strikes occur
at -1.5, -1.0, -0.5 and 0 seconds; the single-strike scenario hits at 0 seconds.
Table times are seconds after the last strike. Camera, cloth, and game animation
are frozen to isolate dust. Every screenshot is paired with the identical render
with only the dust group hidden. Screenshots use CSS pixels.

The probe now chooses points on the visible folded panel and asserts that every
strike removes dirt. The old centre-crossing points could strike the hidden half
and silently emit no dust. Both HEAD baseline and retuned captures use the
corrected scenario; this explains why the new HEAD four-strike baseline is about
4% rather than the previous report's 2.85%.

Viewport change counts pixels with any RGB channel difference > 3/255.
Pattern retention is the luminance regression slope against the paired no-dust
carpet rectangle: covariance(dust, reference) / variance(reference). This
excludes uncorrelated bright cloud edges that can inflate a plain luminance SD
ratio. The JSON retains both original SD ratios as separate measurements.

Peak sampling occurs every 0.25 seconds during the four-strike sequence, then
at 0.15 / 0.3 / 0.45 / 0.6 / 0.75 / 1 / 1.25 / 1.5 / 2 / 3 / 4 seconds.
The peak table includes the entire strike sequence. Portrait peaks occur just
before the fourth strike; all post-fourth-strike peaks also meet the requested
portrait range. The runtime alpha-area budget still runs on every draw.

Peak measurements (viewport change and paired pattern retention):

| Device / orientation | Strikes | HEAD peak % | Retuned peak % | Peak t (s) | Pattern retained % |
|---|---:|---:|---:|---:|---:|
| iPhone 14 Pro / portrait | 1 | 2.29 | 9.22 | 0.6 | 86.98 |
| iPhone 14 Pro / portrait | 4 | 4.00 | 12.90 | -0.25 | 71.42 |
| iPhone 14 Pro / landscape | 1 | 2.01 | 11.33 | 0.75 | 84.78 |
| iPhone 14 Pro / landscape | 4 | 4.14 | 13.40 | 0.3 | 74.22 |
| iPhone SE / portrait | 1 | 2.15 | 8.65 | 0.6 | 87.10 |
| iPhone SE / portrait | 4 | 3.75 | 12.14 | -0.25 | 72.49 |
| iPhone SE / landscape | 1 | 1.81 | 11.52 | 0.75 | 84.54 |
| iPhone SE / landscape | 4 | 4.03 | 13.80 | 0.3 | 73.83 |

Four strikes. Each cell is viewport changed % / paired pattern retained %.

| Device / orientation | 0.15 s | 0.3 s | 0.6 s | 1.0 s | 2.0 s | 3.0 s |
|---|---:|---:|---:|---:|---:|---:|
| iPhone 14 Pro / portrait | 12.31 / 70.33 | 11.38 / 72.32 | 8.65 / 77.10 | 5.24 / 87.95 | 0.23 / 99.62 | 0.16 / 99.84 |
| iPhone 14 Pro / landscape | 13.33 / 72.74 | 13.40 / 74.22 | 10.37 / 79.89 | 5.77 / 90.68 | 0.26 / 99.59 | 0.19 / 99.82 |
| iPhone SE / portrait | 11.55 / 71.45 | 10.73 / 73.43 | 8.11 / 77.81 | 5.02 / 88.35 | 0.20 / 99.64 | 0.16 / 99.82 |
| iPhone SE / landscape | 13.76 / 72.51 | 13.80 / 73.83 | 10.98 / 79.55 | 6.04 / 90.48 | 0.29 / 99.58 | 0.21 / 99.81 |

Single strike. Each cell is viewport changed % / paired pattern retained %.

| Device / orientation | 0.15 s | 0.3 s | 0.6 s | 1.0 s | 2.0 s | 3.0 s |
|---|---:|---:|---:|---:|---:|---:|
| iPhone 14 Pro / portrait | 8.45 / 79.82 | 8.93 / 81.95 | 9.22 / 86.98 | 7.86 / 93.44 | 0.09 / 99.80 | 0.09 / 99.88 |
| iPhone 14 Pro / landscape | 7.91 / 81.28 | 8.88 / 81.07 | 11.07 / 82.65 | 10.44 / 89.32 | 0.10 / 99.82 | 0.10 / 99.90 |
| iPhone SE / portrait | 7.96 / 79.93 | 8.42 / 82.01 | 8.65 / 87.10 | 7.42 / 93.54 | 0.08 / 99.79 | 0.08 / 99.88 |
| iPhone SE / landscape | 7.93 / 80.97 | 8.92 / 80.78 | 11.24 / 82.35 | 10.51 / 89.09 | 0.10 / 99.80 | 0.11 / 99.86 |

All phone thresholds pass. Across both scenarios, maximum viewport change is
10.51% at 1 second, 0.29% at 2 seconds, and 0.21% at 3 seconds.
Minimum pattern retention is 71.42% at peak, 87.95% at 1 second, and
99.58% at 2 seconds. Motes remain at 4 seconds with at most 0.07% viewport
change; clouds expire within 1.8 seconds and motes live 3-5 seconds.

Desktop default screenshot difference is 0%. Every desktop dust scenario row
also matches HEAD exactly. `npm test`: 54 files / 403 tests pass.
`npm run build`: passes (existing chunk-size advisory).

Complete tables: [HEAD baseline](before-report.json), [retuned](after-report.json).

Matched before/after screenshots:

| Device / orientation | Strikes / time | HEAD | Retuned |
|---|---|---|---|
| iPhone 14 Pro / portrait | 1 / 0.3 s | [Before](before-iPhone-14-Pro-portrait-single-0.3s.png) | [After](after-iPhone-14-Pro-portrait-single-0.3s.png) |
| iPhone 14 Pro / portrait | 4 / 0.3 s | [Before](before-iPhone-14-Pro-portrait-0.3s.png) | [After](after-iPhone-14-Pro-portrait-0.3s.png) |
| iPhone 14 Pro / landscape | 1 / 0.3 s | [Before](before-iPhone-14-Pro-landscape-single-0.3s.png) | [After](after-iPhone-14-Pro-landscape-single-0.3s.png) |
| iPhone 14 Pro / landscape | 4 / 0.3 s | [Before](before-iPhone-14-Pro-landscape-0.3s.png) | [After](after-iPhone-14-Pro-landscape-0.3s.png) |
| iPhone SE / portrait | 1 / 0.3 s | [Before](before-iPhone-SE-portrait-single-0.3s.png) | [After](after-iPhone-SE-portrait-single-0.3s.png) |
| iPhone SE / portrait | 4 / 0.3 s | [Before](before-iPhone-SE-portrait-0.3s.png) | [After](after-iPhone-SE-portrait-0.3s.png) |
| iPhone SE / landscape | 1 / 0.3 s | [Before](before-iPhone-SE-landscape-single-0.3s.png) | [After](after-iPhone-SE-landscape-single-0.3s.png) |
| iPhone SE / landscape | 4 / 0.3 s | [Before](before-iPhone-SE-landscape-0.3s.png) | [After](after-iPhone-SE-landscape-0.3s.png) |
| Desktop / landscape | Default | [Before](before-Desktop-landscape-default.png) | [After](after-Desktop-landscape-default.png) |

Each device/scenario also has `*-peak.png` and paired `*-no-dust.png` references
for every saved time. PNGs remain ignored by the existing `docs/qa/**/*.png` rule.

To reproduce, start `npm run dev -- --host 127.0.0.1 --port 5187`, then in
PowerShell run:

```powershell
$env:DUST_LABEL='before'; node scripts/verify-phone-dust.mjs
$env:DUST_LABEL='after'; node scripts/verify-phone-dust.mjs
```

The script routes all dust source modules explicitly: baseline uses `git show
HEAD`, after uses working files. This avoids stale Vite modules in `.claude`
worktrees without requiring a server restart. `DUST_URL` overrides the server;
`DUST_DEVICE` filters device/orientation while tuning (omit for the full report).
A missing desktop baseline triggers automatic baseline generation.

Decisions:

- Emit 65% of desktop particle counts, preserving dirt-scaled emission and
  the existing fixed pools. Restore effective opacity by removing the extra
  radial exponential and reducing carpet-face attenuation. Use brighter
  sunlit beige; keep normal alpha blending.
- Preserve the 22%-of-width sprite diagonal cap, 14% haze cap, and conservative
  35% peak / 12% settled alpha-area ceilings. More small puffs provide density
  without allowing large sprites.
- Spread local cloud births over 0.6 world units around the hit, expand to 2x
  size over 0.8 seconds, and shorten cloud lifetimes to 1.5-1.8 seconds with
  faster opacity decay. Short haze lives 1.2-1.8 seconds. Landscape clouds use
  85% of portrait world size to respect its shorter viewport.
- Let specks live 3-5 seconds, give them readable small diameters and gentler
  opacity decay, and reduce their procedural curl displacement so sunlight
  sparkle stays local and does not force phantom near-camera budget scaling.
- Verify actual dirt-emitting strikes and paired pattern contrast; retain the
  old SD measurements for comparison. Leave desktop emission/rendering intact.
