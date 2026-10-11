import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = process.env.UI_URL || 'http://127.0.0.1:5173';
const folder = 'docs/qa/mobile-hud';
await mkdir(folder, { recursive:true });
await writeFile(`${folder}/.gitignore`, '*.png\n');
const engines = process.env.MOBILE_ENGINES?.split(',') || ['chromium','webkit'];
assert(engines.every(e=>['chromium','webkit'].includes(e)));
let report = [];
if(process.env.MOBILE_ENGINES) {
  try { report=JSON.parse(await readFile(`${folder}/results.json`,'utf8')).filter(r=>!engines.includes(r.engine)); } catch {}
}
const sizes = [[320,568],[360,740],[393,852],[430,932],[844,390],[740,360]];
async function audit(page, gameplay = false) {
  return page.evaluate(gameplay => {
    const issues=[];
    const root=document.querySelector('.coverhit-hud');
    if(gameplay)for(const node of root.querySelectorAll('.ch-zone,.ch-score-pop')){
      const s=getComputedStyle(node);if(s.display==='none')continue;
      if(s.backgroundImage!=='none'||s.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(s.borderTopWidth)!==0||s.backdropFilter!=='none')issues.push({class:node.className,reason:'phone backing plate'});
    }
    if(gameplay&&root.querySelector('[data-score]').getBoundingClientRect().height>28)issues.push({reason:'score too tall'});
    for(const node of root.querySelectorAll('*')) {
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none'||node.closest('[hidden]'))continue;
      if(r.left<-.5||r.right>innerWidth+.5||r.top<-.5||r.bottom>innerHeight+.5)issues.push({class:node.className,reason:'outside viewport',rect:r.toJSON()});
      if(node.scrollWidth>node.clientWidth+2 && !node.matches('input,select'))issues.push({class:node.className,reason:'horizontal overflow'});
      if(gameplay&&node.matches('.ch-zone, .ch-menu-reopen, [data-flip]')&&r.left<innerWidth*.8&&r.right>innerWidth*.2&&r.top<innerHeight*.75&&r.bottom>innerHeight*.25)issues.push({class:node.className,reason:'safe zone',rect:r.toJSON()});
    }
    if(document.documentElement.scrollWidth>innerWidth)issues.push({reason:'page horizontal overflow'});
    return issues;
  },gameplay);
}
for(const engine of engines) {
  const browser=await (engine==='chromium'?chromium:webkit).launch(engine==='chromium'?{channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{headless:true});
  try {
    for(const [width,height] of sizes) {
      const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:3,userAgent:devices[engine==='webkit'?'iPhone 14 Pro':'Pixel 7'].userAgent});
      const page=await context.newPage();
      await page.addInitScript(() => {
        window.__audioResumes=0;
        const Context=window.AudioContext || window.webkitAudioContext;
        window.__audioAvailable=!!Context;
        if(Context) { const resume=Context.prototype.resume; Context.prototype.resume=function(...args){window.__audioResumes++;return resume.apply(this,args);}; }
      });
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://fonts.googleapis.com/**',r=>r.abort());
      // Install before the first game frame: resetting performance.now after
      // startup otherwise leaves the 30fps throttle ahead of the fake clock.
      await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__coverhit?.hud,{timeout:120000});
      await page.evaluate(() => {
        window.__coverhit.setQuality('low');
        window.__qaFlips=0;
        window.__coverhit.game.on('flipStart',()=>window.__qaFlips++);
      });
      await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
      await page.emulateMedia({reducedMotion:'reduce'});
      const record=async state=>{
        const issues=await audit(page,state==='playing');
        report.push({engine,width,height,state,issues,errors:[...errors]});
        await page.screenshot({path:`${folder}/${engine}-${width}x${height}-${state}.png`});
        console.log(`${engine} ${width}x${height} ${state}: ${issues.length} issues`);
      };
      const count=await page.evaluate(()=>window.__coverhit.hud.modal.pages.length);
      for(let i=0;i<count;i++) {await page.evaluate(i=>window.__coverhit.hud.modal.go(i),i);await record(`page-${i+1}`);}
      await page.locator('[data-action]').tap();
      await page.waitForFunction(()=>window.__coverhit.game.state==='playing'&&!window.__coverhit.hud.blocking);
      await page.clock.fastForward(16);
      await record('playing');
      if(engine==='chromium') {
        const cdp=await context.newCDPSession(page);
        const point=await page.evaluate(()=>{
          const {beater}=window.__coverhit;
          const r=beater.dom.getBoundingClientRect();
          // Find a visible carpet ray rather than assuming the other stream's camera framing.
          for(const fy of [.5,.45,.55,.4,.6])for(const fx of [.5,.45,.55,.4,.6]){
            const x=innerWidth*fx,y=innerHeight*fy;
            beater.pointer.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);
            if(beater.aim(beater.pointer)?.uv)return {x,y};
          }
          throw Error('No carpet ray in central touch area');
        });
        const before=await page.evaluate(()=>({score:window.__coverhit.game.score,clean:window.__coverhit.dirt.halfCleanliness(window.__coverhit.game.visibleSide)}));
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
        await page.clock.runFor(500);
        assert.equal(await page.evaluate(()=>window.__coverhit.beater.phase),'charging');
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.clock.runFor(200);
        const strikeDebug=await page.evaluate(()=>{const a=window.__coverhit,b=a.beater;return {phase:b.phase,hit:b.lockedHit?.uv?.toArray(),pending:b.contactPending,score:a.game.score,enabled:b.enabled,blocking:a.hud.blocking,side:a.game.visibleSide,point:b.pointer.toArray(),log:a.strikeLog?.slice(-1)};});
        console.log('touch strike',JSON.stringify(strikeDebug));
        assert(strikeDebug.score>before.score,'Touch must score: '+JSON.stringify(strikeDebug));
        const after=await page.evaluate(()=>({score:window.__coverhit.game.score,clean:window.__coverhit.dirt.halfCleanliness(window.__coverhit.game.visibleSide),audioResumes:window.__audioResumes}));
        assert(after.clean>before.clean,'Touch strike must clean the carpet');
        assert(await page.evaluate(()=>!window.__audioAvailable||window.__audioResumes>0),'Touch must resume AudioContext');
        await page.locator('[data-flip]').tap();
        assert(await page.evaluate(()=>window.__qaFlips>0),'Flip button must start a throw');
        const centre={x:width/2,y:height/2};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:centre.x-30,y:centre.y,id:3},{x:centre.x+30,y:centre.y,id:4}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:centre.x-90,y:centre.y,id:3},{x:centre.x+90,y:centre.y,id:4}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await page.evaluate(()=>visualViewport.scale),1,'Pinch must not zoom');
        report.push({engine,width,height,touch:{before,after,flip:true,pinchScale:1}});
      } else {
        await page.locator('[data-flip]').tap();
        assert(await page.evaluate(()=>window.__qaFlips>0));
        assert(await page.evaluate(()=>!window.__audioAvailable||window.__audioResumes>0),'Touch must resume AudioContext');
        assert.equal(await page.evaluate(()=>visualViewport.scale),1);
        report.push({engine,width,height,touch:{flip:true,pinchScale:1,...await page.evaluate(()=>({audioAvailable:window.__audioAvailable,audioResumes:window.__audioResumes}))}});
      }
      // Rotating the viewport preserves the running session.
      const score=await page.evaluate(()=>{window.__qaGame=window.__coverhit.game;return window.__coverhit.game.score;});
      await page.setViewportSize({width:height,height:width});
      assert(await page.evaluate(score=>window.__coverhit.game===window.__qaGame&&window.__coverhit.game.score>=score,score),'Orientation must preserve the session and score');
      await context.close();
    }
  } finally {await browser.close();await writeFile(`${folder}/results-${engine}.json`,JSON.stringify(report.filter(r=>r.engine===engine),null,2));await writeFile(`${folder}/results.json`,JSON.stringify(report,null,2));}
}
assert.deepEqual(report.filter(r=>r.issues?.length||r.errors?.length),[],'Mobile layout/browser errors');
console.log('Mobile UI, real touch scoring, cleanliness, flip, pinch and orientation checks passed.');
