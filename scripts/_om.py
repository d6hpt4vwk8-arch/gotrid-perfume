import json,re,unicodedata,collections
d=json.load(open('ops/desc-work/other-perfumes.json'))
feed=json.load(open('ops/desc-work/feed.json'))
mps=json.load(open('ops/gallery-cache/mps-body.json'))
need=[p for p in d if p['dlen']<350 and not any('doplnky' in x for x in p['cats'])]
def norm(s):
    s=unicodedata.normalize('NFKD',s.lower()); s=''.join(c for c in s if not unicodedata.combining(c)); return re.sub(r'[^a-z0-9 ]',' ',s)
def conc(s):
    n=norm(s)
    if re.search(r'toaletni|\bedt\b|eau de toilette',n): return 'edt'
    if re.search(r'parfemovana|\bedp\b|eau de parfum|parfumova',n): return 'edp'
    if re.search(r'extrait|extrakt',n): return 'ext'
    if re.search(r'kolinska|\bedc\b|cologne',n): return 'edc'
    if re.search(r'\bparfum\b|\bparfem\b',n): return 'par'
    return ''
def gender(s):
    n=norm(s)
    if re.search(r'panska|for men|pour homme|\bhomme\b|\bm\b',n) and not re.search(r'women|femme|damska',n): return 'm'
    if re.search(r'damska|for women|pour femme|\bfemme\b|\bw\b|\bwomen\b',n): return 'w'
    if re.search(r'unisex',n): return 'u'
    return ''
STOP=set("edp edt eau de toilette parfum parfumovana voda toaletni unisex panska damska pour ml for men women homme femme spray the of by extrait extrakt kolinska parfem tester vapo vaporisateur natural gift set".split())
def toks(s):
    return set(w for w in norm(s).split() if len(w)>1 and w not in STOP and not re.fullmatch(r'\d+(ml|g)?',w))
BRALIAS={'rabanne':['paco','rabanne'],'hugo boss':['boss','hugo'],'lancome':['lancome'],'jean paul gaultier':['gaultier','jean'],'giorgio armani':['armani'],'yves saint laurent':['saint','ysl'],'dolce gabbana':['dolce','gabbana'],'viktor rolf':['viktor','rolf']}
pool=[]
for p in mps:
    pool.append((toks(p['title']+' '+(p['vendor'] or '')),conc(p['title']),gender(p['title']),p))
def key(n):
    n=re.sub(r'\s*[–-]\s*\d+(?:[.,]\d+)?\s*(?:ml|g)\s*$','',n,flags=re.I); n=re.sub(r'\s+\d+(?:[.,]\d+)?\s*ml\s*$','',n,flags=re.I); return n.strip()
groups=collections.OrderedDict()
for p in sorted(need,key=lambda x:-x['sales']): groups.setdefault(key(p['name']).lower(),[]).append(p)
res=[]
for k,ps in groups.items():
    p=ps[0]; q=toks(k); c=conc(p['name']+' '+k); g=gender(p['name'])
    best=None
    for t,pc,pg,m in pool:
        if not t: continue
        if c and pc and c!=pc: continue
        if g and pg and g!=pg and 'u' not in (g,pg): continue
        if re.search(r'gift set|body|deodorant|hair mist|shower|lotion|tester',m['title'],re.I): continue
        i=len(q&t); sc=i/max(len(q),1)*0.7+i/max(len(t),1)*0.3
        if best is None or sc>best[0] or (sc==best[0] and len(m['images'])>len(best[1]['images'])): best=(sc,m)
    res.append({'key':k,'codes':[x['code'] for x in ps],'brand':p['brand'],'sales':sum(x['sales'] for x in ps),'feed':[feed.get(x['code'][4:],'')[:600] for x in ps if x['code'].startswith('SPV-')][:1],'score':best[0] if best else 0,'title':best[1]['title'] if best else None,'body':best[1]['body'][:700] if best else None,'imgs':len(best[1]['images']) if best else 0,'cat':'set' if any('darkove' in x for x in p['cats']) else 'perfume'})
json.dump(res,open('ops/desc-work/other-groups.json','w'),ensure_ascii=False)
print(len(res),'matched>=0.8',sum(1 for r in res if r['score']>=0.8),'>=0.65',sum(1 for r in res if r['score']>=0.65),'with feed',sum(1 for r in res if r['feed'] and len(r['feed'][0])>60),'neither',sum(1 for r in res if r['score']<0.65 and not (r['feed'] and len(r['feed'][0])>60)))
