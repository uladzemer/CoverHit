// Discover vector addresses through the public binding, never guessed Node offsets.
// Read HEAPF32 on every access so memory growth cannot leave a detached view.
import { CLOTH_BAR_OFFSET } from './barGeometry.js';
export function cacheNodes(ammo, native) {
 const count=native.size(), nodes=new Array(count),offsets=new Int32Array(count*4);
 let allValid=true;
 for(let i=0;i<count;i++){
  const node=native.at(i), cached={};
  for(const field of ['x','q','v','f']){
   const vector=node[`get_m_${field}`]();
   const address=ammo.getPointer?.(vector), offset=address>>>2;
   const valid=address && !(address&3) && ammo.HEAPF32 &&
    [vector.x(),vector.y(),vector.z()].every((v,k)=>Object.is(v,ammo.HEAPF32[offset+k]));
   allValid &&= Boolean(valid);offsets[i*4+['x','q','v','f'].indexOf(field)]=offset;
   const view=valid?{x:()=>ammo.HEAPF32[offset],y:()=>ammo.HEAPF32[offset+1],z:()=>ammo.HEAPF32[offset+2],
    setValue(x,y,z){const heap=ammo.HEAPF32;heap[offset]=x;heap[offset+1]=y;heap[offset+2]=z;}}:vector;
   cached[`get_m_${field}`]=()=>view;
  }
  // Hand patches become kinematic only while gripped; cache the public setter.
  let inverseMass=node.get_m_im();cached.get_m_im=()=>inverseMass;
  cached.set_m_im=value=>{node.set_m_im(value);inverseMass=value;};
  nodes[i]=cached;
 }
 const result={size:()=>count,at:i=>nodes[i]};
 if(allValid){
  result.copyPositions=target=>{
   const heap=ammo.HEAPF32;
   for(let i=0;i<count;i++){const o=offsets[i*4],k=i*3;target[k]=heap[o];target[k+1]=heap[o+1];target[k+2]=heap[o+2];}
  };
  result.copyVelocities=target=>{
   const heap=ammo.HEAPF32;
   for(let i=0;i<count;i++){const o=offsets[i*4+2],k=i*3;target[k]=heap[o];target[k+1]=heap[o+1];target[k+2]=heap[o+2];}
  };
  result.clampVelocities=(axis,throwing=false)=>{
   const heap=ammo.HEAPF32;
   for(let i=0;i<count;i++){
    const p=offsets[i*4],v=offsets[i*4+2],dy=heap[p+1]-axis.y,dz=heap[p+2]-axis.z;
    const max=throwing?9:dy*dy+dz*dz<.09?.9:6,vx=heap[v],vy=heap[v+1],vz=heap[v+2],speedSquared=vx*vx+vy*vy+vz*vz;
    if(speedSquared>max*max){const scale=max/Math.sqrt(speedSquared);heap[v]=vx*scale;heap[v+1]=vy*scale;heap[v+2]=vz*scale;}
   }
  };
  result.findUnsafe=(bar,extent=4,maxSpeed=30,heavy=true)=>{
   const heap=ammo.HEAPF32,barZ=bar.z-CLOTH_BAR_OFFSET;
   for(let i=0;i<count;i++){
    const o=offsets[i*4],v=offsets[i*4+2],x=heap[o],y=heap[o+1],z=heap[o+2],vx=heap[v],vy=heap[v+1],vz=heap[v+2];
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(vx)||!Number.isFinite(vy)||!Number.isFinite(vz)||
      Math.abs(x-bar.x)>extent||Math.abs(y-bar.y)>extent||Math.abs(z-barZ)>extent||vx*vx+vy*vy+vz*vz>maxSpeed*maxSpeed)return i;
    if(heavy)for(let field=1;field<=3;field+=2){const k=offsets[i*4+field];if(!Number.isFinite(heap[k])||!Number.isFinite(heap[k+1])||!Number.isFinite(heap[k+2]))return i;}
   }
   return -1;
  };
 }
 return result;
}
