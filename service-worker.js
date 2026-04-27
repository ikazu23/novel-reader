// 小説リーダー Service Worker
// 更新時はこのバージョン番号を上げる
const CACHE_VERSION = 'v66';
const CACHE_NAME = `novel-reader-${CACHE_VERSION}`;

// 完全オフライン用にキャッシュするリソース
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// インストール時：必要なリソースをキャッシュして即座に有効化
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // 待機せず即座に新SWを有効化
  );
});

// 有効化時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// クライアントから SKIP_WAITING を受け取ったら待機中SWを有効化
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// フェッチ：HTMLはネットワーク優先、それ以外はキャッシュ優先
self.addEventListener('fetch', event => {
  const req = event.request;

  // GET以外はそのまま通す
  if (req.method !== 'GET') return;

  // 同一オリジンのみ処理（外部フォントは別扱い）
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') ||
                        url.hostname.includes('fonts.gstatic.com');

  if (!isSameOrigin && !isGoogleFonts) return;

  const accept = req.headers.get('accept') || '';
  const isHtml = accept.includes('text/html');

  if (isHtml && isSameOrigin) {
    // HTML: ネットワーク優先（更新検知のため）、失敗時キャッシュ
    event.respondWith(
      fetch(req).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // それ以外: キャッシュ優先、なければネットワーク → キャッシュ追加
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      });
    })
  );
});
