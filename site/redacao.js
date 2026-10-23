(function () {
  "use strict";
  // Redação: o aluno escreve e envia; o administrador corrige pelas 5 competências do ENEM no painel.
  // Sem IA: a correção é humana. Depende de nuvem.js (window.NUVEM).
  var N = window.NUVEM, APP = window.DEV_APP;
  if (!N) return;
  var db = N.db, el = N.el;

  var TEMAS = [
    "Perspectivas acerca do envelhecimento na sociedade brasileira (ENEM 2025)",
    "Desafios para a valorização da herança africana no Brasil (ENEM 2024)",
    "Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil (ENEM 2023)",
    "Desafios para a valorização de comunidades e povos tradicionais no Brasil (ENEM 2022)",
    "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil (ENEM 2021)",
    "O estigma associado às doenças mentais na sociedade brasileira (ENEM 2020)"
  ];
  var COMP = [
    ["Competência 1 — Norma culta", "Domínio da modalidade escrita formal da língua portuguesa: ortografia, acentuação, pontuação, concordância, regência, crase, sintaxe. 200 = excelente domínio, no máximo dois desvios; 160 = bom, poucos desvios; 120 = mediano; 80 = insuficiente, muitos desvios; 40 = precário; 0 = desconhecimento."],
    ["Competência 2 — Tema e estrutura", "Compreensão da proposta, uso de repertório sociocultural produtivo e estrutura dissertativo-argumentativa (introdução, desenvolvimento, conclusão). 200 = argumentação consistente com repertório legitimado, pertinente e usado como argumento; 120 = repertório só baseado nos textos motivadores ou não pertinente; abaixo disso, tangenciamento ou estrutura incompleta."],
    ["Competência 3 — Argumentação", "Seleção, relação, organização e interpretação das informações em defesa de um ponto de vista. 200 = projeto de texto estratégico, informações consistentes e organizadas, com indícios de autoria; 120 = projeto com falhas pontuais; 80 = informações pouco relacionadas ao tema; 40 = desorganizadas ou contraditórias."],
    ["Competência 4 — Coesão", "Mecanismos linguísticos: conectivos, referenciação, retomadas, articulação entre períodos e parágrafos. 200 = articulação muito boa, repertório diversificado de recursos coesivos, sem inadequações; 160 = poucas inadequações; 120 = algumas inadequações e repertório pouco diversificado; 80 = muitas inadequações; 40 = precária."],
    ["Competência 5 — Proposta de intervenção", "Proposta de solução respeitando os direitos humanos, com cinco elementos: agente, ação, meio/modo, finalidade e detalhamento. 200 = proposta muito boa, com os cinco elementos e articulada à discussão; 160 = quatro elementos; 120 = três; 80 = dois; 40 = um; 0 = sem proposta ou que desrespeita os direitos humanos."]
  ];
  var NIVEIS = [0, 40, 80, 120, 160, 200];
  var ZEROS = ["Fuga ao tema", "Não atende ao tipo dissertativo-argumentativo", "Texto com até 7 linhas", "Cópia dos textos motivadores", "Parte deliberadamente desconectada do tema", "Texto em branco ou ilegível", "Identificação indevida (nome, assinatura ou marca)"];

  function dataBr(iso) { try { return new Date(iso).toLocaleDateString("pt-BR") + " " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  function palavras(t) { var m = t.trim().match(/\S+/g); return m ? m.length : 0; }
  function lista(qs) { var a = []; qs.forEach(function (d) { a.push({ id: d.id, d: d.data() }); }); return a; }
  var VKEY = "enem:redacoes-vistas:v1";
  function vistas() { try { return JSON.parse(localStorage.getItem(VKEY) || "{}"); } catch (e) { return {}; } }
  function marcaVista(id) { var v = vistas(); v[id] = 1; try { localStorage.setItem(VKEY, JSON.stringify(v)); } catch (e) {} }

  // ---------- fotos ----------
  var MAX_FOTOS = 2, MAX_CHARS_FOTO = 440000;   // 2 fotos cabem no limite de 1 MiB do documento
  function carregaImagem(file) {
    if (window.createImageBitmap) return window.createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return viaTag(file); });
    return viaTag(file);
  }
  function viaTag(file) {
    return new Promise(function (ok, no) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); ok(im); };
      im.onerror = function () { no(new Error("imagem inválida")); };
      im.src = u;
    });
  }
  function jpeg(img, largura, q) {
    var w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight, esc = Math.min(1, largura / w0);
    var c = document.createElement("canvas"); c.width = Math.round(w0 * esc); c.height = Math.round(h0 * esc);
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  }
  var TENT_ALUNO = [[1600, 0.7], [1600, 0.6], [1400, 0.6], [1400, 0.5], [1200, 0.5], [1000, 0.5]];
  var TENT_ANOTADA = [[2000, 0.8], [1800, 0.75], [1600, 0.7], [1600, 0.6], [1400, 0.55], [1200, 0.5]];
  function comprimir(file, maxChars, tentativas) {
    maxChars = maxChars || MAX_CHARS_FOTO; tentativas = tentativas || TENT_ALUNO;
    return carregaImagem(file).then(function (img) {
      for (var i = 0; i < tentativas.length; i++) {
        var d = jpeg(img, tentativas[i][0], tentativas[i][1]);
        if (d.length <= maxChars) return d;
      }
      throw new Error("foto grande demais");
    });
  }
  // fotos da redação corrigida e anotada pelo professor (uma subcoleção, para não estourar o limite do documento)
  function carregaAnotadas(id) {
    return db.collection("redacoes/" + id + "/anotadas").get().then(function (qs) {
      return lista(qs).sort(function (a, b) { return (a.d.ordem || 0) - (b.d.ordem || 0); });
    });
  }
  function abreImagem(dataUrl) {
    try {
      var b = atob(dataUrl.split(",")[1]), n = b.length, u8 = new Uint8Array(n);
      while (n--) u8[n] = b.charCodeAt(n);
      window.open(URL.createObjectURL(new Blob([u8], { type: "image/jpeg" })), "_blank");
    } catch (e) {}
  }
  function galeria(cx, fotos) {
    var g = el("div", "galeria");
    fotos.forEach(function (f, i) {
      var im = el("img"); im.src = f; im.alt = "Página " + (i + 1) + " da redação"; im.title = "Clique para ampliar";
      im.addEventListener("click", function () { abreImagem(f); });
      g.appendChild(im);
    });
    cx.appendChild(g);
  }

  // ---------- modelos de comentário ----------
  var PADRAO = {
    1: [["Excelente domínio", "Excelente domínio da norma culta, com pouquíssimos desvios. Continue revisando pontuação e acentuação para manter o nível."],
        ["Concordância", "Há desvios de concordância verbal e/ou nominal. Revise a relação entre sujeito e verbo e entre substantivo e adjetivo, sobretudo em frases longas ou com a ordem invertida."],
        ["Pontuação", "Atenção à pontuação: há vírgula separando sujeito e verbo ou faltando em orações e adjuntos deslocados. Leia o texto em voz alta para perceber as pausas."],
        ["Ortografia e acentuação", "Cuidado com ortografia, acentuação e crase. Anote as palavras que errou e monte uma lista pessoal de revisão."],
        ["Registro oral", "Evite o registro oral e coloquial (gírias, “a gente”, “tipo”, “né”). Em texto dissertativo, use a linguagem formal."]],
    2: [["Tema e repertório", "Tema bem compreendido e desenvolvido, com repertório sociocultural pertinente e usado como argumento, e estrutura dissertativo-argumentativa completa."],
        ["Repertório decorado", "O repertório aparece, mas como citação solta. Relacione-o explicitamente ao tema e use-o para sustentar sua tese."],
        ["Tangenciamento", "O texto tangencia o tema: trata do assunto geral, mas não do recorte da proposta. Releia o tema e delimite a tese dentro dele."],
        ["Sem tese clara", "Faltou uma tese clara na introdução. Apresente seu ponto de vista já no primeiro parágrafo."],
        ["Cópia dos motivadores", "Evite reproduzir trechos dos textos motivadores. Reescreva as ideias com suas palavras e acrescente informações próprias."]],
    3: [["Projeto de texto", "Projeto de texto estratégico: argumentos consistentes, bem organizados e com indícios de autoria."],
        ["Aprofundar", "Os argumentos precisam de aprofundamento: explique o porquê e as consequências, em vez de apenas afirmar."],
        ["Contradição", "Há saltos lógicos ou contradições entre as ideias. Antes de escrever, monte um roteiro: tese, dois argumentos distintos e conclusão."],
        ["Argumentos repetidos", "Os parágrafos de desenvolvimento repetem a mesma ideia. Escolha argumentos diferentes e explore cada um."]],
    4: [["Boa articulação", "Boa articulação entre períodos e parágrafos, com variedade de conectivos e retomadas."],
        ["Repetição de conectivos", "Há repetição excessiva de conectivos (“além disso”, “portanto”). Varie e use retomadas por pronomes e sinônimos."],
        ["Conectivo inadequado", "Alguns conectivos têm valor errado (por exemplo, “porém” no lugar de “portanto”). Revise o sentido de cada um."],
        ["Períodos longos", "Há períodos muito longos e confusos. Divida em frases menores e conecte as ideias com clareza."]],
    5: [["Proposta completa", "Proposta completa, com agente, ação, meio, finalidade e detalhamento, articulada à discussão do texto."],
        ["Faltou o meio", "Faltou detalhar o meio ou modo de execução da ação (como será feito). Acrescente essa informação."],
        ["Sem agente", "A proposta não indica um agente claro. Diga quem executará a ação (Governo Federal, escolas, mídia, ONGs...)."],
        ["Proposta genérica", "A proposta é genérica (“conscientizar a população”). Especifique a ação e a finalidade com precisão."],
        ["Direitos humanos", "A proposta deve respeitar os direitos humanos: não pode defender violência, exclusão ou desrespeito a grupos."]],
    0: [["Bom texto", "Bom texto. Para subir de nível, trabalhe o repertório, o detalhamento da proposta e a revisão final."],
        ["Treino", "Treine uma redação por semana e reescreva a anterior com base nos comentários. Leia redações nota 1000 do INEP e observe a estrutura."],
        ["Planejamento", "Planeje antes de escrever: tese, dois argumentos distintos e proposta com os cinco elementos. Reserve tempo para revisar."]]
  };
  var modelosSalvos = [];
  function carregaModelos() {
    return db.collection("modelos").get().then(function (qs) { modelosSalvos = lista(qs); return modelosSalvos; }).catch(function () { return modelosSalvos; });
  }
  function modelosDe(comp) {
    var out = (PADRAO[comp] || []).map(function (m) { return { titulo: m[0], texto: m[1], salvo: false }; });
    modelosSalvos.filter(function (m) { return m.d.comp === comp; }).forEach(function (m) { out.push({ titulo: "★ " + m.d.titulo, texto: m.d.texto, salvo: true }); });
    return out;
  }

  // ---------- visão do aluno ----------
  var cache = [];
  function carregar() {
    var u = N.user(); if (!u) return Promise.resolve([]);
    return db.collection("redacoes").where("uid", "==", u.uid).get().then(function (qs) {
      cache = lista(qs).sort(function (a, b) { return String(b.d.criada).localeCompare(String(a.d.criada)); });
      atualizaAviso();
      avisa();
      vigia();
      return cache;
    });
  }
  // avisos de redação corrigida (só com o site aberto): notificação do navegador, se permitida, e um aviso na tela
  var AKEY = "enem:redacoes-avisadas:v1", relogio = null;
  function avisadas() { try { return JSON.parse(localStorage.getItem(AKEY) || "{}"); } catch (e) { return {}; } }
  function avisa() {
    if (!APP || !APP.pref("notif")) return;
    var v = vistas(), a = avisadas(), novas = cache.filter(function (r) { return r.d.status === "corrigida" && !v[r.id] && !a[r.id]; });
    if (!novas.length) return;
    novas.forEach(function (r) { a[r.id] = 1; });
    try { localStorage.setItem(AKEY, JSON.stringify(a)); } catch (e) {}
    var txt = novas.length === 1 ? "Sua redação foi corrigida! Veja a nota na aba Redação." : novas.length + " redações suas foram corrigidas! Veja na aba Redação.";
    APP.avisar(txt, "redacao");
  }
  function vigia() {
    var ligado = APP && APP.pref("notif") && N.user();
    if (ligado && !relogio) relogio = setInterval(function () { carregar().catch(function () {}); }, 120000);
    else if (!ligado && relogio) { clearInterval(relogio); relogio = null; }
    if (ligado) avisa();
  }
  function atualizaAviso() {
    var v = vistas(), n = cache.filter(function (r) { return r.d.status === "corrigida" && !v[r.id]; }).length;
    var t = document.getElementById("tab-redacao"); if (t) t.textContent = n ? "Redação (" + n + ")" : "Redação";
  }

  function barras(cx, correcao) {
    for (var i = 1; i <= 5; i++) {
      var c = correcao.c[i] || { nota: 0 };
      var row = el("div", "barra-l");
      row.appendChild(el("span", null, "Competência " + i));
      var b = el("div", "barra"), f = el("i"); f.style.width = (c.nota / 2) + "%"; b.appendChild(f); row.appendChild(b);
      row.appendChild(el("span", "muted", c.nota + " / 200"));
      cx.appendChild(row);
    }
  }

  function render(painel) {
    painel.textContent = "";
    painel.appendChild(el("h2", "resumo-titulo", "Redação"));
    painel.appendChild(el("p", "muted", "Escreva sobre um tema, envie e acompanhe a correção do professor pelas 5 competências do ENEM. A correção é feita por uma pessoa e pode levar alguns dias."));
    var novo = el("div", "card");
    painel.appendChild(novo);
    var lst = el("div"); painel.appendChild(lst);
    formulario(novo, function () { carregar().then(function () { desenhaLista(lst); }); });
    lst.appendChild(el("p", "muted", "Carregando suas redações…"));
    carregar().then(function () { desenhaLista(lst); }).catch(function () {
      lst.textContent = ""; lst.appendChild(el("p", "muted", "Não foi possível carregar suas redações. Confira a conexão e se as regras do Firestore estão publicadas."));
    });
  }

  function formulario(cx, depois) {
    cx.appendChild(el("h3", null, "Nova redação"));
    var lt = el("label", "l", "Tema"); lt.htmlFor = "r-tema"; cx.appendChild(lt);
    var sel = el("select"); sel.id = "r-tema";
    TEMAS.forEach(function (t) { var o = el("option", null, t); o.value = t; sel.appendChild(o); });
    var ol = el("option", null, "Outro tema (digitar)"); ol.value = "__livre"; sel.appendChild(ol);
    cx.appendChild(sel);
    var livre = el("input"); livre.type = "text"; livre.placeholder = "Digite o tema"; livre.maxLength = 280; livre.hidden = true; livre.style.marginTop = "8px"; livre.style.width = "100%";
    cx.appendChild(livre);
    sel.addEventListener("change", function () { livre.hidden = sel.value !== "__livre"; });

    cx.appendChild(el("label", "l", "Como você vai entregar?"));
    var modo = "texto";
    var abas = el("div", "chips");
    var bT = el("button", "chip on", "Digitar no site"); bT.type = "button";
    var bF = el("button", "chip", "Enviar foto da folha"); bF.type = "button";
    abas.appendChild(bT); abas.appendChild(bF); cx.appendChild(abas);

    var areaT = el("div");
    var lx = el("label", "l", "Seu texto"); lx.htmlFor = "r-texto"; areaT.appendChild(lx);
    var ta = el("textarea"); ta.id = "r-texto"; ta.rows = 16; ta.maxLength = 7500; ta.style.width = "100%";
    ta.placeholder = "Escreva um texto dissertativo-argumentativo com introdução, desenvolvimento e conclusão, incluindo uma proposta de intervenção.";
    areaT.appendChild(ta);
    var cont = el("p", "muted"); areaT.appendChild(cont);
    function conta() {
      var p = palavras(ta.value), lin = Math.round(p / 12);
      cont.textContent = p + " palavras · cerca de " + lin + " linhas (estimativa) · " + ta.value.length + "/7500 caracteres" +
        (p && p < 85 ? " · atenção: textos com até 7 linhas recebem nota zero" : "") + (lin > 30 ? " · acima de 30 linhas pode ser penalizado" : "");
    }
    ta.addEventListener("input", conta); conta();
    cx.appendChild(areaT);

    var areaF = el("div"); areaF.hidden = true;
    areaF.appendChild(el("p", "muted", "Escreva a redação à mão na folha, fotografe com boa luz (folha inteira, sem sombras e sem cortar as bordas) e envie até " + MAX_FOTOS + " fotos. As fotos são reduzidas automaticamente para caberem no envio."));
    var arq = el("input"); arq.type = "file"; arq.accept = "image/*"; arq.id = "r-foto"; arq.multiple = true;
    areaF.appendChild(arq);
    var prev = el("div", "galeria"); areaF.appendChild(prev);
    var fotos = [];
    var stF = el("p", "muted"); areaF.appendChild(stF);
    function desenhaFotos() {
      prev.textContent = "";
      fotos.forEach(function (f, i) {
        var w = el("div", "foto-item");
        var im = el("img"); im.src = f; im.alt = "Foto " + (i + 1); w.appendChild(im);
        var rm = el("button", "ghost mini", "Remover"); rm.type = "button";
        rm.addEventListener("click", function () { fotos.splice(i, 1); desenhaFotos(); });
        w.appendChild(rm); prev.appendChild(w);
      });
    }
    arq.addEventListener("change", function () {
      var arqs = Array.prototype.slice.call(arq.files || []);
      if (!arqs.length) return;
      stF.textContent = "Preparando as fotos…";
      var cadeia = Promise.resolve();
      arqs.forEach(function (f) {
        cadeia = cadeia.then(function () {
          if (fotos.length >= MAX_FOTOS) throw new Error("limite");
          return comprimir(f).then(function (d) { fotos.push(d); });
        });
      });
      cadeia.then(function () { stF.textContent = fotos.length + " foto(s) pronta(s)."; })
        .catch(function (e) { stF.textContent = e && e.message === "limite" ? "Máximo de " + MAX_FOTOS + " fotos. Remova uma para trocar." : "Não foi possível usar uma das fotos. Tente outra, mais leve ou mais nítida."; })
        .then(function () { desenhaFotos(); arq.value = ""; });
    });
    cx.appendChild(areaF);

    function trocaModo(m) {
      modo = m; areaT.hidden = m !== "texto"; areaF.hidden = m !== "foto";
      bT.classList.toggle("on", m === "texto"); bF.classList.toggle("on", m === "foto");
    }
    bT.addEventListener("click", function () { trocaModo("texto"); });
    bF.addEventListener("click", function () { trocaModo("foto"); });

    var st = el("p", "muted");
    var ac = el("div", "acoes");
    var env = el("button", "btn", "Enviar para correção"); env.type = "button";
    env.addEventListener("click", function () {
      var tema = sel.value === "__livre" ? livre.value.trim() : sel.value;
      if (!tema) { st.textContent = "Informe o tema."; return; }
      if (modo === "texto" && palavras(ta.value) < 30) { st.textContent = "Escreva o texto antes de enviar."; return; }
      if (modo === "foto" && !fotos.length) { st.textContent = "Escolha pelo menos uma foto da redação."; return; }
      if (!confirm("Enviar a redação para correção? Depois de enviada, não dá para editar.")) return;
      env.disabled = true; st.textContent = "Enviando…";
      var u = N.user(), p = N.perfil() || {};
      var dados = { uid: u.uid, nome: p.nome || u.email, email: u.email, tema: tema, texto: modo === "texto" ? ta.value : "", criada: new Date().toISOString(), status: "enviada" };
      if (modo === "foto") { dados.tipo = "foto"; dados.fotos = fotos.slice(); }
      db.collection("redacoes").add(dados)
        .then(function () {
          N.avisaEmail("nova redação para corrigir", { de: dados.nome, tema: dados.tema, formato: modo === "foto" ? "foto (" + fotos.length + ")" : palavras(dados.texto) + " palavras" });
          ta.value = ""; conta(); fotos = []; desenhaFotos(); stF.textContent = "";
          st.textContent = "✔ Redação enviada! Você verá a correção abaixo quando o professor terminar."; env.disabled = false; depois();
        })
        .catch(function () { env.disabled = false; st.textContent = "Não foi possível enviar. Confira a conexão e tente de novo (fotos muito pesadas podem falhar)."; });
    });
    ac.appendChild(env); cx.appendChild(ac); cx.appendChild(st);
  }

  function desenhaLista(cx) {
    cx.textContent = "";
    var corr = cache.filter(function (r) { return r.d.status === "corrigida"; });
    if (corr.length) {
      var ev = el("div", "card");
      ev.appendChild(el("h3", null, "Sua evolução"));
      var media = [0, 0, 0, 0, 0];
      corr.forEach(function (r) { for (var i = 1; i <= 5; i++) media[i - 1] += (r.d.correcao.c[i] || { nota: 0 }).nota; });
      var chart = el("div", "evo");
      corr.slice(0, 8).reverse().forEach(function (r) {
        var col = el("div", "evo-c"), b = el("i"); b.style.height = Math.max(3, r.d.correcao.total / 10) + "%"; col.appendChild(b); col.appendChild(el("span", null, String(r.d.correcao.total)));
        col.title = r.d.tema; chart.appendChild(col);
      });
      ev.appendChild(chart);
      ev.appendChild(el("p", "muted", "Média das competências: " + media.map(function (m, i) { return "C" + (i + 1) + " " + Math.round(m / corr.length); }).join(" · ")));
      cx.appendChild(ev);
    }
    var c = el("div", "card");
    c.appendChild(el("h3", null, "Minhas redações (" + cache.length + ")"));
    if (!cache.length) c.appendChild(el("p", "muted", "Você ainda não enviou nenhuma redação."));
    var det = el("div");
    var v = vistas();
    cache.forEach(function (r) {
      var row = el("div", "hist-row novo");
      var i = el("div"); i.appendChild(el("b", null, r.d.tema));
      i.appendChild(el("div", "muted", dataBr(r.d.criada) + " · " + (r.d.status === "corrigida" ? "corrigida: " + r.d.correcao.total + " / 1000" + (v[r.id] ? "" : " · NOVA") : "aguardando correção")));
      row.appendChild(i);
      var bv = el("button", "btn mini", "Abrir"); bv.type = "button";
      bv.addEventListener("click", function () { detalhe(det, r); if (r.d.status === "corrigida") { marcaVista(r.id); atualizaAviso(); } });
      row.appendChild(bv);
      var bx = el("button", "ghost mini", "Excluir"); bx.type = "button"; bx.hidden = r.d.status !== "enviada";
      bx.addEventListener("click", function () {
        if (!confirm("Excluir esta redação enviada?")) return;
        db.doc("redacoes/" + r.id).delete().then(function () { return carregar(); }).then(function () { desenhaLista(cx); });
      });
      row.appendChild(bx);
      c.appendChild(row);
    });
    cx.appendChild(c); cx.appendChild(det);
  }

  function detalhe(cx, r) {
    cx.textContent = "";
    var c = el("div", "card");
    c.appendChild(el("h3", null, r.d.tema));
    c.appendChild(el("p", "muted", "Enviada em " + dataBr(r.d.criada) + (r.d.fotos && r.d.fotos.length ? " · por foto" : " · " + palavras(r.d.texto) + " palavras")));
    if (r.d.status === "corrigida") {
      var k = r.d.correcao;
      var big = el("div", "grande"); var s = el("div", "stat"); s.appendChild(el("b", null, k.total + " / 1000")); s.appendChild(el("span", null, "nota")); big.appendChild(s); c.appendChild(big);
      if (k.anulada) c.appendChild(el("p", "down", "Redação anulada: " + k.anulada));
      barras(c, k);
      if (k.dh) c.appendChild(el("p", "down", "A proposta desrespeita os direitos humanos (Competência 5 zerada)."));
      for (var i = 1; i <= 5; i++) {
        var cm = (k.c[i] || {}).coment;
        if (cm) { c.appendChild(el("h4", "sub", COMP[i - 1][0] + " — " + k.c[i].nota)); var p = el("p", null, cm); p.style.whiteSpace = "pre-line"; c.appendChild(p); }
      }
      if (k.geral) { c.appendChild(el("h4", "sub", "Comentário geral")); var g = el("p", null, k.geral); g.style.whiteSpace = "pre-line"; c.appendChild(g); }
      c.appendChild(el("p", "muted", "Corrigida por " + (k.por || "professor") + " em " + dataBr(k.em) + ". Nota estimada, sem valor oficial."));
    } else c.appendChild(el("p", "muted", "Ainda aguardando a correção."));
    var original = el("div"); c.appendChild(original);
    function mostraOriginal() {
      original.textContent = "";
      if (r.d.fotos && r.d.fotos.length) { original.appendChild(el("h4", "sub", "Sua redação (fotos)")); galeria(original, r.d.fotos); }
      else { original.appendChild(el("h4", "sub", "Seu texto")); var t = el("p", null, r.d.texto); t.style.whiteSpace = "pre-line"; original.appendChild(t); }
    }
    if (r.d.status === "corrigida") {
      original.appendChild(el("p", "muted", "Carregando a redação corrigida…"));
      carregaAnotadas(r.id).then(function (an) {
        original.textContent = "";
        if (an.length) { original.appendChild(el("h4", "sub", "Sua redação corrigida e comentada")); galeria(original, an.map(function (x) { return x.d.dados; })); }
        else mostraOriginal();
      }).catch(mostraOriginal);
    } else mostraOriginal();
    var pb = el("button", "ghost mini", "Imprimir / PDF"); pb.type = "button"; pb.addEventListener("click", function () { window.print(); });
    c.appendChild(pb);
    cx.appendChild(c); c.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- visão do administrador (seção "Redações") ----------
  function admin(cx) {
    var info = el("p", "muted", "Carregando…"); cx.appendChild(info);
    db.collection("redacoes").get().then(function (qs) {
      var ls = lista(qs).sort(function (a, b) { return String(a.d.criada).localeCompare(String(b.d.criada)); });
      var pend = ls.filter(function (r) { return r.d.status !== "corrigida"; }).length;
      info.textContent = pend + " aguardando correção · " + (ls.length - pend) + " corrigida(s).";
      var barra = el("div", "filtro-linha");
      var fs = el("select");
      [["pendentes", "Aguardando correção"], ["corrigidas", "Corrigidas"], ["todas", "Todas"]].forEach(function (x) { var o = el("option", null, x[1]); o.value = x[0]; fs.appendChild(o); });
      barra.appendChild(fs); cx.appendChild(barra);
      var corpo = el("div"); cx.appendChild(corpo);
      function desenha() {
        corpo.textContent = "";
        var vis = ls.filter(function (r) { return fs.value === "todas" || (fs.value === "pendentes") === (r.d.status !== "corrigida"); });
        if (fs.value === "corrigidas") vis = vis.slice().reverse();
        if (!vis.length) corpo.appendChild(el("p", "muted", "Nenhuma redação nesta lista."));
        vis.forEach(function (r) {
          var row = el("div", "hist-row novo");
          var i = el("div"); i.appendChild(el("b", null, (r.d.nome || r.d.email) + " — " + r.d.tema));
          i.appendChild(el("div", "muted", dataBr(r.d.criada) + " · " + (r.d.fotos && r.d.fotos.length ? "foto" : palavras(r.d.texto) + " palavras") + " · " + (r.d.status === "corrigida" ? "corrigida: " + r.d.correcao.total + " / 1000" : "aguardando")));
          row.appendChild(i);
          var b = el("button", "btn mini", r.d.status === "corrigida" ? "Rever" : "Corrigir"); b.type = "button";
          b.addEventListener("click", function () { corrigir(cx, r, function () { cx.textContent = ""; admin(cx); }); });
          row.appendChild(b); row.appendChild(el("span"));
          corpo.appendChild(row);
        });
      }
      fs.addEventListener("change", desenha); desenha();
    }).catch(function (e) { info.textContent = "Não foi possível carregar: " + ((e && e.message) || e) + ". Confira se as regras mais recentes do Firestore foram publicadas."; });
  }

  // caixa com seletor de modelos e botão de salvar o texto atual como modelo
  function comModelos(cx, ta, comp, recarrega) {
    var linha = el("div", "filtro-linha");
    var sel = el("select"); sel.style.maxWidth = "260px";
    function monta() {
      sel.textContent = "";
      var o0 = el("option", null, "Inserir modelo…"); o0.value = ""; sel.appendChild(o0);
      modelosDe(comp).forEach(function (m, i) { var o = el("option", null, m.titulo); o.value = String(i); sel.appendChild(o); });
    }
    monta();
    sel.addEventListener("change", function () {
      if (sel.value === "") return;
      var m = modelosDe(comp)[parseInt(sel.value, 10)];
      if (m) ta.value = (ta.value.trim() ? ta.value.trim() + "\n" : "") + m.texto;
      sel.value = "";
      ta.dispatchEvent(new Event("input"));
    });
    var sv = el("button", "ghost mini", "Salvar como modelo"); sv.type = "button";
    sv.addEventListener("click", function () {
      var txt = ta.value.trim();
      if (!txt) { alert("Escreva o comentário antes de salvar como modelo."); return; }
      var titulo = prompt("Título curto para este modelo:");
      if (!titulo || !titulo.trim()) return;
      db.collection("modelos").add({ comp: comp, titulo: titulo.trim().slice(0, 60), texto: txt.slice(0, 1500), criado: new Date().toISOString(), por: (N.perfil() || {}).nome || "" })
        .then(function () { return carregaModelos(); }).then(function () { monta(); if (recarrega) recarrega(); })
        .catch(function () { alert("Não foi possível salvar o modelo."); });
    });
    linha.appendChild(sel); linha.appendChild(sv); cx.appendChild(linha);
  }

  function corrigir(cx, r, voltar) {
    cx.textContent = "";
    var vb = el("button", "ghost mini", "← Voltar à lista"); vb.type = "button"; vb.addEventListener("click", voltar); cx.appendChild(vb);
    var c = el("div", "card");
    c.appendChild(el("h3", null, r.d.tema));
    var foto = r.d.fotos && r.d.fotos.length;
    c.appendChild(el("p", "muted", (r.d.nome || "") + " (" + (r.d.email || "") + ") · " + dataBr(r.d.criada) + (foto ? " · redação por foto (clique para ampliar)" : " · " + palavras(r.d.texto) + " palavras (≈ " + Math.round(palavras(r.d.texto) / 12) + " linhas)")));
    if (foto) galeria(c, r.d.fotos); else c.appendChild(el("p", "redacao-texto", r.d.texto));
    cx.appendChild(c);

    var k = (r.d.correcao) || { c: {}, geral: "" };
    var f = el("div", "card");
    f.appendChild(el("h3", null, "Correção"));
    var notas = {}, coms = {};
    var carregando = el("p", "muted", "Carregando modelos de comentário…"); f.appendChild(carregando);
    carregaModelos().then(function () {
      carregando.remove();
      COMP.forEach(function (cp, idx) {
        var i = idx + 1;
        f.insertBefore(el("h4", "sub", cp[0]), secA);
        var ajuda = el("details", "det"); ajuda.appendChild(el("summary", null, "Critérios")); ajuda.appendChild(el("p", "muted", cp[1])); f.insertBefore(ajuda, secA);
        var sel = el("select"); sel.style.maxWidth = "160px";
        NIVEIS.forEach(function (n) { var o = el("option", null, String(n)); o.value = n; sel.appendChild(o); });
        sel.value = String((k.c[i] || {}).nota || 0); notas[i] = sel; sel.addEventListener("change", total);
        f.insertBefore(sel, secA);
        var ta = el("textarea"); ta.rows = 3; ta.style.width = "100%"; ta.style.marginTop = "6px"; ta.placeholder = "Comentário para o aluno sobre esta competência";
        ta.value = (k.c[i] || {}).coment || ""; coms[i] = ta;
        var cx2 = el("div"); comModelos(cx2, ta, i); f.insertBefore(cx2, secA); f.insertBefore(ta, secA);
      });
      total();
    });
    // foto da redação corrigida e anotada (o aluno passa a ver só esta, e não a versão limpa)
    var anot = { atuais: [], novas: [], removidos: [] };   // atuais: {id, dados}; novas: dataURLs
    var secA = el("div", "card");
    secA.appendChild(el("h4", "sub", "Foto da redação corrigida (opcional)"));
    secA.appendChild(el("p", "muted", "Fotografe a redação com suas marcações e comentários. Quando houver foto aqui, o aluno vê só ela depois da correção, e não a versão original sem marcas. Até " + MAX_FOTOS + " fotos."));
    var arqA = el("input"); arqA.type = "file"; arqA.accept = "image/*"; arqA.multiple = true; arqA.id = "r-foto-corrigida"; secA.appendChild(arqA);
    var galA = el("div", "galeria"); secA.appendChild(galA);
    var stA = el("p", "muted"); secA.appendChild(stA);
    function desenhaA() {
      galA.textContent = "";
      var todas = anot.atuais.map(function (x) { return { src: x.dados, tipo: "atual", ref: x }; }).concat(anot.novas.map(function (d, i) { return { src: d, tipo: "nova", ref: i }; }));
      todas.forEach(function (x) {
        var w = el("div", "foto-item");
        var im = el("img"); im.src = x.src; im.alt = "Redação corrigida"; im.addEventListener("click", function () { abreImagem(x.src); }); im.style.cursor = "zoom-in"; w.appendChild(im);
        var rm = el("button", "ghost mini", "Remover"); rm.type = "button";
        rm.addEventListener("click", function () {
          if (x.tipo === "atual") { anot.removidos.push(x.ref.id); anot.atuais = anot.atuais.filter(function (y) { return y !== x.ref; }); }
          else anot.novas.splice(x.ref, 1);
          desenhaA();
        });
        w.appendChild(rm); galA.appendChild(w);
      });
    }
    if (k && r.d.status === "corrigida") carregaAnotadas(r.id).then(function (an) { anot.atuais = an.map(function (x) { return { id: x.id, dados: x.d.dados }; }); desenhaA(); }).catch(function () {});
    arqA.addEventListener("change", function () {
      var arqs = Array.prototype.slice.call(arqA.files || []);
      if (!arqs.length) return;
      stA.textContent = "Preparando as fotos…";
      var cadeia = Promise.resolve();
      arqs.forEach(function (fl) {
        cadeia = cadeia.then(function () {
          if (anot.atuais.length + anot.novas.length >= MAX_FOTOS) throw new Error("limite");
          return comprimir(fl, 900000, TENT_ANOTADA).then(function (d) { anot.novas.push(d); });
        });
      });
      cadeia.then(function () { stA.textContent = "Foto(s) pronta(s). Elas são enviadas ao salvar a correção."; })
        .catch(function (e) { stA.textContent = e && e.message === "limite" ? "Máximo de " + MAX_FOTOS + " fotos. Remova uma para trocar." : "Não foi possível usar uma das fotos."; })
        .then(function () { desenhaA(); arqA.value = ""; });
    });
    f.appendChild(secA);

    var geralTitulo = el("h4", "sub", "Comentário geral"); f.appendChild(geralTitulo);
    var geral = el("textarea"); geral.rows = 4; geral.style.width = "100%"; geral.value = k.geral || "";
    carregaModelos().then(function () { var cg = el("div"); comModelos(cg, geral, 0); f.insertBefore(cg, geral); });
    f.appendChild(geral);

    f.appendChild(el("h4", "sub", "Casos de nota zero"));
    var zs = el("select"); var z0 = el("option", null, "Nenhum"); z0.value = ""; zs.appendChild(z0);
    ZEROS.forEach(function (z) { var o = el("option", null, z); o.value = z; zs.appendChild(o); });
    zs.value = k.anulada || ""; f.appendChild(zs);
    var lh = el("label", "check"); var dh = el("input"); dh.type = "checkbox"; dh.checked = !!k.dh; lh.appendChild(dh);
    lh.appendChild(document.createTextNode(" A proposta desrespeita os direitos humanos (zera só a Competência 5)")); f.appendChild(lh);
    zs.addEventListener("change", total); dh.addEventListener("change", total);

    var tot = el("p"); tot.style.fontSize = "1.3rem"; tot.style.fontWeight = "700"; f.appendChild(tot);
    function total() {
      var s = 0;
      for (var i = 1; i <= 5; i++) if (notas[i]) s += parseInt(notas[i].value, 10) || 0;
      if (dh.checked && notas[5]) s -= parseInt(notas[5].value, 10) || 0;
      if (zs.value) s = 0;
      tot.textContent = "Nota total: " + s + " / 1000";
      return s;
    }
    total();
    var st = el("p", "muted"); var ac = el("div", "acoes");
    var salvar = el("button", "btn", r.d.status === "corrigida" ? "Atualizar correção" : "Salvar correção"); salvar.type = "button";
    salvar.addEventListener("click", function () {
      if (!notas[1]) { st.textContent = "Aguarde o carregamento do formulário."; return; }
      var cc = {};
      for (var i = 1; i <= 5; i++) {
        var nota = zs.value ? 0 : (i === 5 && dh.checked ? 0 : (parseInt(notas[i].value, 10) || 0));
        cc[i] = { nota: nota, coment: coms[i].value.trim() };
      }
      var correcao = { c: cc, geral: geral.value.trim(), total: total(), anulada: zs.value || null, dh: !!dh.checked, por: (N.perfil() || {}).nome || "professor", em: new Date().toISOString() };
      salvar.disabled = true; st.textContent = "Salvando…";
      // fotos anotadas primeiro; só depois a redação passa a "corrigida" para o aluno
      var ops = anot.removidos.map(function (id) { return db.doc("redacoes/" + r.id + "/anotadas/" + id).delete(); });
      var usados = {}; anot.atuais.forEach(function (x) { usados[x.id] = true; });
      anot.novas.forEach(function (d, i) {
        var n = 1; while (usados["p" + n]) n++;
        usados["p" + n] = true;
        ops.push(db.doc("redacoes/" + r.id + "/anotadas/p" + n).set({ ordem: n, dados: d }));
      });
      Promise.all(ops).then(function () {
        return db.doc("redacoes/" + r.id).update({ status: "corrigida", correcao: correcao });
      }).then(function () {
        r.d.status = "corrigida"; r.d.correcao = correcao;
        return carregaAnotadas(r.id).then(function (an) { anot.atuais = an.map(function (x) { return { id: x.id, dados: x.d.dados }; }); anot.novas = []; anot.removidos = []; desenhaA(); });
      }).then(function () {
        st.textContent = "✔ Correção salva. O aluno já pode ver."; salvar.disabled = false; salvar.textContent = "Atualizar correção";
      }).catch(function () { salvar.disabled = false; st.textContent = "Não foi possível salvar. Confira se as regras do Firestore estão publicadas."; });
    });
    ac.appendChild(salvar); f.appendChild(ac); f.appendChild(st);
    cx.appendChild(f);
  }

  // ---------- seção "Modelos de comentário" (administração) ----------
  var NOMES_COMP = { 0: "Comentário geral", 1: "Competência 1", 2: "Competência 2", 3: "Competência 3", 4: "Competência 4", 5: "Competência 5" };
  function modelos(cx) {
    var info = el("p", "muted", "Carregando…"); cx.appendChild(info);
    carregaModelos().then(function () {
      info.textContent = "Modelos são frases prontas que você insere na correção com um clique. Há modelos padrão e os seus (marcados com ★), que você também pode criar aqui ou direto na tela de correção, com “Salvar como modelo”.";
      var f = el("div", "card");
      f.appendChild(el("h4", "sub", "Novo modelo"));
      var sc = el("select"); [0, 1, 2, 3, 4, 5].forEach(function (n) { var o = el("option", null, NOMES_COMP[n]); o.value = n; sc.appendChild(o); });
      var ti = el("input"); ti.type = "text"; ti.placeholder = "Título curto"; ti.maxLength = 60; ti.style.width = "100%"; ti.style.margin = "8px 0";
      var tx = el("textarea"); tx.rows = 3; tx.style.width = "100%"; tx.placeholder = "Texto do comentário";
      var add = el("button", "btn mini", "Salvar modelo"); add.type = "button"; add.style.marginTop = "8px";
      add.addEventListener("click", function () {
        if (!ti.value.trim() || !tx.value.trim()) return;
        db.collection("modelos").add({ comp: parseInt(sc.value, 10), titulo: ti.value.trim(), texto: tx.value.trim().slice(0, 1500), criado: new Date().toISOString(), por: (N.perfil() || {}).nome || "" })
          .then(function () { cx.textContent = ""; modelos(cx); }).catch(function () { alert("Não foi possível salvar."); });
      });
      f.appendChild(sc); f.appendChild(ti); f.appendChild(tx); f.appendChild(add); cx.appendChild(f);
      [0, 1, 2, 3, 4, 5].forEach(function (n) {
        var c = el("div", "card"); c.appendChild(el("h4", "sub", NOMES_COMP[n]));
        (PADRAO[n] || []).forEach(function (m) { c.appendChild(el("p", "muted linha", "• " + m[0] + ": " + m[1])); });
        modelosSalvos.filter(function (m) { return m.d.comp === n; }).forEach(function (m) {
          var l = el("div", "hist-row novo"); var i = el("div"); i.appendChild(el("b", null, "★ " + m.d.titulo)); i.appendChild(el("div", "muted", m.d.texto)); l.appendChild(i);
          var rm = el("button", "ghost mini", "Excluir"); rm.type = "button";
          rm.addEventListener("click", function () { if (!confirm("Excluir este modelo?")) return; db.doc("modelos/" + m.id).delete().then(function () { cx.textContent = ""; modelos(cx); }); });
          l.appendChild(rm); l.appendChild(el("span")); c.appendChild(l);
        });
        cx.appendChild(c);
      });
    });
  }

  window.NUVEM_REDACAO = { render: render, carregar: carregar, vigia: vigia };
  window.NUVEM_ADMIN = window.NUVEM_ADMIN || {};
  window.NUVEM_ADMIN.redacoes = admin;
  window.NUVEM_ADMIN.modelos = modelos;
})();
