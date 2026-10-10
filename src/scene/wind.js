import {Vector2} from 'three';
export const WIND_RESPONSE=Object.freeze({carpet:.35,fringe:.8,laundry:1,vegetation:.8,dust:.5,moths:.6});

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(n,seed){n=Math.imul(n^seed,1597334677);n=Math.imul(n^(n>>>16),2246822519);return (n>>>0)/4294967295;}
function noise(t,seed){const i=Math.floor(t),f=t-i,s=f*f*(3-2*f);return hash(i,seed)*(1-s)+hash(i+1,seed)*s;}
/** Independent factories make replay/testing deterministic. Calls allocate nothing. */
export function createWind(seed=464){
 let time=0,level=0;
 const direction=new Vector2(.28,.96).normalize();
 const uniforms={uWindTime:{value:0},uWindStrength:{value:0},uWindDir:{value:direction}};
 // Seeded gust cells: one 1.5–3 s raised-cosine pulse every 6–15 s.
 function gust(t){
  const cell=Math.floor(t/10.5);
  for(let i=cell-1;i<=cell;i++){
   const start=i*10.5+2.25+hash(i,seed)*4.5,duration=1.5+hash(i,seed+3)*1.5;
   const phase=(t-start)/duration;
   if(phase>0&&phase<1)return Math.sin(Math.PI*phase)**2;
  }
  return 0;
 }
 function speedAt(t){
  const mean=.72+.22*Math.sin(t*.045)+.12*(noise(t*.025,seed+7)-.5);
  const calm=1-.7*Math.max(0,Math.sin(t*.087+seed*.01))**8;
  return clamp(mean*calm+1.15*gust(t),.2,2.2);
 }
 function update(dt){if(Number.isFinite(dt)&&dt>0)time+=dt;const angle=1.29+.17*Math.sin(time*.071)+.1*(noise(time*.035,seed+1)-.5);direction.set(Math.cos(angle),Math.sin(angle));level=speedAt(time)/2.2;uniforms.uWindTime.value=time;uniforms.uWindStrength.value=level;}
 update(0);
 return {update,get time(){return time;},strength:()=>level,direction,uniforms,
  velocity(out,x=0,y=0,z=0,sampleTime=time){
   x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;z=Number.isFinite(z)?z:0;
   const front=sampleTime-(x*direction.x+z*direction.y)/2;
   const speed=clamp(speedAt(front)*Math.pow(clamp((y+1)/2.3,.4,1.8),.08),.2,2.1998);
   return out.set(direction.x*speed,.025*Math.sin(front*.6+x*.31),direction.y*speed);
  }};
}
export const wind=createWind();
