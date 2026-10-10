import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wind,WIND_RESPONSE } from '../scene/wind.js';
import { createFlight, stepFlight } from './mothFlight.js';
import { DustSystem } from './dust.js';
import { lampPositions } from '../scene/yard/layout.js';

function wingTexture() {
  const n=128,data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const u=x/(n-1),v=y/(n-1),i=(y*n+x)*4;
    const width=.025+.20*Math.sin(Math.PI*u)**.8;
    const edge=width-Math.abs(v-.5+(u-.5)*.38);
    const fringe=.014*Math.sin(v*310+u*70);
    const alpha=THREE.MathUtils.clamp((edge+fringe)*90,0,1)*Math.min(1,(1-u)*60);
    const scale=.85+.15*Math.sin(x*2.3+y*4.7)*Math.sin(y*.8);
    // Buff base and muted copper tip; generic nocturnal moth, not Tineola.
    data[i]=(u>.53?172:210)*scale;data[i+1]=(u>.53?126:192)*scale;data[i+2]=(u>.53?79:146)*scale;data[i+3]=alpha*255;
  }
  const texture=new THREE.DataTexture(data,n,n);texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;return texture;
}

/** Two instanced visible batches + one shadow, capped at 30; picks remain individual meshes. */
export class MothSystem {
  constructor(scene, opts={}) {
    this.scene=scene;this.opts={...opts,lights:opts.lights || lampPositions.map(([x,z])=>({x,y:3.8,z}))};this.moths=new Map();this.capacity=30;this.time=0;
    this.sample=new THREE.Vector3();this.dummy=new THREE.Object3D();this.zero=new THREE.Matrix4().makeScale(0,0,0);
    this.texture=wingTexture();
    this.wingGeometry=new THREE.PlaneGeometry(.028,.033,4,3);this.wingGeometry.translate(.014,0,0);
    this.phases=new THREE.InstancedBufferAttribute(new Float32Array(60*4),4).setUsage(THREE.DynamicDrawUsage);
    this.wingGeometry.setAttribute('flutter',this.phases);
    this.wingMaterial=new THREE.MeshStandardMaterial({map:this.texture,transparent:true,alphaTest:.12,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,roughness:1,emissive:'#d6b16a',emissiveIntensity:.08});
    this.flapTime={value:0};
    this.wingMaterial.onBeforeCompile=shader=>{
      shader.uniforms.flapTime=this.flapTime;
      shader.vertexShader='attribute vec4 flutter; uniform float flapTime; varying float mothFade;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float glide=smoothstep(.87,.98,sin(flapTime*1.7+flutter.x));
        float flap=sin(flapTime*flutter.y*6.283185+flutter.x)*(.82+flutter.z*.35)*(1.-glide*.8);
        transformed.x*=cos(flap);transformed.z+=sin(flap)*position.x;
        mothFade=flutter.w;`);
      shader.fragmentShader='varying float mothFade;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= mothFade;\n#include <alphatest_fragment>');
    };
    this.wingMaterial.customProgramCacheKey=()=> 'moth-flutter-v1';
    this.wings=new THREE.InstancedMesh(this.wingGeometry,this.wingMaterial,60);this.wings.frustumCulled=false;
    const profile=[new THREE.Vector2(0,-.015),new THREE.Vector2(.002,-.013),new THREE.Vector2(.004,-.002),new THREE.Vector2(.003,.008),new THREE.Vector2(0,.013)];
    const thorax=new THREE.LatheGeometry(profile,8),head=new THREE.SphereGeometry(.0035,8,5);head.translate(0,.012,0);
    const antennae=[-1,1].map(side=>{const a=new THREE.ConeGeometry(.00055,.019,3);a.rotateZ(-side*.45);a.translate(side*.004,.023,0);return a;});
    this.bodyGeometry=mergeGeometries([thorax,head,...antennae]);[thorax,head,...antennae].forEach(g=>g.dispose());
    this.bodyMaterial=new THREE.MeshStandardMaterial({color:'#ac8954',roughness:1});
    this.bodies=new THREE.InstancedMesh(this.bodyGeometry,this.bodyMaterial,30);this.bodies.frustumCulled=false;
    this.shadowGeometry=new THREE.PlaneGeometry(.10,.07);
    this.shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(.13,.10,.07,.12*exp(-d*d*5.)*smoothstep(1.,.7,d));}'});
    this.shadows=new THREE.InstancedMesh(this.shadowGeometry,this.shadowMaterial,30);this.shadows.frustumCulled=false;
    this.shadows.renderOrder=2;
    this.pickGeometry=new THREE.SphereGeometry(.13,8,6);this.pickMaterial=new THREE.MeshBasicMaterial({visible:false});
    this.root=new THREE.Group();this.root.name='moths';this.root.add(this.wings,this.bodies,this.shadows);scene.add(this.root);
    this.scales=new DustSystem(scene,{capacity:240});this.scales.points.name='moth-scales';
    this.#sync();
  }
  spawn({id},point) {
    if(this.moths.has(id)||this.moths.size>=this.capacity||!Number.isFinite(point.x+point.y+point.z)) return;
    let slot=0;const used=new Set([...this.moths.values()].map(m=>m.slot));while(used.has(slot)) slot++;
    const group=new THREE.Group();group.name=`moth-${id}`;
    const pick=new THREE.Mesh(this.pickGeometry,this.pickMaterial);pick.userData.mothId=id;group.add(pick);this.scene.add(group);
    const seed=typeof id==='number'?id+17:[...String(id)].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),17);
    const flight=createFlight(point,seed);group.position.set(flight.x,flight.y,flight.z);
    this.moths.set(id,{group,pick,flight,slot,origin:group.position.clone(),age:0,phase:flight.random()*6.28,state:'flying',exitAge:0,trail:0});
    this.scales.emit(point,this.sample.set(0,0,1),.002);this.#sync();
  }
  intercept(raycaster,carpet,catchMoth) {
    const targets=[carpet];for(const m of this.moths.values()) if(m.state==='flying'){m.pick.updateWorldMatrix(true,false);targets.push(m.pick);}
    carpet.updateWorldMatrix(true,false);const first=raycaster.intersectObjects(targets,false)[0];
    return first?.object.userData.mothId!==undefined&&catchMoth(first.object.userData.mothId);
  }
  exit(id,state) {
    const m=this.moths.get(id);if(!m) return;
    m.state=state;m.exitAge=0;m.origin.copy(m.group.position);
    if(state==='caught') this.scales.emit(m.group.position,this.sample.set(0,.3,1),.003);
    return m.group.position.clone();
  }
  update(dt) {
    if(!Number.isFinite(dt)||dt<=0) return;
    this.time+=dt;this.flapTime.value=this.time;
    for(const [id,m] of this.moths) {
      m.age+=dt;
      if(m.state==='flying') {
        wind.velocity(this.sample,m.flight.x,m.flight.y,m.flight.z);this.sample.multiplyScalar(WIND_RESPONSE.moths);stepFlight(m.flight,dt,this.sample,this.opts);
        const f=m.flight;m.group.position.set(f.x,f.y,f.z);m.group.rotation.set(f.pitch,Math.atan2(f.vx,f.vz)*.35,f.bank);
        m.trail+=dt;if(m.trail>.18){m.trail=0;this.scales.emit(m.group.position,this.sample.set(0,0,1),.0002);}
      } else {
        m.exitAge+=dt;const e=m.exitAge;
        if(m.state==='caught') {m.group.position.set(m.origin.x+.12*e,m.origin.y-1.8*e*e,m.origin.z+.18*e);m.group.rotation.set(e*4,e*3,e*7);}
        else {
          const lamp=this.opts.lights?.[0] || {x:-2,y:4,z:-1};const length=Math.hypot(lamp.x-m.origin.x,lamp.y-m.origin.y,lamp.z-m.origin.z)||1;
          m.group.position.set(m.origin.x+(lamp.x-m.origin.x)/length*e*1.5,m.origin.y+(lamp.y-m.origin.y)/length*e*1.5,m.origin.z+(lamp.z-m.origin.z)/length*e*1.5);
        }
        if(e>1.2||m.group.position.y<.04){m.group.removeFromParent();this.moths.delete(id);}
      }
    }
    this.scales.update(dt);this.#sync();
  }
  #sync() {
    for(let i=0;i<30;i++){this.bodies.setMatrixAt(i,this.zero);this.shadows.setMatrixAt(i,this.zero);this.wings.setMatrixAt(i*2,this.zero);this.wings.setMatrixAt(i*2+1,this.zero);}
    for(const m of this.moths.values()) {
      const fade=m.state==='escaped'?Math.max(0,1-m.exitAge/1.2):1;
      m.group.updateMatrix();this.bodies.setMatrixAt(m.slot,m.group.matrix);
      for(let j=0;j<2;j++) {
        this.dummy.position.copy(m.group.position);this.dummy.quaternion.copy(m.group.quaternion);
        this.dummy.scale.set(j===0?-fade:fade,fade,fade);this.dummy.updateMatrix();this.wings.setMatrixAt(m.slot*2+j,this.dummy.matrix);
        this.phases.setXYZW(m.slot*2+j,m.phase,10+(m.slot%5),Math.abs(m.flight.bank),fade);
      }
      // Approximate carpet-plane contact shadow, only in the near-surface zone.
      if(m.state==='flying'&&m.group.position.z<.4) {
        this.dummy.position.set(m.group.position.x,m.group.position.y,.035);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar((.4-m.group.position.z)/.25);this.dummy.updateMatrix();this.shadows.setMatrixAt(m.slot,this.dummy.matrix);
      }
    }
    this.wings.instanceMatrix.needsUpdate=true;this.bodies.instanceMatrix.needsUpdate=true;this.shadows.instanceMatrix.needsUpdate=true;this.phases.needsUpdate=true;
    this.root.visible=this.moths.size>0;
  }
  clear(){for(const m of this.moths.values())m.group.removeFromParent();this.moths.clear();this.#sync();}
  dispose(){this.clear();this.scales.dispose();this.root.removeFromParent();for(const asset of [this.texture,this.wingMaterial,this.bodyMaterial,this.wingGeometry,this.bodyGeometry,this.pickGeometry,this.pickMaterial,this.shadowGeometry,this.shadowMaterial])asset.dispose();}
}
