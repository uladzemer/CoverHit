import {chromium,webkit,devices} from 'playwright';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {stats} from './colour-metrics.mjs';
import {measureSunPresence} from '../../docs/qa/mobile-sun/sun-metrics.mjs';
const arg=name=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=')[1];
const phase=arg('phase')||'after',engine=arg('engine')||'webkit',requested=arg('profile');
const out=arg('out')||'docs/qa/mobile-bright';await mkdir(out,{recursive:true});
let baselineServer,baselineUrl;
if(process.argv.includes('--baseline')){
 const originals=new Map(['lighting.js','renderPipeline.js','presentPass.js'].map(file=>[file,execFileSync('git',['show',`HEAD:src/scene/${file}`],{encoding:'utf8'})]));
 const {createServer}=await import('vite');
 baselineServer=await createServer({plugins:[{name:'sun-baseline',enforce:'pre',transform(code,id){const file=id.replaceAll('\\','/').split('/src/scene/')[1];return originals.get(file)||null;}}],server:{host:'127.0.0.1',port:0,hmr:false}});
 await baselineServer.listen();baselineUrl=baselineServer.resolvedUrls.local[0];
}
let localRed,qaManifest;
if(arg('local-red')){
 const local=JSON.parse(await readFile('public/carpets/manifest.local.json','utf8'));
 localRed=local.find(e=>e.id==='envato-B7PV8QR');assert(localRed,'Local red medallion requested but missing');
 await access(`public/carpets/${localRed.file}`);
 // QA-only museum slot passes production's envato exclusion and the rotation
 // whitelist. No
 // private scan/manifest is added to the build or normal phone requests.
 qaManifest=JSON.parse(await readFile('public/carpets/manifest.json','utf8')).filter(e=>e.id!=='01');qaManifest.push({...localRed,id:'01'});
}
const browser=await (engine==='webkit'?webkit:chromium).launch(engine==='chromium'?{channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
const report={phase,engine,...(localRed?{localRed:localRed.id}:{}),method:'CSS composited screenshot; eroded GPU carpet mask; same visible UV source scan; central 60% frame; Rec.709 sRGB luminance',rows:[],errors:[]};
const pixels=async b=>sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true});
try{
 for(const [width,height] of arg('desktop')?[[1440,900]]:process.argv.includes('--portrait')?[[393,852]]:arg('device')==='se'?[[375,667],[667,375]]:engine==='chromium'?[[412,915],[915,412]]:[[393,852],[852,393]])for(const profile of requested?(requested==='full'?['full']:['full',requested]):['full','lite','minimal']){
 const context=await browser.newContext(arg('desktop')?{viewport:{width,height}}:{...devices[engine==='webkit'?(arg('device')==='se'?'iPhone SE':'iPhone 14 Pro'):'Pixel 7'],viewport:{width,height}}),page=await context.newPage();
 page.on('pageerror',e=>{report.errors.push(e.message);console.log('Page error',e.message);});
 if(qaManifest)await page.route('**/carpets/manifest.json',r=>r.fulfill({json:qaManifest}));
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{if(cb.name==='frame'){window.qaNext=cb;return 0;}return raf(cb);};});
 const url=new URL(baselineUrl||process.env.COLOUR_URL||'http://127.0.0.1:5173/');url.search=`${profile}=1&seed=colour-1986`;
 console.log('Opening',url.href,width,height);await page.goto(url.href,{waitUntil:'domcontentloaded'});console.log('Loaded');try{await page.waitForFunction(()=>window.__coverhit?.hud,null,{timeout:60000,polling:100});}catch(e){console.log(await page.evaluate(()=>({boot:window.__bootDiagnosticsText?.(),text:document.body.innerText})));throw e;}console.log('Ready');
 await page.evaluate(async()=>{const a=window.__coverhit;await a.start();const waiting=[];a.scene.traverse(o=>{for(const m of [o.material].flat())if(m?.userData.photoReady)waiting.push(m.userData.photoReady);});await Promise.allSettled(waiting);window.qaDrawCount=0;window.qaDraw=()=>a.renderPipeline.render(0);let previous=-Infinity;const draw=now=>{if(now-previous>=33){window.qaDraw();window.qaDrawCount++;previous=now;}requestAnimationFrame(draw);};requestAnimationFrame(draw);});
 await page.addStyleTag({content:'.coverhit-hud,.ch-reticle-fallback,.beater-charge{visibility:hidden!important}'});
 if(process.argv.includes('--sun')){
  const sun=await measureSunPresence(page,`${out}/${phase}-${engine}-${width}x${height}-${profile}-sun.png`);
  report.sun??=[];report.sun.push({width,height,profile,...sun});console.log('Sun presence',JSON.stringify(report.sun.at(-1)));
 }
 for(const id of process.argv.includes('--sun-only')?[]:localRed?['01']:['03','05','09']){
 await page.evaluate(async id=>{const a=window.__coverhit;await a.setCarpet(id);a.renderPipeline.sampleFrame=()=>{};a.dirt.grid.fill(0);a.dirt.texture.needsUpdate=true;a.beater.group.visible=false;a.scene.getObjectByName('carpet-aim-reticle').visible=false;a.scene.updateMatrixWorld(true);a.renderPipeline.render(0);window.qaDrawCount=0;},id);
 const selected=await page.evaluate(()=>({id:window.__coverhit.carpetEntry.id,file:window.__coverhit.carpetEntry.file}));
 assert.equal(selected.id,id,'Requested rug must be selected');if(localRed)assert.equal(selected.file,localRed.file);
 const tag=`${phase}-${engine}-${width}x${height}-${profile}-${localRed?'local-red':id}`;
 await page.waitForFunction(()=>window.qaDrawCount>=3,null,{polling:50});await page.waitForTimeout(100);const rendered=await pixels(await page.screenshot({path:`${out}/${tag}.png`,scale:'css'}));
 const capture=async mode=>{
 await page.evaluate(async mode=>{const T=await import('/node_modules/three/build/three.module.js'),a=window.__coverhit,mesh=a.scene.getObjectByName('carpet');
 window.qaRestore=[];a.scene.traverse(o=>{if(o.material&&o!==mesh){window.qaRestore.push([o,o.material]);o.material=new T.MeshBasicMaterial({color:0,side:T.DoubleSide});}});
 window.qaBG=a.scene.background;window.qaFog=a.scene.fog;window.qaTone=a.renderer.toneMapping;a.scene.background=new T.Color(0);a.scene.fog=null;a.renderer.toneMapping=T.NoToneMapping;
 window.qaMat=mesh.material;const m=mesh.material.clone(),compile=mesh.material.onBeforeCompile;m.onBeforeCompile=function(s,r){compile.call(this,s,r);s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',mode==='mask'?'gl_FragColor=vec4(1.0);':'outgoingLight=diffuseColor.rgb;\n#include <opaque_fragment>').replace('gl_FragColor.a = 0.0;','gl_FragColor.a = 1.0;');};m.customProgramCacheKey=()=>`qa-${mode}`;mesh.material=m;window.qaDrawCount=0;window.qaDraw=()=>{a.renderer.clear(true,true,true);a.renderer.render(a.scene,a.camera);};},mode);
 await page.waitForFunction(()=>window.qaDrawCount>=3,null,{polling:50});await page.waitForTimeout(100);const image=await pixels(await page.screenshot({scale:'css'}));
 await page.evaluate(()=>{const a=window.__coverhit,mesh=a.scene.getObjectByName('carpet');mesh.material.dispose();mesh.material=window.qaMat;for(const[o,m]of window.qaRestore){o.material.dispose();o.material=m;}a.scene.background=window.qaBG;a.scene.fog=window.qaFog;a.renderer.toneMapping=window.qaTone;window.qaDraw=()=>a.renderPipeline.render(0);});return image;
 };
 const mask=await capture('mask'),source=await capture('source'),indices=[],centre=[];
 for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){if([[0,0],[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>mask.data[((y+dy)*width+x+dx)*3]>250))indices.push((y*width+x)*3);if(x>width*.2&&x<width*.8&&y>height*.2&&y<height*.8)centre.push((y*width+x)*3);}
 const s=stats(source.data,indices),r=stats(rendered.data,indices),shift=Math.abs(s.hue-r.hue);
 const row={width,height,profile,id,source:s,carpet:r,centre:stats(rendered.data,centre),hueShift:Math.min(shift,360-shift),saturationRetention:r.saturation/s.saturation};report.rows.push(row);console.log(JSON.stringify(row));
 }
 await context.close();
 }
}finally{await browser.close();await baselineServer?.close();await writeFile(`${out}/${phase}-${engine}${requested?`-${requested}`:''}${arg('desktop')?'-desktop':''}${localRed?'-local-red':''}.json`,JSON.stringify(report,null,2));}
assert.equal(report.errors.length,0,report.errors.join('\n'));
if(process.argv.includes('--strict-sun'))for(const row of report.sun||[]){
 if(row.width>row.height)continue;
 assert(row.lit.pixels>100&&row.shade.pixels>100,'Sun region masks must contain enough pixels');
 assert(row.litShadeRatio>=1.4,`${row.profile}: warm key contrast`);
 assert(row.shadowCoverage>=.1&&row.shadowCoverage<=.35,`${row.profile}: shadow coverage ${row.shadowCoverage}`);
 assert(row.lit.redBlue>=1.25&&row.shade.redBlue<=1,`${row.profile}: sun/shade temperature`);
 const full=report.sun.find(f=>f.profile==='full'&&f.width===row.width);
 if(full&&row.profile!=='full')for(const value of ['litShadeRatio','shadowCoverage'])assert(Math.abs(row[value]/full[value]-1)<=.2,`${row.profile}: ${value} vs full`);
 if(full&&row.profile!=='full')for(const region of ['lit','shade'])assert(Math.abs(row[region].redBlue/full[region].redBlue-1)<=.2,`${row.profile}: ${region} temperature vs full`);
}
if(phase==='after'&&!arg('desktop'))for(const r of report.rows){assert(r.source.pixels>500);assert(r.hueShift<=8,`${r.profile} ${r.id}: hue`);assert(r.saturationRetention>=.85,`${r.profile} ${r.id}: saturation`);assert(r.carpet.clippedPercent<=.5,`${r.profile} ${r.id}: clipping`);const full=report.rows.find(f=>f.profile==='full'&&f.width===r.width&&f.id===r.id);if(full)for(const k of ['carpet','centre'])assert(Math.abs(r[k].luminance/full[k].luminance-1)<=.15,`${r.profile} ${r.id} ${k}: exposure`);}
