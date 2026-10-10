"""Facade rectification and independent QA. Requires opencv-python-headless, scipy.
Four corner hints follow floor/panel joints; LSD line families refine perspective.
No reflection, neural upscale or synthesized photograph is used.
"""
import cv2, numpy as np, json, pathlib, sys
from scipy.optimize import least_squares
ROOT=pathlib.Path(__file__).resolve().parent.parent
CACHE=ROOT/'artifacts/facades2'; OUT=ROOT/'public/yard/photos'; QA=ROOT/'docs/qa/facades2'

def lines(image):
    gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    found=cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD).detect(gray)[0]
    if found is None: return []
    result=[]
    for x1,y1,x2,y2 in found.reshape(-1,4):
        dx,dy=x2-x1,y2-y1; length=np.hypot(dx,dy)
        angle=np.degrees(np.arctan2(dy,dx))%180
        if length<image.shape[0]*.07: continue
        if min(angle,180-angle)<12: family=0
        elif abs(angle-90)<12: family=1
        else: continue
        result.append((np.array([[x1,y1],[x2,y2]])/image.shape[0],family,float(length)))
    return result

def straightness(image):
    families=lines(image); stats={}
    for family,name in [(0,'horizontal'),(1,'vertical')]:
        vals=[]
        for p,f,length in families:
            if f!=family: continue
            d=p[1]-p[0]; angle=np.degrees(np.arctan2(d[1],d[0]))%180
            vals.append((min(angle,180-angle) if family==0 else abs(angle-90),length))
        if not vals: raise ValueError('No structural line family: '+name)
        absolute=sorted(vals)
        total=sum(w for _,w in vals); accum=0
        for value,w in absolute:
            accum+=w
            if accum>=total/2: break
        stats[name+'MedianDeviationDegrees']=float(value)
        signed=[]
        for p,f,length in families:
            if f!=family: continue
            d=p[1]-p[0]; angle=np.degrees(np.arctan2(d[1],d[0]))%180
            signed.append((angle if angle<90 else angle-180,length) if family==0 else (angle-90,length))
        signed.sort(); accum=0
        for angle,w in signed:
            accum+=w
            if accum>=total/2: break
        consensus=[(a,w) for a,w in signed if abs(a-angle)<3]
        orientation=sum(a*w for a,w in consensus)/sum(w for _,w in consensus)
        stats[name+'Degrees']=float(orientation); stats[name+'Segments']=len(vals)
    return stats

def rectify(image,corners):
    n=768
    base=cv2.getPerspectiveTransform(np.float32(corners),np.float32([[0,0],[n,0],[n,n],[0,n]]))
    initial=cv2.warpPerspective(image,base,(n,n),flags=cv2.INTER_LANCZOS4)
    detected=lines(initial)
    def matrix(params):
        a,b,c,d=params
        return np.array([[1,a,0],[b,1,0],[c,d,1]],np.float64)
    def residual(params):
        transform=matrix(params); values=[]
        for p,f,length in detected:
            v=np.column_stack((p,np.ones(2)))@transform.T; q=v[:,:2]/v[:,2:]; delta=q[1]-q[0]
            values.append(delta[1-f]/max(.01,np.linalg.norm(delta))*np.sqrt(length))
        return values
    fit=least_squares(residual,[0,0,0,0],loss='soft_l1',f_scale=.03,max_nfev=300,bounds=([-.25,-.25,-.3,-.3],[.25,.25,.3,.3]))
    h=matrix(fit.x); p=np.float64([[0,0,1],[1,0,1],[1,1,1],[0,1,1]])@h.T;p=p[:,:2]/p[:,2:]
    # Keep the corrected quad inside the module, avoiding replicated border stripes.
    lo=p.min(axis=0); hi=p.max(axis=0); scale=np.diag([1/(hi[0]-lo[0]),1/(hi[1]-lo[1]),1]); offset=np.array([[1,0,-lo[0]],[0,1,-lo[1]],[0,0,1]])
    pixel=np.diag([n,n,1])@scale@offset@h@np.diag([1/n,1/n,1])
    full=pixel@base
    # Refine the dominant signed family orientation; retain/disclose the spread
    # caused by worn joints, projecting sills and individual window frame edges.
    best=None
    for iteration in range(16):
        corrected=cv2.warpPerspective(image,full,(n,n),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_REFLECT_101)
        sample=cv2.resize(normalize(corrected),(1024,1024),interpolation=cv2.INTER_LANCZOS4)
        sample=cv2.addWeighted(sample,1.15,cv2.GaussianBlur(sample,(0,0),1.1),-.15,0)
        angles=straightness(cv2.resize(sample[8:1016,8:1016],(512,512),interpolation=cv2.INTER_AREA))
        score=max(abs(angles['horizontalDegrees']),abs(angles['verticalDegrees']))
        if best is None or score<best[0]:best=(score,full.copy(),corrected.copy())
        if score<.12: break
        ah=np.tan(np.radians(angles['horizontalDegrees']));av=np.tan(np.radians(angles['verticalDegrees']))
        shear=np.array([[1,av,-av*n/2],[-ah,1,ah*n/2],[0,0,1]])
        full=shear@full
    _,full,corrected=best
    return corrected,{'lineFit':fit.x.tolist(),'corners':corners,'homography':full.tolist(),'detectedSegments':len(detected),**straightness(corrected)}

def normalize(image):
    data=image.astype(np.float32); gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY); valid=(gray>77)&(gray<224)
    means=data[valid].mean(axis=0); data*=means.mean()/means
    low=cv2.GaussianBlur(cv2.cvtColor(data,cv2.COLOR_BGR2GRAY),(0,0),48)
    data*=np.clip(132/np.maximum(70,low),.7,1.65)[:,:,None]
    return np.clip(data,0,230).astype(np.uint8)

def metrics(image):
    gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    return {**straightness(image),'laplacianVariance':float(cv2.Laplacian(gray,cv2.CV_64F).var()),'blurEdgeFraction':float((cv2.magnitude(cv2.Sobel(gray,cv2.CV_32F,1,0),cv2.Sobel(gray,cv2.CV_32F,0,1))>24).mean())}

def build():
    cfg=json.loads((ROOT/'scripts/facade-modules.json').read_text(encoding='utf-8-sig')); report={'method':'LSD horizontal/vertical families; robust projective least squares; Lanczos4; mild unsharp; upright joint-aligned modules','photos':{},'thresholds':{'lineDegrees':.3,'laplacianVariance':8,'blurEdgeFraction':.025},'rejected':[{'source':11,'reason':'Valday: Laplacian variance 3.46–14.97 at 512px, blur and foliage; alternate sharp Tyumen bays used'},{'source':10,'reason':'Kantemitovskaya: soft highlights, unstable floor-line fit; sharp loggia family used for tower impostors'},{'source':9,'reason':'Gastello: tree/wire occlusion through loggias; sharper unobstructed Pavlovsky Posad used'},{'source':'previous 1024x512 atlases','reason':'wrong aspect, hand picks without line fitting, baked reflection; rebuilt from originals'}]}
    for family,s in cfg.items():
        image=cv2.imread(str(CACHE/f"{s['source']}.source"))
        if s['rotation']==90: image=cv2.rotate(image,cv2.ROTATE_90_CLOCKWISE)
        scale=image.shape[1]/s['preview'][0]
        atlas=np.zeros((2048,2048,3),np.uint8); emission=np.zeros((2048,2048),np.uint8); modules=[]
        for k,c in enumerate(s['modules']):
            print(family,k,flush=True)
            corners=(np.float32(c)*scale).tolist(); corrected,fit=rectify(image,corners)
            normalized=normalize(corrected)
            # Only Lanczos upscale. Concrete detail is a separate bounded normal.
            module=cv2.resize(normalized,(1024,1024),interpolation=cv2.INTER_LANCZOS4)
            module=cv2.addWeighted(module,1.15,cv2.GaussianBlur(module,(0,0),1.1),-.15,0)
            # Match wall boundaries across modules; joints remain on the boundary.
            mask=cv2.cvtColor(module,cv2.COLOR_BGR2GRAY)
            glass=((mask<102)&(np.indices(mask.shape)[1]>180)&(np.indices(mask.shape)[1]<840)&(np.indices(mask.shape)[0]>150)&(np.indices(mask.shape)[0]<820)).astype(np.uint8)*255
            glass=cv2.morphologyEx(glass,cv2.MORPH_OPEN,np.ones((7,7),np.uint8))
            # Bounded lit/curtain choices baked before mip generation, no fragment hash.
            if k==2:
                module=np.clip(module.astype(float)+glass[:,:,None]/255*np.array([7,8,9]),0,230).astype(np.uint8)
            x=(k%2)*1024;y=(k//2)*1024
            atlas[y:y+1024,x:x+1024]=module
            if k==1: emission[y:y+1024,x:x+1024]=cv2.GaussianBlur(glass,(0,0),3)*.42
            measurement=metrics(cv2.resize(module[8:1016,8:1016],(512,512),interpolation=cv2.INTER_AREA))
            modules.append({'slot':k,'type':['ground','typical-a','typical-b','top'][k],'nativeSize':[int(np.linalg.norm(np.array(corners[1])-corners[0])),int(np.linalg.norm(np.array(corners[3])-corners[0]))],**fit,'shipped':measurement})
        # Copy gutters per module, preventing neighbouring module mip bleed.
        for k in range(4):
            x=(k%2)*1024;y=(k//2)*1024
            cell=atlas[y:y+1024,x:x+1024]
            cell[:8]=cell[8];cell[-8:]=cell[-9];cell[:,:8]=cell[:,8:9];cell[:,-8:]=cell[:,-9:-8]
        cv2.imwrite(str(CACHE/f'{family}-albedo.png'),atlas)
        cv2.imwrite(str(CACHE/f'{family}-windows.png'),cv2.resize(emission,(1024,1024),interpolation=cv2.INTER_AREA))
        report['photos'][family]={'source':s['source'],'atlas':[2048,2048],'module':[1024,1024],'texelsPerMetre':[1008/s['bay'],1008/2.86],'modules':modules}
    QA.mkdir(parents=True,exist_ok=True);(QA/'rectification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({f:[m['shipped'] for m in p['modules']] for f,p in report['photos'].items()},indent=2))

def verify():
    report=json.loads((QA/'rectification.json').read_text());thresholds=report['thresholds'];summary={}
    for family in report['photos']:
        image=cv2.imread(str(OUT/f'{family}-albedo.webp'));assert image.shape[:2]==(2048,2048)
        results=[]
        for k in range(4):
            x=(k%2)*1024;y=(k//2)*1024
            cell=cv2.resize(image[y+8:y+1016,x+8:x+1016],(512,512),interpolation=cv2.INTER_AREA)
            value=metrics(cell);results.append(value)
            assert max(abs(value['horizontalDegrees']),abs(value['verticalDegrees']))<=thresholds['lineDegrees'],(family,k,value)
            assert value['laplacianVariance']>=thresholds['laplacianVariance'],(family,k,'blur')
            assert value['blurEdgeFraction']>=thresholds['blurEdgeFraction'],(family,k,'edges')
        summary[family]=results
    (QA/'quality.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary))

if __name__=='__main__':
    if '--verify' in sys.argv:verify()
    else:build()

