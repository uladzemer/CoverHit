import {chromium} from './qa-browser.mjs';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {physicsSourceHash} from './flip-amplitude-physics.mjs';

const out='docs/qa/flipamp';await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
const errors=[],results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;Math.random=()=>.375;});
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
  await page.evaluate(()=>window.__coverhit.start());
  for(const id of ['05','03'])for(const hz of [60,30])for(const style of ['both','corner']) {
    await page.evaluate(id=>window.__coverhit.setCarpet(id),id);
    for(const direction of [0,1]) {
      const result=await page.evaluate(async ({style,hz,direction})=>{
        const {measureThrow}=await import('/scripts/flip-amplitude-probe.js');
        const a=window.__coverhit,c=a.cloth;c.wind=1;
        const result=measureThrow(c,style,hz,`amplitude-${direction}`,()=>{c.refreshGeometry();a.renderPipeline.render(1/hz);});
        return {...result,cols:c.cols,rows:c.rows,axis:c.barAxis,side:c.visibleSide,width:c.width,height:c.height};
      },{style,hz,direction});
      const {samples,...metrics}=result;results.push({carpet:id,direction,...metrics});
      if(id==='05'&&hz===60&&direction===0&&!process.argv.includes('--no-images')) {
        const selected=Array.from({length:12},(_,j)=>samples[Math.min(samples.length-1,Math.round(j*(samples.length-1)/11))]);
        await writeFile(`${out}/${style}-positions.json`,JSON.stringify({cols:result.cols,rows:result.rows,axis:result.axis,frames:selected}));
        for(const view of ['front','side']) {
          const captures=[];
          for(const frame of selected) {
            await page.evaluate(({frame,view})=>{
              const a=window.__coverhit,c=a.cloth;c.positions.set(frame.positions);c.setVisibleSide(frame.side);c.refreshGeometry();
              const mesh=a.beater.carpetMeshGetter();mesh.updateWorldMatrix(true,false);
              const target=a.lookTarget.clone();
              if(view==='side'){target.set(0,c.barAxis.y-.45,c.barAxis.z);mesh.localToWorld(target);a.camera.position.copy(target).add(target.clone().set(4.8,.2,.2));}
              else {a.camera.position.copy(a.baseCamera);target.y+=.3;}
              a.camera.lookAt(target);a.camera.updateMatrixWorld();a.renderPipeline.render(0);
            },{frame,view});
            const png=await page.locator('canvas').first().screenshot();
            const input=await sharp(png).resize(400,300).composite([{input:Buffer.from(`<svg width="400" height="300"><rect width="150" height="26" fill="white"/><text x="8" y="19" font-size="16">${style} ${frame.age.toFixed(2)}s</text></svg>`)}]).toBuffer();
            captures.push({input,left:captures.length%4*400,top:Math.floor(captures.length/4)*300});
          }
          await sharp({create:{width:1600,height:900,channels:3,background:'#f4f2ed'}}).composite(captures).png().toFile(`${out}/${style}-${view}.png`);
        }
        await page.evaluate(()=>{const a=window.__coverhit;a.camera.position.copy(a.baseCamera);a.camera.lookAt(a.lookTarget);a.camera.updateMatrixWorld();a.cloth.readNodes();a.cloth.refreshGeometry();});
      }
      console.log(JSON.stringify({carpet:id,hz,style,direction,peak:metrics.peak,sweep:metrics.sweep,duration:metrics.duration,jump:metrics.jump,spread:metrics.spread,recoveries:metrics.recoveries}));
    }
  }
  const passed=!errors.length&&results.every(r=>r.peak>=.55&&r.sweep>=1.6&&r.duration>=1.2&&r.duration<=1.7&&(r.hz!==60||r.jump<=.35)&&r.spread>=(r.style==='corner'?.25:.15)&&r.crestEndSpread>=(r.style==='corner'?.25:.15)&&r.extent<3&&r.speed<=9.00001&&!r.recoveries);
  await writeFile(`${out}/browser.json`,JSON.stringify({sourceHash:await physicsSourceHash(),passed,errors,results},null,2));if(!passed)process.exitCode=1;
} finally {await browser.close();await server.close();}
