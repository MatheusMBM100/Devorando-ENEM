"""Auditoria automática: aponta questões com sinais de erro de extração, gabarito ou explicação."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classificar import carregar, ROOT, norm
Q = carregar("data.js", "["); EXP = carregar("explicacoes.js", "{")
L = "ABCDE"
prob = {}
def add(q, m): prob.setdefault(q["id"], []).append(m)

for q in Q:
    qid = q["id"]; g = q.get("gabarito")
    if g not in list(L) + ["X"]: add(q, f"gabarito inválido {g!r}")
    imgs = list(q.get("imagem") or [])
    for p in q.get("enunciado") or []:
        if p.get("i"): imgs.append(p["i"])
    for a in (q.get("alts") or {}).values():
        if a: imgs += a.get("i") or []
    for i in imgs:
        f = os.path.join(ROOT, "site", i)
        if not os.path.exists(f): add(q, f"imagem ausente {i}")
        elif os.path.getsize(f) < 1500: add(q, f"imagem minúscula {i}")
    if q.get("alts"):
        alts = q["alts"]
        if sorted(alts) != list(L): add(q, "alternativas incompletas")
        txt = {l: (alts[l].get("t") or "").strip() for l in alts}
        vazias = [l for l in alts if not txt[l] and not alts[l].get("i")]
        if vazias: add(q, f"alternativas vazias {vazias}")
        if len({t for t in txt.values() if t}) < len([t for t in txt.values() if t]): add(q, "alternativas repetidas")
        for l, t in txt.items():
            if len(t) > 600: add(q, f"alt {l} muito longa ({len(t)}): possível vazamento de texto")
            if re.search(r"\[FIG|ENEM\s?20\d\d|CADERNO|Disponível em|Acesso em", t): add(q, f"alt {l} com lixo: {t[-60:]!r}")
        en = " ".join(p.get("t", "") for p in q.get("enunciado") or [])
        if len(en) < 25 and not any(p.get("i") for p in q.get("enunciado") or []): add(q, "enunciado curtíssimo")
        if re.search(r"\bQUESTÃO\s+\d+|ENEM\s?20\d\d\s*[-–]|CADERNO\s+\d", en, re.I): add(q, "enunciado com cabeçalho/rodapé")
        if "�" in en or re.search(r"[\x00-\x08]", en): add(q, "caracteres inválidos no enunciado")
    if g == "X": continue
    e = EXP.get(qid)
    if not e: add(q, "sem explicação"); continue
    cert = e.get("certa", "")
    if len(cert) < 40: add(q, "explicação da certa muito curta")
    if set(e.get("erradas", {})) != set(L) - {g}: add(q, "erradas ≠ outras letras")
    # a alternativa correta deve aparecer coerente na explicação
    if q.get("alts") and g in q["alts"]:
        t = (q["alts"][g].get("t") or "")
        nums = re.findall(r"\d+[.,]?\d*", t)
        if nums and len(t) < 40 and not any(n in cert.replace(" ", "") or n.replace(",", ".") in cert for n in nums):
            add(q, f"valor da alt. certa {t!r} não aparece na explicação")
    vagas = sum(1 for v in e.get("erradas", {}).values() if re.search(r"não decorre|não corresponde|resulta de erro|não é a\b", v) and len(v) < 90)
    if vagas >= 3: add(q, f"explicações das erradas genéricas ({vagas}/4)")
    if re.search(r"\?|talvez|provavelmente|não consigo|não verifiq", cert + " ".join(e["erradas"].values())): add(q, "explicação com dúvida/hedge")
    for l, v in e["erradas"].items():
        if re.search(rf"alternativa {g}\b", v, re.I) and len(v) < 60: add(q, f"errada {l} cita a certa")

tot = sum(len(v) for v in prob.values())
print(len(prob), "questões com", tot, "alertas")
from collections import Counter
c = Counter(re.sub(r"[\d'\[\]\w]*$", "", m.split(":")[0])[:40] for v in prob.values() for m in v)
for k, n in c.most_common(): print(f"{n:4d}  {k}")
json.dump(prob, open(os.path.join(ROOT, "build", "auditoria.json"), "w"), ensure_ascii=False, indent=1)
