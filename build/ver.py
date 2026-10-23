#!/usr/bin/env python3
"""Mostra questões de texto ainda sem explicação.  ver.py ANO [N] [DIA]"""
import json, sys, os, glob
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q = json.loads(open(R + "/site/data.js", encoding="utf-8").read()[len("window.QUESTOES="):].rstrip().rstrip(";"))
feitas = set()
for f in glob.glob(R + "/build/partes/*.json"):
    feitas |= set(json.load(open(f, encoding="utf-8")))
ano = int(sys.argv[1]); n = int(sys.argv[2]) if len(sys.argv) > 2 else 12
dia = int(sys.argv[3]) if len(sys.argv) > 3 else None
COM_FIG = os.environ.get("VER_FIG") == "1"
sel = [q for q in Q if (COM_FIG or not any("i" in x for x in q.get("enunciado", []))) and q["ano"] == ano and q["id"] not in feitas and q.get("alts") and q["gabarito"] != "X" and (dia is None or q["dia"] == dia)]
print(f"# faltam {len(sel)} de texto em {ano}")
ant = ""
for q in sel[:n]:
    t = " ".join(p["t"] if "t" in p else "[FIGURA]" for p in q["enunciado"]).replace("\n", " ")
    k = 0
    while k < min(len(t), len(ant)) and t[k] == ant[k]:
        k += 1
    if k > 300:
        t = "[…texto base igual ao da questão anterior…] " + t[k:]
    else:
        ant = t
    if len(t) > 1300 and not os.environ.get("VER_FULL"):
        t = t[:650] + " […] " + t[-600:]
    print(f"\n## {q['id']} gab={q['gabarito']}\n{t}")
    for l, a in q["alts"].items():
        print(f"{l}) {a['t']}{' [FIG]' if a.get('i') else ''}")
