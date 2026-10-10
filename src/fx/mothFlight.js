/** Seeded, fixed-step correlated steering. No THREE or browser dependency. */
export function seededRandom(seed = 1) {
  let s=seed>>>0;
  return () => {s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
}
export const PLAY_VOLUME = { minX:-1.65,maxX:1.65,minY:.3,maxY:2.75,minZ:.12,maxZ:1.65 };
export function createFlight(point, seed = 1) {
  const random=seededRandom(seed);
  return {x:point.x,y:point.y,z:Math.max(.18,point.z+.08),vx:0,vy:.15,vz:.7,
    heading:random()*Math.PI*2,turn:0,noise:0,clock:0,accumulator:0,random,bank:0,pitch:0,age:0};
}
export function stepFlight(s, dt, wind = {x:0,y:0,z:0}, opts = {}) {
  if(!Number.isFinite(dt)||dt<=0) return s;
  const bounds=opts.bounds || PLAY_VOLUME;
  s.accumulator+=Math.min(dt,.5);
  const h=1/120;
  while(s.accumulator+1e-10>=h) {
    s.accumulator-=h;s.age+=h;s.clock-=h;
    if(s.clock<=0) {
      s.noise=(s.random()-.5)*5;
      // Rare long-tailed turn impulses, bounded to protect the catch volume.
      if(s.random()<.065) s.noise+=(s.random()<.5?-1:1)*Math.min(9,1/(.15+s.random()));
      s.clock=.08+s.random()*.15;
    }
    s.turn+=(s.noise-s.turn)*(1-Math.exp(-5*h));
    s.heading+=Math.max(-5,Math.min(5,s.turn))*h;
    const speed=.95+.25*Math.sin(s.age*2.1);
    let ax=(Math.cos(s.heading)*speed-s.vx)*3;
    let ay=(.10+.22*Math.sin(s.heading*.73)-s.vy)*3;
    let az=(Math.sin(s.heading)*speed-s.vz)*3;
    // Soft repulsion starts before hard safety bounds; rack/posts and side fences.
    const repel=(p,min,max)=>Math.max(0,.35-(p-min))*14-Math.max(0,.35-(max-p))*14;
    ax+=repel(s.x,bounds.minX,bounds.maxX);ay+=repel(s.y,bounds.minY,bounds.maxY);az+=repel(s.z,bounds.minZ,bounds.maxZ);
    if(s.y>1.85&&s.z<.35) az+=Math.max(0,.35-s.z)*18;
    for(const obstacle of opts.obstacles || []) {
      const dx=s.x-obstacle.x,dy=s.y-obstacle.y,dz=s.z-obstacle.z;
      const d=Math.hypot(dx,dy,dz),radius=obstacle.radius || .3;
      if(d<radius&&d>1e-5) {const f=(radius-d)*12/d;ax+=dx*f;ay+=dy*f;az+=dz*f;}
    }
    // Generic nocturnal moth: weak attraction only outside the carpet neighbourhood.
    if(opts.lights?.length&&Math.hypot(s.x,s.z)>.95) {
      let lamp=opts.lights[0],best=Infinity;
      for(const p of opts.lights) {const d=(p.x-s.x)**2+(p.y-s.y)**2+(p.z-s.z)**2;if(d<best){lamp=p;best=d;}}
      const d=Math.max(1,Math.sqrt(best));ax+=(lamp.x-s.x)/d*.25;ay+=(lamp.y-s.y)/d*.25;az+=(lamp.z-s.z)/d*.25;
    }
    const oldX=s.vx,oldZ=s.vz;
    s.vx+=ax*h;s.vy+=ay*h;s.vz+=az*h;
    const v=Math.hypot(s.vx,s.vy,s.vz);if(v>1.4){s.vx*=1.4/v;s.vy*=1.4/v;s.vz*=1.4/v;}
    s.x+= (s.vx+(wind.x||0)*.35)*h;s.y+=(s.vy+(wind.y||0)*.35)*h;s.z+=(s.vz+(wind.z||0)*.35)*h;
    for(const [axis,min,max] of [['x',bounds.minX,bounds.maxX],['y',bounds.minY,bounds.maxY],['z',bounds.minZ,bounds.maxZ]]) {
      if(s[axis]<min){s[axis]=min;s['v'+axis]=Math.abs(s['v'+axis])*.35;}
      if(s[axis]>max){s[axis]=max;s['v'+axis]=-Math.abs(s['v'+axis])*.35;}
    }
    const banking=Math.max(-.65,Math.min(.65,(oldZ*s.vx-oldX*s.vz)/h*.5));
    s.bank+=(banking-s.bank)*(1-Math.exp(-8*h));s.pitch=Math.atan2(s.vy,Math.max(.1,Math.hypot(s.vx,s.vz)))*.4;
  }
  return s;
}
