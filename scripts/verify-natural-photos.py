"""Decode delivered assets independently. Probe wall-plane joints, not projecting balcony edges."""
import cv2,numpy as np,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parent.parent;QA=ROOT/'docs/qa/natural';OUT=ROOT/'public/yard/photos'
report={'method':'Shipped WebP decode; strongest connected wall-joint gradient near each full-floor boundary, robust edge fit. Car edge RGB compared to nearest fully opaque local interior (chrome and tyres are car pixels).','facades':{},'cars':{}}
probes={'panel':(180,426),'panel335':(220,395),'brick':(380,420)}
for family,(a,b) in probes.items():
    wall=cv2.imread(str(OUT/f'{family}-albedo.webp'))[256:2040,8:2040];h,w=wall.shape[:2];gray=cv2.cvtColor(wall,cv2.COLOR_BGR2GRAY).astype(float)
    a,b=round(a*w/1000),round(b*w/1000);gradient=np.diff(gray[:,a:b],axis=0);edges=np.maximum(gradient,0);lines=[]
    for row in (range(5) if family=='brick' else range(1,5)):
        expected=(50 if family=='brick' else 0)+row*h/5;lo,hi=max(4,round(expected)-15),round(expected)+15
        peak=lo+np.argmax(np.mean(edges[lo:hi],axis=1))
        samples=peak-4+np.argmax(edges[peak-4:peak+5],axis=0)
        # Subpixel peak localisation avoids a whole-pixel staircase being
        # mistaken for a tilt on narrow window-frame probes.
        cols=np.arange(b-a);before=edges[samples-1,cols];at=edges[samples,cols];after=edges[samples+1,cols]
        denominator=before-2*at+after
        offset=np.divide(.5*(before-after),denominator,out=np.zeros_like(at),where=np.abs(denominator)>1e-6)
        samples=samples.astype(float)+np.clip(offset,-.5,.5)
        xs=np.arange(a,b);fit=np.polyfit(xs,samples,1)
        for _ in range(3):
            valid=np.abs(samples-np.polyval(fit,xs))<2.0
            if valid.sum()>20:fit=np.polyfit(xs[valid],samples[valid],1)
        lines.append({'centerY':float(np.polyval(fit,(a+b)/2)),'slope':float(fit[0]),'intercept':float(fit[1]),'angleDegrees':float(np.degrees(np.arctan(abs(fit[0])))),'supportPixels':int(valid.sum())})
    pitches=np.diff([p['centerY'] for p in lines]);seam=np.abs(wall[:,0].astype(float)-wall[:,-1].astype(float))@np.array([.0722,.7152,.2126]);meanLum=wall.mean(axis=(0,1))@np.array([.0722,.7152,.2126])
    result={'probeX':[a,b],'lines':lines,'pitchPixels':pitches.tolist(),'pitchErrorPixels':float(np.max(np.abs(pitches-h/5))),'straightnessDegrees':max(l['angleDegrees'] for l in lines),'edgeLuminanceDiscontinuityFraction':float(seam.mean()/meanLum)}
    result['passes']=result['pitchErrorPixels']<=1 and result['straightnessDegrees']<=.3 and result['edgeLuminanceDiscontinuityFraction']<.06;report['facades'][family]=result
for name in ['cream','red']:
    im=np.array(__import__('PIL.Image',fromlist=['open']).open(OUT/f'car-{name}-cutout.webp').convert('RGBA'));alpha=im[:,:,3];rgb=im[:,:,:3]
    interior=cv2.erode(np.uint8(alpha>=250)*255,np.ones((3,3),np.uint8));edge=(alpha>0)&(alpha<250)
    _,labels=cv2.distanceTransformWithLabels(255-interior,cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    nearest=rgb[interior>0][np.maximum(0,labels-1)];distance=np.sqrt(np.sum((rgb.astype(float)-nearest.astype(float))**2,axis=2));fraction=float(np.mean(distance[edge]>40))
    report['cars'][name]={'edgePixels':int(edge.sum()),'colourDistanceOver40Fraction':fraction,'passes':fraction<=.005}
report['passes']=all(s['passes'] for group in ['facades','cars'] for s in report[group].values())
(QA/'asset-quality.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report))
if not report['passes'] and '--report-only' not in sys.argv:sys.exit(1)
