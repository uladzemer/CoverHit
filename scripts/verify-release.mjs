import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { smokePages } from './smoke-pages.mjs';

const url = process.env.RELEASE_URL || 'http://127.0.0.1:5189/CoverHit/';
const out = 'docs/qa/release';
await mkdir(out, { recursive: true });
const report = { url, at: new Date().toISOString(), results: [] };
let failed = false;
await smokePages(url);
for (const name of ['Desktop', 'iPhone 14 Pro', 'Pixel 7']) {
  const browser = await (name.startsWith('iPhone') ? webkit : chromium).launch({ headless: true,
    ...(!name.startsWith('iPhone') && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const row = { device: name, failedRequests: [], consoleErrors: [], pageErrors: [], warnings: [], optionalRequests: [] };
  try {
    const context = await browser.newContext(name === 'Desktop' ? { viewport: { width: 1280, height: 900 } } : devices[name]);
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__releaseShaderLogs = [];
      const original = WebGL2RenderingContext.prototype.getProgramInfoLog;
      WebGL2RenderingContext.prototype.getProgramInfoLog = function(program) {
        const log = original.call(this, program);
        if (log?.trim()) {
          const source = (this.getAttachedShaders(program) || []).map(shader => this.getShaderSource(shader) || '').join('\n');
          const owner = /poissonDisk\[i\]/.test(source) ? 'n8ao/PoissionBlur.js' : /#define SHADER_NAME PMREMGGXConvolution\b/.test(source) ? 'three/PMREMGenerator' : /SMAA/.test(source) ? 'postprocessing/SMAA' : 'unclassified';
          window.__releaseShaderLogs.push({ log: log.trim(), owner, ownPCSS: /sunsetPCSS/.test(source),
            shaderNames: [...source.matchAll(/#define SHADER_NAME (.+)/g)].map(match => match[1]) });
        }
        return log;
      };
    });
    page.on('requestfailed', request => row.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) row.failedRequests.push({ url: response.url(), status: response.status() }); });
    page.on('request', request => { if (/manifest\.local\.json|\/yard\/stock\/|\/yard\/credits\.json/.test(request.url())) row.optionalRequests.push(request.url()); });
    page.on('pageerror', error => row.pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') row.consoleErrors.push(message.text());
      if (message.type() === 'warning') row.warnings.push(message.text());
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction(() => window.__coverhit && window.__boot?.some(step => step.step === 'first frame rendered'), null, { timeout: 60000 });
    await page.evaluate(async () => { await window.__coverhit.start(); if (window.__coverhit.renderPipeline.profile === 'full') window.__coverhit.setQuality('high'); });
    // Exercise dirt/dust materials as well as startup shaders, then allow late
    // photograph upgrades and credits to settle before auditing the logs.
    await page.evaluate(() => { for (const [u, v] of [[.3, .3], [.5, .5], [.7, .4]]) window.__coverhit.hit(u, v, .65); });
    await page.waitForTimeout(5000);
    row.runtime = await page.evaluate(async () => {
      const samples = [];
      for (let i = 0; i < 120; i++) { await new Promise(requestAnimationFrame); samples.push({ ...window.__coverhit.performance }); }
      const mean = key => samples.reduce((sum, sample) => sum + (sample[key] || 0), 0) / samples.length;
      return { profile: document.documentElement.dataset.coverhitProfile, quality: window.__coverhit.quality,
        meanFrameMs: mean('frameMs'), meanRenderMs: mean('renderMs'), maxDrawCalls: Math.max(...samples.map(sample => sample.calls || sample.drawCalls || 0)) };
    });
    // Read-only instrumentation ties compiler logs to their real GLSL programs;
    // console output is retained and no renderer diagnostics are suppressed.
    row.shaderDiagnostics = await page.evaluate(() => window.__releaseShaderLogs);
    row.dependencyWarnings = row.warnings.filter(warning => row.shaderDiagnostics.some(entry => entry.owner !== 'unclassified' && !entry.ownPCSS && warning.includes(entry.log)));
    row.ownWarnings = row.warnings.filter(warning => !row.dependencyWarnings.includes(warning));
    for (const key of ['failedRequests', 'consoleErrors', 'pageErrors', 'optionalRequests', 'ownWarnings']) assert.equal(row[key].length, 0, `${name}: ${key}`);
    row.passed = true;
  } catch (error) { failed = true; row.passed = false; row.failure = error.message; }
  finally { report.results.push(row); await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n'); }
  console.log(`${name}: ${row.passed ? 'passed' : row.failure}; failed requests ${row.failedRequests.length}, console errors ${row.consoleErrors.length}, warnings ${row.warnings.length}`);
}
if (failed) process.exitCode = 1;
