#!/usr/bin/env python3
"""Mostra questões por id (inclui as com figura).  ids.py ID [ID...]"""
import json, sys, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q = {q["id"]: q for q in json.loads(open(R + "/site/data.js", encoding="utf-8").read()[len("window.QUESTOES="):].rstrip().rstrip(";"))}
for i in sys.argv[1:]:
    q = Q[i]; print(f"\n## {i} gab={q['gabarito']}")
    if q.get("imagem"): print("(questão em imagem:", q["imagem"], ")"); continue
    t = " ".join(p["t"] if "t" in p else "[FIGURA]" for p in q["enunciado"]).replace("\n", " ")
    if len(t) > 1000 and not os.environ.get("VER_FULL"): t = t[:400] + " […] " + t[-550:]
    print(t)
    for l, a in q["alts"].items(): print(f"{l}) {a['t']}{' [FIG]' if a.get('i') else ''}")
