// 地理院タイル(標準地図・航空写真)を端末にキャッシュし、電波が弱い・無い現場でも
// 一度表示した範囲は見られるようにする(stale-while-revalidate)。他の通信には関与しない。
const TILE_CACHE = 'ecp-kijun-navi-gsi-tiles-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (!url.includes('cyberjapandata.gsi.go.jp')) return; // 地理院タイル以外は通常どおり
  event.respondWith(
    caches.open(TILE_CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        const network = fetch(event.request).then(resp => {
          // 画像タイルはno-corsで取得するためopaque応答(status 0)になるが、それも保存してよい
          if (resp) cache.put(event.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
