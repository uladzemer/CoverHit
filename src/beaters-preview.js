import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BEATERS, createBeaterModel } from './input/beaters/index.js';
import { Sfx } from './audio/sfx.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#292b31');
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture;
scene.environmentIntensity = 0.55;
room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight('#aabbd4', '#6d6451', 1.35));
const sun = new THREE.DirectionalLight('#ffd0a0', 2.5);
// Preserve the yard's light direction while centring its shadow frustum on the display.
sun.position.set(-14, 10.4, -6); sun.target.position.set(0, 0.4, 0); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -2; sun.shadow.camera.right = 2;
sun.shadow.camera.top = 2; sun.shadow.camera.bottom = -2;
sun.shadow.normalBias = 0.015;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffe0be', 1.1); fill.position.set(1, 4, 6); scene.add(fill);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 30);
camera.position.set(0, 1.08, 3.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.48, 0); controls.enableDamping = true; controls.minDistance = 0.7; controls.maxDistance = 6;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.MeshStandardMaterial({ color: '#383630', roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true; scene.add(ground);
const models = [], stands = [], sfx = new Sfx();
let spinning = true, flexAll = false;
for (const [i, definition] of BEATERS.entries()) {
  const model = createBeaterModel(definition.id);
  const stand = new THREE.Group(); stand.position.x = (i - 2.5) * 0.39;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.155,0.163,0.033,64), new THREE.MeshStandardMaterial({ color: '#52483c', metalness: 0.3, roughness: 0.5 }));
  base.position.y = 0.006; base.receiveShadow = true; base.castShadow = true; stand.add(base);
  model.group.position.y = 0.13; stand.add(model.group); scene.add(stand);
  stands.push(stand); models.push({ ...model, impact: -10 });
  const button = document.createElement('button');
  button.append(document.createTextNode(definition.nameRu));
  const caption = document.createElement('small'); caption.textContent = `${definition.era} · ${definition.unlockCarpets} ковров`;
  button.append(caption); document.querySelector('#cards').append(button);
  button.addEventListener('click', () => { void sfx.unlock().then(() => sfx.hit(0.8, definition.sound.preset)); models[i].impact = performance.now() / 1000; });
}
document.querySelector('#rotate').onclick = event => { spinning = !spinning; event.target.textContent = `Вращение: ${spinning ? 'вкл.' : 'выкл.'}`; };
document.querySelector('#flex').onclick = () => { flexAll = !flexAll; };
function resize() {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  camera.position.z = 3.6 / Math.min(1, camera.aspect);
}
addEventListener('resize', resize); resize();
let frame;
function animate(now) {
  const t = now / 1000;
  for (const [i, model] of models.entries()) {
    stands[i].rotation.y = spinning ? Math.sin(t * 0.32) * 0.55 : stands[i].rotation.y;
    const age = t - model.impact;
    const pulse = age < 1 ? Math.sin(age * 22) * Math.exp(-age * 5) : 0;
    model.flex(flexAll ? 0.6 : Math.abs(pulse), pulse < 0 ? -1 : 1);
  }
  controls.update(); renderer.render(scene,camera); frame = requestAnimationFrame(animate);
}
frame = requestAnimationFrame(animate);
window.__beatersPreview = { models, renderer, scene, camera, setRotation: angle => { spinning = false; stands.forEach(s => { s.rotation.y = angle; }); } };
if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelAnimationFrame(frame); removeEventListener('resize',resize); controls.dispose(); models.forEach(m => m.dispose());
  scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); o.shadow?.map?.dispose(); });
  environment.dispose(); renderer.dispose(); renderer.domElement.remove(); void sfx.context?.close(); delete window.__beatersPreview;
});
