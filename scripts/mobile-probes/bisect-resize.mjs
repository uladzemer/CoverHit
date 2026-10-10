import {webkit,devices} from 'playwright';
import {startPresentedGame,verifyPresentedPixels} from './presented-pixels.mjs';
const browser=await webkit.launch();
for(const mode of ['direct-control','direct-dpr','copy-dpr','copy-downgrade']) {
 const context=await browser.newContext({...devices['iPhone 14 Pro']}),page=await context.newPage();
 const url=new URL(process.env.MOBILE_URL||'http://127.0.0.1:5323/CoverHit/');url.searchParams.set('lite','1');
 await page.goto(url.href);
 await startPresentedGame(page);
 await page.evaluate(mode=>{
  const h=window.__coverhit;h.renderPipeline.sampleFrame=()=>{};
  if(mode.startsWith('direct'))h.renderPipeline.render=()=>h.renderer.render(h.scene,h.camera);
 },mode);
 await page.waitForTimeout(1200);
 try {console.log(mode,'before',await verifyPresentedPixels(page));}catch(e){console.log(mode,'before',e.message);}
 await page.evaluate(mode=>{
  const h=window.__coverhit;
  if(mode==='copy-downgrade')h.setQuality('minimal');
  else if(mode.endsWith('dpr')){h.renderer.setPixelRatio(.75);h.renderer.setSize(innerWidth,innerHeight);}
 },mode);
 await page.waitForTimeout(1500);
 console.log(mode,'buffer',await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
  const h=window.__coverhit;h.renderPipeline.render(0);
  const gl=h.renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
  gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let min=255,max=0;for(let i=0;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);}
  resolve({redRange:[min,max],error:gl.getError(),lost:gl.isContextLost(),output:[gl.drawingBufferWidth,gl.drawingBufferHeight]});
 }))));
 try {console.log(mode,'after',await verifyPresentedPixels(page));}catch(e){console.log(mode,'after',e.message);}
 await context.close();
}
await browser.close();
