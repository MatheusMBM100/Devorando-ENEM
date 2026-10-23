#!/usr/bin/env python3
"""Junta build/partes/*.json em site/explicacoes.js"""
import json, glob, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
for f in sorted(glob.glob(R + "/build/partes/*.json")):
    out.update(json.load(open(f, encoding="utf-8")))
open(R + "/site/explicacoes.js", "w", encoding="utf-8").write("window.EXPLICACOES = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
print(len(out), "explicações")
