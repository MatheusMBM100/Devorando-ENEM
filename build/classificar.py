"""Classifica cada questão em matéria e assunto (heurística por palavras-chave + ajustes manuais).

Lê site/data.js e site/explicacoes.js e escreve site/meta.js (window.META = {id: [matéria, assunto]}).
Uso: python3 build/classificar.py [--amostra MATERIA]   (a amostra imprime exemplos para conferência)
"""
import json, os, re, sys, unicodedata
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def carregar(nome, ini):
    s = open(os.path.join(ROOT, "site", nome), encoding="utf-8").read()
    return json.loads(s[s.index(ini): s.rindex(ini == "[" and "]" or "}") + 1])


def norm(t):
    t = unicodedata.normalize("NFD", t.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


# (matéria, assunto, [palavras-chave], peso)
R = {
 "Linguagens": [
  ("Educação Física", "Corpo, esporte e saúde", ["esporte", "atividade fisica", "ginastica", "lazer", "luta", "capoeira", "jogo", "futebol", "corporal", "atleta", "danca", "brincadeira", "skate", "sedentar", "exercicio"], 1),
  ("Artes", "Artes visuais", ["pintura", "escultura", "obra de arte", "artista", "instalacao", "quadro", "tela de", "grafite", "fotografia", "museu", "arte contemporanea", "ready-made", "cubismo", "impressionis", "renascimento", "vanguarda", "artes visuais", "xilogravura", "arquitetura"], 1),
  ("Artes", "Música, dança e teatro", ["musica", "cancao", "cantor", "samba", "rap ", "teatro", "dramaturg", "coreograf", "danca", "bailarin", "ritmo", "choro", "instrumento musical", "banda", "compositor", "cinema", "filme", "documentario", "ator ", "atriz"], 1),
  ("Literatura", "Poesia", ["poema", "poesia", "eu lirico", "soneto", "verso", "estrofe", "poeta", "lirico"], 1),
  ("Literatura", "Prosa e escolas literárias", ["romance", "conto", "narrador", "personagem", "romantismo", "modernismo", "realismo", "naturalismo", "barroco", "arcadismo", "machado de assis", "guimaraes rosa", "narrativa", "cronica", "autor", "literari", "literatura"], 1),
  ("Língua Portuguesa", "Variação linguística", ["variacao linguistica", "norma-padrao", "norma padrao", "coloquial", "regionalismo", "giria", "dialeto", "registro formal", "informal", "sotaque", "preconceito linguistico", "oralidade"], 2),
  ("Língua Portuguesa", "Funções da linguagem e recursos expressivos", ["funcao emotiva", "funcao poetica", "funcao referencial", "funcao conativa", "funcao fatica", "metalinguistic", "ironia", "metafora", "figura de linguagem", "recurso expressivo", "polissemia", "humor", "hiperbole", "personificacao", "intertextualidade"], 2),
  ("Língua Portuguesa", "Gêneros textuais e argumentação", ["genero textual", "tese", "argumento", "reportagem", "artigo de opiniao", "carta", "charge", "tirinha", "cartaz", "campanha", "propaganda", "publicitar", "infografico", "anuncio", "post", "blog", "noticia", "manifesto", "autor do texto", "texto busca", "objetivo do texto", "finalidade"], 1),
  ("Língua Portuguesa", "Coesão, coerência e gramática", ["coesao", "coerencia", "pronome", "conjuncao", "pontuacao", "verbo", "concordancia", "sintaxe", "oracao", "conectivo", "referente", "expressao destacada", "trecho destacado"], 1),
  ("Língua Portuguesa", "Mídias e tecnologia", ["internet", "redes sociais", "digital", "celular", "tecnologia", "aplicativo", "virtual", "midia", "whatsapp"], 1),
 ],
 "Humanas": [
  ("História", "Brasil Colônia e Império", ["colonia", "colonial", "escravid", "escravizad", "imperio", "dom pedro", "dom joao", "independencia", "quilombo", "jesuita", "bandeirante", "capitania", "abolicao", "regencia", "coroa portuguesa", "engenho", "tropeiro"], 1),
  ("História", "Brasil República", ["republica", "vargas", "estado novo", "ditadura", "militar", "golpe", "getulio", "constituicao de", "voto", "coronel", "anos 1970", "anos 1980", "esquerda", "partido", "coronelismo", "populismo", "redemocratizacao", "plano real", "joao goulart", "anos 1990", "tenentismo", "jk", "juscelino"], 1),
  ("História", "História Geral", ["revolucao francesa", "revolucao industrial", "idade media", "feudal", "roma", "romano", "grecia", "greg", "guerra mundial", "guerra fria", "nazis", "fascis", "renascimento", "reforma protestante", "iluminismo", "absolutis", "mercantil", "imperialismo", "napoleon", "stalin", "sovietic", "socialismo", "egito", "mesopotam", "cruzadas", "revolucao inglesa", "cidadania", "medieval", "antiguidade", "colonizacao", "descolonizacao", "apartheid", "holocausto", "capitalismo"], 1),
  ("Geografia", "Geografia física e meio ambiente", ["relevo", "clima", "bioma", "solo", "vegetacao", "bacia hidrografica", "tectonic", "erosao", "desmatamento", "cerrado", "amazonia", "mata atlantica", "caatinga", "pantanal", "rocha", "mineral", "recursos hidricos", "agua", "aquifero", "ilha de calor", "chuva", "sedimentar", "degradacao", "sustentabilidade", "ambiental", "geomorfolog", "litoral", "radiacao solar", "terremoto", "vulcao", "desertifica"], 1),
  ("Geografia", "Geografia humana, urbana e econômica", ["urbaniz", "cidade", "urbano", "metropole", "migrac", "populacao", "demograf", "agronegocio", "agropecuaria", "industri", "globalizacao", "territorio", "regiao", "fronteira", "mapa", "cartograf", "territorial", "rural", "reforma agraria", "transporte", "rodovia", "mineracao", "fluxo", "geopolitic", "refugiad", "habitacao", "favela", "segregacao"], 1),
  ("Filosofia", "Filosofia", ["platao", "aristoteles", "socrates", "descartes", "kant", "nietzsche", "hume", "rousseau", "hobbes", "locke", "maquiavel", "foucault", "arendt", "sartre", "epistemolog", "etica", "metafisic", "filosof", "contratualismo", "iluminista", "mito da caverna", "razao", "conhecimento", "dialetic", "estado de natureza", "moral", "empirismo", "racionalismo", "pensador"], 1),
  ("Sociologia", "Sociedade, cultura e política", ["sociolog", "marx", "weber", "durkheim", "ideologia", "desigualdade", "classe social", "movimento social", "identidade", "genero", "racismo", "preconceito", "cidadania", "direitos humanos", "democracia", "cultura", "trabalho", "consumo", "poder", "estado", "diversidade", "minoria", "indigena", "participacao", "exclusao", "violencia", "sociedade", "politic"], 0.35),
 ],
 "Natureza": [
  ("Física", "Eletricidade e magnetismo", ["circuito", "resistor", "resistencia eletrica", "corrente eletrica", "tensao", "volt", "ampere", "carga eletrica", "campo magnetico", "campo eletrico", "bateria", "capacitor", "lampada", "eletrizacao", "ohm", "potencia eletrica", "gerador", "transformador", "disjuntor", "indutor", "inducao", "eletromagnet", "eletrost", "interruptor", "kwh"], 1),
  ("Física", "Mecânica", ["velocidade", "aceleracao", "forca", "atrito", "trabalho", "energia cinetica", "energia potencial", "queda livre", "lancamento", "movimento", "newton", "momento linear", "impulso", "pendulo", "mola", "gravidade", "colisao", "inercia", "torque", "alavanca", "equilibrio", "pressao", "empuxo", "densidade", "hidrostatic", "trajetoria", "potencia mecanica", "rendimento"], 1),
  ("Física", "Termologia e termodinâmica", ["calor", "temperatura", "dilatacao", "calorimetr", "termic", "gas ideal", "termodinam", "conducao", "conveccao", "irradiacao", "isolante termico", "calor especifico", "mudanca de estado", "fusao", "ebulicao", "efeito estufa", "maquina termica", "evaporacao"], 1),
  ("Física", "Ondas, óptica e física moderna", ["onda", "frequencia", "comprimento de onda", "som ", "sonora", "ultrassom", "luz", "lente", "espelho", "refracao", "reflexao", "difracao", "interferencia", "radiacao", "espectro", "fotoeletric", "decaimento", "meia-vida radioativa", "radioativ", "nuclear", "fissao", "laser", "doppler", "ressonancia", "eco", "visao"], 1),
  ("Química", "Química orgânica", ["organic", "hidrocarboneto", "alcool", "ester", "acido carboxilico", "aldeido", "cetona", "amina", "polimero", "isomer", "cadeia carbonica", "funcao organica", "aromatic", "benzeno", "saponifica", "biodiesel", "etanol", "plastico", "fenol", "grupo funcional", "ligacao dupla", "petroleo", "ocupa", "composto organico", "acido graxo", "gordura", "pesticida", "flavorizante"], 1),
  ("Química", "Estequiometria e soluções", ["mol", "estequiometr", "concentracao", "solucao", "diluicao", "massa molar", "rendimento", "reagente limitante", "g/l", "mol/l", "titulacao", "solubilidade", "mistura", "decantacao", "filtracao", "destilacao", "separacao", "densidade", "partes por milhao", "ppm", "soluto", "solvente", "gas carbonico", "calculo"], 1),
  ("Química", "Reações, equilíbrio e termoquímica", ["reacao", "equilibrio quimico", "cinetica", "catalisador", "entalpia", "energia de ativacao", "oxidacao", "reducao", "combustao", "ph", "acido", "base", "neutralizacao", "sal ", "precipitado", "velocidade da reacao", "calor de reacao", "exotermic", "endotermic", "hidrolise", "tamponante", "indicador"], 1),
  ("Química", "Eletroquímica e química do ambiente", ["pilha", "eletrolise", "eletrodo", "potencial padrao", "anodo", "catodo", "corrosao", "bateria", "semirreac", "poluente", "chuva acida", "ozonio", "metal pesado", "tratamento de agua", "esgoto", "ciclo do", "atmosfera", "ligacao ionica", "ligacao covalente", "ligacao quimica", "tabela periodica", "eletronegatividade", "atomo", "modelo atomico", "ions", "ion", "forca intermolecular", "polaridade", "ponto de ebulicao", "geometria molecular"], 1),
  ("Biologia", "Genética e biotecnologia", ["gene", "dna", "rna", "cromossomo", "alelo", "heredit", "mutacao", "genotipo", "fenotipo", "recessiv", "dominante", "melhoramento genetico", "transgenic", "clonagem", "biotecnologia", "proteina", "codon", "mendel", "cruzamento", "grupo sanguineo", "genoma", "dupla fertilizacao", "consanguinidade"], 1),
  ("Biologia", "Ecologia e meio ambiente", ["ecossistema", "cadeia alimentar", "teia alimentar", "populacao", "comunidade", "habitat", "nicho", "biodiversidade", "bioma", "ciclo do carbono", "ciclo do nitrogenio", "decompositor", "produtor", "consumidor", "poluicao", "bioacumula", "biomagnifica", "desmatamento", "extincao", "sucessao ecologica", "especie invasora", "predacao", "simbiose", "mutualismo", "parasit", "sustentavel", "preservacao", "ambiental"], 1),
  ("Biologia", "Evolução e diversidade dos seres vivos", ["evolucao", "selecao natural", "ancestral", "especiacao", "fossil", "adaptacao", "darwin", "taxonomia", "filogen", "angiosperma", "gimnosperma", "briofita", "pteridofita", "vertebrado", "invertebrado", "artropode", "mimetismo", "convergencia", "reino", "classificacao"], 1),
  ("Biologia", "Fisiologia, saúde e microrganismos", ["hormonio", "sistema nervoso", "neuronio", "sangue", "coracao", "circulacao", "respiracao", "digestao", "digestorio", "rim", "excrecao", "imunologico", "vacina", "anticorpo", "virus", "bacteria", "doenca", "parasitose", "verminose", "dengue", "mosquito", "antibiotico", "metabolismo", "insulina", "diabetes", "reflexo", "musculo", "hipotalamo", "gestacao", "reproducao", "embriao", "fecundacao", "esgoto", "saneamento", "protozoario", "fungo", "febre", "cancer", "obesidade", "vitamina", "nutriente", "dieta"], 1),
  ("Biologia", "Citologia e bioquímica", ["celula", "membrana plasmatica", "organela", "mitocondria", "cloroplasto", "fotossintese", "respiracao celular", "fermentacao", "enzima", "atp", "osmose", "difusao", "divisao celular", "mitose", "meiose", "nucleo", "ribossomo", "lipidio", "carboidrato", "glicose", "clorofila", "plasmid", "citoplasma", "estomato", "tecido vegetal", "xilema", "floema", "auxina", "fitormonio", "planta"], 1),
 ],
 "Matemática": [
  ("Matemática", "Geometria espacial", ["volume", "cilindro", "cone", "esfera", "prisma", "piramide", "cubo", "paralelepipedo", "tronco", "poliedro", "octaedro", "planificacao", "capacidade", "litros", "reservatorio", "solido", "projecao ortogonal", "tetraedro"], 1),
  ("Matemática", "Geometria plana e escalas", ["area", "perimetro", "triangulo", "circulo", "circunferencia", "retangulo", "quadrado", "hexagono", "losango", "trapezio", "angulo", "escala", "semelhanca", "pitagoras", "raio", "diametro", "mapa", "planta", "teorema de tales", "poligono", "lado", "arco", "setor circular", "apotema", "simetria", "tangente", "bissetriz", "diagonal"], 1),
  ("Matemática", "Geometria analítica e trigonometria", ["plano cartesiano", "coordenadas", "reta", "equacao da reta", "seno", "cosseno", "tangente", "trigonometr", "distancia entre pontos", "vetor", "ponto de coordenadas", "inclinacao", "angulo de elevacao", "coeficiente angular", "ponto medio"], 1),
  ("Matemática", "Probabilidade", ["probabilidade", "chance", "sorteio", "aleatori", "evento", "dado ", "moeda", "urna", "bola", "sortead", "acaso"], 2),
  ("Matemática", "Análise combinatória", ["combinac", "permutac", "arranjo", "anagrama", "fatorial", "!", "quantas maneiras", "quantidade de maneiras", "principio multiplicativo", "senha", "formas diferentes", "comissao", "sequencias possiveis", "diferentes maneiras", "filas", "codigos"], 2),
  ("Matemática", "Estatística e gráficos", ["media", "mediana", "moda", "desvio padrao", "variancia", "grafico", "tabela", "histograma", "frequencia", "amostra", "dados", "pesquisa", "indice", "percentual dos", "coeficiente de variacao", "barras", "setores", "dispersao", "quartil", "boxplot"], 1),
  ("Matemática", "Funções e sequências", ["funcao", "f(x)", "parabola", "grafico da funcao", "exponencial", "logaritm", "progressao", "pa ", "pg ", "sequencia", "termo geral", "maximo", "minimo", "vertice", "raizes", "equacao do segundo grau", "polinomio", "domino", "afim", "quadratica", "crescimento", "decrescimento", "lei de formacao", "padrao"], 1),
  ("Matemática", "Porcentagem, proporção e matemática financeira", ["porcentagem", "%", "razao", "proporcao", "regra de tres", "juros", "desconto", "acrescimo", "lucro", "preco", "custo", "financiamento", "prestacao", "rendimento", "taxa", "montante", "imposto", "salario", "r$", "reais", "venda", "compra", "grandeza", "diretamente proporcional", "inversamente proporcional", "velocidade media", "consumo", "unidade de medida", "conversao"], 1),
  ("Matemática", "Aritmética e álgebra", ["numero", "inteiro", "divisor", "multiplo", "mmc", "mdc", "primo", "fracao", "decimal", "potencia", "raiz", "equacao", "sistema", "inequacao", "algarismo", "notacao cientifica", "operacao", "sistema de numeracao", "binari", "matriz", "determinante", "conjunto", "ordem crescente", "logica"], 1),
 ],
}

PADRAO = {"Linguagens": ("Língua Portuguesa", "Interpretação de texto"), "Humanas": ("Sociologia", "Sociedade, cultura e política"),
          "Natureza": ("Biologia", "Fisiologia, saúde e microrganismos"), "Matemática": ("Matemática", "Aritmética e álgebra")}


def texto_de(q, exp):
    t = []
    for p in q.get("enunciado") or []:
        if p.get("t"):
            t.append(p["t"])
    for l, a in (q.get("alts") or {}).items():
        if a and a.get("t"):
            t.append(a["t"])
    e = exp.get(q["id"]) or {}
    t.append(e.get("certa", "") * 2)
    return norm(" ".join(t))


def classificar(q, exp, manual):
    if q["id"] in manual:
        return manual[q["id"]]
    area = q["area"]
    if q.get("lingua") == "Inglês":
        return ["Inglês", "Interpretação de texto"]
    if q.get("lingua") == "Espanhol":
        return ["Espanhol", "Interpretação de texto"]
    t = texto_de(q, exp)
    melhor, mpont = None, 0
    for mat, ass, kws, peso in R[area]:
        pont = sum(peso * (2 if len(k) >= 8 else 1) for k in kws if k in t)
        if pont > mpont:
            melhor, mpont = (mat, ass), pont
    return list(melhor or PADRAO[area])


if __name__ == "__main__":
    Q = carregar("data.js", "[")
    EXP = carregar("explicacoes.js", "{")
    mpath = os.path.join(ROOT, "build", "classificacao_manual.json")
    manual = json.load(open(mpath, encoding="utf-8")) if os.path.exists(mpath) else {}
    meta = {q["id"]: classificar(q, EXP, manual) for q in Q}
    out = os.path.join(ROOT, "site", "meta.js")
    open(out, "w", encoding="utf-8").write("window.META=" + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n")
    c = Counter(tuple(v) for v in meta.values())
    for (m, a), n in sorted(c.items()):
        print(f"{n:4d}  {m} / {a}")
    print(len(meta), "questões classificadas;", len(manual), "ajustes manuais")
    if len(sys.argv) > 2 and sys.argv[1] == "--amostra":
        alvo = sys.argv[2]
        import random
        random.seed(3)
        ids = [i for i, v in meta.items() if v[0] == alvo or v[1] == alvo]
        for i in random.sample(ids, min(14, len(ids))):
            q = next(x for x in Q if x["id"] == i)
            e = EXP.get(i, {}).get("certa", "")[:150]
            print("-", i, meta[i], "|", e)
