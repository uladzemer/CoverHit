import { chromium } from './qa-browser.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const sizes=[[800,700],[1024,640],[1280,720],[1440,900],[1920,1080]];
const origin=process.env.UI_URL || 'http://127.0.0.1:5173';
const live=process.argv.includes('--live');
const fallback=process.argv.includes('--fallback');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
async function issues(page) {
 return page.evaluate(()=>{
  const visible=n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!n.closest('[hidden]');};
  const found=[];
  for(const n of document.querySelectorAll('.coverhit-hud, .coverhit-hud *')) {
   if(!visible(n))continue;
   const s=getComputedStyle(n),r=n.getBoundingClientRect(),id=n.getAttribute('data-action')!==null?'[data-action]':n.tagName.toLowerCase()+'.'+n.className;
   if((/auto|scroll/.test(s.overflowY)&&n.scrollHeight>n.clientHeight+1)||(/auto|scroll/.test(s.overflowX)&&n.scrollWidth>n.clientWidth+1))found.push({id,reason:'scrollbar'});
   if((/hidden|clip/.test(s.overflowX)&&n.scrollWidth>n.clientWidth+1)||(/hidden|clip/.test(s.overflowY)&&n.scrollHeight>n.clientHeight+1))found.push({id,reason:'clipped text/content'});
   if(n.matches('button,input,select,summary,a[href]')&&(r.width<39.9||r.height<39.9))found.push({id,reason:'control <40px',width:r.width,height:r.height});
   if(r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5)found.push({id,reason:'outside viewport',rect:r.toJSON()});
   // Text nodes must remain within the viewport and any clipping ancestor.
   for(const child of n.childNodes)if(child.nodeType===Node.TEXT_NODE&&child.textContent.trim()){
    const range=document.createRange();range.selectNodeContents(child);
    for(const t of range.getClientRects()){
     if(t.left<-.5||t.top<-.5||t.right>innerWidth+.5||t.bottom>innerHeight+.5)found.push({id,reason:'text outside viewport'});
     for(let parent=n;parent&&parent.className!=='coverhit-hud';parent=parent.parentElement){const ps=getComputedStyle(parent),p=parent.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(ps.overflowX+' '+ps.overflowY)&&(t.left<p.left-1||t.right>p.right+1||t.top<p.top-1||t.bottom>p.bottom+1))found.push({id,reason:'text clipped by ancestor'});}
    }
   }
  }
  const panels=[...document.querySelectorAll('.ch-zone')].filter(visible);
  for(const n of panels){const r=n.getBoundingClientRect();if(r.left<innerWidth*.8&&r.right>innerWidth*.2&&r.top<innerHeight*.8&&r.bottom>innerHeight*.2)found.push({id:n.className,reason:'central safe zone overlap',rect:r.toJSON()});}
  for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++){const a=panels[i].getBoundingClientRect(),b=panels[j].getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)found.push({id:panels[i].className+' / '+panels[j].className,reason:'panel overlap'});}
  return found;
 });
}
try {
 if(fallback){
  const page=await browser.newPage({viewport:{width:800,height:700}});
  await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:getContext.call(this,type,...args);};});
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.ch-modal:not([hidden])',{timeout:90000});
  const failures=await issues(page);
  if((await page.locator('[data-action]').textContent())!=='Повторить')throw Error('Startup failure did not show retry');
  await page.keyboard.press('Escape');
  if(!(await page.locator('.ch-modal').isVisible()))throw Error('Failure lost its retry action');
  await mkdir('docs/qa/ui2/fallback',{recursive:true});await page.screenshot({path:'docs/qa/ui2/fallback/no-webgl.png'});
  report.push({width:800,height:700,state:'no-webgl-startup',issues:failures,errors:[]});await page.close();
 }
 for(const [width,height] of fallback?[]:sizes){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  if(!live)await page.route(origin+'/',r=>r.fulfill({contentType:'text/html',body:'<html lang="ru"><body style="margin:0;background:#b58d7b"><div id="app" style="position:fixed;inset:0"></div></body></html>'}));
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  if(live)await page.waitForFunction(()=>window.__coverhit?.hud,{timeout:120000});
  else await page.evaluate(async()=>{
   const {Hud}=await import('/src/ui/hud.js'),{Game}=await import('/src/game/state.js'),{BEATERS}=await import('/src/input/beaters/index.js');
   let credits=[];try{credits=(await (await fetch('/carpets/manifest.json')).json());credits=Array.isArray(credits)?credits:credits.carpets||credits.entries||[];}catch{}
   if(!credits.length)credits=Array.from({length:17},(_,i)=>({title:'Ковёр '+(i+1),credit:'Музей · Общественное достояние',license:'CC0',sourceUrl:'https://example.org'}));
   const game=new Game();game.start();game.setState('menu');const progression={total:0};const hud=new Hud({container:document.querySelector('#app'),beaters:BEATERS,progression,credits,onStart:()=>game.start(),onNextCarpet:()=>game.nextCarpet(),onMute:()=>hud.setMuted(hud.nodes.mute.getAttribute('aria-pressed')!=='true')});hud.bind(game);hud.setCarpetType('Ковёр шерстяной','Красный с медальоном');window.__coverhit={hud,game,progression,setQuality:q=>{window.__coverhit.quality=q;},quality:'high'};
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  if(live){ await page.clock.install(); await page.clock.pauseAt(new Date()); }
  const folder=`docs/qa/ui2/${live?'live-':''}${width}x${height}`;await mkdir(folder,{recursive:true});
  const snap=async state=>{
   const failures=await issues(page);const licensed=live&&await page.evaluate(()=>!!window.__coverhit.yard?.stockCredits?.length||/envato/i.test(JSON.stringify(window.__coverhit.carpetEntry)));
   const file=`${licensed?'licensed-stock-':''}${state}.png`;
   if(width===800||width===1440)await page.screenshot({path:`${folder}/${file}`});
   report.push({width,height,state,issues:failures,errors:[...errors],file:width===800||width===1440?`${folder}/${file}`:null});console.log(`${width}x${height} ${state}: ${failures.length} issues`);
  };
  const count=await page.evaluate(()=>window.__coverhit.hud.modal.pages.length);
  for(let i=0;i<count;i++){const cpuMs=await page.evaluate(i=>{const start=performance.now();window.__coverhit.hud.modal.go(i);return performance.now()-start;},i);await snap(`menu-page-${i+1}`);report.at(-1).modalCpuMs=cpuMs;}
  await page.evaluate(()=>window.__coverhit.hud.modal.go(1));await page.locator('[data-next]').click();await snap('beater-locked');
  await page.keyboard.press('ArrowRight');await snap('settings-keyboard');
  // Native range arrows must change the value without paging.
  const range=page.locator('[data-setting-volume]');await range.focus();const before=await range.inputValue();const pageIndex=await page.evaluate(()=>window.__coverhit.hud.modal.index);await page.keyboard.press('ArrowLeft');if(await range.inputValue()===before||await page.evaluate(()=>window.__coverhit.hud.modal.index)!==pageIndex)throw Error('Slider arrow handling failed');
  await page.locator('[data-action]').click();await page.waitForFunction(()=>window.__coverhit.game.state==='playing');await snap('playing');
  await page.locator('.ch-stats').evaluate(n=>n.open=true);await snap('playing-statistics');
  await page.keyboard.press('Escape');await snap('paused-menu');await page.keyboard.press('Enter');
  if(await page.evaluate(()=>window.__coverhit.hud.blocking))throw Error('Resume failed');
  await page.evaluate(()=>window.__coverhit.hud.toast('Соседка: «Последний раз предупреждаю!»'));await snap('toast');
  await page.evaluate(()=>{const {hud,game}=window.__coverhit;game.setState('carpetDone');hud.showResults({attempts:38,hits:32,bestCombo:8,seconds:74.5,hitPoints:2840},480);});await snap('carpet-done');
  await page.locator('[data-action]').click();await page.waitForFunction(()=>window.__coverhit.game.state==='playing');await snap('next-carpet');
  await page.evaluate(()=>{const {hud,progression}=window.__coverhit;progression.total=2;hud.showUnlock([hud.beaters[1],hud.beaters[2]]);});await snap('unlock');await page.keyboard.press('Enter');await snap('unlock-second');await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__coverhit.hud.toast('Не удалось загрузить ковёр',async()=>{window.__retryWorked=true;}));await snap('retry');await page.keyboard.press('Enter');if(!await page.evaluate(()=>window.__retryWorked))throw Error('Retry callback failed');
  await page.evaluate(()=>window.__coverhit.game.setState('gameOver'));await snap('game-over');await page.locator('[data-action]').click();await page.waitForFunction(()=>window.__coverhit.game.state==='playing');await snap('restart');
  // Restore focus to the invoking control and wrap keyboard focus both ways.
  await page.locator('[data-reticle]').focus();await page.keyboard.press('Escape');await page.keyboard.press('Shift+Tab');const last=await page.evaluate(()=>document.activeElement===window.__coverhit.hud.modal.primary);if(!last)throw Error('Reverse focus trap failed');await page.keyboard.press('Tab');if(!await page.evaluate(()=>document.activeElement===window.__coverhit.hud.modal.host.querySelector('[data-modal-close]')))throw Error('Forward focus trap failed');await page.keyboard.press('Escape');if(!await page.evaluate(()=>document.activeElement===window.__coverhit.hud.nodes.reticle))throw Error('Focus restoration failed');
  if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
}finally{await browser.close();await mkdir('docs/qa/ui2',{recursive:true});await writeFile(`docs/qa/ui2/${fallback?'fallback-':live?'live-':''}fit-results.json`,JSON.stringify(report,null,2));}
const failed=report.filter(r=>r.issues.length||r.errors.length);if(failed.length){console.error(JSON.stringify(failed,null,2));process.exitCode=1;}else console.log(fallback?'Passed startup retry with WebGL unavailable at 800x700.':`Passed ${report.length} UI states at five viewports; keyboard, retry and focus checks passed.`);
