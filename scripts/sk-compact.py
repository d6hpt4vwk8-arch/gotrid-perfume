#!/usr/bin/env python3
"""Turns hand-translated compact blocks (see sk-export-all.ts) into the JSON sk-import.ts expects.
   python3 scripts/sk-compact.py ops/sk-work2/b01-sk.txt ops/sk-work2/b01-done.json
Block format:  #CODE / N: name / P: intro / K|U|B|T|W|C|V|Q|H: value  — or  RAW: <html>  (kept as is)."""
import json, re, sys
LABELS = {"K": "Pre koho:", "U": "Použitie:", "B": "Hlavné prínosy:", "T": "Hlavné tóny:", "W": "Kedy ju nosiť:", "C": "Charakter:",
          "V": "Vôňa:", "Q": "Vlastnosti:", "H": "Doba horenia:"}
src, dst = sys.argv[1], sys.argv[2]
rows = []
for block in re.split(r"\n\s*\n(?=#)", open(src, encoding="utf8").read().strip()):
    lines = [l for l in block.strip().split("\n") if l.strip()]
    code = lines[0].lstrip("#").strip()
    name = intro = raw = None
    items = []
    for l in lines[1:]:
        k, _, v = l.partition(": ")
        v = v.strip()
        if k == "N": name = v
        elif k == "P": intro = v
        elif k == "RAW": raw = v
        elif k in LABELS: items.append((LABELS[k], v))
        else: raise SystemExit(f"{code}: unknown line key {k!r}")
    if raw is not None:
        html = raw
    else:
        html = f"<p>{intro}</p>" if intro else "<p></p>"
        if items:
            html += "<ul>" + "".join(f"<li><strong>{a}</strong> {b}</li>" for a, b in items) + "</ul>"
    rows.append({"code": code, "nameSk": name, "descriptionSk": html})
json.dump(rows, open(dst, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(rows)} products → {dst}")
