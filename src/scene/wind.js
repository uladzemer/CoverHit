import {Vector2} from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(n,seed){n=Math.imul(n^seed,1597334677);n=Math.imul(n^(n>>>16),2246822519);return (n>>>0)/4294967295;}
function noise(t,seed){const i=Math.floor(t),f=t-i,s=f*f*(3-2*f);return hash(i,seed)*(1-s)+hash(i+1,seed)*s;}
/** Independent factories make replay/testing deterministic. Calls allocate nothing. */
export function createWind(seed=464){
 let time=0,level=0;
 const direction=new Vector2(.28,.96).normalize();
 const uniforms={uWindTime:{value:0},uWindStrength:{value:0},uWindDir:{value:direction}};
 function gust(t){return clamp(.42+.18*Math.sin(t*1.13)+.16*Math.sin(t*.79+1.7)+.12*Math.sin(t*1.91+3)+.24*(noise(t*.23,seed)-.5),0,1);}
 function update(dt){if(Number.isFinite(dt)&&dt>0)time+=dt;const angle=1.29+.17*Math.sin(time*.071)+.1*(noise(time*.035,seed+1)-.5);direction.set(Math.cos(angle),Math.sin(angle));level=gust(time);uniforms.uWindTime.value=time;uniforms.uWindStrength.value=level;}
 update(0);
 return {update,get time(){return time;},strength:()=>level,direction,uniforms,
  velocity(out,x=0,y=0,z=0){
   x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;z=Number.isFinite(z)?z:0;
   const front=time-(x*direction.x+z*direction.y)/4.5;
   const mean=2.35+.65*Math.sin(time*.093);
   const speed=Math.min(6,(mean+3*gust(front))*Math.pow(clamp((y+.25)/3,.08,1.8),.16));
   return out.set(direction.x*speed,.11*Math.sin(front*1.7+x*.31),direction.y*speed);
  }};
}
export const wind=createWind();
