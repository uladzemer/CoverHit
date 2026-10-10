"""Whole photographs, one wall homography and conservative alpha cutouts.

No wall synthesis, pane replacement, paint reconstruction or procedural grain.
Reviewed corner/polygon coordinates refer to previews with width 960/1000.
"""
import cv2, numpy as np, json, pathlib
from PIL import Image,ImageOps
ROOT=pathlib.Path(__file__).resolve().parent.parent
CACHE=ROOT/'artifacts/natural'; OUT=ROOT/'public/yard/photos'; QA=ROOT/'docs/qa/natural'
recipe=json.loads((ROOT/'scripts/natural-recipe.json').read_text(encoding='utf8'))
def read(source):
    return cv2.cvtColor(np.array(ImageOps.exif_transpose(Image.open(CACHE/f'{source}.original')).convert('RGB')),cv2.COLOR_RGB2BGR)
def save(path,im):
    Image.fromarray(cv2.cvtColor(im,cv2.COLOR_BGRA2RGBA if im.shape[2]==4 else cv2.COLOR_BGR2RGB)).save(path,'WEBP',quality=94,lossless=im.shape[2]==4)
def facade(family,c):
    im=read(c['source']); corners=np.float32(c['corners'])*im.shape[1]/c['previewWidth']
    for polygon in c.get('inpaint',[]):
        mask=np.zeros(im.shape[:2],np.uint8);cv2.fillPoly(mask,[np.int32(np.array(polygon)*im.shape[1]/c['previewWidth'])],255)
        im=cv2.inpaint(im,mask,5,cv2.INPAINT_TELEA)
    wall=cv2.warpPerspective(im,cv2.getPerspectiveTransform(corners,np.float32([[0,0],[2031,0],[2031,1783],[0,1783]])),(2032,1784),flags=cv2.INTER_CUBIC)
    cv2.imwrite(str(CACHE/f'{family}-rectified.png'),wall)
    # Small residual lens/pitch correction on whole floor strips. All photographed
    # windows, panels and balconies stay together; no independent window crops.
    if 'floorLines' in c:
        xx=np.arange(2032,dtype=np.float32); yy=np.arange(1784,dtype=np.float32)
        source=np.array(c['floorLines'],np.float32)*2032/1000
        mapY=np.empty((1784,2032),np.float32)
        targets=c.get('floorTargets',[row*1784/5 for row in range(6)])
        for row in range(len(targets)-1):
            lo=round(targets[row]);hi=round(targets[row+1])
            a=source[row,0]+(source[row,1]-source[row,0])*xx/2031
            b=source[row+1,0]+(source[row+1,1]-source[row+1,0])*xx/2031
            t=(yy[lo:hi]-targets[row])/(targets[row+1]-targets[row])
            mapY[lo:hi]=a[None,:]+t[:,None]*(b-a)[None,:]
        wall=cv2.remap(wall,np.broadcast_to(xx,(1784,2032)),mapY,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
    # Large-radius flat field: bounded, gently applied so stains/reflections survive.
    rgb=wall.astype(np.float32)/255; means=rgb.mean(axis=(0,1));rgb*=means.mean()/means
    low=cv2.GaussianBlur(cv2.cvtColor(rgb,cv2.COLOR_BGR2GRAY),(0,0),180)
    gain=np.clip(.53/np.maximum(low,.15),.80,1.22)
    rgb*=gain[:,:,None]**.45
    rgb*=np.linspace(1.025,.975,1784)[:,None,None]
    rgb*=.515/rgb.mean();wall=np.uint8(np.clip(rgb*255,0,245))
    # Join only the narrow wall margin; real openings and their reflections stay intact.
    for x in range(16):
        t=(16-x)/16;avg=(wall[:,x].astype(float)+wall[:,-1-x].astype(float))/2
        wall[:,x]=wall[:,x]*(1-t)+avg*t;wall[:,-1-x]=wall[:,-1-x]*(1-t)+avg*t
    atlas=np.zeros((2048,2048,3),np.uint8)
    concrete=cv2.imread(str(OUT/'concrete-reference.webp'));concrete=cv2.resize(concrete,(496,240));concrete=np.uint8(np.clip(concrete.astype(float)*131/concrete.mean(),0,240))
    for x in range(0,2048,512):atlas[8:248,x+8:x+504]=concrete
    atlas[256:2040,8:2040]=wall
    atlas[248:256]=atlas[256:257];atlas[2040:]=atlas[2039:2040]
    atlas[256:,0:8]=atlas[256:,8:9];atlas[256:,2040:]=atlas[256:,2039:2040]
    atlas[:8]=atlas[8:9];atlas[248:256]=atlas[247:248]
    save(OUT/f'{family}-albedo.webp',atlas)
    save(OUT/f'{family}-windows.webp',np.zeros((64,64,3),np.uint8))
    return wall
def bake(family,wall):
    # Bottom five floors retain the photographed entrance; upper floors reuse the
    # same section's four residential floors, without doors halfway up a tower.
    floors=16 if family=='tower' else 9 if family=='nine' else 5
    height=448;whole=np.zeros((height,512,3),np.uint8)
    width=recipe['facades'].get(family,recipe['facades']['panel'])['widthMetres'];buildingWidth=25.6 if family=='tower' else 60
    count=max(1,round(buildingWidth/width));bottom=round(height*5/floors)
    for i in range(count):
        x0=round(i*512/count);x1=round((i+1)*512/count)
        whole[height-bottom:,x0:x1]=cv2.resize(wall,(x1-x0,bottom),interpolation=cv2.INTER_AREA)
        if height>bottom:
            upper=wall[:round(wall.shape[0]*.8)]
            remaining=height-bottom;pitch=round(height*4/floors)
            while remaining>0:
                chunk=min(pitch,remaining);whole[remaining-chunk:remaining,x0:x1]=cv2.resize(upper,(x1-x0,pitch),interpolation=cv2.INTER_AREA)[-chunk:];remaining-=chunk
    tile=np.zeros((512,512,3),np.uint8);tile[:448]=whole
    concrete=cv2.imread(str(OUT/'concrete-reference.webp'));concrete=cv2.resize(concrete,(512,64));tile[448:]=np.uint8(np.clip(concrete.astype(float)*131/concrete.mean(),0,240))
    save(OUT/f'{family}-impostor-albedo.webp',np.tile(tile,(2,2,1)))
    save(OUT/f'{family}-impostor-windows.webp',np.zeros((64,64,3),np.uint8))
def cutout(c):
    if not c['polygon']:return None
    im=read(c['source']);im=cv2.resize(im,(1600,round(im.shape[0]*1600/im.shape[1])))
    # Two thin foreground ropes cross the cream photograph; local inpainting
    # affects their few pixels only, preserving the original paint everywhere else.
    if c['source']==220:
        wire=np.zeros(im.shape[:2],np.uint8)
        for a,b in [((0,410),(1000,366)),((0,604),(1000,528))]:cv2.line(wire,tuple(np.int32(np.array(a)*1.6)),tuple(np.int32(np.array(b)*1.6)),255,5)
        im=cv2.inpaint(im,wire,3,cv2.INPAINT_TELEA)
    poly=np.int32(np.array(c['polygon'])*1.6);area=np.zeros(im.shape[:2],np.uint8);cv2.fillPoly(area,[poly],255)
    mask=np.zeros(im.shape[:2],np.uint8);mask[cv2.dilate(area,np.ones((7,7),np.uint8))>0]=cv2.GC_PR_BGD;mask[area>0]=cv2.GC_PR_FGD;mask[cv2.erode(area,np.ones((51,51),np.uint8))>0]=cv2.GC_FGD
    for x0,y0,x1,y1,threshold in c.get('backgroundDarkBoxes',[]):
        x0,y0,x1,y1=np.int32(np.array([x0,y0,x1,y1])*1.6)
        region=mask[y0:y1,x0:x1];region[cv2.cvtColor(im[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY)<threshold]=cv2.GC_BGD
    cv2.grabCut(im,mask,None,np.zeros((1,65),float),np.zeros((1,65),float),3,cv2.GC_INIT_WITH_MASK)
    alpha=np.uint8((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD))*255
    alpha=cv2.bitwise_and(alpha,area)
    for hole in c.get('holes',[]):cv2.fillPoly(alpha,[np.int32(np.array(hole)*1.6)],0)
    alpha=cv2.morphologyEx(alpha,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8));alpha=cv2.erode(alpha,np.ones((3,3),np.uint8))
    # Close isolated segmentation pinholes while preserving wheel arches and
    # the large, deliberately open space below the body.
    count,holes,holeStats,_=cv2.connectedComponentsWithStats(255-alpha)
    for label in range(1,count):
        if holeStats[label,cv2.CC_STAT_AREA]<128:alpha[holes==label]=255
    n,labels,stats,_=cv2.connectedComponentsWithStats(alpha);alpha=np.uint8(labels==1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))*255
    # Transparent texels inherit nearest interior colours, preventing mip halos.
    interior=cv2.erode(alpha,np.ones((5,5),np.uint8));_,nearest=cv2.distanceTransformWithLabels(255-interior,cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    pixels=im[interior>0];bleed=pixels[np.maximum(0,nearest-1)];edge=(alpha>0)&(interior==0);im[edge]=bleed[edge];im[alpha==0]=bleed[alpha==0]
    alpha=cv2.GaussianBlur(alpha,(3,3),.45)
    if c.get('levelAngleDegrees'):
        # Rotate the entire photograph, never individual body/trim patches.
        # The reviewed wheel-centre axis supplies the angle in the recipe.
        angle=c['levelAngleDegrees'];h,w=alpha.shape
        transform=cv2.getRotationMatrix2D((w/2,h/2),angle,1)
        boundW=round(abs(transform[0,0])*w+abs(transform[0,1])*h)
        boundH=round(abs(transform[0,1])*w+abs(transform[0,0])*h)
        transform[:,2]+=[(boundW-w)/2,(boundH-h)/2]
        im=cv2.warpAffine(im,transform,(boundW,boundH),flags=cv2.INTER_CUBIC)
        alpha=cv2.warpAffine(alpha,transform,(boundW,boundH),flags=cv2.INTER_LINEAR)
    opaque=cv2.erode(np.uint8(alpha>=250)*255,np.ones((3,3),np.uint8))
    _,nearest=cv2.distanceTransformWithLabels(255-opaque,cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    pixels=im[opaque>0];bleed=pixels[np.maximum(0,nearest-1)]
    im[alpha<250]=bleed[alpha<250]
    ys,xs=np.where(alpha>10);x0,x1=max(0,xs.min()-4),min(im.shape[1],xs.max()+5);y0,y1=max(0,ys.min()-4),min(im.shape[0],ys.max()+5)
    im=im[y0:y1,x0:x1];alpha=alpha[y0:y1,x0:x1];rgba=np.dstack([im,alpha]);save(OUT/f"car-{c['name']}-cutout.webp",rgba)
    for name,bg in [('magenta',[255,0,255]),('green',[0,255,0])]:
        a=alpha[:,:,None]/255;cv2.imwrite(str(QA/f"cutout-{c['name']}-{name}.png"),np.uint8(im*a+np.array(bg)*(1-a)))
    return rgba
if __name__=='__main__':
    QA.mkdir(parents=True,exist_ok=True)
    walls={family:facade(family,c) for family,c in recipe['facades'].items()}
    for family in ['nine','tower']:
        walls[family]=walls['panel'];save(OUT/f'{family}-albedo.webp',cv2.imread(str(OUT/'panel-albedo.webp')));save(OUT/f'{family}-windows.webp',np.zeros((64,64,3),np.uint8))
    for family,wall in walls.items():bake(family,wall)
    for c in recipe['cars']:cutout(c)
