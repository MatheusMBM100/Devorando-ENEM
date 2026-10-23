"""Põe um código (hash do conteúdo) nos scripts/estilo do index.html e na lista do service worker.
Assim o navegador guarda os arquivos por um ano e só baixa de novo o que mudou. Rode antes de publicar."""
import hashlib, os, re
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")
ARQ = ["data.js", "explicacoes.js", "meta.js", "config.js", "app.js", "nuvem.js", "admin.js", "redacao.js", "style.css"]
def h(f): return hashlib.sha1(open(os.path.join(SITE, f), "rb").read()).hexdigest()[:8]
H = {f: h(f) for f in ARQ}
p = os.path.join(SITE, "index.html"); s = open(p, encoding="utf-8").read()
for f in ARQ:
    s = re.sub(r'(["\'])' + re.escape(f) + r'(\?v=[0-9a-f]+)?(["\'])', lambda m: m.group(1) + f + "?v=" + H[f] + m.group(3), s)
open(p, "w", encoding="utf-8").write(s)
p = os.path.join(SITE, "sw.js"); s = open(p, encoding="utf-8").read()
base = ["./", "index.html"] + [f + "?v=" + H[f] for f in ARQ] + ["logo.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"]
s = re.sub(r"var BASE = \[.*?\];", lambda m: "var BASE = " + str(base).replace("'", '"') + ";", s, flags=re.S)
s = re.sub(r'var V = "[^"]*";', 'var V = "devorando-' + hashlib.sha1("".join(H.values()).encode()).hexdigest()[:8] + '";', s)
open(p, "w", encoding="utf-8").write(s)
print("versionado:", H)
