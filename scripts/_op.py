import json,re,sys
g=json.load(open('ops/desc-work/oth-groups.json'))
a,b=int(sys.argv[1]),int(sys.argv[2])
for x in g[a:b]:
    f=re.sub(r'\s+',' ',x['feed'])[:230]
    print('#%s %s | n=%d | %s'%(x['id'],x['name'][:80],len(x['codes']),x['cat'].split('/')[0][:6]))
    if f: print(' F:',f)
