import {it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {chromium} from '../scripts/qa-browser.mjs';
import {mkdirSync} from 'node:fs';
import sharp from 'sharp';

// Real-layout check needs a local Chrome; skip where none is installed (e.g. CI without Playwright browsers).
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const hasChrome=Boolean(chromePath&&existsSync(chromePath));

// Use the actual HUD markup and styles in a layout engine: DOM mocks cannot
// detect media-query, font-size or expanded-panel overlaps.
it.skipIf(!hasChrome)('keeps HUD panels outside the central 60% at small, short and desktop sizes',async()=>{
 const css=['tokens','hud'].map(name=>readFileSync(`src/ui/${name}.css`,'utf8').replace(/^\uFEFF/,'')).join('\n');
 const source=readFileSync('src/ui/hud.js','utf8'),markup=source.match(/this.root.innerHTML = `([\s\S]*?)`;/)[1];
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});
 try {
  for(const [width,height] of [[800,700],[1024,640],[1440,900],[320,568],[360,740],[393,852],[430,932],[844,390],[740,360]]){
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
   if(phone){
    await page.evaluate(()=>{const pop=document.createElement('div');pop.className='ch-score-pop ch-quality-excellent';pop.style.cssText='left:50%;top:50%';pop.innerHTML='<strong>+21</strong><small>Отлично</small>';document.querySelector('.coverhit-hud').append(pop);});
    expect(await page.locator('.ch-score-pop').evaluate(n=>({background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderTopWidth,size:getComputedStyle(n.querySelector('strong')).fontSize}))).toEqual({background:'rgba(0, 0, 0, 0)',border:'0px',size:'18px'});
    const plates=await page.locator('.ch-zone:visible').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {background:s.backgroundColor,image:s.backgroundImage,border:s.borderTopWidth,blur:s.backdropFilter,padding:s.padding};}));
    for(const p of plates)expect(p).toEqual({background:'rgba(0, 0, 0, 0)',image:'none',border:'0px',blur:'none',padding:'0px'});
    expect(await page.locator('[data-score]').evaluate(n=>n.getBoundingClientRect().height)).toBeLessThanOrEqual(28);
    mkdirSync('docs/qa/mobile-hud',{recursive:true});
    for(const background of ['#ffffff','#000000']){
     await page.evaluate(bg=>document.body.style.background=bg,background);
     const shot=await page.screenshot({path:`docs/qa/mobile-hud/contrast-${width}x${height}-${background.slice(1)}.png`});
     const {data,info}=await sharp(shot).removeAlpha().raw().toBuffer({resolveWithObject:true});
     const rect=await page.locator('[data-score]').evaluate(n=>n.getBoundingClientRect().toJSON());let fill=0,outline=0;
     const paper=[243,230,200],ink=[29,27,34];
     for(let y=Math.max(0,Math.floor(rect.top-2));y<Math.min(info.height,rect.bottom+2);y++)for(let x=Math.max(0,Math.floor(rect.left-2));x<Math.min(info.width,rect.right+2);x++){
      const i=(y*info.width+x)*3;if(paper.every((v,k)=>Math.abs(data[i+k]-v)<=2))fill++;if(ink.every((v,k)=>Math.abs(data[i+k]-v)<=2))outline++;
     }
     expect(fill).toBeGreaterThan(10);expect(outline).toBeGreaterThan(10);
     const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
     expect((luminance(paper)+.05)/(luminance(ink)+.05)).toBeGreaterThanOrEqual(4.5);
    }
   }
   await page.close();
  }
 } finally {await browser.close();}
},30000);
