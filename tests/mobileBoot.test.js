import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { selectDeviceProfile, probeWebGL } from '../src/boot/deviceProfile.js';
import { estimateTextureBytes } from '../src/boot/mobileAssets.js';
import { cameraFraming } from '../src/boot/framing.js';
import { setAssetProgress, diagnosticsText, setBootStep, installBootGuard } from '../src/boot/bootGuard.js';
describe('phone boot',()=>{
  it('chooses safe device and explicit profiles',()=>{
    expect(selectDeviceProfile({ua:'iPhone'}).name).toBe('lite');
    expect(selectDeviceProfile({deviceMemory:4}).name).toBe('lite');
    expect(selectDeviceProfile({hardwareConcurrency:6}).name).toBe('lite');
    expect(selectDeviceProfile({coarse:true,search:'?full=1'}).name).toBe('full');
    expect(selectDeviceProfile({search:'?lite=1'}).name).toBe('lite');
    expect(selectDeviceProfile({search:'?minimal=1'}).name).toBe('minimal');
    expect(selectDeviceProfile({saved:'minimal'}).name).toBe('minimal');
    expect(selectDeviceProfile({search:'?full=1',lost:true}).name).toBe('minimal');
    expect(selectDeviceProfile({caps:{rgba16f:false,rgba32f:true}}).name).toBe('minimal');
    expect(selectDeviceProfile().name).toBe('full');
  });
  it('checks real framebuffer completeness and releases temporary resources',()=>{
    let deletes=0, checks=0;
    const gl={FRAMEBUFFER_COMPLETE:1,NO_ERROR:0,getExtension:()=>null,getParameter:()=>4096,createTexture:()=>({}),createFramebuffer:()=>({}),bindTexture(){},texParameteri(){},texImage2D(){},bindFramebuffer(){},framebufferTexture2D(){},checkFramebufferStatus:()=>++checks===1?1:0,deleteFramebuffer:()=>deletes++,deleteTexture:()=>deletes++,getError:()=>0};
    const caps=probeWebGL(gl);expect(caps.rgba16f).toBe(true);expect(caps.rgba32f).toBe(false);expect(deletes).toBe(4);
  });
  it('counts shared textures once, including uniform maps',()=>{
    const map=new THREE.Texture({width:1024,height:1024});map.generateMipmaps=true;
    const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial({map})));scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.ShaderMaterial({uniforms:{atlas:{value:map}}})));
    expect(estimateTextureBytes(scene)).toBeCloseTo(1024**2*4*4/3);
    expect(estimateTextureBytes(scene)/1048576).toBeLessThan(250);
  });
  it('fits rack and feet with margins and preserves projected aim rays',()=>{
    for(const [w,h]of [[393,852],[375,667],[852,393],[1440,900]])for(const drop of [.7,1.2,1.75]){
      const f=cameraFraming(w/h,3.4,drop);const camera=new THREE.PerspectiveCamera(f.fov,w/h,.1,600);
      camera.position.set(f.x,f.y,f.distance);camera.lookAt(0,2.15-drop/2,0);camera.updateMatrixWorld();
      for(const x of [-1.7,1.7])for(const y of [0,2.15]){const point=new THREE.Vector3(x,y,0).project(camera);expect(Math.abs(point.x)).toBeLessThan(.88);expect(Math.abs(point.y)).toBeLessThan(.88);}
      for(const x of [-1,0,1]){const target=new THREE.Vector3(x,1,0);const ndc=target.clone().project(camera);const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);const hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),new THREE.Vector3());expect(hit.distanceTo(target)).toBeLessThan(1e-8);}
    }
  });
  it('reports asset counts and installs guard once with capture for GPU loss',()=>{
    const events=[];const target={addEventListener:(...args)=>events.push(args)};
    installBootGuard(target,1);installBootGuard(target,1);
    expect(events.map(e=>e[0])).toEqual(['error','unhandledrejection','webglcontextlost']);expect(events[2][2]).toBe(true);
    setBootStep('manifest');setAssetProgress(3,21);expect(JSON.parse(diagnosticsText()).assets).toEqual({loaded:3,total:21});
  });
  it('centres the phone panel and centres the panel; landscape keeps both posts, portrait fills the width with the carpet',()=>{
    for(const aspect of [393/852,320/568,412/839,852/393,568/320])for(const [span,drop] of [[2.02,1.1],[2.766,1.75],[1.572,1.5]]) {
      const f=cameraFraming(aspect,3.4,drop,2.15,true,span);
      const camera=new THREE.PerspectiveCamera(f.fov,aspect,.1,600);
      camera.position.set(f.x,f.y,f.distance);camera.lookAt(0,f.targetY,0);camera.updateMatrixWorld();
      const top=new THREE.Vector3(0,2.15,0).project(camera),bottom=new THREE.Vector3(0,2.15-drop,0).project(camera);
      expect(.5-(top.y+bottom.y)/4).toBeCloseTo(.4,5);
      if(aspect>=1.3)for(const x of [-1.78,1.78])for(const y of [0,2.186])expect(Math.abs(new THREE.Vector3(x,y,0).project(camera).x)).toBeLessThan(.95);
      // Portrait is carpet-first: the hanging cloth fills about 85% of the width and the posts may leave the frame.
      else{const hw=span/2,l=new THREE.Vector3(-hw,2.15-drop/2,0).project(camera).x,r=new THREE.Vector3(hw,2.15-drop/2,0).project(camera).x;expect(r-l).toBeGreaterThan(1.4);expect(r-l).toBeLessThan(1.95);}
      expect(f.distance).toBeGreaterThanOrEqual(3.2);
      if(aspect<1.3)expect(f.fov).toBe(52);
    }
  });
});
