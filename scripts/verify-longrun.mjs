import { chromium } from './qa-browser.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// --root allows the identical probe to exercise detached historical worktrees.
const option = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const root = resolve(option('root', '.'));
const out = resolve(option('out', 'docs/qa/longrun/current.json'));
const variants = option('dt', '60,144,hitch').split(',');
const carpetId = option('carpet', '05');
const server = await createServer({ configFile: false, root, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const variant of variants) {
    const page = await browser.newPage({ viewport: { width: 1468, height: 986 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Freeze RAF before boot. Every frame, input clock and physics step below is explicit.
    await page.addInitScript(() => { window.requestAnimationFrame = () => 1; Math.random = () => .375; });
    await page.goto(`${url}?seed=longrun`);
    await page.waitForFunction(() => window.__coverhit, null, { timeout: 60000, polling: 100 }).catch(async error => {
      console.error({errors,loading:await page.locator('body').innerText()});throw error;
    });
    const result = await page.evaluate(async ({variant,carpetId}) => {
      const { advanceGameplayFrame } = await import('/src/game/frame.js');
      const a = window.__coverhit;
      await a.start();
      await a.setCarpet(carpetId);
      const c = a.cloth, b = a.beater, mesh = b.carpetMeshGetter();
      const axis = c.barAxis ?? { y: c.bar.y, z: c.bar.z-.06 };
      // Keep scoring/timer/auto-flips out of the physical experiment. Use the real
      // pointer charge, swing, Bullet collider and impulse insurance paths.
      b.callbacks.clear(); b.interceptSwing = null; b.onMiss = () => {}; b.enabled = true;
      let hits = 0;
      b.onHit(hit => {
        hits++;
        const point = mesh.worldToLocal(hit.point.clone());
        c.applyImpulse(point, hit.normal.clone().negate(), hit.strength);
      });
      let frames = 0, accumulator = 0, phase = 'warmup', failed = null, completedFlips = 0;
      let maxExtent = 0, maxSpeed = 0, maxEnergy = 0, steps = 0;
      const samples = [];
      const sample = () => {
        const nodes = c.body.get_m_nodes(); let extent = 0, speed = 0, kinetic = 0, potential = 0;
        for (let i = 0; i < nodes.size(); i++) {
          const n = nodes.at(i), p = n.get_m_x(), v = n.get_m_v();
          const values = [p.x(), p.y(), p.z(), v.x(), v.y(), v.z()];
          if (!values.every(Number.isFinite)) { failed ??= { phase, time: c.time, reason: 'non-finite' }; continue; }
          extent = Math.max(extent, Math.abs(p.x()-c.bar.x), Math.abs(p.y()-axis.y), Math.abs(p.z()-axis.z));
          const s = Math.hypot(v.x(), v.y(), v.z()); speed = Math.max(speed, s);
          const im = n.get_m_im(); if (im > 0) { kinetic += .5*s*s/im; potential += 9.81*(p.y()-axis.y)/im; }
        }
        maxExtent = Math.max(maxExtent, extent); maxSpeed = Math.max(maxSpeed, speed); maxEnergy = Math.max(maxEnergy, kinetic);
        if (extent > 4 || speed > 30) failed ??= { phase, time: c.time, extent, speed };
        return { phase, time: c.time, extent, speed, kinetic, potential, energy: kinetic+potential };
      };
      const integrate = c.integrate.bind(c);
      c.integrate = dt => { integrate(dt); steps++; const s = sample(); if (steps % 60 === 0 || failed) samples.push(s); };
      const frame = dt => { frames++; accumulator = advanceGameplayFrame({ game: { update() {} }, beater: b, cloth: c, mesh }, dt, accumulator); };
      const advance = seconds => {
        const target = c.time + seconds;
        while (c.time < target - 1e-9 && !failed) {
          frame(variant === '144' ? 1/144 : variant === 'hitch' && frames % 120 === 119 ? .25 : 1/60);
        }
      };
      const strike = () => {
        // Aim at the middle of the visible hanging half, in current geometry.
        const nodes = c.body.get_m_nodes(); let best = Infinity, index = 0;
        for (let i=0;i<nodes.size();i++) {
          const d=c.foldAxis==='u'?i%(c.cols+1)-c.cols/2:Math.floor(i/(c.cols+1))-c.rows/2;
          if (d*(c.visibleSide===0?1:-1)<=0) continue;
          const p=nodes.at(i).get_m_x(), score=Math.hypot(p.x(),p.y()-(axis.y-c.drop*.5));
          if(score<best){best=score;index=i;}
        }
        const p=nodes.at(index).get_m_x(), aim=b.headCenter.clone().set(p.x(),p.y(),p.z());
        mesh.localToWorld(aim); aim.project(a.camera);
        const event={button:0,clientX:(aim.x+1)*734,clientY:(1-aim.y)*493,pointerId:1};
        b.down(event); advance(.6); b.up(event); advance(.5);
      };
      advance(1);
      phase='four-strikes'; for(let i=0;i<4&&!failed;i++)strike();
      if(!failed){phase='idle'; advance(180);}
      if(!failed){phase='thirty-strikes'; for(let i=0;i<30&&!failed;i++)strike();}
      if(!failed){phase='flips'; for(let i=0;i<2&&!failed;i++){
        const side=c.visibleSide;
        c.startFlip();advance(1.3);advance(2);
        if(!c.flip && c.visibleSide!==side)completedFlips++;
      }}
      samples.push(sample());
      const recoveries=c.watchdogRecoveries ?? 0;
      return { variant, carpet:a.carpetEntry.id, width:c.width, height:c.height, camera:{position:a.baseCamera.toArray(),target:a.lookTarget.toArray(),fov:a.camera.fov}, simulatedSeconds:c.time, steps, hits, completedFlips, finalVisibleSide:c.visibleSide, maxExtent, maxSpeed, maxKineticEnergy:maxEnergy, recoveries, failed, samples };
    }, {variant,carpetId});
    result.errors = errors; results.push(result);
    console.log(JSON.stringify({ ...result, samples: undefined }));
    await page.close();
  }
  await mkdir(resolve(out, '..'), { recursive: true });
  await writeFile(out, JSON.stringify(results, null, 2));
  if(results.some(r=>r.failed || r.recoveries || r.errors.length || r.hits!==34 || r.completedFlips!==2)) process.exitCode=1;
} finally { await browser.close(); await server.close(); }
