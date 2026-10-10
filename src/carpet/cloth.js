import { handThrow, handPosition, RELEASE } from './handThrow.js';
import { FLIP_DURATION } from '../game/state.js';
import * as THREE from "three";
import {wind as sharedWind} from "../scene/wind.js";
const carpetWind = new THREE.Vector3();

import { BAR_HEIGHT, BAR_RADIUS, CARPET_THICKNESS, projectBarNode, crownSide, barHitScale, clampNodeVelocity } from './barCollision.js';

import { BAR_CONTACT_RADIUS, BAR_FLIP_RADIUS, BAR_SDF_MARGIN, BAR_MIN_SPAN, CLOTH_BAR_OFFSET } from './barGeometry.js';

import { cacheNodes } from './nodeAccess.js';

import { layerPairs, projectLayers } from './layerCollision.js';
import { PolarContact } from './polarContact.js';

let modulePromise;
export function loadAmmo() {
  if (!modulePromise)
    modulePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${import.meta.env.BASE_URL}vendor/ammo/ammo.wasm.js`;
      script.onerror = () => reject(new Error("Unable to load Ammo physics"));
      script.onload = () =>
        window
          .Ammo({
            locateFile: (file) =>
              `${import.meta.env.BASE_URL}vendor/ammo/${file}`,
          })
          .then(resolve, reject);
      document.head.append(script);
    });
  return modulePromise;
}

export function clothParameters(options = {}) {
  const p = {
    width: 2.4,
    height: 2.1,
    cols: 29,
    rows: 43,
    mass: 5,
    iterations: 12,
    damping: 0.045,
    wind: 1,
    stiffness: 0.88,
    bending: 0.18,
    slack: 0.05,
    aeroDrag: 0.8,
    clusterSelfCollision: false,
    ...options,
  };
  if (
    ![p.width, p.height, p.mass].every((v) => Number.isFinite(v) && v > 0) ||
    ![p.cols, p.rows].every((v) => Number.isInteger(v) && v >= 2) ||
    !Number.isInteger(p.iterations) ||
    p.iterations < 1
  )
    throw new RangeError("Invalid cloth dimensions or solver parameters");
  return p;
}
export function impulseWeight(distance, radius) {
  return Number.isFinite(radius) &&
    radius > 0 &&
    distance >= 0 &&
    distance < radius
    ? (1 - distance / radius) ** 2
    : 0;
}

// Four circumscribed crown chords clear the pipe between nodes. Their size
// depends only on the pipe, never on the coarse hanging-panel grid spacing.
export function crownLayout(p) {
  const count=p.foldAxis==='u'?p.cols:p.rows;
  const length=p.foldAxis==='u'?p.width:p.height;
  const crown=Math.min(2, count/2-1), angle=Math.PI/(2*crown);
  const radius=BAR_CONTACT_RADIUS/Math.cos(angle/2);
  const crownStep=2*radius*Math.sin(angle/2);
  const panelStep=(length/2-crown*crownStep)/(count/2-crown);
  return {count,length,crown,angle,radius,crownStep,panelStep};
}
export function foldDistance(index,p) {
  const {count,crown,crownStep,panelStep}=crownLayout(p),d=Math.abs(index-count/2);
  return Math.min(d,crown)*crownStep+Math.max(0,d-crown)*panelStep;
}
export function clothRestPosition(x, y, p, bar = {x:0,y:0,z:CLOTH_BAR_OFFSET}, side = 0) {
  const across=p.foldAxis==='u' ? y/p.rows : x/p.cols;
  const index=p.foldAxis==='u' ? x : y;
  const span=p.foldAxis==='u' ? p.height : p.width;
  const {count,crown,angle,radius,panelStep}=crownLayout(p);
  const d=index-count/2,theta=Math.min(Math.abs(d),crown)*angle;
  const sign=side===0 ? 1 : -1;
  return [bar.x+(across-.5)*span,
    bar.y+radius*Math.cos(theta)-Math.max(0,Math.abs(d)-crown)*panelStep,
    bar.z-CLOTH_BAR_OFFSET+sign*Math.sign(d)*radius*Math.sin(theta)];
}
export function clothUv(x,y,p) {
  const axis=p.foldAxis, index=axis==='u'?x:y;
  const {count,length}=crownLayout(p);
  const along=.5+Math.sign(index-count/2)*foldDistance(index,p)/length;
  return axis==='u'?[along,1-y/p.rows]:[x/p.cols,1-along];
}

function unsafeVector(vector) {
  return vector && (!Number.isFinite(vector.x()) || !Number.isFinite(vector.y()) || !Number.isFinite(vector.z()));
}
export function unsafeClothNode(node, bar, extent = 4, maxSpeed = 30) {
  const p = node.get_m_x(), v = node.get_m_v(), q = node.get_m_q?.(), f = node.get_m_f?.();
  if(unsafeVector(p)||unsafeVector(v)||unsafeVector(q)||unsafeVector(f))return true;
  return Math.max(Math.abs(p.x()-bar.x), Math.abs(p.y()-bar.y), Math.abs(p.z()-(bar.z-CLOTH_BAR_OFFSET))) > extent ||
    v.x()*v.x()+v.y()*v.y()+v.z()*v.z() > maxSpeed*maxSpeed;
}

export class Cloth {
  constructor(options = {}) {
    Object.assign(this, clothParameters(options));
    this.foldAxis ??= this.width>this.height ? 'u' : 'v';
    if(this.foldAxis==='u')this.cols=Math.max(4,this.cols+this.cols%2);else this.rows=Math.max(4,this.rows+this.rows%2);
    this.span=this.foldAxis==='u'?this.height:this.width;
    this.drop=(this.foldAxis==='u'?this.width:this.height)/2;
    const A = (this.A = options.ammo);
    if (!A) throw new Error("Await loadAmmo() before constructing Cloth");
    this.owned = [];
    const own = (value) => {
      this.owned.push(value);
      return value;
    };
    this.vector = own(new A.btVector3(0, 0, 0));
    this.transform = own(new A.btTransform());
    this.rotation = own(new A.btQuaternion(0, 0, 0, 1));
    const config = own(new A.btSoftBodyRigidBodyCollisionConfiguration());
    const dispatcher = (this.dispatcher = own(
      new A.btCollisionDispatcher(config),
    ));
    const broadphase = own(new A.btDbvtBroadphase());
    const solver = own(new A.btSequentialImpulseConstraintSolver());
    const softSolver = own(new A.btDefaultSoftBodySolver());
    this.world = own(
      new A.btSoftRigidDynamicsWorld(
        dispatcher,
        broadphase,
        solver,
        config,
        softSolver,
      ),
    );
    this.vector.setValue(0, -9.81, 0);
    this.world.setGravity(this.vector);
    this.world.getWorldInfo().set_m_gravity(this.vector);
    this.world.getWorldInfo().set_air_density(1.2);
    const bar = options.barPosition || new THREE.Vector3(0, BAR_HEIGHT, CLOTH_BAR_OFFSET);
    // Build links in the flat material coordinates before folding. The small
    // crown intervals and the remaining panels retain their true rest lengths.
    this.body = own(new A.btSoftBody(this.world.getWorldInfo(),0,0,[]));
    for(let y=0;y<=this.rows;y++)for(let x=0;x<=this.cols;x++) {
      const index=this.foldAxis==='u'?x:y, count=this.foldAxis==='u'?this.cols:this.rows;
      const along=Math.sign(index-count/2)*foldDistance(index,this);
      this.vector.setValue(this.foldAxis==='u'?along:(x/this.cols-.5)*this.width,
        this.foldAxis==='v'?along:(y/this.rows-.5)*this.height,0);
      this.body.appendNode(this.vector,1);
    }
    const links=new Set();
    const link=(a,b)=>{const key=[Math.min(a,b),Math.max(a,b)].join(':');if(!links.has(key)){this.body.appendLink(a,b,0,true);links.add(key);}};
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++) {
      const a=y*(this.cols+1)+x,b=a+1,c=a+this.cols+1,d=c+1;
      link(a,b);link(a,c);link(b,d);link(c,d);link(b,c);
      this.body.appendFace(a,c,b,0);this.body.appendFace(b,c,d,0);
    }
    const cfg = this.solverConfig = this.body.get_m_cfg();
    // Config begins with the 32-bit eAeroModel enum in this pinned wasm build.
    // The upstream binding omits its setter; validate the adjacent kVCF field first.
    const configAddress = A.getPointer(cfg);
    if (Math.abs(A.HEAPF32[(configAddress + 4) >> 2] - cfg.get_kVCF()) > 1e-6)
      throw new Error("Unexpected Ammo Config layout");
    A.HEAP32[configAddress >> 2] = 1; // eAeroModel::V_TwoSided
    cfg.set_viterations(4);
    cfg.set_piterations(Math.max(16,this.iterations));
    cfg.set_citerations(6);
    cfg.set_kDP(this.damping);
    cfg.set_kDG(this.aeroDrag);
    cfg.set_kLF(0.08);
    cfg.set_kDF(0.35);
    cfg.set_kCHR(0.8);
    cfg.set_kKHR(0.8);
    cfg.set_collisions(0x01); // SDF_RS
    const material = this.body.get_m_materials().at(0);
    material.set_m_kLST(this.stiffness);
    material.set_m_kAST(this.stiffness);
    // Bullet's bending links use kLST, not kAST. Give them their own soft material.
    const bendingMaterial = this.body.appendMaterial();
    bendingMaterial.set_m_kLST(this.bending);
    bendingMaterial.set_m_kAST(this.bending);
    this.body.generateBendingConstraints(2, bendingMaterial);
    this.body.setTotalMass(this.mass, false);
    A.castObject(this.body, A.btCollisionObject)
      .getCollisionShape()
      .setMargin(0.025);
    this.world.addSoftBody(this.body, 1, -1);
    this.barRadius=BAR_RADIUS;
    this.barContactRadius=BAR_CONTACT_RADIUS;
    this.carpetThickness=CARPET_THICKNESS;
    const barMargin=BAR_SDF_MARGIN;
    this.barLength=options.barLength ?? BAR_MIN_SPAN;
    // This build's SDF evaluates the implicit cylinder without its rigid margin.
    // Include the margin in the extents so the SDF surface matches the visible pipe.
    const barShape = own(new A.btCylinderShapeX(
      own(new A.btVector3(this.barLength / 2, BAR_RADIUS+barMargin, BAR_RADIUS+barMargin))));
    barShape.setMargin(barMargin);
    this.barBody = this.makeRigid(
      barShape,
      new THREE.Vector3(bar.x, bar.y, bar.z - CLOTH_BAR_OFFSET),
    );
    this.bar = bar;
    this.barAxis={y:bar.y,z:bar.z-CLOTH_BAR_OFFSET};
    this.visibleSide = 0;
    this.anchored = new Set();
    const nodes = (this.nodes ?? this.body.get_m_nodes());
    this.barWrap=[];
    for (let y = 0; y <= this.rows; y++) for (let x = 0; x <= this.cols; x++) {
      const i = y * (this.cols + 1) + x;
      const [xx, yy, zz] = clothRestPosition(x, y, this, bar);
      this.barWrap[i]={minY:yy>=bar.y-1e-8 ? yy : -Infinity,minZ:Math.abs(zz-this.barAxis.z)};
      nodes.at(i).get_m_x().setValue(xx, yy, zz);
      nodes.at(i).get_m_q().setValue(xx, yy, zz);
    }
    // Pin the middle line only; both full halves remain free to drape and swing.
    for (let y=0;y<=this.rows;y++) for(let x=0;x<=this.cols;x++) {
      if ((this.foldAxis==='u' ? x===this.cols/2 && (y%4===0||y===this.rows) : y===this.rows/2 && (x%4===0||x===this.cols))) {
        const i=y*(this.cols+1)+x;
        // true disables collision between the entire soft body and the bar.
        this.body.appendAnchor(i,this.barBody,false,1); this.anchored.add(i);
      }
    }
    this.anchorHandles=Array.from({length:this.body.get_m_anchors().size()},(_,i)=>this.body.get_m_anchors().at(i));
    this.nodes=cacheNodes(A,nodes);
    this.layerContacts=layerPairs(this.cols,this.rows,this.foldAxis);
    this.selfContact=new PolarContact(this.cols,this.rows,Math.max(this.width/this.cols,this.height/this.rows),this.foldAxis);
    // Optional native first layer, measured by scripts/verify-layers.mjs.
    // Generate only after wrapping: flat clusters have the wrong rest shape.
    if(this.clusterSelfCollision) {
      this.body.generateClusters(32);
      cfg.set_collisions(0x01 | 0x20 | 0x40); // SDF_RS | CL_SS | CL_SELF
    }
    this.setBeaterColliders([]);
    const count = (this.cols + 1) * (this.rows + 1);
    this.positions = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2),
      indices = [];
    for (let y = 0; y <= this.rows; y++)
      for (let x = 0; x <= this.cols; x++) {
        const i = y * (this.cols + 1) + x;
        [uv[i * 2],uv[i * 2 + 1]] = clothUv(x,y,this);
        if (x < this.cols && y < this.rows)
          indices.push(
            i,
            i + this.cols + 1,
            i + 1,
            i + 1,
            i + this.cols + 1,
            i + this.cols + 2,
          );
      }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    if(this.foldAxis==='u')for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    this.geometry.setIndex(indices);
    this.time = 0;
    this.hitPulses = [];
    this.readNodes();
    this.refreshGeometry();
  }
  makeRigid(shape, position) {
    const A = this.A,
      own = (v) => {
        this.owned.push(v);
        return v;
      };
    this.transform.setIdentity();
    this.vector.setValue(position.x, position.y, position.z);
    this.transform.setOrigin(this.vector);
    const motion = own(new A.btDefaultMotionState(this.transform));
    this.vector.setValue(0, 0, 0);
    const info = own(
      new A.btRigidBodyConstructionInfo(0, motion, shape, this.vector),
    );
    const body = own(new A.btRigidBody(info));
    this.world.addRigidBody(body, 2, 1);
    return body;
  }
  setBeaterColliders(colliders) {
    const A = this.A;
    if (this.beaterBody) {
      this.world.removeRigidBody(this.beaterBody);
      for (const value of this.beaterOwned.reverse()) A.destroy(value);
    }
    const start = this.owned.length;
    this.beaterLocalHead=new THREE.Vector3();
    for(const {offset} of colliders)this.beaterLocalHead.add(offset);
    this.beaterLocalHead.divideScalar(Math.max(1,colliders.length));
    this.previousBeaterPose=null;
    const compound = new A.btCompoundShape(); this.owned.push(compound);
    for (const {offset, radius} of colliders) {
      this.transform.setIdentity(); this.vector.setValue(offset.x,offset.y,offset.z);
      this.transform.setOrigin(this.vector);
      const sphere = new A.btSphereShape(radius); this.owned.push(sphere);
      compound.addChildShape(this.transform,sphere);
    }
    this.beaterBody = this.makeRigid(compound, new THREE.Vector3(0,0,100));
    this.beaterBody.setCollisionFlags(this.beaterBody.getCollisionFlags() | 2);
    this.beaterBody.setActivationState(4);
    this.beaterBody.setCcdMotionThreshold(0.01); this.beaterBody.setCcdSweptSphereRadius(0.025);
    this.beaterOwned = this.owned.splice(start);
  }
  setBeaterPose(position, quaternion) {
    // Limit kinematic contact travel near the crown as well as impulse insurance.
    const head=this.beaterLocalHead.clone().applyQuaternion(quaternion).add(position);
    if(this.previousBeaterPose && Math.hypot(head.y-this.barAxis.y,head.z-this.barAxis.z)<.3) {
      const delta=position.clone().sub(this.previousBeaterPose);
      if(delta.length()<1) position.copy(this.previousBeaterPose).add(delta.clampLength(0,.015));
      this.body.get_m_cfg().set_kKHR(.25);
    } else this.body.get_m_cfg().set_kKHR(.8);
    this.previousBeaterPose=position.clone();
    this.transform.setIdentity();
    this.vector.setValue(position.x, position.y, position.z);
    this.transform.setOrigin(this.vector);
    this.rotation.setValue(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w,
    );
    this.transform.setRotation(this.rotation);
    this.beaterBody.getMotionState().setWorldTransform(this.transform);
    this.beaterBody.setWorldTransform(this.transform);
    this.beaterBody.activate();
  }
  hasBeaterContact(point) {
    // The distributed Ammo build does not expose soft-body rcontacts. Its rigid manifolds
    // can confirm a contact; otherwise the bounded impulse insurance is applied.
    for (let i = 0; i < this.dispatcher.getNumManifolds(); i++) {
      const m = this.dispatcher.getManifoldByIndexInternal(i);
      if (
        (this.A.getPointer(m.getBody0()) ===
          this.A.getPointer(this.beaterBody) ||
          this.A.getPointer(m.getBody1()) ===
            this.A.getPointer(this.beaterBody)) &&
        m.getNumContacts() > 0
      )
        return true;
    }
    return false; // No exposed registered contact: use the bounded impulse insurance.
  }
  integrate(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt=Math.min(dt,1/30);
    this.watchdog();
    const activeFlip=this.flip;
    if(activeFlip)this.selfContact?.capture(this.nodes);
    this.time += dt;
    if (this.flip && !this.flip.externalClock) {
      this.flip.age=Math.min(FLIP_DURATION,this.flip.age+Math.min(dt,1/30));
      if(this.flip.age>=FLIP_DURATION || (this.flip.age>=1.4 && this.flipSettled())) this.pendingFlipFinish=true;
    }
    if(this.flip){this.driveFlip(this.flip.age/FLIP_DURATION);this.seatGrips(dt);}
    const nodes = (this.nodes ?? this.body.get_m_nodes());
    // A short contact pulse maintains the dent through the first 100 ms;
    // after release, Bullet propagates its momentum through the soft links.
    for (const pulse of this.hitPulses) {
      const activeDt = Math.min(dt, pulse.duration - pulse.age);
      pulse.age += dt;
      const force = pulse.impulse / pulse.duration * activeDt / dt;
      for (const [i,w] of pulse.weights) {
        this.vector.setValue(pulse.dir.x*force*w,pulse.dir.y*force*w,pulse.dir.z*force*w);
        this.body.addForce(this.vector,i);
      }
    }
    for(let i=this.hitPulses.length-1;i>=0;i--)if(this.hitPulses[i].age>=this.hitPulses[i].duration)this.hitPulses.splice(i,1);
    sharedWind.velocity(carpetWind, 0, BAR_HEIGHT, 0);
    const windScale = this.wind * this.mass / Math.max(1,nodes.size()) * .16;
    if(nodes.size())this.vector.setValue(carpetWind.x * windScale, 0, carpetWind.z * windScale);
    for (let i = 0; i < nodes.size(); i++) {
      if (this.anchored.has(i)) continue;
      this.body.addForce(this.vector, i);
    }

    this.throwWave();
    if(this.flip)this.projectBar();
    this.clampVelocities();
    this.world.stepSimulation(dt,0);
    this.projectBar();
    if(activeFlip)this.ensureBarClearance(activeFlip);
    this.projectLayers();
    this.onContactSubstep?.(dt);
    if(this.pendingFlipFinish){this.finishFlip();this.pendingFlipFinish=false;}
    this.readNodes();
  }
  clampVelocities() {
    if(!this.barAxis)return;
    const nodes=(this.nodes ?? this.body.get_m_nodes());
    for(let i=0;i<nodes.size();i++)clampNodeVelocity(nodes.at(i),this.barAxis,!!this.flip);
  }
  projectBar() {
    if(!this.barAxis)return;
    const nodes=(this.nodes ?? this.body.get_m_nodes());
    const side=this.visibleSide, crown=crownLayout(this).crown;
    for(let i=0;i<nodes.size();i++) {
      const d=this.foldAxis==='u' ? i%(this.cols+1)-this.cols/2 : Math.floor(i/(this.cols+1))-this.rows/2;
      const node=nodes.at(i),p=node.get_m_x(),v=node.get_m_v(),restSide=Math.sign(d)*(side===0?1:-1);
      const wrap=this.barWrap[i];
      if(this.flip) {
        const f=this.flip;
        // Move the existing supported collar envelope with the travelling
        // anchor release. Only this contact boundary is seated geometrically;
        // no hanging-panel node receives a target position except the grips.
        if(Math.abs(d)<=crown && d!==0) {
          const column=this.foldAxis==='u'?Math.floor(i/(this.cols+1)):i%(this.cols+1);
          const count=this.foldAxis==='u'?this.rows:this.cols;
          const phase=f.leading===0?column/count:1-column/count;
          const old=f.initialSides[i];
          const t=Math.max(0,Math.min(1,(f.age-.35-phase*f.spread)/.4));
          const ease=t*t*(3-2*t);
          const z=old*wrap.minZ*Math.cos(Math.PI*ease);
          const lift=Math.sin(Math.PI*ease)**2;
          const thrown=old<0;
          const radius=Math.max(BAR_FLIP_RADIUS,Math.hypot(wrap.minY-this.barAxis.y,wrap.minZ))+
            lift*(.014*(Math.abs(d)-1)+(thrown?.028:0));
          const y=this.barAxis.y+Math.sqrt(Math.max(0,radius*radius-z*z));
          // The first supported row follows the travelling anchor boundary exactly.
          // Contact treats it as kinematic; limiting its seating can reorder columns.
          const dy=y-p.y(),dz=this.barAxis.z+z-p.z(),scale=Math.abs(d)===1?1:Math.min(1,.01/Math.max(1e-12,Math.hypot(dy,dz)));
          p.setValue(p.x(),p.y()+dy*scale,p.z()+dz*scale);node.get_m_q().setValue(p.x(),p.y(),p.z());
          v.setValue(v.x(),0,0);
        }
        let physical=f.sides[i];
        if(f.age>=1.05&&Math.abs(d)>crown){physical=Math.sign(p.z()-this.barAxis.z)||physical;f.sides[i]=physical;}
        // A side can change only above the crown, with a 4 mm dead band.
        if(crownSide(node,this.barAxis,physical)!==physical) {f.sides[i]=-physical;physical=-physical;f.crossed[i]=f.age;}
        projectBarNode(node,this.barAxis,physical,BAR_FLIP_RADIUS);
        clampNodeVelocity(node,this.barAxis,true);
        continue;
      }
      if(Math.abs(d)>crown && p.y()<this.barAxis.y-.3){clampNodeVelocity(node,this.barAxis);continue;}
      // Nodes alone can clear a cylinder while the triangles between them cut it.
      // Retain a rounded collar envelope over the crown and upper 30 cm. Adjacent
      // crown chords then clear the pipe too, while the hanging panels stay free.
      // Seat the supported collar on the pipe. Native collision margins
      // must not lift it or spread the side tangencies away from the pipe.
      const supported=Math.abs(d)<=crown;
      const y=supported ? wrap.minY : Math.max(p.y(),wrap.minY);
      const z=supported ? this.barAxis.z+restSide*wrap.minZ : y>this.barAxis.y-.3 ? this.barAxis.z+restSide*Math.max(Math.abs(p.z()-this.barAxis.z),wrap.minZ) : p.z();
      if(y!==p.y()||z!==p.z()) {
        v.setValue(v.x(),y!==p.y()?(supported?0:Math.max(0,v.y())):v.y(),z!==p.z()?(supported?0:restSide*Math.max(0,restSide*v.z())):v.z());
        p.setValue(p.x(),y,z);node.get_m_q().setValue(p.x(),y,z);
      }
      projectBarNode(node,this.barAxis,restSide,BAR_CONTACT_RADIUS);
      clampNodeVelocity(node,this.barAxis,!!this.flip);
    }
  }
  projectLayers() {
    if(!this.layerContacts)return;
    const nodes=this.nodes??this.body.get_m_nodes();
    if(this.flip) {
      this.selfContact?.project(nodes,this.barAxis,BAR_FLIP_RADIUS,this.flip.sides,this.flip);
      if(this.flip.age>=1.05){
        // Landing drag damps the swing, while gravity remains free to lower
        // the far corner. Damping Y too held that corner above its rest hem.
        for(let i=0;i<nodes.size();i++){const v=nodes.at(i).get_m_v();v.setValue(v.x()*.8,v.y()-.2,v.z()*.8);}
        projectLayers(nodes,this.layerContacts,this.flip.to,0,null,.1);
        this.ensureBarClearance(this.flip);
      }
    } else {
      projectLayers(nodes,this.layerContacts,this.visibleSide);
    }
    this.clampVelocities();
  }

  ensureBarClearance(f=this.flip) {
    for(let i=0;i<this.nodes.size();i++) {
      const node=this.nodes.at(i);
      const p=node.get_m_x(),physical=this.flip&&f.age<1.05?f.sides[i]:Math.sign(p.z()-this.barAxis.z)||f.sides[i];
      projectBarNode(node,this.barAxis,physical,BAR_FLIP_RADIUS);
      clampNodeVelocity(node,this.barAxis,!!this.flip);
    }
  }
  setVisibleSide(side) {
    if(side!==this.visibleSide) {
      const index=this.geometry.index.array;
      for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];
      this.geometry.index.needsUpdate=true;
    }
    this.visibleSide=side;
  }
  startFlip({externalClock=false,seed,style} = {}) {
    if(this.flip) return false;
    this.hitPulses=[];
    this.flipSequence=(this.flipSequence??0)+1;
    const gesture=handThrow(this,seed??`${this.seed??'carpet'}:flip:${this.flipSequence}`,style);
    const count=(this.nodes??this.body.get_m_nodes()).size(),sides=new Int8Array(count),crossed=new Float64Array(count);
    crossed.fill(Infinity);
    for(let i=0;i<count;i++)sides[i]=Math.sign(this.foldAxis==='u'?i%(this.cols+1)-this.cols/2:Math.floor(i/(this.cols+1))-this.rows/2)*(this.visibleSide===0?1:-1);
    this.flip={age:0,externalClock,positions:this.positions.slice(),from:this.visibleSide,to:1-this.visibleSide,...gesture,sides,initialSides:sides.slice(),crossed,launched:new Uint8Array(count)};
    this.flip.grips=gesture.grips.filter(g=>g.i<count);
    for(const grip of this.flip.grips){const n=this.nodes.at(grip.i);grip.inverseMass=n.get_m_im();n.set_m_im?.(0);}
    return true;
  }
  driveFlip(t) {
    const f=this.flip;if(!f)return;
    const gripAge=f.age+(f.style==='corner'?.05:0);
    const nodes=this.nodes??this.body.get_m_nodes();
    for(const grip of f.grips) {
      if(gripAge>=RELEASE+grip.delay)continue;
      const k=grip.i*3,start=[f.positions[k],f.positions[k+1],f.positions[k+2]];
      const target=handPosition(start,this.barAxis,gripAge,grip.delay,grip.delay===0?f.lead:0);
      const node=nodes.at(grip.i);
      const p=node.get_m_x(),velocity=node.get_m_v();
      // A hand applies velocity; it cannot teleport through another patch.
      const vx=(target[0]-p.x())*30,vy=(target[1]-p.y())*30,vz=(target[2]-p.z())*30;
      const scale=Math.min(1,9/Math.max(1e-12,Math.hypot(vx,vy,vz)));
      velocity.setValue(vx*scale,vy*scale,vz*scale);
    }
  }
  seatGrips(dt) {
    const f=this.flip;if(!f)return;
    const gripAge=f.age+(f.style==='corner'?.05:0);
    for(const grip of f.grips) {
      if(gripAge>=RELEASE+grip.delay){
        // Let the loaded links take the released patch over a few fixed steps.
        // Restoring its full inverse mass at once caused a solver-position snap.
        const release=Math.min(1,Math.max(.3,(gripAge-RELEASE-grip.delay)/.15));
        this.nodes.at(grip.i).set_m_im?.(grip.inverseMass*release*release);
        continue;
      }
      const k=grip.i*3,start=[f.positions[k],f.positions[k+1],f.positions[k+2]];
      const target=handPosition(start,this.barAxis,gripAge,grip.delay,grip.delay===0?f.lead:0);
      const node=this.nodes.at(grip.i),p=node.get_m_x(),q=node.get_m_q();
      const dx=target[0]-p.x(),dy=target[1]-p.y(),dz=target[2]-p.z();
      const scale=Math.min(1,9*dt/Math.max(1e-12,Math.hypot(dx,dy,dz)));
      p.setValue(p.x()+dx*scale,p.y()+dy*scale,p.z()+dz*scale);
      q.setValue(p.x(),p.y(),p.z());
    }
  }
  throwWave() {
    const f=this.flip;if(!f)return;
    const nodes=this.nodes??this.body.get_m_nodes();
    const acrossCount=this.foldAxis==='u'?this.rows:this.cols;
    let anchor=0;
    for(const i of this.anchored) {
      const column=this.foldAxis==='u'?Math.floor(i/(this.cols+1)):i%(this.cols+1);
      const phase=f.leading===0?column/acrossCount:1-column/acrossCount;
      this.anchorHandles?.[anchor++]?.set_m_influence(f.age<.25+phase*f.spread || f.age>1.1+phase*f.spread?1:0);
    }
    for(let i=0;i<nodes.size();i++) {
      const column=this.foldAxis==='u'?Math.floor(i/(this.cols+1)):i%(this.cols+1);
      const across=column/acrossCount,phase=f.leading===0?across:1-across;
      const launchSpread=f.launchSpread??f.spread;
      if(f.age<.25+phase*launchSpread)continue;
      if(f.launched[i]) {
        if(f.style==='corner' && f.age<.45+phase*launchSpread && nodes.at(i).get_m_im()>0){
          const v=nodes.at(i).get_m_v();
          v.setValue(v.x(),v.y()+.9,v.z()+f.initialSides[i]*.35);
        }
        continue;
      }
      f.launched[i]=1;
      const node=nodes.at(i),p=node.get_m_x(),v=node.get_m_v();
      const depth=Math.max(0,this.barAxis.y-p.y());
      const side=f.sides[i];
      // A short travelling launch pulse transfers the hand's scoop into the
      // sheet. The outward pulse clears the hanging panel before crossing the pipe;
      // an inward pulse crosses the opposite sheet before the hand reaches the crown.
      // Positions, inverse masses and links remain entirely Bullet-owned.
      v.setValue(v.x(),v.y()+Math.min(8.3,Math.sqrt(2*9.81*(depth+.85))),v.z()+side*3.2);
    }
  }
  flipSettled() {
    if(!this.flip||this.flip.age<RELEASE)return false;
    const nodes=this.nodes??this.body.get_m_nodes();
    for(let i=0;i<nodes.size();i++) {
      const v=nodes.at(i).get_m_v();if(Math.hypot(v.x(),v.y(),v.z())>=.6)return false;
    }
    return true;
  }
  finishFlip() {
    if(!this.flip)return;
    for(const g of this.flip.grips)this.nodes.at(g.i).set_m_im?.(g.inverseMass);
    for(const anchor of this.anchorHandles??[])anchor.set_m_influence(1);
    this.lastFlip=this.flip;
    this.setVisibleSide(this.flip.to);this.flip=null;
    if(this.barWrap && this.layerContacts){this.projectBar();this.projectLayers();this.ensureBarClearance(this.lastFlip);this.projectLayers();this.ensureBarClearance(this.lastFlip);this.clampVelocities();}
  }
  readNodes() {
    this.watchdog();
    const nodes = (this.nodes ?? this.body.get_m_nodes());
    for (let i = 0; i < nodes.size(); i++) {
      const p = nodes.at(i).get_m_x();
      this.positions[i * 3] = p.x();
      this.positions[i * 3 + 1] = p.y();
      this.positions[i * 3 + 2] = p.z();
    }
  }
  watchdog() {
    if (!this.bar) return false;
    const nodes = (this.nodes ?? this.body.get_m_nodes());
    for (let i=0;i<nodes.size();i++) {
      if (!unsafeClothNode(nodes.at(i), this.bar)) continue;
      this.watchdogRecoveries = (this.watchdogRecoveries ?? 0) + 1;
      if (!this.watchdogLogged) {
        console.warn('CoverHit physics watchdog: restored unstable carpet to rest drape');
        this.watchdogLogged = true;
      }
      for(const anchor of this.anchorHandles??[])anchor.set_m_influence(1);
      for(const grip of this.flip?.grips??[])nodes.at(grip.i).set_m_im?.(grip.inverseMass);
      this.flip = null;
      this.hitPulses = [];
      this.previousBeaterPose = null;
      for (let y=0;y<=this.rows;y++) for (let x=0;x<=this.cols;x++) {
        const node = nodes.at(y*(this.cols+1)+x);
        const rest = clothRestPosition(x,y,this,this.bar,this.visibleSide);
        node.get_m_x().setValue(...rest);
        node.get_m_q().setValue(...rest);
        node.get_m_v().setValue(0,0,0);
        node.get_m_f?.().setValue(0,0,0);
      }
      this.body.updateNormals?.();
      this.body.updateBounds?.();
      this.body.activate?.();
      return true;
    }
    return false;
  }
  refreshGeometry() {
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.updateShading?.();
    this.updateRenderGeometry?.();
  }
  step(dt) {
    this.integrate(Math.min(dt, 1 / 60));
    this.refreshGeometry();
  }
  applyImpulse(point, dir, strength = 1, radius = 0.36) {
    if (
      ![point.x, point.y, point.z, dir.x, dir.y, dir.z, strength, radius].every(
        Number.isFinite,
      ) ||
      radius <= 0 ||
      dir.lengthSq() < 1e-9
    )
      return;
    const nodes = (this.nodes ?? this.body.get_m_nodes()),
      weights = [];
    let sum = 0;
    for (let i = 0; i < nodes.size(); i++) {
      if (this.anchored.has(i)) continue;
      if (this.rows && this.cols) {
        const d=this.foldAxis==='u' ? i%(this.cols+1)-this.cols/2 : Math.floor(i/(this.cols+1))-this.rows/2;
        if(this.visibleSide===0 ? d<0 : d>0) continue;
      }
      const p = nodes.at(i).get_m_x();
      const w = impulseWeight(
        Math.hypot(p.x() - point.x, p.y() - point.y, p.z() - point.z),
        radius,
      );
      if (w) {
        weights.push([i, w]);
        sum += w;
      }
    }
    const impulse = THREE.MathUtils.clamp(strength, 0, 1) * 2.4 * (this.barAxis ? barHitScale(point,this.barAxis) : 1),
      nodeMass = this.mass / nodes.size();
    if (!sum || !impulse) return;
    this.hitPulses.push({age:0,duration:0.15,impulse:impulse*0.7,dir:dir.clone().normalize(),weights:weights.map(([i,w])=>[i,w/sum])});
    // Bound queued contact work during bursts; each pulse lasts only nine fixed steps.
    if (this.hitPulses.length > 8) this.hitPulses.shift();
    for (const [i, w] of weights) {
      const v = nodes.at(i).get_m_v();
      const scale = (impulse * 0.3 * w) / sum / nodeMass / dir.length();
      v.setValue(
        v.x() + dir.x * scale,
        v.y() + dir.y * scale,
        v.z() + dir.z * scale,
      );
    }
    this.clampVelocities();
    this.body.activate();
  }
  dispose() {
    this.world.removeSoftBody(this.body);
    this.world.removeRigidBody(this.beaterBody);
    this.world.removeRigidBody(this.barBody);
    for (const value of this.beaterOwned.reverse()) this.A.destroy(value);
    // Bodies/shapes must die before their world and solver dependencies.
    for (const value of this.owned.reverse()) this.A.destroy(value);
    this.geometry.dispose();
    this.renderGeometry?.dispose();
  }
}
