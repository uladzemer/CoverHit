import sharp from 'sharp';
import assert from 'node:assert/strict';

function lab(rgb) {
  const [r,g,b]=rgb.map(v=>{v/=255;return v>.04045?((v+.055)/1.055)**2.4:v/12.92;});
  const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
  const x=f((r*.4124564+g*.3575761+b*.1804375)/.95047);
  const y=f(r*.2126729+g*.7151522+b*.0721750);
  const z=f((r*.0193339+g*.1191920+b*.9503041)/1.08883);
  return [116*y-16,500*(x-y),200*(y-z)];
}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const bodyLab=lab([181,141,123]);

export async function startPresentedGame(page) {
  await page.waitForFunction(()=>window.__coverhit?.hud&&!document.querySelector('.physics-loading'),null,{timeout:60000});
  await page.locator('button.ch-primary:visible').first().tap();
  await page.waitForFunction(()=>window.__coverhit.game.state==='playing'&&!window.__coverhit.hud.blocking);
  await page.evaluate(async()=>{
    const waiting=new Set();window.__coverhit.scene.traverse(o=>{
      for(const m of [o.material].flat())if(m?.userData.photoReady)waiting.add(m.userData.photoReady);
    });await Promise.allSettled([...waiting]);
  });
}

// Screenshots come from the browser compositor. Hide UI during measurement so
// a modal/counter/reticle cannot make an unpresented WebGL canvas pass.
export async function verifyPresentedPixels(page, path) {
  const rects=await page.evaluate(()=>{
    const h=window.__coverhit,canvas=h.renderer.domElement,r=canvas.getBoundingClientRect();
    const mesh=h.scene.getObjectByName('carpet');mesh.geometry.computeBoundingBox();mesh.updateWorldMatrix(true,false);h.camera.updateMatrixWorld();
    const box=mesh.geometry.boundingBox;
    const transform=(p,m)=>[0,1,2,3].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]*p[3]);
    const points=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      let p=transform([x,y,z,1],mesh.matrixWorld.elements);p=transform(p,h.camera.matrixWorldInverse.elements);p=transform(p,h.camera.projectionMatrix.elements);
      points.push([r.x+(p[0]/p[3]+1)*r.width/2,r.y+(1-p[1]/p[3])*r.height/2]);
    }
    return {canvas:{x:r.x,y:r.y,width:r.width,height:r.height},carpet:{x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),width:Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),height:Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))}};
  });
  const hide=await page.addStyleTag({content:'.coverhit-hud, .reticle, .charge-arc {visibility:hidden!important}'});
  const background=await page.evaluate(()=>({body:document.body.style.background,html:document.documentElement.style.background}));
  try {
    const shot=await page.screenshot({scale:'css',...(path?{path}:{})});
    const {data,info}=await sharp(shot).raw().toBuffer({resolveWithObject:true});
    function region(r,inset=0) {
      let n=0,sum=0,sq=0,body=0,rgb=[0,0,0];
      for(let y=Math.max(0,Math.ceil(r.y+r.height*inset));y<Math.min(info.height,r.y+r.height*(1-inset));y++)
        for(let x=Math.max(0,Math.ceil(r.x+r.width*inset));x<Math.min(info.width,r.x+r.width*(1-inset));x++){
          const i=(y*info.width+x)*info.channels,c=[data[i],data[i+1],data[i+2]],l=c[0]*.2126+c[1]*.7152+c[2]*.0722;
          n++;sum+=l;sq+=l*l;for(let j=0;j<3;j++)rgb[j]+=c[j];if(distance(lab(c),bodyLab)<8)body++;
        }
      assert(n>100,'Pixel sample must cover a meaningful region');
      return {sd:Math.sqrt(Math.max(0,sq/n-(sum/n)**2)),bodyFraction:body/n,rgb:rgb.map(v=>v/n)};
    }
    const centre=region(rects.canvas,.2),carpet=region(rects.carpet,.3);
    const sky=region({x:rects.canvas.x+rects.canvas.width*.45,y:rects.canvas.y+rects.canvas.height*.08,width:rects.canvas.width*.1,height:rects.canvas.height*.06});
    const carpetSkyDeltaE=distance(lab(carpet.rgb),lab(sky.rgb));
    await page.evaluate(()=>{document.body.style.background='#00ff00';document.documentElement.style.background='#00ff00';});
    await page.waitForTimeout(200);
    const greenShot=await page.screenshot({scale:'css',...(path?{path:path.replace(/\.png$/,'-green.png')}:{})});
    const greenImage=await sharp(greenShot).raw().toBuffer({resolveWithObject:true});let green=0,n=0;
    const r=rects.canvas;
    for(let y=Math.max(0,Math.ceil(r.y));y<Math.min(greenImage.info.height,r.y+r.height);y++)for(let x=Math.max(0,Math.ceil(r.x));x<Math.min(greenImage.info.width,r.x+r.width);x++){
      const i=(y*greenImage.info.width+x)*greenImage.info.channels;n++;
      if(greenImage.data[i]<20&&greenImage.data[i+1]>235&&greenImage.data[i+2]<20)green++;
    }
    const result={luminanceSD:+centre.sd.toFixed(2),bodyPercent:+(100*centre.bodyFraction).toFixed(2),carpetSkyDeltaE:+carpetSkyDeltaE.toFixed(2),greenPercent:+(100*green/n).toFixed(2)};
    assert(centre.sd>12,`Canvas luminance SD <= 12: ${JSON.stringify(result)}`);
    assert(centre.bodyFraction<.4,`Canvas must differ from body on >60% of central pixels: ${JSON.stringify(result)}`);
    assert(carpetSkyDeltaE>8,`Carpet must differ from sky: ${JSON.stringify(result)}`);
    assert(green/n<.05,`Canvas is transparent/unpresented: ${JSON.stringify(result)}`);
    return result;
  } finally {
    await hide.evaluate(node=>node.remove());
    await page.evaluate(background=>{document.body.style.background=background.body;document.documentElement.style.background=background.html;},background);
  }
}
