/* ══════ 青空文庫 ══════ */
// 青空文庫の作品（著作権が切れたもの）を、ルビ付きで本棚に入れる。
// ・名作の本棚：リポジトリの aozora/ に入れた作品から選ぶ
// ・ファイルから：青空文庫のテキスト（.txt / .zip）や、ほかのテキストを新しい本として取り込む
// 取り込んだ本は「外部の作品」なので公開（投稿）できない。
const AZ_BASES = (/\/beta2?\//.test(location.pathname) ? ['../aozora/'] : ['aozora/']).concat(['https://ikazu23.github.io/novel-reader/aozora/']);
async function azFetch(name, type){
  let last = null;
  for(const b of AZ_BASES){
    try{
      const r = await fetch(b + name, { cache: 'no-cache' });
      if(r.ok) return type === 'json' ? await r.json() : await r.text();
      last = new Error('http ' + r.status);
    }catch(e){ last = e; }
  }
  throw last || new Error('fetch');
}
function azEsc(s){ return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

// ── 文字コード：UTF-8 でなければ Shift_JIS ──
function azDecode(buf){
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try{ return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); }
  catch(_){ try{ return new TextDecoder('shift_jis').decode(u8); }catch(__){ return new TextDecoder('utf-8').decode(u8); } }
}
function azLooksAozora(t){ return /《[^》\n]{1,40}》/.test(t) && (/^底本：/m.test(t) || /【テキスト中に現れる記号について】/.test(t) || /［＃/.test(t)); }

// ── 1行を、ルビ・傍点などの入った HTML にする ──
const AZ_KANJI = /[㐀-鿿豈-﫿々〆ヶ〇仝ゝゞ〻※\u{20000}-\u{2FFFF}]/u;
const AZ_KATA = /[ァ-ヴー・ヽヾ]/;
const AZ_ALNUM = /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９'’\-]/;
function azCls(c){ return AZ_KANJI.test(c) ? 'k' : AZ_KATA.test(c) ? 'a' : AZ_ALNUM.test(c) ? 'l' : ''; }
// ［＃ … ］ の閉じ（中に ［ ］ が入れ子になっていることがある）
function azClose2(chars, i){
  let d = 0;
  for(let j = i; j < chars.length; j++){
    if(chars[j] === '［') d++;
    else if(chars[j] === '］'){ d--; if(d === 0) return j; }
  }
  return -1;
}
function azLine(line){
  const units = [];   // {c} 1文字 / {r, rt} ルビ付き
  const info = { h: 0, align: '', brk: false };
  let marker = null;
  const chars = Array.from(line);
  const plainOf = (from) => units.slice(from).map(u => u.c != null ? u.c : u.r).join('');
  // 直前の本文から「X」を探して印を付ける
  const mark = (target, kind) => {
    for(let start = units.length - 1; start >= 0; start--){
      if(plainOf(start).startsWith(target)){
        let len = 0;
        for(let i = start; i < units.length && len < target.length; i++){
          const u = units[i];
          len += (u.c != null ? u.c : u.r).length;
          (u.m = u.m || []).push(kind);
        }
        return;
      }
    }
  };
  for(let i = 0; i < chars.length; i++){
    const c = chars[i];
    if(c === '｜'){ marker = units.length; continue; }
    if(c === '《'){
      const end = chars.indexOf('》', i + 1);
      if(end > i){
        const rt = chars.slice(i + 1, end).join('');
        let from = marker;
        if(from == null){
          from = units.length;
          const last = units[from - 1];
          const cls = last && last.c != null ? azCls(last.c) : '';
          if(cls) while(from > 0 && units[from - 1].c != null && azCls(units[from - 1].c) === cls) from--;
        }
        if(from < units.length){
          const base = units.splice(from).map(u => u.c != null ? u.c : u.r).join('');
          units.push({ r: base, rt });
          marker = null;
          i = end;
          continue;
        }
      }
    }
    if(c === '※' && chars[i + 1] === '［' && chars[i + 2] === '＃'){
      // 外字：Unicode が書いてあればその字に、なければ ※ のまま
      const end = azClose2(chars, i + 1);
      if(end > i){
        const note = chars.slice(i + 3, end).join('');
        const u = note.match(/U\+([0-9A-Fa-f]{4,5})/);
        units.push({ c: u ? String.fromCodePoint(parseInt(u[1], 16)) : '※' });
        i = end;
        continue;
      }
    }
    if(c === '［' && chars[i + 1] === '＃'){
      const end = azClose2(chars, i);
      if(end > i){
        const note = chars.slice(i + 2, end).join('');
        let m;
        if((m = note.match(/^「(.+)」(?:の左)?に(白ゴマ傍点|丸傍点|白丸傍点|黒丸傍点|黒三角傍点|白三角傍点|二重丸傍点|蛇の目傍点|ばつ傍点|傍点)$/))) mark(m[1], 'em');
        else if((m = note.match(/^「(.+)」(?:の左)?に(二重傍線|傍線|鎖線|破線|波線)$/))) mark(m[1], 'u');
        else if((m = note.match(/^「(.+)」は太字$/))) mark(m[1], 'b');
        else if((m = note.match(/^「(.+)」は斜体$/))) mark(m[1], 'i');
        else if((m = note.match(/^「(.+)」は(?:上付き|行右)小文字$/))) mark(m[1], 'sup');
        else if((m = note.match(/^「(.+)」は(?:下付き|行左)小文字$/))) mark(m[1], 'sub');
        else if((m = note.match(/^「.+」は(大|中|小)見出し$/)) || (m = note.match(/^(?:同行|窓)?(大|中|小)見出し$/))) info.h = { 大: 1, 中: 2, 小: 3 }[m[1]];
        else if(/^(改頁|改ページ|改丁|改段)$/.test(note)) info.brk = true;
        else if(/^地付き$|^地から.+字上げ$/.test(note)) info.align = 'right';
        else if(/^ページの左右中央$/.test(note)) info.align = 'center';
        i = end;
        continue;
      }
    }
    units.push({ c });
  }
  const wrap = (h, ms) => {
    (ms || []).forEach(k => {
      h = k === 'em' ? `<span style="-webkit-text-emphasis:filled sesame;text-emphasis:filled sesame;">${h}</span>`
        : k === 'u' ? `<u>${h}</u>` : `<${k}>${h}</${k}>`;
    });
    return h;
  };
  // 印が同じ文字はまとめて包む
  let html = '', text = '', run = '', runKey = null, runMs = null;
  const flush = () => { if(run){ html += wrap(run, runMs); run = ''; } };
  units.forEach(u => {
    const key = (u.m || []).join(',');
    if(u.c != null){
      if(key !== runKey){ flush(); runKey = key; runMs = u.m; }
      run += azEsc(u.c); text += u.c;
    }else{
      flush(); runKey = null;
      html += wrap(`<ruby>${azEsc(u.r)}<rt>${azEsc(u.rt)}</rt></ruby>`, u.m);
      text += u.r;
    }
  });
  flush();
  return { html, text, h: info.h, align: info.align, brk: info.brk };
}

// ── 作品全体を、本（話・ページ・段落）にする ──
function azParse(raw, fallbackTitle){
  let t = String(raw || '').replace(/\r\n?/g, '\n');
  const aozora = azLooksAozora(t);
  let lines = t.split('\n');
  let title = fallbackTitle || '無題の小説', author = '', subtitle = '';
  if(aozora){
    // 先頭：題名・（副題）・著者 … 最初の空行まで
    const head = [];
    while(lines.length && lines[0].trim() !== '' && head.length < 5 && !/^-{5,}/.test(lines[0])) head.push(lines.shift().trim());
    if(head.length){ title = head[0]; if(head.length >= 2) author = head[head.length - 1]; if(head.length >= 3) subtitle = head.slice(1, -1).join('　'); }
    // 記号の説明（----- で囲まれた所）を外す
    const a = lines.findIndex(l => /^-{10,}/.test(l));
    if(a >= 0 && a < 12){ const b = lines.findIndex((l, i) => i > a && /^-{10,}/.test(l)); if(b > a) lines.splice(0, b + 1); }
  }
  // 底本などの情報（最後に残す）
  let credit = [];
  const ci = lines.findIndex(l => /^底本：/.test(l));
  if(ci >= 0){ credit = lines.slice(ci).map(l => l.trim()).filter(Boolean); lines = lines.slice(0, ci); }

  const fs = (state.settings && state.settings.fontSize) || 15, col = (state.settings && state.settings.lastColor) || '#1a1208';
  const P = (o) => Object.assign({ type: 'text', align: 'left', size: fs, color: col }, o);
  const blank = () => P({ text: '', html: '<br>' });
  const eps = [];
  let cur = null;
  const newEp = (t) => { cur = { title: t, pages: [{ paras: [] }], n: 0 }; eps.push(cur); };
  const page = () => cur.pages[cur.pages.length - 1];
  const push = (para, len) => {
    if(!cur) newEp(title);
    // 長い話はページを分ける（表示を軽くするため）
    if(cur.n > 3500 && para.text){ cur.pages.push({ paras: [] }); cur.n = 0; }
    page().paras.push(para); cur.n += len || 0;
  };
  let blanks = 0, big = '';
  for(const raw of lines){
    if(!aozora){
      const s = raw.replace(/\s+$/, '').replace(/^[ \t]+/, '');
      if(!s.trim()){ blanks++; if(blanks === 1 && cur && page().paras.length) push(blank()); continue; }
      blanks = 0;
      push(P({ text: s, html: azEsc(s) }), s.length);
      continue;
    }
    const L = azLine(raw.replace(/\s+$/, ''));
    if(L.brk && cur && page().paras.length){ cur.pages.push({ paras: [] }); cur.n = 0; }
    const s = L.text.replace(/^[\s　]+$/, '');
    if(!s){ blanks++; if(blanks === 1 && cur && page().paras.length) push(blank()); continue; }
    blanks = 0;
    if(L.h === 1 || L.h === 2){
      const ht = s.trim();
      // 見出しだけの話（大見出しのすぐ後に中見出し）は題名をつなげる
      const onlyHead = cur && cur.pages.length === 1 && cur.pages[0].paras.filter(p => p.text).length === 1 && cur.pages[0].paras[0].az === 'h';
      if(L.h === 1) big = (ht.split(/[\s　]+/)[0].length <= 2 ? ht.split(/[\s　]+/)[0] : ht);
      if(onlyHead && L.h === 2){ cur.title += '　' + ht; cur.pages[0].paras.push(P({ text: ht, html: '<b>' + L.html.trim() + '</b>', align: 'center', size: Math.round(fs * 1.15), az: 'h' })); }
      else{ newEp(L.h === 2 && big ? big + '　' + ht : ht); push(P({ text: ht, html: '<b>' + L.html.trim() + '</b>', align: 'center', size: Math.round(fs * (L.h === 1 ? 1.3 : 1.15)), az: 'h' })); }
      push(blank()); blanks = 1;
      continue;
    }
    if(L.h === 3){ push(P({ text: s.trim(), html: '<b>' + L.html.trim() + '</b>', size: Math.round(fs * 1.05) }), s.length); continue; }
    push(P({ text: s, html: L.html, align: L.align || 'left' }), s.length);
  }
  if(!eps.length) newEp(title);
  // 本文の前の短い部分（題辞など）だけの話は、次の話の頭にまとめる
  if(eps.length > 1 && eps[0].title === title && eps[0].pages.length === 1 && eps[0].pages[0].paras.filter(p => p.text).length <= 3){
    const pre = eps.shift();
    eps[0].pages[0].paras = pre.pages[0].paras.concat([blank()], eps[0].pages[0].paras);
  }
  // 最後に底本・入力者などの情報を残す（青空文庫からのお願い）
  if(credit.length){
    const last = eps[eps.length - 1], pg = last.pages[last.pages.length - 1];
    pg.paras.push(blank(), blank());
    // 「底本：」「入力：」などの区切りごとに1段落（行は改行でつなぐ）
    const groups = [];
    credit.forEach(l => { if(!groups.length || /^(底本|底本の親本|初出|入力|校正|※|\d{4}年|青空文庫作成ファイル|このファイルは)/.test(l)) groups.push([l]); else groups[groups.length - 1].push(l); });
    groups.forEach(g => pg.paras.push(P({ text: g.join(' '), html: g.map(azEsc).join('<br>'), size: Math.max(10, Math.round(fs * 0.78)), color: '#888888', az: 'c' })));
  }
  // 中身のない最後のページは消す
  eps.forEach(e => { e.pages = e.pages.filter(p => p.paras.length); if(!e.pages.length) e.pages = [{ paras: [blank()] }]; });
  return { title, author, subtitle, aozora, eps: eps.map(e => ({ title: e.title, pages: e.pages })), credit };
}

// ── 本棚に入れる ──
// 表紙：和紙っぽい色に、題名を縦書きで
function azMakeCover(title, author){
  try{
    const W = 300, H = 420, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const pal = [['#efe7d6', '#3b3127'], ['#e3ebe6', '#24413a'], ['#ebe2e2', '#4a2b2b'], ['#e2e6ee', '#26324a'], ['#eee9dc', '#433a22']];
    let h = 0; for(const ch of title) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    const [bg, fg] = pal[h % pal.length];
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.05)'; for(let i = 0; i < 260; i++) g.fillRect((i * 97) % W, (i * 57) % H, 2, 1);
    g.strokeStyle = fg; g.globalAlpha = .55; g.lineWidth = 1.5; g.strokeRect(14, 14, W - 28, H - 28); g.globalAlpha = 1;
    // 題簽（白い札）
    const t = Array.from(title).slice(0, 12), fsz = t.length > 8 ? 26 : 32;
    const slipH = Math.min(H - 90, t.length * (fsz + 4) + 36), sx = W - 92, sy = 40;
    g.fillStyle = '#fbf9f3'; g.fillRect(sx, sy, 50, slipH);
    g.strokeStyle = fg; g.globalAlpha = .7; g.lineWidth = 1; g.strokeRect(sx + 3, sy + 3, 44, slipH - 6); g.globalAlpha = 1;
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${fsz}px 'Shippori Mincho B1','Noto Serif JP','Noto Serif CJK JP',serif`;
    t.forEach((ch, i) => {
      const y = sy + 22 + i * (fsz + 4) + fsz / 2;
      if(/[ー―…－〜]/.test(ch)){ g.save(); g.translate(sx + 25, y); g.rotate(Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); }
      else g.fillText(ch, sx + 25, y);
    });
    const a = Array.from(author || '').slice(0, 10);
    g.font = `500 17px 'Shippori Mincho B1','Noto Serif JP','Noto Serif CJK JP',serif`;
    g.globalAlpha = .85;
    a.forEach((ch, i) => g.fillText(ch, 62, H - 40 - (a.length - i) * 20 + 10));
    g.globalAlpha = 1;
    return c.toDataURL('image/jpeg', 0.82);
  }catch(_){ return ''; }
}
async function azAddNovel(parsed, meta){
  const novel = makeNovel(parsed.title + (parsed.subtitle ? '　' + parsed.subtitle : ''));
  novel.author = parsed.author || '';
  if(parsed.aozora){
    novel.cover = azMakeCover(parsed.title, parsed.author);
    Object.assign(novel, AZ_LOOK);   // 段落の間に少し余白・行間は広め（この本だけ）
  }
  novel.sortMode = 'oldest';
  const base = Date.now();
  novel.episodes = parsed.eps.map((e, i) => {
    e.pages.forEach(p => p.paras.forEach(pa => { delete pa.az; }));
    const ep = makeEpisode(i + 1, e.title, e.pages);
    ep.id = 'ep_' + (base + i) + '_' + Math.random().toString(36).slice(2, 7);
    ep.charCount = countChars(e.pages);
    return ep;
  });
  novel.ext = Object.assign({ kind: parsed.aozora ? 'aozora' : 'file', at: new Date().toISOString(), look: parsed.aozora ? 1 : undefined }, meta || {});
  await libDbPut(novel);
  state.library.push(novel);
  try{ renderLibrary(); }catch(_){}
  return novel;
}
function azIsExternal(n){ return !!(n && n.ext); }
// 青空文庫は段落の間に空行がないので、この本だけ読みやすい見た目にする（設定で変えられる）
const AZ_LOOK = { lineHeight: 2.0, paraSpacing: 10 };
async function azFixLook(n){
  if(!n || !n.ext || n.ext.kind !== 'aozora' || n.ext.look) return;
  n.ext.look = 1;
  if(n.lineHeight == null) n.lineHeight = AZ_LOOK.lineHeight;
  if(n.paraSpacing == null) n.paraSpacing = AZ_LOOK.paraSpacing;
  try{ await libDbPut(n); }catch(_){}
}

// ── 画面：ひとつのシート ──
function azSheet(html){
  let ov = document.getElementById('az-ov');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'az-ov'; ov.onclick = azClose;
    const sh = document.createElement('div'); sh.id = 'az-sheet';
    document.body.appendChild(ov); document.body.appendChild(sh);
  }
  const sh = document.getElementById('az-sheet');
  sh.innerHTML = html;
  sh.scrollTop = 0;
  requestAnimationFrame(() => { ov.classList.add('show'); sh.classList.add('show'); });
}
function azClose(){
  const ov = document.getElementById('az-ov'), sh = document.getElementById('az-sheet');
  if(ov) ov.classList.remove('show');
  if(sh) sh.classList.remove('show');
}

// ＋ボタン：新しい本を書く／名作を読む／ファイルから
function azOpenAdd(){
  azSheet(`
    <div class="az-title">本を追加</div>
    <button class="az-item" onclick="azClose();createNewNovel()"><span class="az-ic">✎</span><span><b>新しい本を書く</b><small>白紙の本を作るよ</small></span></button>
    <button class="az-item" onclick="azOpenCatalog()"><span class="az-ic">📚</span><span><b>名作を読む（青空文庫）</b><small>漱石・太宰・賢治…すぐ読めるよ</small></span></button>
    <button class="az-item" onclick="azPickFile()"><span class="az-ic">⤓</span><span><b>テキストファイルから</b><small>青空文庫の .txt / .zip、ほかの .txt</small></span></button>
    <div class="az-note">取り込んだ作品は、自分で読むためだけに使ってね。公開（投稿）はできないよ。</div>
    <button class="az-close" onclick="azClose()">閉じる</button>`);
}

let _azCatalog = null;
async function azOpenCatalog(){
  azSheet('<div class="az-title">名作を読む</div><div class="az-msg">読み込み中…</div>');
  try{ _azCatalog = _azCatalog || await azFetch('catalog.json?d=' + new Date().toISOString().slice(0, 10).replace(/-/g, ''), 'json'); }
  catch(e){ azSheet('<div class="az-title">名作を読む</div><div class="az-msg">一覧を読み込めませんでした。ネットにつながっているか確認してね。</div><button class="az-close" onclick="azClose()">閉じる</button>'); return; }
  const have = new Set((state.library || []).filter(n => n.ext && n.ext.id).map(n => n.ext.id));
  const rows = (_azCatalog.works || []).map((w, i) => `
    <div class="az-work">
      <div class="az-w-main">
        <div class="az-w-t">${azEsc(w.title)}</div>
        <div class="az-w-a">${azEsc(w.author)}<span>${w.min ? '・約' + (w.min >= 60 ? Math.round(w.min / 60) + '時間' : w.min + '分') : ''}</span></div>
        ${w.blurb ? `<div class="az-w-b">${azEsc(w.blurb)}</div>` : ''}
      </div>
      ${have.has(w.id)
        ? `<button class="az-w-btn read" onclick="azOpenHave('${azEsc(w.id)}')">読む</button>`
        : `<button class="az-w-btn" id="az-w-${i}" onclick="azAddFromCatalog(${i})">本棚へ</button>`}
    </div>`).join('');
  azSheet(`<div class="az-title">名作を読む<small>青空文庫より</small></div>
    <div class="az-list">${rows}</div>
    <div class="az-note">著作権の切れた作品を、青空文庫（aozora.gr.jp）のボランティアさんが入力したテキストから作っています。作品の最後に、底本と入力・校正した方の名前を残しています。</div>
    <button class="az-close" onclick="azClose()">閉じる</button>`);
}
function azOpenHave(id){
  const n = (state.library || []).find(x => x.ext && x.ext.id === id);
  azClose();
  if(n) openNovel(n.id);
}
async function azAddFromCatalog(i){
  const w = _azCatalog && _azCatalog.works[i]; if(!w) return;
  const btn = document.getElementById('az-w-' + i);
  if(btn){ if(btn.disabled) return; btn.disabled = true; btn.textContent = '準備中…'; }
  try{
    const txt = await azFetch(w.file, 'text');
    const parsed = azParse(txt, w.title);
    const n = await azAddNovel(parsed, { id: w.id, card: w.card || '', src: 'aozora' });
    showToast(`「${w.title}」を本棚に入れたよ`);
    if(btn){ btn.disabled = false; btn.textContent = '読む'; btn.classList.add('read'); btn.onclick = () => { azClose(); openNovel(n.id); }; }
  }catch(e){
    console.warn('aozora add', e);
    showToast('読み込めませんでした。ネットにつながっているか確認してね');
    if(btn){ btn.disabled = false; btn.textContent = '本棚へ'; }
  }
}

// ── ファイルから ──
function azPickFile(){
  let inp = document.getElementById('az-file-input');
  if(!inp){
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'az-file-input'; inp.accept = '.txt,.zip,text/plain,application/zip'; inp.multiple = true; inp.style.display = 'none';
    inp.onchange = () => azImportFiles(inp);
    document.body.appendChild(inp);
  }
  inp.value = '';
  inp.click();
}
async function azLoadJSZip(){
  if(window.JSZip) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = res; s.onerror = () => rej(new Error('JSZip load failed'));
    document.head.appendChild(s);
  });
}
async function azImportFiles(inp){
  const files = Array.from(inp.files || []);
  if(!files.length) return;
  azClose();
  const texts = [];
  for(const f of files){
    try{
      if(/\.zip$/i.test(f.name)){
        await azLoadJSZip();
        const zip = await JSZip.loadAsync(f);
        const ents = Object.values(zip.files).filter(z => !z.dir && /\.txt$/i.test(z.name));
        for(const z of ents) texts.push({ name: z.name.split('/').pop(), text: azDecode(await z.async('uint8array')) });
      }else if(/\.txt$/i.test(f.name) || /^text\//.test(f.type)){
        texts.push({ name: f.name, text: azDecode(await f.arrayBuffer()) });
      }
    }catch(e){ console.warn('az import', f.name, e); }
  }
  if(!texts.length){ showToast('読めるテキストがありませんでした'); return; }
  let last = null, cnt = 0;
  for(const t of texts){
    try{
      const parsed = azParse(t.text, t.name.replace(/\.txt$/i, ''));
      last = await azAddNovel(parsed, { src: parsed.aozora ? 'aozora-file' : 'file', file: t.name.slice(0, 80) });
      cnt++;
    }catch(e){ console.warn('az parse', t.name, e); }
  }
  if(!cnt){ showToast('取り込めませんでした'); return; }
  showToast(cnt === 1 ? `「${last.title}」を本棚に入れたよ` : `${cnt}冊を本棚に入れたよ`);
  if(cnt === 1) openNovel(last.id);
}

// ── 本棚：青空文庫の印と、はじめての人への案内 ──
const AZ_BANNER_LS = LS_PREFIX + 'az-banner-off';
function azDecorateLibrary(){
  try{
    const grid = document.getElementById('library-grid');
    if(!grid) return;
    (state.library || []).forEach(n => { if(n.ext && n.ext.kind === 'aozora' && !n.ext.look) azFixLook(n); });
    grid.querySelectorAll('.lib-card[data-novel-id]').forEach(card => {
      const n = (state.library || []).find(x => x.id === card.dataset.novelId);
      if(n && n.ext && !card.querySelector('.az-flag')){
        const cv = card.querySelector('.lib-card-cover');
        if(cv) cv.insertAdjacentHTML('beforeend', `<div class="az-flag">${n.ext.kind === 'aozora' ? '青空文庫' : '取り込み'}</div>`);
        const t = card.querySelector('.lib-card-title');
        if(t && n.author && !card.querySelector('.az-author')) t.insertAdjacentHTML('afterend', `<div class="az-author">${azEsc(n.author)}</div>`);
      }
    });
    let off = false; try{ off = localStorage.getItem(AZ_BANNER_LS) === '1'; }catch(_){}
    const hasAz = (state.library || []).some(n => n.ext);
    const old = document.getElementById('az-banner');
    if(off || hasAz){ if(old) old.remove(); return; }
    if(old) return;
    const b = document.createElement('div');
    b.id = 'az-banner';
    b.innerHTML = `<div class="az-b-txt"><b>名作をすぐ読めるよ</b><span>夏目漱石・太宰治・宮沢賢治など（青空文庫）</span></div>
      <button class="az-b-go" onclick="azOpenCatalog()">見てみる</button><button class="az-b-x" onclick="azBannerOff()" aria-label="閉じる">×</button>`;
    grid.parentNode.insertBefore(b, grid);
  }catch(e){ console.warn('az lib', e); }
}
function azBannerOff(){ try{ localStorage.setItem(AZ_BANNER_LS, '1'); }catch(_){} const b = document.getElementById('az-banner'); if(b) b.remove(); }
if(typeof renderLibrary === 'function'){
  const _azOrigRender = renderLibrary;
  renderLibrary = function(){ const r = _azOrigRender.apply(this, arguments); azDecorateLibrary(); return r; };
}
// 青空文庫の本を開いているときは、ふりがなで行の間がガタガタしないようにする
function azBodyClass(){ try{ document.body.classList.toggle('az-book', !!(state.currentNovelId && state.novel && state.novel.ext && state.novel.ext.kind === 'aozora')); }catch(_){} }
if(typeof openNovel === 'function'){
  const _azOrigOpenNovel = openNovel;
  openNovel = async function(){
    const r = await _azOrigOpenNovel.apply(this, arguments);
    azBodyClass();
    return r;
  };
}
// 作品をさがす：ホームの最後に「名作（青空文庫）」の棚
const _azCoverCache = {};
async function azBrowseShelf(){
  const body = document.getElementById('browse-body');
  if(!body || document.getElementById('bh-aozora')) return;
  const terms = body.querySelector('.browse-terms');
  const sec = document.createElement('section');
  sec.className = 'bh-shelf'; sec.id = 'bh-aozora';
  sec.innerHTML = `<div class="bh-head"><h2>名作（青空文庫）</h2><button onclick="azOpenCatalog()" aria-label="名作をもっと見る">すべて<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></button></div>
    <div class="bh-row"><div class="bh-msg">読み込み中...</div></div>`;
  if(terms) body.insertBefore(sec, terms); else body.appendChild(sec);
  try{ _azCatalog = _azCatalog || await azFetch('catalog.json?d=' + new Date().toISOString().slice(0, 10).replace(/-/g, ''), 'json'); }
  catch(_){ sec.remove(); return; }
  const row = sec.querySelector('.bh-row'); if(!row) return;
  const have = new Set((state.library || []).filter(n => n.ext && n.ext.id).map(n => n.ext.id));
  row.innerHTML = (_azCatalog.works || []).map((w, i) => {
    const cv = _azCoverCache[w.id] = _azCoverCache[w.id] || azMakeCover(w.title, w.author);
    return `<button class="bw-card" onclick="azShelfTap(${i})">
      <span class="wc" style="background-image:url('${cv}')">${have.has(w.id) ? '<span class="wc-own">本棚</span>' : ''}</span>
      <span class="bw-title">${azEsc(w.title)}</span><span class="bw-author">${azEsc(w.author)}</span></button>`;
  }).join('');
}
async function azShelfTap(i){
  const w = _azCatalog && _azCatalog.works[i]; if(!w) return;
  let n = (state.library || []).find(x => x.ext && x.ext.id === w.id);
  if(!n){
    showToast('本棚に入れています…');
    try{ n = await azAddNovel(azParse(await azFetch(w.file, 'text'), w.title), { id: w.id, card: w.card || '', src: 'aozora' }); }
    catch(e){ showToast('読み込めませんでした。ネットにつながっているか確認してね'); return; }
    showToast(`「${w.title}」を本棚に入れたよ`);
  }
  try{ closeBrowse(); }catch(_){}
  openNovel(n.id);
}
if(typeof renderBrowseHome === 'function'){
  const _azOrigBH = renderBrowseHome;
  renderBrowseHome = function(){
    const r = _azOrigBH.apply(this, arguments);
    try{ azBrowseShelf(); }catch(_){}
    return r;
  };
}
// 取り込んだ作品は公開できないようにする
if(typeof openPublishModal === 'function'){
  const _azOrigPub = openPublishModal;
  openPublishModal = function(){
    if(state.novel && azIsExternal(state.novel)){ alert('この本は取り込んだ作品なので、公開できません。\n自分で書いた作品だけ公開できます。'); return; }
    return _azOrigPub.apply(this, arguments);
  };
}
if(typeof publishCurrentNovel === 'function'){
  const _azOrigPubNow = publishCurrentNovel;
  publishCurrentNovel = async function(){
    if(state.novel && azIsExternal(state.novel)){ showToast('取り込んだ作品は公開できません'); return; }
    return _azOrigPubNow.apply(this, arguments);
  };
}
/* ══════ 青空文庫ここまで ══════ */
