// Service worker do Devorando ENEM: abre o site sem internet com o que já foi visto.
// Páginas e scripts: tenta a rede primeiro (para sempre pegar a versão nova) e cai no cache offline.
// Imagens das questões: cache na primeira vez que são vistas.
var V = "devorando-9ffaac50";
var BASE = ["./", "index.html", "data.js?v=ae022b46", "explicacoes.js?v=5484bc27", "meta.js?v=686eae73", "config.js?v=3510b160", "app.js?v=5c6f205e", "nuvem.js?v=823520e0", "admin.js?v=ae736f72", "redacao.js?v=3c112b06", "style.css?v=42e9b308", "logo.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(BASE.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  var imagem = u.pathname.indexOf("/img/") >= 0;
  if (imagem) {
    e.respondWith(caches.match(r).then(function (h) {
      return h || fetch(r).then(function (res) { if (res.ok) { var c = res.clone(); caches.open(V).then(function (ca) { ca.put(r, c); }); } return res; });
    }));
    return;
  }
  if (u.search.indexOf("v=") >= 0) {   // arquivos versionados (hash no endereço): o cache vale para sempre
    e.respondWith(caches.match(r).then(function (h) {
      return h || fetch(r).then(function (res) { if (res.ok) { var c = res.clone(); caches.open(V).then(function (ca) { ca.put(r, c); }); } return res; });
    }));
    return;
  }
  e.respondWith(fetch(r).then(function (res) {
    if (res.ok) { var c = res.clone(); caches.open(V).then(function (ca) { ca.put(r, c); }); }
    return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: true }).then(function (h) { return h || caches.match("index.html"); }); }));
});
