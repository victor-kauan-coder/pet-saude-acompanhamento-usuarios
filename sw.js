// ─── VERSÃO ────────────────────────────────────────────────────────────────
// Troque este número a cada deploy para forçar a detecção de atualização.
// Sugestão: use a data do deploy, ex: "20250616-1"
const VERSION = "20250616-1";
const CACHE = "pet-saude-v" + VERSION;
const BASE = "/pet-saude-acompanhamento-usuarios";
const ASSETS = [
  BASE + "/index.html",
  BASE + "/manifest.json",
  BASE + "/icon-192.png",
  BASE + "/icon-512.png",
];

// Instala e faz cache dos arquivos principais
// skipWaiting() imediato: o novo SW assume sem precisar fechar o app.
// O app detecta a troca via controllerchange e recarrega sozinho.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting(); // Assume imediatamente após instalar
});

// Remove caches antigos, assume o controle e notifica todos os clientes
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Avisa todas as abas/janelas abertas que há uma versão nova
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: "SW_UPDATED", version: VERSION }),
          );
        });
      }),
  );
});

// Mensagens vindas do app
self.addEventListener("message", (e) => {
  // Mantido para compatibilidade, mas skipWaiting já ocorre no install
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Estratégia: Firebase e fontes sempre vão à rede; resto usa cache
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // Nunca intercepta Firebase, Google Fonts, OAuth ou APIs externas
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase") ||
    url.includes("googleapis.com") ||
    url.includes("gstatic.com") ||
    url.includes("fonts.google") ||
    url.includes("accounts.google.com")
  ) {
    e.respondWith(
      fetch(e.request).catch(() => new Response("", { status: 503 })),
    );
    return;
  }

  // Network first para o index.html — garante que sempre busca versão nova
  // quando online, mas cai no cache se offline
  if (url.endsWith("/index.html") || url.endsWith("/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(BASE + "/index.html")),
    );
    return;
  }

  // Cache first, network fallback para demais assets
  e.respondWith(
    caches
      .match(e.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        });
      })
      .catch(() => caches.match(BASE + "/index.html")),
  );
});
