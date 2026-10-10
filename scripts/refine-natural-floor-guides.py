"""Authoring helper: incorporate measured residuals into the reviewed floor guide recipe."""
import json,pathlib
p=pathlib.Path('scripts/natural-recipe.json');r=json.loads(p.read_text(encoding='utf8'));q=json.loads(pathlib.Path('docs/qa/natural/asset-quality.json').read_text(encoding='utf8'))
for family,c in r['facades'].items():
    if q['facades'][family]['passes']:continue
    old=c['floorLines'];new=[list(x) for x in old];targets=c.get('floorTargets',[i*1784/5 for i in range(6)])
    for i,line in enumerate(q['facades'][family]['lines'],1):
        if line['angleDegrees']<=.3 and abs(line['centerY']-targets[i])<.5:continue
        for edge,x in enumerate([0,2031]):
            delta=line['slope']*x+line['intercept']-targets[i]
            direction=1 if delta>=0 else -1
            derivative=(old[i+1][edge]-old[i][edge])/(targets[i+1]-targets[i]) if direction>0 else (old[i][edge]-old[i-1][edge])/(targets[i]-targets[i-1])
            new[i][edge]+=delta*derivative*.5
    c['floorLines']=new
p.write_text(json.dumps(r,indent=2)+'\n',encoding='utf8')
