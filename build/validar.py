#!/usr/bin/env python3
"""Confere site/explicacoes.js: toda explicação cobre exatamente as alternativas erradas do gabarito."""
import json, os, collections
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q = json.loads(open(R + "/site/data.js", encoding="utf-8").read()[len("window.QUESTOES="):].rstrip().rstrip(";"))
E = json.loads(open(R + "/site/explicacoes.js", encoding="utf-8").read()[len("window.EXPLICACOES = "):].rstrip().rstrip(";"))
by = {q["id"]: q for q in Q}
bad = [k for k, v in E.items() if k not in by or set(v["erradas"]) != set("ABCDE") - {by[k]["gabarito"]} or not v["certa"].strip()]
print("com problema:", bad or "nenhuma")
val = [q for q in Q if q["gabarito"] != "X"]
c = collections.Counter(q["ano"] for q in val if q["id"] in E)
print(f"explicadas {len(E)}/{len(val)} |", ", ".join(f"{a}: {c[a]}/{sum(1 for q in val if q['ano']==a)}" for a in sorted(c, reverse=True)))
