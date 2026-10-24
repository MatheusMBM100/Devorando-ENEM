#!/usr/bin/env python3
"""Extrai um ano de prova dos PDFs em pdfs/ e junta ao site/data.js sem mexer nos outros anos.
Uso: python3 build/adicionar_ano.py 2018
Espera pdfs/ANO_PV_impresso_D1_CD1.pdf, ANO_PV_impresso_D2_CD5.pdf e os gabaritos ANO_GB_impresso_D1_CD1.pdf / D2_CD5.pdf."""
import json, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "site", "data.js")

def carregar(p):
    s = open(p, encoding="utf-8").read()
    return json.loads(s[len("window.QUESTOES="):].rstrip().rstrip(";"))

ano = int(sys.argv[1])
antes = carregar(DATA)
bak = DATA + ".bak"
shutil.copy(DATA, bak)
try:
    subprocess.run([sys.executable, "-B", os.path.join(ROOT, "build", "extract.py"), str(ano)], check=True)
    novas = carregar(DATA)
finally:
    shutil.copy(bak, DATA)   # restaura; o resultado final é gravado abaixo
    os.remove(bak)
if not novas:
    sys.exit("Nenhuma questão extraída: confira os nomes dos PDFs em pdfs/.")
todas = [q for q in antes if q["ano"] != ano] + novas
todas.sort(key=lambda x: (-x["ano"], x["dia"], x["n"], x.get("lingua", "")))
open(DATA, "w", encoding="utf-8").write("window.QUESTOES=" + json.dumps(todas, ensure_ascii=False) + ";")
print(f"{ano}: {len(novas)} questões adicionadas; total {len(todas)}")
