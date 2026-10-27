// ===== イカ墨ノベル用 Worker =====
// 役割：
//   【ログイン中継】
//   POST /token   { code, redirect_uri }  → 認可コードをアクセス＋リフレッシュトークンに交換
//   POST /refresh { refresh_token }       → 新しいアクセストークンを発行
//   【利用者数】
//   GET  /stats?key=…                     → 利用者数を見る（自分用）
//   【作品公開】
//   POST /publish   { access_token, workId?, indexFileId, meta }  → 作品を登録・更新（作者）
//   POST /unpublish { access_token, workId }                      → 公開をやめる（作者）
//   GET  /w/:id              → 作品の情報（題名・ジャンル・あらすじ・話数・状態）
//   GET  /w/:id/cover        → 表紙画像
//   GET  /w/:id/index        → 目次（各話の更新日時）※作者のドライブから中継
//   GET  /w/:id/ep/:epId     → 1話分の本文 ※作者のドライブから中継
//   GET  /share/:id          → SNS用のカード付き共有ページ（アプリへ自動で移動）
//   GET  /works?sort=popular|new|updated&genre=…&q=…&ak=…&r18=1 → 作品一覧（いいね順・新着順・更新順／検索・作者・R18を含める）
//   POST /like   { workId, device, like }        → いいね／取り消し
//   POST /report { workId, reason, detail }  → 通報
//   GET  /profile?ak=…        → 作者プロフィール（ペンネーム・ひとこと）
//   POST /profile { access_token, name, bio }    → 自分のプロフィールを登録・変更（get:true で読むだけ）
//   POST /hit    { workId, device, kind: read|add } → 読まれた・本棚に入れた（D1があるときだけ数える）
//   GET  /works?sort=rank&period=day|week|month|all → 期間ランキング（D1があるとき）
//   GET  /admin?key=…        → 管理ページ（通報の確認・公開停止）
//
// 本文は作者自身のGoogleドライブに置かれ、ここには保存しない（中継するだけ）。
// 作品の登録情報・通報・利用者数は KV（STATS）に保存する。
//
// Cloudflare の「設定 → 変数とシークレット」：
//   GOOGLE_CLIENT_ID      （テキスト）
//   GOOGLE_CLIENT_SECRET  （シークレット）
//   GOOGLE_API_KEY        （シークレット）… 公開された作品ファイルを読むためのAPIキー（Drive API のみ許可）
//   ALLOWED_ORIGINS       （テキスト）… 例: https://ikazu23.github.io,https://localhost,http://localhost
//   STATS_KEY             （シークレット）… /stats と /admin を開くための合言葉
//   APP_URL               （テキスト・省略可）… 既定: https://ikazu23.github.io/novel-reader/
//   REPORT_WEBHOOK        （シークレット・省略可）… 通報が来たら知らせる先（DiscordのウェブフックURLなど）
// 「設定 → バインディング」（省略可）：D1 データベース  変数名 DB … 読まれた数・期間ランキング用（KVは書き込み回数が少ないため）
// 「設定 → バインディング」：KV 名前空間  変数名 STATS

const DAY_TTL = 60 * 60 * 24 * 40; // 利用者数の日別記録は40日で自動削除
const DEFAULT_APP_URL = 'https://ikazu23.github.io/novel-reader/';
const MAX_COVER_BYTES = 400 * 1024;
const GENRES = ['ファンタジー','恋愛','現代','SF','ミステリー','ホラー','歴史','コメディ','BL','GL','その他'];
const RATINGS = ['', 'R15', 'R18'];
function maxRating(a, b) { return RATINGS.indexOf(a) >= RATINGS.indexOf(b) ? a : b; }
const REASONS = { translation: '翻訳作品', copy: '無断転載・盗作', adult: '不適切な内容', spam: 'スパム・荒らし', other: 'その他' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200, extra = {}) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      // ── ブラウザで直接開くページ（オリジン確認なし） ──
      if (request.method === 'GET' && path === '/stats') return handleStats(url, env);
      if (request.method === 'GET' && path === '/admin') return handleAdmin(url, env);
      if (request.method === 'POST' && path === '/admin/action') return handleAdminAction(request, env);
      let m;
      if (request.method === 'GET' && (m = path.match(/^\/share\/([A-Za-z0-9]+)$/))) return handleShare(m[1], url, env);
      if (request.method === 'GET' && (m = path.match(/^\/w\/([A-Za-z0-9]+)\/cover$/))) return handleCover(m[1], env);

      // ── ここから先はアプリからのみ ──
      if (origin && !originOk) return json({ error: 'origin_not_allowed', origin }, 403);

      if (request.method === 'GET') {
        if ((m = path.match(/^\/w\/([A-Za-z0-9]+)$/))) return json(await getWorkPublicMeta(env, m[1], url));
        if (path === '/works') return json(await handleWorks(url, env));
        if (path === '/profile') return json(await getProfilePublic(env, url.searchParams.get('ak') || ''));
        if ((m = path.match(/^\/w\/([A-Za-z0-9]+)\/index$/))) return handleIndex(m[1], env, ctx, json);
        if ((m = path.match(/^\/w\/([A-Za-z0-9]+)\/ep\/([A-Za-z0-9_\-]+)$/))) return handleEpisode(m[1], m[2], url, env, ctx, cors);
        return json({ error: 'not_found' }, 404);
      }
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      if (!originOk) return json({ error: 'origin_not_allowed', origin }, 403);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

      if (path === '/token' || path === '/refresh') return handleToken(path, body, env, ctx, json);
      if (path === '/publish') return handlePublish(body, env, json);
      if (path === '/unpublish') return handleUnpublish(body, env, json);
      if (path === '/mine') return handleMine(body, env, json);
      if (path === '/report') return handleReport(body, env, json, ctx);
      if (path === '/profile') return handleProfile(body, env, json);
      if (path === '/hit') return handleHit(body, env, json);
      if (path === '/like') return handleLike(body, env, json);
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server_error', detail: String(e && e.message || e) }, 500);
    }
  },
};

/* ══════════════ ログイン中継 ══════════════ */
async function handleToken(path, body, env, ctx, json) {
  const params = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET });
  if (path === '/token') {
    if (!body.code) return json({ error: 'no_code' }, 400);
    params.set('grant_type', 'authorization_code');
    params.set('code', body.code);
    params.set('redirect_uri', body.redirect_uri || ''); // Android の serverAuthCode は空文字
  } else {
    if (!body.refresh_token) return json({ error: 'no_refresh_token' }, 400);
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', body.refresh_token);
  }
  const g = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
  });
  const data = await g.json();
  if (!g.ok) {
    return json({ error: data.error || 'google_error', detail: data.error_description || '' },
      data.error === 'invalid_grant' ? 401 : 502);
  }
  const rt = path === '/refresh' ? body.refresh_token : data.refresh_token;
  if (rt && env.STATS) ctx.waitUntil(recordUser(env, rt).catch(() => {}));
  return json({ access_token: data.access_token, expires_in: data.expires_in, refresh_token: data.refresh_token || null });
}

/* ══════════════ 利用者数 ══════════════ */
function jstDate(offsetDays = 0) {
  return new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000).toISOString().slice(0, 10);
}
async function sha(prefix, s, bytes = 12) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prefix + s));
  return [...new Uint8Array(buf)].slice(0, bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function recordUser(env, refreshToken) {
  const h = await sha('ikasumi:', refreshToken);
  const dayKey = `d:${jstDate()}:${h}`;
  if (await env.STATS.get(dayKey) !== null) return;
  await env.STATS.put(dayKey, '1', { expirationTtl: DAY_TTL });
  const allKey = `u:${h}`;
  if (await env.STATS.get(allKey) === null) await env.STATS.put(allKey, jstDate());
}
async function listAll(env, prefix, withMeta = false) {
  const out = []; let cursor;
  do {
    const r = await env.STATS.list({ prefix, cursor });
    out.push(...(withMeta ? r.keys : r.keys.map(k => k.name)));
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return out;
}
async function handleStats(url, env) {
  if (!env.STATS_KEY || url.searchParams.get('key') !== env.STATS_KEY) return new Response('forbidden', { status: 403 });
  if (!env.STATS) return new Response('KV（STATS）が未設定です', { status: 500 });
  const days = []; const week = new Set();
  for (let i = 0; i < 7; i++) {
    const d = jstDate(i);
    const keys = await listAll(env, `d:${d}:`);
    keys.forEach(k => week.add(k.split(':')[2]));
    days.push({ date: d, users: keys.length });
  }
  const total = (await listAll(env, 'u:')).length;
  const works = (await listAll(env, 'w:')).length;
  const rows = days.map(d => `<tr><td>${d.date}</td><td>${d.users}人</td></tr>`).join('');
  return html(`<h2>イカ墨ノベル 利用者数</h2>
<p>今日：<b>${days[0].users}人</b></p><p>過去7日間：<b>${week.size}人</b></p><p>これまでの合計：<b>${total}人</b></p>
<p>公開作品：<b>${works}作品</b>（<a href="/admin?key=${encodeURIComponent(env.STATS_KEY)}">管理ページ</a>）</p>
<table border="1" cellpadding="6" style="border-collapse:collapse;margin-top:12px"><tr><th>日付</th><th>利用者</th></tr>${rows}</table>
<p style="color:#888;font-size:12px;margin-top:16px">※ Googleドライブ同期にログインしている人の数です（端末ごと）。</p>`, 'イカ墨ノベル 利用者数');
}

/* ══════════════ 作品公開 ══════════════ */
// 作者ページ用のキー（アカウントの内部IDのハッシュをさらに短くしたもの。元には戻せない）
function authorKey(w) { return String(w.owner || '').slice(0, 12); }
function newWorkId() {
  const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map(x => a[x % a.length]).join('');
}
async function getWork(env, id) {
  const s = await env.STATS.get('w:' + id);
  return s ? JSON.parse(s) : null;
}
async function getCatalog(env) {
  const s = await env.STATS.get('catalog');
  if (s !== null) {
    const c = JSON.parse(s);
    if (!c.length || 'tags' in c[0]) return c;   // 古い形（作者キー・タグなどが無い）なら作り直す
  }
  // 一覧がまだ無い（この機能を入れる前に公開された作品がある）ときは作り直す
  const c = [];
  for (const k of await listAll(env, 'w:')) {
    const v = await env.STATS.get(k); if (!v) continue;
    const w = JSON.parse(v);
    if (w.status === 'public') c.push(catalogEntry(w));
  }
  await env.STATS.put('catalog', JSON.stringify(c));
  return c;
}
function catalogEntry(w) {
  return { id: w.id, title: w.title, author: w.author, genre: w.genre, epCount: w.epCount,
    createdAt: w.createdAt, updatedAt: w.updatedAt, likes: w.likes || 0, hasCover: !!w.hasCover,
    rating: w.rating || '', ak: authorKey(w), syn: String(w.synopsis || '').slice(0, 120),
    tags: w.tags || [], done: !!w.done, chars: w.chars || 0 };
}
// 作品の保存と同時に、一覧（公開中の作品だけ）も書き換える
async function putWork(env, w) {
  await env.STATS.put('w:' + w.id, JSON.stringify(w));
  let c = await getCatalog(env);
  c = c.filter(x => x.id !== w.id);
  if (w.status === 'public') c.push(catalogEntry(w));
  await env.STATS.put('catalog', JSON.stringify(c));
}

// 作者本人かどうか：Googleドライブのユーザー識別子（permissionId）で確かめる
async function driveOwner(accessToken) {
  const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(permissionId)', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) throw new Error('drive about ' + r.status);
  const d = await r.json();
  const pid = d.user && d.user.permissionId;
  return pid ? sha('owner:', pid) : null;
}
async function ownsFile(accessToken, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,ownedByMe,trashed`, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!r.ok) return false;
  const d = await r.json();
  return d.ownedByMe === true && !d.trashed;
}
function cleanText(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

async function handlePublish(body, env, json) {
  if (!env.STATS) return json({ error: 'kv_missing' }, 500);
  const { access_token, workId, indexFileId } = body;
  const meta = body.meta || {};
  if (!access_token || !indexFileId) return json({ error: 'bad_request' }, 400);
  if (!meta.selfWritten) return json({ error: 'need_self_written' }, 400);
  const owner = await driveOwner(access_token);
  if (!owner) return json({ error: 'auth_failed' }, 401);
  if (await env.STATS.get('ban:' + owner)) return json({ error: 'banned' }, 403);
  if (!(await ownsFile(access_token, indexFileId))) return json({ error: 'not_file_owner' }, 403);

  let w = workId ? await getWork(env, workId) : null;
  if (workId && !w) return json({ error: 'work_not_found' }, 404);
  if (w && w.owner !== owner) return json({ error: 'not_work_owner' }, 403);
  if (w && w.status === 'blocked') return json({ error: 'blocked' }, 403);
  const now = new Date().toISOString();
  if (!w) w = { id: newWorkId(), owner, createdAt: now };
  Object.assign(w, {
    indexFileId,
    title: cleanText(meta.title, 100) || '無題',
    author: cleanText(meta.author, 50),
    genre: GENRES.includes(meta.genre) ? meta.genre : 'その他',
    synopsis: cleanText(meta.synopsis, 1000).replace(/ {2,}/g, ' '),
    synopsisRaw: String(meta.synopsis || '').slice(0, 1000),
    epCount: Math.max(0, Math.min(100000, parseInt(meta.epCount) || 0)),
    tags: cleanTags(meta.tags),
    done: !!meta.done,
    chars: Math.max(0, Math.min(1e9, parseInt(meta.chars) || 0)),
    rating: maxRating(RATINGS.includes(meta.rating) ? meta.rating : '', w.ratingFloor || ''),   // 運営者がR18にした作品は下げられない
    updatedAt: now,
    status: 'public',
    hasCover: false,
  });
  if (typeof meta.cover === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(meta.cover) && meta.cover.length < MAX_COVER_BYTES * 1.4) {
    await env.STATS.put('wc:' + w.id, meta.cover);
    w.hasCover = true;
  } else {
    await env.STATS.delete('wc:' + w.id);
  }
  const prof = await getProfile(env, owner);
  if (prof && prof.name) w.author = prof.name;   // ペンネームを登録していれば、そちらを作者名に
  await putWork(env, w);
  return json({ workId: w.id });
}

async function handleUnpublish(body, env, json) {
  const owner = body.access_token ? await driveOwner(body.access_token) : null;
  if (!owner) return json({ error: 'auth_failed' }, 401);
  const w = await getWork(env, body.workId);
  if (!w) return json({ error: 'work_not_found' }, 404);
  if (w.owner !== owner) return json({ error: 'not_work_owner' }, 403);
  if (w.status !== 'blocked') { w.status = 'private'; w.updatedAt = new Date().toISOString(); await putWork(env, w); }
  return json({ ok: true, status: w.status });
}

// 自分が公開した作品の一覧（本棚から消してしまっても公開をやめられるように）
async function handleMine(body, env, json) {
  const owner = body.access_token ? await driveOwner(body.access_token) : null;
  if (!owner) return json({ error: 'auth_failed' }, 401);
  const works = [];
  for (const k of await listAll(env, 'w:')) {
    const v = await env.STATS.get(k); if (!v) continue;
    const w = JSON.parse(v);
    if (w.owner === owner) works.push({ id: w.id, title: w.title, status: w.status, epCount: w.epCount, updatedAt: w.updatedAt, likes: w.likes || 0 });
  }
  try {
    const st = await readStats(env, works.map(w => w.id));
    if (st) works.forEach(w => Object.assign(w, st[w.id] || { reads30: 0, adds30: 0, readsAll: 0 }));
  } catch (_) {}
  works.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return json({ works });
}

function publicMeta(w, url) {
  if (!w) return { status: 'not_found' };
  const base = url.origin;
  if (w.status !== 'public') return { id: w.id, status: w.status, title: w.title };
  return {
    id: w.id, status: 'public', title: w.title, author: w.author, genre: w.genre,
    synopsis: w.synopsisRaw || w.synopsis, epCount: w.epCount, updatedAt: w.updatedAt, rating: w.rating || '', ak: authorKey(w), tags: w.tags || [], done: !!w.done, chars: w.chars || 0,
    cover: w.hasCover ? `${base}/w/${w.id}/cover?v=${encodeURIComponent(w.updatedAt)}` : null,
    shareUrl: `${base}/share/${w.id}`,
  };
}
async function getWorkPublicMeta(env, id, url) {
  const w = await getWork(env, id);
  const m = publicMeta(w, url);
  if (w && m.status === 'public') {
    m.likes = w.likes || 0;
    const dev = url.searchParams.get('device');
    m.liked = dev ? (await env.STATS.get(`lk:${id}:${await sha('dev:', dev)}`)) !== null : false;
  }
  return m;
}

/* ══════════════ 作品一覧・いいね ══════════════ */
async function handleWorks(url, env) {
  const sort = url.searchParams.get('sort') || 'popular';
  const genre = url.searchParams.get('genre') || '';
  let list = await getCatalog(env);
  if (genre) list = list.filter(w => w.genre === genre);
  const ak = url.searchParams.get('ak') || '';
  if (ak) list = list.filter(w => w.ak === ak);
  if (url.searchParams.get('r18') !== '1') list = list.filter(w => w.rating !== 'R18');   // R18は、見ると決めた人だけ
  const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 50);
  if (q) list = list.filter(w => (String(w.title || '') + ' ' + String(w.author || '') + ' ' + (w.tags || []).join(' ')).toLowerCase().includes(q));
  const tag = (url.searchParams.get('tag') || '').trim();
  if (tag) list = list.filter(w => (w.tags || []).includes(tag));
  if (url.searchParams.get('done') === '1') list = list.filter(w => w.done);
  let ranked = false;
  if (sort === 'rank') {
    const period = url.searchParams.get('period') || 'week';
    const sc = await rankScores(env, period);
    if (sc) {
      ranked = true;
      const score = w => { const x = sc[w.id] || {}; return (x.reads || 0) + (x.adds || 0) * 3; };   // 本棚に入れたのは重く
      list = list.filter(w => score(w) > 0 || period === 'all');
      list = list.map(w => ({ ...w, score: score(w) }));
      list.sort((a, b) => b.score - a.score || (b.likes || 0) - (a.likes || 0));
    }
  }
  if (sort === 'rank' && ranked) { /* 上で並べた */ }
  else if (sort === 'new') list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  else if (sort === 'updated') list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  else list.sort((a, b) => (b.likes || 0) - (a.likes || 0) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return {
    works: list.slice(0, 100).map(w => ({
      ...w, cover: w.hasCover ? `${url.origin}/w/${w.id}/cover?v=${encodeURIComponent(w.updatedAt)}` : null,
    })),
    total: list.length,
    rankAvailable: !!env.DB,
  };
}
async function handleLike(body, env, json) {
  const dev = String(body.device || '');
  if (dev.length < 8 || dev.length > 64) return json({ error: 'bad_device' }, 400);
  const w = await getWork(env, body.workId);
  if (!w || w.status !== 'public') return json({ error: 'work_not_found' }, 404);
  const key = `lk:${w.id}:${await sha('dev:', dev)}`;
  const had = (await env.STATS.get(key)) !== null;
  const want = body.like !== false;
  if (want && !had) { await env.STATS.put(key, '1'); w.likes = (w.likes || 0) + 1; await putWork(env, w); }
  else if (!want && had) { await env.STATS.delete(key); w.likes = Math.max(0, (w.likes || 0) - 1); await putWork(env, w); }
  return json({ likes: w.likes || 0, liked: want });
}

async function handleCover(id, env) {
  const s = await env.STATS.get('wc:' + id);
  const w = s ? await getWork(env, id) : null;
  if (!s || !w || w.status === 'blocked') return new Response('not found', { status: 404 });
  const m = s.match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (!m) return new Response('not found', { status: 404 });
  const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  return new Response(bin, { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } });
}

// 作者のドライブにある公開ファイルを読む（短時間キャッシュ）
// version を渡すと「その版」として長く保存、渡さないと短時間だけ保存する
async function driveReadPublic(env, ctx, fileId, cacheSec, version) {
  const apiUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${env.GOOGLE_API_KEY}`;
  const tag = version ? 'v=' + encodeURIComponent(version) : 't=' + Math.floor(Date.now() / (cacheSec * 1000));
  const cacheKey = new Request(`https://cache.ikasumi/${fileId}?${tag}`);
  const cache = caches.default;
  let r = await cache.match(cacheKey);
  if (!r) {
    const g = await fetch(apiUrl);
    if (!g.ok) { const e = new Error('drive_read ' + g.status); e.status = g.status; throw e; }
    const text = await g.text();
    r = new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${cacheSec}` } });
    ctx.waitUntil(cache.put(cacheKey, r.clone()));
  }
  return r.json();
}

async function handleIndex(id, env, ctx, json) {
  const w = await getWork(env, id);
  if (!w) return json({ status: 'not_found' }, 404);
  if (w.status !== 'public') return json({ status: w.status }, 410);
  try {
    const idx = await driveReadPublic(env, ctx, w.indexFileId, 5);
    return json({ status: 'public', ...idx });
  } catch (e) {
    return json({ status: 'unavailable', error: String(e.message) }, 502);
  }
}

async function handleEpisode(id, epId, url, env, ctx, cors) {
  const w = await getWork(env, id);
  const j = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (!w) return j({ status: 'not_found' }, 404);
  if (w.status !== 'public') return j({ status: w.status }, 410);
  try {
    const idx = await driveReadPublic(env, ctx, w.indexFileId, 5);
    const ep = (idx.episodes || []).find(e => e.id === epId);
    if (!ep || !ep.fileId) return j({ status: 'ep_not_found' }, 404);
    const data = await driveReadPublic(env, ctx, ep.fileId, 600, ep.updatedAt);
    const r = j({ status: 'public', ...data }, 200);
    r.headers.set('Cache-Control', url.searchParams.get('v') ? 'public, max-age=86400' : 'no-store');
    return r;
  } catch (e) {
    return j({ status: 'unavailable', error: String(e.message) }, 502);
  }
}

/* ══════════════ 共有ページ（SNSのカード用） ══════════════ */
function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
async function handleShare(id, url, env) {
  const w = await getWork(env, id);
  let appUrl = env.APP_URL || DEFAULT_APP_URL;
  if (url.searchParams.get('app') === 'beta') appUrl += 'beta/';
  const target = `${appUrl}?work=${encodeURIComponent(id)}`;
  const ok = w && w.status === 'public';
  const title = ok ? `${w.title}｜イカ墨ノベル` : 'イカ墨ノベル';
  const desc = ok ? `${w.genre}・全${w.epCount}話${w.author ? '・' + w.author : ''}　${(w.synopsisRaw || w.synopsis || '').slice(0, 100)}` : 'この作品は公開されていません';
  const img = ok && w.hasCover ? `${url.origin}/w/${w.id}/cover?v=${encodeURIComponent(w.updatedAt)}` : `${appUrl}icon-512.png`;
  return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="イカ墨ノベル">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(url.origin + url.pathname)}">
<meta name="twitter:card" content="${ok && w.hasCover ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="font-family:sans-serif;text-align:center;padding:40px">
<p>イカ墨ノベルを開いています…</p><p><a href="${esc(target)}">開かない場合はこちら</a></p>
<script>location.replace(${JSON.stringify(target)});</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

/* ══════════════ 通報 ══════════════ */
async function handleReport(body, env, json, ctx) {
  const w = await getWork(env, body.workId);
  if (!w) return json({ error: 'work_not_found' }, 404);
  const reason = REASONS[body.reason] ? body.reason : 'other';
  const key = `r:${Date.now()}:${newWorkId().slice(0, 6)}`;
  await env.STATS.put(key, JSON.stringify({ workId: w.id, title: w.title, reason, detail: cleanText(body.detail, 500), at: new Date().toISOString() }),
    { expirationTtl: 60 * 60 * 24 * 180 });
  // 通報が来たら知らせる（REPORT_WEBHOOK を設定したときだけ）
  if (env.REPORT_WEBHOOK) {
    const msg = `【イカ墨ノベル】通報：「${w.title}」（${REASONS[reason]}）${cleanText(body.detail, 200) ? '\n' + cleanText(body.detail, 200) : ''}\n管理ページ（/admin）で確認してね`;
    const p = fetch(env.REPORT_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg, text: msg }) }).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  }
  return json({ ok: true });
}

/* ══════════════ 管理ページ ══════════════ */
function html(body, title) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || 'イカ墨ノベル')}</title>
<body style="font-family:sans-serif;padding:16px;max-width:760px;margin:auto;line-height:1.6">${body}</body>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function btn(key, action, target, label, color) {
  return `<form method="post" action="/admin/action" style="display:inline"><input type="hidden" name="key" value="${esc(key)}">
<input type="hidden" name="action" value="${action}"><input type="hidden" name="target" value="${esc(target)}">
<button style="padding:4px 10px;margin:2px;border:1px solid ${color};color:${color};background:#fff;border-radius:4px">${label}</button></form>`;
}
async function handleAdmin(url, env) {
  const key = url.searchParams.get('key');
  if (!env.STATS_KEY || key !== env.STATS_KEY) return new Response('forbidden', { status: 403 });
  const reportKeys = (await listAll(env, 'r:')).reverse();
  const reports = [];
  for (const k of reportKeys.slice(0, 100)) { const v = await env.STATS.get(k); if (v) reports.push({ key: k, ...JSON.parse(v) }); }
  const workKeys = await listAll(env, 'w:');
  const works = [];
  for (const k of workKeys.slice(0, 300)) { const v = await env.STATS.get(k); if (v) works.push(JSON.parse(v)); }
  works.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const byId = Object.fromEntries(works.map(w => [w.id, w]));
  const st = s => s === 'public' ? '<span style="color:#080">公開中</span>' : s === 'blocked' ? '<span style="color:#c00">公開停止</span>' : '<span style="color:#888">非公開</span>';

  const rep = reports.length ? reports.map(r => {
    const w = byId[r.workId];
    return `<div style="border:1px solid #ddd;border-radius:6px;padding:10px;margin:8px 0">
<b>${esc(r.title)}</b>（${esc(r.workId)}）${w ? st(w.status) : ''}<br>
理由：<b>${esc(REASONS[r.reason] || r.reason)}</b>　${esc(r.at.slice(0, 16).replace('T', ' '))}<br>
${r.detail ? `詳細：${esc(r.detail)}<br>` : ''}
<a href="/share/${esc(r.workId)}" target="_blank">作品を開く</a><br>
${w && w.status !== 'blocked' ? btn(key, 'block', r.workId, '公開停止', '#c00') : ''}
${btn(key, 'dismiss', r.key, '通報を片付ける', '#555')}
</div>`;
  }).join('') : '<p style="color:#888">通報はありません</p>';

  const wl = works.map(w => `<tr><td><a href="/share/${esc(w.id)}" target="_blank">${esc(w.title)}</a><br><small>${esc(w.author)}・${esc(w.genre)}・全${w.epCount}話</small></td>
<td>${st(w.status)}${w.rating ? ` <b>${esc(w.rating)}</b>` : ''}<br><small>♡ ${w.likes || 0}</small></td><td><small>${esc((w.updatedAt || '').slice(0, 10))}</small></td>
<td>${w.status === 'blocked' ? btn(key, 'unblock', w.id, '停止を解除', '#080') : btn(key, 'block', w.id, '公開停止', '#c00')}
${w.rating !== 'R18' ? btn(key, 'rate18', w.id, 'R18にする', '#b0506a') : ''}
${btn(key, 'ban', w.owner, 'この作者を禁止', '#a00')}</td></tr>`).join('');

  return html(`<h2>イカ墨ノベル 管理</h2>
<h3>通報（${reports.length}件）</h3>${rep}
<h3>作品（${works.length}件）</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">${wl || '<tr><td>まだありません</td></tr>'}</table>
<p><a href="/stats?key=${encodeURIComponent(key)}">利用者数</a></p>`, 'イカ墨ノベル 管理');
}
async function handleAdminAction(request, env) {
  const f = await request.formData();
  const key = f.get('key');
  if (!env.STATS_KEY || key !== env.STATS_KEY) return new Response('forbidden', { status: 403 });
  const action = f.get('action'), target = String(f.get('target') || '');
  if (action === 'block' || action === 'unblock') {
    const w = await getWork(env, target);
    if (w) { w.status = action === 'block' ? 'blocked' : 'public'; await putWork(env, w); }
  } else if (action === 'rate18') {
    const w = await getWork(env, target);
    if (w) { w.rating = 'R18'; w.ratingFloor = 'R18'; await putWork(env, w); }
  } else if (action === 'dismiss' && target.startsWith('r:')) {
    await env.STATS.delete(target);
  } else if (action === 'ban' && target) {
    await env.STATS.put('ban:' + target, '1');
    for (const k of await listAll(env, 'w:')) {
      const v = await env.STATS.get(k); if (!v) continue;
      const w = JSON.parse(v);
      if (w.owner === target && w.status !== 'blocked') { w.status = 'blocked'; await putWork(env, w); }
    }
  }
  return Response.redirect(new URL('/admin?key=' + encodeURIComponent(key), request.url).toString(), 303);
}

/* ══════════════ タグ ══════════════ */
function cleanTags(t) {
  const arr = Array.isArray(t) ? t : String(t || '').split(/[\s,、，#＃]+/);
  const out = [];
  for (const x of arr) {
    const v = cleanText(String(x).replace(/^[#＃]/, ''), 20);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= 8) break;
  }
  return out;
}

/* ══════════════ 作者プロフィール（ペンネーム） ══════════════ */
async function getProfile(env, owner) {
  const s = owner ? await env.STATS.get('p:' + owner) : null;
  return s ? JSON.parse(s) : null;
}
async function getProfilePublic(env, ak) {
  if (!ak) return { error: 'no_ak' };
  const s = await env.STATS.get('pk:' + ak);
  return s ? JSON.parse(s) : { name: '', bio: '' };
}
function normName(n) { return String(n || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
async function handleProfile(body, env, json) {
  const owner = body.access_token ? await driveOwner(body.access_token) : null;
  if (!owner) return json({ error: 'auth_failed' }, 401);
  const old = await getProfile(env, owner);
  if (body.get) return json(old || { name: '', bio: '' });
  if (await env.STATS.get('ban:' + owner)) return json({ error: 'banned' }, 403);
  const name = cleanText(body.name, 30);
  const bio = String(body.bio || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').slice(0, 300);
  if (!name) return json({ error: 'need_name' }, 400);
  // 同じペンネーム（大文字小文字・全角半角の違いも同じとみる）はひとりだけ
  const nk = 'pn:' + normName(name);
  const holder = await env.STATS.get(nk);
  if (holder && holder !== owner) return json({ error: 'name_taken' }, 409);
  if (old && old.name && normName(old.name) !== normName(name)) await env.STATS.delete('pn:' + normName(old.name));
  if (holder !== owner) await env.STATS.put(nk, owner);
  const prof = { name, bio, updatedAt: new Date().toISOString() };
  await env.STATS.put('p:' + owner, JSON.stringify(prof));
  await env.STATS.put('pk:' + owner.slice(0, 12), JSON.stringify({ name, bio }));
  // 公開中の作品の作者名もそろえる
  if (!old || old.name !== name) {
    for (const k of await listAll(env, 'w:')) {
      const v = await env.STATS.get(k); if (!v) continue;
      const w = JSON.parse(v);
      if (w.owner === owner && w.author !== name) { w.author = name; await putWork(env, w); }
    }
  }
  return json({ ok: true, name, bio });
}

/* ══════════════ 読まれた数・期間ランキング（D1） ══════════════ */
let _d1Ready = false;
async function d1(env) {
  if (!env.DB) return null;
  if (!_d1Ready) {
    await env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS daily (work_id TEXT NOT NULL, day TEXT NOT NULL, reads INTEGER NOT NULL DEFAULT 0, adds INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (work_id, day))'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS seen (work_id TEXT NOT NULL, day TEXT NOT NULL, dev TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (work_id, day, dev, kind))'),
    ]);
    _d1Ready = true;
  }
  return env.DB;
}
function dayOf(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600e3 - offsetDays * 864e5);   // 日本時間の日付
  return d.toISOString().slice(0, 10);
}
async function handleHit(body, env, json) {
  const db = await d1(env);
  if (!db) return json({ ok: false, reason: 'no_db' });
  const dev = String(body.device || '');
  if (dev.length < 8 || dev.length > 64) return json({ error: 'bad_device' }, 400);
  const kind = body.kind === 'add' ? 'add' : 'read';
  const w = await getWork(env, body.workId);
  if (!w || w.status !== 'public') return json({ error: 'work_not_found' }, 404);
  const day = dayOf();
  // 同じ端末からは、1日1回だけ数える
  const r = await db.prepare('INSERT OR IGNORE INTO seen (work_id, day, dev, kind) VALUES (?, ?, ?, ?)').bind(w.id, day, await sha('dev:', dev), kind).run();
  if (r.meta && r.meta.changes) {
    const col = kind === 'add' ? 'adds' : 'reads';
    await db.prepare(`INSERT INTO daily (work_id, day, ${col}) VALUES (?, ?, 1) ON CONFLICT(work_id, day) DO UPDATE SET ${col} = ${col} + 1`).bind(w.id, day).run();
  }
  // 古い「見た」記録は片付ける（ときどき）
  if (Math.random() < 0.01) await db.prepare('DELETE FROM seen WHERE day < ?').bind(dayOf(3)).run();
  return json({ ok: true });
}
const PERIOD_DAYS = { day: 1, week: 7, month: 30 };
async function rankScores(env, period) {
  const db = await d1(env);
  if (!db) return null;
  const n = PERIOD_DAYS[period];
  const q = n
    ? db.prepare('SELECT work_id, SUM(reads) AS r, SUM(adds) AS a FROM daily WHERE day >= ? GROUP BY work_id').bind(dayOf(n - 1))
    : db.prepare('SELECT work_id, SUM(reads) AS r, SUM(adds) AS a FROM daily GROUP BY work_id');
  const rows = (await q.all()).results || [];
  const m = {};
  for (const x of rows) m[x.work_id] = { reads: x.r || 0, adds: x.a || 0 };
  return m;
}
async function readStats(env, ids) {
  const db = await d1(env);
  if (!db || !ids.length) return null;
  const ph = ids.map(() => '?').join(',');
  const rows = (await db.prepare(`SELECT work_id, SUM(reads) AS r, SUM(adds) AS a FROM daily WHERE day >= ? AND work_id IN (${ph}) GROUP BY work_id`).bind(dayOf(29), ...ids).all()).results || [];
  const all = (await db.prepare(`SELECT work_id, SUM(reads) AS r FROM daily WHERE work_id IN (${ph}) GROUP BY work_id`).bind(...ids).all()).results || [];
  const m = {};
  for (const x of rows) m[x.work_id] = { reads30: x.r || 0, adds30: x.a || 0 };
  for (const x of all) (m[x.work_id] = m[x.work_id] || {}).readsAll = x.r || 0;
  return m;
}
