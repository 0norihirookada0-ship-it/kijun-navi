// ECP基準点ナビ v0.2 の Service Worker(2026-11-23)
// - アプリ本体(index.html・lib/)は「まず取りに行き、取れなければ保存分」。新しい版がすぐ届き、電波が無くても開ける。
// - 地理院タイルは「保存分があればそれ、無ければ取りに行って保存」。正しく取れた物(200)だけを、最大 2,000 枚まで残す。
//   v0.1 は中身の見えない形(opaque)で上限なく保存していたため、Chrome では端末の容量をすぐ使い切っていた。
// - 版が上がったら、古い保存(v0.1 の分も)を消す。
const APP_CACHE = 'kijun-navi-app-v4';
const TILE_CACHE = 'kijun-navi-tiles-v2';
const TILE_MAX = 2000;
const APP_FILES = ['./', './index.html', './lib/leaflet.js', './lib/leaflet.css', './manifest.webmanifest', './img/icon192.png', './img/cat_head.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

let putCount = 0;
async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  const over = keys.length - TILE_MAX;
  for (let i = 0; i < over; i++) await c.delete(keys[i]); // 古いものから消す
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'cyberjapandata.gsi.go.jp') {
    event.respondWith((async () => {
      const c = await caches.open(TILE_CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const resp = await fetch(req);
      if (resp && resp.status === 200 && resp.type !== 'opaque') {
        c.put(req, resp.clone()).then(() => { if (++putCount % 100 === 0) trimTiles(); }).catch(() => {});
      }
      return resp;
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req, { cache: 'no-cache' });
        if (resp && resp.status === 200) { const copy = resp.clone(); caches.open(APP_CACHE).then(c => c.put(req, copy)).catch(() => {}); }
        return resp;
      } catch {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw new Error('offline');
      }
    })());
  }
});
