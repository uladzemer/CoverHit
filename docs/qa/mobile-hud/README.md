# Phone HUD QA

`node scripts/verify-touch-ui.mjs` audits Chromium CDP touch and WebKit hasTouch
at 320×568, 360×740, 393×852, 430×932, 844×390 and 740×360, including every menu
page, playing, audio, flip, pinch and rotation. Results are in `results.json`;
screenshots remain locally here. Gameplay counters must have transparent
backgrounds, zero border/padding and no blur, with score height ≤28 CSS px.

`tests/hudSafeZone.test.js` checks real Chrome layout at nine phone/desktop
sizes, including 44px notch and 21px home-indicator insets and expanded stats.
Phone blocks remain outside the central 60% × 50% area. Bright white and dark
black screenshots include the actual score and a +21 Отлично popup. Raster
checks require both cream fill and dark outline pixels; their luminance
contrast is 13.8:1 (≥4.5:1). Score uses 24px poster type / 26.4px line height;
popups use 18px score and 11px label, without a card.

Decisions: remove all gameplay backing plates and captions on phones/coarse
pointers; keep a slim corner cleanliness bar and small side label; retain
44px translucent corner pills for Меню and Перекинуть. Desktop HUD rules remain
unchanged. The optional raised aim setting is phone-only and defaults off.
The UI verifier installs its clock before startup so resetting performance
timestamps cannot stall the phone's 30fps throttle.
