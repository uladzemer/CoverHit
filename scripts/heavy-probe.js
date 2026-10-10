// Real Bullet nodes; all distances are metres and times seconds.
export function panelIndices(c, hem=false) {
  const ids=[];
  for(let i=0;i<c.nodes.size();i++) {
    const d=c.foldAxis==='u'?i%(c.cols+1)-c.cols/2:Math.floor(i/(c.cols+1))-c.rows/2;
    const n=c.foldAxis==='u'?c.cols:c.rows;
    if(d>2 && (!hem || d===n/2))ids.push(i);
  }
  return ids;
}
export function meanZ(c,ids) {return ids.reduce((s,i)=>s+c.nodes.at(i).get_m_x().z(),0)/ids.length;}
export function frequency(values,h=1/60) {
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  let best=0,power=0;
  for(let f=.1;f<=5;f+=.025) {
    let re=0,im=0;
    for(let i=0;i<values.length;i++){const v=(values[i]-mean)*Math.sin(Math.PI*i/(values.length-1))**2;re+=v*Math.cos(2*Math.PI*f*i*h);im+=v*Math.sin(2*Math.PI*f*i*h);}
    if(re*re+im*im>power){power=re*re+im*im;best=f;}
  }
  return best;
}
export function measureHit(c,Vector3,hem=false) {
  c.wind=0;
  for(let i=0;i<300;i++)c.integrate(1/60);
  const ids=panelIndices(c),edge=panelIndices(c,true),rest=c.positions.slice();
  let centre=ids[0],score=Infinity;
  for(const i of hem?edge:ids){const p=c.nodes.at(i).get_m_x(),s=Math.hypot(p.x(),p.y()-(c.barAxis.y-c.drop*.5));if(s<score){score=s;centre=i;}}
  const p=c.nodes.at(centre).get_m_x();c.applyImpulse(new Vector3(p.x(),p.y(),p.z()),new Vector3(0,0,-1),1);
  const samples=[];let peak=0;
  for(let frame=0;frame<600;frame++){
    c.integrate(1/60);let max=0,z=0;
    for(const i of ids){const p=c.nodes.at(i).get_m_x();max=Math.max(max,Math.hypot(p.x()-rest[i*3],p.y()-rest[i*3+1],p.z()-rest[i*3+2]));z+=p.z()-rest[i*3+2];}
    peak=Math.max(peak,max);samples.push({t:(frame+1)/60,max,z:z/ids.length,hem:meanZ(c,edge)});
  }
  const peaks=samples.filter((s,i)=>i>0&&i<samples.length-1&&s.z>samples[i-1].z&&s.z>=samples[i+1].z);
  const period=peaks.length>1?peaks[1].t-peaks[0].t:null;
  let decay=0;for(const s of samples)if(s.max>peak*.1)decay=s.t;
  return {mass:c.mass,arealDensity:c.mass/(c.width*c.height),peak,period,decay,frequency:frequency(samples.map(s=>s.z)),recoveries:c.watchdogRecoveries||0,samples};
}
