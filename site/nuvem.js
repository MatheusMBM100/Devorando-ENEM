(function () {
  "use strict";
  // Contas, sincronização na nuvem e painel do administrador (Supabase).
  // Sem configuração em config.js, nada disso é ativado e o site funciona localmente, como antes.
  var cfg = window.DEVORANDO_CFG || {};
  var APP = window.DEV_APP;
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase || !APP) return;

  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
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
  var iniciado = null;  // id do usuário já inicializado (evita repetir em renovações de sessão)

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
    var t = (e && e.message) || String(e);
    if (/Invalid login credentials/i.test(t)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(t)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    if (/already registered|already been registered/i.test(t)) return "Este e-mail já tem conta. Use a aba Entrar.";
    if (/Password should be at least/i.test(t)) return "A senha precisa ter pelo menos 6 caracteres.";
    if (/valid email|invalid format/i.test(t)) return "Informe um e-mail válido.";
    if (/rate limit|too many/i.test(t)) return "Muitas tentativas. Aguarde alguns minutos.";
    if (/network|fetch/i.test(t)) return "Sem conexão. Verifique a internet e tente de novo.";
    return "Não foi possível concluir: " + t;
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
        sb.auth.resetPasswordForEmail(em.value.trim(), { redirectTo: location.origin + location.pathname })
          .then(function (r) {
            if (r.error) msg(card, traduz(r.error), "erro");
            else msg(card, "Enviamos um link para redefinir a senha, se esse e-mail tiver conta.", "ok");
          });
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
        p = sb.auth.signUp({ email: email, password: senha, options: { data: { nome: nome.value.trim() }, emailRedirectTo: location.origin + location.pathname } })
          .then(function (r) {
            if (r.error) throw r.error;
            if (!r.data.session) msg(card, "Conta criada! Enviamos um e-mail de confirmação. Clique no link dele e depois entre aqui.", "ok");
          });
      } else {
        p = sb.auth.signInWithPassword({ email: email, password: senha }).then(function (r) { if (r.error) throw r.error; });
      }
      p.catch(function (e) { msg(card, traduz(e), "erro"); }).then(function () { ok.disabled = false; });
    });
    overlay.appendChild(card);
    setTimeout(function () { (nome || em).focus(); }, 50);
  }

  function mostrarNovaSenha() {
    overlay.hidden = false; overlay.textContent = "";
    var card = el("div", "auth-card");
    card.appendChild(el("h3", null, "Definir nova senha"));
    var form = el("form"); form.noValidate = true;
    var lp = el("label", "l", "Nova senha"); lp.htmlFor = "a-nova"; form.appendChild(lp);
    var se = el("input"); se.type = "password"; se.id = "a-nova"; se.autocomplete = "new-password"; form.appendChild(se);
    var ac = el("div", "acoes"); var ok = el("button", "btn", "Salvar nova senha"); ok.type = "submit"; ac.appendChild(ok); form.appendChild(ac);
    card.appendChild(form);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      sb.auth.updateUser({ password: se.value }).then(function (r) {
        if (r.error) msg(card, traduz(r.error), "erro");
        else { overlay.hidden = true; }
      });
    });
    overlay.appendChild(card);
  }

  // ---------- sessão ----------
  function areaUsuario() {
    var a = $("user-area"); a.textContent = ""; a.hidden = false;
    a.appendChild(el("span", null, (perfil && perfil.nome) || usuario.email));
    var st = el("span", "sync", "☁"); st.id = "sync-estado"; st.title = "Dados sincronizados"; a.appendChild(st);
    var sair = el("button", "ghost mini", "Sair"); sair.type = "button";
    sair.addEventListener("click", function () {
      sb.auth.signOut().then(function () { APP.limpar(); location.reload(); });
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
    return sb.from("user_data").upsert({ user_id: usuario.id, data: APP.exportar(), updated_at: agora })
      .then(function (r) {
        if (r.error) throw r.error;
        return sb.from("user_stats").upsert({ user_id: usuario.id, respondidas: s.respondidas, acertos: s.acertos, simulados: s.simulados,
          ultimo_pct: s.ultimo_pct, por_materia: s.por_materia, updated_at: agora });
      })
      .then(function (r) { if (r && r.error) throw r.error; estado("☁✔", "Dados sincronizados"); })
      .catch(function () { estado("☁!", "Falha ao sincronizar; tentaremos de novo na próxima alteração"); });
  }
  window.__sync = function () {
    if (!usuario) return;
    clearTimeout(timer);
    timer = setTimeout(enviar, 1500);
  };

  function entrou(session) {
    usuario = session.user;
    if (iniciado === usuario.id) return;
    iniciado = usuario.id;
    overlay.hidden = true;
    sb.from("profiles").select("*").eq("id", usuario.id).maybeSingle().then(function (r) {
      perfil = r.data || { email: usuario.email, nome: (usuario.user_metadata && usuario.user_metadata.nome) || "", is_admin: false };
      areaUsuario();
      return sb.from("user_data").select("data").eq("user_id", usuario.id).maybeSingle();
    }).then(function (r) {
      var d = r && r.data && r.data.data;
      if (d && (Object.keys(d.respostas || {}).length || (d.hist || []).length || (d.novos || []).length || Object.keys(d.marcadas || {}).length)) APP.importar(d);
      else if (!APP.vazio()) enviar();   // primeira vez: leva para a nuvem o que já havia neste navegador
      else enviar();
    }).catch(function () { estado("☁!", "Não foi possível carregar seus dados da nuvem"); });
  }

  sb.auth.onAuthStateChange(function (evento, session) {
    if (evento === "PASSWORD_RECOVERY") { mostrarNovaSenha(); return; }
    if (evento === "SIGNED_OUT") { usuario = null; perfil = null; iniciado = null; $("user-area").hidden = true; $("tab-alunos").hidden = true; mostrarLogin("entrar"); return; }
    if (session && (evento === "SIGNED_IN" || evento === "INITIAL_SESSION" || evento === "TOKEN_REFRESHED")) entrou(session);
  });
  sb.auth.getSession().then(function (r) {
    if (r.data && r.data.session) entrou(r.data.session);
    else mostrarLogin("entrar");
  });

  // ---------- painel do administrador ----------
  var ordem = { chave: "acerto", asc: false };
  function pctDe(s) { return s.respondidas ? Math.round(100 * s.acertos / s.respondidas) : null; }

  function renderAlunos(painel) {
    painel.textContent = "";
    if (!perfil || !perfil.is_admin) { painel.appendChild(el("p", "muted", "Área restrita ao administrador.")); return; }
    painel.appendChild(el("h2", "resumo-titulo", "Alunos"));
    var info = el("p", "muted", "Carregando…"); painel.appendChild(info);
    Promise.all([sb.from("profiles").select("id,email,nome,is_admin,created_at"), sb.from("user_stats").select("*")]).then(function (rs) {
      if (rs[0].error) throw rs[0].error;
      var st = {}; (rs[1].data || []).forEach(function (s) { st[s.user_id] = s; });
      var linhas = (rs[0].data || []).map(function (p) {
        var s = st[p.id] || { respondidas: 0, acertos: 0, simulados: 0, por_materia: {} };
        return { p: p, s: s, acerto: pctDe(s), atividade: s.updated_at || p.created_at };
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
