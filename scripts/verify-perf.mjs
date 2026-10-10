import { chromium } from './qa-browser.mjs';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { cpus } from 'node:os';

const phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8)||'after';
const selectedCarpet=process.argv.find(a=>a.startsWith('--carpet='))?.slice(9);
// Reconstruct the pre-wave source in memory using read-only git diff. No files,
// index entries or concurrent agent edits are reset by the baseline comparison.
const baseline=process.argv.includes('--baseline'), originals=new Map();
if(baseline){
 const files=['src/main.js','src/carpet/cloth.js','src/carpet/layerCollision.js','src/carpet/assets.js','src/carpet/carpetMesh.js'];
 for(const file of files){
  const current=(await readFile(file,'utf8')).replaceAll('\r\n','\n').split('\n');
  const diff=execFileSync('git',['diff','--no-ext-diff','--',file],{encoding:'utf8'}).split('\n');
  const original=[];let cursor=0,inHunk=false;
  for(const line of diff){
   const hunk=line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
   if(hunk){const next=Number(hunk[1])-1;original.push(...current.slice(cursor,next));cursor=next;inHunk=true;continue;}
   if(!inHunk)continue;
   if(line[0]===' '){original.push(current[cursor++]);}
   else if(line[0]==='+')cursor++;
   else if(line[0]==='-')original.push(line.slice(1));
  }
  original.push(...current.slice(cursor));originals.set(file,original.join('\n'));
 }
}
const server=await createServer({plugins:[{name:'perf-baseline',enforce:'pre',transform(code,id){
 const file=id.replaceAll('\\','/').split('/src/')[1];
 if(file&&originals.has('src/'+file))code=originals.get('src/'+file);
 if(file==='carpet/carpetMesh.js'&&!code.includes('cloth.fringe=fringe;'))code=code.replace('cloth.updateShading=()=>','cloth.fringe=fringe;\n  cloth.updateShading=()=>');
 return file?code:null;
}}],server:{host:'127.0.0.1',port:0,hmr:false}});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:process.argv.includes('--uncapped')?['--disable-frame-rate-limit','--disable-gpu-vsync']:[]});
const report={viewport:[1440,900],phase,baseline,cpu:cpus()[0]?.model,browser:browser.version(),active:process.argv.includes('--active'),uncapped:process.argv.includes('--uncapped'),qualities:{},errors:[]};
try {
 for(const quality of ['high','medium','low']){
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.addInitScript(q=>localStorage.setItem('coverhit-quality',q),quality);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);
 await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(async carpetId=>{
  const a=window.__coverhit;await a.start();
  if(carpetId)await a.setCarpet(carpetId);
  const c=a.cloth;window.__perfPasses={};
  const wrap=(object,key,label)=>{if(!object?.[key])return;const original=object[key];object[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{if(label==='integrate')window.__perfPasses.integrateSteps=(window.__perfPasses.integrateSteps||0)+1;window.__perfPasses[label]=(window.__perfPasses[label]||0)+performance.now()-start;}};};
  for(const key of ['integrate','projectBar','projectLayers','clampVelocities','watchdog','readNodes','refreshGeometry'])wrap(c,key,key);
  wrap(c.world,'stepSimulation','ammo');
  wrap(a.dust,'update','dustMs');wrap(a.beater.raycaster,'intersectObjects','raycastMs');
  wrap(c.geometry,'computeVertexNormals','normalsMs');
  wrap(c,'updateShading','shadingMs');wrap(c.fringe,'update','fringeMs');
  wrap(c.renderGeometry,'computeVertexNormals','smoothNormalsMs');
  window.__perfNodeCount=c.body.get_m_nodes().size();
 },selectedCarpet);
  await page.evaluate(q=>window.__coverhit.setQuality(q),quality);
  await page.waitForTimeout(5000);
  report.qualities[quality]=await page.evaluate(active=>new Promise(resolve=>{
   const samples=[];window.__perfPasses={};
   function sample(){samples.push({...window.__coverhit.performance,...window.__perfPasses});window.__perfPasses={};
    if(active&&samples.length%36===0)window.__coverhit.hit(.45,.2,.9);
    if(samples.length<240)return requestAnimationFrame(sample);
    const stats=key=>{const v=samples.map(s=>s[key]??(key==='gpuMs'?NaN:0)).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v[v.length-1]}:null;};
    const a=window.__coverhit,gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu=gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER);
    resolve({carpet:a.carpetEntry.id,grid:[a.cloth.cols,a.cloth.rows],gpu,hardware:!/SwiftShader|llvmpipe/i.test(gpu),nodes:window.__perfNodeCount,meshes:(()=>{const list=[];a.scene.traverse(o=>{if(o.isMesh&&o.visible){list.push({name:o.name,material:o.material?.name,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.count??1),shadow:o.castShadow,instances:o.count});}});return list.sort((a,b)=>b.triangles-a.triangles).slice(0,15);})(),metrics:Object.fromEntries(['frameMs','physicsMs','renderMs','gpuMs','intervalMs','drawCalls','triangles','ammo','integrate','integrateSteps','projectBar','projectLayers','clampVelocities','watchdog','readNodes','refreshGeometry','dustMs','raycastMs','fringeMs','normalsMs','smoothNormalsMs','shadingMs'].map(k=>[k,stats(k)])),fps:1000/stats('intervalMs').mean});
   }requestAnimationFrame(sample);
  }),report.active);
  await page.close();
 }
}finally{
 await mkdir('docs/qa/perf',{recursive:true});
 await writeFile(`docs/qa/perf/${phase}.json`,JSON.stringify(report,null,2));
 await browser.close();await server.close();
}
console.log(JSON.stringify({phase,qualities:Object.fromEntries(Object.entries(report.qualities).map(([q,v])=>[q,{fps:v.fps,cpu:v.metrics.frameMs,gpu:v.metrics.gpuMs,drawCalls:v.metrics.drawCalls.mean,triangles:v.metrics.triangles.mean}]))},null,2));
if(report.errors.length)process.exitCode=1;
