import {chromium} from '../../../scripts/qa-browser.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out='docs/qa/facades3';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:2000,height:2000}});
 await page.goto('http://127.0.0.1:5187/');
 const images=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const F=await import('/src/scene/yard/facade.js');
  const C=await import('/src/scene/yard/car.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(2000,2000);renderer.outputColorSpace=T.SRGBColorSpace;
  const captures={},scene=new T.Scene();scene.background=new T.Color('#9b9b9b');scene.add(new T.HemisphereLight('#ffffff','#ffffff',2));
  const camera=new T.OrthographicCamera(-7.5,7.5,7.5,-7.5,.1,100);
  for(const family of ['panel','panel335','brick','nine']){
   const height=family==='nine'?24.3:13.5,centre=height/2,extent=family==='nine'?13.5:7.5;renderer.setSize(family==='nine'?3600:2000,family==='nine'?3600:2000);camera.left=-extent;camera.right=extent;camera.top=extent;camera.bottom=-extent;camera.updateProjectionMatrix();
   const bay=F.FACADE_SERIES[family].bay,material=F.createFacadeMaterial(family,{},()=>{},false);await material.userData.photoReady;
   const mesh=new T.Mesh(F.facadeBox(bay*4,height,bay*4,family,17),material);mesh.scale.set(bay*4,height,bay*4);mesh.position.y=centre;scene.add(mesh);
   camera.position.set(0,centre,35);camera.lookAt(0,centre,0);renderer.render(scene,camera);captures[`ortho-${family}`]=renderer.domElement.toDataURL();
   camera.position.set(0,centre+7.25,35);camera.lookAt(0,centre,0);renderer.render(scene,camera);captures[`ortho-top-front-${family}`]=renderer.domElement.toDataURL();
   scene.remove(mesh);mesh.geometry.dispose();material.dispose();
  }
  renderer.setSize(2000,2000);
  const group=new T.Group(),paint=new T.MeshStandardMaterial({color:'#a3a5a0',roughness:.48});
  group.add(new T.Mesh(C.carBodyGeometry(),paint));
  group.add(new T.Mesh(C.carTrimGeometry(),new T.MeshStandardMaterial({vertexColors:true,roughness:.48})));
  group.add(new T.Mesh(C.carPhotoGeometry(),new T.MeshStandardMaterial({map:await F.loadPhotoTexture('car-flat-atlas.webp',true),transparent:true,side:T.DoubleSide,roughness:.48})));
  scene.add(group);camera.left=-2.5;camera.right=2.5;camera.top=2.5;camera.bottom=-2.5;camera.updateProjectionMatrix();camera.position.set(10,.7,0);camera.lookAt(0,.7,0);renderer.render(scene,camera);captures['ortho-car-side']=renderer.domElement.toDataURL();
  return captures;
 });
 for(const [name,url]of Object.entries(images))await writeFile(`${out}/${name}.png`,Buffer.from(url.split(',')[1],'base64'));
}finally{await browser.close();}
