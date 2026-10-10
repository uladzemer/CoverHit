import {chromium} from './qa-browser.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:800,height:700}});
 await page.goto(process.env.YARD_URL||'http://127.0.0.1:5178');
 await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 console.log(JSON.stringify(await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),a=window.__coverhit,r=new T.Raycaster();
  return [[250,120],[350,120],[430,130]].map(([x,y])=>{
   r.setFromCamera(new T.Vector2(x/400-1,1-y/350),a.camera);
   return {pixel:[x,y],hits:r.intersectObject(a.yard.root,true).slice(0,3).map(h=>({name:h.object.name,parent:h.object.parent.name,point:h.point.toArray()}))};
  });
 }),null,2));
} finally {await browser.close();}
