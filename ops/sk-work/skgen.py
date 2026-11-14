# Semi-automatic CZ -> SK translator for templated product copy. Anything it can't
# translate with certainty goes to manual.json for hand translation.
#   python3 ops/sk-work/skgen.py [input.json] [outprefix]
import json,re,sys,collections
sys.path.insert(0,"ops/sk-work")
from skdict import LABELS,LEADS,FRAGS
try:
    from skdict2 import NAMES,NAMES_FIX
except Exception:
    NAMES,NAMES_FIX={},{}

# Name words: nouns/invariants only; adjectives need gender agreement so they stay manual.
GLOSS={
"osvěžovač":"osviežovač","osvěžovače":"osviežovače","náplň":"náplň","vzduchu":"vzduchu","sprchový gel":"sprchový gél","šampon":"šampón","kondicionér":"kondicionér",
"zubní pasta":"zubná pasta","zubní kartáček":"zubná kefka","ústní voda":"ústna voda","deodorant":"dezodorant","tuhé mýdlo":"tuhé mydlo","tekuté mýdlo":"tekuté mydlo","mýdlo":"mydlo",
"svíčka":"sviečka","svíčky":"sviečky","svíce":"sviečka","vůně do auta":"vôňa do auta","závěs":"záves","sůl do koupele":"soľ do kúpeľa","koupele":"kúpeľa",
"balzám na rty":"balzam na pery","krém na ruce":"krém na ruky","tělové mléko":"telové mlieko","mléko":"mlieko","pěna":"pena","olej":"olej","krém":"krém",
"vůně":"vôňa","auta":"auta","tyčinky":"tyčinky","rty":"pery","ruce":"ruky","pleť":"pleť","sérum":"sérum","maska":"maska","difuzér":"difuzér","sprej":"sprej",
"sprchový":"sprchový","tekuté":"tekuté","vlasy":"vlasy","vlasů":"vlasov","jablko":"jablko","skořice":"škorica","vanilka":"vanilka","levandule":"levanduľa","růže":"ruža","citron":"citrón",
"náhradní náplň":"náhradná náplň","dětský zubní kartáček":"detská zubná kefka","masážní gel":"masážny gél","bylinný balzám":"bylinný balzam","bylinná mast":"bylinná masť","olej na opalování":"olej na opaľovanie","pro":"pre","na":"na","do":"do","s":"s","a":"a","ml":"ml","g":"g","ks":"ks","kg":"kg","l":"l",
}
# Words that are certainly fine as-is (brand/English/numbers) are detected by absence of ě ř ů and of known Czech-only suffixes.
CZ_SUSPECT=re.compile(r"[ěřů]|(ní|ný|ná|né|ový|ová|ové|ící|ský|ská|ské|ého|ému|ých|ými|ím|ům|ách|ami|ech)$",re.I)
FOREIGN_OK=set("""air fresh candle gel cream shampoo edp with oil for scented care skin mask body men power hair sun anti white conditioner professional soft
 balm original sensitive roll on extra aroma ultra rose spice lotion face milk cleansing pink old eye image perfume argan night water lavender nourishing natural intensive
 lemon repair diffuser freshener flower ocean butter protect toner green blue hydrating invisible active protection multi plus herbal shower cleanser organic clean flowers
 beauty pure cotton soothing set peeling treatment vera bamboo strong super extrait venus glow toothpaste silver deo liquid after mint gold women coconut bb foam california
 wild days powder dark adidas expert olive facial eau classic linen cool smooth tea control keratin max ice homme age day""".split())

def tok_ok(t):
    tl=t.lower()
    return tl in GLOSS or tl in FOREIGN_OK or not CZ_SUSPECT.search(tl)

def cap(src,dst):
    if len(src)>1 and src.isupper(): return dst.upper()
    return dst[:1].upper()+dst[1:] if src[:1].isupper() else dst

def tr_name(name):
    """Translate a product title; returns (sk, ok)."""
    if name in NAMES_FIX: return NAMES_FIX[name],True
    out=name; 
    keys=sorted((k for k in GLOSS if " " in k),key=len,reverse=True)
    for k in keys:
        out=re.sub(r"(?<![\w])"+re.escape(k)+r"(?![\w])",lambda m:cap(m.group(0),GLOSS[k]),out,flags=re.I)
    def one(m):
        t=m.group(0); tl=t.lower()
        if tl in GLOSS and " " not in tl:
            if tl=="deodorant" and t[0].isupper(): return t
            return cap(t,GLOSS[tl])
        return t
    out=re.sub(r"[^\W\d_]+",one,out)
    sk_words={w.lower() for v in GLOSS.values() for w in re.findall(r"[^\W\d_]+",v)}
    bad=[t for t in re.findall(r"[^\W\d_]+",out) if (re.search(r"[ěřů]",t.lower()) or (CZ_SUSPECT.search(t.lower()) and t.lower() not in FOREIGN_OK)) and t.lower() not in sk_words]
    return out,(not bad)

def tr_li(html):
    items=re.findall(r"<li><strong>(.*?):</strong> (.*?)</li>",html)
    parts=[];unk=[]
    for lab,val in items:
        if lab not in LABELS: unk.append(("label",lab)); continue
        frs=[]
        for f in val.split(", "):
            if f in FRAGS: frs.append(FRAGS[f]); continue
            if re.fullmatch(r"[\d.,]+\s*(ml|g|l|kg|ks|mm|cm)\b.*",f): frs.append(f); continue
            ms=re.fullmatch(r"odstín (.+)",f)
            if ms and shade_sk(ms.group(1)): frs.append("odtieň "+shade_sk(ms.group(1))); continue
            mw=re.fullmatch(r"(\d) x ?(\d+ ?g)",f)
            if mw: frs.append(f"{mw.group(1)} x {mw.group(2).replace(' ','')[:-1]} g"); continue
            unk.append((lab,f)); frs.append(None)
        parts.append((LABELS[lab],frs))
    return parts,unk


SHADE={"tmavě":"tmavo","světle":"svetlo","středně":"stredne","plavý":"plavý","plavá":"plavá","hnědý":"hnedý","černý":"čierny","kaštanový":"gaštanový","měděný":"medený","zlatý":"zlatý","popelavý":"popolavý","červený":"červený",
"intenzivní":"intenzívny","čokoládový":"čokoládový","zvlášť":"zvlášť","popelavě":"popolavo","stříbřitě":"strieborne","zářivý":"žiarivý","modročerný":"modročierny","nugát":"nugát","šarlatově":"šarlátovo","platinová":"platinová","blond":"blond",
"mahagonový":"mahagónový","fialový":"fialový","ohnivě":"ohnivo","třešňově":"čerešňovo","rubínový":"rubínový","béžový":"béžový","tmavý":"tmavý","světlý":"svetlý","studený":"studený","teplý":"teplý","perlový":"perlový","kávově":"kávovo",
"hnědá":"hnedá","kaštanová":"gaštanová","tmavá":"tmavá","světlá":"svetlá","černá":"čierna","extra":"extra","ultra":"ultra","jasný":"jasný","medový":"medový","karamelový":"karamelový","lískový":"lieskový","ořech":"orech","ořechový":"orechový"}
def shade_sk(t):
    out=[]
    for w in t.split(" "):
        if re.fullmatch(r"[\d.,-]+",w) or w.lower() in {"extra","ultra"}: out.append(w); continue
        if w.lower() in SHADE: out.append(SHADE[w.lower()])
        else: return None
    return " ".join(out)

def rlead(lead):
    """Regex-family leads. Returns Slovak lead or None."""
    m=re.match(r"^(.*?) jsou odličovací tampony \((.+?)\) pro každodenní odličování\.$",lead)
    if m:
        t,ok=tr_name(m.group(1))
        if ok: return f"{t} sú odličovacie tampóny ({m.group(2)}) na každodenné odličovanie."
    m=re.match(r"^(.*?) jsou (hygienické|noční hygienické) vložky \((.+?)\)( s vyšší savostí| pro spolehlivou ochranu| ve výhodném balení)?\.$",lead)
    if m:
        t,ok=tr_name(m.group(1))
        tail={"":"" ," s vyšší savostí":" s vyššou savosťou"," pro spolehlivou ochranu":" pre spoľahlivú ochranu"," ve výhodném balení":" vo výhodnom balení"}[m.group(4) or ""]
        kind="hygienické vložky" if m.group(2)=="hygienické" else "nočné hygienické vložky"
        if ok: return f"{t} sú {kind} ({m.group(3)}){tail}."
    m=re.match(r"^(.*?) jsou noční vložky \((.+?)\)\.$",lead)
    if m:
        t,ok=tr_name(m.group(1))
        if ok: return f"{t} sú nočné vložky ({m.group(2)})."
    m=re.match(r"^Palette je barva na vlasy v odstínu (.+?) \(50 ml\)\. Dodává vlasům výrazný odstín( a pokrývá šediny)?; barvení provádějte podle návodu v balení\.$",lead)
    if m:
        sh=shade_sk(m.group(1))
        if sh: return f"Palette je farba na vlasy v odtieni {sh} (50 ml). Dodáva vlasom výrazný odtieň"+(" a pokrýva šedivé vlasy" if m.group(2) else "")+"; farbenie vykonávajte podľa návodu v balení."
    return None

import glob
HAND={}
for f in sorted(glob.glob("ops/sk-work/hand_*.py")):
    ns={}; exec(open(f).read(),ns); HAND.update(ns.get("H",{})); FRAGS.update(ns.get("F",{}))

def build(x):
    """-> (status dict). Complete when name, lead and bullets are all known."""
    h=HAND.get(x["code"],{})
    d=x["description"]; name_sk,nok=tr_name(x["name"])
    if "n" in h: name_sk,nok=h["n"],True
    res={"code":x["code"],"name_cz":x["name"],"name_sk":name_sk,"name_ok":nok,"need":[]}
    if "d" in h:
        res["desc"]=h["d"]; return res
    m=re.match(r"^<p>(.*?)</p><ul>(.*)</ul>$",d,re.S)
    if not m:
        res["need"].append(("plain",d)); return res
    lead,ul=m.group(1),m.group(2)
    lead_sk=h.get("l")
    if lead_sk is None: lead_sk=rlead(lead)
    if lead_sk is None:
        for suf,sk in LEADS.items():
            if lead.endswith(suf):
                title=lead[:-len(suf)]
                t_sk,tok=tr_name(title)
                if "t" in h: t_sk,tok=h["t"],True
                if tok: lead_sk=t_sk+sk
                else: res["need"].append(("title",title))
                break
        else:
            res["need"].append(("lead",lead))
    parts,unk=tr_li(ul)
    if "<li>" in ul and not parts:
        res["need"].append(("plain",d)); return res
    res["need"]+= [("frag",f"{a}: {b}") for a,b in unk]
    if not res["need"]:
        lis="".join(f"<li><strong>{lab}:</strong> {', '.join(f)}</li>" for lab,f in parts)
        res["desc"]=f"<p>{lead_sk}</p><ul>{lis}</ul>"
    return res

if __name__=="__main__":
    mode=sys.argv[1]
    A=json.load(open("ops/sk-work/all-remaining.json"))
    R=[build(x) for x in A]
    complete=[r for r in R if "desc" in r and r["name_ok"]]
    if mode=="stats":
        print(f"complete {len(complete)} / {len(R)}")
    elif mode=="work":
        n=int(sys.argv[2]); skip=int(sys.argv[3]) if len(sys.argv)>3 else 0
        todo=[r for r in R if not ("desc" in r and r["name_ok"])][skip:skip+n]
        for r in todo:
            print(f"{r['code']} | {r['name_cz']}"+("" if r["name_ok"] else " NAME?"))
            for k,v in r["need"]:
                print(f"   {k}: {v}")
    elif mode=="frags":
        import collections
        c=collections.Counter()
        for r in R:
            if "desc" in r: continue
            if all(k=="frag" for k,_ in r["need"]) and r["name_ok"]:
                for _,v in r["need"]: c[v]+=1
        for v,n in c.most_common(): print(v)
        print("--",len(c),"frags,",sum(1 for r in R if "desc" not in r and r["need"] and all(k=="frag" for k,_ in r["need"]) and r["name_ok"]),"items")
    elif mode=="emit":
        out=sys.argv[2]
        seen=set(); keep=[]
        for r in complete:
            if r["name_sk"] in seen: continue   # duplicate listing: leave untranslated, stays out of the SK feed
            seen.add(r["name_sk"]); keep.append(r)
        json.dump([{"code":r["code"],"nameSk":r["name_sk"],"descriptionSk":r["desc"]} for r in keep],open(out,"w"),ensure_ascii=False,indent=1)
        print("emitted",len(keep),"of",len(complete),"->",out)
    elif mode=="sample":
        import random
        random.seed(int(sys.argv[3]) if len(sys.argv)>3 else 1)
        for r in random.sample(complete,int(sys.argv[2])):
            print(r["code"],"|",r["name_cz"],"->",r["name_sk"]); print("  ",r["desc"])
