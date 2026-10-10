# CoverHit UI QA — 2026-10-09

Implemented Soviet poster styling with Russo One display text, PT Sans body text and PT Sans Narrow labels. All text colour pairs pass AA for small text; the translucent panel is checked over black and white. See [tokens and contrast](tokens-and-contrast.md).

Decisions:
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 px; safe margins: 24 px at widths of 1280 px and above, 16 px below.
- Flat poster corners, 2 px panel corners and 4 px toggle corners. Paper grain is CSS-generated.
- Four gameplay HUD zones; background zones are hidden behind full-screen cards. Carpet completion uses a compact right-side card.
- Every new carpet waits for its first strike, including a miss, before counting down. The input/game clock continues during the wait so impact timestamps retain their meaning. Moth scheduling waits with the timer.
- Weight and radius come from swingMass and headRadius. Speed is the inverse of swingMass, matching faster charging for lighter beaters. Bars normalize across the catalog; numeric values are relative coefficients.
- Ideal charge zone: 0.8–1.0 (Отлично); 0.4–0.8 (Хорошо); below 0.4 (Слабо). Charge is recovered from the existing strength mapping. These labels affect HUD feedback only.
- Cleanliness is floored to one decimal from 85% onward, so a value below 90% never displays 90.0%. The exact fill and the threshold tick remain separate.
- Graphical quality calls the optional window.__coverhit.setQuality('low'/'high'); absent support displays a Russian toast. The renderer remains owned by the parallel render work.
- GSAP is pinned to 3.15.0. Reduced motion removes animation and preserves score/quality feedback. [Official GSAP installation documentation](https://gsap.com/docs/v3/Installation/) confirms plugins are available through the public npm package.
- Reward cards use a rendered thumbnail from the existing beater model and keep keyboard focus in the card; Escape closes it.

Run:

```powershell
npm test
npm run build
npm run dev -- --host 127.0.0.1
node scripts/qa-ui.mjs
node scripts/ui-token-report.mjs
```

Browser QA uses Playwright from the existing QA helper and installed Chrome. It freezes RAF for deterministic screenshots; gameplay state transitions and timer advancement are invoked explicitly. Screenshots cover 20 states at both 1440×900 and 1024×640: menu, locked beater, graphics quality, credits, waiting for first strike, toggles, three hit qualities, threshold at 89.9%, side-ready keyboard focus, flipping, urgent timer, carpet completion, next carpet, retry toast, unlock, game over, fresh restart and reduced motion.

[capture-results.json](capture-results.json) records captures and browser errors. Fresh start, next carpet, restart and quality callback assertions run during capture. Licensed local assets were loaded, so the 40 PNGs use the licensed-stock- prefix and are gitignored. The files remain locally available in the size directories.

Final validation: `npm test` passed all 30 test files (217 tests passed, 7 existing skips). `npm run build` passed with the existing Three.js chunk-size warning. Browser QA captured 40 screenshots with zero page errors, and all three hit-quality popups were verified through real `window.__coverhit.hit()` calls. `git diff --check` passed. No files in the render/model-owned directories were edited.
