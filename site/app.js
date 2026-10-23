(function () {
  "use strict";
  var Q = window.QUESTOES || [];
  var EXP = window.EXPLICACOES || {};
  var META = window.META || {};
  var AREAS = ["Linguagens", "Humanas", "Natureza", "Matemática"];
  var GRUPOS = [
    ["Linguagens", ["Língua Portuguesa", "Literatura", "Inglês", "Espanhol", "Artes", "Educação Física"]],
    ["Humanas", ["História", "Geografia", "Filosofia", "Sociologia"]],
    ["Natureza", ["Física", "Química", "Biologia"]],
    ["Matemática", ["Matemática"]]
  ];
  var MATS = [];
  GRUPOS.forEach(function (g) { g[1].forEach(function (m) { MATS.push(m); }); });
  function matDe(q) { return (META[q.id] || [q.area, ""])[0]; }
  function assDe(q) { return (META[q.id] || [q.area, ""])[1]; }
  var ASSUNTOS = {};
  Object.keys(META).forEach(function (id) {
    var m = META[id]; (ASSUNTOS[m[0]] = ASSUNTOS[m[0]] || {})[m[1]] = true;
  });
  function assuntosDe(m) { return Object.keys(ASSUNTOS[m] || {}).sort(); }
  var LETRAS = ["A", "B", "C", "D", "E"];
  var KEY = "enem:respostas:v1";
  var MKEY = "enem:marcadas:v1";
  var HKEY = "enem:historico:v1";

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- estado ----------
  var respostas = {};
  try { respostas = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { respostas = {}; }
  function notifica() { if (typeof window.__sync === "function") window.__sync(); }
  function salvar() { try { localStorage.setItem(KEY, JSON.stringify(respostas)); } catch (e) {} notifica(); }
  var PKEY = "enem:prefs:v1";
  var prefs = { meta: 10, atv: {} };   // meta diária e contagem de questões por dia
  try { var pp = JSON.parse(localStorage.getItem(PKEY) || "null"); if (pp) prefs = { meta: pp.meta || 10, atv: pp.atv || {} }; } catch (e) {}
  function salvarPrefs() { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) {} notifica(); }
  function diaStr(t) { var d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  var INTERVALOS = [1, 3, 7, 14, 30];   // dias até rever uma questão, por "caixa" (repetição espaçada)
  function registraResposta(id, letra, gab) {
    var ant = respostas[id], ok = letra === gab;
    var box = ok ? Math.min(((ant && ant.box != null ? ant.box : (ant && ant.ok ? 1 : 0))) + 1, INTERVALOS.length - 1) : 0;
    respostas[id] = { r: letra, ok: ok, t: Date.now(), box: box };
    var k = diaStr(Date.now()); prefs.atv[k] = (prefs.atv[k] || 0) + 1;
    salvarPrefs();
  }
  function sequencia() {
    var n = 0, d = new Date();
    if (!prefs.atv[diaStr(d)]) d.setDate(d.getDate() - 1);   // a sequência só quebra quando o dia acaba
    while (prefs.atv[diaStr(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function devidas() {
    var agora = Date.now();
    return Object.keys(respostas).filter(function (id) {
      var r = respostas[id], q = porId[id];
      if (!r || !q || q.gabarito === "X" || !r.t) return false;
      var box = r.box != null ? r.box : (r.ok ? 1 : 0);
      return agora >= r.t + INTERVALOS[box] * 86400000;
    }).sort(function (a, b) { return respostas[a].t - respostas[b].t; });
  }
  var marcadas = {};
  try { marcadas = JSON.parse(localStorage.getItem(MKEY) || "{}"); } catch (e) { marcadas = {}; }
  function salvarMarcas() { try { localStorage.setItem(MKEY, JSON.stringify(marcadas)); } catch (e) {} notifica(); }
  var hist = [];
  try { hist = JSON.parse(localStorage.getItem(HKEY) || "[]"); } catch (e) { hist = []; }
  function salvarHist() { try { localStorage.setItem(HKEY, JSON.stringify(hist.slice(0, 40))); } catch (e) {} notifica(); }

  var SKEY = "enem:simulado:v1";   // formato antigo (um só simulado), migrado para a lista
  var NKEY = "enem:novos:v1";
  var novos = [];   // simulados criados e ainda não concluídos
  try { novos = JSON.parse(localStorage.getItem(NKEY) || "[]"); } catch (e) { novos = []; }
  try {
    var velho = JSON.parse(localStorage.getItem(SKEY) || "null");
    if (velho && !velho.fim) { velho.uid = velho.uid || Date.now(); novos.push(velho); }
    localStorage.removeItem(SKEY);
  } catch (e) {}
  function salvarNovos() { try { localStorage.setItem(NKEY, JSON.stringify(novos)); } catch (e) {} notifica(); }
  var sim = null;    // simulado em exibição
  var criando = false; // mostrando o formulário de novo simulado
  var verRes = null; // simulado concluído cujo resultado está na tela inicial
  function salvarSim() {
    if (!sim) return;
    if (sim.fim) { if (sim.hid) salvarHist(); } else salvarNovos();
  }
  var emSim = false;
  var porId = {};
  Q.forEach(function (q) { porId[q.id] = q; });
  function simPronto() { return emSim && sim; }
  function feitoDe(q) {
    if (simPronto()) { var a = sim.resp[q.id]; return a ? { r: a, ok: a === q.gabarito } : null; }
    return respostas[q.id];
  }
  function estadoDe(q) {
    var f = feitoDe(q);
    if (!f) return null;
    if (simPronto() && !sim.mostrar && !sim.fim) return "ans";
    return f.ok ? "ok" : "err";
  }

  var filtro = { anos: {}, areas: {}, mats: {}, assunto: "", status: "todas", lingua: "ambas", busca: "", embaralhar: false };
  var lista = [];
  var idx = 0;
  var escolha = null;
  var seed = 1;

  var anos = Array.from(new Set(Q.map(function (q) { return q.ano; }))).sort(function (a, b) { return b - a; });
  anos.forEach(function (a) { filtro.anos[a] = true; });
  AREAS.forEach(function (a) { filtro.areas[a] = true; });
  MATS.forEach(function (m) { filtro.mats[m] = true; });

  // ---------- filtros ----------
  function chips(container, itens, mapa, rot) {
    container.textContent = "";
    itens.forEach(function (it) {
      var b = el("button", "chip" + (mapa[it] ? " on" : ""), rot ? rot(it) : String(it));
      b.type = "button";
      b.addEventListener("click", function () {
        mapa[it] = !mapa[it];
        b.classList.toggle("on", mapa[it]);
        if (mapa === filtro.mats && typeof opcoesAssunto === "function") opcoesAssunto();
        aplicar(true);
      });
      container.appendChild(b);
    });
  }

  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function textoDe(q) {
    var t = "";
    (q.enunciado || []).forEach(function (p) { if (p.t) t += " " + p.t; });
    if (q.alts) LETRAS.forEach(function (l) { if (q.alts[l]) t += " " + q.alts[l].t; });
    return norm(t);
  }
  var indice = {};
  function textoIdx(q) { return indice[q.id] || (indice[q.id] = textoDe(q)); }

  function rng() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  function aplicar(resetPos) {
    var atualId = lista[idx] && lista[idx].id;
    var busca = norm(filtro.busca.trim());
    lista = Q.filter(function (q) {
      if (!filtro.anos[q.ano] || !filtro.mats[matDe(q)]) return false;
      if (filtro.assunto && (matDe(q) + "|" + assDe(q)) !== filtro.assunto) return false;
      if (q.lingua) {
        if (filtro.lingua === "nenhuma") return false;
        if (filtro.lingua !== "ambas" && q.lingua !== filtro.lingua) return false;
      }
      var r = respostas[q.id];
      if (filtro.status === "novas" && r) return false;
      if (filtro.status === "erradas" && !(r && !r.ok)) return false;
      if (filtro.status === "certas" && !(r && r.ok)) return false;
      if (filtro.status === "marcadas" && !marcadas[q.id]) return false;
      if (busca && textoIdx(q).indexOf(busca) < 0) return false;
      return true;
    });
    if (filtro.embaralhar) {
      var arr = lista.slice();
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      lista = arr;
    }
    if (resetPos) idx = 0;
    else {
      var k = lista.findIndex(function (q) { return q.id === atualId; });
      idx = k >= 0 ? k : Math.min(idx, Math.max(0, lista.length - 1));
    }
    $("f-resumo").textContent = lista.length + " questão(ões) no filtro atual.";
    renderPaleta();
    renderQuestao();
  }

  // ---------- paleta ----------
  function renderPaleta() {
    var p = $("paleta");
    p.textContent = "";
    var frag = document.createDocumentFragment();
    lista.forEach(function (q, i) {
      var b = el("button", "pq", String(i + 1));
      b.type = "button";
      b.title = q.ano + " · Q" + q.n;
      var st = estadoDe(q);
      if (st) b.classList.add(st);
      if (marcadas[q.id]) b.classList.add("flag");
      if (i === idx) b.classList.add("cur");
      b.addEventListener("click", function () { idx = i; renderQuestao(); renderPaletaMarca(); });
      frag.appendChild(b);
    });
    p.appendChild(frag);
  }
  function renderPaletaMarca() {
    var cs = $("paleta").children;
    for (var i = 0; i < cs.length; i++) cs[i].classList.toggle("cur", i === idx);
    if (cs[idx]) cs[idx].scrollIntoView({ block: "nearest" });
  }
  function atualizaChip() {
    var c = $("paleta").children[idx];
    var st = lista[idx] && estadoDe(lista[idx]);
    if (!c) return;
    c.classList.remove("ok", "err", "ans");
    if (st) c.classList.add(st);
  }

  // ---------- questão ----------
  function renderImgs(container, srcs) {
    (srcs || []).forEach(function (s) {
      var im = el("img");
      im.src = s; im.alt = "Figura da questão"; im.loading = "lazy";
      container.appendChild(im);
    });
  }

  function renderQuestao() {
    var box = $("questao");
    box.textContent = "";
    escolha = null;
    $("posicao").textContent = lista.length ? "Questão " + (idx + 1) + " de " + lista.length : "";
    $("prev").disabled = idx <= 0;
    $("next").disabled = idx >= lista.length - 1;

    if (!lista.length) {
      box.appendChild(el("p", "muted", "Nenhuma questão corresponde aos filtros escolhidos."));
      return;
    }
    var q = lista[idx];
    var feito = feitoDe(q);
    var encerrado = simPronto() && sim.fim;
    if (simPronto()) { sim.pos = idx; salvarSim(); atualizaBarra(); }
    var anulada = q.gabarito === "X";
    var prova = simPronto() && !sim.mostrar && !sim.fim;

    if (simPronto() && sim.pausado && !sim.fim) {
      var ps = el("div", "pausa");
      ps.appendChild(el("h3", null, "⏸ Simulado pausado"));
      ps.appendChild(el("p", "muted", "O cronômetro está parado e a questão fica oculta. Clique em Retomar para continuar."));
      var rb = el("button", "btn", "▶ Retomar"); rb.type = "button";
      rb.addEventListener("click", function () { alternaPausa(); });
      ps.appendChild(rb);
      box.appendChild(ps);
      return;
    }

    var meta = el("div", "q-meta");
    meta.appendChild(el("span", "tag n", "ENEM " + q.ano));
    meta.appendChild(el("span", "tag", "Questão " + q.n));
    meta.appendChild(el("span", "tag", matDe(q)));
    if (assDe(q) && matDe(q) !== "Inglês" && matDe(q) !== "Espanhol") meta.appendChild(el("span", "tag", assDe(q)));
    if (q.lingua && q.lingua !== matDe(q)) meta.appendChild(el("span", "tag", q.lingua));
    meta.appendChild(el("span", "tag", "Dia " + q.dia));
    box.appendChild(meta);

    if (q.apoio) {
      var ap = el("div", "apoio");
      ap.appendChild(el("b", null, q.apoio_rot || "Texto de apoio"));
      ap.appendChild(el("p", "txt", q.apoio));
      box.appendChild(ap);
    }

    if (q.imagem && q.imagem.length) {
      var qi = el("div", "q-img");
      renderImgs(qi, q.imagem);
      box.appendChild(qi);
    } else {
      var en = el("div", "enun");
      (q.enunciado || []).forEach(function (p) {
        if (p.t) en.appendChild(el("p", "txt", p.t));
        else if (p.i) { var im = el("img"); im.src = p.i; im.alt = "Figura da questão"; im.loading = "lazy"; en.appendChild(im); }
      });
      box.appendChild(en);
    }

    var altsBox;
    if (q.alts) {
      altsBox = el("ul", "alts");
      LETRAS.forEach(function (l) {
        var a = q.alts[l];
        if (!a) return;
        var li = el("li");
        var b = el("button", "alt");
        b.type = "button"; b.dataset.l = l;
        b.appendChild(el("span", "l", l));
        var tx = el("span", "tx", a.t || "");
        (a.i || []).forEach(function (s) { var im = el("img"); im.src = s; im.alt = "Alternativa " + l; tx.appendChild(im); });
        b.appendChild(tx);
        li.appendChild(b);
        altsBox.appendChild(li);
      });
    } else {
      altsBox = el("div", "simple-alts");
      LETRAS.forEach(function (l) {
        var b = el("button", "alt");
        b.type = "button"; b.dataset.l = l;
        b.appendChild(el("span", "l", l));
        altsBox.appendChild(b);
      });
    }
    box.appendChild(altsBox);

    var acoes = el("div", "acoes");
    var btn = el("button", "btn", "Responder");
    btn.type = "button"; btn.disabled = true; btn.id = "btn-responder";
    acoes.appendChild(btn);
    var fb = el("button", "ghost flag-btn", marcadas[q.id] ? "⚑ Marcada para revisar" : "⚐ Marcar para revisar");
    fb.type = "button";
    fb.addEventListener("click", function () {
      if (marcadas[q.id]) delete marcadas[q.id]; else marcadas[q.id] = true;
      salvarMarcas();
      fb.textContent = marcadas[q.id] ? "⚑ Marcada para revisar" : "⚐ Marcar para revisar";
      var c = $("paleta").children[idx];
      if (c) c.classList.toggle("flag", !!marcadas[q.id]);
    });
    acoes.appendChild(fb);
    var rp = el("button", "ghost", "⚠ Reportar erro"); rp.type = "button";
    acoes.appendChild(rp);
    box.appendChild(acoes);
    var painelRep = el("div", "reporte"); painelRep.hidden = true;
    box.appendChild(painelRep);
    rp.addEventListener("click", function () {
      if (!painelRep.hidden) { painelRep.hidden = true; return; }
      abreReporte(painelRep, q);
    });
    var out = el("div"); out.id = "saida";
    box.appendChild(out);

    if (prova) {
      btn.style.display = "none";
      acoes.insertBefore(el("span", "muted dica", "Modo prova: marque uma alternativa (clique de novo para desmarcar). O gabarito aparece depois de finalizar."), acoes.firstChild);
      var atual = sim.resp[q.id];
      Array.prototype.forEach.call(box.querySelectorAll(".alt"), function (x) { x.classList.toggle("sel", x.dataset.l === atual); });
    }

    function marcar(l) {
      if (prova) {
        if (sim.resp[q.id] === l) delete sim.resp[q.id]; else sim.resp[q.id] = l;
        salvarSim();
        Array.prototype.forEach.call(box.querySelectorAll(".alt"), function (x) { x.classList.toggle("sel", x.dataset.l === sim.resp[q.id]); });
        atualizaChip(); atualizaBarra();
        return;
      }
      escolha = l;
      Array.prototype.forEach.call(box.querySelectorAll(".alt"), function (x) { x.classList.toggle("sel", x.dataset.l === l); });
      btn.disabled = false;
    }
    Array.prototype.forEach.call(box.querySelectorAll(".alt"), function (x) {
      x.addEventListener("click", function () { if (prova || (!feitoDe(q) && !encerrado)) marcar(x.dataset.l); });
    });
    btn.addEventListener("click", function () { responder(q); });

    if (prova) { /* sem resultado até finalizar */ }
    else if (feito) mostrarResultado(q, feito.r, true);
    else if (encerrado) mostrarResultado(q, null, true);
  }

  var EMAIL_REPORTE = "matheusbrizolamontanher@gmail.com";
  // Envio automático pelo serviço FormSubmit (sem servidor próprio): POST que repassa a mensagem ao e-mail acima.
  var URL_REPORTE = "https://formsubmit.co/ajax/" + EMAIL_REPORTE;
  function abreReporte(cx, q) {
    cx.textContent = "";
    cx.hidden = false;
    cx.appendChild(el("h4", "sub", "Reportar erro nesta questão"));
    cx.appendChild(el("p", "muted", "Descreva o que está errado (enunciado, alternativas, imagem, gabarito ou explicação). O reporte é enviado automaticamente ao responsável pelo site."));
    var ta = el("textarea"); ta.rows = 5; ta.maxLength = 1500; ta.placeholder = "Ex.: a alternativa C está cortada / o gabarito parece errado porque...";
    cx.appendChild(ta);
    var status = el("p", "muted status-rep");
    var ac = el("div", "acoes");
    function corpo() {
      return "Questão: ENEM " + q.ano + " · nº " + q.n + " · id " + q.id + "\n" +
        "Matéria: " + matDe(q) + " — " + assDe(q) + "\n" +
        "Gabarito no site: " + q.gabarito + "\n\n" +
        "Descrição do erro:\n" + ta.value.trim();
    }
    var assunto = "Erro na questão " + q.id + " (ENEM " + q.ano + ", nº " + q.n + ")";
    var env = el("button", "btn", "Enviar reporte"); env.type = "button";
    var cn = el("button", "ghost", "Cancelar"); cn.type = "button";
    var cp = el("button", "ghost", "Copiar texto"); cp.type = "button"; cp.hidden = true;
    env.addEventListener("click", function () {
      if (!ta.value.trim()) { ta.focus(); status.textContent = "Escreva uma descrição antes de enviar."; return; }
      env.disabled = true; status.textContent = "Enviando…";
      var viaNuvem = window.NUVEM && window.NUVEM.enviarReporte && window.NUVEM.logado();
      (viaNuvem ? window.NUVEM.enviarReporte({ questao: q.id, ano: q.ano, numero: q.n, materia: matDe(q), assunto: assDe(q), gabarito: q.gabarito, mensagem: ta.value.trim() })
        .then(function () { return { ok: true, d: { success: "true" } }; }) :
      fetch(URL_REPORTE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ _subject: assunto, _captcha: "false", _template: "table", _honey: "",
          questao: q.id, ano: q.ano, numero: q.n, materia: matDe(q), gabarito_site: q.gabarito, mensagem: corpo() })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); }))
        .then(function (res) {
          if (res.ok && String(res.d.success) !== "false") {
            ta.hidden = true; env.hidden = true; cn.textContent = "Fechar";
            status.textContent = "✔ Reporte enviado. Obrigado por ajudar a melhorar o site!";
          } else { throw new Error(res.d.message || "falha"); }
        })
        .catch(function () {
          env.disabled = false; cp.hidden = false;
          status.textContent = "Não foi possível enviar agora (verifique a conexão e tente de novo). Se persistir, copie o texto e envie para " + EMAIL_REPORTE + ".";
        });
    });
    cp.addEventListener("click", function () {
      var txt = "Para: " + EMAIL_REPORTE + "\nAssunto: " + assunto + "\n\n" + corpo();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { cp.textContent = "Copiado!"; }, function () { cp.textContent = "Não foi possível copiar"; });
      else { ta.value = txt; ta.select(); }
    });
    cn.addEventListener("click", function () { cx.hidden = true; });
    ac.appendChild(env); ac.appendChild(cp); ac.appendChild(cn);
    cx.appendChild(ac);
    cx.appendChild(status);
    ta.focus();
  }

  function responder(q) {
    if (!escolha || feitoDe(q)) return;
    if (q.gabarito !== "X") {
      registraResposta(q.id, escolha, q.gabarito);
      salvar();
      if (simPronto()) { sim.resp[q.id] = escolha; salvarSim(); }
      atualizaChip();
      atualizaBarra();
    }
    mostrarResultado(q, escolha, false);
  }

  function mostrarResultado(q, resp, restaurado) {
    var box = $("questao");
    var btn = $("btn-responder");
    if (btn) btn.style.display = "none";
    var out = $("saida");
    out.textContent = "";
    var gab = q.gabarito;

    if (simPronto() && !sim.mostrar && !sim.fim) {
      Array.prototype.forEach.call(box.querySelectorAll(".alt"), function (x) {
        x.disabled = true;
        x.classList.toggle("sel", x.dataset.l === resp);
      });
      out.appendChild(el("div", "resultado", "Resposta registrada: " + resp + ". O gabarito e as explicações aparecem quando você finalizar o simulado."));
      return;
    }

    Array.prototype.forEach.call(box.querySelectorAll(".alt"), function (x) {
      x.disabled = true;
      x.classList.remove("sel");
      if (gab !== "X") {
        if (x.dataset.l === gab) x.classList.add("certa");
        else if (x.dataset.l === resp) x.classList.add("errada");
      }
    });

    if (gab === "X") {
      out.appendChild(el("div", "resultado anulada", "Esta questão foi anulada pelo INEP e não conta no seu desempenho."));
      return;
    }
    var ok = resp === gab;
    out.appendChild(el("div", "resultado " + (ok ? "ok" : "err"),
      !resp ? "Não respondida. A resposta correta é " + gab + "." :
      ok ? "Correto! A resposta é " + gab + "." : "Você marcou " + resp + ". A resposta correta é " + gab + "."));

    var e = EXP[q.id];
    var ex = el("div", "explic");
    if (e && e.certa) {
      ex.appendChild(el("h3", null, "Por que a alternativa " + gab + " está certa"));
      var c = el("div", "bloco c");
      c.appendChild(el("p", null, e.certa));
      ex.appendChild(c);
      var erradas = e.erradas || {};
      var ls = LETRAS.filter(function (l) { return l !== gab && erradas[l]; });
      if (ls.length) {
        ex.appendChild(el("h3", null, "Por que as outras estão erradas"));
        ls.forEach(function (l) {
          var d = el("div", "bloco e");
          d.appendChild(el("b", null, "Alternativa " + l));
          d.appendChild(el("p", null, erradas[l]));
          ex.appendChild(d);
        });
      }
    } else {
      ex.appendChild(el("div", "sem-explic", "A explicação desta questão ainda não foi gerada."));
    }
    out.appendChild(ex);
    if (!restaurado) out.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ---------- desempenho ----------
  function renderStats() {
    var p = $("painel-stats");
    p.textContent = "";
    var ids = Object.keys(respostas);
    var por = { total: { n: 0, ok: 0 }, area: {}, ano: {}, mat: {}, ass: {} };
    var byId = {};
    Q.forEach(function (q) { byId[q.id] = q; });
    ids.forEach(function (id) {
      var q = byId[id]; if (!q) return;
      var r = respostas[id];
      var chaveAss = matDe(q) + " — " + assDe(q);
      [["total", "total"], ["area", q.area], ["ano", q.ano], ["mat", matDe(q)], ["ass", chaveAss]].forEach(function (par) {
        var o = par[0] === "total" ? por.total : (por[par[0]][par[1]] = por[par[0]][par[1]] || { n: 0, ok: 0 });
        o.n++; if (r.ok) o.ok++;
      });
    });
    var grid = el("div", "stats-grid");
    function stat(v, rot) { var s = el("div", "stat"); s.appendChild(el("b", null, v)); s.appendChild(el("span", null, rot)); grid.appendChild(s); }
    stat(String(por.total.n), "questões respondidas");
    stat(por.total.n ? Math.round(100 * por.total.ok / por.total.n) + "%" : "–", "taxa de acerto");
    stat(String(por.total.ok), "acertos");
    stat(String(por.total.n - por.total.ok), "erros");
    p.appendChild(grid);

    function bloco(titulo, chaves, mapa) {
      var c = el("div", "card");
      c.appendChild(el("h3", null, titulo));
      chaves.forEach(function (k) {
        var o = mapa[k] || { n: 0, ok: 0 };
        var l = el("div", "barra-l");
        l.appendChild(el("span", null, String(k)));
        var b = el("div", "barra"); var i = el("i"); i.style.width = (o.n ? 100 * o.ok / o.n : 0) + "%"; b.appendChild(i);
        l.appendChild(b);
        l.appendChild(el("span", "muted", o.n ? o.ok + "/" + o.n + " (" + Math.round(100 * o.ok / o.n) + "%)" : "sem dados"));
        c.appendChild(l);
      });
      p.appendChild(c);
    }
    bloco("Por matéria", MATS.filter(function (m) { return por.mat[m]; }), por.mat);
    bloco("Por ano", anos, por.ano);
    var fracos = Object.keys(por.ass).filter(function (k) { return por.ass[k].n >= 2; })
      .sort(function (a, b) { return por.ass[a].ok / por.ass[a].n - por.ass[b].ok / por.ass[b].n || por.ass[b].n - por.ass[a].n; })
      .slice(0, 8);
    if (fracos.length) bloco("Assuntos para reforçar (menor acerto, mín. 2 respostas)", fracos, por.ass);
    if (hist.length) {
      var ev = el("div", "card");
      ev.appendChild(el("h3", null, "Evolução nos simulados"));
      hist.slice(0, 12).reverse().forEach(function (h) {
        var ac = 0; h.ids.forEach(function (id) { if (h.resp[id] && porId[id] && h.resp[id] === porId[id].gabarito) ac++; });
        var l = el("div", "barra-l");
        l.appendChild(el("span", null, h.nome.slice(0, 14)));
        var b = el("div", "barra"), i = el("i"); i.style.width = (100 * ac / h.ids.length) + "%"; b.appendChild(i);
        l.appendChild(b);
        l.appendChild(el("span", "muted", Math.round(100 * ac / h.ids.length) + "%"));
        ev.appendChild(l);
      });
      p.appendChild(ev);
    }

  }

  // ---------- navegação ----------
  function ir(d) {
    var n = idx + d;
    if (n < 0 || n >= lista.length) return;
    idx = n; renderQuestao(); renderPaletaMarca();
    window.scrollTo({ top: 0 });
  }
  function aba(qual) {
    // qual: "simulado" (início), "simq" (questões do simulado), "praticar", "stats"
    emSim = qual === "simq" && !!sim;
    if (qual === "simq" && !sim) qual = "simulado";
    $("painel-simulado").hidden = qual !== "simulado";
    $("painel-praticar").hidden = !(qual === "praticar" || qual === "simq");
    $("painel-stats").hidden = qual !== "stats";
    $("painel-alunos").hidden = qual !== "alunos";
    $("painel-redacao").hidden = qual !== "redacao";
    $("filtros").style.display = qual === "praticar" ? "" : "none";
    $("sim-bar").hidden = !emSim;
    $("tab-simulado").classList.toggle("on", qual === "simulado" || qual === "simq");
    $("tab-stats").classList.toggle("on", qual === "stats");
    $("tab-alunos").classList.toggle("on", qual === "alunos");
    $("tab-redacao").classList.toggle("on", qual === "redacao");
    if (qual === "stats") renderStats();
    else if (qual === "redacao") { if (window.NUVEM_REDACAO) window.NUVEM_REDACAO.render($("painel-redacao")); }
    else if (qual === "alunos") { if (window.NUVEM) window.NUVEM.renderAlunos($("painel-alunos")); }
    else if (qual === "simulado") renderInicio();
    else if (qual === "praticar") aplicar(true);
    else if (qual === "simq") {
      lista = sim.ids.map(function (id) { return porId[id]; }).filter(Boolean);
      idx = Math.min(sim.pos || 0, Math.max(0, lista.length - 1));
      renderPaleta();
      $("paleta").style.visibility = sim.pausado && !sim.fim ? "hidden" : "";
      renderQuestao();
      renderPaletaMarca();
    }
  }

  // ---------- simulado ----------
  var cfg = { nome: "", anos: {}, mats: {}, ass: {}, n: 20, minq: 0, mostrar: true, novas: false, erradas: false, marcadas: false, igual: true };
  anos.forEach(function (a) { cfg.anos[a] = true; });
  MATS.forEach(function (m) { cfg.mats[m] = m !== "Espanhol"; });

  function reservatorio() {
    var temAss = Object.keys(cfg.ass).some(function (k) { return cfg.ass[k]; });
    return Q.filter(function (q) {
      var m = matDe(q);
      if (!cfg.anos[q.ano] || !cfg.mats[m] || q.gabarito === "X") return false;
      if (temAss && !cfg.ass[m + "|" + assDe(q)]) return false;
      var r = respostas[q.id];
      if (cfg.novas && r) return false;
      if (cfg.erradas && !(r && !r.ok)) return false;
      if (cfg.marcadas && !marcadas[q.id]) return false;
      return true;
    });
  }
  function embaralhar(arr) {
    arr = arr.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function sortear(pool, n) {
    if (!cfg.igual) return embaralhar(pool).slice(0, n);
    var grupos = MATS.filter(function (m) { return cfg.mats[m]; }).map(function (m) {
      return embaralhar(pool.filter(function (q) { return matDe(q) === m; }));
    }).filter(function (g) { return g.length; });
    var out = [];
    while (out.length < n && grupos.some(function (g) { return g.length; })) {
      for (var k = 0; k < grupos.length && out.length < n; k++) if (grupos[k].length) out.push(grupos[k].shift());
    }
    return embaralhar(out);
  }
  function fmtData(t) { try { return new Date(t).toLocaleDateString("pt-BR"); } catch (e) { return ""; } }
  function fmtTempo(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    function d(n) { return (n < 10 ? "0" : "") + n; }
    return (h ? h + ":" + d(m) : m) + ":" + d(x);
  }

  function novoSim(nome, ids, opc) {
    return { uid: Date.now() + Math.floor(Math.random() * 1000), nome: nome, criado: Date.now(), ids: ids, resp: {}, mostrar: opc.mostrar,
      fim: false, pos: 0, decorrido: 0, tempos: {}, limite: opc.limite || 0, cron: true, mats: opc.mats || [] };
  }
  function abrir(s) {
    sim = s; verRes = null;
    aba("simq");
    window.scrollTo({ top: 0 });
  }

  function alternaPausa() {
    if (!simPronto() || sim.fim) return;
    sim.pausado = !sim.pausado;
    salvarSim();
    $("paleta").style.visibility = sim.pausado ? "hidden" : "";
    $("prev").disabled = $("next").disabled = !!sim.pausado || false;
    renderQuestao();
    if (!sim.pausado) { $("prev").disabled = idx <= 0; $("next").disabled = idx >= lista.length - 1; }
    atualizaBarra();
  }

  function finalizar() {
    if (!sim || sim.fim) return;
    sim.fim = true; sim.fimEm = Date.now(); sim.hid = sim.fimEm; sim.pausado = false;
    if (!sim.mostrar) {  // modo prova: as respostas só entram no desempenho agora
      Object.keys(sim.resp).forEach(function (id) {
        if (porId[id]) registraResposta(id, sim.resp[id], porId[id].gabarito);
      });
      salvar();
    }
    novos = novos.filter(function (n) { return n !== sim; });
    salvarNovos();
    hist.unshift(sim); salvarHist();
    verRes = sim;
    if (sim.turma && window.NUVEM && window.NUVEM.enviarResultado) window.NUVEM.enviarResultado(sim, pct(sim));
    aba("simulado");
    window.scrollTo({ top: 0 });
  }

  function atualizaBarra() {
    if (!simPronto()) return;
    $("sim-nome").textContent = sim.nome;
    var n = Object.keys(sim.resp).length;
    var t = "";
    if (!sim.fim && sim.limite) t = " · ⏱ " + fmtTempo(sim.limite - (sim.decorrido || 0)) + " restantes";
    else if (!sim.fim && sim.cron) t = " · ⏱ " + fmtTempo(sim.decorrido || 0);
    $("sim-prog").textContent = sim.fim ? "· finalizado" : "· " + n + " de " + sim.ids.length + " respondidas" + t + (sim.pausado ? " · ⏸ pausado" : "");
    $("sim-fim").hidden = !!sim.fim;
    $("sim-pausa").hidden = !!sim.fim;
    $("sim-pausa").textContent = sim.pausado ? "▶ Retomar" : "⏸ Pausar";
  }

  // cronômetro: conta só com o simulado aberto e a aba visível
  setInterval(function () {
    if (!simPronto() || sim.fim || sim.pausado || document.hidden) return;
    sim.decorrido = (sim.decorrido || 0) + 1;
    var q = lista[idx];
    if (q) { sim.tempos = sim.tempos || {}; sim.tempos[q.id] = (sim.tempos[q.id] || 0) + 1; }
    if (sim.decorrido % 5 === 0) salvarSim();
    atualizaBarra();
    if (sim.limite && sim.decorrido >= sim.limite) {
      salvarSim();
      alert("O tempo acabou. O simulado será finalizado.");
      finalizar();
    }
  }, 1000);

  function resultado(card, s) {
    var tot = s.ids.length, ac = 0, resp = 0, porMat = {}, porAss = {};
    s.ids.forEach(function (id) {
      var q = porId[id]; if (!q) return;
      var m = matDe(q), a = matDe(q) + " — " + assDe(q);
      var o = porMat[m] = porMat[m] || { n: 0, ok: 0 };
      var oa = porAss[a] = porAss[a] || { n: 0, ok: 0, err: 0 };
      o.n++; oa.n++;
      var r = s.resp[id];
      if (r) { resp++; if (r === q.gabarito) { ac++; o.ok++; oa.ok++; } else oa.err++; } else oa.err++;
    });
    var tempo = s.decorrido ? " · tempo " + fmtTempo(s.decorrido) + " (média " + fmtTempo(s.decorrido / tot) + " por questão)" : "";
    card.appendChild(el("p", "muted", Math.round(100 * ac / tot) + "% de acerto · " + resp + " respondidas · " + (tot - resp) + " em branco" + tempo));
    MATS.forEach(function (m) {
      var o = porMat[m]; if (!o) return;
      var l = el("div", "barra-l");
      l.appendChild(el("span", null, m));
      var b = el("div", "barra"), i = el("i"); i.style.width = (100 * o.ok / o.n) + "%"; b.appendChild(i);
      l.appendChild(b);
      l.appendChild(el("span", "muted", o.ok + "/" + o.n));
      card.appendChild(l);
    });
    var rev = Object.keys(porAss).filter(function (k) { return porAss[k].err > 0; })
      .sort(function (a, b) { return porAss[b].err - porAss[a].err; }).slice(0, 5);
    if (rev.length) {
      card.appendChild(el("h4", "sub", "Para revisar"));
      rev.forEach(function (k) { card.appendChild(el("p", "muted linha", k + ": " + porAss[k].err + " erro(s)/em branco")); });
    }
    var lr = el("div", "lista-res");
    s.ids.forEach(function (id, i) {
      var q = porId[id]; if (!q) return;
      var t = s.tempos && s.tempos[id] ? " · " + fmtTempo(s.tempos[id]) : "";
      var b = el("button", "pq " + (s.resp[id] ? (s.resp[id] === q.gabarito ? "ok" : "err") : ""), String(i + 1));
      b.type = "button"; b.title = q.ano + " · Q" + q.n + t;
      b.addEventListener("click", function () { sim = s; sim.pos = i; salvarSim(); aba("simq"); });
      lr.appendChild(b);
    });
    card.appendChild(lr);
  }

  function refazerErradas(s) {
    var ids = s.ids.filter(function (id) { return porId[id] && s.resp[id] !== porId[id].gabarito; });
    if (!ids.length) return;
    var n = novoSim("Revisão: " + s.nome, embaralhar(ids), { mostrar: true, limite: 0 });
    novos.push(n); salvarNovos();
    abrir(n);
  }

  function pct(h) {
    var ac = 0; h.ids.forEach(function (id) { if (h.resp[id] && porId[id] && h.resp[id] === porId[id].gabarito) ac++; });
    return { ac: ac, p: Math.round(100 * ac / h.ids.length) };
  }
  function evolucao(card, s) {
    card.appendChild(el("h4", "sub", "Evolução em relação aos simulados anteriores"));
    var atual = pct(s).p;
    var prev = hist.filter(function (h) { return h !== s && h.hid < (s.hid || Infinity); });
    if (!prev.length) { card.appendChild(el("p", "muted", "Este é o seu primeiro simulado concluído. A comparação aparece a partir do próximo.")); return; }
    function delta(rot, ref) {
      var d = atual - ref;
      var linha = el("p", "linha");
      linha.appendChild(document.createTextNode(rot + ": " + ref + "% → "));
      linha.appendChild(el("b", d > 0 ? "up" : d < 0 ? "down" : "", (d > 0 ? "+" : "") + d + " ponto(s) percentual(is)"));
      card.appendChild(linha);
    }
    delta("Último simulado (" + prev[0].nome + ")", pct(prev[0]).p);
    var media = Math.round(prev.reduce(function (a, h) { return a + pct(h).p; }, 0) / prev.length);
    delta(prev.length === 1 ? "Média dos anteriores" : "Média dos " + prev.length + " anteriores", media);
    var ch = el("div", "evo");
    prev.slice(0, 8).reverse().concat([s]).forEach(function (h) {
      var col = el("div", "evo-c" + (h === s ? " atual" : ""));
      var v = pct(h).p;
      var bar = el("i"); bar.style.height = Math.max(3, v) + "%";
      col.appendChild(bar);
      col.appendChild(el("span", null, v + "%"));
      col.title = h.nome;
      ch.appendChild(col);
    });
    card.appendChild(ch);
  }

  function renderInicio() {
    var p = $("painel-simulado");
    p.textContent = "";

    if (verRes) {
      var rc = el("div", "card");
      rc.appendChild(el("h3", null, verRes.nome));
      rc.appendChild(el("p", "muted", "Realizado em " + fmtData(verRes.criado) + " · " + verRes.ids.length + " questões"));
      var pr = pct(verRes);
      var big = el("div", "grande");
      var b0 = el("div", "stat"); b0.appendChild(el("b", null, pr.ac + " / " + verRes.ids.length)); b0.appendChild(el("span", null, "acertos")); big.appendChild(b0);
      var b00 = el("div", "stat"); b00.appendChild(el("b", null, pr.p + "%")); b00.appendChild(el("span", null, "de aproveitamento")); big.appendChild(b00);
      rc.appendChild(big);
      evolucao(rc, verRes);
      resultado(rc, verRes);
      var ra = el("div", "acoes");
      var b1 = el("button", "btn", "Criar outro simulado"); b1.type = "button";
      b1.addEventListener("click", function () {
        verRes = null; criando = true; cfg.nome = ""; renderInicio(); window.scrollTo({ top: 0 });
        var nm = $("s-nome"); if (nm) nm.focus();
      });
      ra.appendChild(b1);
      var bp = el("button", "ghost", "Exportar PDF"); bp.type = "button";
      bp.addEventListener("click", function () { window.print(); });
      ra.appendChild(bp);
      var b3 = el("button", "ghost", "Ir à página inicial"); b3.type = "button";
      b3.addEventListener("click", function () { verRes = null; renderInicio(); window.scrollTo({ top: 0 }); });
      ra.appendChild(b3);
      var b2 = el("button", "ghost", "Revisar questões e explicações"); b2.type = "button";
      b2.addEventListener("click", function () { abrir(verRes); });
      ra.appendChild(b2);
      var nErr = verRes.ids.filter(function (id) { return porId[id] && verRes.resp[id] !== porId[id].gabarito; }).length;
      if (nErr) {
        var b4 = el("button", "ghost", "Refazer só as " + nErr + " que errei"); b4.type = "button";
        b4.addEventListener("click", function () { refazerErradas(verRes); });
        ra.appendChild(b4);
      }
      rc.appendChild(ra);
      p.appendChild(rc);
      return;
    }

    if (!criando) { renderResumo(p); return; }

    var f = el("div", "card form-sim");
    var topo = el("div", "form-topo");
    topo.appendChild(el("h3", null, "Novo simulado"));
    var vb = el("button", "ghost mini", "← Voltar ao início"); vb.type = "button";
    vb.addEventListener("click", function () { criando = false; renderInicio(); window.scrollTo({ top: 0 }); });
    topo.appendChild(vb);
    f.appendChild(topo);

    var l1 = el("label", "l", "Nome do simulado"); l1.htmlFor = "s-nome"; f.appendChild(l1);
    var nome = el("input"); nome.type = "text"; nome.id = "s-nome"; nome.maxLength = 60;
    nome.placeholder = "ex.: Simulado de sábado"; nome.value = cfg.nome;
    nome.addEventListener("input", function () { cfg.nome = nome.value; });
    f.appendChild(nome);

    f.appendChild(el("label", "l", "Anos das questões"));
    var ca = el("div", "chips"); f.appendChild(ca);

    f.appendChild(el("label", "l", "Matérias"));
    var gm = el("div"); f.appendChild(gm);
    var det = el("details", "det");
    det.appendChild(el("summary", null, "Filtrar por assunto (opcional)"));
    var ass = el("div", "chips"); det.appendChild(ass);
    f.appendChild(det);

    var disp = el("p", "muted disp");
    var iq = el("input"); iq.type = "number"; iq.id = "s-n"; iq.min = 1; iq.value = cfg.n;
    var go;

    function chipsSim(cont, itens, mapa, rot, depois) {
      cont.textContent = "";
      itens.forEach(function (it) {
        var b = el("button", "chip" + (mapa[it] ? " on" : ""), rot ? rot(it) : String(it));
        b.type = "button";
        b.addEventListener("click", function () { mapa[it] = !mapa[it]; b.classList.toggle("on", mapa[it]); if (depois) depois(); refresca(); });
        cont.appendChild(b);
      });
    }
    function desenhaAssuntos() {
      var itens = [];
      MATS.forEach(function (m) {
        if (!cfg.mats[m] || m === "Inglês" || m === "Espanhol") return;
        assuntosDe(m).forEach(function (a) { if (a) itens.push(m + "|" + a); });
      });
      Object.keys(cfg.ass).forEach(function (k) { if (itens.indexOf(k) < 0) delete cfg.ass[k]; });
      chipsSim(ass, itens, cfg.ass, function (k) { return k.replace("|", " — "); });
    }
    function desenhaMats() {
      gm.textContent = "";
      GRUPOS.forEach(function (g) {
        var linha = el("div", "grupo-mat");
        var tg = el("button", "ghost mini", g[0]); tg.type = "button";
        tg.title = "Marcar/desmarcar todas de " + g[0];
        tg.addEventListener("click", function () {
          var todas = g[1].every(function (m) { return cfg.mats[m]; });
          g[1].forEach(function (m) { cfg.mats[m] = !todas; });
          desenhaMats(); desenhaAssuntos(); refresca();
        });
        linha.appendChild(tg);
        var cs = el("div", "chips");
        chipsSim(cs, g[1], cfg.mats, null, desenhaAssuntos);
        linha.appendChild(cs);
        gm.appendChild(linha);
      });
    }
    chipsSim(ca, anos, cfg.anos);
    desenhaMats(); desenhaAssuntos();

    var ln = el("label", "l", "Quantidade de questões"); ln.htmlFor = "s-n"; f.appendChild(ln);
    iq.addEventListener("input", function () { cfg.n = parseInt(iq.value, 10) || 1; });
    f.appendChild(iq);
    f.appendChild(disp);

    var lt = el("label", "l", "Tempo por questão (cronômetro)"); lt.htmlFor = "s-t"; f.appendChild(lt);
    var st = el("select"); st.id = "s-t";
    [[0, "Sem limite (só cronometrar)"], [1, "1 minuto por questão"], [2, "2 minutos por questão"], [3, "3 minutos por questão"], [4, "4 minutos por questão"], [5, "5 minutos por questão"]].forEach(function (x) {
      var o = el("option", null, x[1]); o.value = x[0]; st.appendChild(o);
    });
    st.value = cfg.minq;
    st.addEventListener("change", function () { cfg.minq = parseInt(st.value, 10) || 0; });
    f.appendChild(st);

    function check(txt, chave) {
      var lb = el("label", "check"); var cx = el("input"); cx.type = "checkbox"; cx.checked = cfg[chave];
      cx.addEventListener("change", function () { cfg[chave] = cx.checked; refresca(); });
      lb.appendChild(cx); lb.appendChild(document.createTextNode(" " + txt));
      f.appendChild(lb);
    }
    check("Distribuir igualmente entre as matérias escolhidas", "igual");
    check("Só questões que ainda não respondi", "novas");
    check("Só questões que errei antes (caderno de erros)", "erradas");
    check("Só questões que marquei para revisar", "marcadas");
    var lm = el("label", "l", "Modo de correção"); lm.htmlFor = "s-modo"; f.appendChild(lm);
    var sm = el("select"); sm.id = "s-modo";
    [["imediato", "Ver gabarito e explicação logo após responder cada questão"],
     ["prova", "Modo prova: marcar todas as questões, finalizar e só depois ver gabarito e explicações (em Revisar questões)"]].forEach(function (x) {
      var o = el("option", null, x[1]); o.value = x[0]; sm.appendChild(o);
    });
    sm.value = cfg.mostrar ? "imediato" : "prova";
    sm.addEventListener("change", function () { cfg.mostrar = sm.value === "imediato"; });
    f.appendChild(sm);

    function refresca() {
      var n = reservatorio().length;
      iq.max = Math.max(1, n);
      disp.textContent = n + " questão(ões) disponível(is) com essas escolhas.";
      if (go) go.disabled = n === 0;
    }

    var turmas = (window.NUVEM && window.NUVEM.turmasAdmin) ? window.NUVEM.turmasAdmin() : [];
    if (turmas.length) {
      var lt2 = el("label", "l", "Enviar para uma turma (administrador)"); lt2.htmlFor = "s-turma"; f.appendChild(lt2);
      var stu = el("select"); stu.id = "s-turma";
      var o0 = el("option", null, "Não, só para mim"); o0.value = ""; stu.appendChild(o0);
      turmas.forEach(function (t) { var o = el("option", null, "Turma: " + t.nome); o.value = t.id; stu.appendChild(o); });
      stu.value = cfg.turma || "";
      stu.addEventListener("change", function () { cfg.turma = stu.value; });
      f.appendChild(stu);
    }
    var ac2 = el("div", "acoes");
    go = el("button", "btn", "Criar simulado"); go.type = "button";
    go.addEventListener("click", function () {
      var pool = reservatorio();
      if (!pool.length) { alert("Nenhuma questão com essas escolhas."); return; }
      var n = Math.max(1, Math.min(cfg.n || 1, pool.length));
      var ids = sortear(pool, n).map(function (q) { return q.id; });
      var mats = MATS.filter(function (m) { return ids.some(function (id) { return matDe(porId[id]) === m; }); });
      var nomeSim = cfg.nome.trim() || "Simulado " + (novos.length + hist.length + 1);
      var limiteSim = cfg.minq * 60 * ids.length;
      if (cfg.turma && window.NUVEM && window.NUVEM.publicarTurma) {
        go.disabled = true;
        window.NUVEM.publicarTurma(cfg.turma, { nome: nomeSim, ids: ids, mostrar: cfg.mostrar, limite: limiteSim }).then(function () {
          alert("Simulado enviado para a turma. Os alunos o verão na página inicial.");
          cfg.nome = ""; cfg.turma = ""; criando = false; renderInicio(); window.scrollTo({ top: 0 });
        }).catch(function () { go.disabled = false; alert("Não foi possível enviar para a turma. Tente de novo."); });
        return;
      }
      var novo = novoSim(nomeSim, ids, { mostrar: cfg.mostrar, limite: limiteSim, mats: mats });
      novos.push(novo); salvarNovos();
      cfg.nome = "";
      criando = false;
      renderInicio();
      window.scrollTo({ top: 0 });
    });
    ac2.appendChild(go);
    f.appendChild(ac2);
    p.appendChild(f);
    refresca();

  }

  function renderResumo(p) {
    var topo = el("div", "resumo-topo");
    var tt = el("div");
    tt.appendChild(el("h2", "resumo-titulo", "Seus simulados"));
    tt.appendChild(el("p", "muted", "Continue de onde parou ou crie um novo simulado."));
    topo.appendChild(tt);
    var bn = el("button", "btn", "+ Criar novo simulado"); bn.type = "button";
    bn.addEventListener("click", function () { criando = true; renderInicio(); window.scrollTo({ top: 0 }); });
    topo.appendChild(bn);
    p.appendChild(topo);

    // desempenho curto
    var n = 0, ok = 0;
    Object.keys(respostas).forEach(function (id) { if (porId[id]) { n++; if (respostas[id].ok) ok++; } });
    var grid = el("div", "stats-grid");
    function stat(v, rot) { var d = el("div", "stat"); d.appendChild(el("b", null, v)); d.appendChild(el("span", null, rot)); grid.appendChild(d); }
    stat(String(n), "questões respondidas");
    stat(n ? Math.round(100 * ok / n) + "%" : "–", "taxa de acerto");
    stat(String(hist.length), "simulados concluídos");
    stat(hist.length ? pct(hist[0]).p + "%" : "–", "último simulado");
    p.appendChild(grid);
    var vd = el("button", "ghost mini", "Ver desempenho completo"); vd.type = "button";
    vd.addEventListener("click", function () { aba("stats"); });
    p.appendChild(vd);

    // meta diária e sequência
    var hoje = prefs.atv[diaStr(Date.now())] || 0, meta = prefs.meta || 10;
    var cm = el("div", "card meta");
    var lm = el("div", "meta-topo");
    lm.appendChild(el("b", null, "Meta de hoje: " + hoje + " / " + meta + " questões"));
    lm.appendChild(el("span", "seq", "🔥 " + sequencia() + (sequencia() === 1 ? " dia seguido" : " dias seguidos")));
    cm.appendChild(lm);
    var bm = el("div", "barra"), im = el("i"); im.style.width = Math.min(100, 100 * hoje / meta) + "%"; bm.appendChild(im); cm.appendChild(bm);
    var am = el("button", "link", "Alterar meta diária"); am.type = "button"; am.style.marginTop = "8px";
    am.addEventListener("click", function () {
      var v = parseInt(prompt("Quantas questões por dia você quer resolver?", String(meta)), 10);
      if (v > 0 && v <= 500) { prefs.meta = v; salvarPrefs(); renderInicio(); }
    });
    cm.appendChild(am);
    p.appendChild(cm);

    // revisão do dia (repetição espaçada)
    var dev = devidas();
    var cr = el("div", "card");
    cr.appendChild(el("h3", null, "Revisão do dia"));
    if (!dev.length) cr.appendChild(el("p", "muted", "Nada para revisar hoje. Questões que você erra voltam depois de 1 dia; as que acerta, em 3, 7, 14 e 30 dias."));
    else {
      cr.appendChild(el("p", null, dev.length + " questão(ões) estão no ponto de ser revistas (erradas ou já passou o intervalo)."));
      var br = el("button", "btn", "Revisar agora (" + Math.min(dev.length, 15) + " questões)"); br.type = "button";
      br.addEventListener("click", function () {
        var n2 = novoSim("Revisão do dia " + fmtData(Date.now()), dev.slice(0, 15), { mostrar: true, limite: 0 });
        novos.push(n2); salvarNovos(); abrir(n2);
      });
      cr.appendChild(br);
    }
    p.appendChild(cr);

    // simulados enviados pelo professor (turmas)
    if (window.NUVEM && window.NUVEM.simuladosTurma) {
      var ct = el("div", "card"); ct.hidden = true;
      p.appendChild(ct);
      window.NUVEM.simuladosTurma().then(function (lst) {
        var pend = lst.filter(function (x) { return !x.feito; });
        if (!lst.length) return;
        ct.hidden = false;
        ct.appendChild(el("h3", null, "Simulados da turma"));
        if (!pend.length) ct.appendChild(el("p", "muted", "Você já fez todos os simulados enviados."));
        pend.forEach(function (x) {
          var row = el("div", "hist-row novo");
          var info = el("div"); info.appendChild(el("b", null, x.nome));
          info.appendChild(el("div", "muted", x.turmaNome + " · " + x.ids.length + " questões" + (x.limite ? " · " + fmtTempo(x.limite) + " de prova" : "")));
          row.appendChild(info);
          var bs = el("button", "btn mini", "Começar"); bs.type = "button";
          bs.addEventListener("click", function () {
            var ja = novos.filter(function (n) { return n.turma && n.turma.s === x.sid && n.turma.t === x.turmaId; })[0];
            if (!ja) {
              ja = novoSim(x.nome, x.ids, { mostrar: x.mostrar, limite: x.limite });
              ja.turma = { t: x.turmaId, s: x.sid, tn: x.turmaNome };
              novos.push(ja); salvarNovos();
            }
            abrir(ja);
          });
          row.appendChild(bs); row.appendChild(el("span"));
          ct.appendChild(row);
        });
      }).catch(function () {});
    }

    var nv = el("div", "card"); nv.id = "lista-novos";
    nv.appendChild(el("h3", null, "Simulados novos e em andamento"));
    if (!novos.length) nv.appendChild(el("p", "muted", "Nenhum simulado criado ainda. Clique em “Criar novo simulado”."));
    novos.slice().reverse().forEach(function (s) {
      var row = el("div", "hist-row novo");
      var info = el("div");
      info.appendChild(el("b", null, s.nome));
      var feitas = Object.keys(s.resp).length;
      info.appendChild(el("div", "muted", s.ids.length + " questões" + (s.mats && s.mats.length ? " · " + s.mats.slice(0, 4).join(", ") + (s.mats.length > 4 ? "…" : "") : "") +
        (s.limite ? " · " + fmtTempo(s.limite) + " de prova" : "") + (feitas ? " · em andamento (" + feitas + " respondidas)" : "")));
      row.appendChild(info);
      var bs = el("button", "btn mini", feitas ? "Continuar" : "Começar"); bs.type = "button";
      bs.addEventListener("click", function () { abrir(s); });
      row.appendChild(bs);
      var bx = el("button", "ghost mini", "Excluir"); bx.type = "button";
      bx.addEventListener("click", function () {
        if (!confirm("Excluir este simulado?")) return;
        novos = novos.filter(function (n) { return n !== s; }); salvarNovos(); renderInicio();
      });
      row.appendChild(bx);
      nv.appendChild(row);
    });
    p.appendChild(nv);

    if (hist.length) {
      var h = el("div", "card");
      h.appendChild(el("h3", null, "Últimos simulados concluídos"));
      hist.slice(0, 5).forEach(function (s, i) {
        var ac3 = 0; s.ids.forEach(function (id) { if (s.resp[id] && porId[id] && s.resp[id] === porId[id].gabarito) ac3++; });
        var row = el("div", "hist-row");
        var info = el("div");
        info.appendChild(el("b", null, s.nome));
        info.appendChild(el("div", "muted", fmtData(s.criado) + " · " + ac3 + "/" + s.ids.length + " (" + Math.round(100 * ac3 / s.ids.length) + "%)" + (s.decorrido ? " · " + fmtTempo(s.decorrido) : "")));
        row.appendChild(info);
        var bar = el("div", "barra"), bi = el("i"); bi.style.width = (100 * ac3 / s.ids.length) + "%"; bar.appendChild(bi);
        row.appendChild(bar);
        var bv = el("button", "ghost mini", "Ver"); bv.type = "button";
        bv.addEventListener("click", function () { verRes = s; renderInicio(); window.scrollTo({ top: 0 }); });
        row.appendChild(bv);
        var bx = el("button", "ghost mini", "Excluir"); bx.type = "button";
        bx.addEventListener("click", function () {
          if (!confirm("Excluir este simulado do histórico?")) return;
          hist.splice(i, 1); salvarHist(); renderInicio();
        });
        row.appendChild(bx);
        h.appendChild(row);
      });
      p.appendChild(h);
    }
  }

  // ---------- init ----------
  chips($("f-anos"), anos, filtro.anos);
  chips($("f-mats"), MATS, filtro.mats);
  function opcoesAssunto() {
    var sel = $("f-assunto"); sel.textContent = "";
    var o0 = el("option", null, "Todos os assuntos"); o0.value = ""; sel.appendChild(o0);
    MATS.forEach(function (m) {
      if (!filtro.mats[m]) return;
      var ass = assuntosDe(m).filter(function (a) { return a; });
      if (!ass.length) return;
      var g = el("optgroup"); g.label = m;
      ass.forEach(function (a) { var o = el("option", null, a); o.value = m + "|" + a; g.appendChild(o); });
      sel.appendChild(g);
    });
    if (!Array.prototype.some.call(sel.options, function (o) { return o.value === filtro.assunto; })) filtro.assunto = "";
    sel.value = filtro.assunto;
  }
  opcoesAssunto();
  $("f-assunto").addEventListener("change", function (e) { filtro.assunto = e.target.value; aplicar(true); });
  $("f-status").addEventListener("change", function (e) { filtro.status = e.target.value; aplicar(true); });
  $("f-lingua").addEventListener("change", function (e) { filtro.lingua = e.target.value; aplicar(true); });
  var tb;
  $("f-busca").addEventListener("input", function (e) {
    clearTimeout(tb); tb = setTimeout(function () { filtro.busca = e.target.value; aplicar(true); }, 250);
  });
  $("f-embaralhar").addEventListener("change", function (e) { filtro.embaralhar = e.target.checked; seed = (Date.now() % 100000) + 1; aplicar(true); });
  $("f-limpar").addEventListener("click", function () {
    anos.forEach(function (a) { filtro.anos[a] = true; });
    MATS.forEach(function (m) { filtro.mats[m] = true; });
    filtro.assunto = "";
    filtro.status = "todas"; filtro.lingua = "ambas"; filtro.busca = ""; filtro.embaralhar = false;
    $("f-status").value = "todas"; $("f-lingua").value = "ambas"; $("f-busca").value = ""; $("f-embaralhar").checked = false;
    chips($("f-anos"), anos, filtro.anos); chips($("f-mats"), MATS, filtro.mats);
    opcoesAssunto();
    aplicar(true);
  });
  $("prev").addEventListener("click", function () { ir(-1); });
  $("next").addEventListener("click", function () { ir(1); });
  $("tab-simulado").addEventListener("click", function () { verRes = null; criando = false; aba("simulado"); });
  $("sim-sair").addEventListener("click", function () { verRes = sim && sim.fim ? sim : null; aba("simulado"); });
  $("sim-pausa").addEventListener("click", alternaPausa);
  $("sim-fim").addEventListener("click", function () {
    if (!sim || sim.fim) return;
    var falta = sim.ids.length - Object.keys(sim.resp).length;
    if (falta > 0 && !confirm("Ainda há " + falta + " questão(ões) sem resposta. Finalizar mesmo assim?")) return;
    finalizar();
  });
  $("tab-stats").addEventListener("click", function () { aba("stats"); });
  document.addEventListener("keydown", function (e) {
    if (e.target.matches("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    if ($("painel-praticar").hidden) return;
    if (simPronto() && sim.pausado && !sim.fim) return;
    var k = e.key.toUpperCase();
    var q = lista[idx];
    if (k === "ARROWLEFT") ir(-1);
    else if (k === "ARROWRIGHT") ir(1);
    else if (q && LETRAS.indexOf(k) >= 0 && !feitoDe(q) && !(simPronto() && sim.fim)) {
      var b = document.querySelector('.alt[data-l="' + k + '"]');
      if (b) b.click();
    } else if (k === "ENTER") {
      var r = $("btn-responder");
      if (r && !r.disabled && r.style.display !== "none") r.click();
    }
  });

  // ---------- API para a camada de contas/nuvem (nuvem.js) ----------
  window.DEV_APP = {
    aba: aba,
    rerender: function () { if (!$("painel-simulado").hidden && !verRes && !criando) renderInicio(); },
    exportar: function () { return { respostas: respostas, marcadas: marcadas, hist: hist.slice(0, 40), novos: novos, prefs: prefs }; },
    vazio: function () { return !Object.keys(respostas).length && !hist.length && !novos.length && !Object.keys(marcadas).length; },
    importar: function (d) {
      respostas = (d && d.respostas) || {}; marcadas = (d && d.marcadas) || {}; hist = (d && d.hist) || []; novos = (d && d.novos) || [];
      prefs = { meta: (d && d.prefs && d.prefs.meta) || 10, atv: (d && d.prefs && d.prefs.atv) || {} };
      try {
        localStorage.setItem(KEY, JSON.stringify(respostas)); localStorage.setItem(MKEY, JSON.stringify(marcadas));
        localStorage.setItem(HKEY, JSON.stringify(hist)); localStorage.setItem(NKEY, JSON.stringify(novos)); localStorage.setItem(PKEY, JSON.stringify(prefs));
      } catch (e) {}
      sim = null; verRes = null; criando = false;
      aba("simulado");
    },
    limpar: function () {
      [KEY, MKEY, HKEY, NKEY, SKEY, PKEY].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    },
    stats: function () {
      var n = 0, ok = 0, pm = {};
      Object.keys(respostas).forEach(function (id) {
        var q = porId[id]; if (!q) return;
        n++; var o = pm[matDe(q)] = pm[matDe(q)] || { n: 0, ok: 0 };
        o.n++; if (respostas[id].ok) { ok++; o.ok++; }
      });
      return { respondidas: n, acertos: ok, simulados: hist.length, ultimo_pct: hist.length ? pct(hist[0]).p : null, por_materia: pm };
    }
  };

  aba("simulado");
})();
