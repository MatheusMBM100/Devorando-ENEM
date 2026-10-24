(function () {
  "use strict";
  // Contas, sincronização na nuvem e painel do administrador (Firebase Authentication + Firestore).
  // Sem configuração em config.js, nada disso é ativado e o site funciona localmente, como antes.
  var cfg = (window.DEVORANDO_CFG || {}).firebase || {};
  var APP = window.DEV_APP;
  if (!cfg.apiKey || !cfg.projectId || !window.firebase || !APP) return;

  window.firebase.initializeApp(cfg);
  var auth = window.firebase.auth();
  var db = window.firebase.firestore();
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var usuario = null;   // usuário autenticado
  var perfil = null;    // linha de profiles
  var timer = null;
  var iniciado = null;
  var cadastro = null;  // promessa do cadastro em andamento (o perfil é gravado por ele)  // id do usuário já inicializado (evita repetir em renovações de sessão)

  // ---------- tela de entrada ----------
  var overlay = el("div"); overlay.id = "auth-overlay"; overlay.hidden = true;
  document.body.appendChild(overlay);

  function msg(card, texto, tipo) {
    var m = card.querySelector(".auth-msg");
    if (!m) { m = el("p", "auth-msg"); card.appendChild(m); }
    m.className = "auth-msg " + (tipo || "erro");
    m.textContent = texto;
  }
  function traduz(e) {
    var c = (e && e.code) || "", t = (e && e.message) || String(e);
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "E-mail ou senha incorretos.";
    if (/email-already-in-use/.test(c)) return "Este e-mail já tem conta. Use a aba Entrar.";
    if (/weak-password/.test(c)) return "A senha precisa ter pelo menos 6 caracteres.";
    if (/invalid-email/.test(c)) return "Informe um e-mail válido.";
    if (/too-many-requests/.test(c)) return "Muitas tentativas. Aguarde alguns minutos.";
    if (/network/.test(c)) return "Sem conexão. Verifique a internet e tente de novo.";
    if (/user-disabled/.test(c)) return "Esta conta foi desativada.";
    return "Não foi possível concluir: " + (t || c);
  }

  function soDigitos(v) { var d = String(v || "").replace(/\D/g, ""); if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2); return d; }
  function telValido(v) { var d = soDigitos(v); return d.length === 10 || d.length === 11; }
  function telFmt(v) {
    var d = soDigitos(v);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return v || "";
  }

  // validação do e-mail no cadastro: formato, confirmação e sugestão para erros de digitação comuns
  var EMAIL_OK = /^[^\s@,;]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;
  var DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br", "icloud.com", "live.com", "uol.com.br", "bol.com.br", "terra.com.br", "outlook.com.br", "hotmail.com.br", "msn.com", "me.com", "proton.me", "protonmail.com"];
  function dist(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function sugestaoEmail(email) {
    var p = email.toLowerCase().split("@"), dom = p[1] || "";
    if (DOMINIOS.indexOf(dom) >= 0) return null;
    var melhor = null, md = 3;
    DOMINIOS.forEach(function (d) { var x = dist(dom, d); if (x < md) { md = x; melhor = d; } });
    return melhor && md <= 2 ? p[0] + "@" + melhor : null;
  }

  function mostrarLogin(modo) {
    modo = modo || "entrar";
    overlay.hidden = false;
    overlay.textContent = "";
    var card = el("div", "auth-card");
    var h = el("h1"); var lg = el("img", "logo"); lg.src = "logo.svg"; lg.alt = ""; lg.width = 44; lg.height = 44; h.appendChild(lg); h.appendChild(document.createTextNode("Devorando ")); h.appendChild(el("span", null, "ENEM"));
    card.appendChild(h);
    card.appendChild(el("p", "muted", "Entre para guardar seus simulados e acompanhar sua evolução em qualquer aparelho."));

    var tabs = el("div", "auth-tabs");
    var tE = el("button", "chip" + (modo === "entrar" ? " on" : ""), "Entrar"); tE.type = "button";
    var tC = el("button", "chip" + (modo === "criar" ? " on" : ""), "Criar conta"); tC.type = "button";
    tE.addEventListener("click", function () { mostrarLogin("entrar"); });
    tC.addEventListener("click", function () { mostrarLogin("criar"); });
    tabs.appendChild(tE); tabs.appendChild(tC);
    card.appendChild(tabs);

    var form = el("form"); form.noValidate = true;
    var nome, tel;
    if (modo === "criar") {
      var ln = el("label", "l", "Nome"); ln.htmlFor = "a-nome"; form.appendChild(ln);
      nome = el("input"); nome.type = "text"; nome.id = "a-nome"; nome.autocomplete = "name"; nome.maxLength = 60; form.appendChild(nome);
    }
    var le = el("label", "l", "E-mail"); le.htmlFor = "a-email"; form.appendChild(le);
    var em = el("input"); em.type = "email"; em.id = "a-email"; em.autocomplete = "email"; form.appendChild(em);
    var em2;
    if (modo === "criar") {
      var le2 = el("label", "l", "Repita o e-mail"); le2.htmlFor = "a-email2"; form.appendChild(le2);
      em2 = el("input"); em2.type = "email"; em2.id = "a-email2"; em2.autocomplete = "off"; form.appendChild(em2);
      em2.addEventListener("paste", function (e) { e.preventDefault(); });   // obriga a digitar de novo, e não colar
      var lt = el("label", "l", "Telefone (com DDD)"); lt.htmlFor = "a-tel"; form.appendChild(lt);
      tel = el("input"); tel.type = "tel"; tel.id = "a-tel"; tel.autocomplete = "tel"; tel.placeholder = "(11) 91234-5678"; tel.maxLength = 20; form.appendChild(tel);
    }
    var lp = el("label", "l", "Senha"); lp.htmlFor = "a-senha"; form.appendChild(lp);
    var se = el("input"); se.type = "password"; se.id = "a-senha"; se.autocomplete = modo === "criar" ? "new-password" : "current-password"; form.appendChild(se);

    var ac = el("div", "acoes");
    var ok = el("button", "btn", modo === "criar" ? "Criar conta" : "Entrar"); ok.type = "submit";
    ac.appendChild(ok); form.appendChild(ac);

    if (modo === "entrar") {
      var esq = el("button", "link", "Esqueci minha senha"); esq.type = "button";
      esq.style.marginTop = "12px";
      esq.addEventListener("click", function () {
        if (!em.value.trim()) { msg(card, "Digite seu e-mail acima e clique de novo.", "erro"); em.focus(); return; }
        auth.sendPasswordResetEmail(em.value.trim(), { url: location.origin + location.pathname })
          .then(function () { msg(card, "Enviamos um link para redefinir a senha, se esse e-mail tiver conta.", "ok"); })
          .catch(function (e) { msg(card, traduz(e), "erro"); });
      });
      form.appendChild(esq);
    }
    card.appendChild(form);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = em.value.trim(), senha = se.value;
      if (!email || !senha) { msg(card, "Preencha e-mail e senha.", "erro"); return; }
      ok.disabled = true;
      var p;
      if (modo === "criar") {
        if (!nome.value.trim()) { msg(card, "Informe seu nome.", "erro"); ok.disabled = false; return; }
        if (!EMAIL_OK.test(email)) { msg(card, "Esse e-mail não parece válido. Confira se tem @ e um domínio, por exemplo nome@gmail.com.", "erro"); ok.disabled = false; em.focus(); return; }
        if (em2.value.trim().toLowerCase() !== email.toLowerCase()) { msg(card, "Os dois e-mails não são iguais. Confira e digite de novo.", "erro"); ok.disabled = false; em2.focus(); return; }
        var sug = sugestaoEmail(email);
        if (sug && em.dataset.confirmado !== email) {
          msg(card, "Você quis dizer " + sug + "? Corrija o e-mail acima, ou clique em Criar conta de novo se ele estiver certo.", "erro");
          em.dataset.confirmado = email; ok.disabled = false; return;
        }
        if (!telValido(tel.value)) { msg(card, "Informe um telefone válido com DDD, por exemplo (11) 91234-5678.", "erro"); ok.disabled = false; tel.focus(); return; }
        cadastro = p = auth.createUserWithEmailAndPassword(email, senha).then(function (cred) {
          var nm = nome.value.trim(), criado = new Date().toISOString();
          return Promise.all([
            cred.user.updateProfile({ displayName: nm }),
            // se as regras ainda não aceitam o telefone, grava o perfil sem ele (ele pode ser preenchido depois em Minha conta)
            db.doc("users/" + cred.user.uid).set({ email: email, nome: nm, telefone: soDigitos(tel.value), createdAt: criado })
              .catch(function () { return db.doc("users/" + cred.user.uid).set({ email: email, nome: nm, createdAt: criado }); }),
            cred.user.sendEmailVerification().catch(function () {})
          ]);
        });
      } else {
        p = auth.signInWithEmailAndPassword(email, senha);
      }
      p.catch(function (e) { msg(card, traduz(e), "erro"); }).then(function () { ok.disabled = false; });
    });
    overlay.appendChild(card);
    setTimeout(function () { (nome || em).focus(); }, 50);
  }

  // ---------- sessão ----------
  function areaUsuario() {
    var a = $("user-area"); a.textContent = ""; a.hidden = false;
    a.appendChild(el("span", null, (perfil && perfil.nome) || usuario.email));
    var st = el("span", "sync", "☁"); st.id = "sync-estado"; st.title = "Dados sincronizados"; a.appendChild(st);
    var sair = el("button", "ghost mini", "Sair"); sair.type = "button";
    sair.addEventListener("click", function () {
      auth.signOut().then(function () { APP.limpar(); location.reload(); });
    });
    a.appendChild(sair);
    var ta = $("tab-alunos");
    ta.hidden = !(perfil && perfil.is_admin);
    ta.onclick = function () { APP.aba("alunos"); };
    var tr = $("tab-redacao"); tr.hidden = false;
    tr.onclick = function () { APP.aba("redacao"); };
    if (window.NUVEM_REDACAO) window.NUVEM_REDACAO.carregar().catch(function () {});
  }

  function estado(t, tit) { var s = $("sync-estado"); if (s) { s.textContent = t; s.title = tit || ""; } }

  function enviar() {
    if (!usuario) return Promise.resolve();
    estado("☁…", "Sincronizando");
    var agora = new Date().toISOString();
    var s = APP.stats();
    var d = APP.exportar();
    var json = JSON.stringify(d);
    while (json.length > 900000 && d.hist.length > 1) { d.hist.pop(); json = JSON.stringify(d); }  // limite de 1 MiB por documento
    return Promise.all([
      db.doc("userData/" + usuario.uid).set({ json: json, updatedAt: agora }),
      db.doc("userStats/" + usuario.uid).set({ respondidas: s.respondidas, acertos: s.acertos, simulados: s.simulados,
        ultimo_pct: s.ultimo_pct, por_materia: s.por_materia, updatedAt: agora })
    ]).then(function () { estado("☁✔", "Dados sincronizados"); })
      .catch(function () { estado("☁!", "Falha ao sincronizar; tentaremos de novo na próxima alteração"); });
  }
  window.__sync = function () {
    if (!usuario) return;
    clearTimeout(timer);
    timer = setTimeout(enviar, 1500);
  };

  function entrou(user) {
    usuario = user;
    if (iniciado === user.uid) return;
    iniciado = user.uid;
    overlay.hidden = true;
    var refPerfil = db.doc("users/" + user.uid);
    Promise.resolve(cadastro).catch(function () {}).then(function () {
      return Promise.all([refPerfil.get(), db.doc("admins/" + user.uid).get().catch(function () { return { exists: false }; })]);
    }).then(function (rs) {
      var p = rs[0].exists ? rs[0].data() : null;
      if (!p) {
        p = { email: user.email, nome: user.displayName || "", createdAt: new Date().toISOString() };
        refPerfil.set(p).catch(function () {});
      }
      if (p.desativado) {
        auth.signOut().then(function () { APP.limpar(); mostrarLogin("entrar"); msg(overlay.querySelector(".auth-card"), "Esta conta está desativada. Fale com o administrador.", "erro"); });
        throw new Error("desativado");
      }
      perfil = { email: p.email || user.email, nome: p.nome || user.displayName || "", telefone: p.telefone || "", createdAt: p.createdAt || "", is_admin: !!rs[1].exists };
      areaUsuario();
      if (perfil.is_admin) { recarregaTurmas(); vigiaAdmin(); }
      return db.doc("userData/" + user.uid).get();
    }).then(function (snap) {
      var d = null;
      try { d = snap.exists ? JSON.parse(snap.data().json) : null; } catch (e) { d = null; }
      if (d && (Object.keys(d.respostas || {}).length || (d.hist || []).length || (d.novos || []).length || Object.keys(d.marcadas || {}).length)) APP.importar(d);
      else enviar();   // primeira vez: leva para a nuvem o que já havia neste navegador
      APP.rerender();
    }).catch(function (e) { if (e && e.message === "desativado") return; estado("☁!", "Não foi possível carregar seus dados da nuvem"); });
  }

  // ---------- reportes, turmas e resultados ----------
  var turmasCache = [];
  function recarregaTurmas() {
    return db.collection("turmas").get().then(function (qs) {
      turmasCache = []; qs.forEach(function (d) { turmasCache.push({ id: d.id, nome: (d.data() || {}).nome || d.id }); });
      return turmasCache;
    }).catch(function () { return turmasCache; });
  }
  // Aviso por e-mail ao responsável (serviço FormSubmit, sem servidor próprio). Falha em silêncio.
  var EMAIL_AVISO = "matheusbrizolamontanher@gmail.com";
  function avisaEmail(assunto, campos) {
    try {
      var corpo = { _subject: "Devorando ENEM: " + assunto, _captcha: "false", _template: "table", _honey: "" };
      Object.keys(campos).forEach(function (k) { corpo[k] = String(campos[k] == null ? "" : campos[k]).slice(0, 600); });
      fetch("https://formsubmit.co/ajax/" + EMAIL_AVISO, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(corpo) }).catch(function () {});
    } catch (e) {}
  }
  function enviarReporte(r) {
    if (!usuario) return Promise.reject(new Error("sem login"));
    return db.collection("reports").add({ uid: usuario.uid, nome: (perfil && perfil.nome) || "", email: usuario.email, questao: r.questao, ano: r.ano, numero: r.numero,
      materia: r.materia || "", assunto: r.assunto || "", gabarito: r.gabarito || "", mensagem: String(r.mensagem || "").slice(0, 1500),
      criado: new Date().toISOString(), status: "novo" }).then(function (x) {
        avisaEmail(r.questao === "geral" ? "novo reporte de erro no site" : "novo reporte de erro em questão", {
          de: (perfil && perfil.nome) || usuario.email, questao: r.questao === "geral" ? "(erro geral)" : "ENEM " + r.ano + " questão " + r.numero, mensagem: r.mensagem });
        return x;
      });
  }
  // ---------- avisos para o administrador ----------
  var pendAdmin = { rep: 0, red: 0 }, avisouAdmin = 0, relogioAdmin = null;
  function atualizaAvisosAdmin() {
    if (!perfil || !perfil.is_admin) return Promise.resolve();
    return Promise.all([db.collection("reports").where("status", "==", "novo").get(), db.collection("redacoes").where("status", "==", "enviada").get()]).then(function (rs) {
      var rep = rs[0].size, red = rs[1].size, tot = rep + red;
      pendAdmin = { rep: rep, red: red };
      var t = $("tab-alunos"); if (t) t.textContent = tot ? "Administração (" + tot + ")" : "Administração";
      if (APP.pref("notifAdmin") && tot > avisouAdmin) {
        var partes = [];
        if (red) partes.push(red + (red === 1 ? " redação para corrigir" : " redações para corrigir"));
        if (rep) partes.push(rep + (rep === 1 ? " reporte novo" : " reportes novos"));
        APP.avisar("Pendências: " + partes.join(" e ") + ".", "alunos");
      }
      avisouAdmin = tot;
    }).catch(function () {});
  }
  function vigiaAdmin() {
    var ligado = perfil && perfil.is_admin;
    if (ligado && !relogioAdmin) { relogioAdmin = setInterval(atualizaAvisosAdmin, 120000); }
    if (ligado) atualizaAvisosAdmin();
  }
  var cacheTurmaAluno = null;
  function simuladosTurma() {
    if (!usuario) return Promise.resolve([]);
    if (cacheTurmaAluno) return cacheTurmaAluno;
    var uid = usuario.uid;
    cacheTurmaAluno = db.collection("turmas").where("alunos", "array-contains", uid).get().then(function (ts) {
      var tarefas = [];
      ts.forEach(function (t) {
        var tn = (t.data() || {}).nome || "Turma";
        tarefas.push(Promise.all([db.collection("turmas/" + t.id + "/simulados").get(), db.collection("turmas/" + t.id + "/resultados").where("uid", "==", uid).get()]).then(function (rs) {
          var feitos = {}; rs[1].forEach(function (r) { feitos[(r.data() || {}).sim] = true; });
          var out = [];
          rs[0].forEach(function (s) { var d = s.data(); out.push({ turmaId: t.id, turmaNome: tn, sid: s.id, nome: d.nome, ids: d.ids || [], mostrar: d.mostrar !== false, limite: d.limite || 0, feito: !!feitos[s.id], criado: d.criado }); });
          return out;
        }));
      });
      return Promise.all(tarefas).then(function (arr) { return [].concat.apply([], arr).sort(function (a, b) { return String(b.criado).localeCompare(String(a.criado)); }); });
    }).catch(function () { cacheTurmaAluno = null; return []; });
    return cacheTurmaAluno;
  }
  function publicarTurma(turmaId, def) {
    return db.collection("turmas/" + turmaId + "/simulados").add({ nome: def.nome, ids: def.ids, mostrar: !!def.mostrar, limite: def.limite || 0, criado: new Date().toISOString() });
  }
  function enviarResultado(sim, p) {
    if (!usuario || !sim.turma) return Promise.resolve();
    cacheTurmaAluno = null;
    return db.doc("turmas/" + sim.turma.t + "/resultados/" + sim.turma.s + "_" + usuario.uid).set({
      uid: usuario.uid, nome: (perfil && perfil.nome) || usuario.email, sim: sim.turma.s, acertos: p.ac, total: sim.ids.length, pct: p.p,
      tempo: sim.decorrido || 0, fimEm: new Date().toISOString(), respostas: sim.resp, ids: sim.ids
    }).catch(function () {});
  }

  auth.onAuthStateChanged(function (user) {
    if (user) { entrou(user); return; }
    usuario = null; perfil = null; iniciado = null;
    $("user-area").hidden = true; $("tab-alunos").hidden = true; $("tab-redacao").hidden = true;
    mostrarLogin("entrar");
  });

  // ---------- painel do administrador ----------
  var ordem = { chave: "acerto", asc: false };
  function pctDe(s) { return s.respondidas ? Math.round(100 * s.acertos / s.respondidas) : null; }

  var secaoAtual = "alunos";
  function renderAlunos(painel) {
    atualizaAvisosAdmin();
    painel.textContent = "";
    if (!perfil || !perfil.is_admin) { painel.appendChild(el("p", "muted", "Área restrita ao administrador.")); return; }
    painel.appendChild(el("h2", "resumo-titulo", "Administração"));
    var abas = el("div", "chips"); painel.appendChild(abas);
    var corpo = el("div"); corpo.style.marginTop = "14px"; painel.appendChild(corpo);
    var S = [["alunos", "Alunos"], ["turmas", "Turmas"], ["reportes", "Reportes de erro"], ["redacoes", "Redações"], ["modelos", "Modelos de comentário"], ["admins", "Administradores"], ["backup", "Backup"]];
    function mostra(k) {
      secaoAtual = k; abas.textContent = ""; corpo.textContent = "";
      S.forEach(function (x) {
        var b = el("button", "chip" + (x[0] === k ? " on" : ""), x[1]); b.type = "button";
        b.addEventListener("click", function () { mostra(x[0]); });
        abas.appendChild(b);
      });
      var f = k === "alunos" ? listaAlunos : (window.NUVEM_ADMIN && window.NUVEM_ADMIN[k]);
      if (f) f(corpo);
    }
    mostra(secaoAtual);
  }

  // rotula cada célula com o título da coluna, para a tabela virar "cartões" no celular
  function rotula(tab) {
    var ths = [].map.call(tab.querySelectorAll("thead th"), function (t) { return t.textContent.replace(/\s*[▲▼]$/, ""); });
    [].forEach.call(tab.querySelectorAll("tbody tr"), function (tr) {
      [].forEach.call(tr.children, function (td, i) { if (ths[i]) td.setAttribute("data-label", ths[i]); });
    });
  }

  function baixar(nome, texto, tipo) {
    var blob = new Blob([texto], { type: tipo || "text/plain;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function listaAlunos(painel) {
    var info = el("p", "muted", "Carregando…"); painel.appendChild(info);
    Promise.all([db.collection("users").get(), db.collection("userStats").get(), db.collection("admins").get()]).then(function (rs) {
      var st = {}; rs[1].forEach(function (d) { st[d.id] = d.data(); });
      var adm = {}; rs[2].forEach(function (d) { adm[d.id] = true; });
      var linhas = [];
      rs[0].forEach(function (d) {
        var p = d.data();
        var s = st[d.id] || { respondidas: 0, acertos: 0, simulados: 0, por_materia: {} };
        linhas.push({ p: { id: d.id, email: p.email || "", nome: p.nome || "", telefone: p.telefone || "", is_admin: !!adm[d.id], desativado: !!p.desativado, created_at: p.createdAt }, s: s, acerto: pctDe(s), atividade: s.updatedAt || p.createdAt });
      });
      info.textContent = linhas.length + " pessoa(s) cadastrada(s). Clique em uma linha para ver o desempenho e as questões.";
      var barra = el("div", "filtro-linha");
      var busca = el("input"); busca.type = "search"; busca.placeholder = "Buscar por nome, e-mail ou telefone"; busca.style.maxWidth = "260px";
      var fl = el("select");
      [["todos", "Todos"], ["inativos", "Sem atividade há 7+ dias"], ["desativados", "Desativados"], ["admins", "Administradores"]].forEach(function (x) { var o = el("option", null, x[1]); o.value = x[0]; fl.appendChild(o); });
      var csv = el("button", "ghost mini", "Exportar CSV"); csv.type = "button";
      var cols = [["nome", "Nome"], ["email", "E-mail"], ["tel", "Telefone"], ["resp", "Respondidas"], ["acerto", "Acerto"], ["sim", "Simulados"], ["ultimo", "Último simulado"], ["atividade", "Atividade"]];
      var so = el("select", "so-mobile"); so.setAttribute("aria-label", "Ordenar por");
      cols.forEach(function (c) { var o = el("option", null, "Ordenar por: " + c[1]); o.value = c[0]; so.appendChild(o); });
      so.value = ordem.chave;
      so.addEventListener("change", function () { ordem.chave = so.value; ordem.asc = ["nome", "email"].indexOf(so.value) >= 0; desenha(); });
      barra.appendChild(busca); barra.appendChild(fl); barra.appendChild(so); barra.appendChild(csv);
      painel.appendChild(barra);
      var det = el("div");
      var tab = el("table", "tabela");
      function val(l, k) {
        return k === "nome" ? (l.p.nome || "").toLowerCase() : k === "email" ? l.p.email.toLowerCase() : k === "tel" ? (l.p.telefone || "") : k === "resp" ? l.s.respondidas :
          k === "acerto" ? (l.acerto == null ? -1 : l.acerto) : k === "sim" ? l.s.simulados : k === "ultimo" ? (l.s.ultimo_pct == null ? -1 : l.s.ultimo_pct) : (l.atividade || "");
      }
      function visiveis() {
        var q = busca.value.trim().toLowerCase(), agora = Date.now();
        return linhas.filter(function (l) {
          if (q && (l.p.nome + " " + l.p.email + " " + (l.p.telefone || "")).toLowerCase().indexOf(q) < 0) return false;
          if (fl.value === "inativos") return !l.atividade || agora - new Date(l.atividade).getTime() > 7 * 86400000;
          if (fl.value === "desativados") return l.p.desativado;
          if (fl.value === "admins") return l.p.is_admin;
          return true;
        });
      }
      function desenha() {
        tab.textContent = "";
        var thead = el("thead"), tr = el("tr");
        cols.forEach(function (c) {
          var th = el("th", null, c[1] + (ordem.chave === c[0] ? (ordem.asc ? " ▲" : " ▼") : ""));
          th.addEventListener("click", function () { ordem.asc = ordem.chave === c[0] ? !ordem.asc : false; ordem.chave = c[0]; desenha(); });
          tr.appendChild(th);
        });
        thead.appendChild(tr); tab.appendChild(thead);
        var tb = el("tbody");
        visiveis().sort(function (a, b) {
          var x = val(a, ordem.chave), y = val(b, ordem.chave);
          return (x < y ? -1 : x > y ? 1 : 0) * (ordem.asc ? 1 : -1);
        }).forEach(function (l) {
          var r = el("tr", "aluno");
          [(l.p.nome || "—") + (l.p.desativado ? " (desativado)" : ""), l.p.email + (l.p.is_admin ? " (admin)" : ""), l.p.telefone ? telFmt(l.p.telefone) : "–", String(l.s.respondidas), l.acerto == null ? "–" : l.acerto + "%", String(l.s.simulados),
           l.s.ultimo_pct == null ? "–" : l.s.ultimo_pct + "%", l.atividade ? new Date(l.atividade).toLocaleDateString("pt-BR") : "–"].forEach(function (t) { r.appendChild(el("td", null, t)); });
          r.addEventListener("click", function () { detalhe(det, l, desenha); });
          tb.appendChild(r);
        });
        tab.appendChild(tb); rotula(tab); so.value = ordem.chave;
      }
      busca.addEventListener("input", desenha); fl.addEventListener("change", desenha);
      csv.addEventListener("click", function () {
        function c(v) { v = String(v == null ? "" : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
        var cab = ["nome", "email", "telefone", "respondidas", "acertos", "acerto_pct", "simulados", "ultimo_simulado_pct", "ultima_atividade", "desativado", "admin"];
        var rows = visiveis().map(function (l) {
          return [l.p.nome, l.p.email, l.p.telefone ? telFmt(l.p.telefone) : "", l.s.respondidas, l.s.acertos, l.acerto == null ? "" : l.acerto, l.s.simulados, l.s.ultimo_pct == null ? "" : l.s.ultimo_pct, l.atividade || "", l.p.desativado ? "sim" : "", l.p.is_admin ? "sim" : ""].map(c).join(",");
        });
        baixar("alunos-devorando-enem.csv", "\ufeff" + [cab.join(",")].concat(rows).join("\n"), "text/csv;charset=utf-8");
      });
      desenha();
      var wrap = el("div", "tabela-wrap card"); wrap.appendChild(tab);
      painel.appendChild(wrap); painel.appendChild(det);
    }).catch(function (e) { info.textContent = "Não foi possível carregar os alunos: " + ((e && e.message) || e); });
  }

  function detalhe(cx, l, redesenha) {
    cx.textContent = "";
    var c = el("div", "card");
    c.appendChild(el("h3", null, (l.p.nome || l.p.email)));
    c.appendChild(el("p", "muted", l.p.email + (l.p.telefone ? " · " + telFmt(l.p.telefone) : "") + " · " + l.s.respondidas + " respondidas · " + (l.acerto == null ? "sem dados" : l.acerto + "% de acerto") + " · " + l.s.simulados + " simulado(s)"));
    var pm = l.s.por_materia || {};
    var mats = Object.keys(pm).sort(function (a, b) { return pm[b].n - pm[a].n; });
    if (!mats.length) c.appendChild(el("p", "muted", "Ainda não respondeu questões."));
    mats.forEach(function (m) {
      var o = pm[m], row = el("div", "barra-l");
      row.appendChild(el("span", null, m));
      var b = el("div", "barra"), i = el("i"); i.style.width = (o.n ? 100 * o.ok / o.n : 0) + "%"; b.appendChild(i); row.appendChild(b);
      row.appendChild(el("span", "muted", o.ok + "/" + o.n + " (" + Math.round(100 * o.ok / o.n) + "%)"));
      c.appendChild(row);
    });
    var acs = el("div", "acoes");
    var bd = el("button", "ghost mini", l.p.desativado ? "Reativar conta" : "Desativar conta"); bd.type = "button";
    bd.addEventListener("click", function () {
      var novo = !l.p.desativado;
      if (novo && !confirm("Desativar esta conta? A pessoa deixa de conseguir entrar e gravar dados.")) return;
      db.doc("users/" + l.p.id).update({ desativado: novo }).then(function () { l.p.desativado = novo; bd.textContent = novo ? "Reativar conta" : "Desativar conta"; if (redesenha) redesenha(); })
        .catch(function () { alert("Não foi possível alterar. Confira as regras do Firestore."); });
    });
    acs.appendChild(bd);
    if (!l.p.is_admin) {
      var ba = el("button", "ghost mini", "Tornar administrador"); ba.type = "button";
      ba.addEventListener("click", function () {
        if (!confirm("Dar acesso de administrador a " + (l.p.nome || l.p.email) + "? Ela poderá ver os dados de todos os alunos.")) return;
        db.doc("admins/" + l.p.id).set({ ativo: true, desde: new Date().toISOString() }).then(function () { l.p.is_admin = true; ba.hidden = true; if (redesenha) redesenha(); })
          .catch(function () { alert("Não foi possível promover."); });
      });
      acs.appendChild(ba);
    }
    var bx = el("button", "ghost mini", "Apagar dados do aluno"); bx.type = "button";
    bx.addEventListener("click", function () {
      if (!confirm("Apagar TODOS os dados de " + (l.p.nome || l.p.email) + " (perfil, respostas e simulados)? Não dá para desfazer.\nA conta de login continua existindo; para excluí-la de vez, remova também em Authentication no Firebase.")) return;
      Promise.all([db.doc("userData/" + l.p.id).delete(), db.doc("userStats/" + l.p.id).delete(), db.doc("users/" + l.p.id).delete()])
        .then(function () { cx.textContent = ""; cx.appendChild(el("p", "muted", "Dados apagados. Atualize a aba para ver a lista.")); })
        .catch(function () { alert("Não foi possível apagar."); });
    });
    acs.appendChild(bx);
    var be = el("button", "ghost mini", "Editar cadastro"); be.type = "button";
    acs.appendChild(be);
    var bp = el("button", "ghost mini", "Imprimir / PDF"); bp.type = "button";
    bp.addEventListener("click", function () { window.print(); });
    acs.appendChild(bp);
    c.appendChild(acs);

    // edição dos dados de cadastro (para corrigir erros de digitação)
    var fe = el("div", "cfg-form"); fe.hidden = true; fe.style.marginTop = "12px";
    function campoE(rot, val, tipo) {
      fe.appendChild(el("label", "l", rot));
      var i = el("input"); i.type = tipo || "text"; i.value = val || ""; fe.appendChild(i); return i;
    }
    var eN = campoE("Nome", l.p.nome); eN.maxLength = 60;
    var eT = campoE("Telefone (com DDD)", telFmt(l.p.telefone), "tel"); eT.maxLength = 20;
    var eE = campoE("E-mail de contato", l.p.email, "email");
    fe.appendChild(el("p", "muted", "Atenção: isto corrige o cadastro mostrado na lista e nos relatórios. O e-mail que a pessoa usa para entrar no site (login) não muda por aqui, e continua o do cadastro original."));
    var sE = el("button", "btn mini", "Salvar alterações"); sE.type = "button";
    var mE = el("p", "muted"); mE.setAttribute("aria-live", "polite");
    sE.addEventListener("click", function () {
      var nm = eN.value.trim(), em = eE.value.trim(), tl = soDigitos(eT.value);
      if (!nm) { mE.textContent = "Informe o nome."; return; }
      if (eT.value.trim() && !telValido(eT.value)) { mE.textContent = "Telefone inválido: use DDD e número, por exemplo (11) 91234-5678."; return; }
      if (!EMAIL_OK.test(em)) { mE.textContent = "E-mail inválido."; return; }
      sE.disabled = true; mE.textContent = "Salvando…";
      db.doc("users/" + l.p.id).update({ nome: nm, telefone: tl, email: em }).then(function () {
        l.p.nome = nm; l.p.telefone = tl; l.p.email = em;
        mE.textContent = "✔ Cadastro atualizado.";
        if (redesenha) redesenha();
        detalhe(cx, l, redesenha);
      }).catch(function () { mE.textContent = "Não foi possível salvar. Confira se as regras do Firestore foram publicadas."; sE.disabled = false; });
    });
    fe.appendChild(sE); fe.appendChild(mE);
    be.addEventListener("click", function () { fe.hidden = !fe.hidden; if (!fe.hidden) eN.focus(); });
    c.appendChild(fe);
    var corpo = el("div"); c.appendChild(corpo);
    cx.appendChild(c);
    c.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (!l.s.respondidas) return;
    corpo.appendChild(el("p", "muted", "Carregando as questões…"));
    db.doc("userData/" + l.p.id).get().then(function (snap) {
      var d = null;
      try { d = snap.exists ? JSON.parse(snap.data().json) : null; } catch (e) { d = null; }
      corpo.textContent = "";
      if (!d) { corpo.appendChild(el("p", "muted", "Sem dados detalhados.")); return; }
      detalheQuestoes(corpo, d);
    }).catch(function () {
      corpo.textContent = "";
      corpo.appendChild(el("p", "muted", "Não foi possível carregar as questões. Confira se as regras do Firestore mais recentes foram publicadas (o administrador precisa poder ler userData)."));
    });
  }

  function detalheQuestoes(cx, d) {
    var Q = window.QUESTOES || [], META = window.META || {};
    var porId = {}; Q.forEach(function (q) { porId[q.id] = q; });
    var linhas = Object.keys(d.respostas || {}).map(function (id) {
      var q = porId[id]; if (!q) return null;
      var r = d.respostas[id], m = META[id] || [q.area, ""];
      return { id: id, q: q, r: r.r, ok: !!r.ok, t: r.t || 0, mat: m[0], ass: m[1], marcada: !!(d.marcadas || {})[id] };
    }).filter(Boolean).sort(function (a, b) { return b.t - a.t; });

    // assuntos para reforçar
    var ass = {};
    linhas.forEach(function (x) { var k = x.mat + " — " + x.ass; var o = ass[k] = ass[k] || { n: 0, ok: 0 }; o.n++; if (x.ok) o.ok++; });
    var fracos = Object.keys(ass).filter(function (k) { return ass[k].n >= 2; })
      .sort(function (a, b) { return ass[a].ok / ass[a].n - ass[b].ok / ass[b].n || ass[b].n - ass[a].n; }).slice(0, 6);
    if (fracos.length) {
      cx.appendChild(el("h4", "sub", "Assuntos com menor acerto"));
      fracos.forEach(function (k) { cx.appendChild(el("p", "muted linha", k + ": " + ass[k].ok + "/" + ass[k].n + " (" + Math.round(100 * ass[k].ok / ass[k].n) + "%)")); });
    }

    // simulados feitos
    var hist = d.hist || [];
    if (hist.length) {
      cx.appendChild(el("h4", "sub", "Simulados concluídos"));
      hist.forEach(function (h) {
        var ac = 0; h.ids.forEach(function (id) { if (h.resp[id] && porId[id] && h.resp[id] === porId[id].gabarito) ac++; });
        var tempo = h.decorrido ? " · " + Math.round(h.decorrido / 60) + " min" : "";
        cx.appendChild(el("p", "muted linha", h.nome + " — " + new Date(h.criado).toLocaleDateString("pt-BR") + ": " + ac + "/" + h.ids.length + " (" + Math.round(100 * ac / h.ids.length) + "%)" + tempo));
      });
    }

    // lista de questões com filtros
    cx.appendChild(el("h4", "sub", "Questões respondidas (" + linhas.length + ")"));
    var barra = el("div", "filtro-linha");
    var fs = el("select");
    [["todas", "Todas"], ["erradas", "Só as que errou"], ["certas", "Só as que acertou"], ["marcadas", "Marcadas para revisar"]].forEach(function (x) { var o = el("option", null, x[1]); o.value = x[0]; fs.appendChild(o); });
    var fm = el("select");
    var o0 = el("option", null, "Todas as matérias"); o0.value = ""; fm.appendChild(o0);
    Object.keys(linhas.reduce(function (a, x) { a[x.mat] = 1; return a; }, {})).sort().forEach(function (m) { var o = el("option", null, m); o.value = m; fm.appendChild(o); });
    barra.appendChild(fs); barra.appendChild(fm);
    cx.appendChild(barra);
    var lista = el("div"); cx.appendChild(lista);
    var limite = 60;
    function desenha() {
      lista.textContent = "";
      var vis = linhas.filter(function (x) {
        if (fm.value && x.mat !== fm.value) return false;
        return fs.value === "todas" || (fs.value === "erradas" && !x.ok) || (fs.value === "certas" && x.ok) || (fs.value === "marcadas" && x.marcada);
      });
      lista.appendChild(el("p", "muted", vis.length + " questão(ões)."));
      var tb = el("table", "tabela");
      var th = el("tr"); ["Questão", "Matéria / assunto", "Marcou", "Gabarito", ""].forEach(function (t) { th.appendChild(el("th", null, t)); });
      var hd = el("thead"); hd.appendChild(th); tb.appendChild(hd);
      var body = el("tbody");
      vis.slice(0, limite).forEach(function (x) {
        var tr = el("tr");
        tr.appendChild(el("td", null, "ENEM " + x.q.ano + " · Q" + x.q.n + (x.marcada ? " ⚑" : "")));
        tr.appendChild(el("td", null, x.mat + (x.ass && x.mat !== "Inglês" && x.mat !== "Espanhol" ? " — " + x.ass : "")));
        tr.appendChild(el("td", null, x.r));
        tr.appendChild(el("td", null, x.q.gabarito));
        tr.appendChild(el("td", x.ok ? "up" : "down", x.ok ? "✔ acertou" : "✘ errou"));
        body.appendChild(tr);
      });
      tb.appendChild(body);
      var w = el("div", "tabela-wrap"); w.appendChild(tb); lista.appendChild(w);
      if (vis.length > limite) {
        var mais = el("button", "ghost mini", "Mostrar mais"); mais.type = "button";
        mais.addEventListener("click", function () { limite += 60; desenha(); });
        lista.appendChild(mais);
      }
    }
    fs.addEventListener("change", function () { limite = 60; desenha(); });
    fm.addEventListener("change", function () { limite = 60; desenha(); });
    desenha();
  }

  // ---------- configurações: minha conta ----------
  function renderConta(cx) {
    cx.textContent = "";
    cx.appendChild(el("h3", null, "Minha conta"));
    function campo(rot, id, val, opts) {
      var l = el("label", "l", rot); l.htmlFor = id; cx.appendChild(l);
      var i = el("input"); i.type = (opts && opts.type) || "text"; i.id = id; i.value = val || "";
      if (opts && opts.ro) i.readOnly = true;
      if (opts && opts.ac) i.autocomplete = opts.ac;
      cx.appendChild(i); return i;
    }
    var iN = campo("Nome", "c-nome", perfil && perfil.nome, { ac: "name" }); iN.maxLength = 60;
    campo("E-mail", "c-email", usuario.email, { ro: true });
    var iT = campo("Telefone (com DDD)", "c-tel", telFmt(perfil && perfil.telefone), { type: "tel", ac: "tel" }); iT.maxLength = 20;
    var criada = (perfil && perfil.createdAt) || (usuario.metadata && usuario.metadata.creationTime) || "";
    if (criada) cx.appendChild(el("p", "muted", "Conta criada em " + new Date(criada).toLocaleDateString("pt-BR") + (usuario.emailVerified ? " · e-mail confirmado" : "")));
    var sv = el("button", "btn", "Salvar dados"); sv.type = "button";
    var st = el("p", "muted"); st.setAttribute("aria-live", "polite");
    sv.addEventListener("click", function () {
      var nm = iN.value.trim();
      if (!nm) { st.textContent = "Informe seu nome."; return; }
      if (!telValido(iT.value)) { st.textContent = "Informe um telefone válido com DDD, por exemplo (11) 91234-5678."; return; }
      sv.disabled = true; st.textContent = "Salvando…";
      var tel = soDigitos(iT.value);
      Promise.all([usuario.updateProfile({ displayName: nm }), db.doc("users/" + usuario.uid).update({ nome: nm, telefone: tel })]).then(function () {
        perfil.nome = nm; perfil.telefone = tel; iT.value = telFmt(tel);
        var sp = $("user-area").firstChild; if (sp) sp.textContent = nm;
        st.textContent = "✔ Dados salvos.";
      }).catch(function () { st.textContent = "Não foi possível salvar. Se o problema continuar, as regras do Firestore podem precisar ser republicadas."; })
        .then(function () { sv.disabled = false; });
    });
    var ac = el("div", "acoes"); ac.appendChild(sv); cx.appendChild(ac); cx.appendChild(st);

    cx.appendChild(el("h3", null, "Alterar senha")).style.marginTop = "22px";
    var pa = campo("Senha atual", "c-sa", "", { type: "password", ac: "current-password" });
    var pn = campo("Nova senha (mínimo 6 caracteres)", "c-sn", "", { type: "password", ac: "new-password" });
    var pc = campo("Repita a nova senha", "c-sc", "", { type: "password", ac: "new-password" });
    var bs = el("button", "btn", "Alterar senha"); bs.type = "button";
    var ss = el("p", "muted"); ss.setAttribute("aria-live", "polite");
    bs.addEventListener("click", function () {
      if (!pa.value || !pn.value) { ss.textContent = "Preencha a senha atual e a nova."; return; }
      if (pn.value.length < 6) { ss.textContent = "A nova senha precisa ter pelo menos 6 caracteres."; return; }
      if (pn.value !== pc.value) { ss.textContent = "As senhas novas não são iguais."; return; }
      bs.disabled = true; ss.textContent = "Alterando…";
      var cred = window.firebase.auth.EmailAuthProvider.credential(usuario.email, pa.value);
      usuario.reauthenticateWithCredential(cred).then(function () { return usuario.updatePassword(pn.value); }).then(function () {
        pa.value = pn.value = pc.value = ""; ss.textContent = "✔ Senha alterada.";
      }).catch(function (e) { ss.textContent = /invalid-credential|wrong-password/.test((e && e.code) || "") ? "A senha atual está incorreta." : traduz(e); })
        .then(function () { bs.disabled = false; });
    });
    var ac2 = el("div", "acoes"); ac2.appendChild(bs); cx.appendChild(ac2); cx.appendChild(ss);
  }

  window.NUVEM = { avisaEmail: avisaEmail, atualizaAvisosAdmin: atualizaAvisosAdmin, rotula: rotula, renderConta: renderConta, renderAlunos: renderAlunos, db: db, auth: auth, el: el, baixar: baixar, user: function () { return usuario; }, perfil: function () { return perfil; },
    logado: function () { return !!usuario; }, ehAdmin: function () { return !!(perfil && perfil.is_admin); },
    enviarReporte: enviarReporte, simuladosTurma: simuladosTurma, publicarTurma: publicarTurma, enviarResultado: enviarResultado,
    turmasAdmin: function () { return perfil && perfil.is_admin ? turmasCache : []; }, recarregaTurmas: recarregaTurmas };
})();
