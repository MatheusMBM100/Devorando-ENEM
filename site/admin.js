(function () {
  "use strict";
  // Seções da área de administração: Turmas, Reportes de erro, Administradores e Backup.
  // Depende de nuvem.js (window.NUVEM) e só roda para quem é administrador.
  var N = window.NUVEM;
  if (!N) return;
  var db = N.db, el = N.el;

  function dataBr(iso) { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch (e) { return ""; } }
  function tempo(s) { s = Math.round(s || 0); var m = Math.floor(s / 60), x = s % 60; return m + ":" + (x < 10 ? "0" : "") + x; }
  function lista(qs) { var a = []; qs.forEach(function (d) { a.push({ id: d.id, d: d.data() }); }); return a; }
  function carregando(cx) { var p = el("p", "muted", "Carregando…"); cx.appendChild(p); return p; }
  function erro(p, e) { p.textContent = "Não foi possível carregar: " + ((e && e.message) || e) + ". Confira se as regras mais recentes do Firestore foram publicadas."; }

  // ---------- Turmas ----------
  function turmas(cx) {
    cx.textContent = "";
    var info = carregando(cx);
    db.collection("turmas").get().then(function (qs) {
      info.textContent = "Crie turmas, coloque alunos nelas e envie simulados que aparecem para todos da turma. Você acompanha os resultados lado a lado.";
      var f = el("div", "filtro-linha");
      var nome = el("input"); nome.type = "text"; nome.placeholder = "Nome da nova turma (ex.: 3º A 2026)"; nome.style.maxWidth = "320px";
      var cr = el("button", "btn mini", "Criar turma"); cr.type = "button";
      cr.addEventListener("click", function () {
        if (!nome.value.trim()) { nome.focus(); return; }
        cr.disabled = true;
        db.collection("turmas").add({ nome: nome.value.trim(), alunos: [], criada: new Date().toISOString() })
          .then(function () { return N.recarregaTurmas(); }).then(function () { turmas(cx); })
          .catch(function () { cr.disabled = false; alert("Não foi possível criar a turma."); });
      });
      f.appendChild(nome); f.appendChild(cr); cx.appendChild(f);
      var ls = lista(qs);
      if (!ls.length) cx.appendChild(el("p", "muted", "Nenhuma turma ainda."));
      ls.forEach(function (t) {
        var row = el("div", "hist-row novo");
        var i = el("div"); i.appendChild(el("b", null, t.d.nome || t.id));
        i.appendChild(el("div", "muted", (t.d.alunos || []).length + " aluno(s) · criada em " + dataBr(t.d.criada)));
        row.appendChild(i);
        var ab = el("button", "btn mini", "Abrir"); ab.type = "button";
        ab.addEventListener("click", function () { abrirTurma(cx, t.id); });
        row.appendChild(ab); row.appendChild(el("span"));
        cx.appendChild(row);
      });
    }).catch(function (e) { erro(info, e); });
  }

  // Visão geral da turma: médias, matérias mais fracas e quem precisa de atenção.
  function visaoTurma(alunos, stats, res, nomeDe) {
    var c = el("div", "card");
    c.appendChild(el("h4", "sub", "Visão geral da turma"));
    var resp = 0, ac = 0, mats = {}, agora = Date.now(), parados = [], baixos = [];
    alunos.forEach(function (uid) {
      var s = stats[uid];
      var ult = s && s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
      if (!s || !s.respondidas) { parados.push({ uid: uid, txt: "ainda não respondeu questões" }); return; }
      resp += s.respondidas; ac += s.acertos;
      var p = Math.round(100 * s.acertos / s.respondidas);
      if (agora - ult > 7 * 86400000) parados.push({ uid: uid, txt: "sem atividade há " + Math.floor((agora - ult) / 86400000) + " dias" });
      else if (p < 50 && s.respondidas >= 20) baixos.push({ uid: uid, txt: p + "% de acerto em " + s.respondidas + " questões" });
      var pm = s.por_materia || {};
      Object.keys(pm).forEach(function (m) { var o = mats[m] = mats[m] || { n: 0, ok: 0 }; o.n += pm[m].n || 0; o.ok += pm[m].ok || 0; });
    });
    var med = res.length ? Math.round(res.reduce(function (a, r) { return a + (r.pct || 0); }, 0) / res.length) : null;
    var grid = el("div", "stats-grid");
    function stat(v, rot) { var s = el("div", "stat"); s.appendChild(el("b", null, v)); s.appendChild(el("span", null, rot)); grid.appendChild(s); }
    stat(String(alunos.length), "alunos");
    stat(resp ? Math.round(100 * ac / resp) + "%" : "–", "acerto geral da turma");
    stat(med != null ? med + "%" : "–", "média nos simulados da turma");
    stat(String(parados.length), "sem atividade (7+ dias)");
    c.appendChild(grid);
    var lm = Object.keys(mats).filter(function (m) { return mats[m].n >= 10; }).sort(function (a, b) { return mats[a].ok / mats[a].n - mats[b].ok / mats[b].n; });
    if (lm.length) {
      c.appendChild(el("b", null, "Matérias, da mais fraca para a mais forte"));
      lm.forEach(function (m) {
        var o = mats[m], pc = Math.round(100 * o.ok / o.n), row = el("div", "barra-l");
        row.appendChild(el("span", null, m));
        var b = el("div", "barra"), i = el("i"); i.style.width = pc + "%"; b.appendChild(i); row.appendChild(b);
        row.appendChild(el("span", "muted", pc + "% (" + o.n + ")"));
        c.appendChild(row);
      });
    } else c.appendChild(el("p", "muted", "Ainda não há respostas suficientes para comparar as matérias (mínimo de 10 por matéria)."));
    var atencao = baixos.concat(parados);
    if (atencao.length) {
      var h = el("b", null, "Precisam de atenção (" + atencao.length + ")"); h.style.display = "block"; h.style.marginTop = "14px"; c.appendChild(h);
      atencao.forEach(function (x) { c.appendChild(el("div", "muted", "• " + nomeDe(x.uid) + " — " + x.txt)); });
    }
    return c;
  }

  function abrirTurma(cx, id) {
    cx.textContent = "";
    var info = carregando(cx);
    Promise.all([db.doc("turmas/" + id).get(), db.collection("users").get(), db.collection("turmas/" + id + "/simulados").get(), db.collection("turmas/" + id + "/resultados").get(), db.collection("userStats").get(), db.collection("turmas/" + id + "/ranking").get()]).then(function (rs) {
      cx.textContent = "";
      var t = rs[0].data() || {}, alunos = t.alunos || [];
      var users = {}; rs[1].forEach(function (u) { users[u.id] = u.data() || {}; });
      var sims = lista(rs[2]).sort(function (a, b) { return String(b.d.criado).localeCompare(String(a.d.criado)); });
      var res = lista(rs[3]).map(function (r) { return r.d; });
      var nomeDe = function (uid) { var u = users[uid] || {}; return u.nome || u.email || uid; };
      var stats = {}; rs[4].forEach(function (s) { stats[s.id] = s.data() || {}; });

      var voltar = el("button", "ghost mini", "← Todas as turmas"); voltar.type = "button";
      voltar.addEventListener("click", function () { turmas(cx); });
      cx.appendChild(voltar);
      cx.appendChild(el("h3", null, t.nome || id));

      // ranking da turma: o administrador sempre vê; escolhe, aluno por aluno, quem também pode ver
      var cRk = el("div", "card");
      cRk.appendChild(el("h4", "sub", "Ranking da turma"));
      cRk.appendChild(el("p", "muted", "Só você vê esta lista. Os alunos não sabem que ela existe, a menos que você libere para algum deles."));
      var rk = {}; rs[5].forEach(function (x) { rk[x.id] = x.data() || {}; });
      var itensRk = alunos.map(function (uid) {
        var x = rk[uid] || {}, s = stats[uid] || {};
        return { uid: uid, nome: nomeDe(uid), dias: x.d || null, respondidas: x.respondidas != null ? x.respondidas : (s.respondidas || 0), acertos: x.acertos != null ? x.acertos : (s.acertos || 0) };
      });
      if (!itensRk.length) cRk.appendChild(el("p", "muted", "Esta turma ainda não tem alunos."));
      else {
        var corpoRk = el("div"); cRk.appendChild(corpoRk);
        N.montaRanking(corpoRk, itensRk, { extra: function (it, linha) {
          var u = users[it.uid] || {};
          var bv = el("button", u.verRanking ? "btn mini" : "ghost mini", u.verRanking ? "Aluno vê: sim" : "Aluno vê: não"); bv.type = "button";
          bv.addEventListener("click", function () {
            var novo = !u.verRanking; bv.disabled = true;
            db.doc("users/" + it.uid).update({ verRanking: novo }).then(function () { u.verRanking = novo; users[it.uid] = u; bv.disabled = false; bv.textContent = novo ? "Aluno vê: sim" : "Aluno vê: não"; bv.className = novo ? "btn mini" : "ghost mini"; })
              .catch(function () { bv.disabled = false; alert("Não foi possível alterar. Confira se as regras do Firestore foram publicadas."); });
          });
          linha.appendChild(bv);
        } });
      }
      cx.appendChild(cRk);

      cx.appendChild(visaoTurma(alunos, stats, res, nomeDe));

      // alunos
      var ca = el("div", "card");
      ca.appendChild(el("h4", "sub", "Alunos da turma (" + alunos.length + ")"));
      alunos.forEach(function (uid) {
        var l = el("div", "hist-row novo");
        l.appendChild(el("span", null, nomeDe(uid) + (users[uid] && users[uid].email ? " — " + users[uid].email : "")));
        var rm = el("button", "ghost mini", "Remover"); rm.type = "button";
        rm.addEventListener("click", function () {
          db.doc("turmas/" + id).update({ alunos: alunos.filter(function (x) { return x !== uid; }) }).then(function () { abrirTurma(cx, id); });
        });
        l.appendChild(rm); l.appendChild(el("span"));
        ca.appendChild(l);
      });
      var fa = el("div", "filtro-linha");
      var sel = el("select"); var o0 = el("option", null, "Escolha um aluno para adicionar…"); o0.value = ""; sel.appendChild(o0);
      Object.keys(users).filter(function (u) { return alunos.indexOf(u) < 0; }).sort(function (a, b) { return nomeDe(a).localeCompare(nomeDe(b)); })
        .forEach(function (u) { var o = el("option", null, nomeDe(u) + " (" + (users[u].email || "") + ")"); o.value = u; sel.appendChild(o); });
      var add = el("button", "btn mini", "Adicionar"); add.type = "button";
      add.addEventListener("click", function () {
        if (!sel.value) return;
        db.doc("turmas/" + id).update({ alunos: alunos.concat([sel.value]) }).then(function () { abrirTurma(cx, id); });
      });
      fa.appendChild(sel); fa.appendChild(add); ca.appendChild(fa);
      cx.appendChild(ca);

      // simulados e resultados
      var cs = el("div", "card");
      cs.appendChild(el("h4", "sub", "Simulados enviados (" + sims.length + ")"));
      cs.appendChild(el("p", "muted", "Para enviar um simulado: na aba Simulado, em “Criar novo simulado”, escolha esta turma no campo “Enviar para uma turma”."));
      sims.forEach(function (s) {
        var rr = res.filter(function (r) { return r.sim === s.id; });
        var fez = {}; rr.forEach(function (r) { fez[r.uid] = true; });
        var pend = alunos.filter(function (u) { return !fez[u]; });
        var med = rr.length ? Math.round(rr.reduce(function (a, r) { return a + (r.pct || 0); }, 0) / rr.length) : null;
        var bloco = el("div", "card");
        bloco.appendChild(el("b", null, s.d.nome));
        bloco.appendChild(el("p", "muted", (s.d.ids || []).length + " questões · enviado em " + dataBr(s.d.criado) + " · " + rr.length + " resultado(s)" + (med != null ? " · média " + med + "%" : "")));
        if (rr.length) {
          var tb = el("table", "tabela");
          var th = el("tr"); ["Aluno", "Acertos", "%", "Tempo", "Data"].forEach(function (x) { th.appendChild(el("th", null, x)); });
          var hd = el("thead"); hd.appendChild(th); tb.appendChild(hd);
          var body = el("tbody");
          rr.sort(function (a, b) { return (b.pct || 0) - (a.pct || 0); }).forEach(function (r) {
            var tr = el("tr");
            [r.nome || nomeDe(r.uid), (r.acertos || 0) + "/" + (r.total || 0), (r.pct || 0) + "%", tempo(r.tempo), dataBr(r.fimEm)].forEach(function (x) { tr.appendChild(el("td", null, x)); });
            body.appendChild(tr);
          });
          tb.appendChild(body);
          N.rotula(tb); var w = el("div", "tabela-wrap"); w.appendChild(tb); bloco.appendChild(w);
        }
        if (pend.length) bloco.appendChild(el("p", "muted", "Ainda não fizeram: " + pend.map(nomeDe).join(", ")));
        var ex = el("button", "ghost mini", "Excluir simulado"); ex.type = "button";
        ex.addEventListener("click", function () {
          if (!confirm("Excluir este simulado e os resultados dos alunos?")) return;
          Promise.all([db.doc("turmas/" + id + "/simulados/" + s.id).delete()].concat(
            rr.map(function (r) { return db.doc("turmas/" + id + "/resultados/" + s.id + "_" + r.uid).delete(); })
          )).then(function () { abrirTurma(cx, id); });
        });
        bloco.appendChild(ex);
        cs.appendChild(bloco);
      });
      cx.appendChild(cs);

      var del = el("button", "ghost mini", "Excluir turma"); del.type = "button";
      del.addEventListener("click", function () {
        if (!confirm("Excluir a turma “" + (t.nome || id) + "”, seus simulados e resultados?")) return;
        var tarefas = [];
        sims.forEach(function (s) { tarefas.push(db.doc("turmas/" + id + "/simulados/" + s.id).delete()); });
        lista(rs[3]).forEach(function (r) { tarefas.push(db.doc("turmas/" + id + "/resultados/" + r.id).delete()); });
        Promise.all(tarefas).then(function () { return db.doc("turmas/" + id).delete(); }).then(function () { return N.recarregaTurmas(); }).then(function () { turmas(cx); });
      });
      cx.appendChild(del);
    }).catch(function (e) { erro(info, e); });
  }

  // ---------- Reportes de erro ----------
  function reportes(cx) {
    var info = carregando(cx);
    db.collection("reports").get().then(function (qs) {
      var ls = lista(qs).sort(function (a, b) { return String(b.d.criado).localeCompare(String(a.d.criado)); });
      info.textContent = ls.length + " reporte(s). Os reportes feitos por pessoas logadas chegam aqui.";
      var barra = el("div", "filtro-linha");
      var fs = el("select");
      [["novo", "Novos"], ["resolvido", "Resolvidos"], ["todos", "Todos"]].forEach(function (x) { var o = el("option", null, x[1]); o.value = x[0]; fs.appendChild(o); });
      barra.appendChild(fs); cx.appendChild(barra);
      var corpo = el("div"); cx.appendChild(corpo);
      function desenha() {
        corpo.textContent = "";
        var vis = ls.filter(function (r) { return fs.value === "todos" || (r.d.status || "novo") === fs.value; });
        if (!vis.length) corpo.appendChild(el("p", "muted", "Nenhum reporte nesta lista."));
        vis.forEach(function (r) {
          var c = el("div", "card");
          var geral = r.d.questao === "geral";
          c.appendChild(el("b", null, geral ? "Erro no site (reporte geral)" : "ENEM " + r.d.ano + " · questão " + r.d.numero + " (" + r.d.questao + ")"));
          if (!geral) c.appendChild(el("p", "muted", (r.d.materia || "") + (r.d.assunto ? " — " + r.d.assunto : "") + " · gabarito no site: " + (r.d.gabarito || "?")));
          var m = el("p", null, r.d.mensagem); m.style.whiteSpace = "pre-line"; c.appendChild(m);
          c.appendChild(el("p", "muted", "Por " + (r.d.nome || "—") + " (" + (r.d.email || "") + ") em " + dataBr(r.d.criado) + " · " + (r.d.status || "novo")));
          var ac = el("div", "acoes");
          var st = el("button", "btn mini", (r.d.status || "novo") === "resolvido" ? "Reabrir" : "Marcar como resolvido"); st.type = "button";
          st.addEventListener("click", function () {
            var novo = (r.d.status || "novo") === "resolvido" ? "novo" : "resolvido";
            db.doc("reports/" + r.id).update({ status: novo }).then(function () { r.d.status = novo; desenha(); });
          });
          var ex = el("button", "ghost mini", "Excluir"); ex.type = "button";
          ex.addEventListener("click", function () {
            if (!confirm("Excluir este reporte?")) return;
            db.doc("reports/" + r.id).delete().then(function () { ls = ls.filter(function (x) { return x !== r; }); desenha(); });
          });
          ac.appendChild(st); ac.appendChild(ex); c.appendChild(ac);
          corpo.appendChild(c);
        });
      }
      fs.addEventListener("change", desenha); desenha();
    }).catch(function (e) { erro(info, e); });
  }

  // ---------- Administradores ----------
  function admins(cx) {
    var info = carregando(cx);
    Promise.all([db.collection("admins").get(), db.collection("users").get()]).then(function (rs) {
      info.textContent = "Administradores veem os dados de todos os alunos e gerenciam turmas, reportes e backup.";
      var users = {}; rs[1].forEach(function (u) { users[u.id] = u.data() || {}; });
      var eu = N.user() && N.user().uid;
      lista(rs[0]).forEach(function (a) {
        var u = users[a.id] || {};
        var l = el("div", "hist-row novo");
        l.appendChild(el("span", null, (u.nome || "—") + " — " + (u.email || a.id) + (a.id === eu ? " (você)" : "")));
        if (a.id !== eu) {
          var rm = el("button", "ghost mini", "Remover acesso"); rm.type = "button";
          rm.addEventListener("click", function () {
            if (!confirm("Remover o acesso de administrador de " + (u.nome || u.email) + "?")) return;
            db.doc("admins/" + a.id).delete().then(function () { cx.textContent = ""; admins(cx); });
          });
          l.appendChild(rm);
        } else l.appendChild(el("span"));
        l.appendChild(el("span"));
        cx.appendChild(l);
      });
      var f = el("div", "filtro-linha");
      var em = el("input"); em.type = "email"; em.placeholder = "E-mail de quem já tem conta no site"; em.style.maxWidth = "300px";
      var add = el("button", "btn mini", "Tornar administrador"); add.type = "button";
      var st = el("p", "muted");
      add.addEventListener("click", function () {
        var e = em.value.trim().toLowerCase();
        if (!e) { em.focus(); return; }
        var uid = Object.keys(users).filter(function (k) { return (users[k].email || "").toLowerCase() === e; })[0];
        if (!uid) { st.textContent = "Nenhuma conta com esse e-mail. A pessoa precisa criar a conta primeiro."; return; }
        db.doc("admins/" + uid).set({ ativo: true, desde: new Date().toISOString() }).then(function () { cx.textContent = ""; admins(cx); })
          .catch(function () { st.textContent = "Não foi possível promover."; });
      });
      f.appendChild(em); f.appendChild(add); cx.appendChild(f); cx.appendChild(st);
    }).catch(function (e) { erro(info, e); });
  }

  // ---------- Backup ----------
  function backup(cx) {
    cx.appendChild(el("p", null, "Baixe uma cópia de todos os dados (contas, respostas, simulados, turmas, resultados e reportes) em um arquivo JSON. Guarde-o fora do site, por exemplo no Google Drive."));
    cx.appendChild(el("p", "muted", "Recomendação: baixe uma vez por semana. O arquivo contém dados pessoais dos alunos; trate-o com cuidado e não o compartilhe."));
    var st = el("p", "muted");
    var b = el("button", "btn", "Baixar backup completo"); b.type = "button";
    b.addEventListener("click", function () {
      b.disabled = true; st.textContent = "Reunindo os dados…";
      var out = { geradoEm: new Date().toISOString(), colecoes: {} };
      function col(nome) {
        return db.collection(nome).get().then(function (qs) { out.colecoes[nome] = {}; qs.forEach(function (d) { out.colecoes[nome][d.id] = d.data(); }); return qs; });
      }
      Promise.all(["users", "userStats", "userData", "admins", "reports"].map(col)).then(function () { return col("turmas"); }).then(function (ts) {
        var ids = []; ts.forEach(function (t) { ids.push(t.id); });
        return Promise.all(ids.map(function (id) {
          return Promise.all([col("turmas/" + id + "/simulados"), col("turmas/" + id + "/resultados")]);
        }));
      }).then(function () {
        var d = new Date(), nome = "backup-devorando-enem-" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + ".json";
        N.baixar(nome, JSON.stringify(out, null, 1), "application/json");
        st.textContent = "Backup gerado: " + nome + " (" + Object.keys(out.colecoes.users || {}).length + " conta(s)).";
      }).catch(function (e) { st.textContent = "Não foi possível gerar o backup: " + ((e && e.message) || e); }).then(function () { b.disabled = false; });
    });
    cx.appendChild(b); cx.appendChild(st);
    cx.appendChild(el("h4", "sub", "Backup automático (opcional)"));
    cx.appendChild(el("p", "muted", "O Firebase também faz exportações agendadas do Firestore para o Google Cloud Storage, mas isso exige o plano Blaze (com cartão). Veja firebase/LEIA-ME.md."));
  }

  window.NUVEM_ADMIN = { turmas: turmas, reportes: reportes, admins: admins, backup: backup };
})();
