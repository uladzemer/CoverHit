import * as THREE from 'three';
import { wind,WIND_RESPONSE } from '../scene/wind.js';
import { emissionProfile, particleBudget } from './dust/emission.js';
import { dustVertex, dustFragment } from './dust/shaders.js';
import { DUST_PROFILES, screenSizeClamp, coverageCap } from './dust/budget.js';

/** Fixed storage, one draw, no CPU particle integration or extra depth pass. */
export class DustSystem {
  constructor(scene, opts = {}) {
    if (scene && !scene.isScene) { opts = scene; scene = undefined; }
    // Main already supplies a reduced capacity for its phone/lite pipeline.
    const phone = opts.profile ? opts.profile !== 'full' : opts.capacity === 1380 ||
      (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    this.profile = phone ? DUST_PROFILES.phone : DUST_PROFILES.full;
    // Leave 240 particles for the moth scale pool: combined FX never exceed 3000.
    this.capacity = Math.min(2760, particleBudget(opts.capacity));
    this.time = 0; this.cursor = 0; this.disposed = false;
    this.random = opts.random || Math.random;
    this.expiry = new Float64Array(this.capacity);
    const cloudSlots=Math.floor(this.capacity*.30), moteSlots=Math.floor(this.capacity*.68);
    this.pools=[{start:0,count:cloudSlots,cursor:0},{start:cloudSlots,count:moteSlots,cursor:0},
      {start:cloudSlots+moteSlots,count:this.capacity-cloudSlots-moteSlots,cursor:0}];
    if(phone) {
      const hazeSlots=Math.floor(cloudSlots*.2);
      this.pools[0].count-=hazeSlots;
      this.pools[3]={start:this.pools[0].count,count:hazeSlots,cursor:0};
    }
    this.flow = new THREE.Vector3(); this.sample = new THREE.Vector3();
    this.normal = new THREE.Vector3(); this.edgePoint = new THREE.Vector3();
    this.viewport = new THREE.Vector4(); this.projected = new THREE.Vector3();
    this.points = new THREE.Group(); this.points.name = 'dust';
    const base = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.attributes.position = base.attributes.position;
    this.geometry.attributes.uv = base.attributes.uv;
    this.geometry.instanceCount = this.capacity;
    this.attributes = {};
    for (const [name, size] of [['origin',3],['velocity',3],['life',4],['shape',4],['flowStart',3],['plane',4]]) {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * size), size).setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('a' + name, attr); this.attributes[name] = attr;
    }
    // A tiny deterministic procedural fallback also works without document/canvas.
    const pixels = new Uint8Array(16 * 16 * 4);
    for (let y=0;y<16;y++) for(let x=0;x<16;x++) {
      const i=(y*16+x)*4, r=((x-7.5)**2+(y-7.5)**2)/60;
      pixels[i]=pixels[i+1]=pixels[i+2]=255; pixels[i+3]=255*Math.max(0,1-r)**2;
    }
    this.texture = new THREE.DataTexture(pixels,16,16); this.texture.needsUpdate=true;
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    this.material = new THREE.ShaderMaterial({
      uniforms: { time:{value:0}, flow:{value:this.flow}, atlas:{value:this.texture}, tiled:{value:0},
        sunDir:{value:new THREE.Vector3(-32,4,-43).normalize()}, scale:{value:600},
        phone:{value:phone?1:0}, viewport:{value:new THREE.Vector2(1,1)}, coverageScale:{value:1} },
      vertexShader:dustVertex, fragmentShader:dustFragment,
      transparent:true, depthWrite:false, depthTest:true, side:THREE.DoubleSide,
    });
    this.points.material = this.material; // Main's legacy resize hook.
    this.mesh = new THREE.Mesh(this.geometry,this.material); this.mesh.frustumCulled=false;
    this.mesh.renderOrder=3; this.points.add(this.mesh); scene?.add(this.points);
    if (typeof document !== 'undefined') new THREE.TextureLoader().load(`${import.meta.env?.BASE_URL || '/'}fx/dust-flipbook.webp`, texture => {
      if(this.disposed) { texture.dispose(); return; }
      texture.minFilter=texture.magFilter=THREE.LinearFilter; texture.generateMipmaps=false;
      this.texture.dispose(); this.texture=texture; this.material.uniforms.atlas.value=texture;
      this.material.uniforms.tiled.value=1;
    }, undefined, () => {});
    this.mesh.onBeforeRender = (renderer, root, camera) => {
      // Cached scene sun; CSM can replace it, so read the yard's original light if present.
      if (!this.sun) root.traverse(o=>{ if(o.isDirectionalLight && !this.sun) this.sun=o; });
      if(this.sun) this.material.uniforms.sunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
      if(this.profile === DUST_PROFILES.phone) this.applyScreenBudget(renderer,camera);
    };
  }
  applyScreenBudget(renderer,camera) {
    renderer.getCurrentViewport(this.viewport);
    const width=this.viewport.z,height=this.viewport.w;
    this.material.uniforms.viewport.value.set(width,height);
    const sprites=[],a=this.attributes, view=camera.matrixWorldInverse.elements;
    let youngest=Infinity;
    for(let i=0;i<this.capacity;i++) {
      if(this.expiry[i]<=this.time) continue;
      const age=this.time-a.life.getX(i),duration=a.life.getY(i),kind=a.shape.getX(i),cloud=kind===0||kind===3;
      youngest=Math.min(youngest,age);
      const drag=cloud?3.6:2.8,travel=(1-Math.exp(-drag*age))/drag;
      this.projected.fromBufferAttribute(a.origin,i);
      this.projected.x+=a.velocity.getX(i)*travel+this.flow.x-a.flowStart.getX(i);
      this.projected.y+=a.velocity.getY(i)*travel+this.flow.y-a.flowStart.getY(i)+(cloud?.035:-.018)*age;
      this.projected.z+=a.velocity.getZ(i)*travel+this.flow.z-a.flowStart.getZ(i);
      if(kind===2) this.projected.y-=.25*(age-(1-Math.exp(-4*age))/4);
      this.projected.applyMatrix4(camera.matrixWorldInverse);
      // Each gradient component <=1.5; curl birth subtraction <=6 per axis.
      // Use the nearest possible depth, so CPU budgeting cannot undercount GPU size.
      const curlDepth=6*(kind===1?.015+.02*Math.min(age,3):.07+.10*Math.min(age,3))*(Math.abs(view[2])+Math.abs(view[6])+Math.abs(view[10]));
      const depth=Math.max(camera.near,-this.projected.z-curlDepth);
      const size=a.life.getZ(i)*(cloud?(1+Math.min(age/.8,1))*(width>height?.85:1):1);
      const diagonal=kind===2?Math.hypot(.25,2.8):Math.SQRT2;
      const diameter=screenSizeClamp(size*diagonal*camera.projectionMatrix.elements[5]*height/(2*depth),width,1,kind===3);
      const fade=Math.min(1,Math.max(0,age/.08));
      const alpha=a.shape.getW(i)*fade*fade*(3-2*fade)*Math.max(0,1-age/duration)**(kind===1?.6:2.4)*(cloud?1:2);
      sprites.push({diameter,alpha});
    }
    this.coverage=coverageCap(sprites,width,height,youngest);
    this.material.uniforms.coverageScale.value=this.coverage.scale;
  }
  get liveCount() { let n=0; for(let i=0;i<this.capacity;i++) if(this.expiry[i]>this.time) n++; return n; }
  emit(point, normal, amount) {
    if(this.disposed || !point || !normal || !Number.isFinite(point.x+point.y+point.z+normal.x+normal.y+normal.z)) return;
    const p=emissionProfile(amount); if(!p.total) return;
    const phone=this.profile===DUST_PROFILES.phone;
    if(phone) {
      for(const key of ['cloud','haze','specks','edge']) p[key]=Math.floor(p[key]*this.profile.count);
      p.size*=this.profile.size;
    }
    this.normal.copy(normal); if(this.normal.lengthSq()<1e-8) this.normal.set(0,0,1); this.normal.normalize();
    const spawn=(count,type,origin=point,haze=false)=>{
      const pool=this.pools[phone&&haze?3:type];
      for(let j=0;j<count;j++) {
        let slot=-1;
        for(let k=0;k<pool.count;k++) { const i=pool.start+pool.cursor; pool.cursor=(pool.cursor+1)%pool.count; if(this.expiry[i]<=this.time) {slot=i;break;} }
        if(slot<0) {
          if(!phone) break;
          if(!pool.count) break;
          slot=pool.start+pool.cursor;
          for(let k=1;k<pool.count;k++) {const i=pool.start+(pool.cursor+k)%pool.count;if(this.attributes.life.getX(i)<this.attributes.life.getX(slot))slot=i;}
          pool.cursor=(slot-pool.start+1)%pool.count;
        }
        const r=this.random, seed=r()*1000;
        const duration=phone?(type===1?3+r()*2:haze?(4+r()*2)*this.profile.hazeLife:1.5+r()*.3):haze?8+r()*4:type===0?6+r():type===1?8+r()*4:4+r()*2;
        const size=type===0?(0.075+r()*0.08)*p.size:phone&&type===1?.006+r()*.006:(type===1?0.002+r()*0.003:0.008+r()*0.008)*(phone?this.profile.size:1);
        const speed=(type===0?0.9+r()*1.1:0.15+r()*0.35)*(phone?.35:1);
        const spread=phone&&type===0?0.6:type===0?0.22:0.3;
        const a=this.attributes;
        const offset=phone?.12:.05;
        a.origin.setXYZ(slot,origin.x+this.normal.x*offset+(r()-.5)*spread,origin.y+this.normal.y*offset+(r()-.5)*spread+(phone?.08:0),origin.z+this.normal.z*offset);
        a.velocity.setXYZ(slot,this.normal.x*speed+(r()-.5)*(phone?.2:.6),this.normal.y*speed+(r()-.25)*(phone?.2:.6)+(phone?.09:0),this.normal.z*speed+(r()-.5)*(phone?.2:.6));
        a.life.setXYZW(slot,this.time,duration,size,seed);
        a.shape.setXYZW(slot,phone&&haze?3:type,r()*Math.PI*2,r()*15,(haze?.12:type===0?.24:type===1?.65:.5)*this.profile.alpha);
        a.flowStart.setXYZ(slot,this.flow.x,this.flow.y,this.flow.z);
        a.plane.setXYZW(slot,this.normal.x,this.normal.y,this.normal.z,this.normal.dot(origin));
        this.expiry[slot]=this.time+duration;
      }
    };
    spawn(p.cloud,0);spawn(p.haze,0,point,true);spawn(p.specks,1); spawn(Math.ceil(p.specks*.025),2);
    // Strong blows shake the lower fringe: read deformed boundary only at emission.
    let root=this.points; while(root.parent) root=root.parent;
    const carpet=root.getObjectByName('carpet'), pos=carpet?.geometry?.attributes.position, uv=carpet?.geometry?.attributes.uv;
    if(p.edge && pos && uv) {
      carpet.updateWorldMatrix(true,false);
      let lowest=Infinity;
      for(let i=0;i<pos.count;i++) if(uv.getX(i)<.001||uv.getX(i)>.999||uv.getY(i)<.001||uv.getY(i)>.999) lowest=Math.min(lowest,pos.getY(i));
      let remaining=p.edge;
      for(let i=0;i<pos.count&&remaining>0;i++) if(pos.getY(i)<lowest+.06) {
        this.edgePoint.fromBufferAttribute(pos,i).applyMatrix4(carpet.matrixWorld);
        spawn(2,0,this.edgePoint);remaining-=2;
      }
    } else spawn(p.edge,0);
    for(const attr of Object.values(this.attributes)) attr.needsUpdate=true;
  }
  update(dt) {
    if(this.disposed || !Number.isFinite(dt) || dt<=0) return;
    this.time+=dt;
    wind.velocity(this.sample,0,1.3,0); this.sample.multiplyScalar(WIND_RESPONSE.dust).clampLength(0,.4);this.flow.addScaledVector(this.sample,dt);
    this.material.uniforms.time.value=this.time;
  }
  dispose() {
    if(this.disposed) return; this.disposed=true;
    this.points.removeFromParent();this.geometry.dispose();this.material.dispose();this.texture.dispose();this.points.clear();
  }
}
