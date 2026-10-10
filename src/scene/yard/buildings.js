import * as THREE from 'three';
import {createFacadeMaterial,facadeBox,facadeImpostorBox,facadeTint,FACADE_SERIES} from './facade.js';
import {createBatch} from './batch.js';

// Far 1-464 / 1-447 facades bake windows, sills and panel seams into one atlas.
// This keeps the enclosing blocks at 12 triangles each, including roof/end walls.
function facadeTexture(brick){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=250;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle=brick?'#b6aa95':'#bfc0b5';ctx.fillRect(0,0,1000,250);
 for(let row=0;row<5;row++)for(let col=0;col<20;col++){
  const x=col*50,y=row*50;
  ctx.fillStyle=brick?'#9d9282':'#8f958d';ctx.fillRect(x,y,1,50);ctx.fillRect(x,y,50,1);
  ctx.fillStyle='#d9d4be';ctx.fillRect(x+11,y+10,28,32);
  ctx.fillStyle=(row*7+col)%13===0?'#d8b778':['#515e60','#778384','#657373'][col%3];ctx.fillRect(x+13,y+12,24,27);
  ctx.fillStyle='#cccbb9';ctx.fillRect(x+25,y+12,2,27);ctx.fillRect(x+13,y+28,24,2);
  ctx.fillStyle='#8b8d82';ctx.fillRect(x+9,y+42,32,3);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}

// Incomplete licensed facades use our complete box atlas, never the bare mesh.
// Roof caps and vents share this group's coordinates and touch their supports.
export function createStockHousingFallback(entry,placements){
 const group=new THREE.Group();group.name=`yard-procedural-${entry.id}`;
 const b=createBatch(group),floors=entry.role==='horizon'?9:5;
 const width=entry.role==='horizon'?33:60,height=floors*2.7,depth=12;
 const map=facadeTexture(false),wall=createFacadeMaterial('panel',{map,color:'#b8b6ac'});
 wall.userData.castShadow=false;
 const roof=new THREE.MeshStandardMaterial({color:'#575b55',roughness:1});roof.userData.castShadow=false;
 const box=facadeBox(width,height,depth,'panel');
 for(const [x,y,z,,angle] of placements){
  const transform=new THREE.Matrix4().makeRotationY(angle);transform.setPosition(x,y,z);
  b.withTransforms([transform],()=>{
   b.add(box,wall,0,height/2,0,width,height,depth);
   b.cube(roof,0,height+.12,0,width+.3,.24,depth+.3);
   for(const dx of [-width*.3,width*.3])b.cube(roof,dx,height+.54,0,.7,.84,.7);
  });
 }
 b.flush();group.userData.proceduralFacade=true;
 return group;
}

export function buildHousing(b,m,random,root){
 const {cube,add,plane}=b;
 const glass=m.glass,lit=m.lit;
 const hideWindows=()=>()=>{}; // Visibility is retained per role by the static batcher.
 const housing=[],farMaterials=['panel','brick','nine'].map(series=>createFacadeMaterial(series,{color:series==='brick'?'#d4c8b5':'#d7d8cf',map:facadeTexture(series==='brick')},()=>{},false,true));
 const nearMaterials=[createFacadeMaterial('panel',{color:'#d7d8cf',map:facadeTexture(false)},hideWindows('panel')),createFacadeMaterial('brick',{color:'#d4c8b5',map:facadeTexture(true)},hideWindows('brick')),createFacadeMaterial('panel335',{color:'#d7d8cf',map:facadeTexture(false)},hideWindows('panel335'))];

 const farGeometry=new Map();
 // Distant housing receives atmosphere and sunlight without entering the play-area shadow pass.
 farMaterials.forEach(mat=>{mat.userData.castShadow=false;});
 function building(cx,cz,angle,brick=false,far=false,floors=5){
  housing.push({x:cx,z:cz,angle,width:60,depth:12,height:floors*2.7,variant:brick?'1-447':'1-464',lod:far?'far':'near'});
  if(far){
   const series=brick?'brick':floors===9?'nine':'panel',bay=FACADE_SERIES[series].bay,width=20*bay,depth=4*bay;Object.assign(housing.at(-1),{width,depth});
   const key=`${brick}-${floors}`;if(!farGeometry.has(key))farGeometry.set(key,facadeImpostorBox(width,floors*2.7,depth,series));
   const geometry=farGeometry.get(key);
   add(geometry,farMaterials[series==='nine'?2:Number(brick)],cx,floors*2.7/2,cz,width,floors*2.7,depth,0,angle,0,facadeTint(housing.length));
   return;
  }
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const at=(mat,x,y,z,sx,sy,sz,color)=>{const wallZ=z>=6&&z<=6.3?z+2*bay-6:z;cube(mat,cx+x*ca+wallZ*sa,y,cz-x*sa+wallZ*ca,sx,sy,sz,angle,color);};
  const pane=(mat,x,y,z,sx,sy,color)=>{const wallZ=z+2*bay-6;add(plane,mat,cx+x*ca+wallZ*sa,y,cz-x*sa+wallZ*ca,sx,sy,1,0,angle,0,color);};
  const wall=nearMaterials[cx>40?2:brick?1:0],bay=wall.userData.photoSeries==='brick'?3:3.1,width=20*bay,wallGeometry=facadeBox(width,13.5,4*bay,wall.userData.photoSeries,housing.length);
  Object.assign(housing.at(-1),{width,depth:4*bay});
  add(wallGeometry,wall,cx,6.75,cz,width,13.5,4*bay,0,angle);
  at(m.roof,0,13.65,0,width+.5,.25,4*bay+.5);at(m.trim,0,13.75,2*bay+.1,width,.13,.16);
  for(let floor=0;floor<5;floor++){
   const y=1.55+floor*2.7;
   b.setRole(`photo-window-${wall.userData.photoSeries}`);
   // Concrete panel joints follow the actual 3m structural bays.
   if(!brick)at(m.seam,0,floor*2.7,6.012,60,.026,.026);
   for(let col=0;col<20;col++){
    const x=(col-9.5)*bay;if(!brick)at(m.seam,x-bay/2,6.75,6.014,.035,13.5,.03);
    b.setRole(`photo-window-${wall.userData.photoSeries}`);
    at(m.recess,x,y,6.025,1.64,1.86,.09);
    const warm=random()<.12,mat=warm?lit:glass;
    pane(mat,x,y,6.086,1.48,1.67,warm?'#ffe2a7':['#718082','#45555a','#8a928e'][col%3]);
    pane(m.stain,x,y-1.46,6.022,1.9,.95);b.setRole(`photo-window-${wall.userData.photoSeries}`);
    pane(m.stain,x-.63,y-1.8,6.024,.14,1.1);
    for(const side of [-1,1])at(m.trim,x+side*.78,y,6.17,.065,1.83,.12);
    for(const side of [-1,1])at(m.trim,x,y+side*.885,6.17,1.62,.06,.12);
    at(m.trim,x+.14,y,6.19,.045,1.76,.09);at(m.trim,x,y+.3,6.18,1.55,.035,.08);
    at(m.concrete,x,y-.94,6.25,1.85,.10,.38);pane(m.stain,x,y-1.46,6.022,1.9,.95);pane(m.stain,x-.63,y-1.8,6.024,.14,1.1);
    if((col+floor)%3!==0){
     for(const side of [-1,1])pane(m.curtain,x+side*.48,y-.02,6.095,.40,1.58,warm?'#dfb87a':'#b2afa0');
     for(let fold=0;fold<4;fold++)at(m.curtainShade,x-.66+fold*.105,y,6.102,.021,1.58,.005);
    }
    if(warm)pane(m.glow,x,y,6.3,2.05,2.35);
    b.setRole('');
    if(floor>0 && col%4===2){
     at(m.concrete,x,floor*2.7+.075,2*bay+.35,2.55,.15,.7);
     at(m.painted,x,floor*2.7+.55,2*bay+.67,2.4,.9,.06);
     at(m.metal,x,floor*2.7+1.03,2*bay+.67,2.45,.055,.055);
     for(let j=0;j<11;j++)at(m.metal,x-1.2+j*.24,floor*2.7+.55,2*bay+.69,.026,.92,.03);
    }
   }
  }
  b.setRole('');
  for(const x of [-22,-7,8,23]){
   at(m.concrete,x,1.3,6.08,2.5,2.6,.25);at(m.door,x,1.13,6.26,1.66,2.26,.14);
   at(m.metal,x,1.13,6.35,.04,2.2,.035);at(m.trim,x+.5,1.1,6.36,.04,.24,.05);
   at(m.concrete,x,2.67,6.8,3.2,.16,1.8);at(m.concrete,x,.1,6.8,2.7,.2,1.7);
   // Slatted entrance bench, oriented with the facade.
   for(let j=0;j<4;j++)at(m.wood,x+3.4,.5,6.7+j*.14,2.3,.07,.11);
   for(let j=0;j<3;j++)at(m.wood,x+3.4,.78+j*.16,6.6,2.3,.12,.06);
   for(const dx of [-.85,.85])at(m.concrete,x+3.4+dx,.25,6.9,.22,.5,.55);
  }
 }
 building(32,-30.2,0);building(-37,-6,Math.PI/2,true);
 building(80.2,-8,-Math.PI/2,true);
 // Overlapping perimeter closes both facade gaps and both street ends. Facades
 // face the yard; the rotated side blocks read as a lived-in enclosed courtyard.
 building(-48,-62,.12,true,true);building(44,-88,-.08,false,true,9);
 building(-62,-7,Math.PI/2,false,true);building(94,-6,-Math.PI/2,false,true);
 building(-62,-55,Math.PI/2,true,true);building(94,-54,-Math.PI/2,false,true);
 building(-31,30,Math.PI,true,true);building(29,30,Math.PI,false,true);
 return housing;
}
