# Throw amplitude QA — 2026-10-10

**Amplitude passes; the complete change remains unaccepted.** The real browser
hem rises 0.801–1.004 m above the pipe axis and sweeps 1.938–2.235 m in depth.
The unchanged triangle/pair oracle still reports p99 penetration near 13.9 mm,
including outside the crown collar, against the requested 6 mm maximum. The
final 30 Hz contact audit also measures 1.003 ms added CPU per frame against
the 1 ms limit. Neither failure has been hidden by changing its threshold.

## Before and after

The before figures were supplied by the owner from the published site, not
measured by this checkout's new probe. The probe follows the material hem of
the half selected at throw start. Heights/depths are relative to the pipe axis.

| Version / probe | Hem peak above axis (m) | Hem Z sweep (m) |
|---|---:|---:|
| Owner: before polar contact, `6402b77` | 0.308 | 1.53 |
| Owner: polar contact, `927c785` | 0.076 | 0.83 |
| Current Chrome, required cases and both directions | 0.801–1.004 | 1.938–2.235 |

Playwright launches real Chrome with packaged Ammo WASM and the production
render pipeline. RAF is frozen for reproducibility: each rendered sample follows
one fixed 1/60 s solve at 60 Hz, or two at 30 Hz. These are deterministic render
cadences, not wall-clock monitor refresh. Wind is enabled. Largest carpet 05 is
2.681 × 3.5 m; 03 is medium. Ranges span both directions; see [browser.json](browser.json).

| Carpet | Hz | Hands | Peak (m) | Sweep (m) | Duration (s) | Leading-to-far hem crest (s) | Largest frame movement (m) |
|---|---:|---|---:|---:|---:|---:|---:|
| 05 | 60 | Both | 0.973–1.004 | 2.138–2.164 | 1.483 | 0.200–0.217 | 0.226–0.227 |
| 05 | 30 | Both | 0.964–0.991 | 2.113–2.147 | 1.467–1.483 | 0.167–0.200 | 0.446–0.450 |
| 05 | 60 | Corner | 0.807–0.831 | 2.158–2.219 | 1.650 | 0.417–0.467 | 0.242–0.243 |
| 05 | 30 | Corner | 0.801–0.825 | 2.150–2.235 | 1.650 | 0.433–0.467 | 0.422–0.426 |
| 03 | 60 | Both | 0.940–0.967 | 2.138–2.139 | 1.483–1.533 | 0.200–0.217 | 0.221–0.222 |
| 03 | 30 | Both | 0.936–0.961 | 2.120–2.122 | 1.500–1.550 | 0.167–0.200 | 0.429–0.430 |
| 03 | 60 | Corner | 0.806–0.830 | 2.058–2.159 | 1.650 | 0.350–0.367 | 0.229 |
| 03 | 30 | Corner | 0.802–0.825 | 1.938–2.130 | 1.650 | 0.367 | 0.386–0.397 |

The 0.35 m movement limit applies to 60 Hz, where all cases pass. Crest travel
uses each material column's maximum hem height and a signed leading-to-far
endpoint difference (minimum 0.15 s / 0.25 s). Crown crossings are checked
separately. Zero recoveries in every case. Some both-hand peaks exceed the
0.9 m aim while remaining within the 3 m extent bound.

## Changes and decisions

- Keep polar contact and cylinder projection active. Push-out shifts Ammo
  history; only the closing normal impulse changes velocity, with restitution
  0.05 and zero tangential friction. Positional pressure cannot drag the throw's
  tangent. A regression checks that 5 m/s tangential velocity survives repair.
- Allow 9 m/s only during flips, including near the pipe, where the old 0.9 m/s
  clamp throttled motion. Outside limits remain. The existing watchdog guard
  allows 9 m/s; no recovery threshold was relaxed.
- Drive hands with the external game clock too. Native grip patches temporarily
  become kinematic, move at most `9 * dt`, and restore inverse mass over 0.15 s
  after their own release. Completion/watchdog cleanup restores saved masses.
- Raise the hand arc to 0.8 m above the axis and the depth sine to 0.85 m. Delay
  the second hand's whole arc by 0.18–0.22 s. Windup remains 0.25 s; individual
  release is 0.95 s plus delay. Corner grip timing advances 0.05 s.
- Raise upward launch to at most 8.3 m/s and outward launch to 3.2 m/s. Corner
  launch spans 0.46 s with a short continuing lift. Original crown support
  release/reattachment timing and spreads of 0.20 s / 0.32 s remain.
- At 1.05 s, damp horizontal swing, add a downward settling velocity increment,
  and cap each landing layer correction at 0.10 m. Late cylinder repair uses
  actual geometric sides, avoiding reflection from stale side labels. The
  original settled layer solver and final cleanup remain. Hem completion snaps
  now satisfy the movement limit, but arc self-contact remains insufficient.
- Use one polar sweep and remove duplicate mirrored-neighbour dispatch already
  covered by hanging-panel bins. Reuse buffers and keep the oracle out of
  production. Additional prediction, quad contact and crown-lift experiments
  did not materially improve penetration within budget and were reverted.

Fringe, dirt ownership and hit gating were not changed. Game-clock spam checks
complete on the opposite side, block hits/reentry during throws and pass the
existing crown, rest-gap and half-height checks.

## Contact and CPU failures

Final serial audit: 20 alternating throws per cadence, both styles/directions,
wind on, carpet 05. Oracle sampling/diagnostic overhead is excluded from CPU
timing. See [contact/metrics.json](contact/metrics.json).

| Measurement | 60 Hz | 30 Hz |
|---|---:|---:|
| Overall oracle p99 penetration (mm) | 13.917 | 13.926 |
| Triangle p99 in collar (mm) | 13.848 | 13.861 |
| Triangle p99 outside collar (mm) | 13.849 | 13.875 |
| Triangle p99 before / during landing (mm) | 13.847 / 13.850 | 13.862 / 13.872 |
| Triangle plus pair events deeper than 3 mm | 14,264 | 14,365 |
| Triangle events deeper than 14 mm outside collar | 0 | 0 |
| Polar CPU (ms / fixed solve) | 0.469 | 0.454 |
| Added flip CPU (ms / rendered frame) | 0.469 | 1.003 |
| Additional polar dispatches / CPU outside flips | 0 / 0 | 0 / 0 |
| Polar accumulated correction cap (mm) | 5.000 | 5.000 |
| Maximum final handoff correction (mm) | 393.549 | 276.752 |
| Maximum speed (m/s) | 9.000 | 9.000 |
| Maximum kinetic energy | 58.321 | 59.339 |
| Maximum extent from bar (m) | 1.826 | 1.825 |
| Recoveries | 0 | 0 |

Collar includes a contact if any involved triangle vertex/node lies within
0.30 m of the axis. Overall p99 is the maximum of the unchanged triangle and
local-normal pair distributions; regional columns describe triangle samples.
The triangle oracle reports absolute separation against 14 mm thickness, so
its penetration cannot exceed 14 mm. Zero events above that bound therefore
does not establish zero crossing or correct-side separation. Failure also
occurs outside the collar, not solely at the known collar limitation.

The prior polar report measured 13.888 mm p99 and 33,865 deep events at 60 Hz.
Event count improves, but p99 worsens by 0.029 mm and does not meet 6 mm.
`requestedPenetrationPassed=false`, `requestedCpuPassed=false`,
`requestedPhysicsPassed=true`. The verifier retains exit 1. Its older stricter
acceptance and full-step handoff limit also fail; handoff is outside the polar cap.

The separate serial wave audit measured +0.190 ms/frame at 60 Hz and +0.853 at
30 Hz. The conservative full oracle audit above is retained; a borderline
1.003 ms result is not called a pass.

## Reproduction and validation

```powershell
npm test
npm run build
node scripts/verify-flip-amplitude.mjs
node scripts/verify-flip-amplitude-browser.mjs
$env:QA_OUT='docs/qa/flipamp'
node scripts/verify-contact-regressions.mjs
$env:QA_OUT='docs/qa/flipamp/flipwave'
node scripts/verify-flip-wave.mjs --no-images
node scripts/verify-longrun.mjs --out=docs/qa/flipamp/longrun.json
node scripts/verify-flip-contact.mjs --dt=60,30 --flips=20 --no-images --out=docs/qa/flipamp/contact
```

- Tests: 48 files / 343 tests pass, including the new actual Ammo Node regression.
- Build: passes with the existing large-chunk warning.
- Node amplitude: 20 cases pass (five carpets × two styles × two cadences),
  printing type, peak, sweep, duration, hem crest and crown spread. See
  [physics.json](physics.json). No rendering, DOM or mocked physics.
- Chrome amplitude: all 16 cases pass, zero browser errors.
- Bar clipping, folded rest, layers and crown: all four pass with original
  thresholds; see [regressions.json](regressions.json) and its subdirectories.
- Wave: all four cadences pass, 20 physical and 20 game-clock throws each;
  see [flipwave/metrics.json](flipwave/metrics.json).
- Long run: 225 simulated seconds / 13,500 solves per 60 Hz, 144 Hz and hitch
  case, 34 hits and two flips each, zero failures/recoveries. Extent ≤1.823 m,
  energy ≤56.779; see [longrun.json](longrun.json).
- Contact: exit 1, explained above.

Legitimate wave bounds changed from 6 → 9 m/s and 50 → 100 energy units; extent
tightened from 4 → 3 m. Its existing 0.5 ms contact-zone limit is compared per
fixed solve by converting 30/144 Hz render-frame totals to that unit. No
layer/fold/bar/crown threshold was loosened. Requested amplitude/contact limits
are unchanged.

Amplitude hashes all six modified physics modules. Node and Chrome share
`503d4a4128eac72f4392dce6a72b2b322659606eab0466001f43b20c489d4f52`.
Contact/wave retain their existing smaller hash scopes and thus differ.

## Twelve-frame captures

Each sheet has 12 rendered snapshots across one 60 Hz throw, four columns by
three rows. Front/side use the same physical samples; raw positions retain the
visible side for replay. The side QA camera includes the full arc. These are
motion evidence, not acceptance of remaining intersections.

- Both hands: [front](both-front.png), [side](both-side.png),
  [positions](both-positions.json).
- Corner: [front](corner-front.png), [side](corner-side.png),
  [positions](corner-positions.json).

Existing `docs/qa/**/*.png` ignores all four sheets. No commit, stash or deployment.
