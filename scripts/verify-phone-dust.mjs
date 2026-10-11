import { webkit, devices } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { startPresentedGame } from './mobile-probes/presented-pixels.mjs';

const out = 'docs/qa/phone-dust';
const label = process.env.DUST_LABEL || 'after';
const url = process.env.DUST_URL || 'http://127.0.0.1:5187/';
await mkdir(out, { recursive: true });
if(label==='after' && !process.env.DUST_DEVICE) {
  try {await access(`${out}/before-Desktop-landscape-default.png`);}
  catch {
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[process.argv[1]],{env:{...process.env,DUST_LABEL:'before'},stdio:'inherit'});
      child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Baseline probe exited ${code}`)));
    });
  }
}
const browser = await webkit.launch();
const rows = [];
const peaks = [];
let desktopDefaultChangedPct = null;
const pixels = async buffer => sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
async function render(page, visible=true) {
  await page.evaluate(async visible => {
    // WebKit may present the preceding buffer. Repeated identical draws ensure
    // both its pending and presented buffers contain the requested visibility.
    for(let i=0;i<3;i++) await new Promise(resolve => window.__dustRAF(() => {
      const h=window.__coverhit;h.dust.points.visible=visible;h.renderPipeline.render(0);resolve();
    }));
  }, visible);
  await page.waitForTimeout(80);
}
function metrics(image, reference, rect) {
  let n = 0, changed = 0, sum = 0, sq = 0, refSum = 0, refSq = 0, cross = 0;
  for (let y = Math.max(0, Math.ceil(rect.y)); y < Math.min(image.info.height, rect.y + rect.height); y++) {
    for (let x = Math.max(0, Math.ceil(rect.x)); x < Math.min(image.info.width, rect.x + rect.width); x++) {
      const i = (y * image.info.width + x) * 3;
      const l = image.data[i] * .2126 + image.data[i+1] * .7152 + image.data[i+2] * .0722;
      if (Math.max(...[0,1,2].map(c => Math.abs(image.data[i+c] - reference.data[i+c]))) > 3) changed++;
      const r = reference.data[i] * .2126 + reference.data[i+1] * .7152 + reference.data[i+2] * .0722;
      sum += l; sq += l*l; refSum += r; refSq += r*r; cross += l*r; n++;
    }
  }
  if (!n) throw new Error('Empty measurement rectangle');
  // The regression slope retains only contrast correlated with the carpet
  // reference. Bright cloud edges cannot inflate this pattern measurement.
  const refVariance=refSq/n-(refSum/n)**2;
  return { changed: changed/n, sd: Math.sqrt(Math.max(0, sq/n - (sum/n)**2)),
    patternRetention:refVariance>0?(cross/n-sum*refSum/(n*n))/refVariance:1 };
}
try {
  for (const [name, orientation] of [['iPhone 14 Pro','portrait'], ['iPhone 14 Pro','landscape'], ['iPhone SE','portrait'], ['iPhone SE','landscape'], ['Desktop','landscape']]) {
    if(process.env.DUST_DEVICE && !`${name}-${orientation}`.includes(process.env.DUST_DEVICE)) continue;
    const device = name === 'Desktop' ? { viewport:{width:1440,height:900} } : devices[name];
    const viewport = orientation === 'portrait' || name === 'Desktop' ? device.viewport : {width:device.viewport.height,height:device.viewport.width};
    const context = await browser.newContext({...device, viewport});
    const page = await context.newPage();
    // Route both revisions explicitly: Vite's watcher ignores .claude worktrees.
    for(const file of ['src/fx/dust.js','src/fx/dust/shaders.js','src/fx/dust/budget.js','src/fx/dust/emission.js']) {
      const source=label==='before'?execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'}):await readFile(file,'utf8');
      const body=source.replace("from 'three'", "from '/node_modules/.vite/deps/three.js'");
      await page.route(`**/${file}*`,route=>route.fulfill({contentType:'application/javascript',body}));
    }
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(m.text()))errors.push(m.text());});
    await page.addInitScript(() => {
      let seed = 731; Math.random = () => { seed = (1664525*seed + 1013904223) >>> 0; return seed/4294967296; };
      const raf = window.requestAnimationFrame.bind(window);
      window.__dustRAF=raf;
      window.requestAnimationFrame = cb => raf(t => { if (!window.__dustFrozen) cb(t); });
    });
    await page.goto(url);
    await page.waitForFunction(()=>window.__coverhit?.hud&&!document.querySelector('.physics-loading'),null,{timeout:60000});
    await page.evaluate(()=>{window.__dustFrozen=true;const h=window.__coverhit;h.camera.position.copy(h.baseCamera);h.camera.lookAt(h.lookTarget);h.camera.updateMatrixWorld();});
    if(name==='Desktop') {
      await page.waitForFunction(()=>window.__coverhit?.hud&&!document.querySelector('.physics-loading'));
      await page.locator('button.ch-primary:visible').first().click();
      await page.waitForFunction(()=>window.__coverhit.game.state==='playing');
    } else await startPresentedGame(page);
    await page.waitForTimeout(1500);
    const profile=await page.evaluate(()=>window.__coverhit.renderPipeline.profile);
    if(name==='Desktop'&&profile!=='full')throw new Error(`Desktop comparison requires full profile, got ${profile}`);
    await page.addStyleTag({content:'.coverhit-hud,.reticle,.charge-arc {visibility:hidden!important}'});
    const rect = await page.evaluate(() => {
      window.__dustFrozen = true;
      const h = window.__coverhit, mesh = h.scene.getObjectByName('carpet');
      const a = mesh.geometry.attributes.position, v = h.camera.position.clone();
      mesh.updateWorldMatrix(true,false);
      const points = [];
      for (let i=0;i<a.count;i++) {v.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).project(h.camera);points.push([(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2]);}
      const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));
      return {x,y,width:Math.max(...points.map(p=>p[0]))-x,height:Math.max(...points.map(p=>p[1]))-y};
    });
    await page.waitForTimeout(100);
    const tag = `${name.replaceAll(' ','-')}-${orientation}`;
    await render(page);
    const defaultShot = await page.screenshot({path:`${out}/${label}-${tag}-default.png`,scale:'css'});
    const initial = await pixels(defaultShot);
    const initialSD = metrics(initial, initial, rect).sd;
    for(const scenario of ['single','four']) {
      await page.evaluate(() => {
        const h=window.__coverhit,d=h.dust;
        d.time=0;d.flow.set(0,0,0);d.expiry.fill(0);
        for(const a of Object.values(d.attributes)) {a.array.fill(0);a.needsUpdate=true;}
        d.material.uniforms.time.value=0;
        h.dirt.grid.fill(1);h.dirt.total=h.dirt.grid.length;h.dirt.texture.needsUpdate=true;
      });
      const hitPoints=await page.evaluate(()=>{
        const h=window.__coverhit,axis=h.dirt.foldAxis,side=h.game.visibleSide;
        const points=[];
        for(let i=0;i<4;i++) {
          let u=.45+(i%2)*.1,v=.45+Math.floor(i/2)*.1;
          if(axis==='u') u=side===0?.55+(i%2)*.1:.45-(i%2)*.1;
          else if(axis==='v') v=side===0?.45-Math.floor(i/2)*.1:.55+Math.floor(i/2)*.1;
          points.push([u,v]);
        }
        return points;
      });
      const scenarioTag=scenario==='four'?tag:`${tag}-single`;
      const peak={device:name,orientation,scenario,profile,viewportChangedPct:0,centralChangedPct:0,budgetPct:0};
      async function sample(t, save=false) {
        await render(page);
        const shot=await page.screenshot({...save?{path:`${out}/${label}-${scenarioTag}-${t}s.png`}:{},scale:'css'});
        const budget=await page.evaluate(()=>window.__coverhit.dust.coverage || null);
        await render(page,false);
        const reference=await page.screenshot({...save?{path:`${out}/${label}-${scenarioTag}-${t}s-no-dust.png`}:{},scale:'css'});
        const image=await pixels(shot), clean=await pixels(reference);
        const centre=metrics(image,clean,{x:viewport.width*.2,y:viewport.height*.2,width:viewport.width*.6,height:viewport.height*.6});
        const full=metrics(image,clean,{x:0,y:0,width:viewport.width,height:viewport.height});
        const carpet=metrics(image,clean,rect), paired=metrics(clean,clean,rect);
        const row={device:name,orientation,scenario,t,centralChangedPct:+(centre.changed*100).toFixed(2),viewportChangedPct:+(full.changed*100).toFixed(2),contrastPct:+(carpet.sd/initialSD*100).toFixed(2),pairedLuminanceSDPct:+(carpet.sd/paired.sd*100).toFixed(2),pairedContrastPct:+(carpet.patternRetention*100).toFixed(2),budgetPct:budget ? +(budget.applied*100).toFixed(2) : null};
        if(save) rows.push(row);
        if(row.viewportChangedPct>peak.viewportChangedPct) {peak.viewportChangedPct=row.viewportChangedPct;peak.t=t;peak.pairedContrastPct=row.pairedContrastPct;await writeFile(`${out}/${label}-${scenarioTag}-peak.png`,shot);}
        peak.centralChangedPct=Math.max(peak.centralChangedPct,row.centralChangedPct);
        peak.budgetPct=Math.max(peak.budgetPct,row.budgetPct||0);

      }
      for(let i=0;i<(scenario==='single'?1:4);i++) {
        if(i) await page.evaluate(()=>window.__coverhit.dust.update(.25));
        const removed=await page.evaluate(([u,v])=>window.__coverhit.hit(u,v,1),hitPoints[i]);
        if(!(removed>0))throw new Error(`Strike ${i+1} emitted no dirt: ${name}/${orientation}/${scenario}`);
        if(scenario==='four') await sample(-1.5+i*.5);
        if(scenario==='four'&&i<3) {await page.evaluate(()=>window.__coverhit.dust.update(.25));await sample(-1.25+i*.5);}
      }
      let previous=0;
      for(const t of [.15,.3,.45,.6,.75,1,1.25,1.5,2,3,4]) {
        await page.evaluate(dt=>window.__coverhit.dust.update(dt),t-previous);previous=t;
        await sample(t,[.15,.3,.6,1,2,3,4].includes(t));
      }
      peaks.push(peak);
      console.log(`${label} ${name} ${orientation} ${scenario}: peak ${peak.viewportChangedPct}% at ${peak.t}s`);
    }
    if(name==='Desktop' && label==='after') {
      const before=await pixels(await readFile(`${out}/before-${tag}-default.png`));
      desktopDefaultChangedPct=metrics(initial,before,{x:0,y:0,width:viewport.width,height:viewport.height}).changed*100;
      console.log('Desktop default changed pixels (%):',desktopDefaultChangedPct);
    }
    if(errors.length) throw new Error(errors.join('\n'));
    await context.close();
  }
} finally { await browser.close(); }
console.table(rows);
console.table(peaks);
await writeFile(`${out}/${label}-report.json`,JSON.stringify({label,timeOrigin:'Seconds after the last strike; four strikes at -1.5,-1,-0.5,0; single strike at 0',differenceThreshold:'Any RGB channel >3/255; central rectangle = middle 60% of viewport',peakSamples:'Every .25 s during four strikes, then .15/.3/.45/.6/.75/1/1.25/1.5/2/3/4 s',contrastMetric:'Carpet luminance regression slope against paired no-dust render; raw SD ratios also retained',desktopDefaultChangedPct,rows,peaks},null,2)+'\n');
const failures=[];
if(label==='after') {
  if(desktopDefaultChangedPct>.1) failures.push('Desktop default changed');
  for(const p of peaks.filter(p=>p.device!=='Desktop')) {
    const [lo,hi]=p.scenario==='single'?[8,14]:p.orientation==='portrait'?[10,18]:[8,15];
    if(p.viewportChangedPct<lo||p.viewportChangedPct>hi||p.pairedContrastPct<70) failures.push(`Peak ${JSON.stringify(p)}`);
  }
  for(const r of rows.filter(r=>r.device!=='Desktop')) {
    const max=r.t===1?12:r.t===2?5:r.t>=3?1.5:Infinity;
    const contrast=r.t===1?85:r.t>=2?95:70;
    if(r.viewportChangedPct>max||r.pairedContrastPct<contrast) failures.push(`Decay ${JSON.stringify(r)}`);
  }
}
if(failures.length) {console.error(failures.join('\n'));process.exitCode=1;}
