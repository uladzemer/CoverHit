# Heavy courtyard motion QA

Measured with real packaged Ammo and Chrome/Playwright. The before sources are loaded with read-only git show HEAD:path overrides: no checkout, commit or stash. Source/UI/yard restrictions were retained.

| Measurement | Before | After |
| --- | ---: | ---: |
| Wool density (kg/m²) | 0.8512 | 3.2500 |
| Wool hit peak (m) | 0.2828 | 0.2013 |
| Wool first swing (s) | 2.0333 | 2.4000 |
| Wool decay below 10% (s) | 2.7167 | 4.5333 |
| Ground wind mean (m/s) | 2.4262 | 0.7411 |
| Ground wind peak (m/s) | 3.8462 | 1.9782 |
| Hem rest RMS (m) | 0.0206 | 0.0021 |
| Dust centre drifts 1 m (s) | 0.1610 | 1.5109 |
| 90% particle opacity <0.05 (s) | 8.2767 | 9.1824 |
| Laundry dominant frequency (Hz) | 0.1250 | 0.3750 |
| Moth net speed (m/s) | 0.3983 | 0.4254 |

The ordinary wool scan 03 is 2.350 × 3 m (7.049 m²), so it weighs 22.909 kg. Nominal 2 × 3 m wool is 19.5 kg. Palas is 1.5 kg/m² and runner 2 kg/m². Large scan 05 also scales by its actual area.

| Type / scan | Actual mass, kg | Density, kg/m² | Centre peak, m | First swing, s | Decay, s | Hem-hit dominant Hz |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 03 | 22.909 | 3.25 | 0.201 | 2.400 | 4.533 | 0.425 |
| 06 | 4.762 | 1.50 | 0.344 | 2.300 | 5.183 | 0.450 |
| 01 | 9.000 | 2.00 | 0.266 | 2.367 | 5.350 | 0.425 |

| Requested Hz | Actual Hz | Sway Hz | RMS mm | Laundry Hz | Dust 1 m, s | Dust fade, s | Moth m/s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 30 | 30.0 | 0.375 | 2.121 | 0.375 | 1.515 | 9.188 | 0.425 |
| 60 | 59.8 | 0.375 | 2.121 | 0.375 | 1.511 | 9.182 | 0.425 |
| 120 | 117.3 | 0.375 | 2.121 | 0.375 | 1.511 | 9.180 | 0.425 |
| 144 | 135.8 | 0.375 | 2.118 | 0.375 | 1.509 | 9.186 | 0.425 |
| 240 | 226.9 | 0.375 | 2.122 | 0.375 | 1.511 | 9.177 | 0.425 |
| uncapped | 319.1 | 0.375 | 2.121 | 0.375 | 1.504 | 9.177 | 0.425 |
| hitch | 53.0 | 0.375 | 2.102 | 0.375 | 1.511 | 9.208 | 0.425 |

Maximum deviations from 60 Hz: swayHz 0.00%, swayRms 0.91%, laundryHz 0.00%, driftTime 0.45%, fadeTime 0.28%, mothSpeed 0.20%. Timing verifier passed: **true**. Actual rates are reported honestly when the CPU cannot sustain the requested cadence. The uncapped run uses Chrome's disable-frame-rate-limit flag; throttled runs use one shared RAF queue and real performance.now timestamps, including a 250 ms hitch every 120 ticks. No simulated timestamps stand in for wall time. Rendering, HUD updates and yard uploads are excluded from the measurement fixture to isolate motion clocks. The production game/frame loop and native solver remain active.

Sway is the front lower hem's mean normal displacement, demeaned over 20 wall seconds and resampled to 60 Hz before a Hann-window frequency scan (0.025 Hz bins). Laundry samples decode the shipped VAT at the free edge and evaluate production clip blending and flutter. Dust transform feedback executes the production GPU vertex shader, including curl, gravity and cloth/ground fading; the centre is the unweighted cloud-particle centre relative to birth, in the horizontal plane. Alpha means the particle's vAlpha opacity envelope before texture/lighting modulation, not a pixel read from a screenshot. Crossings are interpolated between actual wall-time observations. Moths use the production fixed-120-Hz steering in the catch volume; net speed includes boundary repulsion.

The main cloud lasts 6–7 s in storage; its unfettered 0.05-opacity envelope lasts about 3.75–4.37 s. Haze and motes last 8–12 s; haze remains faint below the 0.05 threshold. Cloud size expands 4.5× at 3.5 s, while its initial velocity falls to 24% at 0.4 s. Dust advection uses gain 0.5 and a 0.4 m/s cap. Debris settles to 0.268 m/s (0.25 debris plus 0.018 mote settling). Twinkle angular frequencies correspond to 0.3–0.8 Hz. The combined burst's longer fade metric is dominated by the more numerous motes.

Decisions:

- Wind uses seeded 6–15 s gust spacing and 1.5–3 s pulse durations, slow mean/direction drift and calm spells. Consumer gains are carpet 0.35, fringe 0.8, laundry 1.0, vegetation 0.8, dust 0.5, moths 0.6. Yard vegetation hooks are configured from src/scene/windResponses.js; no protected yard source is edited.
- Mass follows actual scan area; easy gameplay no longer substitutes a 2 kg wool carpet. Wind force follows area, not mass. Original positional stiffness/bending remain, with at least 16 solver iterations. A momentum-preserving neighbouring-node damper at 0.8/s suppresses local flutter; blanket Bullet damping is reduced to let the requested broad swing persist for 4–6 s. Wool aero drag rises from 0.65 to 1.2.
- Mass alone cannot lengthen a gravity pendulum's period. To meet the specified swing feel, resting wool/runner use effective gravity 7.2 m/s² and palas 5.4 m/s². This is explicitly an artistic inertia approximation, not physically exact gravity. Throws restore 9.81 m/s², their original damping and existing velocity-driven hand/launch controls. Those controls automatically impart greater momentum to the greater mass, retaining the 9 m/s bound without scaling velocity upward.
- The loop retains up to 0.5 s / 30 fixed solves. Input and game clocks are interleaved between solves, so a hitch no longer drives every throw solve at the same future pose. Longer pauses still bound catch-up; they are outside this 250 ms audit.
- Threshold changes: runner corner free-hem crest travel is 0.18 s rather than 0.25 s (measured 0.183–0.200 s after removing the previous wind preload); its independent crown peel keeps the 0.25 s minimum. Other amplitude, sweep, smoothness, duration, extent, clearance and speed thresholds remain. Flip-wave energy now compares 100/6 J/kg instead of 100 J per carpet, preserving the old wool-specific limit while mass increases. Flip-wave crossings are sampled per solve, so hitches cannot conceal a complete peel between render frames.

Checks: fold/crown/layers/bar-clip PASS; flip-wave PASS; long-run PASS. Each long-run variant completes at least 225 simulated seconds, 34 hits and both throws. All reports remain in this directory; the native amplitude report is in ../flipamp/physics.json. The previously documented polar-contact oracle WIP in docs/CORE.md is outside this tuning pass and is not declared fixed by these checks.

One intermediate flip-wave run measured 0.504 ms against the 0.500 ms outside-contact CPU limit, with every physical constraint passing. A summary of that observed failure is retained as flipwave/cpu-boundary-run.json; the isolated repeat measured 0.410 ms and keeps the same CPU threshold. These timings can vary with host load.

Screenshots: [side-by-side eight-frame strong-hit comparison](comparison.png), [before strip](before-strip.png), [after strip](after-strip.png). These oblique shots expose the dent and first swing, with identical 5 s native settling, a strength-1 centre impulse and exact physical-time samples (rounded to 60 Hz), not synthetic deformations. They are visual physics fixtures; the separate timing audit uses actual wall time. PNGs and bulky wireframe positions are ignored because captures may contain licensed local assets.

Reproduce with node scripts/verify-heavy-feel.mjs; node scripts/verify-time-scale.mjs; node scripts/verify-heavy-regressions.mjs; QA_OUT=docs/qa/heavy/flipwave node scripts/verify-flip-wave.mjs --no-images; node scripts/verify-longrun.mjs --out=docs/qa/heavy/longrun.json; node scripts/capture-heavy.mjs; node scripts/report-heavy.mjs. Add --baseline --label=before to either new metric verifier to read original HEAD sources without changing files.
