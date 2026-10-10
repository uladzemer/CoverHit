import {it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {chromium} from '../scripts/qa-browser.mjs';

// Real-layout check needs a local Chrome; skip where none is installed (e.g. CI without Playwright browsers).
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const hasChrome=Boolean(chromePath&&existsSync(chromePath));

// Use the actual HUD markup and styles in a layout engine: DOM mocks cannot
// detect media-query, font-size or expanded-panel overlaps.
it.skipIf(!hasChrome)('keeps HUD panels outside the central 60% at small, short and desktop sizes',async()=>{
 const css=['tokens','hud'].map(name=>readFileSync(`src/ui/${name}.css`,'utf8')).join('\n');
 const source=readFileSync('src/ui/hud.js','utf8'),markup=source.match(/this.root.innerHTML = `([\s\S]*?)`;/)[1];
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});
 try {
  for(const [width,height] of [[800,700],[1024,640],[1440,900],[360,740],[390,844],[430,932],[844,390],[740,360]]){
   const page=await browser.newPage({viewport:{width,height}});
   // Simulate notches/home indicators as well as the zero-inset desktop cases.
   const phone=width<=600||height<=500;
   const insetCss=phone?css.replaceAll('env(safe-area-inset-top)','44px').replaceAll('env(safe-area-inset-bottom)','21px').replaceAll('env(safe-area-inset-left)',height<500?'44px':'0px').replaceAll('env(safe-area-inset-right)',height<500?'44px':'0px'):css;
   await page.setContent(`<style>body{margin:0}${insetCss}</style><div class="coverhit-hud" data-state="playing">${markup}</div>`);
   await page.evaluate(()=>{
    document.querySelector('[data-screen]').hidden=true;document.querySelector('[data-reward]').hidden=true;
    document.querySelector('[data-type]').textContent='Ковёр шерстяной';
    document.querySelector('[data-carpet-title]').textContent='Красный с медальоном';
    document.querySelector('[data-reticle]').textContent='Прицел: крупный · R';
    document.querySelector('[data-reticle]').dataset.icon='◎';document.querySelector('[data-mute]').dataset.icon='♪';
   });
   for(const expanded of [false,true]){
    await page.locator('.ch-stats').evaluate((node,open)=>node.open=open,expanded);
    const overlaps=await page.locator('.ch-zone').evaluateAll(nodes=>nodes.flatMap(node=>{
     if (getComputedStyle(node).display==='none') return [];
     const r=node.getBoundingClientRect(),w=innerWidth,h=innerHeight;
     return r.left<w*.8&&r.right>w*.2&&r.top<h*(w<=600||h<=500?.75:.8)&&r.bottom>h*(w<=600||h<=500?.25:.2)?[{class:node.className,rect:r.toJSON()}]:[];
    }));
    expect(overlaps,`${width}x${height}, expanded=${expanded}`).toEqual([]);
   }
   const iconOnly=await page.locator('.ch-toggles button').first().evaluate(node=>getComputedStyle(node).fontSize==='0px');
   expect(iconOnly).toBe(width<1000||height<760);
   await page.close();
  }
 } finally {await browser.close();}
},30000);
