// Starts the game on an emulated iPhone and measures whether the 3D canvas actually draws something.
import { createRequire } from 'node:module';
const require = createRequire('D:/github/CoverHit/package.json');
const { webkit, chromium, devices } = require('playwright');
const sharp = require('sharp');

const URL = process.argv[2];
const engineName = process.argv[3] || 'webkit';
const devName = process.argv[4] || 'iPhone 14 Pro';
const tag = process.argv[5] || 'p3';
const dir = process.env.OUT || '.';
const engine = engineName === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true });
const ctx = await browser.newContext({ ...devices[devName] });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(`[error] ${m.text().slice(0, 200)}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${String(e).slice(0, 300)}`));
await page.goto(URL, { waitUntil: 'load', timeout: 60000 }).catch(e => logs.push('[goto] ' + e.message));
await page.waitForTimeout(14000);
const info = await page.evaluate(() => ({
  profile: window.__boot?.profile || window.__coverhit?.profile || null,
  steps: (window.__boot || []).map?.(s => s.step).slice(-6),
  hud: !!document.querySelector('.coverhit-hud'),
  modal: !!document.querySelector('[aria-modal="true"], .ch-modal'),
  canvas: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; })(),
})).catch(e => ({ err: String(e).slice(0, 150) }));
// close the modal / start the game so the 3D view is visible
const start = page.locator('button.ch-primary:visible').first();
if (await start.count()) await start.tap().catch(() => start.click().catch(() => {}));
await page.waitForTimeout(2500);
const shot = `${dir}/${tag}.png`;
await page.screenshot({ path: shot });
// pixel variance of the central area = is anything drawn
const { data, info: im } = await sharp(shot).extract({ left: 40, top: 160, width: 300, height: 380 }).raw().toBuffer({ resolveWithObject: true });
let sum = 0, sum2 = 0; const n = data.length / im.channels;
for (let i = 0; i < data.length; i += im.channels) { const l = data[i] * .3 + data[i + 1] * .59 + data[i + 2] * .11; sum += l; sum2 += l * l; }
const mean = sum / n, sd = Math.sqrt(sum2 / n - mean * mean);
console.log(tag, JSON.stringify({ ...info, centreMean: +mean.toFixed(1), centreStdDev: +sd.toFixed(1) }));
console.log(logs.slice(0, 6).join('\n'));
await browser.close();
