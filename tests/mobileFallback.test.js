import {it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three';
import {createRenderPipeline} from '../src/scene/renderPipeline.js';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('preserves the scene through composer failure and 30-frame GL fallback',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),sun=new THREE.DirectionalLight();scene.add(sun);
  let errors=false;
  const gl={NO_ERROR:0,isContextLost:()=>false,getError:()=>errors?1286:0};
  const renderer={domElement:{style:{}},shadowMap:{},info:{reset(){}},setPixelRatio:vi.fn(),setSize:vi.fn(),setRenderTarget:vi.fn(),getContext:()=>gl,render:vi.fn()};
  vi.stubGlobal('window',{devicePixelRatio:3,innerWidth:393,innerHeight:852,dispatchEvent:vi.fn()});
  vi.stubGlobal('document',{documentElement:{dataset:{}},hidden:false});
  vi.stubGlobal('CustomEvent',class {constructor(type,options){this.type=type;this.detail=options.detail;}});
  const pipeline=createRenderPipeline(renderer,scene,camera,sun,undefined,{name:'full'});
  expect(pipeline.profile).toBe('lite');expect(pipeline.composer).toBeUndefined();
  pipeline.render(1/30);expect(renderer.render).toHaveBeenCalledWith(scene,camera);
  expect(renderer.setRenderTarget.mock.calls[0][0].isWebGLRenderTarget).toBe(true);
  expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);
  errors=true;for(let i=0;i<30;i++)pipeline.render(1/30);
  expect(pipeline.profile).toBe('minimal');expect(scene.children).toEqual([sun]);
  expect(sun.shadow.mapSize.x).toBe(512);expect(pipeline.renderPixelRatio).toBe(.75);
  expect(renderer.setPixelRatio).toHaveBeenCalledTimes(1);expect(renderer.setSize).toHaveBeenCalledTimes(1);
  expect(()=>{for(let i=0;i<30;i++)pipeline.render(1/30);}).toThrow('Persistent WebGL');
});
it('adapts sustained slow lite frames once after warm-up',()=>{
  vi.stubGlobal('window',{devicePixelRatio:2,innerWidth:393,innerHeight:852,dispatchEvent:vi.fn()});
  vi.stubGlobal('document',{documentElement:{dataset:{}},hidden:false});
  vi.stubGlobal('CustomEvent',class {constructor(type,options){this.type=type;this.detail=options.detail;}});
  const renderer={domElement:{style:{}},shadowMap:{},info:{reset(){}},setPixelRatio(){},setSize(){},setRenderTarget(){},getContext:()=>({NO_ERROR:0,isContextLost:()=>false,getError:()=>0}),render(){}};
  const pipeline=createRenderPipeline(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),new THREE.DirectionalLight(),undefined,{name:'lite'});
  for(let i=0;i<240;i++){pipeline.render(1/20);pipeline.sampleFrame(50);}
  expect(pipeline.profile).toBe('minimal');
  expect(window.dispatchEvent.mock.calls.at(-1)[0].detail.label).toBe('Графика снижена');
});
it('shows a standalone watchdog panel with the failing step and selectable diagnostics',async()=>{
  vi.useFakeTimers();
  const nodes=[],events={};
  const root={append:node=>nodes.push(node)};
  const doc={documentElement:root,getElementById:id=>nodes.find(node=>node.id===id),createElement:tag=>({tag,style:{},children:[],setAttribute(){},append(node){this.children.push(node);},select:vi.fn()})};
  vi.stubGlobal('window',{document:doc,navigator:{userAgent:'test iPhone'},location:{href:'https://example.org/CoverHit/?full=1#game',reload:vi.fn(),assign:vi.fn()},devicePixelRatio:3,innerWidth:393,innerHeight:852,addEventListener:(name,callback)=>events[name]=callback});
  vi.resetModules();const guard=await import('../src/boot/bootGuard.js');
  guard.setBootStep('carpets manifest');guard.setAssetProgress(3,21);await vi.advanceTimersByTimeAsync(25000);
  const panel=nodes[0];expect(panel.id).toBe('boot-error');
  expect(panel.children[0].textContent).toBe('Не удалось запустить игру');
  expect(panel.children[1].textContent).toContain('carpets manifest');
  expect(panel.children[1].textContent).toContain('3/21');
  const textarea=panel.children.find(node=>node.tag==='textarea');expect(JSON.parse(textarea.value).ua).toBe('test iPhone');textarea.onclick();expect(textarea.select).toHaveBeenCalled();
  const buttons=panel.children.filter(node=>node.tag==='button');buttons[0].onclick();expect(window.location.reload).toHaveBeenCalledOnce();
  buttons[1].onclick();expect(window.location.assign).toHaveBeenCalledWith('https://example.org/CoverHit/?lite=1#game');
  events.error({message:'test failure'});expect(nodes).toHaveLength(1);
});
