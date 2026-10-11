import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from './qa-browser.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const uncapped=process.argv.includes('--uncapped'), baseline=process.argv.includes('--baseline');
let server;
if (baseline) {
 const files=['src/main.js','src/carpet/carpetMesh.js','src/carpet/dirt.js','src/fx/dirtyHints.js','src/game/state.js'];
 const originals=new Map(files.map(f=>[f,execFileSync('git',['show',`HEAD:${f}`],{encoding:'utf8'})]));
 server=await createServer({plugins:[{name:'feel-baseline',enforce:'pre',transform(code,id){const file=id.replaceAll('\\','/').split('/src/')[1];return originals.get('src/'+file)||null;}}],server:{host:'127.0.0.1',port:5185,strictPort:true}});await server.listen();
}
const browser=await chromium.launch({args:uncapped?['--disable-frame-rate-limit','--disable-gpu-vsync']:[],executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await page.goto(`${baseline?'http://127.0.0.1:5185/':(process.env.COLOUR_URL||'http://127.0.0.1:5184/')}?full=1&seed=feel-performance`);
 await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(()=>{const a=window.__coverhit;a.renderPipeline.sampleFrame=()=>{};a.setQuality('high');a.start();});
 await page.waitForTimeout(5000);
 const sample=()=>page.evaluate(()=>new Promise(resolve=>{const frames=[];function frame(){frames.push({...window.__coverhit.performance});if(frames.length===240)resolve({frames:frames.length,drawCalls:Math.max(...frames.map(f=>f.drawCalls)),meanCpuMs:frames.reduce((s,f)=>s+f.frameMs,0)/frames.length,meanIntervalMs:frames.reduce((s,f)=>s+f.intervalMs,0)/frames.length,meanPhysicsMs:frames.reduce((s,f)=>s+f.physicsMs,0)/frames.length,meanRenderMs:frames.reduce((s,f)=>s+f.renderMs,0)/frames.length});else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
 const idle=await sample();
 await page.evaluate(()=>{const a=window.__coverhit;for(let i=0;i<4;i++)a.hit(.3+i*.1,.25,.775);});
 const strikes=await sample();
 const report={profile:'full',quality:'high',uncapped,baseline,viewport:[1000,800],gpu:await page.evaluate(()=>{const gl=window.__coverhit.renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null;}),method:'240 real render frames per case after warmup; maximum total draws and mean entire-frame CPU, including physics and submission. Headless Chrome; wall scheduling and shader compilation are not GPU timings.',idle,strikes};
 await writeFile(`docs/qa/feel/performance${baseline?'-baseline':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert(idle.drawCalls<=150&&strikes.drawCalls<=150,'High draw budget');assert(idle.meanCpuMs<=6&&strikes.meanCpuMs<=6,'High CPU budget');
} finally {await browser.close();await server?.close();}
