#!/usr/bin/env python3
"""Gera, com a API da Anthropic, a explicação de cada questão (por que a certa está certa
e por que cada uma das outras está errada) e grava em site/explicacoes.js.

Uso:
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 build/gerar_explicacoes.py                 # todas as que faltam
  python3 build/gerar_explicacoes.py --anos 2025 2024
  python3 build/gerar_explicacoes.py --limite 20     # teste pequeno
  python3 build/gerar_explicacoes.py --dry-run       # só mostra o prompt de uma questão

Pode ser interrompido e rodado de novo: continua de onde parou.
"""
import argparse, base64, json, os, re, sys, threading, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
MODEL = "claude-sonnet-5-5"
LETRAS = "ABCDE"

SISTEMA = (
    "Você é um professor experiente de cursinho preparatório para o ENEM. "
    "Explique questões em português do Brasil, com clareza, precisão e linguagem acessível a um estudante do ensino médio. "
    "O gabarito oficial do INEP é a verdade: nunca o conteste, apenas explique o raciocínio que leva a ele."
)


def carregar_questoes():
    t = open(os.path.join(SITE, "data.js"), encoding="utf-8").read()
    return json.loads(t[len("window.QUESTOES="):].rstrip().rstrip(";"))


def carregar_exp():
    p = os.path.join(SITE, "explicacoes.js")
    if not os.path.exists(p):
        return {}
    t = open(p, encoding="utf-8").read()
    m = re.search(r"=\s*(\{.*\})\s*;?\s*$", t, re.S)
    return json.loads(m.group(1)) if m else {}


def salvar_exp(exp):
    tmp = os.path.join(SITE, "explicacoes.js.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("window.EXPLICACOES = " + json.dumps(exp, ensure_ascii=False, indent=1) + ";\n")
    os.replace(tmp, os.path.join(SITE, "explicacoes.js"))


def img_block(path):
    with open(os.path.join(SITE, path), "rb") as f:
        data = base64.standard_b64encode(f.read()).decode()
    return {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}}


def montar(q):
    g = q["gabarito"]
    outras = [l for l in LETRAS if l != g]
    instr = (
        f"Questão do ENEM {q['ano']} (nº {q['n']}, área: {q['area']}). "
        f"Gabarito oficial: alternativa {g}.\n\n"
        "Responda SOMENTE com um objeto JSON válido, sem markdown, neste formato:\n"
        '{"certa": "...", "erradas": {' + ", ".join(f'"{l}": "..."' for l in outras) + "}}\n\n"
        f'- "certa": por que a alternativa {g} está correta (2 a 5 frases; mostre o raciocínio ou os cálculos passo a passo quando for o caso).\n'
        '- "erradas": para CADA uma das outras alternativas, 1 a 3 frases dizendo especificamente por que está errada '
        "(o erro conceitual, a distorção do texto ou o erro de conta que ela representa).\n"
        "- Não repita o enunciado. Não use LaTeX; escreva fórmulas em texto simples (ex.: v = d/t, x², √2)."
    )
    content = []
    if q.get("imagem"):
        content.append({"type": "text", "text": "A questão completa (enunciado e alternativas) está nas imagens a seguir."})
        for p in q["imagem"]:
            content.append(img_block(p))
    else:
        partes = []
        for p in q.get("enunciado", []):
            if "t" in p:
                partes.append(p["t"])
            else:
                content.append({"type": "text", "text": "\n".join(partes)}) if partes else None
                partes = []
                content.append(img_block(p["i"]))
        corpo = "\n".join(partes)
        alts = "\n".join(f"{l}) {q['alts'][l]['t']}" for l in LETRAS if l in q["alts"])
        content.append({"type": "text", "text": f"{corpo}\n\n{alts}"})
        for l in LETRAS:
            for p in q["alts"].get(l, {}).get("i", []):
                content.append({"type": "text", "text": f"Imagem da alternativa {l}:"})
                content.append(img_block(p))
    content.append({"type": "text", "text": instr})
    return content


def chamar(content, chave):
    corpo = json.dumps({
        "model": MODEL, "max_tokens": 1800, "system": SISTEMA,
        "messages": [{"role": "user", "content": content}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=corpo, method="POST",
        headers={"x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read())
    return "".join(b.get("text", "") for b in d["content"] if b["type"] == "text")


def parse(txt, gab):
    i, j = txt.find("{"), txt.rfind("}")
    o = json.loads(txt[i:j + 1])
    ok = isinstance(o.get("certa"), str) and isinstance(o.get("erradas"), dict)
    ok = ok and all(isinstance(o["erradas"].get(l), str) and o["erradas"][l].strip() for l in LETRAS if l != gab)
    if not ok:
        raise ValueError("JSON incompleto")
    return {"certa": o["certa"].strip(), "erradas": {l: o["erradas"][l].strip() for l in LETRAS if l != gab}}


def gerar(q, chave):
    ultimo = None
    for tent in range(4):
        try:
            return parse(chamar(montar(q), chave), q["gabarito"])
        except urllib.error.HTTPError as e:
            ultimo = e
            time.sleep(5 * (tent + 1) if e.code in (429, 500, 502, 503, 529) else 1)
            if e.code in (400, 401, 403):
                raise
        except Exception as e:  # JSON ruim, timeout...
            ultimo = e
            time.sleep(2)
    raise RuntimeError(f"falhou: {ultimo}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anos", type=int, nargs="*")
    ap.add_argument("--limite", type=int)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    qs = [q for q in carregar_questoes() if q.get("gabarito") in tuple(LETRAS)]
    if a.anos:
        qs = [q for q in qs if q["ano"] in a.anos]
    exp = carregar_exp()
    todo = [q for q in qs if q["id"] not in exp]
    if a.limite:
        todo = todo[:a.limite]
    print(f"{len(qs)} questões no escopo, {len(qs) - len([q for q in qs if q['id'] not in exp])} já explicadas, {len(todo)} a gerar.")

    if a.dry_run:
        if todo:
            for b in montar(todo[0]):
                print(b["text"] if b["type"] == "text" else "[imagem]")
        return
    chave = os.environ.get("ANTHROPIC_API_KEY")
    if not chave:
        sys.exit("Defina ANTHROPIC_API_KEY antes de rodar.")

    lock = threading.Lock()
    feitas = falhas = 0
    with ThreadPoolExecutor(a.workers) as ex:
        fut = {ex.submit(gerar, q, chave): q for q in todo}
        for f in as_completed(fut):
            q = fut[f]
            try:
                r = f.result()
                with lock:
                    exp[q["id"]] = r
                    feitas += 1
                    if feitas % 10 == 0:
                        salvar_exp(exp)
                    print(f"[{feitas + falhas}/{len(todo)}] {q['id']} ok", flush=True)
            except Exception as e:
                falhas += 1
                print(f"[{feitas + falhas}/{len(todo)}] {q['id']} FALHOU: {e}", flush=True)
    salvar_exp(exp)
    print(f"Concluído: {feitas} geradas, {falhas} falhas (rode de novo para repetir as falhas).")


if __name__ == "__main__":
    main()
