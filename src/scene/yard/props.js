import * as THREE from 'three';
import {createCar} from './car.js';
import {LAWN_HEIGHT} from './ground.js';
import {benchPositions,lampPositions,dumpsterPositions,laundry,laundryHeight} from './layout.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function buildProps(b,m,random,root){
 const {add,pipe,sphere,rod,plane}=b,V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const rounded=new RoundedBoxGeometry(1,1,1,1,.025);
 const cube=(mat,x,y,z,sx,sy,sz,ry=0,color)=>add(mat===m.wood?rounded:b.box,mat,x,y,z,sx,sy,sz,0,ry,0,color);
 function bench(x,z){for(let j=0;j<4;j++)cube(m.wood,x,.51,z+j*.14,2.4,.065,.11);for(let j=0;j<3;j++)cube(m.wood,x,.8+j*.16,z-.1,2.4,.12,.06);for(const dx of [-.85,.85]){cube(m.concrete,x+dx,.25,z+.2,.22,.5,.56);cube(m.metal,x+dx,.82,z-.1,.065,.9,.07);}}
 b.setRole('bench');for(const [x,z]of benchPositions)bench(x,z);b.setRole('');
 // Low timber sandpit: separate pale infill, two board walls and broad seats.
 b.setRole('sandbox');
 cube(m.sand,-7,.18,-10,3.04,.14,3.04);
 for(const y of [.155,.275]){
  for(const dx of [-1.62,1.62])cube(m.sandboxPaint,-7+dx,y,-10,.16,.115,3.4,0,'#609b80');
  for(const dz of [-1.62,1.62])cube(m.sandboxPaint,-7,y,-10+dz,3.4,.115,.16,0,'#609b80');
 }
 for(const dx of [-1.62,1.62])cube(m.sandboxPaint,-7+dx,.365,-10,.34,.05,3.58,0,'#e6c26c');
 for(const dz of [-1.62,1.62])cube(m.sandboxPaint,-7,.365,-10+dz,2.9,.05,.34,0,'#e6c26c');
 b.setRole('');
 // Garage row: dull corrugated steel, door seam, hinges and handles.
 b.setRole('garage');for(let i=0;i<7;i++){
  const x=-28+i*3.25,z=-32.8;
  cube(m.painted,x,1.22,z,3.12,2.44,5.6,0,['#929588','#74877f','#938978'][i%3]);
  cube(m.roof,x,2.48,z,3.24,.12,5.8);
  cube(m.seam,x,1.22,z+2.82,.035,2.38,.025);
  for(let rib=0;rib<32;rib++)cube(m.painted,x-1.5+rib*.097,1.22,z+2.84,.024,2.35,.035,0,['#929588','#74877f','#938978'][i%3]);
  cube(m.chrome,x+.06,.99,z+2.97,.10,.13,.06);add(pipe,m.metal,x+.06,1.09,z+2.97,.035,.06,.035);
  add(plane,m.stain,x,1.1,z+2.88,3,2.1,1);
  for(const dx of [-1.38,1.38])for(const y of [.55,1.8])cube(m.metal,x+dx,y,z+2.86,.12,.11,.08);
  for(const dx of [-.12,.12])cube(m.metal,x+dx,1.1,z+2.91,.03,.23,.05);
 }
 b.setRole('');
 // Clothesline, pale sheets with a modest irregular drape.
 b.setRole('clothesline');
 for(const z of [laundry.from,laundry.to]){add(pipe,m.painted,laundry.x,1.4,z,.045,2.8,.045);rod(m.painted,V(laundry.x-.6,2.8,z),V(laundry.x+.6,2.8,z),.04);}
 b.setRole('');
 // Galvanized diamond mesh on faded steel posts; front stays open for access.
 function meshFence(x,z,length,angle){
  add(plane,m.chainlink,x,.75,z,length,1.35,1,0,angle);
  const dx=Math.cos(angle),dz=-Math.sin(angle);
  for(let t=-length/2;t<=length/2+.01;t+=length/Math.ceil(length/2))add(pipe,m.painted,x+dx*t,.75,z+dz*t,.035,1.5,.035);
  for(const y of [.12,1.43])rod(m.painted,V(x-dx*length/2,y,z-dz*length/2),V(x+dx*length/2,y,z+dz*length/2),.025);
 }
 b.setRole('service-fence');meshFence(0,-3,6,0);meshFence(-3,-.5,5,Math.PI/2);meshFence(3,-.5,5,Math.PI/2);
 b.setRole('refuse-fence');meshFence(-1,-29,6,0);meshFence(-4,-26.5,5,Math.PI/2);meshFence(2,-26.5,5,Math.PI/2);b.setRole('');
 // Soviet steel climbing rocket, ringed body and conical nose; no plastic.
 const rx=-11,rz=-11;
 for(let i=0;i<6;i++){const a=i*Math.PI/3;rod(m.red,V(rx+Math.cos(a)*.85,.12,rz+Math.sin(a)*.85),V(rx+Math.cos(a)*.6,3.2,rz+Math.sin(a)*.6),.045);rod(m.red,V(rx+Math.cos(a)*.6,3.2,rz+Math.sin(a)*.6),V(rx,4.3,rz),.04);}
 for(let level=0;level<5;level++)for(let i=0;i<6;i++){const a=i*Math.PI/3,c=(i+1)*Math.PI/3;rod(m.red,V(rx+Math.cos(a)*.7,.55+level*.55,rz+Math.sin(a)*.7),V(rx+Math.cos(c)*.7,.55+level*.55,rz+Math.sin(c)*.7),.028);}
 for(let step=0;step<8;step++)rod(m.painted,V(rx-.35,.25+step*.3,rz+.75),V(rx+.35,.25+step*.3,rz+.75),.028);
 add(b.box,m.metal,rx,1.02,rz+2.5,.9,.045,3.6,Math.atan2(1.8,3.2));
 for(const dx of [-.46,.46])rod(m.red,V(rx+dx,2.02,rz+.9),V(rx+dx,.25,rz+4.1),.026);
 // A-frame swing, two chain-hung wood seats.
 for(const x of [-21,-17])for(const dz of [-1,1])rod(m.painted,V(x,0,-10+dz),V(x,2.7,-10),.055);
 rod(m.painted,V(-21.2,2.7,-10),V(-16.8,2.7,-10),.06);
 const link=new THREE.TorusGeometry(.032,.008,5,8);
 for(const x of [-20,-18]){for(const dx of [-.25,.25])for(let i=0;i<34;i++)add(link,m.metal,x+dx,.64+i*.06,-10,1,1.3,1,0,i%2*Math.PI/2,0);cube(m.wood,x,.57,-10,.65,.06,.3);}
 // Familiar painted half-hoops set along the curb, with gaps at crossings.
 const archPoints=[];
 for(let i=0;i<=12;i++){const a=Math.PI*i/12;archPoints.push(V(0,LAWN_HEIGHT+.19+Math.sin(a)*.36,Math.cos(a)*.65));}
 const arch=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints),12,.023,5,false);
 b.setRole('lawn-fence');
 for(let i=0;i<14;i++){
  const x=-19+i*1.4,z=-17.35;
  add(arch,m.sandboxPaint,x,0,z,1,1,1,0,Math.PI/2,0,'#559473');
  for(const dx of [-.65,.65])add(pipe,m.sandboxPaint,x+dx,(LAWN_HEIGHT+.19)/2,z,.023,LAWN_HEIGHT+.19,.023,0,0,0,'#559473');
 }
 b.setRole('');
 b.setRole('lamp');for(const [x,z]of lampPositions){
  add(pipe,m.metal,x,2.7,z,.065,5.4,.065);rod(m.metal,V(x,5.35,z),V(x+.9,5.35,z),.04);cube(m.metal,x+.9,5.35,z,.48,.14,.3);cube(m.lamp,x+.9,5.25,z,.40,.04,.26);
 }
 b.setRole('dumpster');for(const [x,z]of dumpsterPositions){cube(m.door,x,.42,z,.65,.84,.65);cube(m.metal,x,.87,z,.71,.065,.71);cube(m.recess,x,.906,z,.48,.012,.48);}
 b.setRole('');
 // VAZ-2101 proportions: 4.07m body, 2.42m wheelbase, upright glasshouse.
 b.setRole('car');
 // Reuse every car geometry/material for three parallel parked Zhiguli.
 const carTransforms=[12,28,49].map(x=>new THREE.Matrix4().compose(V(x,0,-19),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.PI/2),V(1,1,1)));
 createCar(b,root,carTransforms,()=>b.withTransforms(carTransforms,()=>{
 const carX=0,carZ=0;
 const body=new RoundedBoxGeometry(1,1,1,2,.08);
 const profile=new THREE.Shape();profile.moveTo(-2.035,.4);
 for(const center of [-1.21,1.21]){profile.lineTo(center-.37,.4);profile.quadraticCurveTo(center-.37,.72,center,.72);profile.quadraticCurveTo(center+.37,.72,center+.37,.4);}
 profile.lineTo(2.035,.4);profile.lineTo(2.035,.85);profile.lineTo(1.9,.92);profile.lineTo(-1.9,.92);profile.lineTo(-2.035,.85);profile.closePath();
 const chassis=new THREE.ExtrudeGeometry(profile,{depth:1.57,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2,curveSegments:8});chassis.translate(0,0,-.785);chassis.rotateY(Math.PI/2);
 add(chassis,m.car,carX,0,carZ,1,1,1);// Trapezoidal glasshouse with raked screens and bevelled roof pillars.
 const cabinProfile=new THREE.Shape();cabinProfile.moveTo(-1.06,.94);cabinProfile.lineTo(-.79,1.38);cabinProfile.quadraticCurveTo(-.74,1.44,-.67,1.44);cabinProfile.lineTo(.65,1.44);cabinProfile.quadraticCurveTo(.74,1.44,.79,1.36);cabinProfile.lineTo(1.04,.94);cabinProfile.closePath();
 const cabin=new THREE.ExtrudeGeometry(cabinProfile,{depth:1.42,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3});cabin.translate(0,0,-.71);cabin.rotateY(Math.PI/2);add(cabin,m.glass,carX,0,carZ-.08,1,1,1);
 add(body,m.car,carX,1.44,carZ-.08,1.44,.085,1.43);
 for(const side of [-1,1]){rod(m.car,V(carX+side*.73,.94,carZ+.96),V(carX+side*.7,1.42,carZ+.67),.035);rod(m.car,V(carX+side*.73,.94,carZ-1.14),V(carX+side*.7,1.42,carZ-.86),.035);}
 for(const side of [-1,1]){

  cube(m.car,carX+side*.775,1.16,carZ-.08,.035,.4,.065);
  for(const dz of [-.36,.51])cube(m.metal,carX+side*.818,.86,carZ+dz,.03,.035,.15);
  cube(m.chrome,carX+side*.82,.85,carZ,.035,.025,3.5);
  for(const dz of [-1.21,1.21]){add(pipe,m.tyre,carX+side*.83,.34,carZ+dz,.32,.18,.32,0,0,Math.PI/2);add(pipe,m.chrome,carX+side*.932,.34,carZ+dz,.18,.015,.18,0,0,Math.PI/2);add(sphere,m.chrome,carX+side*.945,.34,carZ+dz,.025,.09,.09);for(let i=0;i<4;i++){const a=i*Math.PI/2;add(pipe,m.recess,carX+side*.95,.34+Math.sin(a)*.13,carZ+dz+Math.cos(a)*.13,.023,.018,.023,0,0,Math.PI/2);}}
  cube(m.metal,carX+side*.84,1.06,carZ+.65,.14,.09,.19);
 }
 for(const dz of [-2.05,2.05])add(body,m.chrome,carX,.5,carZ+dz,1.72,.12,.10);
 cube(m.recess,carX,.7,carZ+2.045,.88,.24,.025);
 for(const dx of [-.59,.59]){add(sphere,m.headlamp,carX+dx,.72,carZ+2.06,.16,.16,.03);cube(m.red,carX+dx,.72,carZ-2.05,.25,.14,.035);}
 cube(m.trim,carX,.51,carZ+2.12,.42,.10,.018);
 }));b.setRole('');
 // Restrained puddles lie on the asphalt, below the curb tops.
 for(const [x,z,sx,sz]of [[18,-20.5,1.5,.5],[-20,-20,1,.4],[46,-20.7,2,.7]])add(plane,m.water,x,.008,z,sx*2,sz*2,1,-Math.PI/2);
}
