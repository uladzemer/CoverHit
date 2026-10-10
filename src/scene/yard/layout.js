// Metres in the fixed rack coordinate system: x across the bar, -z into the yard.
export const servicePad={x0:-3,x1:3,z0:-3,z1:2};
export const accessStrip={x0:-.5,x1:4.5,z0:2,z1:3};
export const driveway={x0:-28,x1:68,z0:-21.8,z1:-18};
export const drivewayExit={x0:64.2,x1:68,z0:-72,z1:-18};
export const sidewalk={x0:2,x1:64.2,z0:-24,z1:-21.8};
export const refusePad={x0:-4,x1:2,z0:-29,z1:-24};
export const garageApron={x0:-30,x1:-5,z0:-30,z1:-21.8};
export const treePositions=[[-8,-3,8],[9,-6,9],[-15,-13,10],[18,-12,8],[-32,-25,11],[38,-16,9],[-11,7,9],[14,6,10],[29,-8,8],[-25,2,11]];
export const benchPositions=[[5.35,-4],[-9,-18]];
export const lampPositions=[[8,-17],[30,-17],[56,-17]];
export const dumpsterPositions=[[-3,-27],[-1,-27],[1,-27]];
export const laundry={x:-1.9,from:-2.8,to:-1,lines:[-2.15,-1.65]};
export const laundryHeight=z=>2.74-.2*(1-Math.pow((z-(laundry.from+laundry.to)/2)/((laundry.to-laundry.from)/2),2));
export const laundryPositions=Array.from({length:6},(_,i)=>laundry.from+.25+i*(laundry.to-laundry.from-.5)/5);
export function inside(rect,x,z){return x>=rect.x0&&x<=rect.x1&&z>=rect.z0&&z<=rect.z1;}
