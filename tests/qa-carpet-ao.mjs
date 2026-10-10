import {chromium} from '../scripts/qa-browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/qa/carpet-ao';await mkdir(out,{recursive:true});
// Local captures can contain licensed yard or rug assets.
await writeFile(`${out}/.gitignore`,'*.png\n');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;Math.random=()=>.375;});
  await page.goto('http://127.0.0.1:5173/?seed=carpet-ao');
  await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
  await page.evaluate(()=>window.__coverhit.start());
  await page.addStyleTag({content:'.coverhit-hud {visibility:hidden}'});
  const state=await page.evaluate(async()=>{
    const a=window.__coverhit;await a.setCarpet('09');a.beater.group.visible=false;const c=a.cloth;c.wind=0;
    for(let i=0;i<90;i++)c.integrate(1/60);c.refreshGeometry();
    return {id:a.carpetEntry.id,vertices:c.geometry.attributes.position.count,aoRange:[Math.min(...c.geometry.attributes.clothOcclusion.array),Math.max(...c.geometry.attributes.clothOcclusion.array)],renderer:a.renderer.getContext().getParameter(a.renderer.getContext().RENDERER)};
  });
  for(const [name,position,target] of [
    ['front',[.2,1.82,3.3],[0,1.5,0]],
    ['side',[3,1.6,.8],[0,1.5,0]],
    ['below',[.08,.65,0],[0,2.16,0]],
  ]){
    await page.evaluate(({position,target})=>{const a=window.__coverhit;a.camera.position.set(...position);a.camera.lookAt(...target);a.camera.updateMatrixWorld();a.renderer.render(a.yard.scene,a.camera);},{position,target});
    await page.screenshot({path:`${out}/${name}.png`});
  }
  const timing=await page.evaluate(async()=>{
    const a=window.__coverhit;
    const {carpetGeometry,carpetEntryType}=await import('/src/carpet/assets.js');
    const manifest=await (await fetch('/carpets/manifest.json')).json();
    const entries=Array.isArray(manifest)?manifest:manifest.carpets;
    const densest=entries.map(e=>{const g=carpetGeometry(carpetEntryType(e),e.aspect);return {id:e.id,count:(g.cols+1)*(g.rows+1)};}).sort((x,y)=>y.count-x.count)[0];
    await a.setCarpet(densest.id);
    const c=a.cloth,r=a.renderer,s=a.yard.sun;
    const mesh=a.yard.scene.getObjectByName('carpet'),ao=c.geometry.attributes.clothOcclusion;
    a.camera.position.set(.2,1.82,3.3);a.camera.lookAt(0,1.5,0);a.camera.updateMatrixWorld();
    const gl=r.getContext();
    const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    async function renderMs(){
      if(!extension){const t=performance.now();r.render(a.yard.scene,a.camera);gl.finish();return performance.now()-t;}
      const q=gl.createQuery();gl.beginQuery(extension.TIME_ELAPSED_EXT,q);r.render(a.yard.scene,a.camera);gl.endQuery(extension.TIME_ELAPSED_EXT);
      for(let n=0;n<200&&!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE);n++)await new Promise(resolve=>setTimeout(resolve,5));
      if(gl.getParameter(extension.GPU_DISJOINT_EXT))throw Error('Disjoint GPU timing sample');
      const ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);return ms;
    }
    const original={bias:s.shadow.bias,normalBias:s.shadow.normalBias,camera:{left:s.shadow.camera.left,right:s.shadow.camera.right,top:s.shadow.camera.top,bottom:s.shadow.camera.bottom,near:s.shadow.camera.near,far:s.shadow.camera.far}};
    const baseline=()=>{
      mesh.children[0].visible=false;mesh.customDepthMaterial=undefined;ao.array.fill(1);ao.needsUpdate=true;
      s.shadow.mapSize.set(1024,1024);s.shadow.bias=-.0003;s.shadow.normalBias=.025;
      Object.assign(s.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:85});
    };
    const enhanced=()=>{
      mesh.children[0].visible=true;mesh.customDepthMaterial=a.savedDepth;c.updateShading();
      s.shadow.mapSize.set(2048,2048);s.shadow.bias=original.bias;s.shadow.normalBias=original.normalBias;Object.assign(s.shadow.camera,original.camera);
    };
    a.savedDepth=mesh.customDepthMaterial;
    const results={baseline:[],enhanced:[]};
    for(let round=0;round<8;round++)for(const mode of round%2?['enhanced','baseline']:['baseline','enhanced']){
      (mode==='baseline'?baseline:enhanced)();s.shadow.camera.updateProjectionMatrix();s.shadow.map?.dispose();s.shadow.map=null;
      for(let i=0;i<10;i++)await renderMs();
      for(let i=0;i<12;i++)results[mode].push(await renderMs());
    }
    const iterations=1000,t=performance.now();for(let i=0;i<iterations;i++)c.updateShading();
    const updateMs=(performance.now()-t)/iterations;
    const median=arr=>arr.sort((x,y)=>x-y)[Math.floor(arr.length/2)];
    const baselineMs=median(results.baseline),enhancedMs=median(results.enhanced);
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {id:a.carpetEntry.id,vertices:c.geometry.attributes.position.count,device:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',timer:extension?'GPU timer query':'synchronous gl.finish wall clock',baselineMs,enhancedMs,updateMs,addedMs:enhancedMs-baselineMs+updateMs,samplesPerMode:96};
  });
  assert.equal(errors.length,0,errors.join('\n'));
  assert(state.aoRange.every(Number.isFinite));
  await writeFile(`${out}/report.json`,JSON.stringify({state,timing,errors},null,2));
  console.log(JSON.stringify({state,timing,errors},null,2));
  assert(timing.addedMs<=1.5,`Performance budget exceeded: ${timing.addedMs} ms`);
}finally{await browser.close();}
