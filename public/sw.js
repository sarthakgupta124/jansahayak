/**
 * Service worker.
 *
 * The offline goal used to be small: keep the findings from the last check
 * readable when the connection drops. It is bigger now. The rule pack is
 * compiled into the app bundle and evaluated in the browser (src/engine.js),
 * so a citizen with no signal at all can attach documents, run a NEW check and
 * get a full verdict with every fix — not merely re-read an old one.
 *
 * What that changes here: the bundle is no longer just an asset, it is the
 * engine, so it is precached by name rather than left to be picked up
 * opportunistically on first fetch. Missing it would mean the offline promise
 * held only for people who had already loaded the page twice.
 *
 * The rest stands: GET API responses are cached stale-while-revalidate, and any
 * API request that fails offline returns a readable JSON error rather than an
 * unhandled rejection. Mutating requests are never cached and never queued —
 * silently replaying a submission later would be worse than failing now.
 */

const VERSION = 'jansahayak-v8';
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

/**
 * The hashed bundle carries the rule engine, so it has to be in the cache
 * before the first time the network is gone — not merely after a second visit.
 * Its name changes on every build, so it is read out of index.html rather than
 * hard-coded, which would go stale on the very next deploy.
 */
async function precacheShell(cache) {
  await cache.addAll(SHELL_URLS);
  try {
    const html = await (await cache.match('/index.html'))?.text();
    if (!html) return;
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
    if (assets.length) await cache.addAll(assets);
  } catch { /* the opportunistic handler below is still there as a fallback */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => precacheShell(cache))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // fonts etc. use their own caching

  // PDFs are generated per case and must never be served stale.
  if (url.pathname.endsWith('.pdf')) return;

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/meta' || url.pathname === '/api/health') {
      event.respondWith(networkFirst(request));
      return;
    }
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Navigation: network first so a deploy is picked up, shell as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || offlineShell()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(SHELL).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => cached))
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);

  if (cached) {
    network.catch(() => {});
    return cached;
  }
  const fresh = await network;
  if (fresh) return fresh;

  return new Response(
    JSON.stringify({
      error: 'You are offline, and this answer is not in your device cache yet.',
      offline: true,
      recover: 'The compliance check itself does not need the network — it runs on this device, and your documents are not uploaded to run it. Reconnect only to save the case and download the PDFs.'
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

async function networkFirst(request) {
  const cache = await caches.open(DATA);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'You are offline.', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function offlineShell() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Offline — JanSahayak</title>'
    + '<div style="font-family:system-ui,sans-serif;padding:2rem;max-width:34rem;margin:auto;line-height:1.6">'
    + '<h1 style="font-size:1.4rem">You are offline</h1>'
    + '<p>JanSahayak has not been opened on this device yet, so there is nothing cached to show you.</p>'
    + '<p>Once you have opened it while connected, your findings and fix instructions stay readable offline.</p>'
    + '</div>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
