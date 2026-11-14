import json,sys
L={"k":"Pre koho","u":"Použitie","p":"Hlavné prínosy","v":"Vôňa","h":"Doba horenia","t":"Hlavné tóny","w":"Kedy ju nosiť","c":"Charakter"}
def D(lead,*items):
    lis="".join(f"<li><strong>{L[k]}:</strong> {v}</li>" for k,v in items)
    return f"<p>{lead}</p><ul>{lis}</ul>"
R=[]
def add(code,name,desc): R.append({"code":code,"nameSk":name,"descriptionSk":desc})
def save(f): json.dump(R,open(f,"w"),ensure_ascii=False,indent=1); print(len(R),"->",f)
