import {createServer} from 'vite';
import {chromium} from './qa-browser.mjs';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
await mkdir('docs/qa/heavy',{recursive:true});
const prefix=process.cwd().replaceAll('\\','/')+'/';
for(const label of ['before','after']){
 const originals=new Map();
 if(label==='before')for(const file of ['src/main.js','src/game/frame.js','src/scene/wind.js','src/carpet/cloth.js','src/carpet/types.js','src/carpet/assets.js','src/carpet/fringe.js','src/fx/dust.js','src/fx/dust/shaders.js','src/fx/moths.js'])originals.set(file,execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'}));
 const server=await createServer({configFile:false,plugins:[{name:'snapshot',enforce:'pre',load(id){return originals.get(id.replaceAll('\\','/').slice(prefix.length).split('?')[0]);}}],server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:640,height:480}});
  await page.addInitScript(()=>{requestAnimationFrame=()=>1;Math.random=()=>.375;});
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
  await page.evaluate(async()=>{
   const a=window.__coverhit;await a.start();await a.setCarpet('03');
   const {Vector3,PerspectiveCamera}=await import('/node_modules/.vite/deps/three.js');
   const {panelIndices}=await import('/scripts/heavy-probe.js');
   const c=a.cloth;c.wind=0;for(let i=0;i<300;i++){a.wind.update(1/60);c.integrate(1/60);}c.refreshGeometry();
   const camera=new PerspectiveCamera(40,640/480,.1,1000);camera.position.set(2.7,1.4,2);camera.lookAt(0,1.4,0);camera.updateMatrixWorld();
   window.__capture={camera,step:0};
   let best=Infinity,id=0;for(const i of panelIndices(c)){const p=c.nodes.at(i).get_m_x(),s=Math.hypot(p.x(),p.y()-(c.barAxis.y-c.drop*.5));if(s<best){best=s;id=i;}}
   const p=c.nodes.at(id).get_m_x();c.applyImpulse(new Vector3(p.x(),p.y(),p.z()),new Vector3(0,0,-1),1);
   let seed=123;a.dust.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   a.dust.emit(new Vector3(p.x(),p.y()+2.15,p.z()),new Vector3(0,0,1),.025);
   for(const element of document.querySelectorAll('body *'))if(element.tagName!=='CANVAS'&&!element.querySelector('canvas'))element.style.visibility='hidden';
  });
  const times=[0,.12,.3,.55,.9,1.5,2.5,4],shots=[],frames=[];
  for(const target of times){
   const time=await page.evaluate(target=>{
    const a=window.__coverhit,q=window.__capture;
    const steps=Math.round(target*60);while(q.step<steps){a.wind.update(1/60);a.cloth.integrate(1/60);a.dust.update(1/60);q.step++;}
    a.cloth.refreshGeometry();a.renderer.render(a.scene,q.camera);return q.step/60;
   },target);frames.push(time);shots.push(await page.screenshot());
  }
  await sharp({create:{width:5120,height:480,channels:3,background:'#ffffff'}}).composite(shots.map((input,i)=>({input,left:i*640,top:0}))).png().toFile(`docs/qa/heavy/${label}-strip.png`);
  await writeFile(`docs/qa/heavy/${label}-strip.json`,JSON.stringify({view:'oblique',clock:'native fixed-step physical seconds; separate wall-clock audit in time.json',strength:1,frames},null,2));
  console.log({label,frames});
 }finally{await browser.close();await server.close();}
}
