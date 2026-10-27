import json,re,collections
d=json.load(open('ops/desc-work/cosmetics-audit.json'))
fe=json.load(open('ops/desc-work/feed.json'))
kos=[x for x in d if any(c.startswith('kosmetika') for c in x['cats']) and x['dlen']<350]
def key(x):
    n=x['name'].lower()
    n=re.sub(r'\b\d+([.,]\d+)?\s*(ml|g|l|kg|ks|x|pcs|oz|mg)\b','',n)
    n=re.sub(r'[–\-,()]',' ',n); n=re.sub(r'\s+',' ',n).strip()
    return (x.get('brand') or '')+'|'+n
g=collections.OrderedDict()
for x in sorted(kos,key=lambda x:(-x['sales'],-(x['stock']+x['own']>0))): g.setdefault(key(x),[]).append(x)
def ftxt(x):
    return str(fe.get(x['code'].replace('SPV-',''),'')) if x['code'].startswith('SPV-') else ''
out=[]
for k,v in g.items():
    f=''
    for x in v:
        t=ftxt(x)
        if len(t)>150: f=t; break
    cat=[c for c in v[0]['cats'] if c.startswith('kosmetika')]
    out.append({'key':k,'brand':v[0].get('brand') or '','name':v[0]['name'],'codes':[x['code'] for x in v],'feed':f,'cat':(cat[0] if cat else ''),'sales':sum(x['sales'] for x in v),'stock':sum(x['stock']+x['own'] for x in v)})
A=[x for x in out if x['feed']]; B=[x for x in out if not x['feed']]
B=[x for x in B if x['stock']>0 or x['sales']>0]+[x for x in B if not(x['stock']>0 or x['sales']>0)]
res=A+B
for i,x in enumerate(res): x['id']='c%04d'%i
json.dump(res,open('ops/desc-work/cos-groups.json','w'),ensure_ascii=False)
print(len(A),len(B),len(res))
