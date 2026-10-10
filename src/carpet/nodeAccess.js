// Discover vector addresses through the public binding, never guessed Node offsets.
// Read HEAPF32 on every access so memory growth cannot leave a detached view.
export function cacheNodes(ammo, native) {
 const count=native.size(), nodes=new Array(count);
 for(let i=0;i<count;i++){
  const node=native.at(i), cached={};
  for(const field of ['x','q','v','f']){
   const vector=node[`get_m_${field}`]();
   const address=ammo.getPointer?.(vector), offset=address>>>2;
   const valid=address && !(address&3) && ammo.HEAPF32 &&
    [vector.x(),vector.y(),vector.z()].every((v,k)=>Object.is(v,ammo.HEAPF32[offset+k]));
   const view=valid?{x:()=>ammo.HEAPF32[offset],y:()=>ammo.HEAPF32[offset+1],z:()=>ammo.HEAPF32[offset+2],
    setValue(x,y,z){const heap=ammo.HEAPF32;heap[offset]=x;heap[offset+1]=y;heap[offset+2]=z;}}:vector;
   cached[`get_m_${field}`]=()=>view;
  }
  // Inverse mass remains constant after construction; anchors are configured first.
  const inverseMass=node.get_m_im();cached.get_m_im=()=>inverseMass;
  nodes[i]=cached;
 }
 return {size:()=>count,at:i=>nodes[i]};
}
