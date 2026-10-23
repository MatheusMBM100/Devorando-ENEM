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

  function mostrarLogin(modo) {
    modo = modo || "entrar";
    overlay.hidden = false;
    overlay.textContent = "";
    var card = el("div", "auth-card");
    var h = el("h1"); h.appendChild(document.createTextNode("Devorando ")); h.appendChild(el("span", null, "ENEM"));
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
    var nome, consent;
    if (modo === "criar") {
      var ln = el("label", "l", "Nome"); ln.htmlFor = "a-nome"; form.appendChild(ln);
      nome = el("input"); nome.type = "text"; nome.id = "a-nome"; nome.autocomplete = "name"; nome.maxLength = 60; form.appendChild(nome);
    }
    var le = el("label", "l", "E-mail"); le.htmlFor = "a-email"; form.appendChild(le);
    var em = el("input"); em.type = "email"; em.id = "a-email"; em.autocomplete = "email"; form.appendChild(em);
    var lp = el("label", "l", "Senha"); lp.htmlFor = "a-senha"; form.appendChild(lp);
    var se = el("input"); se.type = "password"; se.id = "a-senha"; se.autocomplete = modo === "criar" ? "new-password" : "current-password"; form.appendChild(se);

    if (modo === "criar") {
      var lc = el("label", "check");
      consent = el("input"); consent.type = "checkbox"; consent.id = "a-consent";
      lc.appendChild(consent);
      lc.appendChild(document.createTextNode(" Entendo que meu nome, e-mail e desempenho (acertos por matéria) ficam guardados e podem ser vistos pelo administrador do site."));
      form.appendChild(lc);
    }

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
        if (!consent.checked) { msg(card, "Marque a caixa de ciência para criar a conta.", "erro"); ok.disabled = false; return; }
        cadastro = p = auth.createUserWithEmailAndPassword(email, senha).then(function (cred) {
          var nm = nome.value.trim();
          return Promise.all([
            cred.user.updateProfile({ displayName: nm }),
            db.doc("users/" + cred.user.uid).set({ email: email, nome: nm, createdAt: new Date().toISOString() }),
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
      perfil = { email: p.email || user.email, nome: p.nome || user.displayName || "", is_admin: !!rs[1].exists };
      areaUsuario();
      return db.doc("userData/" + user.uid).get();
    }).then(function (snap) {
      var d = null;
      try { d = snap.exists ? JSON.parse(snap.data().json) : null; } catch (e) { d = null; }
      if (d && (Object.keys(d.respostas || {}).length || (d.hist || []).length || (d.novos || []).length || Object.keys(d.marcadas || {}).length)) APP.importar(d);
      else enviar();   // primeira vez: leva para a nuvem o que já havia neste navegador
    }).catch(function () { estado("☁!", "Não foi possível carregar seus dados da nuvem"); });
  }

  auth.onAuthStateChanged(function (user) {
    if (user) { entrou(user); return; }
    usuario = null; perfil = null; iniciado = null;
    $("user-area").hidden = true; $("tab-alunos").hidden = true;
    mostrarLogin("entrar");
  });

  // ---------- painel do administrador ----------
  var ordem = { chave: "acerto", asc: false };
  function pctDe(s) { return s.respondidas ? Math.round(100 * s.acertos / s.respondidas) : null; }

  function renderAlunos(painel) {
    painel.textContent = "";
    if (!perfil || !perfil.is_admin) { painel.appendChild(el("p", "muted", "Área restrita ao administrador.")); return; }
    painel.appendChild(el("h2", "resumo-titulo", "Alunos"));
    var info = el("p", "muted", "Carregando…"); painel.appendChild(info);
    Promise.all([db.collection("users").get(), db.collection("userStats").get()]).then(function (rs) {
      var st = {}; rs[1].forEach(function (d) { st[d.id] = d.data(); });
      var linhas = [];
      rs[0].forEach(function (d) {
        var p = d.data();
        var s = st[d.id] || { respondidas: 0, acertos: 0, simulados: 0, por_materia: {} };
        linhas.push({ p: { id: d.id, email: p.email || "", nome: p.nome || "", is_admin: false, created_at: p.createdAt }, s: s, acerto: pctDe(s), atividade: s.updatedAt || p.createdAt });
      });
      info.textContent = linhas.length + " pessoa(s) cadastrada(s). Clique em uma linha para ver o desempenho por matéria.";
      var det = el("div");
      var tab = el("table", "tabela");
      var cols = [["nome", "Nome"], ["email", "E-mail"], ["resp", "Respondidas"], ["acerto", "Acerto"], ["sim", "Simulados"], ["ultimo", "Último simulado"], ["atividade", "Atividade"]];
      function val(l, k) {
        return k === "nome" ? (l.p.nome || "").toLowerCase() : k === "email" ? l.p.email.toLowerCase() : k === "resp" ? l.s.respondidas :
          k === "acerto" ? (l.acerto == null ? -1 : l.acerto) : k === "sim" ? l.s.simulados : k === "ultimo" ? (l.s.ultimo_pct == null ? -1 : l.s.ultimo_pct) : l.atividade;
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
        linhas.slice().sort(function (a, b) {
          var x = val(a, ordem.chave), y = val(b, ordem.chave);
          return (x < y ? -1 : x > y ? 1 : 0) * (ordem.asc ? 1 : -1);
        }).forEach(function (l) {
          var r = el("tr", "aluno");
          [l.p.nome || "—", l.p.email + (l.p.is_admin ? " (admin)" : ""), String(l.s.respondidas), l.acerto == null ? "–" : l.acerto + "%", String(l.s.simulados),
           l.s.ultimo_pct == null ? "–" : l.s.ultimo_pct + "%", l.atividade ? new Date(l.atividade).toLocaleDateString("pt-BR") : "–"].forEach(function (t) { r.appendChild(el("td", null, t)); });
          r.addEventListener("click", function () { detalhe(det, l); });
          tb.appendChild(r);
        });
        tab.appendChild(tb);
      }
      desenha();
      var wrap = el("div", "tabela-wrap card"); wrap.appendChild(tab);
      painel.appendChild(wrap); painel.appendChild(det);
    }).catch(function (e) { info.textContent = "Não foi possível carregar os alunos: " + ((e && e.message) || e); });
  }

  function detalhe(cx, l) {
    cx.textContent = "";
    var c = el("div", "card");
    c.appendChild(el("h3", null, (l.p.nome || l.p.email)));
    c.appendChild(el("p", "muted", l.p.email + " · " + l.s.respondidas + " respondidas · " + (l.acerto == null ? "sem dados" : l.acerto + "% de acerto") + " · " + l.s.simulados + " simulado(s)"));
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
    cx.appendChild(c);
    c.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  window.NUVEM = { renderAlunos: renderAlunos };
})();
