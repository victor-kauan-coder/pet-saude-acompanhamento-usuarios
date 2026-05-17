const CACHE = "pet-saude-v2";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Instala e faz cache dos arquivos principais
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Remove caches antigos
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Firebase e fontes sempre vão à rede; resto usa cache
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // Nunca intercepta Firebase, Google Fonts ou APIs externas
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase") ||
    url.includes("googleapis.com") ||
    url.includes("gstatic.com") ||
    url.includes("fonts.google")
  ) {
    e.respondWith(
      fetch(e.request).catch(() => new Response("", { status: 503 }))
    );
    return;
  }

  // Cache first, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match("./index.html"))
  );
});
