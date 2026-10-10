"""Screen Commons previews, retaining disclosed heuristic scores (not identity claims)."""
import cv2, numpy as np, json, pathlib
from PIL import Image, ImageDraw
root=pathlib.Path('artifacts/natural'); records=[s for s in json.loads((root/'catalog.json').read_text(encoding='utf8')) if cv2.imread(str(root/f"{s['id']}.jpg")) is not None]
for s in records:
    im=cv2.imread(str(root/f"{s['id']}.jpg")); im=cv2.resize(im,(640,round(im.shape[0]*640/im.shape[1]))); h,w=im.shape[:2]
    wall=im[int(h*.15):int(h*.88),int(w*.1):int(w*.9)]
    gray=cv2.cvtColor(wall,cv2.COLOR_BGR2GRAY); hsv=cv2.cvtColor(wall,cv2.COLOR_BGR2HSV)
    green=float(np.mean((hsv[:,:,0]>30)&(hsv[:,:,0]<90)&(hsv[:,:,1]>45)))
    sharp=float(cv2.Laplacian(gray,cv2.CV_64F).var())
    lines=cv2.HoughLinesP(cv2.Canny(gray,70,170),1,np.pi/180,70,minLineLength=w*.12,maxLineGap=12)
    angles=[]
    for x1,y1,x2,y2 in ([] if lines is None else lines.reshape(-1,4)):
        a=np.degrees(np.arctan2(y2-y1,x2-x1)); a=(a+90)%180-90
        if abs(a)<30: angles.append(abs(a))
    tilt=float(np.median(angles)) if angles else 30
    s['screen']={'greenFraction':green,'laplacianVariance':sharp,'horizontalVanishingAngleDegrees':tilt,'score':float(np.log1p(sharp)-green*12-tilt*.16)}
records.sort(key=lambda s:s['screen']['score'],reverse=True)
(root/'ranking.json').write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf8')
for kind in ['wall','car']:
    selected=[s for s in records if s['car']==(kind=='car')]
    for page in range((len(selected)+23)//24):
        sheet=Image.new('RGB',(1600,6*230),'#eee');d=ImageDraw.Draw(sheet)
        for i,s in enumerate(selected[page*24:page*24+24]):
            im=Image.open(root/f"{s['id']}.jpg");im.thumbnail((395,195));x=(i%4)*400;y=(i//4)*230;sheet.paste(im,(x,y));d.text((x+4,y+196),f"{s['id']} {s['title'][:47]}",fill='black');d.text((x+4,y+212),f"tilt {s['screen']['horizontalVanishingAngleDegrees']:.1f} green {s['screen']['greenFraction']:.2f}",fill='black')
        sheet.save(root/f'{kind}-sheet-{page}.jpg')
print('ranked',len(records),'candidates')
