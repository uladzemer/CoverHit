// Metres, shared by the visible pipe, Bullet cylinder and post-solve guarantee.
import { BAR_CONTACT_RADIUS } from './barGeometry.js';
export * from './barGeometry.js';

export function barHitScale(point, axis) {
  return .2 + .8 * Math.min(1, Math.hypot(point.y-axis.y,point.z-axis.z)/.25);
}

export function clampNodeVelocity(node, axis) {
  const p=node.get_m_x(),v=node.get_m_v();
  const max=Math.hypot(p.y()-axis.y,p.z()-axis.z)<.3 ? .9 : 6;
  const speed=Math.hypot(v.x(),v.y(),v.z());
  if(speed>max)v.setValue(v.x()*max/speed,v.y()*max/speed,v.z()*max/speed);
}

// A penetrated position alone cannot change sides. During a throw a node must
// clear the crown and cross a dead band before adopting the opposite side.
export function crownSide(node, axis, side, hysteresis=.004) {
  const p=node.get_m_x();
  return side && p.y()>axis.y+BAR_CONTACT_RADIUS &&
    (p.z()-axis.z)*side < -hysteresis ? -side : side;
}

// restSide is topology at rest and crownSide's physical state during a throw.
// Zero denotes the pinned crown, which always projects upwards.
export function projectBarNode(node, axis, restSide, radius=BAR_CONTACT_RADIUS) {
  const p=node.get_m_x(),v=node.get_m_v();
  let dy=p.y()-axis.y,dz=p.z()-axis.z;
  const distance=Math.hypot(dy,dz);
  const wrongSide=restSide!==0 && dz*restSide<0 && Math.abs(dy)<radius;
  if(distance>=radius && !wrongSide)return false;
  if(restSide===0){dy=Math.abs(dy);dz=0;}
  else dz=restSide*Math.max(Math.abs(dz),1e-8);
  const length=Math.hypot(dy,dz);
  const ny=length>1e-8?dy/length:(restSide===0?1:0);
  const nz=length>1e-8?dz/length:restSide;
  const target=Math.max(radius+1e-6,distance);
  p.setValue(p.x(),axis.y+ny*target,axis.z+nz*target);
  node.get_m_q().setValue(p.x(),p.y(),p.z());
  const inward=Math.min(0,v.y()*ny+v.z()*nz);
  v.setValue(v.x(),v.y()-inward*ny,v.z()-inward*nz);
  return true;
}
