// Value-noise gradient: eight hashes, analytic derivatives, three vector potentials.
const noise = `
float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
vec3 gradNoise(vec3 p) {
 vec3 i=floor(p), f=fract(p), u=f*f*(3.-2.*f), d=6.*f*(1.-f);
 float a=hash(i),b=hash(i+vec3(1,0,0)),c=hash(i+vec3(0,1,0)),e=hash(i+vec3(1,1,0));
 float h=hash(i+vec3(0,0,1)),j=hash(i+vec3(1,0,1)),k=hash(i+vec3(0,1,1)),l=hash(i+vec3(1,1,1));
 return vec3(mix(mix(b-a,e-c,u.y),mix(j-h,l-k,u.y),u.z)*d.x,
 mix(mix(c-a,e-b,u.x),mix(k-h,l-j,u.x),u.z)*d.y,
 (mix(mix(h,j,u.x),mix(k,l,u.x),u.y)-mix(mix(a,b,u.x),mix(c,e,u.x),u.y))*d.z);
}
vec3 curl(vec3 p) { vec3 a=gradNoise(p),b=gradNoise(p+17.3),c=gradNoise(p+31.7);return vec3(c.y-b.z,a.z-c.x,b.x-a.y); }
`;
export const dustVertex = `
attribute vec3 aorigin, avelocity, aflowStart;
attribute vec4 alife, ashape, aplane;
uniform float time; uniform vec3 flow;
varying vec2 vUv; varying vec3 vWorld; varying vec4 vData; varying float vAlpha;
${noise}
void main() {
 float age=max(0.,time-alife.x), t=age/max(.001,alife.y), kind=ashape.x;
 float drag=kind<.5?3.6:2.8;
 vec3 drift=flow-aflowStart;
 vec3 p=aorigin+avelocity*(1.-exp(-drag*age))/drag+drift;
 vec3 q=aorigin*2.1+vec3(alife.w*.01,age*.22,0.);
 // Bounded procedural curl displacement; subtract birth field to avoid teleporting.
 p+=(curl(q)-curl(q-vec3(0.,age*.22,0.)))*(.07+.10*min(age,3.));
 p.y+=kind<.5?.065*age:-.018*age*age;
 if(kind>1.5) p.y-=.10*age*age;
 float size=alife.z*(kind<.5?1.+4.*min(t,1.):1.);
 float angle=ashape.y+age*(kind>1.5?2.:.13);
 vec2 xy=position.xy; if(kind>1.5) xy*=vec2(.25,2.8);
 xy=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*xy*size;
 vec4 center=viewMatrix*vec4(p,1.); center.xy+=xy;
 gl_Position=projectionMatrix*center;
 vUv=uv;vWorld=p;vData=vec4(kind,t,ashape.z,alife.w);
 float ground=smoothstep(.015,.14,p.y);
 float cloth=smoothstep(.008,.085,abs(dot(aplane.xyz,p)-aplane.w));
 vAlpha=ashape.w*smoothstep(0.,.08,age)*pow(max(0.,1.-t),1.6)*ground*cloth;
 if(time<alife.x || alife.y<=0. || t>=1.) {vAlpha=0.;gl_Position=vec4(2.,2.,2.,1.);}
}
`;
export const dustFragment = `
uniform sampler2D atlas; uniform float tiled,time; uniform vec3 sunDir;
varying vec2 vUv; varying vec3 vWorld; varying vec4 vData; varying float vAlpha;
vec4 frame(float f) {
 vec2 cell=vec2(mod(f,4.),3.-floor(f/4.));
 return texture2D(atlas,(cell+mix(vec2(.025),vec2(.975),vUv))/4.);
}
void main() {
 float alpha;
 if(vData.x<.5) {
  float f=mod(vData.y*14.+vData.z,16.);
  alpha=tiled>.5?mix(frame(floor(f)).a,frame(mod(floor(f)+1.,16.)).a,fract(f)):texture2D(atlas,vUv).a;
 } else {vec2 d=vUv*2.-1.;alpha=exp(-dot(d,d)*5.)*smoothstep(1.,.5,length(d));}
 float c=dot(normalize(cameraPosition-vWorld),-normalize(sunDir));
 float hg=.64/(12.56637*pow(max(.001,1.36-1.2*c),1.5));
 float sun=clamp(hg*1.5,0.,1.)*smoothstep(.1,1.3,vWorld.y);
 vec3 color=mix(vec3(.30,.27,.22),vec3(.72,.56,.38),sun);
 float twinkle=.65+.35*pow(.5+.5*sin(time*(2.+fract(vData.w)*3.)+vData.w),8.);
 if(vData.x>.5) {alpha*=twinkle*(.3+sun*1.7);color*=1.+sun*.6;}
 gl_FragColor=vec4(color,alpha*vAlpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
