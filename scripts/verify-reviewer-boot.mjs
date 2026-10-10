import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {rename,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const manifest=new URL('../public/carpets/manifest.local.json',import.meta.url);
const backup=new URL(`../public/carpets/manifest.local.json.${randomUUID()}.backup`,import.meta.url);
const original=await readFile(manifest).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
let server,browser,renamed=false;
try {
 if(original!==null){await rename(manifest,backup);renamed=true;}
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199','--strictPort'],{stdio:'pipe',windowsHide:true});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Vite startup timed out')),15000);server.stdout.on('data',data=>{if(data.toString().includes('5199')){clearTimeout(timeout);resolve();}});server.on('error',reject);});
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 const localResponse=page.waitForResponse(response=>response.url().endsWith('/carpets/manifest.local.json'));
 await page.goto('http://127.0.0.1:5199/');
 const response=await localResponse;
 await page.waitForFunction(()=>window.__coverhit && !document.querySelector('.physics-loading'),{timeout:60000});
 await page.evaluate(()=>window.__coverhit.start());
 const result=await page.evaluate(()=>({state:__coverhit.game.state,carpet:__coverhit.carpetEntry.id,canvas:!!document.querySelector('canvas')}));
 assert.equal(result.state,'playing');assert.equal(result.canvas,true);assert.deepEqual(errors,[]);
 // Exercise timeout cleanup with the real cloth and animation loop.
 await page.evaluate(()=>{__coverhit.game.remainingSeconds=.2;__coverhit.flip();});
 await page.waitForFunction(()=>__coverhit.game.state==='gameOver');
 assert.equal(await page.evaluate(()=>!__coverhit.game.flipping && !__coverhit.cloth.flip && __coverhit.game.visibleSide===__coverhit.cloth.visibleSide),true);
 console.log(JSON.stringify({localStatus:response.status(),contentType:response.headers()['content-type'],...result,errors,timeoutFlipCleanup:true}));
} finally {
 await browser?.close();server?.kill();
 if(renamed){await rename(backup,manifest);assert.deepEqual(await readFile(manifest),original);console.log('Local manifest restored byte-for-byte.');}
}
