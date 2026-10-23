(function () {
  "use strict";
  // Redação: o aluno escreve e envia; o administrador corrige pelas 5 competências do ENEM no painel.
  // Sem IA: a correção é humana. Depende de nuvem.js (window.NUVEM).
  var N = window.NUVEM;
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

  // ---------- visão do aluno ----------
  var cache = [];
  function carregar() {
    var u = N.user(); if (!u) return Promise.resolve([]);
    return db.collection("redacoes").where("uid", "==", u.uid).get().then(function (qs) {
      cache = lista(qs).sort(function (a, b) { return String(b.d.criada).localeCompare(String(a.d.criada)); });
      atualizaAviso();
      return cache;
    });
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

    var lx = el("label", "l", "Seu texto"); lx.htmlFor = "r-texto"; cx.appendChild(lx);
    var ta = el("textarea"); ta.id = "r-texto"; ta.rows = 16; ta.maxLength = 7500; ta.style.width = "100%";
    ta.placeholder = "Escreva um texto dissertativo-argumentativo com introdução, desenvolvimento e conclusão, incluindo uma proposta de intervenção.";
    cx.appendChild(ta);
    var cont = el("p", "muted"); cx.appendChild(cont);
    function conta() {
      var p = palavras(ta.value), lin = Math.round(p / 12);
      cont.textContent = p + " palavras · cerca de " + lin + " linhas (estimativa) · " + ta.value.length + "/7500 caracteres" +
        (p && p < 85 ? " · atenção: textos com até 7 linhas recebem nota zero" : "") + (lin > 30 ? " · acima de 30 linhas pode ser penalizado" : "");
    }
    ta.addEventListener("input", conta); conta();
    var st = el("p", "muted");
    var ac = el("div", "acoes");
    var env = el("button", "btn", "Enviar para correção"); env.type = "button";
    env.addEventListener("click", function () {
      var tema = sel.value === "__livre" ? livre.value.trim() : sel.value;
      if (!tema) { st.textContent = "Informe o tema."; return; }
      if (palavras(ta.value) < 30) { st.textContent = "Escreva o texto antes de enviar."; return; }
      if (!confirm("Enviar a redação para correção? Depois de enviada, não dá para editar.")) return;
      env.disabled = true; st.textContent = "Enviando…";
      var u = N.user(), p = N.perfil() || {};
      db.collection("redacoes").add({ uid: u.uid, nome: p.nome || u.email, email: u.email, tema: tema, texto: ta.value, criada: new Date().toISOString(), status: "enviada" })
        .then(function () { ta.value = ""; conta(); st.textContent = "✔ Redação enviada! Você verá a correção abaixo quando o professor terminar."; env.disabled = false; depois(); })
        .catch(function () { env.disabled = false; st.textContent = "Não foi possível enviar. Confira a conexão e tente de novo."; });
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
    c.appendChild(el("p", "muted", "Enviada em " + dataBr(r.d.criada) + " · " + palavras(r.d.texto) + " palavras"));
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
    c.appendChild(el("h4", "sub", "Seu texto"));
    var t = el("p", null, r.d.texto); t.style.whiteSpace = "pre-line"; c.appendChild(t);
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
          i.appendChild(el("div", "muted", dataBr(r.d.criada) + " · " + palavras(r.d.texto) + " palavras · " + (r.d.status === "corrigida" ? "corrigida: " + r.d.correcao.total + " / 1000" : "aguardando")));
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

  function corrigir(cx, r, voltar) {
    cx.textContent = "";
    var vb = el("button", "ghost mini", "← Voltar à lista"); vb.type = "button"; vb.addEventListener("click", voltar); cx.appendChild(vb);
    var c = el("div", "card");
    c.appendChild(el("h3", null, r.d.tema));
    c.appendChild(el("p", "muted", (r.d.nome || "") + " (" + (r.d.email || "") + ") · " + dataBr(r.d.criada) + " · " + palavras(r.d.texto) + " palavras (≈ " + Math.round(palavras(r.d.texto) / 12) + " linhas)"));
    var t = el("p", "redacao-texto", r.d.texto); c.appendChild(t);
    cx.appendChild(c);

    var k = (r.d.correcao) || { c: {}, geral: "" };
    var f = el("div", "card");
    f.appendChild(el("h3", null, "Correção"));
    var notas = {}, coms = {};
    COMP.forEach(function (cp, idx) {
      var i = idx + 1;
      f.appendChild(el("h4", "sub", cp[0]));
      var ajuda = el("details", "det"); ajuda.appendChild(el("summary", null, "Critérios")); ajuda.appendChild(el("p", "muted", cp[1])); f.appendChild(ajuda);
      var sel = el("select"); sel.style.maxWidth = "160px";
      NIVEIS.forEach(function (n) { var o = el("option", null, String(n)); o.value = n; sel.appendChild(o); });
      sel.value = String((k.c[i] || {}).nota || 0); notas[i] = sel; sel.addEventListener("change", total);
      f.appendChild(sel);
      var ta = el("textarea"); ta.rows = 3; ta.style.width = "100%"; ta.style.marginTop = "6px"; ta.placeholder = "Comentário para o aluno sobre esta competência";
      ta.value = (k.c[i] || {}).coment || ""; coms[i] = ta; f.appendChild(ta);
    });
    f.appendChild(el("h4", "sub", "Comentário geral"));
    var geral = el("textarea"); geral.rows = 4; geral.style.width = "100%"; geral.value = k.geral || ""; f.appendChild(geral);

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
      for (var i = 1; i <= 5; i++) s += parseInt(notas[i].value, 10) || 0;
      if (dh.checked) s -= parseInt(notas[5].value, 10) || 0;
      if (zs.value) s = 0;
      tot.textContent = "Nota total: " + s + " / 1000";
      return s;
    }
    total();
    var st = el("p", "muted"); var ac = el("div", "acoes");
    var salvar = el("button", "btn", r.d.status === "corrigida" ? "Atualizar correção" : "Salvar correção"); salvar.type = "button";
    salvar.addEventListener("click", function () {
      var cc = {};
      for (var i = 1; i <= 5; i++) {
        var nota = zs.value ? 0 : (i === 5 && dh.checked ? 0 : (parseInt(notas[i].value, 10) || 0));
        cc[i] = { nota: nota, coment: coms[i].value.trim() };
      }
      var correcao = { c: cc, geral: geral.value.trim(), total: total(), anulada: zs.value || null, dh: !!dh.checked, por: (N.perfil() || {}).nome || "professor", em: new Date().toISOString() };
      salvar.disabled = true; st.textContent = "Salvando…";
      db.doc("redacoes/" + r.id).update({ status: "corrigida", correcao: correcao }).then(function () {
        r.d.status = "corrigida"; r.d.correcao = correcao; st.textContent = "✔ Correção salva. O aluno já pode ver."; salvar.disabled = false; salvar.textContent = "Atualizar correção";
      }).catch(function () { salvar.disabled = false; st.textContent = "Não foi possível salvar. Confira se as regras do Firestore estão publicadas."; });
    });
    ac.appendChild(salvar); f.appendChild(ac); f.appendChild(st);
    cx.appendChild(f);
  }

  window.NUVEM_REDACAO = { render: render, carregar: carregar };
  window.NUVEM_ADMIN = window.NUVEM_ADMIN || {};
  window.NUVEM_ADMIN.redacoes = admin;
})();
