"""Construct a frontal photographic composite from measured source quadrilaterals.

Wall courses, window panes and frames have independent homographies. Unlike a
global line-family fit, this cannot skew a window to compensate for a wall joint.
Coordinates are reviewed in the EXIF-upright previews named in facade-grid.json.
"""
import cv2, numpy as np, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT/'scripts/facade-grid.json').read_text())
OUT = ROOT/'artifacts/facades2'
QA = ROOT/'docs/qa/facades3'

def patch(image, corners, width, height, scale):
    h = cv2.getPerspectiveTransform(np.float32(corners)*scale,
        np.float32([[0,0],[width-1,0],[width-1,height-1],[0,height-1]]))
    return cv2.warpPerspective(image,h,(width,height),flags=cv2.INTER_LANCZOS4),h.tolist()

def neutral(image):
    data=image.astype(float)
    means=data.reshape(-1,3).mean(axis=0)
    data*=means.mean()/means
    return np.clip(data,0,230).astype(np.uint8)

report={'method':'manual source quad homographies per wall and pane; constructive frontal composite',
        'floorHeightMetres':2.7,'cellPixels':1008,'families':{}}
QA.mkdir(parents=True,exist_ok=True)
for family,c in CFG.items():
    image=cv2.imread(str(OUT/f"{c['source']}.source"))
    scale=image.shape[1]/c['preview'][0]
    wall,wh=patch(image,c['wall'],168,168,scale)
    wall=np.tile(wall,(6,6,1))
    # Photographic microtexture is periodic; courses/joints are independently
    # fixed, so no source perspective can leak back into the assembled grid.
    wall=neutral(wall)
    wall=np.clip(wall.astype(float)*132/max(1,wall.mean()),0,230).astype(np.uint8)
    if family=='brick':
        unit,_=patch(image,c['wall'],84,42,scale)
        wall=np.tile(neutral(unit),(24,12,1))
        for course in range(24):
            wall[course*42:(course+1)*42]=np.roll(wall[course*42:(course+1)*42],42 if course%2 else 0,axis=1)
            wall[course*42:course*42+2]=(105,108,106)
        wall=np.clip(wall.astype(float)*132/max(1,wall.mean()),0,230).astype(np.uint8)
    # Opening: 1.74 x 1.62m on panel, 2.75 x 1.62m on loggia.
    x0,x1=(64,944) if c['panes']==5 else (220,788)
    y0,y1=220,825
    window,windowH=patch(image,c['window'],x1-x0,y1-y0,scale)
    window=neutral(window)
    atlas=np.zeros((2048,2048,3),np.uint8)
    emission=np.zeros((2048,2048),np.uint8)
    for slot in range(4):
        cell=wall.copy()
        cell[y0:y1,x0:x1]=(172,174,172)
        # Rectify each pane independently; the source frame cannot create a
        # second crooked border inside the exact constructive frame.
        for pane in range(c['panes']):
            left=round(x0+(x1-x0)*pane/c['panes'])+8
            right=round(x0+(x1-x0)*(pane+1)/c['panes'])-8
            a=(pane+.20)/c['panes'];b=(pane+.80)/c['panes']
            corners=[[a*(x1-x0),.18*(y1-y0)],[b*(x1-x0),.18*(y1-y0)],[b*(x1-x0),.86*(y1-y0)],[a*(x1-x0),.86*(y1-y0)]]
            glass,_=patch(window,corners,right-left,y1-y0-16,1)
            cell[y0+8:y1-8,left:right]=glass
        # Exact rectangular frame and fixed pane centres. Source panes remain
        # photographic; their boundaries use a consistent narrow frame panel.
        frame=(172,174,172)
        cv2.rectangle(cell,(x0,y0),(x1-1,y1-1),frame,8)
        for pane in range(1,c['panes']):
            x=round(x0+(x1-x0)*pane/c['panes'])
            cell[y0:y1,x-3:x+4]=frame
        cv2.rectangle(cell,(x0,y0),(x1-1,y1-1),(65,70,68),6)
        # Straight sill and structural joints match on every module boundary.
        cell[y1:y1+8,x0-12:x1+12]=(117,120,119)
        cell[:4]=cell[-4:]=(104,108,106)
        cell[:,:4]=cell[:,-4:]=(104,108,106)
        # No floor changes its density or opening coordinates; seeded variants
        # change glass illumination only. End-bay uses the same border joint.
        mask=np.zeros((1008,1008),np.uint8)
        mask[y0+10:y1-10,x0+10:x1-10]=255
        for pane in range(1,c['panes']):
            x=round(x0+(x1-x0)*pane/c['panes']);mask[:,x-5:x+6]=0
        mask=(mask.astype(float)*(cv2.cvtColor(cell,cv2.COLOR_BGR2GRAY)<120)).astype(np.uint8)
        if slot==2: cell=np.clip(cell.astype(float)+mask[:,:,None]/255*8,0,230).astype(np.uint8)
        tile=cv2.copyMakeBorder(cell,8,8,8,8,cv2.BORDER_REPLICATE)
        x,y=slot%2*1024,slot//2*1024
        atlas[y:y+1024,x:x+1024]=tile
        if slot==1:
            glow=cv2.GaussianBlur(mask,(0,0),2)*.42
            emission[y+8:y+1016,x+8:x+1016]=glow
    cv2.imwrite(str(OUT/f'{family}-albedo.png'),atlas)
    cv2.imwrite(str(OUT/f'{family}-windows.png'),cv2.resize(emission,(1024,1024),interpolation=cv2.INTER_AREA))
    report['families'][family]={**c,'wallHomography':wh,'windowHomography':windowH,
        'openingPixels':[x0,y0,x1,y1],'windowAspect':((x1-x0)*c['bay'])/((y1-y0)*2.7),
        'slots':['ground','typical','glass-variation','top/end-bay'],
        'sourceLimitations':'Valday crop is softer than Tyumen; framing and grid are constructive, series identity follows the existing source catalogue' if family=='panel335' else None}
(QA/'grid.json').write_text(json.dumps(report,indent=2)+'\n')
