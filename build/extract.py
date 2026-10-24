#!/usr/bin/env python3
"""Extrai questões e gabaritos dos PDFs do INEP para site/data.js + site/img/."""
import fitz, re, os, sys, json, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDFS = os.path.join(ROOT, "pdfs")
IMG = os.path.join(ROOT, "site", "img")
os.makedirs(IMG, exist_ok=True)

# 2022-154: o gabarito do INEP é E (400 000), mas a resolução adotada pelo usuário dá 300 000 (D).
GAB_AJUSTADO = {"2022-154": "D"}
FORCE_IMG = {"2022-156", "2022-154", "2020-056", "2020-059", "2022-082", "2023-076", "2023-001-es", "2020-096", "2020-102", "2020-113", "2020-115", "2020-122", "2020-131", "2020-132", "2020-134", "2020-138", "2020-143", "2020-162", "2020-164", "2020-174", "2020-175", "2021-150", "2022-012", "2022-095", "2022-102", "2022-106", "2022-109", "2022-113", "2022-122", "2022-125", "2022-126", "2022-134", "2022-135", "2022-145", "2022-146", "2022-151", "2022-153", "2022-164", "2022-171", "2022-172", "2022-174", "2022-180", "2023-094", "2023-112", "2023-122", "2023-134", "2023-135", "2023-139", "2023-145", "2023-160", "2023-176", "2023-179", "2023-180", "2024-041", "2025-115", "2025-123", "2025-130", "2020-107", "2020-108"} | set(["2019-005-en", "2019-006", "2019-010", "2019-012", "2019-017", "2019-023", "2019-026", "2019-031", "2019-036", "2019-043", "2019-047", "2019-057", "2019-059", "2019-077", "2019-085", "2019-091", "2019-094", "2019-097", "2019-098", "2019-101", "2019-103", "2019-108", "2019-112", "2019-113", "2019-114", "2019-117", "2019-119", "2019-120", "2019-122", "2019-123", "2019-125", "2019-126", "2019-127", "2019-128", "2019-131", "2019-133", "2019-135", "2019-136", "2019-138", "2019-139", "2019-140", "2019-144", "2019-146", "2019-148", "2019-149", "2019-150", "2019-151", "2019-152", "2019-153", "2019-158", "2019-161", "2019-162", "2019-164", "2019-166", "2019-167", "2019-168", "2019-169", "2019-171", "2019-172", "2019-174", "2019-175", "2019-176", "2019-178", "2019-180"])  # texto embaralhado (fórmulas/quadros/figuras): usar o recorte da prova
TOP, BOTTOM, SPLIT = 62, 749, 285
SECTION = re.compile(r"^\s*(LINGUAGENS|CI[ÊE]NCIAS|MATEM[ÁA]TICA|Quest[õo]es de \d+)", re.I)
QHEAD = re.compile(r"^\s*QUEST[ÃA]O\s+(\d{1,3})\b", re.I)
ZOOM = 2.2


def ar(r):
    r = fitz.Rect(r)
    return max(0, r.width) * max(0, r.height)


def area_of(n):
    return ("Linguagens" if n <= 45 else "Humanas" if n <= 90
            else "Natureza" if n <= 135 else "Matemática")


def garbled(s):
    if not s.strip():
        return False
    bad = sum(1 for c in s if ord(c) < 32 and c not in "\t\n\r")
    return bad / max(1, len(s)) > 0.03


def clean(s):
    s = s.replace("\xa0", " ").replace("\u202f", " ").replace("­", "")
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    return s.strip()


def save_clip(page, rect, name):
    name = name.replace(".png", ".webp")
    path = os.path.join(IMG, name)
    pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=rect, alpha=False)
    Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB").save(path, "WEBP", lossless=True, method=4)
    return "img/" + name


def page_items(page):
    """Itens de uma página em ordem de leitura: [(col, y, kind, payload)]."""
    blocks = []
    for b in page.get_text("blocks"):
        x0, y0, x1, y1, txt = b[:5]
        if b[6] != 0:
            continue
        if re.match(r"^\s*ENEM\s?20\d\d", txt) or re.match(r"^\*\d+\w*\*", txt.strip()):
            continue
        if y1 < TOP or y0 > BOTTOM:
            continue
        if re.search(r"CADERNO\s*\d", txt, re.I) and re.search(r"\bDIA\b", txt, re.I) and len(txt) < 140:
            continue  # cabeçalho/rodapé com o número da página
        blocks.append((x0, y0, x1, y1, txt))

    figs = []
    for im in page.get_image_info():
        r = fitz.Rect(im["bbox"])
        if r.width > 25 and r.height > 25 and r.y0 >= TOP - 5 and r.y1 <= BOTTOM + 5 and r.x0 > -1:
            figs.append(r)
    for r in page.cluster_drawings():
        r = fitz.Rect(r)
        if r.width < 50 or r.height < 40 or r.y0 < TOP - 5 or r.y1 > BOTTOM + 5:
            continue
        if any(r.intersects(f) and ar(r & f) > 0.6 * ar(r) for f in figs):
            continue
        inside = [b for b in blocks if fitz.Rect(b[:4]).intersects(r)
                  and ar(fitz.Rect(b[:4]) & r) > 0.7 * ar(b[:4])]
        if sum(len(b[4]) for b in inside) > 140:  # tabela: mantém texto
            continue
        figs.append(r)

    kept = []
    for b in blocks:
        br = fitz.Rect(b[:4])
        if any(ar(br & f) > 0.7 * ar(br) for f in figs):
            continue
        kept.append(b)

    items = []
    for x0, y0, x1, y1, txt in kept:
        col = 0 if x0 < SPLIT - 5 else 1
        items.append((col, y0, "t", txt, y1, (x1 - x0) > 300 and x0 < SPLIT - 5 and x1 > SPLIT + 10))
    for r in figs:
        col = 0 if r.x0 < SPLIT - 5 else 1
        items.append((col, r.y0, "i", r, r.y1, r.width > 300))
    items.sort(key=lambda it: (it[0], it[1]))
    return items


def parse_pdf(path, year, day):
    doc = fitz.open(path)
    questions = []  # dicts com n, lang, parts, regions
    cur = None
    lang = "ingles" if day == 1 else None
    shared = None      # partes de um "Texto para as Questões de X a Y"
    shared_rng = None
    sharedmap = []
    for pno, page in enumerate(doc):
        items = page_items(page)
        # fim de coluna para recorte de região
        for col, y, kind, pl, yb, wd in items:
            if kind == "t":
                for m in re.finditer(r"Quest[õo]es de \d+ a \d+\s*\(op[çc][ãa]o:?\s*(espanhol|inglês)\)", pl, re.I):
                    lang = "espanhol" if m.group(1).lower() == "espanhol" else "ingles"
                ms = re.match(r"^\s*Texto para as Quest[õo]es de (\d+) a (\d+)", pl, re.I)
                if ms:
                    shared, shared_rng, cur = [], (int(ms.group(1)), int(ms.group(2))), None
                    continue
                lns = pl.split("\n")
                heads_i = [i for i, l in enumerate(lns) if QHEAD.match(l)]
                if heads_i:
                    if shared is not None:
                        sharedmap.append((shared_rng, shared))
                        shared = None
                    pre = [l for l in lns[:heads_i[0]] if l.strip() and not SECTION.match(l)]
                    if pre and cur is not None:
                        last = cur["regions"][-1]
                        if last[0] != pno or last[1] != col:  # o fim da questão está no topo da coluna seguinte
                            last[3] = BOTTOM if last[3] is None else last[3]
                            cur["regions"].append([pno, col, TOP, None])
                        cur["parts"].append(("t", "\n".join(pre) + "\n", page))
                    for k, hi in enumerate(heads_i):
                        end = heads_i[k + 1] if k + 1 < len(heads_i) else len(lns)
                        n = int(QHEAD.match(lns[hi]).group(1))
                        cur = {"n": n, "lang": lang if n <= 5 and day == 1 else None,
                               "parts": [], "regions": [], "open": True}
                        questions.append(cur)
                        if wd:
                            cur["wide"] = True
                        y_est = y - 2 + (yb - y) * hi / max(1, len(lns))
                        for fmt in (f"Questão {n:02d}", f"Questão {n}"):  # posição real do cabeçalho
                            hits = [h for h in page.search_for(fmt) if (h.x0 < SPLIT) == (col == 0) and abs(h.y0 - y_est) < 90]
                            if hits:
                                y_est = min(hits, key=lambda h: abs(h.y0 - y_est)).y0 - 3
                                break
                        cur["regions"].append([pno, col, y_est, None])
                        rest = "\n".join(lns[hi + 1:end])
                        if rest.strip():
                            cur["parts"].append(("t", rest, page))
                    continue
                if re.match(r"^\s*Quest[õo]es de \d+ a \d+", pl) and len(pl) < 90:
                    continue
            if wd and cur is not None:
                cur["wide"] = True
            if cur is None:
                if shared is not None:
                    shared.append(("t", pl, page) if kind == "t" else ("i", pl, page, pno))
                continue
            # fecha região anterior ao mudar de coluna/página
            last = cur["regions"][-1]
            if last[0] != pno or last[1] != col:
                last[3] = BOTTOM if last[3] is None else last[3]
                cur["regions"].append([pno, col, TOP, None])
            if kind == "t":
                cur["parts"].append(("t", pl, page))
            else:
                cur["parts"].append(("i", pl, page, pno))
        # fecha regiões abertas por coluna: usa y da próxima questão
        # (calculado depois)
        # marca próxima questão na mesma coluna para limitar região
        for q in questions:
            pass
    for (lo, hi), parts in sharedmap:
        for q in questions:
            if lo <= q["n"] <= hi and not q.get("_sh"):
                q["parts"] = parts + q["parts"]
                q["_sh"] = True
    # Segunda passagem para y1 das regiões: próxima questão na mesma coluna/página
    heads = []
    for q in questions:
        r0 = q["regions"][0]
        heads.append((r0[0], r0[1], r0[2], q))
    for q in questions:
        for r in q["regions"]:
            if r[3] is None:
                nxt = [h for h in heads if h[0] == r[0] and h[1] == r[1] and h[2] > r[2] and h[3] is not q]
                r[3] = min(h[2] for h in nxt) - 1 if nxt else BOTTOM
    return doc, questions


def build_question(doc, q, year, day):
    n = q["n"]
    lang = q["lang"]
    qid = f"{year}-{n:03d}" + (f"-{'en' if lang == 'ingles' else 'es'}" if lang else "")
    cut = []
    for p in q["parts"]:  # a proposta de redação vem depois da última questão de Linguagens
        if p[0] == "t" and re.search(r"INSTRU[ÇC][ÕO]ES PARA A REDA[ÇC][ÃA]O|PROPOSTA DE REDA[ÇC][ÃA]O", p[1]):
            head = re.split(r"INSTRU[ÇC][ÕO]ES PARA A REDA[ÇC][ÃA]O|PROPOSTA DE REDA[ÇC][ÃA]O", p[1])[0]
            if head.strip():
                cut.append(("t", head, p[2]))
            break
        cut.append(p)
    q["parts"] = cut
    txt_all = "".join(p[1] for p in q["parts"] if p[0] == "t")
    out = {"id": qid, "ano": year, "dia": day, "n": n, "area": area_of(n)}
    if lang:
        out["lingua"] = "Inglês" if lang == "ingles" else "Espanhol"

    if qid == "2021-045":
        q["wide"] = False

    def crop_mode():
        imgs = []
        if qid in ("2021-089", "2021-090"):  # figuras de página inteira; o resto é a folha de redação
            pno, col, y0, y1 = q["regions"][0]
            page = doc[pno]
            out["imagem"] = [save_clip(page, fitz.Rect(14, y0, page.rect.width - 6, y1), f"{qid}-r0.png")]
            out["alts"] = None
            return out
        if q.get("wide"):
            pgs = {}
            first_pno = q["regions"][0][0]
            for pno, col, y0, y1 in q["regions"]:
                a, b = pgs.get(pno, (y0, y1))
                if pno == first_pno:
                    a = q["regions"][0][2]  # na página do cabeçalho a questão começa no cabeçalho
                pgs[pno] = (min(a, y0) if pno != first_pno else a, max(b, y1))
            for i, pno in enumerate(sorted(pgs)):
                y0, y1 = pgs[pno]
                if y1 - y0 < 8:
                    continue
                page = doc[pno]
                if qid in FORCE_IMG:
                    hits = page.search_for(f"Questão {n}")
                    if hits:
                        y0 = max(y0, hits[0].y0 - 4)
                imgs.append(save_clip(page, fitz.Rect(14, y0, page.rect.width - 6, y1), f"{qid}-w{i}.png"))
            out["imagem"] = imgs
            out["alts"] = None
            return out
        for i, (pno, col, y0, y1) in enumerate(q["regions"][:1] if qid == "2021-045" else q["regions"]):  # o resto é a folha de redação
            page = doc[pno]
            x0, x1 = (14, SPLIT - 1) if col == 0 else (SPLIT + 3, page.rect.width - 6)
            if y1 - y0 < 8:
                continue
            imgs.append(save_clip(page, fitz.Rect(x0, y0, x1, y1), f"{qid}-r{i}.png"))
        out["imagem"] = imgs
        out["alts"] = None
        return out

    if garbled(txt_all) or not txt_all.strip() or qid in FORCE_IMG:
        return crop_mode()

    # linhas: ("t", str) / ("i", path)
    lines = []
    k = 0
    for p in q["parts"]:
        if p[0] == "t":
            for ln in clean(p[1]).split("\n"):
                lines.append(["t", ln])
        else:
            page, pno = p[2], p[3]
            r = p[1]
            r = fitz.Rect(max(r.x0, 0), r.y0, min(r.x1, page.rect.width), r.y1)
            lines.append(["i", save_clip(page, r, f"{qid}-f{k}.png")])
            k += 1

    if any(ln[0] == "i" and os.path.getsize(os.path.join(ROOT, "site", ln[1])) < 1500 for ln in lines):
        return crop_mode()  # figura fragmentada: mais fiel recortar a questão inteira

    if out["area"] in ("Linguagens", "Humanas"):
        lines = [ln for ln in lines if not (ln[0] == "t" and re.fullmatch(r"\s*\d{1,3}\s*", ln[1]))]  # numeração de linhas

    lines = [ln for i, ln in enumerate(lines) if not (
        ln[0] == "t" and re.fullmatch(r"[A-E]\s*", ln[1]) and i + 1 < len(lines) and lines[i + 1][0] == "t"
        and re.match(rf"^{ln[1].strip()}\s+\S", lines[i + 1][1]))]

    # localizar alternativas A..E em sequência
    def is_alt(ln, L):
        return ln[0] == "t" and re.match(rf"^{L}(\s|$)", ln[1]) is not None

    start = None
    for i in range(len(lines) - 1, -1, -1):
        if not is_alt(lines[i], "A"):
            continue
        pos = i
        ok = True
        for L in "BCDE":
            j = next((j for j in range(pos + 1, len(lines)) if is_alt(lines[j], L)), None)
            if j is None:
                ok = False
                break
            pos = j
        if ok:
            start = i
            break
    if start is None:
        return crop_mode()

    stem = lines[:start]
    _FRAG = re.compile(r"^[\d.,+\-−–=()/%²³]{1,6}$")

    class FRAG:
        @staticmethod
        def match(x):
            x = x.strip()
            if q.get("_sh"):
                return None
            if not _FRAG.match(x):
                return None
            if out["area"] in ("Linguagens", "Humanas") and x.isdigit() and int(x) % 5 == 0 and int(x) <= 100:
                return None  # numeração de linhas do texto
            return True

    alts = {}
    curL = None
    for ln in lines[start:]:
        if ln[0] == "t":
            m = re.match(r"^([A-E])(?:\s+(.*))?$", ln[1])
            if m and (curL is None or ord(m.group(1)) == ord(curL) + 1):
                curL = m.group(1)
                alts[curL] = {"t": (m.group(2) or "").strip(), "i": []}
                continue
            if curL:
                if FRAG.match(ln[1].strip()):
                    return crop_mode()
                alts[curL]["t"] = (alts[curL]["t"] + " " + ln[1].strip()).strip()
        else:
            if curL:
                alts[curL]["i"].append(ln[1])

    # alternativas só com figura: a imagem da A fica no fim do enunciado e as demais se deslocam
    if all(alts[L]["i"] for L in "ABCD" if L in alts) and not alts.get("E", {}).get("i"):
        k = None
        for j in range(len(stem) - 1, max(-1, len(stem) - 4), -1):
            if stem[j][0] == "i":
                k = j
                break
        if k is not None:
            first = stem.pop(k)
            order = [first] + [alts[L]["i"][0] for L in "ABCD"]
            if len(order) == 5:
                for L, im in zip("ABCDE", order):
                    alts[L]["i"] = [im[1] if isinstance(im, list) else im]
                    if L == "E":
                        alts[L]["t"] = ""

    if len(alts) != 5 or any(not v["t"] and not v["i"] for v in alts.values()):
        return crop_mode()

    # créditos de figuras e textos de outras páginas vazam para a última alternativa
    if alts.get("E"):
        SRC = re.compile(r"\s(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{3,}\. Disponível|[A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{3,}, [A-ZÁÉÍÓÚ]\.|Disponível em:|Acesso em:|Transcreva a sua Reda)")
        m = SRC.search(alts["E"]["t"])
        if m and m.start() > 3:
            alts["E"]["t"] = alts["E"]["t"][:m.start()].strip()
    if day == 1 and n == 90:  # figuras da folha de redação que seguem a última questão
        alts = {k: {"t": v["t"], "i": []} for k, v in alts.items()}

    def stem_html(stem):
        parts = []
        buf = []
        for kind, v in stem:
            if kind == "t":
                buf.append(v)
            else:
                if buf:
                    parts.append({"t": join(buf)})
                    buf = []
                parts.append({"i": v})
        if buf:
            parts.append({"t": join(buf)})
        return parts

    def join(buf):
        s = "\n".join(buf)
        s = re.sub(r"(?<=\w)-\n(?=[a-zà-ú])", "", s)
        ls = s.split("\n")
        lens = sorted(len(x) for x in ls)
        mx = lens[int(0.9 * (len(lens) - 1))] if lens else 0
        res = ""
        for i, x in enumerate(ls):
            res += x
            if i + 1 < len(ls):
                res += " " if (mx > 30 and len(x) >= 0.78 * mx and not re.search(r"[.!?:]$", x.strip())) else "\n"
        return res.strip()

    if qid == "2022-118":  # a bússola-legenda (f4) vem entre as alternativas; D é f5 e E é f6
        alts["D"]["i"] = ["img/2022-118-f5.webp"]
        stem = stem + [["t", "Legenda (bússola):"], ["i", "img/2022-118-f4.webp"]]
    out["enunciado"] = stem_html(stem)
    out["alts"] = {L: {"t": alts[L]["t"], **({"i": alts[L]["i"]} if alts[L]["i"] else {})} for L in alts}
    return out


def parse_gabarito(path, day):
    doc = fitz.open(path)
    toks = []
    for p in doc:
        toks += p.get_text().split()
    lo, hi = (1, 90) if day == 1 else (91, 180)
    res = {}  # n -> [letras]
    curk = None
    for t in toks:
        if t.isdigit():
            n = int(t)
            if lo <= n <= hi and not res.get(n):
                res[n] = []
                curk = n
            else:
                curk = None
        elif curk is not None and re.fullmatch(r"[A-E]|X|\*|ANULAD[AO]|--?", t, re.I):
            res[curk].append("X" if re.match(r"anulad|X|\*|-", t, re.I) else t)
        elif t.upper() in ("CADERNO", "GABARITO"):
            curk = None
    return {n: v for n, v in res.items() if v}


def main(years):
    allq = []
    report = []
    for year in years:
        for day, cd in ((1, 1), (2, 5)):
            pv = os.path.join(PDFS, f"{year}_PV_impresso_D{day}_CD{cd}.pdf")
            gb = os.path.join(PDFS, f"{year}_GB_impresso_D{day}_CD{cd}.pdf")
            if not (os.path.exists(pv) and os.path.exists(gb)):
                continue
            gab = parse_gabarito(gb, day)
            doc, qs = parse_pdf(pv, year, day)
            seen = set()
            for q in qs:
                key = (q["n"], q["lang"])
                if key in seen:
                    continue
                seen.add(key)
                item = build_question(doc, q, year, day)
                g = gab.get(q["n"])
                if g:
                    if q["n"] <= 5 and day == 1 and len(g) >= 2:
                        # colunas do gabarito: INGLÊS, ESPANHOL
                        item["gabarito"] = g[0] if q["lang"] == "ingles" else g[1]
                    else:
                        item["gabarito"] = g[0]
                if year == 2025 and 6 <= q["n"] <= 10 and item.get("enunciado"):  # texto-base compartilhado
                    t0 = item["enunciado"][0].get("t", "")
                    marca = "Acesso em: 16 jan. 2024 (adaptado)."
                    if marca in t0:
                        k = t0.index(marca) + len(marca)
                        item["apoio"] = t0[:k].strip()
                        item["apoio_rot"] = "Texto de apoio das questões 6 a 10"
                        item["enunciado"][0]["t"] = t0[k:].strip()
                if item["id"] in GAB_AJUSTADO:  # decisão do usuário, com base em resolução comentada
                    item["gabarito_inep"] = item.get("gabarito")
                    item["gabarito"] = GAB_AJUSTADO[item["id"]]
                allq.append(item)
            n_ok = sum(1 for x in allq if x["ano"] == year and x["dia"] == day)
            n_alts = sum(1 for x in allq if x["ano"] == year and x["dia"] == day and x.get("alts"))
            n_img = sum(1 for x in allq if x["ano"] == year and x["dia"] == day and x.get("imagem"))
            n_gab = sum(1 for x in allq if x["ano"] == year and x["dia"] == day and x.get("gabarito"))
            report.append(f"{year} D{day}: {n_ok} questões | {n_alts} texto+alts | {n_img} só imagem | {n_gab} c/ gabarito | gab pdf {len(gab)}")
    allq.sort(key=lambda x: (-x["ano"], x["dia"], x["n"], x.get("lingua", "")))
    with open(os.path.join(ROOT, "site", "data.js"), "w", encoding="utf-8") as f:
        f.write("window.QUESTOES=" + json.dumps(allq, ensure_ascii=False) + ";")
    print("\n".join(report))
    print("total", len(allq))


if __name__ == "__main__":
    main([int(y) for y in sys.argv[1:]] or [2025, 2024, 2023, 2022, 2021, 2020, 2019])
