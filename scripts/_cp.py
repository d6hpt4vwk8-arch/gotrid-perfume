import json,re,sys
g=json.load(open('ops/desc-work/cos-groups.json'))
a,b=int(sys.argv[1]),int(sys.argv[2])
for x in g[a:b]:
    f=re.sub(r'\s+',' ',x['feed'])[:260]
    print('#%s %s | n=%d | %s'%(x['id'],x['name'][:90],len(x['codes']),x['cat'].replace('kosmetika/','')))
    if f: print(' F:',f)
