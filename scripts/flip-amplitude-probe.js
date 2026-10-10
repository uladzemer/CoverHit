import {wind} from '../src/scene/wind.js';

export function measureThrow(c,style,hz=60,seed='amplitude',render=null) {
  for(let i=0;i<120;i++){wind.update(1/60);c.integrate(1/60);}
  c.startFlip({style,seed});
  const f=c.flip,across=c.foldAxis==='u'?c.rows:c.cols,along=c.foldAxis==='u'?c.cols:c.rows;
  const hem=Array.from({length:across+1},(_,col)=>c.foldAxis==='u'?col*(c.cols+1)+(f.from?along:0):(f.from?along:0)*(c.cols+1)+col);
  const crown=Array.from({length:across+1},(_,col)=>c.foldAxis==='u'?col*(c.cols+1)+along/2-1:(along/2-1)*(c.cols+1)+col);
  const crossings=Array(across+1).fill(null),peaks=Array(across+1).fill(null);
  let peak=-Infinity,zmin=Infinity,zmax=-Infinity,jump=0,extent=0,speed=0,energy=0,age=0,jumpDetail=null;
  let previous=hem.map(i=>Array.from(c.positions.slice(i*3,i*3+3)));
  const samples=[];
  while(c.flip) {
    for(let step=0;step<60/hz;step++){wind.update(1/60);c.integrate(1/60);}
    age=(c.flip??c.lastFlip).age;
    render?.();
    hem.forEach((i,col)=>{
      const p=Array.from(c.positions.slice(i*3,i*3+3)),y=p[1]-c.barAxis.y,z=p[2]-c.barAxis.z;
      peak=Math.max(peak,y);zmin=Math.min(zmin,z);zmax=Math.max(zmax,z);
      const displacement=Math.hypot(...p.map((v,k)=>v-previous[col][k]));
      if(displacement>jump){jump=displacement;jumpDetail={age,node:i,previous:previous[col],position:p};}previous[col]=p;
      if(peaks[col]===null||y>peaks[col].y)peaks[col]={y,age};
      const n=c.nodes.at(crown[col]).get_m_x();
      if(crossings[col]===null&&(n.z()-c.barAxis.z)*(f.from?-1:1)>.004)crossings[col]=age;
    });
    let kinetic=0;
    for(let i=0;i<c.nodes.size();i++){
      const n=c.nodes.at(i),p=n.get_m_x(),v=n.get_m_v(),s=Math.hypot(v.x(),v.y(),v.z());
      speed=Math.max(speed,s);extent=Math.max(extent,Math.abs(p.x()-c.bar.x),Math.abs(p.y()-c.barAxis.y),Math.abs(p.z()-c.barAxis.z));
      if(n.get_m_im())kinetic+=.5*s*s/n.get_m_im();
    }
    energy=Math.max(energy,kinetic);
    samples.push({age,side:c.visibleSide,positions:Array.from(c.positions)});
  }
  return {style,hz,peak,sweep:zmax-zmin,zmin,zmax,duration:age,jump,jumpDetail,extent,speed,energy,spread:Math.max(...crossings)-Math.min(...crossings),crestSpread:Math.max(...peaks.map(p=>p.age))-Math.min(...peaks.map(p=>p.age)),crestTimes:peaks.map(p=>p.age),crestEndSpread:peaks[f.leading?0:across].age-peaks[f.leading?across:0].age,crossings,recoveries:c.watchdogRecoveries??0,samples};
}

