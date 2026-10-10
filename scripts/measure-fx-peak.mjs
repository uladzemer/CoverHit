import { chromium } from 'playwright';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:'ignore'});
const url=`http://127.0.0.1:${port}/`;
for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
 await page.goto(url+'fx/SOURCES.md');
 const report=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),{DustSystem}=await import('/src/fx/dust.js'),{MothSystem}=await import('/src/fx/moths.js');
  document.body.innerHTML='';const renderer=new THREE.WebGLRenderer();renderer.setSize(1280,900);document.body.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1280/900,.01,100);camera.position.set(0,1.5,3);camera.lookAt(0,1.3,0);
  const sun=new THREE.DirectionalLight('#ffcf9c',2);sun.position.set(-1,1,-4);scene.add(sun,sun.target,new THREE.HemisphereLight('#ccdce6','#5d564c',1.5));
  const dust=new DustSystem(scene),moths=new MothSystem(scene);await new Promise(r=>setTimeout(r,250));
  const p=new THREE.Vector3(0,1.3,.1),n=new THREE.Vector3(0,0,1);let start=performance.now();for(let i=0;i<100;i++)dust.emit(p,n,.08);const saturatedEmitMeanMs=(performance.now()-start)/100;
  for(let id=0;id<30;id++)moths.spawn({id},p);dust.update(.5);moths.update(.5);
  for(let i=0;i<10;i++)renderer.render(scene,camera);
  const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  async function timeGPU(){if(!ext)return null;const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);renderer.render(scene,camera);gl.endQuery(ext.TIME_ELAPSED_EXT);for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){const ms=gl.getParameter(ext.GPU_DISJOINT_EXT)?null:gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);return ms;}}gl.deleteQuery(q);return null;}
  const gpu=[];for(let i=0;i<20;i++){const t=await timeGPU();if(t!==null)gpu.push(t);}
  start=performance.now();for(let i=0;i<1000;i++){dust.update(.00001);moths.update(.00001);}const combinedUpdateMeanMs=(performance.now()-start)/1000;
  renderer.info.reset();renderer.render(scene,camera);
  const fallback=new DustSystem({capacity:32}),saved=dust.material.uniforms.atlas.value;dust.material.uniforms.atlas.value=fallback.texture;dust.material.uniforms.tiled.value=0;renderer.render(scene,camera);dust.material.uniforms.atlas.value=saved;
  return {combinedParticles:dust.liveCount+moths.scales.liveCount,mainPool:dust.capacity,mothScalePool:moths.scales.capacity,moths:moths.moths.size,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,saturatedEmitMeanMs,combinedUpdateMeanMs,isolatedGPU:{mean:gpu.reduce((a,b)=>a+b,0)/gpu.length,min:Math.min(...gpu),max:Math.max(...gpu),samples:gpu.length},fallbackShaderRendered:true};
 });
 report.errors=errors;await writeFile('docs/qa/fx/peak.json',JSON.stringify(report,null,2));console.log(report);if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();server.kill();}
