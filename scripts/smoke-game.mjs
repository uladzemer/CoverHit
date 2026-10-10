import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Run against npm run dev; requires Playwright and a local Chrome installation.

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1468, height: 986 } });
if (process.env.CPU_SLOWDOWN) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_SLOWDOWN) });
}
const warnings = [];
const pageErrors = [];
page.on('console', message => {
  if (/WebGL|too many errors/i.test(message.text())) warnings.push(message.text());
});
page.on('pageerror', error => pageErrors.push(error.message));
await page.addInitScript(() => {
  window.__drawErrors = [];
  const proto = WebGL2RenderingContext.prototype;
  const draw = proto.drawElementsInstanced;
  proto.drawElementsInstanced = function (...args) {
    draw.apply(this, args);
    const error = this.getError();
    if (error && window.__drawErrors.length < 5) {
      const attributes = [];
      for (let i = 0; i < this.getParameter(this.MAX_VERTEX_ATTRIBS); i++) {
        if (this.getVertexAttrib(i, this.VERTEX_ATTRIB_ARRAY_ENABLED)) attributes.push({
          slot: i, bound: !!this.getVertexAttrib(i, this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
          divisor: this.getVertexAttrib(i, this.VERTEX_ATTRIB_ARRAY_DIVISOR),
        });
      }
      window.__drawErrors.push({ error, args, attributes, stack: new Error().stack });
    }
  };
});
try {
  await page.goto('http://127.0.0.1:5173/?seed=combo-smoke');
  await page.waitForFunction(() => window.__coverhit, { timeout: 60000 });
  await page.waitForTimeout(2000); // Warm shaders before measuring mouse cadence.
  await page.evaluate(async () => {
    const app = window.__coverhit;
    await app.start();
    window.__hitTrace = [];
    app.beater.onHit(() => window.__hitTrace.push({ wall: performance.now(), game: app.game.time, combo: app.game.comboMultiplier }));
  });
  const playStarted = Date.now();
  await page.mouse.move(734, 493);
  for (let i = 0; i < 12; i++) {
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(250);
    if (i === 7 || i === 11) {
      const state = await page.evaluate(() => ({ combo: __coverhit.game.comboMultiplier, hud: document.querySelector('[data-combo]').textContent, hits: __hitTrace.length }));
      console.log('CADENCE', i + 1, state);
      assert.ok(state.combo >= (i === 7 ? 2 : 3));
      assert.equal(state.hud, `×${state.combo}`);
      assert.equal(state.hits, i + 1);
    }
  }
  await page.evaluate(async () => {
    const app = __coverhit;
    const { Vector3 } = await import('/node_modules/three/build/three.module.js');
    for (let i = 0; i < 8; i++) app.dust.emit(new Vector3(0, 1, 0), new Vector3(0, 0, 1), 0.08);
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const batch = __coverhit.dust.renderer.batches[0];
    batch.expandBuffers(batch.maxParticles + 1);
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const batch = __coverhit.dust.renderer.batches[1];
    batch.expandBuffers(batch.maxParticles + 1);
  });
  await page.evaluate(async () => { await __coverhit.setCarpet(__coverhit.carpetEntry.id); });
  // Continue real play while particles drain, including the replacement carpet.
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(734 + (i % 3 - 1) * 60, 493);
    await page.mouse.down(); await page.waitForTimeout(400);
    await page.mouse.up(); await page.waitForTimeout(250);
  }
  await page.waitForTimeout(Math.max(0, 30000 - (Date.now() - playStarted)));
  console.log('DRAW ERRORS', JSON.stringify(await page.evaluate(() => __drawErrors)));
  console.log('WARNINGS', warnings.length, warnings.slice(0, 3));
  assert.deepEqual(await page.evaluate(() => __drawErrors), []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(pageErrors, []);
  console.log('PASS: 30 seconds of play, combo ×3, HUD agrees, no WebGL warnings; independent batch expansion and carpet replacement exercised.');
} finally {
  await browser.close();
}
