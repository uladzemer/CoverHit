import * as THREE from 'three';
import { BAR_RADIUS, CARPET_HALF_THICKNESS } from './barGeometry.js';

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x*x*(3-2*x); };

// Reversed smoothstep written explicitly: GLSL smoothstep with reversed edges
// is undefined. Parallelism is the absolute dot product of the panel normals.
export function layerAO(distance, parallelism = 1, enclosure = 1) {
  if (![distance, parallelism, enclosure].every(Number.isFinite)) return 1;
  return 1 - .65 * smooth((.25-distance)/.23) * smooth(Math.abs(parallelism)) * clamp(enclosure);
}

export function createLayerOcclusion(cloth) {
  const {geometry, cols, rows, foldAxis, layerContacts} = cloth;
  const count = geometry.attributes.position.count;
  const partners = new Int32Array(count).fill(-1);
  // Reuse the collision pairing, selecting the exact mirror from its 3x3 set.
  for (const [a,b] of layerContacts) {
    const x=a%(cols+1), y=Math.floor(a/(cols+1));
    const mirror=(foldAxis==='v'?rows-y:y)*(cols+1)+(foldAxis==='u'?cols-x:x);
    if (b===mirror) { partners[a]=b; partners[b]=a; }
  }
  // x: layer AO, y: pipe contact/crevice AO. The crown has no opposite node.
  const attribute = new THREE.BufferAttribute(new Float32Array(count*2), 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('clothOcclusion', attribute);
  const enclosure = new Float32Array(count);
  for (let i=0;i<count;i++) {
    const uv=geometry.attributes.uv;
    const along=foldAxis==='u'?uv.getX(i):uv.getY(i);
    const across=foldAxis==='u'?uv.getY(i):uv.getX(i);
    const toBottom=Math.min(along,1-along)*cloth.drop*2;
    const toSide=Math.min(across,1-across)*cloth.span;
    enclosure[i]=(.3+.7*smooth(toBottom/.28))*(.6+.4*smooth(toSide/.16));
  }
  return function update() {
    const p=geometry.attributes.position.array, n=geometry.attributes.normal.array, out=attribute.array;
    for (let i=0;i<count;i++) {
      const k=i*3, j=partners[i]*3;
      out[i*2]=j<0?1:layerAO(Math.hypot(p[k]-p[j],p[k+1]-p[j+1],p[k+2]-p[j+2]),
        n[k]*n[j]+n[k+1]*n[j+1]+n[k+2]*n[j+2],enclosure[i]);
      const radius=Math.hypot(p[k+1]-cloth.barAxis.y,p[k+2]-cloth.barAxis.z);
      const contact=Number.isFinite(radius)?1-smooth((radius-BAR_RADIUS-CARPET_HALF_THICKNESS)/.055):0;
      // This contact is evaluated in the pipe frame, so it releases during flips.
      out[i*2+1]=1-.38*contact;
    }
    attribute.needsUpdate=true;
  };
}

// Preserve the sunset direction; fit a stable rack envelope in light space.
export function configureCarpetShadow(sun, barPosition, barLength) {
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.bias=-.000015;
  sun.shadow.normalBias=.0015;
  sun.updateMatrixWorld(true); sun.target.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  const camera=sun.shadow.camera, bounds=new THREE.Box3();
  for (const x of [-barLength/2-.4,barLength/2+.4])
    for (const y of [-barPosition.y,.4]) for (const z of [-1.4,1.4])
      bounds.expandByPoint(new THREE.Vector3(x,y,z).add(barPosition).applyMatrix4(camera.matrixWorldInverse));
  Object.assign(camera,{left:bounds.min.x,right:bounds.max.x,bottom:bounds.min.y,top:bounds.max.y,
    near:Math.max(.1,-bounds.max.z-2),far:-bounds.min.z+2});
  camera.updateProjectionMatrix();
}
