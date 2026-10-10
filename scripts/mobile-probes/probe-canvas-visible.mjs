import { createRequire } from 'node:module';
const require = createRequire('D:/github/CoverHit/package.json');
const { webkit, devices } = require('playwright');
const sharp = require('sharp');
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
await page.goto(process.argv[2] + '?lite=1', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(15000);
const start = page.locator('button.ch-primary:visible').first();
if (await start.count()) await start.click().catch(() => {});
await page.waitForTimeout(1200);
let k = 0;
const shot = async (name) => {
  const p = process.argv[3] + 'u' + (k++) + '.png'; await page.screenshot({ path: p, scale: 'css' });
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  let s = 0, s2 = 0, n = 0; for (let y = 100; y < 480; y += 3) for (let x = 10; x < 380; x += 3) { const i = (y * info.width + x) * info.channels; const l = data[i] * .3 + data[i + 1] * .59 + data[i + 2] * .11; s += l; s2 += l * l; n++; }
  const m = s / n; console.log(name.padEnd(46), 'mean', m.toFixed(1), 'sd', Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(1));
};
await shot('as is');
await page.evaluate(() => { const d = window.__coverhit.renderer.domElement; d.style.outline = '6px solid #f00'; d.style.outlineOffset = '-6px'; });
await page.waitForTimeout(500); await shot('canvas outlined red');
// stop the app loop's influence: render ourselves each rAF
await page.evaluate(() => { const h = window.__coverhit; const f = () => { h.renderer.render(h.scene, h.camera); requestAnimationFrame(f); }; f(); });
await page.waitForTimeout(800); await shot('extra renderer.render each rAF');
await page.evaluate(() => { const h = window.__coverhit; h.scene.fog = null; h.yard.sky.visible = false; h.scene.background = null; h.renderer.setClearColor(0x3355ff, 1); });
await page.waitForTimeout(800); await shot('sky hidden, fog off, clear blue');
const info = await page.evaluate(() => { const h = window.__coverhit; return { sky: h.yard.sky.visible, children: h.scene.children.map(c => c.type + ':' + (c.name || '') + ':' + c.visible).slice(0, 12) }; });
console.log(JSON.stringify(info));
await browser.close();
