// Shared with desktop colour QA: circular saturation-weighted hue and Rec.709
// sRGB luminance, measured at the same visible, GPU-filtered scan coordinates.
export function stats(data, indices) {
 let sin=0,cos=0,sat=0,lum=0,clipped=0;
 for(const i of indices){const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,s=max?d/max:0;
 const h=d?(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*Math.PI/3:0;
 sin+=Math.sin(h)*s;cos+=Math.cos(h)*s;sat+=s;lum+=.2126*r+.7152*g+.0722*b;if(max===1)clipped++;}
 return {pixels:indices.length,hue:(Math.atan2(sin,cos)*180/Math.PI+360)%360,saturation:sat/indices.length,luminance:lum/indices.length,clippedPercent:100*clipped/indices.length};
}
