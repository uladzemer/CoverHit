// Decode the shipped VAT and evaluate the production clothPoint shader at the
// free edge, including clip blend and flutter. No synthetic sine proxy.
export function laundryHem(api,wind){
 if(api.status!=='vat')throw Error('Laundry VAT unavailable: flutter cannot be measured');
 const {data,width}=api.uniforms.laundryVAT.value.image;
 const time=wind.uniforms.uWindTime.value,strength=wind.strength(),phase=api.placements[0].phase,template=api.placements[0].template;
 const w=Math.max(0,Math.min(1,strength)),blend=w*w*(3-2*w)*2;
 const f=(time*30+phase*150)%150,lo=Math.floor(f),fraction=f-lo;
 const frame=(vertex,clip,index)=>data[((template*3+clip)*151+index)*width*4+vertex*4+2]/255*2.2-.8;
 const clip=(vertex,index)=>frame(vertex,index,lo)*(1-fraction)+frame(vertex,index,lo+1)*fraction;
 let z=0;
 for(let column=0;column<12;column++){
  const vertex=180+column,a=clip(vertex,0),b=clip(vertex,1),c=clip(vertex,2);
  z+=(a+(b-a)*Math.min(blend,1))*(1-Math.max(blend-1,0))+c*Math.max(blend-1,0)+Math.sin(vertex*.37+time*9+phase)*.012*strength;
 }
 return z/12*.32;
}
