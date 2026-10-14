#!/usr/bin/env python3
"""Merge ops/sk-ui/ui_*.py (each defines D = {czech: slovak}) into messages/sk.json
and report tr("...") keys used in src/ that have no Slovak entry."""
import glob, json, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = {}
for f in sorted(glob.glob(os.path.join(root, "ops/sk-ui/ui_*.py"))):
    ns = {}
    exec(open(f, encoding="utf-8").read(), ns)
    D.update(ns["D"])
json.dump(D, open(os.path.join(root, "messages/sk.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
print(len(D), "entries")
keys = {}
pat = re.compile(r'\btr\(\s*(?:"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'|`([^`]*)`)')
for dp, dn, fn in os.walk(os.path.join(root, "src")):
    if "/admin" in dp: continue
    for n in fn:
        if not n.endswith((".ts", ".tsx")): continue
        p = os.path.join(dp, n)
        for m in pat.finditer(open(p, encoding="utf-8").read()):
            k = m.group(1) if m.group(1) is not None else m.group(2) if m.group(2) is not None else m.group(3)
            k = k.encode().decode("unicode_escape") if "\\" in k and False else k.replace('\\"', '"')
            keys.setdefault(k, p)
miss = [k for k in keys if k not in D]
print("used", len(keys), "missing", len(miss))
for k in miss: print(" MISSING:", repr(k), "<-", keys[k].replace(root + "/", ""))
