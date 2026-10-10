import {dustVertex} from '../src/fx/dust/shaders.js';
// Capture the real production vertex shader, including curl, settling and
// cloth/ground alpha gates. vAlpha is each particle's peak opacity envelope.
export function createDustProbe(d){
 const gl=document.createElement('canvas').getContext('webgl2');
 if(!gl)throw Error('WebGL2 required for dust transform feedback');
 const compile=(kind,source)=>{const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
 const vertex=compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;\nuniform mat4 projectionMatrix,viewMatrix;\nin vec3 position;in vec2 uv;\n'+dustVertex.replaceAll('attribute ','in ').replaceAll('varying ','out '));
 const fragment=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.);}');
 const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.transformFeedbackVaryings(program,['vWorld','vAlpha'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);gl.bindVertexArray(gl.createVertexArray());
 for(const [name,attr] of Object.entries(d.attributes)){
  const location=gl.getAttribLocation(program,'a'+name);if(location<0)continue;
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,attr.array,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,attr.itemSize,gl.FLOAT,false,0,0);
 }
 const matrix=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 for(const name of ['projectionMatrix','viewMatrix'])gl.uniformMatrix4fv(gl.getUniformLocation(program,name),false,matrix);
 const output=gl.createBuffer(),values=new Float32Array(d.capacity*4);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,values.byteLength,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
 const time=gl.getUniformLocation(program,'time'),flow=gl.getUniformLocation(program,'flow');
 return ()=>{
  gl.uniform1f(time,d.time);gl.uniform3f(flow,d.flow.x,d.flow.y,d.flow.z);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,d.capacity);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);
  let count=0,faded=0,cloud=0,x=0,z=0;
  for(let i=0;i<d.capacity;i++)if(d.attributes.life.getY(i)>0){
   count++;if(values[i*4+3]<.05)faded++;
   if(d.attributes.shape.getX(i)<.5){cloud++;x+=values[i*4]-d.attributes.origin.getX(i);z+=values[i*4+2]-d.attributes.origin.getZ(i);}
  }
  return {faded:faded/count,centre:Math.hypot(x/cloud,z/cloud)};
 };
}
