import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
const out='docs/qa/carpets';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!!window.__coverhit,null,{timeout:60000});
 await page.addStyleTag({content:'.coverhit-hud {display:none!important}'});
 const manifest=JSON.parse(await readFile('public/carpets/manifest.json','utf8')),metrics=[],layers=[];
 for(const [i,entry] of manifest.entries()) {
  await page.evaluate(id=>window.__coverhit.setCarpet(id),entry.id);
  await page.evaluate(()=>{window.__coverhit.cloth.wind=0;window.__coverhit.dirt.grid.fill(0);window.__coverhit.dirt.total=0;window.__coverhit.dirt.texture.needsUpdate=true;});
  await page.waitForTimeout(2500);
  metrics.push(await page.evaluate(()=>{
   const api=window.__coverhit,c=api.cloth,map=api.beater.carpetMeshGetter().material.map;
   return {id:api.carpetEntry.id,aspect:api.carpetEntry.aspect,meshAspect:c.width/c.height,cols:c.cols,rows:c.rows,finite:c.positions.every(Number.isFinite),maxCoordinate:Math.max(...c.positions.map(Math.abs)),repeat:map.repeat.toArray(),offset:map.offset.toArray(),canvasTexture:!!map.isCanvasTexture};
  }));
  const file=`${out}/${entry.id}-rest.png`;await page.screenshot({path:file});
  if(!entry.id.startsWith('envato-'))layers.push({input:await sharp(file).resize(320,225).png().toBuffer(),left:i%5*320,top:Math.floor(i/5)*225});
 }
 await sharp({create:{width:1600,height:Math.ceil(manifest.filter(c=>!c.id.startsWith('envato-')).length/5)*225,channels:3,background:'#ccc'}}).composite(layers).png().toFile(`${out}/rotation.png`);
 const firstId=manifest.find(c=>c.easy)?.id ?? '09';
 await page.route(`**/carpets/${firstId}.webp`,route=>route.fulfill({status:404,body:'missing'}));await page.reload();await page.waitForFunction(()=>!!window.__coverhit,null,{timeout:60000});
 const fallback=await page.evaluate(()=>({id:window.__coverhit.carpetEntry.id,canvasTexture:!!window.__coverhit.beater.carpetMeshGetter().material.map.isCanvasTexture}));
 await writeFile(`${out}/browser.json`,JSON.stringify({metrics,blocked:firstId,fallback,errors},null,2));
 console.log(JSON.stringify({metrics,blocked:firstId,fallback,errors},null,2));
 if(errors.length||fallback.id===firstId||fallback.canvasTexture||metrics.some(c=>!c.finite||c.canvasTexture||Math.abs(c.meshAspect/c.aspect-1)>.005))throw Error('Carpet browser verification failed');
} finally {await browser.close();}
