"""Acceptance on actual WebGL orthographic captures, independently of geometry."""
import cv2,numpy as np,json,pathlib
QA=pathlib.Path(__file__).resolve().parent
cfg=json.loads((QA/'grid.json').read_text())
report={'facades':{},'thresholds':{'straightnessDegrees':.3,'floorPitchErrorPixels':1,'wheelAspectError':.03,'sillErrorPixels':1}}
def edge_samples(gray,vertical,pos,start,end,radius=5,outside=0):
    pos,start,end=round(pos),round(start),round(end)
    strip=gray[start:end,pos-radius:pos+radius+1] if vertical else gray[pos-radius:pos+radius+1,start:end].T
    # Select the longest connected structural edge in the narrow frame strip.
    # Isolated paint grain cannot displace samples along a window edge.
    roi=gray[start:end,pos-radius:pos+radius+1] if vertical else gray[pos-radius:pos+radius+1,start:end]
    detected=cv2.createLineSegmentDetector().detect(roi)[0]
    candidates=[]
    if detected is not None:
        for x1,y1,x2,y2 in detected.reshape(-1,4):
            length=np.hypot(x2-x1,y2-y1)
            if length<(end-start)*.20:continue
            along=(y2-y1) if vertical else (x2-x1)
            across=(x2-x1) if vertical else (y2-y1)
            coordinate=float((x1+x2)/2 if vertical else (y1+y2)/2)
            if outside<0 and coordinate>=radius-.5:continue
            if outside>0 and coordinate<=radius+.5:continue
            if abs(along)>length*.9:
                candidates.append((length,float(np.degrees(np.arctan(abs(across/along)))),float((x1+x2)/2 if vertical else (y1+y2)/2)))
    if not candidates: raise AssertionError(('No connected frame edge',vertical,pos,start,end))
    _,angle,position=max(candidates)
    points=np.argmax(np.abs(np.diff(strip.astype(float),axis=1)),axis=1)+pos-radius
    return angle,position+pos-radius,points

for name in ['panel','panel335','brick','nine','top-front-panel','top-front-panel335','top-front-brick','top-front-nine']:
    family=name.removeprefix('top-front-')
    im=cv2.imread(str(QA/f'ortho-{name}.png'));gray=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
    c=cfg['families'][family];rows=9 if family=='nine' else 5;centre=12.15 if rows==9 else 6.75;halfPixels=1800 if rows==9 else 1000;bay=c['bay']*2000/15;left=halfPixels-2*bay
    x0,y0,x1,y1=c['openingPixels'];angles=[];aspects=[];frameTops=[[] for _ in range(rows)]
    theta=np.arctan2(7.25,35) if name.startswith('top-front-') else 0
    pitchExpected=360*np.cos(theta);top=halfPixels-(centre*np.cos(theta)-2*c['bay']*np.sin(theta))*2000/15
    for row in range(rows):
        for col in range(4):
            l=left+col*bay+x0/1008*bay;r=left+col*bay+x1/1008*bay;t=top+row*pitchExpected+y0/1008*pitchExpected;b=top+row*pitchExpected+y1/1008*pitchExpected
            al,dl,_=edge_samples(gray,True,l,t+8,b-8);ar,dr,_=edge_samples(gray,True,r,t+8,b-8)
            at,dt,_=edge_samples(gray,False,t,l+8,r-8,outside=-1);ab,db,_=edge_samples(gray,False,b,l+8,r-8)
            angles.extend([al,ar,at,ab]);aspects.append((dr-dl)/(db-dt));frameTops[row].append(dt)
    gradient=np.abs(np.diff(gray.astype(float),axis=0)).mean(axis=1)
    expectedLines=[round(top+i*pitchExpected) for i in range(1,rows)]
    floors=[int(y-3+np.argmax(gradient[y-3:y+4])) for y in expectedLines]
    jointCandidates=floors
    floors=[float(np.median(values)) for values in frameTops]
    pitch=np.diff(floors)
    result={'floors':rows,'straightnessDegrees':max(angles),'windowFrameTopRowsPixels':floors,'jointCandidateRowsPixels':jointCandidates,'floorPitchMethod':'spacing of repeated detected window-frame top edges; separates courses from structural floors','floorPitchPixels':pitch.tolist(),'floorPitchMaxErrorPixels':float(np.max(abs(pitch-pitchExpected))),'floorHeightVariancePixelsSquared':float(np.var(pitch)),'windowAspectMean':float(np.mean(aspects)),'windowAspectRange':[min(aspects),max(aspects)]}
    report['facades'][name]=result
    assert result['straightnessDegrees']<=.3,(family,result)
    assert result['floorPitchMaxErrorPixels']<=1,(family,result)
im=cv2.imread(str(QA/'ortho-car-side.png'));gray=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
wheels=[]
for cx in [516,1484]:
    crop=gray[1016:1296,cx-140:cx+140]
    count,labels,stats,centres=cv2.connectedComponentsWithStats((crop<65).astype(np.uint8))
    index=1+np.argmax(stats[1:,cv2.CC_STAT_AREA]);x,y,w,h,area=stats[index]
    contours,_=cv2.findContours((labels==index).astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    contour=max(contours,key=cv2.contourArea).reshape(-1,2)
    # Fit the external tyre arc excluding the chassis connection; upper dark paint/shadow can connect
    # to rubber and must not be mistaken for an elliptical tyre.
    towardsChassis=contour[:,0]>140 if cx==516 else contour[:,0]<140
    chassisBand=(contour[:,1]>=150)&(contour[:,1]<=204)
    lower=contour[~(towardsChassis&chassisBand)]
    ellipse=cv2.fitEllipse(lower.reshape(-1,1,2));axes=ellipse[1]
    aspect=max(axes)/min(axes)
    wheels.append({'visibleTyreEllipseAxesPixels':list(axes),'aspect':float(aspect),'darkComponentBoundsPixels':[int(w),int(h)],'method':'ellipse on external tyre contour excluding the known chassis connection'})
    assert abs(aspect-1)<=.03,wheels
# Straight lower sill is the painted volume's bottom edge between wheel arches.
angle,line,points=edge_samples(gray,False,1148,680,1320,radius=5)
report['car']={'wheels':wheels,'sillStraightnessDegrees':angle,'sillMaxDeviationPixels':float(np.max(abs(points-np.median(points))))}
assert report['car']['sillMaxDeviationPixels']<=1,report['car']
(QA/'geometry-quality.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
