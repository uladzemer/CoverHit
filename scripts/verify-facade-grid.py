"""Independently decode shipped cells; measure fixed opening/frame edges."""
import cv2, numpy as np, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
QA=ROOT/'docs/qa/facades3'
cfg=json.loads((QA/'grid.json').read_text())
report={}
for family,c in cfg['families'].items():
    im=cv2.imread(str(ROOT/f'public/yard/photos/{family}-albedo.webp'))
    x0,y0,x1,y1=c['openingPixels']
    cells=[]
    for slot in range(4):
        tile=im[slot//2*1024+8:slot//2*1024+1016,slot%2*1024+8:slot%2*1024+1016]
        gray=cv2.cvtColor(tile,cv2.COLOR_BGR2GRAY).astype(float)
        angles=[]
        # Search the frame strip, without assuming that its edge is straight.
        for vertical,pos,start,end in [(True,x0-4,y0+15,y1-15),(True,x1+2,y0+15,y1-15),(False,y0-4,x0+15,x1-15),(False,y1+2,x0+15,x1-15)]:
            strip=gray[start:end,pos-2:pos+3] if vertical else gray[pos-2:pos+3,start:end].T
            edge=np.abs(np.diff(strip,axis=1))
            samples=np.argmax(edge,axis=1)+pos-2
            slope=np.polyfit(np.arange(len(samples)),samples,1)[0]
            angles.append(float(np.degrees(np.arctan(abs(slope)))))
        cells.append({'frameStraightnessDegrees':max(angles),'edgeDegrees':angles,'windowAspect':c['windowAspect']})
    report[family]=cells
    assert max(m['frameStraightnessDegrees'] for m in cells)<=.3,(family,cells)
(QA/'cell-quality.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
