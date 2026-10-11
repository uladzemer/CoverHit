import { chromium } from './qa-browser.mjs';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { cpus } from 'node:os';
import { createHash } from 'node:crypto';

const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const phase = arg('phase', 'after'), baseline = process.argv.includes('--baseline');
const duration = Number(arg('seconds', 60));
if (duration < 60) throw Error('The heap-growth scenario requires at least 60 seconds');
const originals = new Map();
if (baseline) for (const file of ['carpet/cloth.js', 'carpet/layerCollision.js', 'carpet/barCollision.js', 'carpet/nodeAccess.js', 'carpet/polarContact.js', 'carpet/smoothGeometry.js', 'game/frame.js']) {
  originals.set(file, execFileSync('git', ['show', `HEAD:src/${file}`], { encoding: 'utf8' }));
}
const server = await createServer({ plugins: [{ name: 'phone-baseline', enforce: 'pre', transform(code, id) {
  // assets.js currently has a BOM after its first import. Vite's dev import
  // lexer leaves the following bare three import unresolved; normalize only
  // in this QA server, without changing the other stream's source files.
  const source=originals.get(id.replaceAll('\\', '/').split('/src/')[1]) ?? code;
  return source.includes('\uFEFF') ? source.replaceAll('\uFEFF','') : originals.has(id.replaceAll('\\','/').split('/src/')[1]) ? source : null;
} }], server: { host: '127.0.0.1', port: 0, hmr: false } });
await server.listen();
const browserFlags=process.argv.includes('--uncapped')?['--disable-frame-rate-limit','--disable-gpu-vsync']:[];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,args:browserFlags });
const report = { phase, baseline, duration, cpu: cpus()[0]?.model, browser: browser.version(), timestamp: new Date().toISOString(), cases: [], errors: [] };
report.browserFlags=browserFlags;report.warmup={idleSeconds:4,strikes:1,flips:2,mothScheduled:true};
report.physicsSources=Object.fromEntries(await Promise.all(['carpet/cloth.js','carpet/barCollision.js','carpet/layerCollision.js','carpet/smoothGeometry.js','carpet/nodeAccess.js','carpet/polarContact.js','game/frame.js'].map(async file=>[file,createHash('sha256').update(originals.get(file)??await readFile(`src/${file}`)).digest('hex')])));
try {
  for (const device of [{ name: 'iPhone 14 Pro', width: 393, height: 852, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' }, { name: 'Pixel 7', width: 412, height: 915, ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36' }].filter(d=>arg('devices','iphone,pixel').split(',').includes(d.name.startsWith('iPhone')?'iphone':'pixel'))) {
    for (const rate of arg('rates', '1,4,6').split(',').map(Number)) {
      const page = await browser.newPage({ viewport: { width: device.width, height: device.height }, userAgent: device.ua, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      page.on('pageerror', e => { report.errors.push(e.stack || e.message); console.error(e.stack || e.message); });
      const cdp = await page.context().newCDPSession(page);
      await page.goto(`${server.resolvedUrls.local[0]}?${arg('profile', 'lite')}=1`);
      await page.waitForFunction(() => window.__coverhit, null, { timeout: 90000 });
      await page.evaluate(async () => { await window.__coverhit.start(); });
      await page.waitForTimeout(4000);
      // Exercise lazy contact, hit and moth/shader allocations before measuring
      // retained growth. Both baseline and optimized pages use this warmup.
      await page.evaluate(()=>{const a=window.__coverhit;a.hit(.4,.2,.3);a.game.nextMoth=a.game.time+.1;});
      await page.waitForTimeout(1000);
      for(let flip=0;flip<2;flip++){
        await page.evaluate(()=>window.__coverhit.flip());await page.waitForTimeout(2500);
      }
      await page.evaluate(()=>{const g=window.__coverhit.game;g.timerStarted=false;g.remainingSeconds=90;});
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.evaluate(async () => {
        const a = window.__coverhit, c = a.cloth;
        const { MothSystem } = await import(new URL('./src/fx/moths.js',location.href).href);
        const keys = ['ammo', 'postSolve', 'geometry', 'flipContact', 'dust', 'moths', 'integrate', 'game', 'hit'];
        const totals = Object.fromEntries(keys.map(k => [k, 0]));
        const wrap = (object, method, label) => {
          const original = object[method]; if (!original) return;
          object[method] = function(...args) { const start = performance.now(); try { return original.apply(this, args); } finally { totals[label] += performance.now() - start; } };
        };
        wrap(c.world, 'stepSimulation', 'ammo'); wrap(c, 'integrate', 'integrate');
        wrap(c, 'projectBar', 'postSolve'); wrap(c, 'projectLayers', 'postSolve');
        wrap(c, 'ensureBarClearance', 'postSolve'); wrap(c, 'refreshGeometry', 'geometry');
        wrap(c.selfContact, 'project', 'flipContact'); wrap(a.dust, 'update', 'dust');
        wrap(a.game, 'update', 'game'); wrap(a, 'hit', 'hit');
        wrap(MothSystem.prototype, 'update', 'moths');
        const capacity = 30000, columns = [...keys, 'physicsGame', 'frame', 'interval', 'stage', 'drawCalls'];
        const data = new Float64Array(capacity * columns.length);
        let count = 0, start = 0, strike = 0, flips = 0, prev = 0;
        const original = a.renderPipeline.render;
        a.renderPipeline.render = function(...args) {
          const result = original.apply(this, args), now = performance.now();
          if (start) {
            const elapsed = (now - start) / 1000;
            if (elapsed >= 20.5 + strike * .7 && strike < 12) { a.hit(.25 + (strike % 3) * .2, .18 + (strike % 4) * .07, .85); strike++; }
            if (elapsed >= (flips === 0 ? 32 : 40) && flips < 2 && !c.flip) { if (a.flip()) flips++; }
            if (count < capacity) {
              const row = count++ * columns.length;
              keys.forEach((key, i) => { data[row+i] = totals[key]; });
              data[row+keys.length] = a.performance.physicsMs + totals.hit;
              // main publishes total CPU after render returns; read it in a microtask.
              queueMicrotask(() => { data[row+keys.length+1] = a.performance.frameMs; });
              data[row+keys.length+2] = now-prev;
              data[row+keys.length+3] = c.flip ? 2 : elapsed < 20 ? 0 : elapsed < 31 ? 1 : 3;
              data[row+keys.length+4] = a.renderer.info.render.calls;
            }
            prev = now;
          }
          for (const key of keys) totals[key] = 0;
          return result;
        };
        window.__phoneProbe = { begin() { start = prev = performance.now(); }, finish() {
          const stats = (key, stage) => {
            const index = columns.indexOf(key), values = [];
            for (let i=0; i<count; i++) if (stage === undefined || data[i*columns.length+keys.length+3] === stage) values.push(data[i*columns.length+index]);
            values.sort((a,b)=>a-b);
            return values.length ? { mean: values.reduce((a,b)=>a+b,0)/values.length, p95: values[Math.floor(values.length*.95)], p99: values[Math.floor(values.length*.99)], max: values.at(-1) } : null;
          };
          const interval = stats('interval'), metrics = Object.fromEntries(columns.filter(k=>k!=='stage').map(k=>[k,stats(k)]));
          let dropped = 0; for(let i=0;i<count;i++) dropped += Math.max(0, Math.round(data[i*columns.length+keys.length+2]/(1000/30))-1);
          const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),gpu=gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER);
          return { frames: count, strikes: strike, flips, profile: a.renderPipeline.profile, carpet:a.carpetEntry.id, wind:c.wind, dustCapacity:a.dust.capacity, gpu, hardware:!/SwiftShader|llvmpipe/i.test(gpu), grid: [c.cols,c.rows], nodes: c.nodes.size(), fps: 1000/interval.mean, droppedFrameRatio: dropped/(count+dropped), metrics,
            stages: Object.fromEntries(['idle','hits','flip','settle'].map((name,i)=>[name,Object.fromEntries(columns.filter(k=>k!=='stage').map(k=>[k,stats(k,i)]))])), samples:{columns,data:Array.from(data.subarray(0,count*columns.length))}, recoveries: c.watchdogRecoveries??0 };
        } };
      });
      await cdp.send('HeapProfiler.collectGarbage');
      const heapBefore = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      await page.evaluate(() => window.__phoneProbe.begin());
      await page.waitForTimeout(duration * 1000);
      await cdp.send('HeapProfiler.collectGarbage');
      const heapAfter = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      const result = await page.evaluate(() => window.__phoneProbe.finish());
      const samples=result.samples; delete result.samples;
      const sampleFile=`${phase}-${device.name.startsWith('iPhone')?'iphone':'pixel'}-${rate}x-frames.json`;
      await mkdir('docs/qa/phone-perf',{recursive:true});
      await writeFile(`docs/qa/phone-perf/${sampleFile}`,JSON.stringify(samples));
      report.cases.push({ device: device.name, rate, ...result, sampleFile, heapBefore, heapAfter, heapGrowth: heapAfter-heapBefore, required:rate===4,
        passed: result.fps >= 30 && Object.values(result.stages).every(s=>s.physicsGame && s.physicsGame.p95<=8) && heapAfter-heapBefore < 1_000_000 && result.strikes===12 && result.flips===2 && result.recoveries===0 });
      await writeFile(`docs/qa/phone-perf/${phase}.json`,JSON.stringify(report,null,2));
      console.log(`${phase} ${device.name} ${rate}x: ${result.fps.toFixed(1)} fps, physics/game p95 ${result.metrics.physicsGame.p95.toFixed(2)} ms, heap ${heapAfter-heapBefore}`);
      await page.close();
    }
  }
} finally {
  await mkdir('docs/qa/phone-perf', { recursive: true });
  await writeFile(`docs/qa/phone-perf/${phase}.json`, JSON.stringify(report,null,2));
  if (!baseline) {
    const runs={};
    for(const name of ['before','after','minimal']){
      try { runs[name]=JSON.parse(await readFile(`docs/qa/phone-perf/${name}.json`,'utf8')); }
      catch(error){if(error.code!=='ENOENT')throw error;}
    }
    const accepted=name=>{const cases=runs[name]?.cases.filter(c=>c.required);return cases?.length===2 && cases.every(c=>c.passed);};
    await writeFile('docs/qa/phone-perf/report.json',JSON.stringify({generatedAt:new Date().toISOString(),acceptance:{lite4x:accepted('after'),minimal4x:accepted('minimal')},runs},null,2));
    if(runs.before && runs.after){
      const rows=['| Device | CPU | FPS before → after | Physics/game mean before → after | Physics/game p95 before → after | JS frame p95 / p99 before → after | Heap growth before → after |','|---|---:|---:|---:|---:|---:|---:|'];
      const f=n=>n.toFixed(2);
      for(const a of runs.after.cases){const b=runs.before.cases.find(c=>c.device===a.device&&c.rate===a.rate);if(!b)continue;rows.push(`| ${a.device} | ${a.rate}× | ${f(b.fps)} → ${f(a.fps)} | ${f(b.metrics.physicsGame.mean)} → ${f(a.metrics.physicsGame.mean)} ms | ${f(b.metrics.physicsGame.p95)} → ${f(a.metrics.physicsGame.p95)} ms | ${f(b.metrics.frame.p95)} / ${f(b.metrics.frame.p99)} → ${f(a.metrics.frame.p95)} / ${f(a.metrics.frame.p99)} ms | ${b.heapGrowth} → ${a.heapGrowth} B |`);}
      await writeFile('docs/qa/phone-perf/comparison.md',rows.join('\n')+'\n\nComplete per-phase means: [before](before.md), [after](after.md). Minimal: [minimal](minimal.md). Acceptance and source hashes: [report](report.json).\n');
    }
  }
  const table = ['| Device | CPU | FPS | Physics/game mean / p95 | Ammo | Post-solve* | Geometry | Flip contact* | Dust | Moths | Frame p95 / p99 | Dropped | Heap growth | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const c of report.cases) { const m=c.metrics, f=n=>n.toFixed(2); table.push(`| ${c.device} | ${c.rate}× | ${f(c.fps)} | ${f(m.physicsGame.mean)} / ${f(m.physicsGame.p95)} | ${f(m.ammo.mean)} | ${f(m.postSolve.mean)} | ${f(m.geometry.mean)} | ${f(m.flipContact.mean)} | ${f(m.dust.mean)} | ${f(m.moths.mean)} | ${f(m.frame.p95)} / ${f(m.frame.p99)} | ${f(c.droppedFrameRatio*100)}% | ${c.heapGrowth} B | ${c.passed} |`); }
  await writeFile(`docs/qa/phone-perf/${phase}.md`, table.join('\n')+'\n\n*Post-solve timings include flip contact and nested clearance calls; do not add overlapping phases. Frame time is JS CPU, interval is wall time. Dropped frames are relative to the production 30 Hz phone cadence. Forced-GC retained JS heap includes QA wrappers and excludes preallocated typed sample storage; it is not an allocation-rate measurement.\n');
  await browser.close(); await server.close();
}
if (report.errors.length || !baseline && report.cases.some(c=>c.required&&!c.passed)) process.exitCode=1;
