import { createRequire } from 'node:module';
const require = createRequire('D:/github/CoverHit/package.json');
const { webkit, devices } = require('playwright');
const sharp = require('sharp');
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
await page.goto(process.argv[2] + '?full=1', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(15000);
const start = page.locator('button.ch-primary:visible').first();
if (await start.count()) await start.click().catch(() => {});
await page.waitForTimeout(1200);
let k = 0;
const stat = async (name) => {
  const p = process.argv[3] + 'x' + (k++) + '.png'; await page.screenshot({ path: p });
  const { data, info } = await sharp(p).extract({ left: 20, top: 200, width: 350, height: 300 }).raw().toBuffer({ resolveWithObject: true });
  let s = 0, s2 = 0, n = data.length / info.channels; for (let i = 0; i < data.length; i += info.channels) { const l = data[i] * .3 + data[i + 1] * .59 + data[i + 2] * .11; s += l; s2 += l * l; }
  const m = s / n; console.log(name.padEnd(36), 'mean', m.toFixed(1), 'sd', Math.sqrt(s2 / n - m * m).toFixed(1));
};
await stat('full as is');
const ok = await page.evaluate(() => window.__coverhit.setQuality('lite')); console.log('setQuality lite ->', ok);
await page.waitForTimeout(2000); await stat('after downgrade to lite');
await page.evaluate(() => window.__coverhit.setQuality('minimal')); await page.waitForTimeout(2000); await stat('after downgrade to minimal');
const d = await page.evaluate(() => ({ profile: window.__coverhit.renderPipeline.profile, gl: window.__coverhit.renderer.getContext().getError(), lost: window.__coverhit.renderer.getContext().isContextLost() }));
console.log(JSON.stringify(d));
await browser.close();
