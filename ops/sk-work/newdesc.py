# Short factual CS + SK descriptions and SK names for the 1 615 products opened on 2026-11-14 (Tamda batch 3/4, SPV batch).
import json,re,sys
sys.path.insert(0,"ops/sk-work")
import skgen,skname3
CAND_CS="Zapalujte na rovném nehořlavém povrchu a nenechávejte bez dozoru."
CAND_SK="Zapaľujte na rovnom nehorľavom povrchu a nenechávajte bez dozoru."
SH_CS="Vmasírujte do mokrých vlasů a opláchněte."; SH_SK="Vmasírujte do mokrých vlasov a opláchnite."
SG_CS="Vmasírujte do mokré pokožky a opláchněte."; SG_SK="Vmasírujte do mokrej pokožky a opláchnite."
DYE_CS="Barvení provádějte podle návodu v balení."; DYE_SK="Farbenie vykonávajte podľa návodu v balení."
R=[ # regex on lowercased CS name -> (type_cs,type_sk,use_cs,use_sk)
(r"čajov|tea light|svíčky čajové","čajové svíčky","čajové sviečky",CAND_CS,CAND_SK),
(r"plovouc","plovoucí svíčka","plávajúca sviečka",CAND_CS,CAND_SK),
(r"svíč|svíce|candle|votiv|wick","svíčka","sviečka",CAND_CS,CAND_SK),
(r"slipov","slipové hygienické vložky","slipové hygienické vložky","",""),
(r"inkontinen","inkontinenční vložky","inkontinenčné vložky","",""),
(r"kalíšek","menstruační kalíšek","menštruačný kalíšok","",""),
(r"tampon","tampony","tampóny","",""),
(r"vložky|wings|ultra sorb|ultra|always|discreet","hygienické vložky","hygienické vložky","",""),
(r"intimní gel|mycí emulze|intimní","intimní hygienický přípravek","intímny hygienický prípravok","",""),
(r"toaletní papír","vlhčený toaletní papír","vlhčený toaletný papier","",""),
(r"ubrousk|wipes","vlhčené ubrousky","vlhčené utierky","",""),
(r"vatov|vata|cotton bud","vatové tyčinky","vatové tyčinky","",""),
(r"odličovací tampon","odličovací tampony","odličovacie tampóny","",""),
(r"barva na vlasy|barvící|root retoucher|color shampoo|oleo","barva na vlasy","farba na vlasy",DYE_CS,DYE_SK),
(r"tužidlo","barevné tužidlo na vlasy","farebné tužidlo na vlasy","",""),
(r"lak na vlasy|wellaflex|taft","lak na vlasy","lak na vlasy","",""),
(r"vosk na vlasy|gel na vlasy|pomád|styling|fiber","stylingový přípravek na vlasy","stylingový prípravok na vlasy","",""),
(r"kondicion","kondicionér na vlasy","kondicionér na vlasy","",""),
(r"maska|kúra|laminační","vlasová péče","vlasová starostlivosť","",""),
(r"šampon|shampoo","šampon na vlasy","šampón na vlasy",SH_CS,SH_SK),
(r"sprchov|shower|pěna.*koupel|bath|koupelov|bomba","sprchový a koupelový přípravek","sprchový a kúpeľový prípravok","",""),
(r"deodorant|deo\b|dns|antiperspir|tuhý","deodorant","dezodorant","",""),
(r"zubní pasta|zubní krém|tooth","zubní pasta","zubná pasta","Čistěte zuby dvakrát denně.","Čistite zuby dvakrát denne."),
(r"mezizubní","mezizubní kartáčky","medzizubné kefky","",""),
(r"kartáč.*zub|zubní kartáč|zubní kartáček","zubní kartáček","zubná kefka","",""),
(r"mezizubní","mezizubní kartáčky","medzizubné kefky","",""),
(r"párátk|parátk|dentek|nit\b|niť|floss","pomůcka k ústní hygieně","pomôcka na ústnu hygienu","",""),
(r"ústní voda|ústní","ústní voda","ústna voda","",""),
(r"fixační krém|corega","fixační krém na zubní protézu","fixačný krém na zubnú protézu","",""),
(r"holící|holítk|strojek|holení|shaving|gillette|venus","holicí potřeba","holiaca potreba","",""),
(r"krém na ruce|na ruce|hand","krém na ruce","krém na ruky","",""),
(r"tělové mléko|tělový krém|tělové sérum|body|tělový peeling|peeling","tělová péče","telová starostlivosť","",""),
(r"pleť|micel|odličov|face|sérum|maska|krém","pleťová péče","pleťová starostlivosť","",""),
(r"osvěžovač|air wick|airpure|fre-pro|pohlcovač|diffuser|difuz|vonné|aroma|esenciální","vůně do domácnosti","vôňa do domácnosti","",""),
(r"toaleta|wc|pisoár","osvěžovač toalety","osviežovač toalety","",""),
(r"parfém|toaletní voda|edt|edp|eau","parfém","parfum","",""),
]
CATS={"vonne-svicky":("svíčka","sviečka",CAND_CS,CAND_SK),"kosmetika/telo/intimni-hygiena":("hygienická potřeba","hygienická potreba","",""),"kosmetika/vlasy/sampony":("šampon na vlasy","šampón na vlasy",SH_CS,SH_SK),
"kosmetika/telo/doplnky":("kosmetická potřeba","kozmetická potreba","",""),"kosmetika/sprchove-gely":("sprchový gel","sprchový gél",SG_CS,SG_SK),"kosmetika/vlasy/barvy-na-vlasy":("barva na vlasy","farba na vlasy",DYE_CS,DYE_SK)}
def ptype(name,cat):
    n=name.lower()
    for rx,tc,ts,uc,us in R:
        if re.search(rx,n): return tc,ts,uc,us
    if cat in CATS: return CATS[cat]
    return "produkt","produkt","",""
def build(x,sk_name):
    name_cs=x["name"].replace("&#039;","'").replace("&amp;","&")
    tc,ts,uc,us=ptype(name_cs,x.get("cat"))
    b=x.get("brand")
    if b and b.lower() in ("vůně","vone","vône"): b=None
    bc=f" značky {b}" if b else ""
    bs=f" značky {b}" if b else ""
    cs=f"<p>{name_cs} – {tc}{bc}.{(' '+uc) if uc else ''}</p>"
    sk=f"<p>{sk_name} – {ts}{bs}.{(' '+us) if us else ''}</p>"
    return cs,sk
def fixunits(s):
    s=re.sub(r"(\d)(ml|ML)\b",r"\1 ml",s); s=re.sub(r"(\d)(ks|KS)\b",r"\1 ks",s); s=re.sub(r"(\d)(g|G)\b(?!\w)",r"\1 g",s)
    return s
if __name__=="__main__":
    a=json.load(open("ops/sk-work/new-all.json")); names=json.load(open("ops/sk-work/new-names-sk.json"))
    out=[];cs_out=[]
    for x in a:
        skn=fixunits(skname3.tr(x["name"]) if names[x["code"]]==None else names[x["code"]])
        cs,sk=build(x,skn)
        out.append({"code":x["code"],"nameSk":skn,"descriptionSk":sk}); cs_out.append({"code":x["code"],"description":cs})
    json.dump(out,open("ops/sk-work/new-done.json","w"),ensure_ascii=False,indent=1); json.dump(cs_out,open("ops/sk-work/new-cs-desc.json","w"),ensure_ascii=False,indent=1)
    import collections,random
    print(len(out), collections.Counter(len(set(d["nameSk"] for d in out))>0 for _ in [0]))
    dup=collections.Counter(d["nameSk"] for d in out); print("dup names",sum(1 for v in dup.values() if v>1))
    random.seed(9)
    for i in random.sample(range(len(out)),25): print(cs_out[i]["description"]); print(out[i]["nameSk"],"|",out[i]["descriptionSk"]); print()
