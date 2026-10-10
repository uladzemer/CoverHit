Run `node scripts/verify-bar-clip.mjs` with Vite on port 5173, Playwright installed and Chrome available (`CHROME_PATH` can override its path).

`browser.json` records native SDF_RS cylinder contact with projection disabled, collision on/off and anchor suppression on/off; all 15 available rug geometries; 40 deterministic strong impulses over 480 fixed steps; and 40 pointer-driven full-charge strikes within 30 cm below the bar. Both stress runs require zero nodes inside the 0.055 m protected radius. The pointer run also requires no topology-side violations in the crown region and no missed strikes.

`after-40-beater-hits.png` shows the final carpet covering the pipe. `after-40-hits.png` shows the deterministic impulse run. Node-only regressions cover radial projection, solver-history positions, velocities, attenuation, and crown chord clearance on both fold axes. Crown clearance matters because safe vertices alone do not ensure safe triangles.

Root cause: the old box was smaller than the visible cylinder, and anchors disabled collision with the whole bar. Unbounded near-bar motion and a zero-thickness render surface compounded the failure. The fix enables anchored SDF contact with a correctly sized cylinder and margin, limits crown hits and speed, enforces post-solve radial projection plus a rounded crown envelope, and offsets the rendered surface by 6 mm.
