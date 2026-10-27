import json,re,sys
g=json.load(open('ops/desc-work/other-groups.json'))
for i,x in enumerate(g): x['id']='g%03d'%i
json.dump(g,open('ops/desc-work/other-groups.json','w'),ensure_ascii=False)
a,b=int(sys.argv[1]),int(sys.argv[2])
for x in g[a:b]:
    f=(x['feed'][0] if x['feed'] else '')
    f=re.sub(r'\s+',' ',f)[:230]
    ret=''
    if x['score']>=0.65 and x['body']:
        bd=x['body']; m=re.search(r'(Notes? of|Top notes?|opens with|Opening)',bd,re.I)
        ret=(bd[m.start():] if m else bd)[:230]
    print('#%s %s | %s | n=%d | %s'%(x['id'],x['brand'],x['key'][:70],len(x['codes']),x['cat']))
    if f: print(' F:',f)
    if ret: print(' R[%s %.2f]:'%(x['title'][:40],x['score']),ret)
