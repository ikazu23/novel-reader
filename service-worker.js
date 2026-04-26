// 小説リーダー Service Worker
// バージョン番号を変えるとキャッシュが更新される
const CACHE_VERSION = 'v1';
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

// インストール時：必要なリソースをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
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

// フェッチ：キャッシュ優先、なければネットワーク → キャッシュ追加
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

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        // 成功したレスポンスのみキャッシュ
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      }).catch(() => {
        // ネットワーク失敗時：HTMLならindex.htmlを返す
        if (req.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
