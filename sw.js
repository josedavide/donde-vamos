/* Service worker: deja la app instalable y usable sin cobertura.
   - Código y recursos propios: red primero; caché solo sin cobertura.
   - Datos (data/*.json): red primero, con copia en caché de respaldo.
   - Teselas de mapa y fotos: caché con límite, para volver a ver zonas ya visitadas. */
const V = "dv-v2";
const SHELL = ["./", "index.html", "assets/app.css", "assets/app.js", "assets/icons.js", "assets/icon.svg", "manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== V + "-tiles").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function trim(name, max) { const c = await caches.open(name); const ks = await c.keys(); if (ks.length > max) await Promise.all(ks.slice(0, ks.length - max).map(k => c.delete(k))); }
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const own = u.origin === location.origin;
  if (own && u.pathname.includes("/data/")) {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  if (own || /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(u.host)) {
    // red primero (siempre la última versión); caché si no hay cobertura
    e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(V).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  if (/tile|basemaps|arcgisonline|openstreetmap|opentopomap/.test(u.host)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) caches.open(V + "-tiles").then(c => { c.put(e.request, r.clone()); trim(V + "-tiles", 1500); }); return r; })));
  }
});
