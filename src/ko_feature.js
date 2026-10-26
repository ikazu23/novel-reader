/* ══════════════════════════════════════════════════════════
   韓国語メモ（beta2）
   ・読書中に韓国語の単語をタップ → 意味をメモ
   ・メモした単語は、どの本でも上に小さく意味が出る（隠すこともできる）
   ・段落ごとに「文のメモ」も残せる
   ・単語帳で一覧・復習・書き出し
══════════════════════════════════════════════════════════ */
const KO_WORDS_LS = LS_PREFIX + 'ko-words';
const KO_SHOW_LS = LS_PREFIX + 'ko-show';
const KO_HANGUL = /[가-힣ㄱ-ㆎ]/;
const KO_RUN = /[가-힣ㄱ-ㆎ]+/g;
let _koWords = null;      // { key: { m: 意味, n: メモ, at: 追加日, ok: 覚えた回数, ng: まだ回数 } }
let _koMaxLen = 0;

function koLoad(){
  if(_koWords) return _koWords;
  try{ _koWords = JSON.parse(localStorage.getItem(KO_WORDS_LS) || '{}') || {}; }catch(_){ _koWords = {}; }
  koRecalc();
  return _koWords;
}
let _koPhrases = null, _koIndex = null;
function koRecalc(){
  // 本文で探す形 → 単語（本体のキー）。別の形（ks）も同じ単語につなぐ
  _koIndex = {};
  Object.entries(_koWords || {}).forEach(([k, e]) => {
    if(!_koIndex[k]) _koIndex[k] = k;
    (e && Array.isArray(e.ks) ? e.ks : []).forEach(a => { if(a && !_koWords[a]) _koIndex[a] = k; });
  });
  _koMaxLen = Object.keys(_koIndex).filter(k => !/\s/.test(k)).reduce((m, k) => Math.max(m, k.length), 0);
  _koPhrases = null;
}
function koResolve(form){ koLoad(); if(!_koIndex) koRecalc(); return (form && _koIndex[form]) || null; }
// 単語帳・復習に出す形（辞書の見出し）
function koHead(k, e){ e = e || (_koWords || {})[k]; return (e && e.h) || k; }
const KO_SHOW_NEW_LS = LS_PREFIX + 'ko-show-new';
function koShowNewDefault(){ return localStorage.getItem(KO_SHOW_NEW_LS) !== '0'; }
function koSetShowNewDefault(on){ try{ localStorage.setItem(KO_SHOW_NEW_LS, on ? '1' : '0'); }catch(_){} }
function koShowsInText(e){ return !!e && e.show !== false; }
// 2語以上のフレーズ（間の空白は何個でも・最後の語は後ろに活用が付いてもOK）
function koPhraseList(){
  if(_koPhrases) return _koPhrases;
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  _koPhrases = Object.keys(koLoad()).filter(k => /\s/.test(k.trim())).sort((a, b) => b.length - a.length)
    .map(k => ({ key: k, re: new RegExp('(^|[^\uAC00-\uD7A3])(' + k.trim().split(/\s+/).map(esc).join('\\s+') + ')', 'g') }));
  return _koPhrases;
}
function koSaveWords(noSync){
  try{ localStorage.setItem(KO_WORDS_LS, JSON.stringify(_koWords || {})); }
  catch(e){ showToast('単語を保存できませんでした'); }
  koRecalc();
  try{ koUpdateBadge(); }catch(_){}
  if(!noSync) koSyncSoon();
}
// 消した単語の記録（ほかの端末の単語帳から復活しないように）
const KO_DEL_LS = LS_PREFIX + 'ko-words-del';
function koDelMap(){ try{ return JSON.parse(localStorage.getItem(KO_DEL_LS) || '{}') || {}; }catch(_){ return {}; } }
function koSetDelMap(m){ try{ localStorage.setItem(KO_DEL_LS, JSON.stringify(m)); }catch(_){} }
function koMarkDeleted(k){ const m = koDelMap(); m[k] = new Date().toISOString(); koSetDelMap(m); }
function koUndelete(k){ const m = koDelMap(); if(m[k]){ delete m[k]; koSetDelMap(m); } }
function koIsLearned(e){ return !!e && (e.ivl || 0) >= 21; } // 次の復習が3週間以上先＝覚えた
const KO_LEARNED_LS = LS_PREFIX + 'ko-hide-learned';
function koHideLearned(){ return localStorage.getItem(KO_LEARNED_LS) !== '0'; }
function koSetHideLearned(on){ try{ localStorage.setItem(KO_LEARNED_LS, on ? '1' : '0'); }catch(_){} koRerender(); }
const KO_NEW_LS = LS_PREFIX + 'ko-new';
const KO_TR_LS = LS_PREFIX + 'ko-tr-mode';
function koNewOn(){ return localStorage.getItem(KO_NEW_LS) === '1'; }
function koSetNew(on){ try{ localStorage.setItem(KO_NEW_LS, on ? '1' : '0'); }catch(_){} koRerender(); }
function koTrMode(){ return localStorage.getItem(KO_TR_LS) || 'show'; } // write / show / off
function koSetTrMode(v){ try{ localStorage.setItem(KO_TR_LS, v); }catch(_){} koRerender(); }
function koShowMode(){ return localStorage.getItem(KO_SHOW_LS) || 'on'; } // on / hide / off
function koSetShowMode(v){
  try{ localStorage.setItem(KO_SHOW_LS, v); }catch(_){}
  koApplyBodyClass();
  koRerender();
}
function koApplyBodyClass(){
  document.body.classList.toggle('ko-hide', koShowMode() === 'hide');
  document.body.classList.toggle('ko-moff', koShowMode() === 'off');
  koScheduleMeasure();
}
/* 意味が上の行に重ならない行間を、実際の画面で測って決める
   （iPhoneなど、フォントによって文字の箱の高さが違うので決め打ちしない） */
let _koMeasureReq = 0;
function koScheduleMeasure(){
  if(_koMeasureReq) return;
  _koMeasureReq = requestAnimationFrame(() => requestAnimationFrame(() => { _koMeasureReq = 0; try{ koMeasureGloss(); }catch(e){ console.warn('ko measure', e); } }));
}
function koMeasureGloss(){
  const kws = [...document.querySelectorAll('#viewport:not(.edit-mode) .page-editor .kw:not(.learned)')].slice(0, 40);
  let need = 0, drop = Infinity;
  kws.forEach(kw => {
    const r = kw.getClientRects()[0];
    if(!r || !r.height) return;
    const cs = getComputedStyle(kw), bs = getComputedStyle(kw, '::before');
    if(bs.display === 'none' || bs.content === 'none') return;
    const fs = parseFloat(cs.fontSize) || 15;
    const pfs = parseFloat(getComputedStyle(kw.closest('p') || kw).fontSize) || fs;
    let gh = parseFloat(bs.height);
    if(!(gh > 0)) gh = (parseFloat(bs.fontSize) || fs * 0.5) * 1.2;
    // 文字の箱の上の余白の分だけ、意味を文字に近づける（控えめに）
    const d = Math.max(0, ((r.height - fs) / 2 - fs * 0.06) * 0.6);
    drop = Math.min(drop, d);
    // 行の間隔 ≧ 文字の箱 ＋ 意味 − 近づけた分 ＋ 少しの余裕
    need = Math.max(need, (r.height + gh - d + Math.max(2, fs * 0.06)) / pfs);
  });
  if(!need) return;
  if(!isFinite(drop)) drop = 0;
  const root = document.body.style;
  const lh = (Math.ceil(need * 20) / 20).toFixed(2), dp = drop.toFixed(1) + 'px';
  if(root.getPropertyValue('--ko-minlh') !== lh) root.setProperty('--ko-minlh', lh);
  if(root.getPropertyValue('--ko-gdrop') !== dp) root.setProperty('--ko-gdrop', dp);
  koLayoutWrapped(drop);
}
/* 2行にまたがる単語・フレーズ：意味も2つに分けて、それぞれの行の上に出す */
function koSplitGloss(t, ratio){
  const chars = [...t];
  if(chars.length < 3) return [t, ''];
  const target = Math.max(1, Math.min(chars.length - 1, Math.round(chars.length * ratio)));
  const good = i => { const a = chars.slice(i).join(''), b = chars[i - 1]; return /^(という|として|ような|ように|の|を|が|は|に|で|と|も|へ|（|・)/.test(a) || /[・、）]/.test(b); };
  let best = target, bd = Infinity;
  for(let i = 1; i < chars.length; i++){ if(good(i) && Math.abs(i - target) < bd && Math.abs(i - target) <= 3){ bd = Math.abs(i - target); best = i; } }
  return [chars.slice(0, best).join(''), chars.slice(best).join('')];
}
function koLayoutWrapped(drop){
  const kws = [...document.querySelectorAll('#viewport:not(.edit-mode) .page-editor .kw')].slice(0, 600);
  const clear = kw => {
    if(!kw.classList.contains('kwrap')) return;
    kw.classList.remove('kwrap');
    ['--k1x', '--k1y', '--k1w', '--kf1', '--k2x', '--k2y', '--k2w', '--kf2'].forEach(v => kw.style.removeProperty(v));
    delete kw.dataset.m1; delete kw.dataset.m2;
  };
  kws.forEach(kw => {
    const rects = [...kw.getClientRects()].filter(r => r.width > 0);
    if(rects.length < 2 || kw.classList.contains('learned') || kw.classList.contains('kfade')){ clear(kw); return; }
    const r1 = rects[0], r2 = rects[rects.length - 1];
    // 意味を置く基準の位置（ブラウザによって違うので、実際に測る）
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;padding:0;margin:0;border:0';
    kw.appendChild(probe);
    const o = probe.getBoundingClientRect();
    probe.remove();
    const fpx = parseFloat(getComputedStyle(kw).fontSize) || 15;
    const g = Math.max(9, fpx * 0.5);
    const full = kw.dataset.m || '';
    const [m1, m2] = koSplitGloss(full, r1.width / (r1.width + r2.width));
    const fit = (txt, w) => { const tw = koTextW(txt) * g; const sc = tw ? Math.max(0.75, Math.min(1, (w + fpx * 0.3) / tw)) : 1; return g * sc; };
    const f1 = fit(m1, r1.width), f2 = fit(m2, r2.width);
    const d = drop || 0;
    kw.dataset.m1 = m1; kw.dataset.m2 = m2;
    const set = (k, v) => kw.style.setProperty(k, v);
    set('--k1x', (r1.left - o.left).toFixed(1) + 'px'); set('--k1y', (r1.top - o.top - f1 * 1.2 + d).toFixed(1) + 'px');
    set('--k1w', (r1.width + fpx * 0.3).toFixed(1) + 'px'); set('--kf1', f1.toFixed(1) + 'px');
    set('--k2x', (r2.left - o.left).toFixed(1) + 'px'); set('--k2y', (r2.top - o.top - f2 * 1.2 + d).toFixed(1) + 'px');
    set('--k2w', (r2.width + fpx * 0.3).toFixed(1) + 'px'); set('--kf2', f2.toFixed(1) + 'px');
    kw.classList.add('kwrap');
  });
}
/* 本文の上に出す意味：「・」の前だけ（全部はタップで見る） */
function koGlossText(m){
  const s = String(m || '');
  // チョン・ヒウォン のようなカタカナの名前の「・」では切らない
  const t = s.split(/(?<![\u30a0-\u30ff])・|・(?![\u30a0-\u30ff])|、/)[0].trim();
  return t || s;
}
// 文字のだいたいの幅（その文字の大きさを1として）
function koTextW(t, korean){
  let w = 0;
  for(const ch of String(t)){
    if(/\s/.test(ch)) w += 0.3;
    else if(/[\u3000-\u9fff\uac00-\ud7a3\uff00-\uffef]/.test(ch)) w += korean ? 1.06 : 1;
    else w += 0.6;
  }
  return w;
}
// 意味が下の単語より長いとき：小さくする → 後ろに語尾があれば左寄せでそこまで使う → それでも長ければ「…」
function koFitGloss(rb, gloss, word, rest, fpx){
  const g = Math.max(9, fpx * 0.5);
  const gw = koTextW(gloss) * g;
  const ww = koTextW(word, true) * fpx;
  let room = ww + 0.4 * fpx;
  if(gw <= room) return;
  if(rest){ room = (koTextW(word, true) + koTextW(rest, true)) * fpx + 0.1 * fpx; rb.classList.add('kl'); }
  const sc = Math.max(0.8, Math.min(1, room / gw));
  rb.style.setProperty('--kfs', (g * sc).toFixed(1) + 'px');
  rb.style.setProperty('--kmw', Math.max(room, g * sc * 2).toFixed(1) + 'px');
}
// 意味の付け直し：今見ているページだけすぐ描き直して、ほかのページはあとで少しずつ（全ページ一気だと画面が止まるので）
let _koDirty = null, _koDirtyTimer = null, _koRerenderWait = null;
function koRerenderLater(){
  if(_koDirtyTimer) return;
  const run = () => {
    _koDirtyTimer = null;
    const d = _koDirty;
    if(!d || d.pages !== state.pages || state.editMode){ _koDirty = null; return; }
    if(state.ui && state.ui.transitioning){ _koDirtyTimer = setTimeout(run, 150); return; }   // めくっている最中は待つ
    const pi = [...d.set][0];
    if(pi == null){ _koDirty = null; return; }
    d.set.delete(pi);
    try{ if(state.pages[pi] && pi !== state.curPage) refreshPage(pi); }catch(_){}
    if(d.set.size) koRerenderLater(); else _koDirty = null;
  };
  const go = () => { _koDirtyTimer = (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 800 }) : setTimeout(run, 60)) || 1; };
  _koDirtyTimer = setTimeout(go, 120);
}
// めくる直前に、まだ描き直していないページなら描き直す
function koFlushDirtyPage(pi){
  const d = _koDirty;
  if(!d || d.pages !== state.pages || !d.set.has(pi)) return;
  d.set.delete(pi);
  try{ refreshPage(pi); }catch(_){}
}
if(typeof slideToPage === 'function'){
  const _koOrigSlide = slideToPage;
  slideToPage = function(next){ if(!state.ui.transitioning) koFlushDirtyPage(next); return _koOrigSlide.apply(this, arguments); };
}
function koRerender(){
  if(state.editMode || !state.pages) return;
  if(state.ui && state.ui.transitioning){   // めくっている途中なら、終わってから
    if(!_koRerenderWait) _koRerenderWait = setTimeout(() => { _koRerenderWait = null; koRerender(); }, 200);
    return;
  }
  // 意味を保存したときなどに、見ている場所がずれないようにする（上の行に意味が増えても、同じ段落が同じ位置に来るように）
  const pageEl = document.getElementById('page-' + state.curPage);
  let anchor = null;
  if(pageEl){
    const top = pageEl.getBoundingClientRect().top;
    const ps = [...pageEl.querySelectorAll('[data-qi]')];
    let el = null;
    if(_koCur && _koCur.qi >= 0) el = ps.find(p => String(p.dataset.qi) === String(_koCur.qi) && (_koCur.pi == null || _koCur.pi < 0 || p.dataset.pi == null || String(p.dataset.pi) === String(_koCur.pi)));
    if(el){ const r = el.getBoundingClientRect(); if(r.bottom < top || r.top > top + pageEl.clientHeight) el = null; }
    if(!el) el = ps.find(p => p.getBoundingClientRect().bottom > top);
    if(el) anchor = { pi: el.dataset.pi, qi: el.dataset.qi, off: el.getBoundingClientRect().top - top };
  }
  if(state.pages[state.curPage]) refreshPage(state.curPage); else state.pages.forEach((_, pi) => refreshPage(pi));
  const rest = new Set(state.pages.map((_, pi) => pi).filter(pi => pi !== state.curPage));
  if(_koDirty && _koDirty.pages === state.pages) _koDirty.set.forEach(pi => rest.add(pi));
  _koDirty = rest.size ? { pages: state.pages, set: rest } : null;
  if(_koDirty) koRerenderLater();
  if(anchor){
    const fix = () => {
      const pe = document.getElementById('page-' + state.curPage);
      if(!pe) return;
      const el = [...pe.querySelectorAll('[data-qi]')].find(p => String(p.dataset.qi) === String(anchor.qi) && String(p.dataset.pi) === String(anchor.pi));
      if(!el) return;
      const d = (el.getBoundingClientRect().top - pe.getBoundingClientRect().top) - anchor.off;
      if(Math.abs(d) > 0.5) pe.scrollTop += d;
    };
    fix();
    requestAnimationFrame(fix);
  }
}

/* ── 本文の表示：覚えた単語に意味をのせる・文のメモの印 ── */
function koParaPlain(para){ return stripFuriganaText(para.html || '') || para.text || ''; }
function koHash(s){
  s = String(s || '').replace(/\s+/g, ' ').trim();
  let h = 5381; for(let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + '_' + s.length;
}
function koNotes(){
  if(!state.novel) return {};
  if(!state.novel.koNotes || typeof state.novel.koNotes !== 'object') state.novel.koNotes = {};
  return state.novel.koNotes;
}
function koFindKey(run){
  const f = koFindForm(run);
  return f ? f.key : null;
}
// 本文の語が、登録した語＋助詞・語尾として読めるか（나는・나도 はOK、나머지 は別の単語）
function koFormOk(run, f, key){
  if(run.length === f.length || /\s/.test(key)) return true;
  const head = koHead(key);
  if(/다$/.test(head) && head.length > 1) return true;            // 動詞・形容詞は語尾がいろいろ
  const rest = run.slice(f.length);
  const sp = koSplitTail(rest, KO_PART_TABLE);
  if(sp && !sp.left) return true;
  if(koRestFits(rest, true)){                                       // 웃＋으며 のような動詞の語幹
    if(_koDict && !koHead(key).endsWith('다') && _koDict[key] && !_koDict[key].some(e => /^(動|形)$/.test(e[0]))){
      const l = koDictLookup(run, '', '', 1)[0];
      if(l && l.verb && l.full) return false;                        // 세게＝세다＋게（三 ではない）
    }
    return true;
  }
  if(f.length === 1 && _koDict && _koDict[f + '하다'] && /^(하|해|했|한|할|합|함)/.test(rest)) return false;   // 말해보자＝말하다（言葉 ではない）
  if(/^(하|해|했|한|할|합|함|되|돼|됐|된|될|됩|받|당|시키|시켜|스러|스럽|스런|답|롭|로운|들|님|씨|적)/.test(rest)) return true;
  if(f.length === 1) return false;                                // 1文字の語（나・이・그）は、助詞のときだけ
  if(_koDict && _koDict[run] && _koDict[run].some(e => !KO_FUNC_POS.includes(e[0]))) return false;
  return true;
}
// 本文で見つけた形の長さ（別の形で見つかったときのため）
function koFindForm(run){
  koLoad();
  if(!_koIndex) koRecalc();
  for(let L = Math.min(run.length, _koMaxLen); L >= 1; L--){
    const f = run.slice(0, L);
    if(_koIndex[f] && koFormOk(run, f, _koIndex[f])) return { key: _koIndex[f], form: f };
  }
  return null;
}
function koDecorateHtml(html, para){
  if(!koEnabled()) return html;
  const words = koLoad();
  const mode = koShowMode();
  const plain = koParaPlain(para);
  const note = plain && state.novel && state.novel.koNotes ? state.novel.koNotes[koHash(plain)] : null;
  const markNew = mode !== 'off' && koNewOn();
  const hasWords = mode !== 'off' && (_koMaxLen > 0 || markNew || koPhraseList().length) && KO_HANGUL.test(plain);
  if(!hasWords && !note) return html;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const ph = koHash(plain), senses = (state.novel && state.novel.koSense) || {}, occ = {};
  const fpx = (para && para.size) || (state.settings && state.settings.fontSize) || 15;
  const mkSpan = (key, text, rest, prevRun) => {
    const rb = document.createElement('span');
    const learned = koHideLearned() && koIsLearned(words[key]);
    rb.className = 'kw' + (/\s/.test(key) ? ' phrase' : '') + (learned ? ' learned' : (koFaded(words[key]) ? ' kfade' : ''));
    rb.dataset.kw = key;
    const ni = occ[key] = (occ[key] || 0) + 1;
    const alt = senses[ph + '|' + key + '|' + ni];
    const aux = !alt && prevRun ? koAuxGloss(prevRun, text + (rest || '')) : '';
    let full = alt || aux || words[key].m || '…';
    if(!alt && !aux && words[key].m && koPastAttr(key, text + (rest || ''))) full = koJaPast(words[key].m);
    rb.dataset.m = koGlossText(full);
    if(aux) rb.title = aux + '（' + (words[key].m || '') + '）';
    if(rb.dataset.m !== full) rb.title = full;
    if(alt) rb.classList.add('alt');
    rb.textContent = text;
    koFitGloss(rb, rb.dataset.m, text, rest || '', fpx);
    return rb;
  };
  // フレーズを先に（その中の単語には個別の意味を付けない）
  const phrases = mode !== 'off' ? koPhraseList() : [];
  if(hasWords && phrases.length){
    const w0 = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement && n.parentElement.closest('ruby,rt,.kw') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const ns = []; let x; while((x = w0.nextNode())) ns.push(x);
    ns.forEach(node => {
      const text = node.textContent;
      if(!KO_HANGUL.test(text) || !/\s/.test(text)) return;
      const found = [];
      phrases.forEach(pp => { if(!koShowsInText(words[pp.key])) return; pp.re.lastIndex = 0; let m; while((m = pp.re.exec(text))){ found.push({ i: m.index + m[1].length, len: m[2].length, key: pp.key }); pp.re.lastIndex = m.index + m[1].length + 1; } });
      if(!found.length) return;
      found.sort((a, b) => a.i - b.i || b.len - a.len);
      const frag = document.createDocumentFragment();
      let last = 0;
      found.forEach(f => {
        if(f.i < last) return;
        if(f.i > last) frag.appendChild(document.createTextNode(text.slice(last, f.i)));
        frag.appendChild(mkSpan(f.key, text.substr(f.i, f.len), (text.slice(f.i + f.len).match(/^[가-힣]*/) || [''])[0]));
        last = f.i + f.len;
      });
      if(last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  if(hasWords){
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement && n.parentElement.closest('ruby,rt,.kw,.ko-new') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; let n; while((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      const text = node.textContent;
      if(!KO_HANGUL.test(text)) return;
      const frag = document.createDocumentFragment();
      let last = 0, any = false, m, prevRun = '', prevEnd = -1;
      KO_RUN.lastIndex = 0;
      while((m = KO_RUN.exec(text))){
        const pr = (prevEnd >= 0 && /^\s+$/.test(text.slice(prevEnd, m.index))) ? prevRun : '';
        prevRun = m[0]; prevEnd = m.index + m[0].length;
        const fd = koFindForm(m[0]);
        const key = fd && koShowsInText(words[fd.key]) ? fd.key : null;
        if(fd && !key) continue; // 単語帳だけに入れた単語：本文には何も付けない
        if(!key){
          if(!markNew) continue;
          any = true;
          if(m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const sp = document.createElement('span');
          sp.className = 'ko-new';
          sp.textContent = m[0];
          frag.appendChild(sp);
          last = m.index + m[0].length;
          continue;
        }
        any = true;
        if(m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        // 意味は文字の上に浮かせて出す（ルビだと単語の間が空いてしまうので）
        frag.appendChild(mkSpan(key, fd.form, m[0].slice(fd.form.length), pr));
        last = m.index + fd.form.length;
      }
      if(!any) return;
      if(last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  if(note){
    const mk = document.createElement('span');
    mk.className = 'ko-note-mark';
    mk.dataset.h = koHash(plain);
    mk.textContent = '✎';
    tmp.appendChild(mk);
  }
  return tmp.innerHTML;
}
// 閲覧中の段落の表示（ふりがな → 韓国語メモ）
function buildReadDisplayHtml(para){
  // 自分の訳で読む：訳がある段落は訳だけ、まだの段落は原文をうすく
  if(koTrMode() === 'only' && state.novel && koEnabled()){
    const plain = koParaPlain(para);
    if(KO_HANGUL.test(plain)){
      const tr = (state.novel.koTr || {})[koHash(plain)];
      // 元の本文を data-orig に持たせておく（万一この表示が保存されても元に戻せるように）
      const orig = ' data-orig="' + escapeHtml(para.html || escapeHtml(para.text || '')) + '"';
      if(tr) return '<span class="ko-tr-only"' + orig + '>' + escapeHtml(tr).replace(/\n/g, '<br>') + '</span>';
      return '<span class="ko-untr"' + orig + '>' + escapeHtml(plain) + '</span>';
    }
  }
  const base = shouldShowFuriganaDisplay() ? buildFuriganaDisplayHtml(para) : (para.html || '');
  try{ return koDecorateHtml(base, para); }catch(e){ console.warn('ko decorate', e); return base; }
}

/* ── タップした場所の単語を拾う ── */
function koCaretAt(x, y){
  if(document.caretRangeFromPoint){
    const r = document.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  if(document.caretPositionFromPoint){
    const p = document.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  return null;
}
// 文の中で、その語の前後の語（フレーズにつなげる用）
function koNeighbors(sentence, eojeol, occ){
  const toks = String(sentence || '').split(/\s+/).filter(Boolean);
  const clean = t => (t.match(/[\uAC00-\uD7A3\u3131-\u318E]+/) || [''])[0];
  const first = eojeol.split(/\s+/)[0];
  let idx = toks.map((t, j) => clean(t) === first ? j : -1).filter(j => j >= 0);
  if(!idx.length) idx = toks.map((t, j) => clean(t).startsWith(first) ? j : -1).filter(j => j >= 0);
  const i = idx.length ? (idx[occ || 0] != null ? idx[occ || 0] : idx[0]) : -1;
  // 文の終わり（. ! ? 」など）をまたいではつなげない
  const end = toks.map(t => /[.!?…。」』"'”’)\]]$/.test(t));
  return { toks: toks.map(clean), raw: toks, end, i };
}
// 押した語が、段落の中で同じ語の何回目か（ルビ・意味の表示は数えない）
function koOccBefore(paraEl, node, offset, eojeol){
  try{
    const r = document.createRange();
    r.setStart(paraEl, 0);
    if(node.nodeType === 3) r.setEnd(node, offset); else r.setEndBefore(node);
    const frag = r.cloneContents();
    frag.querySelectorAll('rt, .ko-note-mark, .ko-tr').forEach(x => x.remove());
    const first = String(eojeol || '').split(/\s+/)[0];
    return frag.textContent.split(/\s+/).filter(t => ((t.match(/[\uAC00-\uD7A3\u3131-\u318E]+/) || [''])[0]) === first).length;
  }catch(_){ return 0; }
}
function koHitAt(e){
  const t = e.target;
  const paraEl = t.closest && t.closest('p[data-qi]');
  if(!paraEl) return null;
  const pi = parseInt(paraEl.dataset.pi, 10), qi = parseInt(paraEl.dataset.qi, 10);
  const para = state.pages[pi] && state.pages[pi].paras[qi];
  if(!para) return null;
  const sentence = koParaPlain(para);
  const mark = t.closest('.ko-note-mark');
  if(mark) return { type: 'note', sentence, pi, qi };
  const rb = t.closest('.kw');
  if(rb){
    const same = [...paraEl.querySelectorAll('.kw')].filter(x => x.dataset.kw === rb.dataset.kw);
    const place = koHash(sentence) + '|' + rb.dataset.kw + '|' + (same.indexOf(rb) + 1);
    const after = rb.nextSibling && rb.nextSibling.nodeType === 3 ? (rb.nextSibling.textContent.match(/^[가-힣ㄱ-ㆎ]*/) || [''])[0] : '';
    const eo = rb.textContent + after;
    return { type: 'word', key: rb.dataset.kw, eojeol: eo, sentence, pi, qi, place, occ: koOccBefore(paraEl, rb, 0, eo) };
  }
  const c = koCaretAt(e.clientX, e.clientY);
  if(!c || !c.node || c.node.nodeType !== 3 || !paraEl.contains(c.node)) return null;
  const text = c.node.textContent;
  let s = c.offset, en = c.offset;
  if(!(KO_HANGUL.test(text.charAt(s)) || KO_HANGUL.test(text.charAt(s - 1)))) return null;
  while(s > 0 && KO_HANGUL.test(text.charAt(s - 1))) s--;
  while(en < text.length && KO_HANGUL.test(text.charAt(en))) en++;
  let eojeol = text.slice(s, en);
  // 単語の前半がメモ済み（ルビの中）で、後ろの助詞だけをタップしたとき
  if(s === 0 && c.node.previousSibling && c.node.previousSibling.nodeType === 1 && c.node.previousSibling.matches('.kw')){
    const k = c.node.previousSibling.dataset.kw;
    const eo = c.node.previousSibling.textContent + eojeol;
    return { type: 'word', key: k, eojeol: eo, sentence, pi, qi, occ: koOccBefore(paraEl, c.node.previousSibling, 0, eo) };
  }
  if(!eojeol) return null;
  const hit = { type: 'word', key: null, eojeol, sentence, pi, qi, occ: koOccBefore(paraEl, c.node, s, eojeol) };
  try{ koJoinBroken(hit, pi, qi, sentence, text, s, en); }catch(_){}
  return hit;
}
// 改行で単語が切れている（뒤섞 / 였다）とき、つなげて調べる
function koJoinBroken(hit, pi, qi, sentence, text, s, en){
  if(!_koDict) return;
  const paras = (state.pages[pi] || {}).paras || [];
  const plainOf = q => { const pa = paras[q]; return pa && pa.type === 'text' ? koParaPlain(pa) : ''; };
  const w = hit.eojeol;
  // 辞書にない・動詞の語幹だけ（뒤섞・비쳤）のときだけ、切れているとみる
  const incomplete = x => { const f = koDictLookup(x, '', ''); return !f.length || (/다$/.test(f[0].head) && f[0].verb && f[0].head.slice(0, -1).length >= x.length - (/[었았였했겠]$/.test(x) ? 1 : 0)); };
  let a = '', b = '';
  if(en === text.length && /[가-힣]$/.test(sentence.trimEnd()) && sentence.trimEnd().endsWith(w)){
    const nx = plainOf(qi + 1).trimStart(); const m = nx.match(/^[가-힣]+/);
    if(m){ a = w; b = m[0]; }
  }else if(s === 0 && sentence.trimStart().startsWith(w)){
    const pv = plainOf(qi - 1).trimEnd(); const m = pv.match(/[가-힣]+$/);
    if(m){ a = m[0]; b = w; }
  }
  if(!a || !b || a.length > 6) return;
  if(!incomplete(a)) return;
  const j = a + b, f = koDictLookup(j, '', '');
  if(!f.length || f[0].guess) return;
  if(f[0].head.replace(/다$/, '').length < a.length) return;
  hit.eojeol = j; hit.joined = [a, b];
}

/* ── 語幹の候補（助詞・語尾をざっくり外す） ── */
const KO_PARTICLES = ['로서는','으로서는','로서','째','이길래','이라던데','라던데','이라든가','라든가','에겐','한테는','이여','에서부터','에게서','한테서','으로서','으로써','으로는','에서는','에게는','이라고','라고','이라는','라는','에서','에게','한테','께서','까지','부터','처럼','보다','마저','조차','밖에','이나','이랑','하고','으로','은','는','이','가','을','를','에','의','도','만','과','와','로','랑','나','야','께','요',
  '서','에선','엔','께선','한텐','부턴','끼리','마다','같이','답게','측','분','쯤','뿐','대로','만큼','이라도','라도','이고','인데요','인데','인지','인가요','인가','인건가',
  '이라서','라서','이라','이라면','라면','이면','이라니','라니','이잖아','이었으나','였으나','이었던','였던','이기도','이니까','이네요','이죠','이지','임','이란','란','이겠지','이었으니까','들'];
const KO_ENDINGS = ['했습니다','합니다','했었다','했었어','했다','했어','했지','하는','하고','해서','하며','하게','하면','한다','하다','할','한','해','습니다','ㅂ니다','었다','았다','였다','었어','았어','였어','는다','ㄴ다','고','는','은','다','지만','면서','어서','아서','여서','게','지','며','면','어','아','요'];
function koCandidates(eojeol){
  const out = [];
  const add = w => { if(w && w.length >= 1 && !out.includes(w)) out.push(w); };
  add(eojeol);
  const strip = (w, list) => { for(const p of list){ if(w.length > p.length && w.endsWith(p)) return w.slice(0, -p.length); } return null; };
  const p1 = strip(eojeol, KO_PARTICLES);
  if(p1){ add(p1); if(p1.endsWith('들') && p1.length > 1) add(p1.slice(0, -1)); }
  if(eojeol.endsWith('들') && eojeol.length > 1) add(eojeol.slice(0, -1));
  const v = strip(eojeol, KO_ENDINGS);
  if(v) add(v);
  return out;
}

/* ── 単語メモの画面（下から出るシート） ── */
let _koCur = null;
function koOpenSheet(hit){
  koLoad();
  _koPhrase = null;
  _koCur = hit;
  _koFromFreq = !!hit.fromFreq;
  if(hit.joined) setTimeout(() => showToast(`改行で切れていたので「${hit.joined[0]}${hit.joined[1]}」として調べたよ`), 50);
  const sh = document.getElementById('ko-sheet');
  const body = document.getElementById('ko-sheet-body');
  if(hit.type === 'note'){ koOpenNote(hit); return; }
  const cands = koCandidates(hit.eojeol);
  // 選んでおく候補：登録済み（別の形も） → 助詞・들を外した形 → 助詞を外した形 → そのまま
  const lemmaStems = koLemmaCands(hit.eojeol).filter(c => c.endsWith('다')).map(c => c.slice(0, -1));
  const fd = koFindForm(hit.eojeol);
  // 登録した短い語（나）を、別の単語（나머지）として開かない
  const resolveOk = c => { const k = koResolve(c); return k && (!hit.eojeol.startsWith(c) || koFormOk(hit.eojeol, c, k)) ? k : null; };
  const freeC = cands.filter(c => !koResolve(c) || resolveOk(c));   // 別の単語として登録済みの形（세＝三）は選ばない
  let key = hit.key || (fd && fd.key) || cands.map(resolveOk).find(Boolean) || lemmaStems.map(c => hit.eojeol.startsWith(c) && resolveOk(c)).find(Boolean) || freeC[freeC.length - 1] || hit.eojeol;
  if(!cands.includes(key)) cands.unshift(key);
  const ent = _koWords[key];
  _koHeadAuto = !ent || !ent.h;
  body.innerHTML = `
    <div class="ko-head">
      <div class="ko-eojeol">${escapeHtml(hit.eojeol)}</div>
      <button class="ko-icon-btn" onclick="koSpeak(document.getElementById('ko-headw').value || document.getElementById('ko-key').value)" title="発音を聞く">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 8 8 8 12 4 12 20 8 16 4 16"/><path d="M16 8a5 5 0 0 1 0 8"/></svg>
      </button>
    </div>
    <div id="ko-form-info" class="ko-form-info" style="display:none"></div>
    <div id="ko-dict-wrap">${ent ? '<button class="ko-dict-open" onclick="koShowDictFor()">辞書から意味を足す</button>' : '<div class="ko-label">辞書</div><div id="ko-dict"></div><div id="ko-ex"></div>'}</div>
    <div class="ko-adv">
    <div class="ko-label">単語帳に入る形（辞書の形）</div>
    <input id="ko-headw" class="ko-input ko-headw" value="${escapeHtml(ent ? koHead(key, ent) : koGuessHead(key, hit.eojeol))}" oninput="_koHeadAuto=false" autocomplete="off" spellcheck="false">
    <div class="ko-join" id="ko-join"></div>
    <details class="ko-detail" ${ent && ent.ks && ent.ks.length ? 'open' : ''}>
      <summary>本文で探す形：<b id="ko-key-sum">${escapeHtml(key)}</b>${ent && ent.ks && ent.ks.length ? `・${escapeHtml(ent.ks.join('・'))}` : ''}</summary>
      <div class="ko-dict-msg" style="margin-top:6px">本文の中で、この形で始まる語に意味を付けます。ふつうは変えなくてOK</div>
      <div class="ko-chips">${cands.map(c => `<button class="ko-chip ${c === key ? 'on' : ''}" onclick="koPickKey(this)">${escapeHtml(c)}</button>`).join('')}</div>
      <input id="ko-key" class="ko-input" value="${escapeHtml(key)}" oninput="koOnKeyInput()" autocomplete="off" spellcheck="false">
      <div class="ko-label">ほかの形（不規則に変わる語など。例：짓다 → 지・짓）</div>
      <div id="ko-forms"></div>
      <div class="ko-addm"><input id="ko-form-in" class="ko-input" placeholder="形を足す" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();koAddForm();}"><button onclick="koAddForm()">追加</button></div>
    </details>
    </div>
    <div class="ko-label">意味${hit.place ? '（●＝この場所の意味）' : ''}</div>
    <div id="ko-means"></div>
    <div class="ko-addm"><input id="ko-mean" class="ko-input" placeholder="${ent ? '別の意味を足す' : '例：人'}" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();koAddMeaning();}"><button onclick="koAddMeaning()">追加</button></div>
    ${ent ? '<div id="ko-uses" class="ko-uses"></div>' : ''}
    <div class="ko-adv">
    <label class="ko-showchk"><input type="checkbox" id="ko-show" ${(ent ? koShowsInText(ent) : koShowNewDefault()) ? 'checked' : ''}> 本文に意味を出す<small>（オフだと単語帳と復習だけ）</small></label>
    <div class="ko-label">メモ（使い方・活用など、なくてもOK）</div>
    <textarea id="ko-memo" class="ko-input" rows="2" placeholder="例：〜들 で「〜たち」">${escapeHtml(ent ? (ent.n || '') : '')}</textarea>
    </div>
    <button class="ko-more-btn" onclick="koToggleMore(this)">▶ くわしく（形を変える・メモ など）</button>
    <div class="ko-links">
      <button onclick="koOpenDict()">辞書で調べる</button>
      <button onclick="koOpenPapago()">文を翻訳</button>
      <button onclick="koOpenNote(_koCur)">${koNotes()[koHash(hit.sentence)] ? '文のメモを見る' : '文にメモ'}</button>
    </div>
    ${koIsLearned(ent) ? `<div class="ko-learned-row"><span class="ko-learned-badge">覚えた</span>次の復習が3週間以上先なので、本文では意味を出していません<button onclick="koUnlearn()">まだ覚えてない</button></div>` : ''}
    <div class="ko-actions">
      <button class="ko-del" id="ko-del-btn" onclick="koDeleteWord()" style="${ent ? '' : 'visibility:hidden'}">削除</button>
      <button class="ko-cancel" onclick="koCloseSheet()">閉じる</button>
      <button class="ko-save" onclick="koSaveWord()">保存</button>
    </div>`;
  sh.classList.toggle('ko-simple', koSimpleOn());
  sh.classList.remove('ko-more');
  sh.classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
  koEditLoad(key, hit);
  if(ent && /\s/.test(key)){ koShowPhraseInfo(hit.eojeol.split(/\s+/).filter(Boolean), hit); }
  else if(ent){ try{ koRenderFormInfo(koFormInfoForEntry(hit.eojeol, key, ent)); }catch(e){ console.warn('ko form', e); } }
  _koForms = ent && Array.isArray(ent.ks) ? ent.ks.slice() : [];
  koRenderForms();
  koJoinInit(hit, key);
  if(!ent && !/\s/.test(key)) koFillDict(hit);
  if(ent) setTimeout(() => koShowUses(key), 30);
  if(koTapSpeakOn() && hit.sentence && hit.pi >= 0 && !hit.fromFreq) koSpeak(hit.eojeol, true);
}
/* フレーズにつなげる：前後の語を足していく */
let _koJoin = null;
function koJoinInit(hit, key){
  const nb = koNeighbors(hit.sentence, hit.eojeol, hit.occ);
  const n = /\s/.test(key) ? key.trim().split(/\s+/).length : 1;
  _koJoin = nb.i >= 0 ? { toks: nb.toks, end: nb.end, i0: nb.i, i1: nb.i + n - 1 } : null;
  koJoinRender();
}
function koJoinRender(){
  const box = document.getElementById('ko-join');
  if(!box) return;
  const j = _koJoin;
  if(!j){ box.innerHTML = ''; return; }
  const prev = j.i0 > 0 && !j.end[j.i0 - 1] ? j.toks[j.i0 - 1] : '';
  const next = !j.end[j.i1] ? j.toks[j.i1 + 1] : '';
  const n = j.i1 - j.i0 + 1;
  box.innerHTML = (prev && n < 5 ? `<button onclick="koJoin(-1)">＋ 前の「${escapeHtml(prev)}」とつなげる</button>` : '')
    + (next && n < 5 ? `<button onclick="koJoin(1)">＋ 次の「${escapeHtml(next)}」とつなげる</button>` : '')
    + (n > 1 ? `<span class="ko-join-note">フレーズとして登録します</span>` : '');
}
function koJoin(dir){
  const j = _koJoin;
  if(dir < 0) j.i0--; else j.i1++;
  const parts = j.toks.slice(j.i0, j.i1 + 1);
  const lastW = parts[parts.length - 1];
  // 最後の語：辞書で引けたら辞書の形から（세 가지 → 가지 のまま、끄덕였다 → 끄덕이）
  let stem = null;
  const prevW = parts.length > 1 ? parts[parts.length - 2] : '';
  const lastG = koGrammarInfo(lastW, prevW);
  if(lastG) stem = lastW;
  else if(_koDict){ const f = koDictLookup(lastW, prevW); if(f.length) stem = koKeyFromHead(f[0].head, f[0].ents[0][0], lastW); }
  if(!stem) stem = koCandidates(lastW).slice(-1)[0] || lastW;
  const k = parts.slice(0, -1).concat([stem]).join(' ');
  koSetKey(k);
  document.querySelector('#ko-sheet .ko-eojeol').textContent = parts.join(' ');
  // 見出し：最後の語を辞書の形に（끄덕였다 → 끄덕이다）
  let lastHead = lastW;
  // 세 가지 방법이 → 세 가지 방법（助詞は外す）、끄덕였다 → 끄덕이다
  if(!lastG && _koDict){ const f = koDictLookup(lastW, prevW); if(f.length && (/다$/.test(f[0].head) || lastW.startsWith(f[0].head))) lastHead = f[0].head; }
  koSetHead(parts.slice(0, -1).concat([lastHead]).join(' '));
  _koHeadAuto = false;
  _koEdit = { ms: koMs(_koWords[k]), sel: 0 }; koRenderMeans();
  koShowPhraseInfo(parts, _koCur, j.i0 > 0 && !j.end[j.i0 - 1] ? j.toks[j.i0 - 1] : '');
  const dw = document.getElementById('ko-dict-wrap');
  if(dw) dw.innerHTML = '<div class="ko-dict-msg">フレーズは辞書に載っていないことが多いので、意味を入れてください（「文を翻訳」も参考に）</div>';
  koJoinRender();
}
/* 意味のリスト（いつもの意味＝先頭）と、この場所で使う意味 */
let _koEdit = { ms: [], sel: 0 };
function koMs(e){
  if(!e) return [];
  if(Array.isArray(e.ms) && e.ms.length) return e.ms.map(x => Object.assign({}, x));
  return e.m ? [{ m: e.m }] : [];
}
function koEditLoad(key, hit){
  const ent = _koWords[key];
  _koEdit = { ms: koMs(ent), sel: 0 };
  if(hit && hit.place && ent){
    const alt = ((state.novel && state.novel.koSense) || {})[hit.place];
    const i = alt ? _koEdit.ms.findIndex(x => x.m === alt) : -1;
    if(i >= 0) _koEdit.sel = i;
  }
  koRenderMeans();
}
function koRenderMeans(){
  const box = document.getElementById('ko-means');
  if(!box) return;
  if(_koPhrase) setTimeout(koRenderPhraseInfo, 0);
  const ms = _koEdit.ms;
  if(!ms.length){ box.innerHTML = '<div class="ko-dict-msg">まだ意味がありません。下に入れるか、辞書から選んでください</div>'; return; }
  box.innerHTML = ms.map((x, i) => `
    <div class="ko-mrow ${i === _koEdit.sel ? 'on' : ''}">
      <button class="ko-mpick" onclick="_koEdit.sel=${i};koRenderMeans()"><span class="ko-radio"></span><span class="ko-mtext">${escapeHtml(x.m)}</span></button>
      ${i === 0 ? '<span class="ko-mdef">いつも</span>' : `<button class="ko-mbtn" onclick="koMakeDefault(${i})">いつもにする</button>`}
      <button class="ko-mbtn ko-mx" onclick="koRemoveMeaning(${i})" title="この意味を消す">✕</button>
    </div>`).join('');
}
function koAddMeaning(text, ctx){
  const inp = document.getElementById('ko-mean');
  const m = (text != null ? text : (inp ? inp.value : '')).trim();
  if(!m) return;
  // 新しい単語で、自動で入れた辞書の意味しかないときに自分で入れたら、入れ替える
  if(text == null && _koEdit._auto && _koEdit.ms.length === 1 && !_koWords[((document.getElementById('ko-key') || {}).value || '').trim()]) _koEdit.ms = [];
  if(text == null) _koEdit._auto = false;
  let i = _koEdit.ms.findIndex(x => x.m === m);
  if(i < 0){ _koEdit.ms.push({ m, c: ctx || (_koCur && _koCur.sentence ? _koCur.sentence.slice(0, 140) : '') }); i = _koEdit.ms.length - 1; }
  _koEdit.sel = i;
  if(inp && text == null) inp.value = '';
  koRenderMeans();
}
function koMakeDefault(i){
  const [x] = _koEdit.ms.splice(i, 1);
  _koEdit.ms.unshift(x);
  _koEdit.sel = _koEdit.sel === i ? 0 : (_koEdit.sel < i ? _koEdit.sel + 1 : _koEdit.sel);
  koRenderMeans();
}
function koRemoveMeaning(i){
  _koEdit.ms.splice(i, 1);
  if(_koEdit.sel >= _koEdit.ms.length) _koEdit.sel = 0;
  else if(_koEdit.sel > i) _koEdit.sel--;
  else if(_koEdit.sel === i) _koEdit.sel = 0;
  koRenderMeans();
}
function koShowDictFor(){
  const w = document.getElementById('ko-dict-wrap');
  w.innerHTML = '<div class="ko-label">辞書（タップで意味に追加）</div><div id="ko-dict"></div><div id="ko-ex"></div>';
  koFillDict(_koCur, true);
}
function koPickKey(btn){
  document.querySelectorAll('#ko-sheet .ko-chip').forEach(b => b.classList.toggle('on', b === btn));
  document.getElementById('ko-key').value = btn.textContent;
  koOnKeyInput();
  if(_koHeadAuto && !_koWords[btn.textContent]) koSetHead(koGuessHead(btn.textContent, _koCur && _koCur.eojeol));
}
function koOnKeyInput(){
  const k = document.getElementById('ko-key').value.trim();
  const ent = _koWords[k];
  document.querySelectorAll('#ko-sheet .ko-chip').forEach(b => b.classList.toggle('on', b.textContent === k));
  const sum = document.getElementById('ko-key-sum'); if(sum) sum.textContent = k;
  if(ent){
    _koEdit = { ms: koMs(ent), sel: 0 }; koRenderMeans();
    document.getElementById('ko-memo').value = ent.n || '';
    koSetHead(koHead(k, ent));
    _koForms = Array.isArray(ent.ks) ? ent.ks.slice() : []; koRenderForms();
    const sc = document.getElementById('ko-show'); if(sc) sc.checked = koShowsInText(ent);
  }
  document.getElementById('ko-del-btn').style.visibility = ent ? '' : 'hidden';
}
function koSaveWord(){
  const k = document.getElementById('ko-key').value.trim();
  const n = document.getElementById('ko-memo').value.trim();
  if(document.getElementById('ko-mean').value.trim()) koAddMeaning(); // 入れたまま保存を押したとき
  if(!k){ showToast('登録する形を入れてください'); return; }
  if(!KO_HANGUL.test(k)){ showToast('韓国語の単語を入れてください'); return; }
  if(!_koEdit.ms.length){ showToast('意味を入れてください'); return; }
  koLoad();
  const old = _koWords[k] || {};
  const isNew = !_koWords[k];
  const hit = _koCur || {};
  let ms = _koEdit.ms.slice();
  // 新しく登録するときは、選んだ意味を「いつもの意味」にする
  if(isNew || !hit.place){ if(_koEdit.sel > 0){ const [x] = ms.splice(_koEdit.sel, 1); ms.unshift(x); } }
  const h = ((document.getElementById('ko-headw') || {}).value || '').trim() || k;
  const show = !!(document.getElementById('ko-show') || { checked: true }).checked;
  const ks = _koForms.filter(f => f && f !== k);
  _koWords[k] = Object.assign({}, old, { h, ks, show, m: ms[0].m, ms, n, at: old.at || new Date().toISOString(), ok: old.ok || 0, ng: old.ng || 0, u: new Date().toISOString() });
  // 同じ見出しの単語がほかにあれば1つにまとめる（例：지었다 と 짓 → 짓다）
  Object.keys(_koWords).forEach(k2 => {
    if(k2 === k || koHead(k2) !== h) return;
    const a = _koWords[k], b = _koWords[k2];
    a.ks = Array.from(new Set([...(a.ks || []), k2, ...(b.ks || [])])).filter(x => x !== k);
    koMs(b).forEach(x => { if(!a.ms.some(y => y.m === x.m)) a.ms.push(x); });
    if((b.reps || 0) > (a.reps || 0)) ['ivl', 'ease', 'reps', 'lapses', 'due'].forEach(f => { if(b[f] != null) a[f] = b[f]; });
    if(b.at && b.at < a.at) a.at = b.at;
    if(!a.n && b.n) a.n = b.n;
    delete _koWords[k2];
    koMarkDeleted(k2);
  });
  // この場所だけ別の意味
  if(!isNew && hit.place && hit.key === k && state.novel){
    const sv = state.novel.koSense = state.novel.koSense || {};
    const chosen = _koEdit.ms[_koEdit.sel];
    if(chosen && chosen.m !== ms[0].m) sv[hit.place] = chosen.m; else delete sv[hit.place];
    koPersistNovel();
  }
  // 消した意味・いつもと同じ意味を指している場所は、ふつうの表示に戻す
  if(state.novel && state.novel.koSense){
    const sv = state.novel.koSense; let ch = false;
    Object.keys(sv).forEach(pk => { if(pk.split('|')[1] === k && (!ms.some(x => x.m === sv[pk]) || sv[pk] === ms[0].m)){ delete sv[pk]; ch = true; } });
    if(ch) koPersistNovel();
  }
  koUndelete(k);
  koSaveWords();
  if(isNew) koStat('w');
  koCloseSheet();
  koRerender();
  if(_koFromFreq){ _koFromFreq = false; setTimeout(openKoFreq, 50); }
  showToast(isNew && k.length === 1 && show ? `「${h}」を保存（1文字なので、ほかの単語にも付くことがあります）` : `「${h}」を${show ? '保存しました' : '単語帳に保存しました（本文には出しません）'}`);
}
function koDeleteWord(){
  const k = document.getElementById('ko-key').value.trim();
  if(!_koWords[k]) return;
  if(!confirm(`「${koHead(k)}」を単語帳から消しますか？`)) return;
  delete _koWords[k];
  koMarkDeleted(k);
  koSaveWords();
  koCloseSheet();
  koRerender();
}
function koCloseSheet(){
  _koPhrase = null;
  const sh = document.getElementById('ko-sheet');
  if(sh) sh.classList.remove('show');
  const ov = document.getElementById('ko-sheet-ov');
  if(ov) ov.classList.remove('show');
}
function koOpenDict(){
  const k = (document.getElementById('ko-key') || {}).value || (_koCur && _koCur.eojeol) || '';
  window.open('https://ja.dict.naver.com/#/search?range=all&query=' + encodeURIComponent(k), '_blank', 'noopener');
}
function koOpenPapago(){
  const s = (_koCur && _koCur.sentence) || '';
  window.open('https://papago.naver.com/?sk=ko&tk=ja&st=' + encodeURIComponent(s.slice(0, 1000)), '_blank', 'noopener');
}

/* ── 文のメモ ── */
function koOpenNote(hit){
  if(!hit) return;
  _koCur = hit;
  const h = koHash(hit.sentence);
  const cur = koNotes()[h];
  const body = document.getElementById('ko-sheet-body');
  body.innerHTML = `
    <div class="ko-label" style="margin-top:0">この文</div>
    <div class="ko-sentence">${escapeHtml(hit.sentence)}</div>
    <div class="ko-links" style="margin-top:8px">
      <button onclick="koSpeak(_koCur.sentence)">発音を聞く</button>
      <button onclick="koOpenPapago()">文を翻訳</button>
    </div>
    <div class="ko-label">文のメモ（訳・文法など）</div>
    <textarea id="ko-note" class="ko-input" rows="4" placeholder="例：〜してしまった（-아/어 버리다）">${escapeHtml(cur ? cur.t : '')}</textarea>
    <div class="ko-actions">
      <button class="ko-del" onclick="koDeleteNote()" style="${cur ? '' : 'visibility:hidden'}">削除</button>
      <button class="ko-cancel" onclick="koCloseSheet()">閉じる</button>
      <button class="ko-save" onclick="koSaveNote()">保存</button>
    </div>`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
}
function koPersistNovel(){
  if(!state.novel || !state.currentNovelId) return;
  state.novel.updatedAt = new Date().toISOString();
  const idx = state.library.findIndex(n => n.id === state.currentNovelId);
  if(idx >= 0) state.library[idx].koNotes = JSON.parse(JSON.stringify(state.novel.koNotes || {}));
  if(idx >= 0) state.library[idx].koTr = JSON.parse(JSON.stringify(state.novel.koTr || {}));
  if(idx >= 0) state.library[idx].koSense = JSON.parse(JSON.stringify(state.novel.koSense || {}));
  if(idx >= 0){ if(state.novel.koMode) state.library[idx].koMode = state.novel.koMode; else delete state.library[idx].koMode; }
  if(idx >= 0) state.library[idx].updatedAt = state.novel.updatedAt;
  libDbPut(state.novel).catch(e => console.warn('save koNotes failed:', e));
}
function koSaveNote(){
  const t = document.getElementById('ko-note').value.trim();
  const h = koHash(_koCur.sentence);
  if(t) koNotes()[h] = { t, s: _koCur.sentence.slice(0, 60), at: new Date().toISOString() };
  else delete koNotes()[h];
  koPersistNovel();
  koCloseSheet();
  koRerender();
  showToast(t ? '文のメモを保存しました' : '文のメモを消しました');
}
function koDeleteNote(){
  if(!confirm('この文のメモを消しますか？')) return;
  delete koNotes()[koHash(_koCur.sentence)];
  koPersistNovel();
  koCloseSheet();
  koRerender();
}

/* ── 発音（端末の韓国語の声） ── */
function koSpeak(text, quiet){
  text = (text || '').trim();
  if(!text) return;
  if(!('speechSynthesis' in window)){ showToast('この端末では読み上げが使えません'); return; }
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    const v = speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang));
    if(v) u.voice = v;
    else if(!quiet) showToast('韓国語の声が見つからないので、うまく読めないかもしれません');
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }catch(e){ showToast('読み上げできませんでした'); }
}

/* ── 読書中のタップ ── */
function setupKoTap(){
  try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => koScheduleMeasure()); }catch(_){}
  try{ document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => koScheduleMeasure()); }catch(_){}
  window.addEventListener('resize', () => koScheduleMeasure());
  const vp = $.viewport;
  let timer = null, downX = 0, downY = 0;
  vp.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; }, true);
  vp.addEventListener('click', e => {
    if(state.editMode || !state.currentEpisodeId || !koEnabled()) return;
    if(Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8) return;
    if(e.target.closest && e.target.closest('button, a, .para-img-wrap')) return;
    if(hasTextSelection()) return;
    if(isPcPointer() && edgeZoneAt(e.clientX) !== 0) return; // 端はページ送り
    const hit = koHitAt(e);
    if(!hit) return;
    clearTimeout(timer);
    // ダブルタップ（編集モードに入る）と区別するため少し待つ
    timer = setTimeout(() => {
      if(state.editMode || hasTextSelection()) return;
      koOpenSheet(hit);
    }, 300);
  });
  vp.addEventListener('dblclick', () => { clearTimeout(timer); koCloseSheet(); });
  vp.addEventListener('touchend', () => { /* 2回目のタップでenterEditModeが呼ばれたら timer 側で止まる */ }, { passive: true });
}

/* ── 「한」メニュー ── */
function openKoMenu(){
  if(state.editMode){ showToast('編集中は使えません'); return; }
  const inBook = !!state.currentEpisodeId && koEnabled();
  koSyncWords().catch(() => {});
  const cnt = Object.keys(koLoad()).length;
  const body = document.getElementById('ko-sheet-body');
  const rc = koReviewCounts();
  body.innerHTML = `
    <div class="ko-title">韓国語メモ</div>
    <button class="ko-review-big" onclick="openKoQuiz()" ${cnt ? '' : 'disabled'}>
      <span class="t">今日の復習</span>
      <span class="n">${rc.total ? `${rc.total}枚` : (cnt ? 'おわり' : '単語を登録すると始まります')}</span>
    </button>
    ${inBook ? `<button class="ko-menu-item" onclick="koToggleTrOnly()">${koTrMode() === 'only' ? '原文で読む' : '自分の訳で読む'}<span class="ko-mi-sub">${(() => { const pr = koTrProgress(); return pr ? `この話 ${pr.done}/${pr.all}段落` : ''; })()}</span></button>` : ''}
    ${inBook ? `<button class="ko-menu-item" onclick="openKoFreq()">よく出る未登録の単語<span class="ko-mi-sub">${(() => { const f = koFreqScan(); return f && f.total ? `この話で読める ${Math.round(f.known / f.total * 100)}%` : ''; })()}</span></button>` : ''}
    <button class="ko-menu-item" onclick="openKoWordList()">単語帳<span class="ko-mi-sub">${cnt}語</span></button>
    ${inBook ? `<button class="ko-menu-item" onclick="openKoEpWords()">この話の単語<span class="ko-mi-sub">${koEpWordList().length}語</span></button>` : ''}
    ${(() => { const n = koWeakKeys().length; return n ? `<button class="ko-menu-item" onclick="openKoWeak()">苦手な単語<span class="ko-mi-sub">${n}語</span></button>` : ''; })()}
    ${cnt >= 2 ? '<button class="ko-menu-item" onclick="openKoCloze()">穴埋めクイズ<span class="ko-mi-sub">本の文で練習</span></button>' : ''}
    <button class="ko-menu-item" onclick="openKoGram()">文法帳<span class="ko-mi-sub">${koGramList().length}個</span></button>
    ${inBook ? `<button class="ko-menu-item" onclick="koListenStart()">この話を聞き流す<span class="ko-mi-sub">原文 → 自分の訳</span></button>` : ''}
    <button class="ko-menu-item" onclick="openKoStats()">学習の記録</button>
    <button class="ko-menu-item" onclick="openKoSettings()">表示の設定</button>
    ${inBook ? `<button class="ko-menu-item" onclick="koExportTr()">この話の原文と訳を書き出す</button>
    <button class="ko-menu-item" onclick="koExportTrOnly()">この話の訳だけを書き出す</button>` : ''}
    ${KO_IS_BETA2 || KO_IS_BETA1 ? '' : '<button class="ko-menu-item" onclick="koCloseSheet();koImportFromBeta2Cloud()">お試し版（β2）から引き継ぐ<span class="ko-mi-sub">クラウド経由</span></button>'}
    <button class="ko-menu-item" onclick="openKoHelp()">使い方</button>
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="koCloseSheet()">閉じる</button></div>`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
}
function openKoHelp(){
  document.getElementById('ko-sheet-body').innerHTML = `
    <div class="ko-title">使い方</div>
    <div class="ko-help">
      <p><b>単語をタップ</b>すると、意味をメモできます。保存した単語は、<b>どの本でも</b>上に小さく意味が出ます。</p>
      <p>「사람<b>들이</b>」のように後ろに助詞などが付いていても、候補から「사람」を選べば、ほかの形（사람은・사람을…）にも付きます。</p>
      <p>単語帳には<b>辞書の形</b>（먹다・고맙다）で入ります。本文では、変わらない部分（먹・고맙）で探して意味を付けるので、먹고・먹었다 などにも付きます。探す形は「本文で探す形」を開くと変えられます。</p>
      <p>「本文に意味を出す」をオフにすると、本文には何も出さず、<b>単語帳と復習だけ</b>に入ります。</p>
      <p>意味は<b>いくつでも</b>登録できます。登録済みの単語をタップして、●でその場所の意味を選ぶと、<b>その場所だけ</b>別の意味で表示されます（ほかの場所は「いつも」の意味のまま）。</p>
      <p><b>フレーズ</b>：単語の画面の「＋次の〜とつなげる」で、2語以上をひとまとまりで登録できます（例：고개를 끄덕 → うなずく）。</p>
      <p><b>よく出る未登録の単語</b>：今の話で、まだ登録していない単語を多い順に出します。上から登録すると早く読めるようになります。</p>
      <p><b>✎</b>は文のメモがある印です。文のメモは単語の画面の「文にメモ」から。</p>
      <p><b>自分の訳</b>は「書く」にすると、韓国語の段落の下に入力欄が出ます。書いた訳は「表示」で原文の下に出て、タップでなおせます。</p>
      <p><b>自分の訳で読む</b>にすると、訳した段落は訳だけで表示されます（段落の位置は原文と同じ）。まだ訳していない段落はうすい原文で出ます。</p>
      <p>意味を「隠す」にすると、点線の単語だけになります。読みながら思い出すテストに。</p>
      <p><b>復習</b>：答えたあと「もう一回／難しい／普通／簡単」を選ぶと、覚えている単語ほど次に出るまでの間隔が伸びます（1日→3日→1週間→…）。毎日「今日の復習」をやるだけでOK。「한」ボタンの数字が今日の残りです。</p>
      <p>次の復習が3週間以上先になった単語は「覚えた」になり、本文では意味が出なくなります（設定で変えられます）。</p>
      <p><b>意味ごとの説明</b>：辞書の候補を選ぶと、意味ごとの日本語の説明が出ます。タップでその意味を足せます。</p>
      <p><b>文法帳</b>：単語の画面の「形」の説明の☆を押すと、語尾や言い回しが文法帳に入ります。同じ文法にまた出会うと例文が増えます。</p>
      <p><b>人名かも？</b>：辞書にない語は「人名なら」ボタンでカタカナの読みを入れられます。「よく出る未登録の単語」にも、何回も出る名前っぽい語が出ます。</p>
      <p><b>訳をチェック</b>：自分の訳をタップして「訳をチェック（AI）」を押すと、AIが訳を見てくれます。自分のGemini APIキーが必要です（キーはこの端末だけに保存）。</p>
      <p>Googleドライブにログインしていると、単語帳・文法帳と学習の記録はほかの端末と自動で同期します。</p>
      <p>辞書の候補は「한국어기초사전」（韓国 国立国語院、CC BY-SA 2.0 KR）の日本語訳です。ウェブ小説の言い回しや固有名詞は載っていないことがあります。</p>
    </div>
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="openKoMenu()">戻る</button></div>`;
}

/* ── 単語帳 ── */
function openKoWordList(q){
  koCloseSheet();
  koMigrateHeads().then(ch => { if(ch) renderKoWordList(); }).catch(() => {});
  koSyncWords().then(ch => { if(ch) renderKoWordList(); }).catch(() => {});
  const ov = document.getElementById('ko-list');
  ov.classList.add('show');
  const input = document.getElementById('ko-list-q');
  if(typeof q === 'string') input.value = q;
  renderKoWordList();
}
function closeKoWordList(){ document.getElementById('ko-list').classList.remove('show'); }
function renderKoWordList(){
  const w = koLoad();
  const q = (document.getElementById('ko-list-q').value || '').trim();
  let keys = Object.keys(w).sort((a, b) => (w[b].at || '').localeCompare(w[a].at || ''));
  if(q) keys = keys.filter(k => k.includes(q) || koHead(k, w[k]).includes(q) || koMs(w[k]).some(x => x.m.includes(q)) || (w[k].n || '').includes(q));
  document.getElementById('ko-list-count').textContent = `${Object.keys(w).length}語`;
  const box = document.getElementById('ko-list-items');
  if(!keys.length){ box.innerHTML = `<div class="ko-empty">${Object.keys(w).length ? '見つかりません' : 'まだ単語がありません。<br>読書中に韓国語の単語をタップしてみてください'}</div>`; return; }
  box.innerHTML = keys.map(k => `
    <div class="ko-row" onclick="koEditFromList('${encodeURIComponent(k)}')">
      <div class="ko-row-main"><span class="ko-row-k">${escapeHtml(koHead(k, w[k]))}</span>${koShowsInText(w[k]) ? '' : '<span class="ko-row-off" title="本文には出さない">帳</span>'}<span class="ko-row-m">${escapeHtml(koMs(w[k]).map(x => x.m).join('・'))}</span>${koIsLearned(w[k]) ? '<span class="ko-learned-badge">覚えた</span>' : ''}<span class="ko-row-due">${koIsNewCard(w[k]) ? '新' : (w[k].due <= koDay() ? '今日' : w[k].due.slice(5).replace('-', '/'))}</span></div>
      ${w[k].n ? `<div class="ko-row-n">${escapeHtml(w[k].n)}</div>` : ''}
    </div>`).join('');
}
function koEditFromList(enc){
  const k = decodeURIComponent(enc);
  koOpenSheet({ type: 'word', key: k, eojeol: k, sentence: '', pi: -1, qi: -1 });
}
function koExportWords(){
  const data = { app: 'ikasumi-ko-words', version: 1, words: koLoad(), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ikasumi-ko-words-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function koImportWords(input){
  const f = input.files && input.files[0];
  input.value = '';
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      const src = d && d.words && typeof d.words === 'object' ? d.words : null;
      if(!src) throw new Error('bad');
      koLoad();
      let add = 0, upd = 0;
      Object.entries(src).forEach(([k, v]) => {
        if(!k || !v || typeof v.m !== 'string' || !KO_HANGUL.test(k)) return;
        if(_koWords[k]) upd++; else add++;
        _koWords[k] = Object.assign({}, v, { m: v.m, n: v.n || '', at: v.at || new Date().toISOString(), u: new Date().toISOString() });
        koUndelete(k);
      });
      koSaveWords(); renderKoWordList(); koRerender();
      showToast(`追加${add}語・上書き${upd}語`);
    }catch(_){ showToast('単語帳のファイルではありません'); }
  };
  r.readAsText(f);
}

/* ── 復習（Ankiのような間隔反復） ──
   答えるたびに次に出す日を決める。覚えているほど間隔が伸びる（1日→3日→1週間→…）。
   その日に出す単語（期限が来た単語）＋ 新しい単語を1日○語まで。 */
const KO_NEW_PER_DAY_LS = LS_PREFIX + 'ko-new-per-day';
function koNewPerDay(){ return parseInt(localStorage.getItem(KO_NEW_PER_DAY_LS) || '10', 10); }
function koSetNewPerDay(n){ try{ localStorage.setItem(KO_NEW_PER_DAY_LS, String(n)); }catch(_){} }
function koAddDays(day, n){ const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return koDay(d); }
function koIsNewCard(e){ return !e.reps && !e.due; }
function koNewToday(){ const r = (koStatsByDay()[koDay()] || {}); return r.n || 0; }
function koDueKeys(){
  const w = koLoad(), today = koDay();
  return Object.keys(w).filter(k => !koIsNewCard(w[k]) && w[k].due <= today).sort((a, b) => w[a].due.localeCompare(w[b].due));
}
function koNewKeys(){
  const w = koLoad();
  return Object.keys(w).filter(k => koIsNewCard(w[k])).sort((a, b) => (w[a].at || '').localeCompare(w[b].at || ''));
}
function koReviewCounts(){
  const due = koDueKeys().length;
  const newLeft = Math.max(0, Math.min(koNewKeys().length, koNewPerDay() - koNewToday()));
  return { due, newLeft, total: due + newLeft };
}
// 4つのボタンそれぞれで、次の間隔（日）を計算
function koSchedule(e, grade){ // grade: 1もう一回 2難しい 3普通 4簡単
  const ease = e.ease || 2.5, ivl = e.ivl || 0;
  let nIvl, nEase = ease;
  if(!e.reps){ // はじめて
    nIvl = { 1: 0, 2: 1, 3: 1, 4: 4 }[grade];
  }else if(grade === 1){
    nIvl = 0; nEase = Math.max(1.3, ease - 0.2);
  }else if(grade === 2){
    nIvl = Math.max(ivl + 1, Math.round(ivl * 1.2)); nEase = Math.max(1.3, ease - 0.15);
  }else if(grade === 3){
    nIvl = Math.max(ivl + 1, Math.round(ivl * ease));
  }else{
    nIvl = Math.max(ivl + 2, Math.round(ivl * ease * 1.3)); nEase = ease + 0.15;
  }
  return { ivl: nIvl, ease: Math.round(nEase * 100) / 100 };
}
function koIvlLabel(d){
  if(d <= 0) return 'すぐ';
  if(d < 30) return d + '日';
  if(d < 365) return Math.round(d / 30) + 'か月';
  return (Math.round(d / 36.5) / 10) + '年';
}
const KO_DIR_LS = LS_PREFIX + 'ko-card-dir';
function koCardDir(){ return localStorage.getItem(KO_DIR_LS) || 'ko'; } // ko 韓→日 / ja 日→韓 / mix 両方
function koSetCardDir(v){ try{ localStorage.setItem(KO_DIR_LS, v); }catch(_){} }
let _koQuiz = null;
function openKoQuiz(opts){
  opts = opts || {};
  if(!opts._m && Object.values(koLoad()).some(e => !e.h)){
    const o = Object.assign({}, opts, { _m: 1 });
    koMigrateHeads().catch(() => {}).then(() => openKoQuiz(o));
    return;
  }
  const w = koLoad();
  if(!Object.keys(w).length){ showToast('まだ単語がありません'); return; }
  let keys;
  if(opts.keys){
    keys = opts.keys.filter(k => w[k]).sort(() => Math.random() - 0.5).slice(0, 30);   // 苦手な単語・この話の単語（間隔は変えない練習）
    opts.all = true;
  }else if(opts.all){
    // 期限に関係なく、全部から（間隔は変えない練習）
    keys = Object.keys(w).sort(() => Math.random() - 0.5).slice(0, 20);
  }else{
    const due = koDueKeys();
    const newK = koNewKeys().slice(0, Math.max(0, koNewPerDay() - koNewToday()));
    keys = due.concat(newK);
    // 新しい単語は復習の間にちらばせる
    if(newK.length && due.length){
      keys = due.slice();
      newK.forEach((k, i) => keys.splice(Math.min(keys.length, Math.round((i + 1) * due.length / (newK.length + 1)) + i), 0, k));
    }
  }
  koCloseSheet(); closeKoWordList();
  if(!keys.length){ koQuizDone({ none: true }); return; }
  _koQuiz = { keys, i: 0, done: 0, again: 0, practice: !!opts.all, dirs: {} };
  koQuizShow(false);
}
function koQuizDone(o){
  const body = document.getElementById('ko-sheet-body');
  const w = koLoad(), today = koDay();
  const tomorrow = Object.values(w).filter(e => !koIsNewCard(e) && e.due <= koAddDays(today, 1)).length;
  body.innerHTML = `<div class="ko-title">${o && o.none ? '今日の復習はありません' : 'おつかれさま！'}</div>
    <div class="ko-quiz-res">${o && o.none ? '新しい単語を登録するか、明日また来てね' : `${_koQuiz.done}枚 復習しました`}</div>
    <div class="ko-quiz-sub">明日の復習：${tomorrow}枚</div>
    <div class="ko-actions"><button class="ko-cancel" onclick="openKoQuiz({all:true})" style="background:none;color:#007070;padding-left:0">期限に関係なく練習</button><button class="ko-save" onclick="koCloseSheet()">閉じる</button></div>`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
  koUpdateBadge();
}
function koQuizShow(reveal){
  const q = _koQuiz, w = koLoad();
  if(q.i >= q.keys.length){ koQuizDone(); return; }
  const k = q.keys[q.i], e = w[k];
  if(!e){ q.i++; koQuizShow(false); return; }
  const cd = koCardDir();
  q.dirs = q.dirs || {};
  if(q.dirs[q.i] == null) q.dirs[q.i] = cd === 'mix' ? (Math.random() < 0.5 ? 'ko' : 'ja') : cd;
  const dir = q.dirs[q.i];
  const body = document.getElementById('ko-sheet-body');
  const left = q.keys.length - q.i;
  const tag = q.practice ? '練習' : (koIsNewCard(e) ? '<span class="ko-tag new">新しい単語</span>' : '<span class="ko-tag">復習</span>');
  const btns = [1, 2, 3, 4].map(g => {
    const iv = q.practice ? null : koSchedule(e, g).ivl;
    const name = { 1: 'もう一回', 2: '難しい', 3: '普通', 4: '簡単' }[g];
    return `<button class="ko-grade g${g}" onclick="koQuizAnswer(${g})"><span>${name}</span>${iv == null ? '' : `<small>${koIvlLabel(iv)}</small>`}</button>`;
  }).join('');
  body.innerHTML = `
    <div class="ko-quiz-top"><span>${tag}</span><span>のこり ${left}</span></div>
    ${dir === 'ja'
      ? `<div class="ko-quiz-k ja">${koMs(e).map(x => escapeHtml(x.m)).join('<span class="ko-dict-sep">／</span>')}</div>
         <div class="ko-quiz-m">${reveal ? `<div class="ko-quiz-ans" onclick="koSpeak('${koHead(k, e).replace(/'/g, '')}')">${escapeHtml(koHead(k, e))}</div>` + koQuizBack(k, e, true) : '<span class="ko-quiz-hint">韓国語で言うと？</span>'}</div>`
      : `<div class="ko-quiz-k" onclick="koSpeak('${koHead(k, e).replace(/'/g, '')}')">${escapeHtml(koHead(k, e))}</div>
         <div class="ko-quiz-m">${reveal ? koQuizBack(k, e) : ''}</div>`}
    ${reveal
      ? `<div class="ko-grades">${btns}</div>`
      : `<div class="ko-actions"><button class="ko-cancel" onclick="koCloseSheet();koUpdateBadge()">やめる</button><button class="ko-save" onclick="koQuizShow(true)">答えを見る</button></div>`}`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
  if(dir === 'ko' ? !reveal : reveal) koSpeak(koHead(k, e), true);
  // 登録したときの文がない単語は、本の中から1つ探して出す
  if(reveal && document.getElementById('ko-quiz-use')){
    const qi = q.i;
    koUsesSearch(k, 1).then(r => {
      const el = document.getElementById('ko-quiz-use');
      if(!el || _koQuiz !== q || q.i !== qi || !r.list.length) return;
      const u = r.list[0];
      el.innerHTML = koUseHi(u.s, u.forms) + `<small>${escapeHtml(u.where)}</small>`;
      el.onclick = () => koSpeak(u.s);
      el.hidden = false;
    }).catch(() => {});
  }
}
function koQuizAnswer(grade){
  const q = _koQuiz, w = koLoad(), k = q.keys[q.i];
  const e = w[k];
  if(e){
    const wasLearned = koIsLearned(e), wasFaded = koFaded(e);
    if(!q.practice){
      const wasNew = koIsNewCard(e);
      const sc = koSchedule(e, grade);
      e.ivl = sc.ivl; e.ease = sc.ease;
      e.reps = (e.reps || 0) + 1;
      if(grade === 1 && !wasNew) e.lapses = (e.lapses || 0) + 1;
      e.due = koAddDays(koDay(), sc.ivl);
      if(grade >= 3) e.ok = (e.ok || 0) + 1; else if(grade === 1) e.ng = (e.ng || 0) + 1;
      if(wasNew) koStat('n');
    }
    e.u = new Date().toISOString();
    koSaveWords();
    koStat('r');
    if(wasLearned !== koIsLearned(e) || wasFaded !== koFaded(e)) koRerender();
  }
  q.done++;
  // 「もう一回」は少しあとにもう一度出す
  if(grade === 1) q.keys.splice(Math.min(q.keys.length, q.i + 4), 0, k);
  q.i++;
  koQuizShow(false);
}
// 「한」ボタンに今日の復習の数
function koUpdateBadge(){
  try{ koUpdateLibReview(); }catch(_){}
  const btn = document.getElementById('topbar-ko');
  if(!btn) return;
  const n = koReviewCounts().total;
  let b = btn.querySelector('.ko-badge');
  if(!n){ if(b) b.remove(); return; }
  if(!b){ b = document.createElement('span'); b.className = 'ko-badge'; btn.appendChild(b); }
  b.textContent = n > 99 ? '99+' : n;
}

/* ══════ 辞書（한국어기초사전・国立国語院 CC BY-SA 2.0 KR）══════ */
const KO_DICT_URL = 'krdict-ja.json';
const KO_DICT_VER = 'v1';
let _koDict = null, _koDictLoading = null;
function koDictIdb(){
  return new Promise((res, rej) => {
    const r = indexedDB.open(LS_PREFIX + 'krdict', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('d');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function koDictLoad(){
  if(_koDict) return _koDict;
  if(_koDictLoading) return _koDictLoading;
  _koDictLoading = (async () => {
    let txt = null;
    try{
      const db = await koDictIdb();
      txt = await new Promise(res => { const q = db.transaction('d').objectStore('d').get(KO_DICT_VER); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
    }catch(_){}
    if(!txt){
      let r = await fetch(KO_DICT_URL).catch(() => null);
      if(!r || !r.ok) r = await fetch(KO_DATA_ALT + KO_DICT_URL).catch(() => null);
      if(!r || !r.ok) throw new Error('dict ' + (r ? r.status : 'network'));
      txt = await r.text();
      try{ const db = await koDictIdb(); db.transaction('d', 'readwrite').objectStore('d').put(txt, KO_DICT_VER); }catch(_){}
    }
    _koDict = JSON.parse(txt).d;
    koAddExtraDict(_koDict);
    // 辞書が読めたら、本文の意味をもう一度付け直す（登録した 세＝三 を 세게 に付けない など、辞書で確かめる分）
    try{ if(_koMaxLen > 0) setTimeout(() => { try{ koRerender(); }catch(_){} }, 0); }catch(_){}
    return _koDict;
  })();
  try{ return await _koDictLoading; } finally { _koDictLoading = null; }
}
// 基礎辞書に無いけれど、小説によく出る語（外来語・新しい言葉など）
const KO_EXTRA_DICT = {
  '간신히': ['副', 'かろうじて・やっと'], '팝업': ['名', 'ポップアップ'], '스토어': ['名', 'ストア・店'], '팝업스토어': ['名', 'ポップアップストア'],
  '굿즈': ['名', 'グッズ'], '룰렛': ['名', 'ルーレット'], '위키': ['名', 'ウィキ'], '웹소설': ['名', 'ウェブ小説'], '웹툰': ['名', 'ウェブトゥーン'],
  '스마트폰': ['名', 'スマホ・スマートフォン'], '에필로그': ['名', 'エピローグ'], '프롤로그': ['名', 'プロローグ'], '판타지': ['名', 'ファンタジー'],
  '스크롤': ['名', 'スクロール'], '퀄리티': ['名', 'クオリティ'], '블루투스': ['名', 'ブルートゥース'], '멘트': ['名', 'コメント・セリフ'],
  '도파민': ['名', 'ドーパミン'], '클리셰': ['名', 'お約束・クリシェ'], '오컬트': ['名', 'オカルト'], '퍼포먼스': ['名', 'パフォーマンス'],
  '에코백': ['名', 'エコバッグ'], '오픈': ['名', 'オープン'], '아이템': ['名', 'アイテム'], '빙의': ['名', '憑依'], '먼치킨': ['名', 'チート主人公・最強キャラ'],
  '관종': ['名', 'かまってちゃん・目立ちたがり'], '꿀잼': ['名', 'めっちゃ面白い'], '노잼': ['名', 'つまらない'], '현타': ['名', '虚無感・我に返ること'],
  '썸녀': ['名', 'いい感じの女性（付き合う前）'], '썸남': ['名', 'いい感じの男性（付き合う前）'], '쫄보': ['名', 'ビビり・臆病者'],
  '신입사원': ['名', '新入社員'], '사원증': ['名', '社員証'], '대기표': ['名', '整理券・順番待ちの札'], '조회수': ['名', '閲覧数・再生数'],
  '댓글창': ['名', 'コメント欄'], '추천글': ['名', 'おすすめ投稿'], '게시글': ['名', '投稿・書き込み'], '알고리즘': ['名', 'アルゴリズム'],
  '서바이벌': ['名', 'サバイバル'], '방탈출': ['名', '脱出ゲーム'], '피규어': ['名', 'フィギュア'], '슬로건': ['名', 'スローガン'], '뱃지': ['名', 'バッジ'],
  '캐리커처': ['名', '似顔絵・カリカチュア'], '컨셉': ['名', 'コンセプト'], '리얼': ['名', 'リアル'], '럭키': ['名', 'ラッキー'], '심볼': ['名', 'シンボル'],
  '스크린도어': ['名', 'ホームドア'], '빔프로젝터': ['名', 'プロジェクター'], '오리엔테이션': ['名', 'オリエンテーション'], '테마파크': ['名', 'テーマパーク'],
  '감독판': ['名', 'ディレクターズカット'], '미리보기': ['名', '先読み・プレビュー'], '아트북': ['名', 'アートブック'], '데스': ['名', 'デス'],
  '네임드': ['名', '有名人・ネームド'], '세계관': ['名', '世界観'], '집단지성': ['名', '集合知'], '오픈소스': ['名', 'オープンソース'],
  '되팔이': ['名', '転売・転売屋'], '엥': ['感', 'えっ・ん？'], '우와': ['感', 'うわぁ'], '침음하다': ['動', '考え込む・うなる（沈吟する）'], '핫하다': ['形', '話題だ・ホットだ'],
  '괴현상': ['名', '怪現象'], '중통령': ['名', '中学生の大統領（中学生に大人気の人）'], '또래': ['名', '同年代・同じ年頃'], '대놓고': ['副', '露骨に・あからさまに'],
  '오르골': ['名', 'オルゴール'], '달칵': ['副', 'カチッ・ガチャッ'], '주워들다': ['動', '拾い上げる'], '축하드리다': ['動', 'お祝い申し上げる'], '부탁드리다': ['動', 'お願いいたします'],
  '개부럽다': ['形', 'めっちゃ羨ましい（俗）'], '포털': ['名', 'ポータル'], '받아들다': ['動', '受け取る・手に取る'], '항마력': ['名', '（恥ずかしさへの）耐性'], '입꼬리': ['名', '口角'],
  '자랑스러워하다': ['動', '誇らしく思う'], '공교롭다': ['形', 'あいにくだ・折悪しく'], '옆자리': ['名', '隣の席'], '룸': ['名', 'ルーム・部屋'], '전방위': ['名', '全方位'],
  '팀명': ['名', 'チーム名'], '연달아': ['副', '相次いで・立て続けに'], '이딴': ['冠', 'こんな（くだらない）'], '걸러내다': ['動', 'ふるい落とす・選り分ける'], '앞칸': ['名', '前の車両'],
  '역명': ['名', '駅名'], '어구': ['名', '語句'], '핏물': ['名', '血・血の混じった水'], '덩그러니': ['副', 'ぽつんと'], '기연': ['名', '奇縁（思わぬ幸運）'], '전지적': ['冠', '全知的な'],
  '계약직': ['名', '契約社員'], '안티': ['名', 'アンチ'], '알림': ['名', '通知・お知らせ'], '어딨다': ['動', 'どこにある・どこにいる（＝어디 있다）'], '들어보다': ['動', '聞いてみる'],
  '돌아나가다': ['動', '引き返して出ていく'], '끝나가다': ['動', '終わりかける'], '그러다': ['動', 'そうする', 3], '저러다': ['動', 'ああする', 3], '탈모약': ['名', '育毛剤・脱毛症の薬'],
  '영업직': ['名', '営業職'], '휴식기': ['名', '休止期間'], '다음편': ['名', '次の話'], '댓글수': ['名', 'コメント数'], '정보값': ['名', '情報の価値'], '제작품': ['名', '製作品'],
  '야야': ['感', 'おいおい'],
  '전독시': ['名', '全知的な読者の視点（略）'], '멸살법': ['名', '滅亡した世界で生き残る三つの方法（略）'], '세계선': ['名', '世界線'], '개연성': ['名', '蓋然性（物語の筋が通ること）'],
  '백스페이스': ['名', 'バックスペース'], '스파크': ['名', 'スパーク'], '콜라보': ['名', 'コラボ'], '브레이커': ['名', 'ブレイカー'], '메소드': ['名', 'メソッド'], '마스터': ['名', 'マスター'],
  '베스트': ['名', 'ベスト'], '커뮤니티': ['名', 'コミュニティ'], '알람': ['名', 'アラーム・通知'], '닉네임': ['名', 'ニックネーム'], '스포일러': ['名', 'ネタバレ'], '로딩': ['名', 'ローディング・読み込み'],
  '감자칩': ['名', 'ポテトチップス'], '편집자': ['名', '編集者'], '순문학': ['名', '純文学'], '단말': ['名', '端末'], '작가물': ['名', '作家もの（作家が主人公の話）'], '이세계': ['名', '異世界'],
  '삼일': ['名', '三日'], '취준생': ['名', '就活生'], '정주행': ['名', '一気読み・最初から通して見ること'], '우하하': ['感', 'うはは（笑）'], '옳다구나': ['感', 'しめた・これ幸いと'],
  '보나마나': ['副', '見るまでもなく・どうせ'], '그럼에도': ['副', 'それにもかかわらず・それでも'], '잔뼈': ['名', '細い骨（잔뼈가 굵다＝その道で長年鍛えられた）'], '사레': ['名', 'むせること（사레가 들리다＝むせる）'],
  '썰': ['名', '話・エピソード（俗）'], '들려주다': ['動', '聞かせる'], '들려드리다': ['動', 'お聞かせする'], '듣도': ['動', '聞きも（듣도 보도 못하다＝聞いたことも見たこともない）'],
  '인데': ['語尾', '〜なんだけど（＝이다＋ㄴ데）'], '짠': ['副', 'ジャーン（登場の音）'],
  'ㅋㅋ': ['感', '（笑）'], 'ㅎㅎ': ['感', '（笑）・ふふ'], 'ㅠㅠ': ['感', '（泣）'], 'ㅜㅜ': ['感', '（泣）'], 'ㄹㅇ': ['副', 'マジで（레알）'], 'ㅇㅇ': ['感', 'うん'],
  'ㄴㄴ': ['感', 'いやいや・ノーノー'], 'ㅇㅋ': ['感', 'OK'], 'ㄱㄱ': ['感', '行こう・GOGO'], 'ㅈㅅ': ['感', 'ごめん（죄송）'], 'ㄷㄷ': ['感', 'ガクブル・すげえ'], 'ㅊㅋ': ['感', 'おめでとう（축하）'],
  'ㅂㅂ': ['感', 'バイバイ'], 'ㄳ': ['感', 'ありがとう（감사）'], 'ㅅㅂ': ['感', 'クソっ（罵り言葉）'], 'ㅁㅊ': ['感', 'ヤバい・狂ってる（미친）'],
  '존나': ['副', 'めちゃくちゃ（俗・下品）'], '졸라': ['副', 'めちゃくちゃ（俗）'], '겁나': ['副', 'めっちゃ'], '개': ['接', 'めっちゃ〜（俗・接頭）'], '핵': ['接', '超〜（俗・接頭）'],
  '헐': ['感', 'えっ・まじか'], '레알': ['副', 'マジで・本当に'], '실화냐': ['感', 'マジか（＝実話か）'], '대박': ['名', 'すごい・ヤバい・大当たり'], '쩐다': ['形', 'すごい・ヤバい（俗）'], '쩔다': ['形', 'すごい・ヤバい（俗）'],
  '개꿀': ['名', 'めっちゃ得・最高（俗）'], '존잼': ['名', 'めっちゃ面白い（俗）'], '핵잼': ['名', '超面白い（俗）'], '인정': ['名', '認める・それな'], '갑분싸': ['名', '急に場がしらける'],
  '존버': ['名', '耐え抜く・粘る（俗）'], '멘붕': ['名', 'パニック・頭が真っ白'], '극혐': ['名', '大嫌い・ドン引き'], '사이다': ['名', 'スカッとする展開・サイダー'], '고구마': ['名', 'もどかしい展開（イライラ）・さつまいも'],
  '뇌절': ['名', 'しつこすぎ・やりすぎ（俗）'], '킹받다': ['形', 'めっちゃムカつく（俗）'], '어그로': ['名', '煽り・注目集め'], '국룰': ['名', 'お約束・定番'], '찐': ['冠', 'ガチの・本物の'],
  '찐따': ['名', '陰キャ・冴えない人（俗）'], '인싸': ['名', '陽キャ・人気者'], '아싸': ['名', 'ぼっち・陰キャ'], '플렉스': ['名', '見せびらかし・散財'], '갓': ['接', '神〜（俗・接頭）'],
  '띵작': ['名', '名作（＝명작）'], '사바사': ['名', '人による（사람 by 사람）'], '케바케': ['名', 'ケースバイケース'], '뭥미': ['感', 'なにそれ'], '어쩔티비': ['感', 'だから何（俗）'],
  '넘사벽': ['名', '越えられない壁'], '만렙': ['名', 'レベルMAX・極めた人'], '고인물': ['名', '古参・ベテラン（俗）'], '뉴비': ['名', '新人・初心者'], '사기캐': ['名', 'チートキャラ'],
  '버프': ['名', 'バフ'], '너프': ['名', 'ナーフ・弱体化'], '회귀': ['名', '回帰（人生やり直し）'], '각성': ['名', '覚醒'], '성좌': ['名', '星座（神々のような存在）'], '헌터': ['名', 'ハンター'],
  '던전': ['名', 'ダンジョン'], '게이트': ['名', 'ゲート'], '스탯': ['名', 'ステータス'], '레벨업': ['名', 'レベルアップ'], '갓겜': ['名', '神ゲー'], '망겜': ['名', 'クソゲー'], '현질': ['名', '課金'],
  '빡치다': ['動', 'ムカつく・キレる（俗）'], '빡세다': ['形', 'きつい・ハードだ（俗）'], '쪽팔리다': ['形', '恥ずかしい（俗）'], '꼰대': ['名', '説教おやじ・老害'], '짱': ['名', '最高・一番'], '본편': ['名', '本編'], '외전': ['名', '外伝・番外編'], '연재': ['名', '連載'], '휴재': ['名', '休載'], '드세요': ['動', '（気に）入りますか・召し上がってください（＝들다／드시다）'], '저기요': ['感', 'すみません（呼びかけ）'], '어서오세요': ['感', 'いらっしゃいませ'], '안녕하세요': ['感', 'こんにちは'], '입니다': ['語尾', '〜です'],
  '이었다': ['語尾', '〜だった'], '였다': ['語尾', '〜だった'], '졌다': ['語尾', '〜になった（＝어지다）'], '아니라': ['形', '〜ではなく（아니다）'],
  '달라고': ['補動', '〜してくれと（＝달다）'], '달라는': ['補動', '〜してくれという（＝달다）'], '달라며': ['補動', '〜してくれと言いながら（＝달다）']
};
function koAddExtraDict(d){
  const POS_FIX = { '그렇게': '副', '이렇게': '副', '저렇게': '副', '누가': '代', '그래도': '副', '그래서': '副', '그것도': '副', '어떻게': '副' };
  Object.entries(POS_FIX).forEach(([k, p]) => { (d[k] || []).forEach(e => { if(!e[0]) e[0] = p; }); });
  if(d['크다']) d['크다'].sort((a, b) => (a[0] === '形' ? 0 : 1) - (b[0] === '形' ? 0 : 1));       // 크다＝大きい（育つ より先）
  ['밝다', '유리하다'].forEach(k => { if(d[k]) d[k].sort((a, b) => (a[0] === '形' ? 0 : 1) - (b[0] === '形' ? 0 : 1)); });
  if(d['맨']) d['맨'].sort((a, b) => (a[0] === '冠' ? 0 : 1) - (b[0] === '冠' ? 0 : 1));
  [['낡다', '形'], ['성의껏', '副'], ['그러니', '副'], ['그러자', '副']].forEach(([k, p]) => (d[k] || []).forEach(e => { if(e[0] !== p && (!e[0] || e[0] === '動' || e[0] === '名')) e[0] = p; }));
  [['안', '〜しない（否定）'], ['못', '〜できない']].forEach(([k, ja]) => { if(d[k] && !d[k].some(e => e[0] === '副')) d[k].push(['副', [ja], '', 1]); });
  ['등가', '이쯤', '그쯤', '저쯤', '요쯤'].forEach(k => (d[k] || []).forEach(e => { if(!e[3]) e[3] = 1; }));
  Object.entries(KO_EXTRA_DICT).forEach(([k, [pos, ja, lv]]) => { if(!d[k]) d[k] = [[pos, [ja], '', lv == null ? 1 : lv]]; }); // 選んで足した語なので、よく使う語として扱う
  try{ koAddVariantWords(d); }catch(e){ console.warn('ko variants', e); }
}
// 〜뜨리다＝〜트리다、〜거리다＝〜대다（どちらも正しい言い方で、意味も同じ）。빨갛다 → 빨개지다（赤くなる）
function koAddVariantWords(d){
  const keys = Object.keys(d);
  keys.forEach(k => {
    if(/\s/.test(k) || k.length < 4) return;
    let alt = null;
    if(/뜨리다$/.test(k)) alt = k.slice(0, -3) + '트리다';
    else if(/트리다$/.test(k)) alt = k.slice(0, -3) + '뜨리다';
    else if(/거리다$/.test(k)) alt = k.slice(0, -3) + '대다';
    if(alt && !d[alt]) d[alt] = d[k].filter(e => /^(動|形)$/.test(e[0])).map(e => { const x = e.slice(); x.alt = k; return x; });
    if(alt && d[alt] && !d[alt].length) delete d[alt];
  });
  // ㅎで終わる色・様子の形容詞（빨갛다・시뻘겋다・하얗다）＋어지다
  const VMAP = { 0: 1, 4: 5, 2: 3, 6: 7 };   // ㅏ→ㅐ、ㅓ→ㅔ、ㅑ→ㅒ、ㅕ→ㅖ
  keys.forEach(k => {
    if(!/다$/.test(k) || k.length < 3 || /^(그렇|이렇|저렇|어떻|아무렇|요렇|고렇|조렇)다$/.test(k)) return;
    const st = k.slice(0, -1), last = koDec(st.slice(-1));
    if(!last || last.T !== 27 || VMAP[last.V] == null) return;
    const es = (d[k] || []).filter(e => e[0] === '形');
    if(!es.length) return;
    const nk = st.slice(0, -1) + koCmp(last.L, VMAP[last.V], 0) + '지다';
    if(d[nk]) return;
    const ja = es.map(e => e[1].map(j => { const m = koJaShort(j).split('・')[0]; return /い$/.test(m) ? m.slice(0, -1) + 'くなる' : /だ$/.test(m) ? m.slice(0, -1) + 'になる' : ''; }).filter(Boolean)).flat();
    if(ja.length) d[nk] = [['動', [...new Set(ja)].slice(0, 3), '', 0]];
  });
}
// 「たべる【食べる】。くう【食う・喰う】」→「食べる・食う」
const KO_KANA_PREF = new Set(['此の辺','其の辺','彼の辺','此れ位','其れ位','彼れ位','是位','此の程度','居る','有る','為る','為す','遣る','成す','呉れる','貰う','可笑しい','面白おかしい','一寸','矢張り','矢っ張り','何時','彼処','此の様に','若し','若しかしたら','御陰','幾ら','直ぐ','沢山','未だ','又','有難い','恐い','陸に','可成り','大分','随分','中中','良く','度度','纏める','揃える','止む','掛かる','掛ける','出来る','出来ない','遣られる','此れ','其れ','何故','何で','労しい','嘸','流石','殆ど','徐徐に','丁度','兎に角','一杯食う','取沙汰する','透き','序でに','頗る','矢鱈','屹度','態と','暫く','只今','只','唯']);
function koJaShort(s){
  return String(s || '').split('。').map(p => {
    p = p.trim();
    const m = p.match(/【([^】]+)】/);
    if(!m) return p;
    const kj = m[1].split('・')[0];
    return KO_KANA_PREF.has(kj) ? (p.slice(0, p.indexOf('【')).split('・')[0] || kj) : kj;
  }).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join('・');
}
/* ハングルの分解・組み立て */
function koDec(ch){
  const c = ch.charCodeAt(0) - 0xAC00;
  if(c < 0 || c > 11171) return null;
  return { L: Math.floor(c / 588), V: Math.floor((c % 588) / 28), T: c % 28 };
}
function koCmp(L, V, T){ return String.fromCharCode(0xAC00 + L * 588 + V * 28 + T); }
// 活用した形から、辞書の見出し（〜다）の候補を作る → [{c: 見出し候補, n: 本文で使った文字数}]
function koLemmaCandsN(w){
  const out = [], seen = new Set();
  const add = (x, n) => { if(x && !seen.has(x)){ seen.add(x); out.push({ c: x, n }); } };
  for(let n = w.length; n >= 1; n--){
    const p = w.slice(0, n);
    add(p, n); add(p + '다', n);
    const base = p.slice(0, -1), d = koDec(p[n - 1]);
    if(!d) continue;
    const forms = [p];
    if([4, 8, 16, 17, 20].includes(d.T)) forms.push(base + koCmp(d.L, d.V, 0)); // 받침を外す（갔→가 한→하 할→하 합→하）
    if(d.T === 4 && d.L === 5 && d.V === 4) add(base + koCmp(5, 4, 17) + '다', n);     // 스런→스럽다（스러운 の縮まった形）
    if(base && d.L === 9 && (d.V === 5 || d.V === 6) && (!d.T || d.T === 20)) add(base + '시다', n); // 계세요・계셨다 → 계시다
    if(d.T === 8) forms.push(base + koCmp(d.L, d.V, 7));                         // ㄷ不規則（들→듣）
    if((d.V === 4 || d.V === 0) && ([4, 8, 16].includes(d.T) || (!d.T && /^[면니나]/.test(w[n] || '')))) add(base + koCmp(d.L, d.V, 27) + '다', n); // ㅎ不規則（그럴→그렇다）
    if(d.T === 8 && w[n]){                                                        // 르不規則（몰라・몰랐 → 모르다、빨라 → 빠르다）
      const nd = koDec(w[n]);
      if(nd && nd.L === 5 && (nd.V === 0 || nd.V === 4) && (!nd.T || nd.T === 20)) add(base + koCmp(d.L, d.V, 0) + '르다', n + 1);
    }
    // ㄹ脱落（사는・산・삽니다・사세요 → 살다）
    const nxs = w[n] || '';
    if([4, 17].includes(d.T) || (!d.T && /^[는니네세시]/.test(nxs))) add(base + koCmp(d.L, d.V, 8) + '다', n);
    forms.forEach(f => {
      const fb = f.slice(0, -1), fd = koDec(f[f.length - 1]);
      add(f + '다', n);
      if(!fd || fd.T) return;
      const V2 = { 9: 8, 14: 13, 6: 20, 10: 11, 15: 16 }[fd.V];               // 와→오 워→우 여→이 왜→외 웨→위
      if(V2 != null) add(fb + koCmp(fd.L, V2, 0) + '다', n);
      if(fd.L === 18 && fd.V === 1) add(fb + koCmp(18, 0, 0) + '다', n);       // 해→하
      if(fd.V === 1 && fd.L !== 18 && fb){                                       // 그래・그랬 → 그러다／그렇다、빨개 → 빨갛다（ㅎ不規則）
        add(fb + koCmp(fd.L, 4, 0) + '다', n); add(fb + koCmp(fd.L, 4, 27) + '다', n); add(fb + koCmp(fd.L, 0, 27) + '다', n);
      }
      if(fd.V === 4 || fd.V === 0) add(fb + koCmp(fd.L, 18, 0) + '다', n);     // 써→쓰 예뻐→예쁘
      const nx = w[n] ? koDec(w[n]) : null;                                     // ㅅ不規則（지어→짓）：受け取った形のまま・次が母音のときだけ
      if(f === p && nx && nx.L === 11) add(fb + koCmp(fd.L, fd.V, 19) + '다', n);
      if(fd.L === 11 && (fd.V === 14 || fd.V === 13 || fd.V === 9) && fb){                   // ㅂ不規則（고마워・고마운→고맙）
        const pd = koDec(fb[fb.length - 1]);
        if(pd && !pd.T) add(fb.slice(0, -1) + koCmp(pd.L, pd.V, 17) + '다', n - 1);
      }
    });
  }
  return out;
}
function koLemmaCands(w){ return koLemmaCandsN(w).map(x => x.c); }
const KO_FUNC_POS = ['助', '語尾', '接'];
const KO_VERB_REST = ['어','으','아','여','었','았','였','고','는','은','을','게','지','다','며','면','서','니','기','음','자','도','요','세','시','습','겠','던','든','라','러','려','네','나','냐','죠','군','구','ㄴ','ㄹ','ㅂ','보','봐','봤','본','볼','주','줘','줬','준','줄','버','잖','셨','십','신','실','래','므','느','대','더','길','진','긴','졌','져','질','셔','둬','둔','뒀','놓','놨','든','려'];
const KO_COPULA = ['이다','이었다','였다','이야','야','이고','인','이라','이라고','이었','였','이지','이죠','이에요','예요','입니다'];
function koPartChain(r, depth){
  if(!r) return true;
  if(depth >= 3) return false;
  return KO_PARTICLES.some(a => r.startsWith(a) && (KO_PARTICLES.includes(r.slice(a.length)) || KO_COPULA.includes(r.slice(a.length)) || koPartChain(r.slice(a.length), depth + 1)));
}
function koRestFits(rest, verb){
  if(!rest) return true;
  if(verb) return KO_VERB_REST.some(e => rest.startsWith(e));
  const r = rest.replace(/^(님들|님|들)/, '');                     // 독자님께서・작가님께는
  return !r || KO_PARTICLES.includes(r) || KO_COPULA.includes(r) || KO_PARTICLES.some(a => r.startsWith(a) && (KO_PARTICLES.includes(r.slice(a.length)) || KO_COPULA.includes(r.slice(a.length)) || (a.length >= 2 && koCopV(a, r.slice(a.length))))) || (r.length >= 4 && koPartChain(r, 0));
}
const KO_LV_ORDER = { 1: 0, 2: 1, 3: 2, 0: 3 };
// 動詞の候補が本文の形に合うか：語尾まで説明できる=2、ざっくり合う=1、合わない=0
function koVerbFit(eojeol, head, loose){
  const stem = head.slice(0, -1);
  const literal = eojeol.startsWith(stem);
  const t = koNormTail(koVerbTail(eojeol, stem));
  const sp = t === '' ? { left: '' } : (t ? koSplitTail(t, KO_END_TABLE) : null);
  const full = !!sp && !sp.left;
  if(!literal){                              // 形が変わる候補（받침を外した・不規則）は語尾まで合うときだけ（合わなければ出さない：거란→거르다 など）
    if(!full) return -1;
    if(sp.parts && sp.parts.length > 1 && sp.parts[0].k === '어') return -1; // 가라고→가르다 のような無理な分け方
    if(sp.parts && sp.parts.length > 1 && sp.parts[0].k === 'ㄹ') return -1; // 끌어・끌고→끄다＋ㄹ のような無理な分け方
    return 1;
  }
  { const ld = koDec(stem[stem.length - 1]) || {};               // 語幹だけでは単語にならない（세→세다 より 세＝三）。ただし 들・만들（ㄹ）と 넘어서（2文字以上で母音）はOK
    if(eojeol === stem && !(ld.T === 8 || (!ld.T && [0, 1, 4, 5, 6].includes(ld.V) && stem.length >= 2))) return 0.5; }
  if(!full) return loose;
  // 母音で終わる語幹に、縮まない 어/었 が付く形（지었다→지다 より 짓다）は後回し
  const d = koDec(stem[stem.length - 1]), rest = eojeol.slice(stem.length);
  if(d && !d.T && [0, 4, 8, 13, 20, 1, 5].includes(d.V) && /^[어었아았여였]/.test(rest)) return 0.5;
  return Math.max(loose, 1);
}
// 辞書で引けた候補（本文に合う長いもの順・助詞などは単語そのものの時だけ）
// 前の語が「〜する／〜した（名詞の前）」の形か（할 수、한 채、할 줄 など）
function koIsAttr(prev){
  prev = String(prev || '');
  const pl = prev ? koDec(prev[prev.length - 1]) : null;
  if(!pl) return false;
  if(/[을를]$/.test(prev) && prev.length >= 2 && _koDict){
    // 이야기를・돈을（〜を）と、먹을・부를（〜する＋名詞の前）を分ける
    const l = koDictLookup(prev, '', '', 1);
    return !!l[0] && l[0].verb;
  }
  if(/길$/.test(prev) && _koDict){ const l = koDictLookup(prev, '', '', 1)[0]; if(l && l.verb){ const fi = koFormInfo(prev, l.head, (l.ents[0] || [])[0], ''); if(fi && fi.parts && fi.parts.length && fi.parts[fi.parts.length - 1].k === '길') return false; } }
  return pl.T === 4 || pl.T === 8 || /[는던]$/.test(prev);
}
// 名詞の前の形のあとに来たときは、文法の意味を先に出す語
const KO_AFTER_ATTR = { '수': 'すべ・こと（〜できる）', '채': '〜したまま', '줄': 'すべ・こと（〜できる・〜と思う）', '대로': '〜とおりに・〜まま', '셈': 'つもり・わけ',
  '척': 'ふり', '체': 'ふり', '뿐': 'だけ', '만큼': 'ほど', '듯이': 'ように', '때': '時', '법': '方法・〜するものだ', '바': 'こと・ところ', '끝': '〜した末（ㄴ 끝에）', '탓': 'せい', '덕분': 'おかげ', '김': 'ついで', '지': '〜してから（時間）',
  '적': 'こと（〜したことがある）', '리': 'はず（〜はずがない）', '만': '〜するだけの価値（ㄹ 만하다）', '이': '人・者', '거리': '種・材料（〜する거리）', '뻔': '〜するところだった（ㄹ 뻔하다）' };
// 前の形の条件：ㄹ（これから）のあとだけ／単語そのもの（이＝この と区別）のときは使わない
const KO_AFTER_FUT = new Set(['리', '만', '거리', '뻔']);
const KO_AFTER_NOEXACT = new Set(['이']);
function koAttrOk(head, eojeol, prev){
  if(!KO_AFTER_ATTR[head] || !koIsAttr(prev)) return false;
  if(eojeol === '바로') return false;                               // 바로＝すぐ（바＋로 ではない）
  if(KO_AFTER_NOEXACT.has(head) && eojeol === head) return false;
  if(KO_AFTER_FUT.has(head)){ const d = koDec(String(prev).slice(-1)); if(!d || d.T !== 8) return false; }
  if(head === '적' && /^(이런|그런|저런|어떤|다른|무슨|웬)$/.test(prev)) return false;
  return true;
}
function koAttrMean(head, eojeol, prev){ return koAttrOk(head, eojeol, prev) ? KO_AFTER_ATTR[head] : ''; }
// その語だけで出てきたときは、副詞の意味を先に出す
const KO_ADV_FIRST = new Set(['안', '못', '정말', '진짜', '조금', '다', '잘', '더', '좀', '꼭', '딱', '막']);
// 形容詞には付かない語尾（〜してくれる・〜してみる・〜する（書き言葉）・〜しよう など）
function koActTail(eojeol, head){
  if(!head.endsWith('다') || head.length < 2) return false;
  const t = koNormTail(koVerbTail(eojeol, head.slice(0, -1)) || '') || '';
  return /^(어주|어보|어봐|어봤|어버리|어버려|어버렸|어놓|어놨|어두|어둬|어드리|어드려|려고|려|러|자|어라|는다|ㄴ다|는|고 있)/.test(t);
}
const KO_ADV_PREV = new Set(['다', '잘', '못', '안', '또', '다시', '이미', '빨리', '같이', '먼저', '함께', '바로', '꼭', '좀', '더', '막', '곧', '이제', '아직', '결국', '모두', '직접', '계속', '그냥', '자주', '얼른', '서로']);
const KO_EUL_SHORT = { '날': ['나', '私を（＝나를）'], '널': ['너', '君を（＝너를）'], '우릴': ['우리', '私たちを（＝우리를）'] };
const KO_NUM_KANJI = { '일': '一', '이': '二', '삼': '三', '사': '四', '오': '五', '육': '六', '칠': '七', '팔': '八', '구': '九', '십': '十', '백': '百', '천': '千', '만': '万', '억': '億' };
function koDictLookup(eojeol, prevTok, nextTok, depth){
  if(!_koDict) return [];
  const list0 = koDictLookup0(eojeol, prevTok, nextTok, depth);
  return list0;
}
function koDictLookup0(eojeol, prevTok, nextTok, depth){
  const counter = koIsNumberWord(prevTok);
  const attr = koIsAttr(prevTok);
  const res = [];
  for(const { c, n } of koLemmaCandsN(eojeol)){
    const ents = _koDict[c];
    if(!ents) continue;
    const useful = ents.map((e, i) => { const x = e.slice(); x.i = i; return x; })
      .filter(e => !KO_FUNC_POS.includes(e[0]) || c === eojeol)
      .filter(e => !(/^(感|冠)$/.test(e[0]) && n < eojeol.length) && !(e[0] === '副' && (c === '안' || c === '못') && n < eojeol.length))   // 感動詞・冠形詞には助詞が付かない（아는→알다、세를→勢）
      .sort((a, b) => (counter ? (a[0] === '依名' ? 0 : 1) - (b[0] === '依名' ? 0 : 1) : 0)
        || (attr && koAttrOk(c, eojeol, prevTok) ? (a[0] === '依名' ? 0 : 1) - (b[0] === '依名' ? 0 : 1) : 0)
        || (c === eojeol && KO_ADV_FIRST.has(c) ? (a[0] === '副' ? 0 : 1) - (b[0] === '副' ? 0 : 1) : 0)
        || (koActTail(eojeol, c) ? (a[0] === '動' ? 0 : 1) - (b[0] === '動' ? 0 : 1) : 0)
        || (c.endsWith('다') && c.length >= 2 && !eojeol.startsWith(c) ? (/^(動|形|補動|補形)$/.test(a[0] || '') ? 0 : 1) - (/^(動|形|補動|補形)$/.test(b[0] || '') ? 0 : 1) : 0)
        || (KO_LV_ORDER[a[3] || 0]) - (KO_LV_ORDER[b[3] || 0]));
    if(!useful.length) continue;
    const verb = c.endsWith('다') && useful.some(e => /^(動|形|補動|補形)$/.test(e[0]));
    if(verb && !eojeol.startsWith(c.slice(0, -1)) && (koDec(c[c.length - 2]) || {}).T === 27 && !useful.some(e => /形/.test(e[0]))) continue; // 닿다 は 단 にならない
    let fit = koRestFits(eojeol.slice(n), verb) ? 1 : (!verb && c === eojeol.slice(0, n) && koCopV(c, eojeol.slice(n))) ? (eojeol.length - n >= 2 ? 1 : 0.5) : 0;
    if(verb) fit = koVerbFit(eojeol, c, fit);
    const lv = Math.min(...useful.map(e => KO_LV_ORDER[e[3] || 0]));
    let full = false;
    if(verb){ const t = koNormTail(koVerbTail(eojeol, c.slice(0, -1))); const sp = t ? koSplitTail(t, KO_END_TABLE) : null; full = !!sp && !sp.left; }
    // ㄹ が落ちた読み（준→줄다、난다→날다）と、語幹そのままの読み（날→날다）は、同じくらいなら後ろに
    let irr = 0, bare = 0;
    if(verb){
      const st = c.slice(0, -1), ls = koDec(st[st.length - 1]), ec = eojeol[st.length - 1] ? koDec(eojeol[st.length - 1]) : null;
      if(ls && ls.T === 8 && ec && ec.T !== 8 && !eojeol.startsWith(st)) irr = 1;
      if(eojeol === st) bare = 1;
    }
    if(verb && full && fit >= 1 && /^ㅁ(이|가|을|를|은|는|에|도|의|으로|로|과|와|였|인)/.test(koNormTail(koVerbTail(eojeol, c.slice(0, -1))) || '')) fit = 0.9;
    res.push({ head: c, ents: useful, n, fit, lv, verb, full, irr, bare });
  }
  res.sort((a, b) => b.n - a.n || b.fit - a.fit || (a.irr || 0) - (b.irr || 0) || (a.verb && b.verb ? (a.bare || 0) - (b.bare || 0) : 0) || a.lv - b.lv);
  if(res.length > 1 && res[0].verb && res[0].irr){
    const r = res.find(r => r !== res[0] && r.verb && r.full && !r.irr && r.n === res[0].n - 1 && r.fit >= res[0].fit && r.lv <= res[0].lv);
    if(r) res.splice(res.indexOf(r), 1), res.unshift(r);
  }
  const anyFit = res.some(r => r.fit > 0);
  // 合う候補が無いときは、短すぎる当てずっぽう（전지적→전 など）は出さない
  let list = anyFit ? res.filter(r => r.fit > 0) : res.filter(r => r.fit >= 0 && r.n >= 2 && r.n * 2 >= eojeol.length);
  const hasLong = list.some(r => r.n >= 2);
  // 長く合う候補（보고＝報告）があっても、語尾まできちんと合う動詞（보다＋고）は残す
  // （나를＝나＋를、말로＝말＋로 のような、短い名詞＋助詞も残しておく）
  if(hasLong) list = list.filter(r => r.n >= 2 || (r.verb && r.full && r.fit >= 1) || (!r.verb && KO_PARTICLES.includes(eojeol.slice(r.n)) && r.ents.some(e => /^(名|代)$/.test(e[0] || ''))));
  // 私を・君を（나를）：代名詞＋助詞は、形の変わる動詞（나르다）より先に
  {
    const pr = list.find(r => !r.verb && r.n < eojeol.length && r.ents.some(e => e[0] === '代') && KO_PART_TABLE[eojeol.slice(r.n)]);
    if(pr && list[0] !== pr && list[0].verb && !eojeol.startsWith(list[0].head.slice(0, -1))) list = [pr].concat(list.filter(r => r !== pr));
  }
  // 말로（末路）・위로（慰め）より、基本の名詞＋助詞（言葉で・上へ）／세상에（わぁ）より 世の中に（文の途中のとき）
  if(list.length > 1 && !list[0].verb && list[0].n === eojeol.length && list[0].head === eojeol){
    const isExc = list[0].ents.every(e => e[0] === '感');
    const isNoun = list[0].ents.every(e => e[0] === '名');
    const r = (isExc || isNoun) && list.find(r => !r.verb && r.n < eojeol.length && KO_PARTICLES.includes(eojeol.slice(r.n)) && (isExc || ['로', '으로', '에', '에서', '도', '를', '을', '가', '이', '는', '은', '의', '와', '과', '만'].includes(eojeol.slice(r.n))) && /^(名|代)$/.test(r.ents[0][0] || '') && (isExc ? (koIsAttr(prevTok) || !!nextTok) : r.lv < list[0].lv));
    if(r) list = [r].concat(list.filter(x => x !== r));
  }
  // その動詞のほうが基本の単語なら先に（보고：報告 より 見る）
  // （그래서＝それで のような、そのまま辞書にある副詞・感動詞・冠形詞は、動詞の形より先のまま）
  if(list.length > 1 && !list[0].verb && !(list[0].n === eojeol.length && list[0].ents.some(e => /^(副|感|冠|補動|補形|動|形|)$/.test(e[0] || '')))
     && !(list[0].n >= 2 && list[0].n < eojeol.length && koCopV(list[0].head, eojeol.slice(list[0].n)) && !(list[0].fit < 1 && list[0].lv >= 2 && list.some(r => r.verb && r.full && r.fit >= 1 && r.lv === 0 && r.head === '하다')))
     && !(list[0].n >= 2 && list[0].n < eojeol.length && koRestFits(eojeol.slice(list[0].n), false) && !(list[0].head.endsWith('기') && !list[0].ents.some(e => e[0] === '代') && list.some(r => r.verb && r.head === list[0].head.slice(0, -1) + '다')))){
    const v = list.find(r => r.verb && r.full && r.fit >= 1 && !r.bare && r.lv < list[0].lv && !(r.irr && list[0].head === eojeol && list[0].ents.some(e => e[0] === '名'))
      && (list[0].head !== eojeol || /^(고|어|어서|는|ㄴ|ㄹ|며|면|게|지|다|었다|어도|기|었|겠)/.test(koNormTail(koVerbTail(eojeol, r.head.slice(0, -1))) || '')));
    if(v){ list = [v].concat(list.filter(r => r !== v)); }
  }
  // 動詞として読むほうが自然なとき：前が副詞（다 사서）・前が「〜を」（정장을 입은）・うしろが名詞（담은 물건）
  {
    const vf = list.find(r => r.verb && r.full && r.fit >= 1 && !r.bare && r.head !== '이다');
    if(vf && list[0] !== vf && !list[0].verb && !list[0].guess && !list[0].short && !(list[0].ents[0][0] === '冠' && !(/(기라도|기는|기도|기만|긴|려고)$/.test(String(prevTok || '')) || /[을를]$/.test(String(prevTok || ''))))
       && !(/^사기/.test(eojeol) && /^(치|쳐|쳤|친|칠)/.test(String(nextTok || '')))){
      const pv = String(prevTok || ''), nx = String(nextTok || '');
      const exact = list[0].head === eojeol;
      const pos0 = list[0].ents[0][0] || '';
      const nounish = list[0].ents.some(e => /^(名|依名|接|)$/.test(e[0] || '')) && !list[0].ents.some(e => e[0] === '代') && !/^(冠|副|感|補動|補形)$/.test(pos0);
      const okExact = !exact || (!vf.irr && vf.lv <= list[0].lv);
      const one = list[0].head.length === 1;
      const nounVerb = /^(되|돼|됐|된|될|됩|하|해|했|한|할|합|당하|당해|당했|시키|시켜|받|드리|드려|드렸)/.test(nx);  // 신고 된（届けられた）は名詞のまま
      const ld = koDec(eojeol[eojeol.length - 1]);
      const attrEnd = ((!!ld && (ld.T === 4 || ld.T === 8)) || /[는던]$/.test(eojeol)) && !/^들/.test(eojeol.slice(list[0].n)) && !/면$/.test(eojeol);
      let nextNoun = false;
      if(attrEnd && nx && !depth){
        // 〜을・〜를（길을 나는＝道を）のときは、うしろが 것・수 などのときだけ（먹을 것）
        const objEnd = /[을를]$/.test(eojeol) && list[0].n < eojeol.length;
        const nl = koDictLookup(nx, eojeol, '', 1);
        nextNoun = !!nl[0] && !nl[0].verb && !nl[0].ents.some(e => e[0] === '代') && (objEnd ? nl[0].ents.some(e => e[0] === '依名') : nl[0].ents.some(e => /^(名|依名)$/.test(e[0] || '')));
      }
      const objPrev = pv.length >= 2 && /[을를]$/.test(pv) && (one || list[0].lv > vf.lv) && (nounish || pos0 === '冠' || (pos0 === '副' && eojeol.startsWith(vf.head.slice(0, -1)))) && (!exact || vf.lv <= list[0].lv);
      const numV = pos0 === '数' && list[0].head.length === 1 && list[0].n < eojeol.length;   // 오겠지・오는（来る）を 五 にしない
      const tryPrev = (/려고$/.test(pv) || /(기라도|기는|기도|기만|긴)$/.test(pv)) && vf.head === '하다';
      const negNext = /^(않|못하|못했|말|마$|마세요|마라|마요)/.test(nx) && /지$/.test(eojeol);
      const auxNext = list[0].ents.every(e => /^(感|名|)$/.test(e[0] || '')) && list[0].head === eojeol && /^(있|계|주|줘|줬|준|줄|드리|보|봐|봤|버리|버렸|놓|놨|두|둬)/.test(nx) && /[어아여와워해돼져러려쳐켜]$/.test(eojeol);   // 움직이려고 하자（〜しようとすると）
      const rare = one || list[0].lv > vf.lv;
      const quotePrev = /(라고|라고도|이라고|이라고도|다고|다고도)$/.test(pv) && nounish;
      if(objPrev || tryPrev || negNext || auxNext || numV) list = [vf].concat(list.filter(r => r !== vf));
      else if(okExact && !nounVerb && (quotePrev || (nounish && rare && (KO_ADV_PREV.has(pv) || nextNoun)))) list = [vf].concat(list.filter(r => r !== vf));
    }
  }
  // 마세요＝말다（지 마세요＝〜しないでください）、안다＝알다、한들＝하다、해 줄＝하다
  {
    const pv = String(prevTok || '');
    const want = /지(는|도|만)?$/.test(pv) && /^(마|말)/.test(eojeol) ? '말다' : /^해(야|서|도)/.test(eojeol) ? '하다' : (/(려|려고|라고|다고|자고|냐고|고자|기로)$/.test(pv) && /^(한|할|하|해|했|합)/.test(eojeol)) ? '하다' : /^있/.test(eojeol) ? '있다' : ({ '안다': '알다', '한들': '하다', '해': '하다', '빕니다': '빌다', '빌어요': '빌다' })[eojeol];
    if(want){ const v = list.find(r => r.head === want && r.full); if(v && list[0] !== v) list = [v].concat(list.filter(r => r !== v)); }
    {
      const nx = String(nextTok || '');
      const pick = (h, pos, jre) => {
        let v = list.find(r => r.head === h);
        if(!v && _koDict[h]){                                                        // 候補に残っていなくても、辞書から作る
          const ents = _koDict[h].map((e, i) => { const x = e.slice(); x.i = i; return x; }).filter(e => !KO_FUNC_POS.includes(e[0]));
          if(ents.length) v = { head: h, ents, n: Math.min(h.replace(/다$/, '').length, eojeol.length), fit: 1, lv: 0, verb: /다$/.test(h) && ents.some(e => /^(動|形)$/.test(e[0])), full: true };
        }
        if(!v) return;
        v = Object.assign({}, v, { full: true, fit: Math.max(v.fit || 0, 1), picked: true });
        if(pos){ const es = v.ents.slice().sort((a, b) => (a[0] === pos ? 0 : 1) - (b[0] === pos ? 0 : 1) || (pos === '名' && h === '열' ? (/列/.test(a[1][0]) ? 0 : 1) - (/列/.test(b[1][0]) ? 0 : 1) : 0)); v = Object.assign({}, v, { ents: es }); }
        if(jre){ const es = v.ents.slice().sort((a, b) => (jre.test(a[1].join()) ? 0 : 1) - (jre.test(b[1].join()) ? 0 : 1)); v = Object.assign({}, v, { ents: es }); }
        list = [v].concat(list.filter(r => r.head !== h));
      };
      const nxVerb = () => { if(!nx || depth) return false; const l = koDictLookup(nx, eojeol, '', 1)[0]; return !!l && l.verb; };
      if(/^(가요|가세요|가자|가니까|가요\?)$/.test(eojeol)) pick('가다');                     // 같이 가요（行きましょう）
      else if(/^사려(고|던|는|면|다)/.test(eojeol)) pick('사다');                                 // 사려던（買おうとしていた）
      else if(eojeol === '신고' && /^(된|되|돼|됐|하|했|할|당)/.test(nx)) pick('신고');           // 신고 된（通報された）
      else if(eojeol === '나서' && /[이가]$/.test(pv)) pick('나다');                               // 생각이 나서
      else if(/^회(의|에|를|는|가|부터|까지)$/.test(eojeol) && /^(마지막|첫|이번|다음|지난|몇|제|매|최종)$/.test(pv)) pick('회');  // 마지막 회의（最終回の）
      else if(/^열(의|에|로)$/.test(eojeol) && /^(앞|뒤|첫|맨|두|세|한|다음)$/.test(pv)) pick('열', '名');  // 앞 열의（前の列の）
      else if(eojeol === '저만' && !/^(한|하|큼)/.test(nx)) pick('저');                            // 저만 보이는（私だけ）
      else if(/^(여기|거기|저기)다$/.test(eojeol) && nxVerb()) pick(eojeol.slice(0, -1));          // 여기다 밀어（ここに）
      else if(/^때(였|이었|라|면|야|여)/.test(eojeol)) pick('때');                                 // 때였나
      else if(eojeol === '기어' && /^(나|가|오|들|다니|올|내|왔|갔)/.test(nx)) pick('기다');        // 기어 나왔다（這って）
      else if(eojeol === '보도' && pv === '듣도') pick('보다');                                    // 듣도 보도
      else if(eojeol === '기가' && /^(막|차|찼|죽|살|꺾|눌|세|센)/.test(nx)) pick('기');           // 기가 막히다（気が）
      else if(eojeol === '중인' || eojeol === '중이던') pick('중', '依名');                                // 대기 중인
      else if(eojeol === '어라') pick('어라');
      else if(/^마련/.test(eojeol) && /기$/.test(pv)) pick('마련', '依名');
      // Kiwi（形態素解析）と比べて見つかった読み違い
      else if(/^(나을|나은|나아|나아서|나아요|나았|나았다)$/.test(eojeol)) pick('낫다');                 // 게 나을 것（ましだ）
      else if(eojeol === '관할') pick('관할');                                                            // 관할（管轄）
      else if(/^(마세요|마십시오|마셔요)$/.test(eojeol) && !/^(물|술|차|커피|맥주)/.test(pv)) pick('말다');   // 걱정 마세요
      else if(/^(들었|들어|들으)/.test(eojeol) && /^(잘못|못|제대로)$/.test(pv)) pick('듣다');            // 잘못 들었나（聞き間違えた）
      else if(eojeol === '걸어' && (/(로|으로|까지|에서)$/.test(nx) || /^(가|오|왔|갔|나|들어|올라|내려|다니)/.test(nx))) pick('걷다');  // 계단을 걸어 무대로
      else if(eojeol === '물을' && /^(수|자격|필요|때|것|거|생각|리|이유|만한)/.test(nx)) pick('묻다');  // 물을 자격（尋ねる）
      else if(eojeol === '산' && /^(아래|위|속|정상|꼭대기|중턱|너머|밑|기슭|길)/.test(nx)) pick('산');  // 산 아래로（山）
      else if(eojeol === '가' && !koIsNumberWord(pv) && (!nx || /고$/.test(pv) || EO_A.test(pv))) pick('가다');  // 놓고 가（行く）
      else if(eojeol === '와' && /^(있|서|봐|보|줘|주|버|달|라)/.test(nx)) pick('오다');                // 잔뜩 와 있었다
      else if(eojeol === '서' && /^(있|서|보|봐|가|오|기다)/.test(nx)) pick('서다');                     // 옆에 서 있던
      else if(/^(끌|끈|끌어|끌고)$/.test(eojeol) && /^(시선|주의|관심|시간|눈길|이목|인기|발걸음)[을를]$/.test(pv)) pick('끌다');  // 시선을 끌（引く）                       // 〜기 마련이다（〜するものだ）
      else if(/^사기(를|도|까지|만)?$/.test(eojeol) && /^(치|쳐|쳤|친|칠|당하|당했|당한|당할)/.test(nx)) pick('사기', '名', /詐欺/);   // 사기를 치다（詐欺をはたらく）
      else if(eojeol === '기를' && (/^(모으|모아|모았|모은|끌어|불어|넣|펴|폈|쓰|써|썼|죽이|죽였|살리|쏟|받|빼앗|빨아)/.test(nx) || /^(단전|몸|검|손)/.test(pv))) pick('기', '名', /気/);   // 단전에 기를 모았다（気）
      else if(/^베어/.test(eojeol)) pick('베다', '動', /切|刈/);   // 베어 내다・베어 버리다（切る）
      else if(eojeol === '맨' && nx && !nxVerb()) pick('맨', '冠');                               // 맨 앞（いちばん前）
    }
    // 서지은 씨・김독자 님：うしろが 씨・님・군・양 なら、前は名前（動詞の形に当てはめない）
    if(!depth && /^(씨|님|군|양)$/.test(String(nextTok || '')) && list.length && list[0].verb && !list[0].picked && list[0].head.replace(/다$/, '') !== eojeol) list = list.filter(r => !r.verb);
    // 틈을 타（隙に乗じて）・버스를 타（乗って）
    if(eojeol === '타' && /[을를]$/.test(pv)){ const v = list.find(r => r.head === '타다'); if(v && list[0] !== v) list = [Object.assign({}, v, { full: true, fit: 1 })].concat(list.filter(r => r !== v)); }
    // 끌지는 마세요（引かないで）：うしろが 마・않・못 のときは、語幹そのままの動詞（끌다）を先に
    if(/지(는|도|만)?$/.test(eojeol) && /^(않|못|말|마)/.test(String(nextTok || '')) && list[0] && list[0].verb && !eojeol.startsWith(list[0].head.slice(0, -1))){
      const v = list.find(r => r.verb && r.full && eojeol.startsWith(r.head.slice(0, -1)) && /^지(는|도|만)?$/.test(eojeol.slice(r.head.length - 1)));
      if(v) list = [v].concat(list.filter(r => r !== v));
    }
  }
  // 날 보고（私を見て）：うしろが動詞のとき
  if(KO_EUL_SHORT[eojeol]){
    const nx = String(nextTok || '');
    let nextVerb = eojeol === '우릴';
    if(!nextVerb && nx && !depth){ const nl = koDictLookup(nx, eojeol, '', 1); nextVerb = !!nl[0] && nl[0].verb; }
    if(nextVerb){ const [h, ja] = KO_EUL_SHORT[eojeol]; list = [{ head: h, ents: [['代', [ja], '', 1]], n: eojeol.length, fit: 2, lv: 0, verb: false, full: true, short: true }].concat(list); }
  }
  // 数のあとの単位（10 화가＝10話が、1200 대였지만＝1200台だったが）
  if(counter){
    const k = Object.keys(KO_COUNTER_JA).sort((x, y) => y.length - x.length).find(k => eojeol.startsWith(k) && (eojeol === k || koRestFits(eojeol.slice(k.length), false) || koCopV(k, eojeol.slice(k.length))));
    if(k && (!list[0] || list[0].head !== k)){
      let r = list.find(x => x.head === k);
      if(!r){
        const ents = (_koDict[k] || []).map((e, i) => { const x = e.slice(); x.i = i; return x; }).filter(e => !KO_FUNC_POS.includes(e[0])).sort((x, y) => (x[0] === '依名' ? 0 : 1) - (y[0] === '依名' ? 0 : 1));
        r = { head: k, ents: ents.length ? ents : [['依名', [KO_COUNTER_JA[k]], '', 0]], n: k.length, fit: 1, lv: 0, verb: false, full: false };
      }
      list = [r].concat(list.filter(x => x !== r));
    }
  }
  // 할 수・한 채 など：文法の語を先に
  if(attr){
    let a = list.find(r => koAttrOk(r.head, eojeol, prevTok) && r.ents.some(e => /^(依名|名)$/.test(e[0])));
    // 할 수가・할 줄을・한 채로：長い別の語（수가＝報酬）に負けないよう、文法の語＋助詞として足す
    if(!a){
      const h = Object.keys(KO_AFTER_ATTR).sort((x, y) => y.length - x.length).find(h => eojeol.length >= h.length && eojeol.startsWith(h) && koAttrOk(h, eojeol, prevTok) && (eojeol === h || koRestFits(eojeol.slice(h.length), false)));
      if(h){
        const ents = (_koDict[h] || []).map((e, i) => { const x = e.slice(); x.i = i; return x; }).filter(e => !KO_FUNC_POS.includes(e[0]))
          .sort((x, y) => (x[0] === '依名' ? 0 : 1) - (y[0] === '依名' ? 0 : 1));
        a = { head: h, ents: ents.some(e => e[0] === '依名') ? ents : [['依名', [KO_AFTER_ATTR[h]], '', 0]].concat(ents), n: h.length, fit: 1, lv: 0, verb: false, full: false };
      }
    }
    if(a && list[0] !== a) list = [a].concat(list.filter(r => r !== a));
  }
  // 해야・해도 など：「太陽（해）」より 하다 を先に（해가・해를 のように助詞が付くときは名詞のまま）
  const VF = { '해': '하다', '하': '하다', '위해': '위하다', '위한': '위하다' };
  if(list.length > 1 && VF[list[0].head]){
    const v = list.find(r => r.head === VF[list[0].head] && r.full);
    const rest = eojeol.slice(list[0].head.length);
    if(v && rest && !['가', '는', '를', '의', '도', '와', '에', '에서', '처럼', '만', '보다', '까지', '부터'].includes(rest)) list = [v].concat(list.filter(r => r !== v));
  }
  // 形が合わない候補（넘어서→넘어서다、불이→불이다）より、形まで合う候補を先に
  const formOk = r => r.verb ? r.full : (r.short || r.guess || (eojeol.startsWith(r.head) && (r.head === eojeol || koRestFits(eojeol.slice(r.head.length), false) || koCopV(r.head, eojeol.slice(r.head.length)))));
  if(list.length > 1 && !formOk(list[0]) && !(attr && koAttrOk(list[0].head, eojeol, prevTok))){
    const ok = list.find(formOk);
    if(ok) list = [ok].concat(list.filter(r => r !== ok));
  }
  if(!list.length || !formOk(list[0])){
    const hv = koHadaGuess(eojeol) || koHiGuess(eojeol) || koEoHadaGuess(eojeol) || koSeureopGuess(eojeol) || koCompoundGuess(eojeol) || koCopShortGuess(eojeol);
    if(hv) list = [hv].concat(list);
  }
  // 개웃기다・핵노잼（めっちゃ〜）
  if(!depth && (!list.length || !formOk(list[0])) && /^(개|핵|존|갓)/.test(eojeol) && eojeol.length >= 3){
    const rest = eojeol.slice(1), rl = koDictLookup(rest, '', '', 1)[0];
    if(rl && (rl.verb ? rl.full : formOk(rl))){
      const pre = { '개': 'めっちゃ', '핵': '超', '존': 'めっちゃ', '갓': '神' }[eojeol[0]];
      const m = koFirstMean(KO_PREF_JA[rl.head] || koJaShort((rl.ents[0] || [])[1] ? rl.ents[0][1][0] : ''));
      list = [{ head: eojeol[0] + rl.head, ents: [[rl.verb ? (rl.ents[0] || [])[0] || '動' : '名', [pre + m + '（俗）'], '推測：' + eojeol[0] + '＋' + rl.head, 0]], n: eojeol.length, fit: 2, lv: 3, verb: !!rl.verb, full: true, guess: true }].concat(list);
    }
  }
  // ㅋㅋㅋ・ㅎㅎㅎ・ㅠㅠㅠ（数が違っても）
  { const jm = eojeol.match(/^([ㅋㅎㅠㅜ])\1+$/); if(jm && _koDict[jm[1] + jm[1]]) list = [{ head: eojeol, ents: _koDict[jm[1] + jm[1]], n: eojeol.length, fit: 2, lv: 0, verb: false, full: true, short: true }]; }
  // 게임하고 계셨던＝게임하다＋고（「ゲームと」ではない）
  if(!depth && list[0] && !list[0].verb && /하고$/.test(eojeol) && /^(있|계|싶|나서|말)/.test(String(nextTok || ''))){
    const hv = koHadaGuess(eojeol);
    if(hv) list = [hv].concat(list);
  }
  // 천원・오만원（数＋ウォン）
  const nw = eojeol.match(/^([일이삼사오육칠팔구십백천만억]+)원/);
  if(nw && (!_koDict[nw[0]] || koIsNumberWord(prevTok)) && (nw[0] === eojeol || koRestFits(eojeol.slice(nw[0].length), false))){
    list = [{ head: nw[0], ents: [['名', [nw[1].split('').map(c => KO_NUM_KANJI[c]).join('') + 'ウォン'], '推測：数＋원', 0]], n: nw[0].length, fit: 2, lv: 0, verb: false, full: true, guess: true }].concat(list);
  }
  {
    const SOLO = ['은', '는', '을', '를', '에', '의', '도', '과', '와', '로', '으로', '에서', '까지', '부터', '라는', '라고', '에게', '처럼'];
    if(SOLO.includes(eojeol) && _koDict[eojeol] && (!list[0] || !list[0].picked) && (!list[0] || list[0].head !== eojeol || !list[0].ents.some(e => e[0] === '助'))){
      const ents = _koDict[eojeol].map((e, i) => { const x = e.slice(); x.i = i; return x; }).filter(e => e[0] === '助');
      if(ents.length) list = [{ head: eojeol, ents, n: eojeol.length, fit: 2, lv: 0, verb: false, full: true }].concat(list.filter(r => r.head !== eojeol));
    }
  }
  return list.slice(0, 4);
}
// 名詞＋하다：辞書に「〜하다」が無くても、名詞のあとが 하다 の形なら「〜する」として読む
const KO_NOUN_VERBS = [['하', 'する'], ['받', 'される'], ['당하', 'される'], ['되', 'される・になる'], ['시키', 'させる'], ['드리', 'いたします']];
function koHadaGuess(eojeol){
  for(let i = eojeol.length - 1; i >= 1; i--){
    const x = eojeol.slice(0, i), rest = eojeol.slice(i);
    if(!_koDict[x] || !_koDict[x].some(e => /^(名|)$/.test(e[0] || ''))) continue;
    for(const [aux, ja] of KO_NOUN_VERBS){
      if(_koDict[x + aux + '다']) continue;
      if(aux === '하' && !/^[하해했한할합함]/.test(rest)) continue;
      if(aux !== '하' && rest[0] !== aux[0] && !(aux === '되' && /^[돼됐된될됩]/.test(rest))) continue;
      const t = koNormTail(koVerbTail(rest, aux));
      const sp = t === '' ? { left: '' } : (t ? koSplitTail(t, KO_END_TABLE) : null);
      if(!sp || sp.left) continue;
      const es = _koDict[x].filter(e => /^(名|)$/.test(e[0] || '')).sort((a, b) => KO_LV_ORDER[a[3] || 0] - KO_LV_ORDER[b[3] || 0]);
      const m = koFirstMean(KO_PREF_JA[x] || koJaShort(es[0][1][0]));
      return { head: x + aux + '다', ents: [['動', [m + ja.split('・')[0]], '推測：' + x + '＋' + aux + '다', 0]], n: eojeol.length, fit: 2, lv: 3, verb: true, full: true, guess: true };
    }
  }
  return null;
}
// 치열히＝熾烈に：〜하다 の形容詞から作った副詞
function koHiGuess(eojeol){
  if(eojeol.length < 3 || !eojeol.endsWith('히')) return null;
  const x = eojeol.slice(0, -1), es = _koDict[x + '하다'];
  if(!es || !es.some(e => e[0] === '形')) return null;
  let m = koFirstMean(KO_PREF_JA[x + '하다'] || koJaShort(es.find(e => e[0] === '形')[1][0]));
  m = /だ$/.test(m) ? m.slice(0, -1) + 'に' : /い$/.test(m) ? m.slice(0, -1) + 'く' : m;
  return { head: eojeol, ents: [['副', [m], '推測：' + x + '하다＋히', 0]], n: eojeol.length, fit: 2, lv: 3, verb: false, full: true, guess: true };
}
// 의아해하다・자랑스러워하다：形容詞＋어하다（〜がる）
function koEoHadaGuess(eojeol){
  for(let i = eojeol.length - 1; i >= 2; i--){
    const left = eojeol.slice(0, i), rest = eojeol.slice(i);
    if(!/^[하해했한할합함]/.test(rest) || _koDict[left + '하다']) continue;
    let adj = null;
    if(left.endsWith('해')) adj = left.slice(0, -1) + '하다';
    else if(/[워와]$/.test(left) && left.length >= 2){ const d = koDec(left[left.length - 2]); if(d && !d.T) adj = left.slice(0, -2) + koCmp(d.L, d.V, 17) + '다'; }
    else if(/[어아]$/.test(left)) adj = left.slice(0, -1) + '다';
    const es = adj && _koDict[adj];
    if(!es || !es.some(e => e[0] === '形')) continue;
    const t = koNormTail(koVerbTail(rest, '하'));
    const sp = t === '' ? { left: '' } : (t ? koSplitTail(t, KO_END_TABLE) : null);
    if(!sp || sp.left) continue;
    let m = koFirstMean(KO_PREF_JA[adj] || koJaShort(es.find(e => e[0] === '形')[1][0]));
    m = m.replace(/[いだ]$/, '') + 'がる';
    return { head: left + '하다', ents: [['動', [m], '推測：' + adj + '＋어하다', 0]], n: eojeol.length, fit: 2, lv: 3, verb: true, full: true, guess: true };
  }
  return null;
}
// 문젠가＝문제인가、실환가＝실화인가（名詞＋ㄴ가 の縮まった形）
const KO_COP_SHORT_B = { '니다': ['ㅂ니다＝입니다', '〜です'], '니까': ['ㅂ니까＝입니까', '〜ですか'] };
const KO_COP_SHORT = { '가': ['ㄴ가＝인가', '〜なのか'], '데': ['ㄴ데＝인데', '〜なんだけど'], '지': ['ㄴ지＝인지', '〜なのか'], '가요': ['ㄴ가요＝인가요', '〜なんですか'], '데요': ['ㄴ데요＝인데요', '〜なんですけど'] };
function koCopShortParts(eojeol, head){
  if(!head || head.length > eojeol.length || eojeol.slice(0, head.length - 1) !== head.slice(0, -1)) return null;
  const a = koDec(head[head.length - 1]), b = koDec(eojeol[head.length - 1]);
  if(!a || !b || a.T || (b.T !== 4 && b.T !== 17) || a.L !== b.L || a.V !== b.V) return null;
  const r = (b.T === 17 ? KO_COP_SHORT_B : KO_COP_SHORT)[eojeol.slice(head.length)];
  return r ? [{ k: r[0], d: r[1] }] : null;
}
function koCopShortGuess(eojeol){
  for(let i = eojeol.length - 1; i >= 1; i--){
    const d = koDec(eojeol[i - 1]);
    if(!d || (d.T !== 4 && d.T !== 17)) continue;
    const noun = eojeol.slice(0, i - 1) + koCmp(d.L, d.V, 0);
    const es = _koDict[noun];
    if(!es || !koCopShortParts(eojeol, noun)) continue;
    const ents = es.map((e, j) => { const x = e.slice(); x.i = j; return x; }).filter(e => /^(名|代|)$/.test(e[0] || ''));
    if(ents.length) return { head: noun, ents, n: eojeol.length, fit: 1, lv: 0, verb: false, full: true, short: true };
  }
  return null;
}
// つなげた語の推測：名詞を2〜4個つないだ形として読めるとき
const KO_SUFFIX_JA = { '증': '証', '팀': 'チーム', '역': '駅', '판': '版', '실': '室', '권': '券', '표': '票', '률': '率', '자': '者', '창': '欄', '글': '文・投稿', '부': '部', '국': '局', '사': '社', '장': '場', '감': '感', '화': '化', '명': '名', '적': '的', '성': '性', '용': '用', '식': '式', '재': '財', '약': '薬', '직': '職', '값': '値', '품': '品', '수': '数', '기': '期', '편': '話・編', '관': '館', '작': '作', '선': '線', '물': 'もの・物', '들': 'たち' };
function koSeureopGuess(eojeol){
  if(!_koDict) return null;
  const m = eojeol.match(/^(.+?)(스러운|스러웠|스럽|스러워|스레|스런)/);
  if(!m || m[1].length < 2) return null;
  const es = _koDict[m[1]];
  if(!es || !es.some(e => /^(名|)$/.test(e[0] || ''))) return null;
  let mean = koFirstMean(KO_PREF_JA[m[1]] || koJaShort((es.find(e => /^(名|)$/.test(e[0] || '')) || es[0])[1][0]));
  if(mean.length > 8) mean = m[1];
  if(m[2] === '스레') return { head: eojeol, ents: [['副', [mean + 'っぽく・' + mean + 'らしく'], '推測：' + m[1] + '＋스레', 0]], n: eojeol.length, fit: 2, lv: 3, verb: false, full: true, guess: true };
  return { head: m[1] + '스럽다', ents: [['形', [mean + 'っぽい・' + mean + 'らしい'], '推測：' + m[1] + '＋스럽다', 0]], n: eojeol.length, fit: 2, lv: 3, verb: true, full: true, guess: true };
}
function koCompoundGuess(eojeol){
  if(!_koDict || eojeol.length < 3) return null;
  const isNoun = w => { const es = _koDict[w]; return !!es && es.some(e => /^(名|依名|代|数|)$/.test(e[0] || '')); };
  const meanOf = w => { if(KO_SUFFIX_JA[w] && w.length === 1) return KO_SUFFIX_JA[w]; const p = KO_PREF_JA[w]; if(p) return koFirstMean(p); const es = _koDict[w].filter(e => /^(名|依名|代|数|)$/.test(e[0] || '')).sort((a, b) => KO_LV_ORDER[a[3] || 0] - KO_LV_ORDER[b[3] || 0]); return koFirstMean(koJaShort(es[0][1][0])); };
  const split = (w, depth) => {
    if(isNoun(w) && w.length >= 2) return [w];
    if(depth >= 4) return null;
    for(let i = w.length - 1; i >= 2; i--){
      const a = w.slice(0, i), b = w.slice(i);
      if(!isNoun(a)) continue;
      if(b.length === 1){ if(KO_SUFFIX_JA[b]) return [a, b]; continue; }
      const r = split(b, depth + 1);
      if(r) return [a].concat(r);
    }
    return null;
  };
  // うしろが よく使う助詞（가・의・를…）なら、まずそれを外した形でつなぐ（공공재＋가、강연실＋의）
  const ks = [];
  for(let k = eojeol.length - 1; k >= eojeol.length - 2 && k >= 3; k--) if(KO_PARTICLES.includes(eojeol.slice(k))) ks.push(k);
  for(let k = eojeol.length; k >= 3; k--) if(!ks.includes(k)) ks.push(k);
  for(const k of ks){
    const core = eojeol.slice(0, k);
    if(k < eojeol.length && !koRestFits(eojeol.slice(k), false)) continue;
    const ps = split(core, 1);
    if(ps && ps.length >= 2){
      const ja = ps.map(meanOf).join('');
      return { head: core, ents: [['名', [ja], '推測：' + ps.join('＋'), 0]], n: core.length, fit: 1, lv: 3, verb: false, full: false, guess: true };
    }
  }
  return null;
}
// 辞書の見出しから、本文に付ける形（語幹）を決める
function koKeyFromHead(head, pos, eojeol){
  if(/^(動|形|補動|補形)$/.test(pos) && head.endsWith('다') && head.length > 1){
    const stem = head.slice(0, -1);
    // 不規則で形が変わるとき（짓다→지었다 など）は、この形のまま登録
    return eojeol.startsWith(stem) ? stem : eojeol;
  }
  return eojeol.startsWith(head) ? head : null;
}
async function koFillDict(hit, addMode){
  const box = document.getElementById('ko-dict');
  if(!box) return;
  if(!_koDict){
    box.innerHTML = '<div class="ko-dict-msg">辞書を読み込み中…（初回だけ少しかかります）</div>';
    try{ await koDictLoad(); }
    catch(e){ box.innerHTML = '<div class="ko-dict-msg">辞書を読み込めませんでした</div>'; return; }
    if(_koCur !== hit) return;
  }
  const prevTok = koPrevTok(hit);
  const gi = koGrammarInfo(hit.eojeol, prevTok);
  if(gi){ koFillGrammar(hit, gi, addMode); return; }
  const found = koDictLookup(hit.eojeol, prevTok, koNextTok(hit));
  if(!found.length && _koHeadAuto && !addMode){
    const ng = koNounGuess(hit.eojeol);
    if(ng && !hit.key){ koSetKey(ng); koSetHead(ng); }
    else { const kk = (document.getElementById('ko-key') || {}).value; if(kk) koSetHead(koGuessHead(kk, hit.eojeol)); }
  }
  if(!found.length){
    box.innerHTML = '<div class="ko-dict-msg">辞書に見つかりませんでした。下の「辞書で調べる」でNaverを開けます</div>';
    let ono = '', split = null;
    try{ ono = koOnoGuess(hit.eojeol); }catch(_){}
    try{ if(!ono && !addMode) split = koSplitGuess(hit.eojeol); }catch(_){}
    if(ono) box.innerHTML += `<div class="ko-fi-note" style="font-size:12.5px;margin-top:6px">🔊 ${escapeHtml(ono)}</div>`;
    if(split){
      window._koSplitNow = split;
      box.innerHTML += `<div class="ko-split">分かち書きがないかも → ${split.map((x, i) => `<button class="ko-name-btn" style="display:inline-block;margin:4px 4px 0 0" onclick="koLookupPart(${i})">${escapeHtml(x)}</button>`).join('＋')}</div>`;
    }
    try{
      const nb = koNameBase(hit.eojeol), kana = koToKana(nb);
      if(!addMode && !ono && !split && kana && nb.length >= 2 && nb.length <= 5){
        window._koNameNow = [nb, kana];
        box.innerHTML += `<button class="ko-name-btn" onclick="koNameFill(window._koNameNow[0],window._koNameNow[1])">人名なら → <b>${escapeHtml(nb)}</b>＝${escapeHtml(kana)}</button>`;
        if(hit.nameKana) koNameFill(nb, hit.nameKana);
      }
    }catch(_){}
    if(!addMode) koRenderFormInfo(koFormGuess(hit.eojeol));
    return;
  }
  window._koDictRows = [];
  let shown = 0;
  // 本文の語がそのまま辞書にあるとき（이쯤）は、1文字に分けた候補（이＝歯・二）は出さない
  const shownFound = (found[0] && found[0].head === hit.eojeol && !found[0].verb && !found[0].guess) ? found.filter(f => f === found[0] || f.verb || f.head.length >= 2) : found;
  box.innerHTML = shownFound.map(f => f.ents.slice(0, 3).filter(() => shown++ < 5).map(e => {
    const i = window._koDictRows.push({ head: f.head, pos: e[0], ja: e[1], hanja: e[2] || '', idx: e.i }) - 1;
    return `<button class="ko-dict-row" onclick="koPickDict(${i})">
      <span class="ko-dict-h">${escapeHtml(f.head)}${e[2] ? `<small>${escapeHtml(e[2])}</small>` : ''}</span>
      ${e[0] ? `<span class="ko-dict-pos">${escapeHtml(e[0])}</span>` : ''}
      <span class="ko-dict-ja">${e[1].map(s => escapeHtml(koJaShort(s))).filter(Boolean).slice(0, 3).join('<span class="ko-dict-sep">／</span>')}</span>
    </button>`;
  }).join('')).join('');
  // まだ意味が空なら、いちばん上の候補を入れておく
  if(!addMode && !_koEdit.ms.length && window._koDictRows[0]){
    const r = window._koDictRows[0];
    // 数のあとの単位（몇 번 → 回）は、分かりやすい言い方を先に
    const cm = (r.pos === '依名' || KO_COUNTER_ANY.has(r.head)) && koIsNumberWord(prevTok) ? KO_COUNTER_JA[r.head] : '';
    const pm = (!/(긴|기는)$/.test(hit.eojeol) || !KO_DO.test(koNextTok(hit)) ? KO_PREF_WORD[hit.eojeol] : '') || koAttrMean(r.head, hit.eojeol, prevTok) || (hit.eojeol === r.head && KO_PREF_EXACT[r.head]) || (hit.eojeol !== r.head && KO_PREF_PART[r.head]) || KO_PREF_JA[r.head] || '';
    koAddMeaning(cm || pm || koJaShort(r.ja[0]).split('・').slice(0, 2).join('・'));
    _koEdit._auto = true;
    const first = box.querySelector('.ko-dict-row'); if(first) first.classList.add('on');
    koShowExamples(r);
    let k = koKeyFromHead(r.head, r.pos, hit.eojeol);
    if(k && _koWords[k] && koHead(k) !== r.head && !(hit.key && hit.key === k)) k = hit.eojeol; // 세다 の 세 が、登録済みの 세（三）とぶつかるとき
    if(k && !hit.key) koSetKey(k);
    if(_koHeadAuto) koSetHead(r.head);
    const pw = KO_PREF_WORD[hit.eojeol] && pm === KO_PREF_WORD[hit.eojeol];
    const fi = koFormInfo(hit.eojeol, r.head, r.pos, pw ? (KO_PREF_EXACT[r.head] && r.head === '그' ? 'それ' : (KO_PREF_JA[r.head] || koJaShort(r.ja[0]))) : (cm || pm || koJaShort(r.ja[0])));
    if(fi && pw) fi.ja = koFirstMean(pm);
    const mustNote = koMustNote(hit, fi);
    if(fi && mustNote) fi.note = mustNote;
    koRenderFormInfo(fi);
  }
}
// 「〜어야 하다／되다」＝〜しなければならない（어야 の語と、そのあとの 하다・되다 のどちらを押しても出す）
function koMustNote(hit, fi){
  try{
    const isMust = t => /(어야|아야|여야|해야|돼야|되어야)$/.test(t || '');
    const isDo = t => /^(하|해|했|한|할|합|되|돼|됐|된|될|됩)/.test(t || '');
    if(fi && fi.parts && fi.parts.some(p => p.k === '어야') && isDo(koNextTok(hit))) return `次の「${koNextTok(hit)}」と合わせて「〜しなければならない」（〜어야 하다／되다）`;
    const pv = koPrevTok(hit);
    if(isMust(pv) && isDo(hit.eojeol)) return `前の「${pv}」と合わせて「〜しなければならない」（〜어야 하다／되다）`;
    // 있지 않은가＝あるじゃないか（否定の形で問いかけて「〜だよね」と言う）
    const isNegQ = t => /^않(은가|는가|았는가|았나|나|냐|니|을까|습니까|았습니까|아요|았어|았니|았냐)$/.test(t || '');
    const nx = koNextTok(hit);
    const negMsg = '「〜じゃないか」と確認・同意を求める言い方です（否定の意味ではありません）';
    if(/지$/.test(hit.eojeol) && isNegQ(nx)) return `次の「${nx}」と合わせて${negMsg}`;
    if(isNegQ(hit.eojeol) && /지$/.test(pv)) return `前の「${pv}」と合わせて${negMsg}`;
    const hand = koPatternNotes(hit.eojeol, pv, nx);
    let dict = [];
    try{ const nb = koNeighbors(hit.sentence, hit.eojeol, hit.occ); if(nb.i >= 0) dict = koDictPhraseNotes(nb.toks, nb.i, nb.end, hand.length > 0); }catch(_){}
    return hand.concat(dict.filter(d => !hand.some(h => h.includes(d.key)))).map(x => typeof x === 'string' ? x : x.text).join('\n');
  }catch(_){}
  return '';
}
/* 2つの語で1つの意味になる言い回し（하긴 했는데・시작을 하다・먹고 있다 など）
   A＝前の語の終わり、B＝うしろの語の始まり。ja は B の語を見て決める */
const KO_DO = /^(하|해|했|한|할|합|함|하겠|했었)/;
// 〜아/어 の形（먹어・해・써・가져・봐）：最後の字が ㅏㅐㅓㅕㅘㅝㅙ で終わり、받침なし
const EO_A = { test: t => { const d = koDec(String(t).slice(-1)); return !!d && !d.T && [0, 1, 4, 6, 9, 10, 14].includes(d.V); } };
const ATTR_L = { test: t => { const d = koDec(String(t).slice(-1)); return !!d && d.T === 8 && !/를$/.test(t); } };
const ATTR_A = { test: t => { const d = koDec(String(t).slice(-1)); return !!d && (d.T === 4 || d.T === 8 || /[는던]$/.test(t)) && !/[을를]$/.test(t); } };
const KO_PATTERNS = [
  { a: /^모르긴$/, b: /^몰라(도|두)$/, ja: () => 'よくは分からないが（たぶん）（모르긴 몰라도）' },
  { a: /^혀를$/, b: /^(차|찼|찬|칠|차며|차고)/, ja: () => '舌打ちする（혀를 차다）' },
    { a: /^마른침을$/, b: /^(삼키|삼켰)/, ja: () => '固唾をのむ（마른침을 삼키다）' },
  { a: /^숨을$/, b: /^(삼키|삼켰|죽이|죽였)/, ja: () => '息をのむ・息を殺す（숨을 삼키다／죽이다）' },
  { a: /^눈치(를|도)?$/, b: /^(보|봐|봤|본|볼|살피|살폈)/, ja: () => '顔色をうかがう（눈치를 보다）' },
  { a: /^눈치(를|도)?$/, b: /^(채|챘|챈|챌)/, ja: () => '感づく（눈치를 채다）' },
  { a: /^눈치가$/, b: /^(빠르|빨라|빨랐|빠른|없)/, ja: () => '勘がいい／鈍い（눈치가 빠르다・없다）' },
  { a: /^눈에$/, b: /^(띄|띠|띈|띕)/, ja: () => '目立つ・目に留まる（눈에 띄다）' },
  { a: /^눈앞이$/, b: /^(캄캄|깜깜|아득|노래)/, ja: () => '目の前が真っ暗になる（눈앞이 캄캄하다）' },
  { a: /^인상을$/, b: /^(쓰|써|썼|쓴|찌푸|찡그)/, ja: () => '顔をしかめる（인상을 쓰다）' },
  { a: /^(이를|이빨을)$/, b: /^(악물|악무)/, ja: () => '歯を食いしばる（이를 악물다）' },
  { a: /^(이를|이빨을)$/, b: /^(갈|간|갈았)/, ja: () => '歯ぎしりする・恨みを抱く（이를 갈다）' },
  { a: /^등골이$/, b: /^(오싹|서늘|섬뜩)/, ja: () => '背筋が凍る（등골이 오싹하다）' },
  { a: /^(소름이|소름)$/, b: /^(돋|끼치|끼쳤)/, ja: () => '鳥肌が立つ（소름이 돋다）' },
  { a: /^(가슴이|심장이)$/, b: /^(철렁|덜컥|쿵)/, ja: () => 'ドキッとする・心臓が跳ねる（가슴이 철렁하다）' },
  { a: /^(심장이|가슴이)$/, b: /^(내려앉|내려앉았)/, ja: () => '心臓が止まりそうになる（심장이 내려앉다）' },
  { a: /^정신(을|이)?$/, b: /^(차리|차려|차렸|차린)/, ja: () => '我に返る・しっかりする（정신을 차리다）' },
  { a: /^정신이$/, b: /^(들|든|들었|번쩍)/, ja: () => '気がつく・我に返る（정신이 들다）' },
  { a: /^정신을$/, b: /^(잃|놓)/, ja: () => '気を失う（정신을 잃다）' },
  { a: /^정신이$/, b: /^(없|없었|없는)/, ja: () => 'あわただしい・気が気でない（정신이 없다）' },
  { a: /^기가$/, b: /^(차|찼|찬|차서)/, ja: () => 'あきれる（기가 차다）' },
  { a: /^어이(가|도)?$/, b: /^(없|없었|없는|없어)/, ja: () => 'あきれる・呆れてものも言えない（어이가 없다）' },
  { a: /^말을$/, b: /^(걸|건|걸었)/, ja: () => '話しかける（말을 걸다）' },
  { a: /^말을$/, b: /^(꺼내|꺼냈|꺼낸|꺼낼)/, ja: () => '話を切り出す（말을 꺼내다）' },
  { a: /^말을$/, b: /^(놓|놨|놔|놓아)/, ja: () => 'ため口にする（말을 놓다）' },
  { a: /^말을$/, b: /^(잇|이어|이었)/, ja: () => '言葉を続ける（말을 잇다）' },
  { a: /^말끝을$/, b: /^(흐리|흐렸|흐린)/, ja: () => '言葉を濁す（말끝을 흐리다）' },
  { a: /^입이$/, b: /^떡$/, ja: () => '開いた口がふさがらない（입이 떡 벌어지다）' },
  { a: /^말을$/, b: /^(잃|잃었|잃은)/, ja: () => '言葉を失う（할 말을 잃다）' },
  { a: /^손을$/, b: /^(쓰|써|썼|쓴|쓸)/, ja: () => '手を打つ・対処する（손을 쓰다）' },
  { a: /^손을$/, b: /^(떼|뗐|뗀|뗄)/, ja: () => '手を引く（손을 떼다）' },
  { a: /^발을$/, b: /^(들이|들였|들인|들일)/, ja: () => '足を踏み入れる（발을 들이다）' },
  { a: /^발목을$/, b: /^(잡|잡았|잡힌|잡혀)/, ja: () => '足を引っ張る（발목을 잡다）' },
  { a: /^뒤통수를$/, b: /^(치|쳤|친|칠|맞)/, ja: () => '裏切る／裏切られる（뒤통수를 치다・맞다）' },
  { a: /^신경이$/, b: /^(쓰이|쓰였|쓰여|거슬)/, ja: () => '気になる（신경이 쓰이다）' },
  { a: /^마음(을|은)?$/, b: /^(먹|먹었|먹은|먹고)/, ja: () => '決心する（마음을 먹다）' },
  { a: /^마음이$/, b: /^(놓이|놓였|놓여)/, ja: () => '安心する（마음이 놓이다）' },
  { a: /^속이$/, b: /^(상하|상했|상해|상한)/, ja: () => '悔しい・心が痛む（속이 상하다）' },
  { a: /^(속이|애가)$/, b: /^(타|탔|탄|탈)/, ja: () => '気をもむ・やきもきする（속이 타다）' },
  { a: /^화가$/, b: /^(나|났|난|날)/, ja: () => '腹が立つ（화가 나다）' },
  { a: /^(열이|열)$/, b: /^(받|뻗)/, ja: () => '頭にくる（열이 받다）' },
  { a: /^짜증이$/, b: /^(나|났|난|날)/, ja: () => 'イライラする（짜증이 나다）' },
  { a: /^겁이$/, b: /^(나|났|난|날)/, ja: () => '怖くなる（겁이 나다）' },
  { a: /^겁을$/, b: /^(먹|먹었|먹은)/, ja: () => '怖気づく（겁을 먹다）' },
  { a: /^웃음이$/, b: /^(터지|터졌|나|났)/, ja: () => '吹き出す・笑いがこぼれる（웃음이 터지다）' },
  { a: /^코웃음을$/, b: /^(치|쳤|친)/, ja: () => '鼻で笑う（코웃음을 치다）' },
  { a: /^(미소를|웃음을|쓴웃음을|비웃음을|표정을)$/, b: /^(짓|지었|지은|지을|지어)/, ja: () => '（笑みや表情を）浮かべる（미소를 짓다）' },
  { a: /^한눈을$/, b: /^(팔|판|팔았)/, ja: () => 'よそ見をする（한눈을 팔다）' },
  { a: /^(한눈에|첫눈에)$/, b: /^(반하|반했|반한)/, ja: () => '一目惚れする（첫눈에 반하다）' },
  { a: /^목이$/, b: /^(메|메었|멨|멘)/, ja: () => '胸が詰まる・声が詰まる（목이 메다）' },
  { a: /^목숨을$/, b: /^(걸|건|걸었)/, ja: () => '命をかける（목숨을 걸다）' },
  { a: /^숨이$/, b: /^(막히|막혔|막힐|막혀|멎)/, ja: () => '息が詰まる・息が止まる（숨이 막히다）' },
  { a: /^피가$/, b: /^(끓|끓었|끓는)/, ja: () => '血が騒ぐ（피가 끓다）' },
  { a: /^시치미를$/, b: /^(떼|뗐|뗀)/, ja: () => 'しらを切る（시치미를 떼다）' },
  { a: /^능청을$/, b: /^(떨|떨었|떠)/, ja: () => 'とぼける（능청을 떨다）' },
  { a: /^(허세를|고집을|엄살을|꾀를|심술을|어리광을|난동을|행패를)$/, b: /^(부리|부렸|부린|부려)/, ja: () => '（虚勢・意地などを）張る・起こす（〜를 부리다）' },
  { a: /^(뜸을|뜸)$/, b: /^(들이|들였|들여)/, ja: () => 'もったいぶる（뜸을 들이다）' },
  { a: /^시간을$/, b: /^(끌|끈|끌었)/, ja: () => '時間を稼ぐ（시간을 끌다）' },
  { a: /^판을$/, b: /^(깨|깼|깬)/, ja: () => 'ぶち壊す（판을 깨다）' },
  { a: /^판을$/, b: /^(짜|짰|짠)/, ja: () => '段取りを組む（판을 짜다）' },
  { a: /^사고를$/, b: /^(치|쳤|친|칠)/, ja: () => 'やらかす・問題を起こす（사고를 치다）' },
  { a: /^(난리가|난리)$/, b: /^(나|났|난|날)/, ja: () => '大騒ぎになる（난리가 나다）' },
  { a: /^큰일이$/, b: /^(나|났|난|날)/, ja: () => '大変なことになる（큰일이 나다）' },
  { a: /^코가$/, b: /^납작/, ja: () => '鼻をへし折られる（코가 납작해지다）' },
  { a: /^콧대가$/, b: /^(높|세)/, ja: () => '鼻が高い・高慢だ（콧대가 높다）' },
  { a: /^발$/, b: /^벗고$/, ja: () => '一肌脱ぐ（발 벗고 나서다）' },
  { a: /^손에$/, b: /^땀을$/, ja: () => '手に汗握る（손에 땀을 쥐다）' },
  { a: /^꼬리를$/, b: /^(내리|내렸|내린)/, ja: () => '尻尾を巻く（꼬리를 내리다）' },
  { a: /^꼬리를$/, b: /^(치|쳤|친)/, ja: () => '媚びる・色目を使う（꼬리를 치다）' },
  { a: /^꼬리를$/, b: /^(잡|잡았|잡힌|밟)/, ja: () => '尻尾をつかむ（꼬리를 잡다）' },
  { a: /^(본색을|정체를|속내를|본성을)$/, b: /^(드러내|드러냈|드러낸)/, ja: () => '本性を現す（본색을 드러내다）' },
  { a: /^뒤를$/, b: /^(밟|밟았|밟는)/, ja: () => '尾行する・後をつける（뒤를 밟다）' },
  { a: /^눈독을$/, b: /^(들이|들였)/, ja: () => '目をつける（눈독을 들이다）' },
  { a: /^군침을$/, b: /^(흘리|흘렸|삼키|삼켰|다시|다셨)/, ja: () => 'よだれを垂らす・欲しがる（군침을 흘리다）' },
  { a: /^입맛을$/, b: /^(다시|다셨|다신)/, ja: () => '舌打ちする・舌なめずりする（입맛을 다시다）' },
  { a: /^간이$/, b: /^(콩알|떨어|철렁|크|커|부었)/, ja: () => '肝が縮む／肝を潰す／肝が据わる（간이 〜）' },
  { a: /^배가$/, b: /^(아프|아파|아팠)/, ja: () => 'お腹が痛い・（人のことが）妬ましい（배가 아프다）' },
  { a: /^머리를$/, b: /^(굴리|굴렸|굴려)/, ja: () => '頭を働かせる（머리를 굴리다）' },
  { a: /^골치가$/, b: /^(아프|아파|아팠)/, ja: () => '頭が痛い・厄介だ（골치가 아프다）' },
  { a: /^일을$/, b: /^(벌이|벌였|벌여|벌인)/, ja: () => '事を起こす（일을 벌이다）' },
  { a: /^그도$/, b: /^그럴$/, ja: () => 'それもそのはず（그도 그럴 것이）' },
  { a: /^아니나$/, b: /^다를/, ja: () => '案の定（아니나 다를까）' },
  { a: /^다름$/, b: /^아닌/, ja: () => 'ほかでもない（다름 아닌）' },
  { a: /^다름이$/, b: /^아니라/, ja: () => 'ほかでもなく・実は（다름이 아니라）' },
  { a: /^그렇다고$/, b: /^(해서|해도|하더라도)$/, ja: () => 'だからといって（그렇다고 해서）' },
  { a: /^그건$/, b: /^그렇고$/, ja: () => 'それはそうと（그건 그렇고）' },
  { a: /^어찌$/, b: /^(됐든|되었든|됐건|되든)$/, ja: () => 'とにかく・どうあれ（어찌 됐든）' },
  { a: /^뭐니$/, b: /^뭐니$/, ja: () => 'なんといっても（뭐니 뭐니 해도）' },
  { a: /^(두말할|말할)$/, b: /^것도$/, ja: () => '言うまでもなく（말할 것도 없이）' },
  { a: /^죽을$/, b: /^(맛|지경)/, ja: () => '死ぬほどつらい・死にそうなほど（죽을 맛・죽을 지경）' },
  { a: /^(미칠|환장할|돌|답답할)$/, b: /^노릇/, ja: () => '気が狂いそうだ・やりきれない（미칠 노릇）' },
  { a: /^알$/, b: /^바$/, ja: () => '知ったことではない（알 바 아니다）' },
  { a: /^알게$/, b: /^뭐/, ja: () => '知るか（알게 뭐야）' },
  { a: /^될$/, b: /^대로$/, ja: () => 'なるようになれ（될 대로 되라）' },
  { a: /^(신이|신)$/, b: /^(나|났|난|날|나서)/, ja: () => 'ノリノリになる・浮かれる（신이 나다）' },
  { a: /^(정신이)$/, b: /^번쩍$/, ja: () => 'はっと我に返る（정신이 번쩍 들다）' },
  { a: /^손발이$/, b: /^(오그라|오글)/, ja: () => 'むずがゆくなる・恥ずかしくなる（손발이 오그라들다）' },
  { a: /^꿈에도$/, b: /^(몰랐|모르|생각)/, ja: () => '夢にも思わなかった（꿈에도 몰랐다）' },
  { a: /기$/, b: /^마련/, ja: () => '〜するものだ（〜기 마련이다）' },
  { a: /(이고|고)$/, b: /^나발이고$/, ja: () => '〜も何もあったものではない（〜이고 나발이고）' },
  { a: /^눈을$/, b: /^(씻고|씻어)$/, ja: () => '目を皿にして（눈을 씻고 봐도）' },
  { a: /^환심을$/, b: /^(사|샀|살|산)/, ja: () => '機嫌をとる（환심을 사다）' },
  { a: /^맞장구를$/, b: /^(치|쳤|친|쳐)/, ja: () => '相槌を打つ（맞장구를 치다）' },
  { a: /^(손뼉을|박수를)$/, b: /^(치|쳤|친|쳐)/, ja: () => '手を叩く・拍手する（손뼉을 치다）' },
  { a: /^아무렇지$/, b: /^(않|도)/, ja: () => '平気で・何でもないように（아무렇지 않게）' },
  { a: /^손가락을$/, b: /^(튕기|튕겼)/, ja: () => '指を鳴らす・指を弾く（손가락을 튕기다）' },
  { a: /^(티를|티가|티)$/, b: /^(내|냈|낸|나|났|난)/, ja: () => '顔に出す・態度に出る（티를 내다）' },
  { a: /^(눈물을|눈가를|눈을)$/, b: /^(훔치|훔쳤|훔친)/, ja: () => '涙を拭う（눈물을 훔치다）' },
  { a: /^(마음을)$/, b: /^(저격|저격했)/, ja: () => '心を撃ち抜く（마음을 저격하다）' },
  { a: /^(주제를|주제도)$/, b: /^(모르|몰라|몰랐|알)/, ja: () => '身の程を知らない（주제를 모르다）' },
  { a: /^(입술을)$/, b: /^(깨물|깨물었)/, ja: () => '唇を噛む（悔しさ・こらえる）（입술을 깨물다）' },
  { a: /^(어깨를)$/, b: /^(으쓱)/, ja: () => '肩をすくめる（어깨를 으쓱하다）' },
  { a: /^(고개를)$/, b: /^(젓|저었|저어|저으)/, ja: () => '首を横に振る（고개를 젓다）' },
  { a: /^(이를|이빨을)$/, b: /^(드러내|드러냈)/, ja: () => '歯をむき出す（이를 드러내다）' },
  { a: /다는$/, b: /^(것인가|것인가요|건가|건가요|거냐|것이냐|거야)$/, ja: () => '〜するというのか・〜だというのか（〜다는 것인가）' },
  { a: /다는$/, b: /^(것|거|건|걸|게|것은|것을|것이|것도)$/, ja: () => '〜するということ・〜だということ（〜다는 것）' },
  { a: /서는$/, b: /^(안|안돼|안된다|안됩니다)$/, verb: true, ja: () => '〜してはいけない（〜어서는 안 되다）' },
  { a: /서는$/, b: /^아니/, verb: true, ja: () => '〜だからではない（〜어서는 아니다）' },
  { a: /^(이쯤|그쯤|여기까지|이 정도)$/, b: /^(되면|되니|되자|되니까|되고|되어서|돼서)$/, ja: () => 'ここまで来ると・この段階になると（이쯤 되면）' },
  { a: /^틈을$/, b: /^(타|탄|탔|탈)/, ja: () => '隙に乗じる（틈을 타다）' },
  // ── 助詞の意味が日本語と変わるもの ──
  { a: /(이|가)$/, b: /^(아니|아닌|아냐|아닙|아녜)/, noun: true, ja: () => '〜ではない（〜가 아니다）', note: () => 'この 이／가 は、日本語では「が」ではなく「では」になります' },
  { a: /(이|가)$/, b: /^(되|돼|됐|된|될|됩|되었|되어)/, noun: true, ja: () => '〜になる（〜가 되다）', note: () => 'この 이／가 は、日本語では「が」ではなく「に」になります' },
  { a: /(을|를)$/, b: /^좋아(하|해|했|한|할|합)/, noun: true, ja: () => '〜が好きだ（〜를 좋아하다）', note: () => 'この 을／를 は、日本語では「を」ではなく「が」になります' },
  { a: /(을|를)$/, b: /^싫어(하|해|했|한|할|합)/, noun: true, ja: () => '〜が嫌いだ（〜를 싫어하다）', note: () => 'この 을／를 は「が」になります' },
  { a: /(을|를)$/, b: /^잘(하|해|했|한|할|합)/, noun: true, ja: () => '〜が上手だ・〜が得意だ（〜를 잘하다）', note: () => 'この 을／를 は「が」になります' },
  { a: /(을|를)$/, b: /^(타|탔|탄|탈|탑|타고|타서)/, noun: true, ja: () => '〜に乗る（〜를 타다）', note: () => 'この 을／를 は「を」ではなく「に」になります' },
  { a: /(을|를)$/, b: /^(만나|만났|만난|만날|만납)/, noun: true, ja: () => '〜に会う（〜를 만나다）', note: () => 'この 을／를 は「を」ではなく「に」になります' },
  { a: /(을|를)$/, b: /^(닮|닮았|닮은)/, noun: true, ja: () => '〜に似ている（〜를 닮다）', note: () => 'この 을／를 は「に」になります' },
  { a: /^마음에$/, b: /^(들|드|든|듭|들었|들어)/, ja: () => '気に入る（마음에 들다）' },
  { a: /^신경(을|도|)$/, b: /^(써|쓰|썼|쓴|쓸|씁)/, ja: () => '気を使う・気にする（신경 쓰다）' },
  { a: /^코가$/, b: /^석$/, ja: () => '自分のことで精一杯（내 코가 석 자＝鼻水が三尺）' },
  { a: /^호흡을$|^숨을$/, b: /^(고르|골라|골랐)/, ja: () => '息を整える（호흡을 고르다）' },
  { a: /^생각이$/, b: /^(나|났|난|날|납)/, ja: () => '思い出す・考えが浮かぶ（생각이 나다）' },
  { a: /^생각이$/, b: /^(들|든|드|듭)/, ja: () => '〜と思う・〜気がする（생각이 들다）' },
  { a: /^시간이$/, b: /^(되|돼|됐|된|될|됩)/, ja: () => '時間がある・都合がつく（시간이 되다）' },
  { a: /^말이$/, b: /^(되|돼|됐|된|될|됩)/, ja: () => '筋が通る・ありえる（말이 되다）' },
  { a: /^기가$/, b: /^(막히|막힌|막혀|막혔)/, ja: () => 'すごい・あきれる（기가 막히다）' },
  { a: /^잔뼈가$/, b: /^굵/, ja: () => 'その道のベテランだ（잔뼈가 굵다）' },
  { a: /^사레가$/, b: /^들/, ja: () => 'むせる（사레가 들리다）' },
  { a: /^녹초가$/, b: /^(되|돼|됐|된)/, ja: () => 'くたくたになる（녹초가 되다）' },
  { a: /^썰을$/, b: /^(풀|푼|풀어|풀었)/, ja: () => 'エピソードを話す（썰을 풀다）' },
  { a: /^듣도$/, b: /^보도$/, ja: () => '聞いたことも見たこともない（듣도 보도 못하다）' },
  { a: /^사기를$/, b: /^(치|쳐|쳤|친|칠)/, ja: () => '詐欺を働く・だます（사기를 치다）' },
  { a: /(아도|어도|해도|여도)$/, b: /^그렇지$/, ja: () => 'いくら〜でも、それはないだろう（〜아도 그렇지）' },
  { a: /다$/, b: /^한들$/, ja: () => '〜したとしても（〜다 한들）' },
  { a: /에$/, b: /^익숙/, ja: () => '〜に慣れている（〜에 익숙하다）' },
  // ── 2つの語で1つの意味 ──
  { a: /기$/, b: /^때문/, ja: () => '〜するので・〜だから（〜기 때문에）' },
  { a: /^리(가|는|도|)$/, b: /^없/, ja: () => '〜はずがない（〜ㄹ 리가 없다）' },
  { a: /^그럴$/, b: /^리/, ja: () => 'そんなはずが（ない）（그럴 리가 없다）' },
  { a: /^말도$/, b: /^안$/, ja: () => 'ありえない・とんでもない（말도 안 되다）' },
  { a: /^어쩔$/, b: /^수/, ja: () => '仕方ない（어쩔 수 없다）' },
  { a: /^별수$/, b: /^없/, ja: () => 'どうしようもない（별수 없다）' },
  { a: /^줄(을|은|도|)$/, b: /^(알|아는|안다|압니|몰|모르|모른)/, ja: b => /^(몰|모르|모른)/.test(b) ? '〜とは思わなかった・〜できない（〜ㄹ 줄 모르다）' : '〜できる・〜と思った（〜ㄹ 줄 알다）' },
  { a: /^바$/, b: /^있/, ja: () => '〜したことがある（〜ㄴ 바 있다・かたい）' },
  { a: /면$/, b: /^(되|돼|됩|된다)/, verb: true, ja: () => '〜すればいい（〜면 되다）' },
  { a: /면$/, b: /^안$/, verb: true, ja: () => '〜してはいけない・〜したらだめ（〜면 안 되다）' },
  { a: /도$/, b: /^(되|돼|됩|된다|괜찮)/, verb: true, ja: () => '〜してもいい（〜도 되다）' },
  { a: /고$/, b: /^싶어(하|해|했|한|할)/, verb: true, ja: () => '〜したがる（〜고 싶어하다）' },
  { a: /고$/, b: /^(나서|나니|나면|난)/, verb: true, ja: () => '〜してから・〜してしまうと（〜고 나서）' },
  { a: /고$/, b: /^(말았|말겠|만다|말|마는)/, verb: true, ja: () => '〜してしまう（結局）（〜고 말다）' },
  { a: /지$/, b: /^않으면/, verb: true, ja: () => '〜しなければ（うしろに 안 되다 で「〜しなければならない」）' },
  { a: /게$/, b: /^(하|해|했|한|할|합|만들|만드)/, verb: true, ja: () => '〜させる・〜するようにする（〜게 하다）' },
  { a: /게$/, b: /^틀림없/, ja: () => '〜に違いない（〜게 틀림없다）' },
  { a: /다$/, b: /^(보니|보면|보니까)/, verb: true, ja: () => '〜しているうちに（〜다 보니）' },
  { a: /나$/, b: /^(보|봐|봅|본다)/, verb: true, ja: () => '〜らしい・〜みたいだ（〜나 보다）' },
  { a: /(까)$/, b: /^(봐|봐서)$/, verb: true, ja: () => '〜するかと思って・〜しそうで（〜ㄹ까 봐）' },
  { a: /지도$/, b: /^(모르|모른|모를|몰라|몰랐|모릅)/, ja: () => '〜かもしれない（〜ㄹ지도 모르다）' },
  { a: /기로$/, b: KO_DO, ja: () => '〜することにする（〜기로 하다）' },
  { a: /도록$/, b: KO_DO, ja: () => '〜するようにする（〜도록 하다）' },
  { a: /고자$/, b: KO_DO, ja: () => '〜しようと思う（〜고자 하다・かたい）' },
  { a: /기에$/, b: /^(이르|이른|이르렀|이를)/, ja: () => '〜するに至る（〜기에 이르다）' },
  { a: /처럼$/, b: /^(보이|보였|보인|보일|보입)/, ja: () => '〜のように見える（〜처럼 보이다）' },
  { a: /에$/, b: /^(의해|의한|의하면|의하여)/, ja: b => /^의하면/.test(b) ? '〜によると（〜에 의하면）' : '〜によって（〜에 의해）' },
  { a: /에$/, b: /^(관해|관한|관하여|관해서)/, ja: b => /^관한/.test(b) ? '〜に関する（〜에 관한）' : '〜に関して（〜에 관해）' },
  { a: /(로|으로)$/, b: /^(인해|인한|인하여)/, ja: () => '〜によって・〜のせいで（〜로 인해）' },
  { a: EO_A, b: /^죽겠/, verb: true, eo: true, ja: () => '〜で死にそう・ものすごく〜（〜어 죽겠다）' },
  // 名詞の前の形（〜する・〜した）のあと
  { a: ATTR_A, b: /^(때|때는|때도|때에|때마다)$/, verb: true, ja: () => '〜するとき・〜したとき（〜ㄹ 때）' },
  { a: ATTR_A, b: /^(후|후에|다음|다음에|뒤|뒤에)$/, verb: true, ja: () => '〜したあとで（〜ㄴ 후에）' },
  { a: /기$/, b: /^(전|전에|전까지)$/, verb: true, ja: () => '〜する前に（〜기 전에）' },
  { a: ATTR_A, b: /^(동안|동안에)$/, verb: true, ja: () => '〜している間（〜는 동안）' },
  { a: ATTR_A, b: /^(척|체)/, verb: true, ja: () => '〜するふりをする（〜는 척하다）' },
  { a: ATTR_A, b: /^바람에$/, verb: true, ja: () => '〜したせいで（〜는 바람에）' },
  { a: ATTR_A, b: /^김에$/, verb: true, ja: () => '〜するついでに（〜는 김에）' },
  { a: ATTR_A, b: /^모양/, verb: true, ja: () => '〜らしい・〜ようだ（〜는 모양이다）' },
  { a: ATTR_A, b: /^(정도로|정도의|정도)$/, verb: true, ja: () => '〜するほど（〜ㄹ 정도로）' },
  { a: ATTR_A, b: /^(대로)$/, verb: true, ja: () => '〜するとおりに・〜したらすぐ（〜는 대로）' },
  { a: ATTR_A, b: /^(법이다|법이지|법)$/, verb: true, ja: () => '〜するものだ（〜는 법이다）' },
  { a: ATTR_A, b: /^(셈이다|셈|셈이었다|셈이지)$/, verb: true, ja: () => '〜したも同然だ・〜ということになる（〜ㄴ 셈이다）' },
  { a: ATTR_A, b: /^(따름이다|따름입니다|따름)$/, verb: true, ja: () => '〜するだけだ（〜ㄹ 따름이다）' },
  { a: ATTR_A, b: /^(지경|지경이다|지경이었다)$/, verb: true, ja: () => '〜するほどだ・〜しそうなありさま（〜ㄹ 지경이다）' },
  { a: ATTR_A, b: /^끝에$/, verb: true, ja: () => '〜した末に（〜ㄴ 끝에）' },
  { a: ATTR_A, b: /^각/, verb: true, ja: () => '〜する流れだ・〜しそう（〜ㄹ 각이다・ネット言葉）' },
  { a: /수가$/, b: /^있/, ja: () => '〜することもある・〜できる（〜는 수가 있다）' },
  { a: /(긴|기는)$/, b: KO_DO, ja: b => /했|었/.test(b) ? '〜するにはしたけど・一応〜はした' : '〜するにはするけど・一応〜はする',
    note: a => `〜기는 하다 は「一応〜はする（けど…）」と言いたいときの決まった形${/긴$/.test(a) ? `。${a.slice(-1)} は 기는 の縮まった形` : ''}` },
  { a: /기도$/, b: KO_DO, ja: () => '〜することもある・〜でもある（〜기도 하다）' },
  { a: /기라도$/, b: KO_DO, ja: b => /^한$/.test(b) ? '〜しでもした（〜기라도 하다）' : '〜しでもする（〜기라도 하다）' },
  { a: /기만$/, b: KO_DO, ja: () => '〜してばかりいる・〜するだけだ（〜기만 하다）' },
  { a: /기$/, b: /^(시작|시작하|시작해|시작했|시작한|시작할|시작합)/, verb: true, ja: () => '〜し始める（〜기 시작하다）' },
  { a: /(려고|으려고)$/, b: KO_DO, ja: () => '〜しようとする（〜려고 하다）' },
  { a: /고$/, b: /^(있|계)/, verb: true, ja: b => /^계/.test(b) ? '〜していらっしゃる（〜고 계시다）' : '〜している（〜고 있다）' },
  { a: /고$/, b: /^싶/, verb: true, ja: () => '〜したい（〜고 싶다）' },
  { a: EO_A, b: /^있/, verb: true, eo: true, ja: () => '〜している（状態）（〜어 있다）' },
  { a: EO_A, b: /^(주|줘|줬|준|줄|드리|드려|드렸|드린|드릴)/, verb: true, eo: true, ja: b => /^드/.test(b) ? '〜して差し上げる（〜어 드리다）' : '〜してくれる・〜してあげる（〜어 주다）' },
  { a: EO_A, b: /^(버리|버려|버렸|버린|버릴)/, verb: true, eo: true, ja: () => '〜してしまう（〜어 버리다）' },
  { a: EO_A, b: /^(보|봐|봤|본|볼|봅)/, verb: true, eo: true, ja: () => '〜してみる（〜어 보다）' },
  { a: EO_A, b: /^(놓|놨|둬|두|뒀|둔|둘)/, verb: true, eo: true, ja: () => '〜しておく（〜어 놓다／두다）' },
  { a: EO_A, b: /^(오(?!르)|와|왔|온|올|옵|가(?!지|져|졌)|갔|간|갈|갑)/, verb: true, eo: true, ja: b => /^(가|갔|간|갈|갑)/.test(b) ? '〜していく（〜어 가다）' : '〜してくる・〜してきた（〜어 오다）' },
  { a: /야$/, b: /^(하|해|했|한|할|합|되|돼|됐|된|될|됩)/, verb: true, ja: () => '〜しなければならない（〜어야 하다）' },
  { a: /지도$/, b: /^(모르|모른|모를|몰라|몰랐|모릅)/, ja: () => '〜かもしれない（〜ㄹ지도 모르다）' },
  { a: /지$/, b: /^(모르|모른|모를|몰라|몰랐|모릅)/, verb: true, ja: () => '〜するかわからない・〜かもしれない（〜ㄹ지 모르다）' },
  { a: /까$/, b: /^(하|해|했|한|합)/, verb: true, ja: () => '〜しようかと思う（〜ㄹ까 하다）' },
  { a: ATTR_L, b: /^뻔/, verb: true, ja: () => '危うく〜するところだった（〜ㄹ 뻔하다）' },
  { a: ATTR_L, b: /^(만하|만해|만했|만한|만할|만합)/, verb: true, ja: () => '〜する価値がある・〜するに値する（〜ㄹ 만하다）' },
  { a: ATTR_A, b: /^편/, verb: true, ja: () => '〜するほうだ（〜는 편이다）' },
  { a: /기$/, b: /^위(해|한|하여|해서|하여서)$/, verb: true, ja: () => '〜するために（〜기 위해）' },
  { a: /면$/, b: /^좋겠/, ja: () => '〜したらいいな・〜だといいな（〜으면 좋겠다）' },
  { a: /[을를]$/, b: /^따라(서)?$/, noun: true, ja: () => '〜について・〜に沿って（〜를 따라）', note: () => 'この 을／를 は「を」ではなく「に」になります' },
  { a: /[을를]$/, b: /^향(해|하여|한|하는|했|해서)/, noun: true, ja: () => '〜に向かって（〜를 향해）', note: () => 'この 을／를 は「を」ではなく「に」になります' },
  { a: /[과와]$/, b: /^달리$/, noun: true, ja: () => '〜と違って（〜와 달리）' },
  { a: /^선을$/, b: /^(넘|넘어|넘었|넘은|넘는|넘지)/, ja: () => '一線を越える（선을 넘다）' },
  { a: /게$/, b: /^(되|돼|됐|된|될|됩)/, verb: true, ja: () => '〜することになる・〜するようになる（〜게 되다）' },
  { a: /지$/, b: /^않/, verb: true, ja: () => '〜しない（〜지 않다）' },
  { a: /지$/, b: /^못/, verb: true, ja: () => '〜できない（〜지 못하다）' },
  { a: /지$/, b: /^(말|마$|마라|마요|마세요|마십시오)/, verb: true, ja: () => '〜しないで・〜するな（〜지 말다）' },
  { a: /나$/, b: /^싶/, verb: true, ja: () => '〜かなと思う（〜나 싶다）' },
  { a: /^적(이|은|도|)$/, b: /^(있|없)/, ja: b => /^없/.test(b) ? '〜したことがない（〜ㄴ 적이 없다）' : '〜したことがある（〜ㄴ 적이 있다）' },
  { a: /^수(가|는|도|)$/, b: /^(있|없)/, ja: b => /^없/.test(b) ? '〜できない（〜ㄹ 수 없다）' : '〜できる（〜ㄹ 수 있다）' },
  { a: /^(것|거)$/, b: /^같/, ja: () => '〜みたいだ・〜しそうだ（〜것 같다）' },
  { a: /^뻔$/, b: KO_DO, ja: () => '〜するところだった（〜ㄹ 뻔하다）' },
  { a: /^(중|중에)$/, b: /^(이|였|이었|입)/, ja: () => '〜している最中だ（〜는 중이다）' },
  { a: /^그에$/, b: /^(비해|비하면|비하여|비해서)/, ja: () => 'それに比べて（그에 비해）' },
  { a: /에$/, b: /^(비해|비하면|비하여|비해서)/, ja: () => '〜に比べて（〜에 비해）' },
  { a: /(는가|은가|인가|ㄴ가|던가|냐|느냐|나)$/, b: /^하면/, ja: () => '〜かというと（〜는가 하면）' },
  { a: /에$/, b: /^(대해|대한|대해서|대하여)/, ja: b => /^대한/.test(b) ? '〜についての（〜에 대한）' : '〜について（〜에 대해）' },
  { a: /에$/, b: /^(따라|따르면)/, ja: b => /^따르면/.test(b) ? '〜によると（〜에 따르면）' : '〜に従って・〜によって（〜에 따라）' },
  { a: /(을|를)$/, b: /^(위해|위한|위해서|위하여)/, ja: b => /^위한/.test(b) ? '〜のための（〜을 위한）' : '〜のために（〜을 위해）' },
  { a: /(을|를)$/, b: /^(통해|통해서|통하여)/, ja: () => '〜を通して・〜によって（〜을 통해）' },
  { a: /(만|밖에)$/, b: /^(않|아니|없|못)/, ja: () => '〜しか〜ない' },
  { a: /^(수밖에)$/, b: /^없/, ja: () => '〜するしかない（ㄹ 수밖에 없다）' },
];
// 動詞の形か（辞書が読めていないときは、たしかめずに使える言い回しだけ）
function koIsVerbTok(t, eo){
  if(!_koDict) return null;
  // いちばん上の候補でなくても、語尾まで合う動詞の読みがあればよい（가지 마＝行かないで）
  return koDictLookup(t, '', '', 1).some(l => {
    if(!l.verb || !l.full) return false;
    if(!eo) return true;
    const fi = koFormInfo(t, l.head, (l.ents[0] || [])[0], '');
    return !!fi && fi.parts && fi.parts.length && fi.parts[fi.parts.length - 1].k === '어';
  });
}
function koPatternNotes(cur, pv, nx){
  const out = [];
  const tryPair = (a, b, isCur) => {
    if(!a || !b) return;
    for(const P of KO_PATTERNS){
      if(!P.a.test(a) || !P.b.test(b)) continue;
      if(P.verb){ const v = koIsVerbTok(a, P.eo); if(v === false || v === null) continue; }
      if(P.noun && _koDict){ const l = koDictLookup(a, '', '', 1)[0]; if(l && l.verb) continue; }
      const ja = P.ja(b);
      out.push(`${isCur ? `次の「${b}」` : `前の「${a}」`}と合わせて「${ja}」${P.note ? '。' + P.note(a) : ''}`);
      return;
    }
  };
  // 시작을 하다＝시작하다 を分けた形（名詞＋을／를＋하다）
  const split = (a, b, isCur) => {
    if(!a || !b || !_koDict || !/[을를]$/.test(a) || !KO_DO.test(b)) return;
    const n = a.slice(0, -1), es = _koDict[n + '하다'];
    if(!es) return;
    const m = koFirstMean(KO_PREF_JA[n + '하다'] || koJaShort((es.find(e => /^(動|形)$/.test(e[0])) || es[0])[1][0]));
    out.push(`${isCur ? `次の「${b}」` : `前の「${a}」`}と合わせて「${n}${a.slice(-1)} 하다」＝${n}하다（${m}）を2つに分けた形`);
  };
  split(pv, cur, false); split(cur, nx, true);
  // 못 정했습니다＝決められなかった・まだ決めていない／안 갔다＝行かなかった
  const neg = (a, b, isCur) => {
    if(!/^(못|안)$/.test(a || '') || !b) return;
    const v = koIsVerbTok(b, false);
    if(!v) return;
    const past = /[었았였했됐갔봤왔줬졌]/.test(b);
    const ja = a === '못' ? (past ? '〜できなかった・（まだ）〜できていない' : '〜できない') : (past ? '〜しなかった' : '〜しない');
    out.push(`${isCur ? `次の「${b}」` : `前の「${a}」`}と合わせて「${ja}」（${a}＋動詞）`);
  };
  neg(pv, cur, false); neg(cur, nx, true);
  tryPair(pv, cur, false); tryPair(cur, nx, true);
  return out;
}
function koSetKey(k){
  document.getElementById('ko-key').value = k;
  const sum = document.getElementById('ko-key-sum'); if(sum) sum.textContent = k;
  if(![...document.querySelectorAll('#ko-sheet .ko-chip')].some(b => b.textContent === k)){
    const wrap = document.querySelector('#ko-sheet .ko-chips');
    const b = document.createElement('button');
    b.className = 'ko-chip'; b.textContent = k; b.onclick = () => koPickKey(b);
    wrap.appendChild(b);
  }
  document.querySelectorAll('#ko-sheet .ko-chip').forEach(b => b.classList.toggle('on', b.textContent === k));
  document.getElementById('ko-del-btn').style.visibility = _koWords[k] ? '' : 'hidden';
}
function koPickDict(i){
  const r = window._koDictRows[i];
  if(!r) return;
  document.querySelectorAll('#ko-dict .ko-dict-row').forEach((b, j) => b.classList.toggle('on', j === i));
  const m = koJaShort(r.ja[0]).split('・').slice(0, 2).join('・');
  // 新しい単語で、自動で入れた候補しかないなら入れ替え。それ以外は意味を足す
  if(!_koWords[(document.getElementById('ko-key') || {}).value] && _koEdit.ms.length === 1 && _koEdit._auto) _koEdit.ms = [];
  koAddMeaning(m);
  _koEdit._auto = false;
  const memo = document.getElementById('ko-memo');
  if(memo && !memo.value) memo.value = r.head + (r.hanja ? `（${r.hanja}）` : '') + (r.pos ? ` ${r.pos}` : '');
  const k = _koCur && koKeyFromHead(r.head, r.pos, _koCur.eojeol);
  if(k) koSetKey(k);
  koSetHead(r.head);
  _koHeadAuto = false;
  // 不規則（짓다→지었다）なら、辞書の形の語幹も「ほかの形」に
  if(/다$/.test(r.head) && /^(動|形|補動|補形)$/.test(r.pos)){
    const stem = r.head.slice(0, -1), key = document.getElementById('ko-key').value.trim();
    if(stem !== key && !_koForms.includes(stem) && !stem.startsWith(key)) { _koForms.push(stem); koRenderForms(); }
  }
  koShowExamples(r);
  if(_koCur) koRenderFormInfo(koFormInfo(_koCur.eojeol, r.head, r.pos, koJaShort(r.ja[0])));
}


/* ══════ 自分の訳（段落の下に書く） ══════ */
function koTrs(){
  if(!state.novel) return {};
  if(!state.novel.koTr || typeof state.novel.koTr !== 'object') state.novel.koTr = {};
  return state.novel.koTr;
}
let _koTrTimer = null;
function koTrSaveSoon(){
  clearTimeout(_koTrTimer);
  _koTrTimer = setTimeout(koPersistNovel, 600);
}
function koTrSet(h, text){
  text = (text || '').replace(/\s+$/, '');
  const had = !!koTrs()[h];
  if(text) koTrs()[h] = text; else delete koTrs()[h];
  if(text && !had) koStat('t');
}
function koAutoGrow(ta){ ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
// 閲覧中のページに、段落ごとの訳の欄（または書いた訳）を差し込む
function koDecoratePage(pageEl, pi){
  koScheduleMeasure();
  if(state.editMode || !pageEl || !state.novel || !koEnabled()) return;
  const mode = koTrMode();
  if(mode === 'off' || mode === 'only') return;
  const trs = state.novel.koTr || {};
  pageEl.querySelectorAll('p[data-qi][data-type="text"]').forEach(p => {
    const para = state.pages[pi] && state.pages[pi].paras[parseInt(p.dataset.qi, 10)];
    if(!para) return;
    const plain = koParaPlain(para);
    if(!KO_HANGUL.test(plain)) return;
    const h = koHash(plain);
    const tr = trs[h] || '';
    if(mode === 'show' && !tr) return;
    const box = document.createElement('div');
    box.className = 'ko-tr' + (mode === 'write' ? ' write' : '');
    box.contentEditable = 'false';
    box.dataset.h = h;
    box.style.textAlign = p.style.textAlign || '';
    // 訳の欄での入力・タップが本文（編集の仕組み）に伝わらないようにする
    ['input', 'beforeinput', 'keydown', 'keyup', 'keypress', 'paste', 'cut', 'compositionstart', 'compositionupdate', 'compositionend', 'click', 'dblclick']
      .forEach(ev => box.addEventListener(ev, e => e.stopPropagation()));
    if(mode === 'write'){
      const ta = document.createElement('textarea');
      ta.className = 'ko-tr-input';
      ta.rows = 1;
      ta.placeholder = '訳を書く…';
      ta.value = tr;
      ta.addEventListener('input', () => { koAutoGrow(ta); koTrSet(h, ta.value); koTrSaveSoon(); });
      ta.addEventListener('blur', () => { koTrSet(h, ta.value); koPersistNovel(); });
      ta.addEventListener('keydown', e => e.stopPropagation());
      box.appendChild(ta);
      requestAnimationFrame(() => koAutoGrow(ta));
    }else{
      box.textContent = tr;
      box.title = 'タップでなおす';
      box.addEventListener('click', () => koOpenTrSheet(h, plain));
    }
    p.after(box);
  });
}
function koOpenTrSheet(h, plain){
  const body = document.getElementById('ko-sheet-body');
  body.innerHTML = `
    <div class="ko-label" style="margin-top:0">原文</div>
    <div class="ko-sentence">${escapeHtml(plain)}</div>
    <div class="ko-label">自分の訳</div>
    <textarea id="ko-tr-edit" class="ko-input" rows="4">${escapeHtml(koTrs()[h] || '')}</textarea>
    <div class="ko-actions">
      <button class="ko-del" onclick="koTrSet('${h}','');koPersistNovel();koCloseSheet();koRerender();">削除</button>
      <button class="ko-cancel" onclick="koCloseSheet()">閉じる</button>
      <button class="ko-save" onclick="koTrSet('${h}',document.getElementById('ko-tr-edit').value);koPersistNovel();koCloseSheet();koRerender();">保存</button>
    </div>
    <div class="ko-actions" style="margin-top:6px">
      <button class="ko-cancel" id="ko-tr-chk" onclick="koTrCheck()">🦑 訳をチェック（AI）</button>
    </div>
    <div id="ko-tr-chk-out" class="ko-trchk-out"></div>`;
  body.dataset.trPlain = plain;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
}
// この話で訳を書いた段落の数
function koTrProgress(){
  if(!state.pages || !state.novel) return null;
  const trs = state.novel.koTr || {};
  let all = 0, done = 0;
  state.pages.forEach(pg => (pg.paras || []).forEach(para => {
    if(para.type !== 'text') return;
    const plain = koParaPlain(para);
    if(!KO_HANGUL.test(plain)) return;
    all++; if(trs[koHash(plain)]) done++;
  }));
  return all ? { all, done } : null;
}
// 訳を書いた文をまとめて書き出す（原文と訳を交互に）
function koExportTr(){
  const ep = state.novel && state.novel.episodes.find(e => e.id === state.currentEpisodeId);
  if(!ep) return;
  const trs = state.novel.koTr || {};
  const lines = [];
  state.pages.forEach(pg => (pg.paras || []).forEach(para => {
    if(para.type !== 'text') return;
    const plain = koParaPlain(para);
    if(!plain.trim()) return;
    lines.push(plain);
    const t = trs[koHash(plain)];
    if(t) lines.push('→ ' + t);
    lines.push('');
  }));
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (ep.title || '訳') + '_自分の訳.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function koUnlearn(){
  const k = document.getElementById('ko-key').value.trim();
  if(!_koWords[k]) return;
  Object.assign(_koWords[k], { ivl: 1, due: koAddDays(koDay(), 1), u: new Date().toISOString() });
  koSaveWords(); koRerender();
  const row = document.querySelector('#ko-sheet .ko-learned-row'); if(row) row.remove();
  showToast('本文に意味を出すようにしました');
}


/* ══════ 辞書の例文（8個に分けて、必要な分だけ読む） ══════ */
const KO_EX_N = 8;
const _koEx = {};
function koExShard(w){ let h = 0; for(const ch of w) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0; return (h % 1009) % KO_EX_N; }
async function koExLoad(head){
  const n = koExShard(head);
  if(_koEx[n]) return _koEx[n];
  let txt = null;
  try{
    const db = await koDictIdb();
    txt = await new Promise(res => { const q = db.transaction('d').objectStore('d').get('ex' + n); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  }catch(_){}
  if(!txt){
    let r = await fetch('krdict-ex/' + n + '.json').catch(() => null);
    if(!r || !r.ok) r = await fetch(KO_DATA_ALT + 'krdict-ex/' + n + '.json').catch(() => null);
    if(!r || !r.ok) throw new Error('ex ' + (r ? r.status : 'network'));
    txt = await r.text();
    try{ const db = await koDictIdb(); db.transaction('d', 'readwrite').objectStore('d').put(txt, 'ex' + n); }catch(_){}
  }
  _koEx[n] = JSON.parse(txt);
  return _koEx[n];
}
async function koShowExamples(r){
  const box = document.getElementById('ko-ex');
  if(!box || !r) return;
  box.innerHTML = '';
  let list = [], defs = [];
  await Promise.all([
    koExLoad(r.head).then(sh => { list = ((sh[r.head] || [])[r.idx]) || []; }).catch(() => {}),
    koDefLoad(r.head).then(sh => { defs = ((sh[r.head] || [])[r.idx]) || []; }).catch(() => {})
  ]);
  if(document.getElementById('ko-ex') !== box) return;
  let html = '';
  if(defs.length){
    window._koDefRows = defs;
    const row = (d, i) => `<button class="ko-def-row${i >= 3 ? ' ko-def-more' : ''}" onclick="koPickDef(${i})">
      <span class="ko-def-n">${i + 1}</span><span class="ko-def-t">${d[0] ? `<b>${escapeHtml(koJaShort(d[0]))}</b>　` : ''}${escapeHtml(d[1] || '')}${d[2] ? `<small class="ko-def-rel">${escapeHtml(d[2].replace(/略:/g, '略して ').replace(/元:/g, 'もとの形 ').replace(/反:/g, '反対 '))}</small>` : ''}</span></button>`;
    html += '<div class="ko-label">意味ごとの説明（タップで意味に追加）</div><div class="ko-defs">' + defs.map(row).join('') +
      (defs.length > 3 ? `<button class="ko-def-toggle" onclick="this.parentNode.classList.add('open');this.remove()">ほかの意味も見る（${defs.length - 3}）</button>` : '') + '</div>';
  }
  if(list.length) html += '<div class="ko-label">例文（タップで発音）</div>' + list.map(t =>
    `<button class="ko-ex-row" onclick="koSpeak(this.textContent)">${escapeHtml(t)}</button>`).join('');
  box.innerHTML = html;
}
// 意味ごとの説明（16個に分けて、必要な分だけ読む）
const KO_DEF_N = 16;
const _koDef = {};
async function koDefLoad(head){
  let h = 0; for(const ch of head) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0;
  const n = (h % 1009) % KO_DEF_N;
  if(_koDef[n]) return _koDef[n];
  let txt = null;
  try{
    const db = await koDictIdb();
    txt = await new Promise(res => { const q = db.transaction('d').objectStore('d').get('def' + n); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  }catch(_){}
  if(!txt){
    let r = await fetch('krdict-def/' + n + '.json').catch(() => null);
    if(!r || !r.ok) r = await fetch(KO_DATA_ALT + 'krdict-def/' + n + '.json').catch(() => null);
    if(!r || !r.ok) throw new Error('def ' + (r ? r.status : 'network'));
    txt = await r.text();
    try{ const db = await koDictIdb(); db.transaction('d', 'readwrite').objectStore('d').put(txt, 'def' + n); }catch(_){}
  }
  _koDef[n] = JSON.parse(txt);
  return _koDef[n];
}
function koPickDef(i){
  const d = (window._koDefRows || [])[i]; if(!d) return;
  let m = koJaShort(d[0] || '').split('・').slice(0, 2).join('・');
  if(!m) m = (d[1] || '').replace(/。$/, '');
  if(!m) return;
  if(!_koWords[(document.getElementById('ko-key') || {}).value] && _koEdit.ms.length === 1 && _koEdit._auto) _koEdit.ms = [];
  koAddMeaning(m);
  _koEdit._auto = false;
  document.querySelectorAll('.ko-def-row').forEach((b, j) => b.classList.toggle('on', j === i));
}

/* ══════ 学習の記録（端末ごとに日別で数える → 同期で合わせる） ══════ */
const KO_STATS_LS = LS_PREFIX + 'ko-stats';
function koDeviceId(){
  const k = LS_PREFIX + 'device-id';
  let d = localStorage.getItem(k);
  if(!d){ d = Math.random().toString(36).slice(2) + Date.now().toString(36); try{ localStorage.setItem(k, d); }catch(_){} }
  return d;
}
function koStats(){ try{ return JSON.parse(localStorage.getItem(KO_STATS_LS) || '{}') || {}; }catch(_){ return {}; } }
function koDay(d){ d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function koStat(field){
  const all = koStats(), dev = koDeviceId(), day = koDay();
  all[dev] = all[dev] || {};
  const rec = all[dev][day] = all[dev][day] || {};
  rec[field] = (rec[field] || 0) + 1;
  try{ localStorage.setItem(KO_STATS_LS, JSON.stringify(all)); }catch(_){}
  koSyncSoon();
}
function koStatsByDay(){
  const all = koStats(), out = {};
  Object.values(all).forEach(days => Object.entries(days || {}).forEach(([day, r]) => {
    const o = out[day] = out[day] || { w: 0, r: 0, t: 0, n: 0 };
    o.w += r.w || 0; o.r += r.r || 0; o.t += r.t || 0; o.n += r.n || 0; o.c = (o.c || 0) + (r.c || 0);
  }));
  return out;
}
function koBarChart(title, days, field, unit){
  const vals = days.map(d => d.v[field] || 0);
  const max = Math.max(1, ...vals);
  const sum = vals.reduce((a, b) => a + b, 0);
  return `<div class="ko-chart">
    <div class="ko-chart-h"><span>${title}</span><span class="ko-chart-sum">14日で ${sum}${unit}</span></div>
    <div class="ko-chart-plot">
      <div class="ko-chart-grid"></div>
      ${days.map((d, i) => `<div class="ko-chart-col" title="${d.label}：${vals[i]}${unit}" onclick="this.parentNode.querySelectorAll('.ko-chart-col').forEach(c=>c.classList.remove('sel'));this.classList.add('sel')">
        <span class="ko-chart-val">${vals[i]}</span>
        <div class="ko-chart-bar" style="height:${vals[i] ? Math.max(4, Math.round(vals[i] / max * 100)) : 0}%"></div>
      </div>`).join('')}
    </div>
    <div class="ko-chart-x">${days.map((d, i) => `<span>${i % 2 === 0 || i === days.length - 1 ? d.short : ''}</span>`).join('')}</div>
  </div>`;
}
function openKoStats(){
  const byDay = koStatsByDay();
  const days = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = koDay(d);
    days.push({ key, v: byDay[key] || {}, label: `${d.getMonth() + 1}/${d.getDate()}`, short: `${d.getMonth() + 1}/${d.getDate()}` });
  }
  const w = koLoad();
  const total = Object.keys(w).length, learned = Object.values(w).filter(koIsLearned).length;
  let trs = 0; (state.library || []).forEach(n => { trs += Object.keys(n.koTr || {}).length; });
  if(state.novel && state.novel.koTr){ const idx = (state.library || []).findIndex(n => n.id === state.currentNovelId); if(idx < 0) trs += Object.keys(state.novel.koTr).length; }
  // 続けた日数（今日か昨日から、さかのぼって何か記録がある日）
  let streak = 0;
  for(let i = 0; i < 400; i++){
    const d = new Date(); d.setDate(d.getDate() - i);
    const v = byDay[koDay(d)];
    const any = v && (v.w || v.r || v.t || v.c);
    if(any) streak++; else if(i > 0) break;
  }
  document.getElementById('ko-sheet-body').innerHTML = `
    <div class="ko-title">学習の記録</div>
    <div class="ko-tiles">
      <div class="ko-tile"><div class="ko-tile-v">${total}</div><div class="ko-tile-l">登録した単語</div></div>
      <div class="ko-tile"><div class="ko-tile-v">${learned}</div><div class="ko-tile-l">覚えた単語</div></div>
      <div class="ko-tile"><div class="ko-tile-v">${trs}</div><div class="ko-tile-l">訳した段落</div></div>
      <div class="ko-tile"><div class="ko-tile-v">${streak}<small>日</small></div><div class="ko-tile-l">続けている</div></div>
    </div>
    ${koBarChart('読んだ文字数（韓国語）', days, 'c', '字')}
    ${koBarChart('登録した単語', days, 'w', '語')}
    ${koBarChart('訳した段落', days, 't', '段落')}
    ${koBarChart('復習した回数', days, 'r', '回')}
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="openKoMenu()">戻る</button></div>`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
}

/* ══════ 単語帳・記録をGoogleドライブで同期（本のデータとは別の小さいファイル） ══════ */
const KO_IS_BETA2 = typeof IS_BETA2 !== 'undefined' && IS_BETA2;
const KO_IS_BETA1 = typeof IS_BETA !== 'undefined' && IS_BETA;   // 試験版（作品の公開・共有）
const KO_DATA_ALT = (KO_IS_BETA2 || KO_IS_BETA1) ? '../' : 'beta2/';   // 辞書が見つからないときに探す場所
const KO_SYNC_FILE = KO_IS_BETA2 ? 'ko-data-beta2.json' : KO_IS_BETA1 ? 'ko-data-beta.json' : 'ko-data.json';
let _koSyncTimer = null, _koSyncing = null;
function koSyncSoon(){
  if(typeof gdriveIsSignedIn !== 'function' || !gdriveIsSignedIn()) return;
  clearTimeout(_koSyncTimer);
  _koSyncTimer = setTimeout(() => { koSyncWords().catch(e => console.warn('ko sync', e)); }, 5000);
}
function koMergeData(local, remote){
  const words = {}, del = {};
  const t = x => (x && (x.u || x.at)) || '';
  Object.entries(remote.del || {}).forEach(([k, v]) => { if(!del[k] || v > del[k]) del[k] = v; });
  Object.entries(local.del || {}).forEach(([k, v]) => { if(!del[k] || v > del[k]) del[k] = v; });
  new Set([...Object.keys(local.words || {}), ...Object.keys(remote.words || {})]).forEach(k => {
    const a = (local.words || {})[k], b = (remote.words || {})[k];
    let w = a && b ? (t(b) > t(a) ? b : a) : (a || b);
    if(del[k] && del[k] >= t(w)) return; // あとで消された
    words[k] = w;
    if(del[k]) delete del[k];             // 消したあとで登録し直した
  });
  // 古い削除の記録は捨てる
  const old = new Date(Date.now() - 180 * 864e5).toISOString();
  Object.keys(del).forEach(k => { if(del[k] < old) delete del[k]; });
  // 記録：端末×日ごとに大きい方
  const stats = JSON.parse(JSON.stringify(remote.stats || {}));
  Object.entries(local.stats || {}).forEach(([dev, days]) => {
    stats[dev] = stats[dev] || {};
    Object.entries(days || {}).forEach(([day, r]) => {
      const o = stats[dev][day] = stats[dev][day] || {};
      ['w', 'r', 't', 'n', 'c'].forEach(f => { o[f] = Math.max(o[f] || 0, r[f] || 0); });
    });
  });
  return { words, del, stats };
}
async function koDriveFind(name){
  await gdriveEnsureToken();
  const url = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=' + encodeURIComponent("name='" + (name || KO_SYNC_FILE) + "'");
  const data = await (await gdriveFetch(url)).json();
  return (data.files && data.files[0]) || null;
}
// 戻り値：ほかの端末の変更が入ったら true
async function koSyncWords(){
  if(typeof gdriveIsSignedIn !== 'function' || !gdriveIsSignedIn()) return false;
  if(_koSyncing) return _koSyncing;
  _koSyncing = (async () => {
    const file = await koDriveFind();
    let remote = {};
    if(file){
      try{ remote = await (await gdriveFetch('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media')).json() || {}; }catch(_){ remote = {}; }
    }else if(!KO_IS_BETA2 && !KO_IS_BETA1){
      // 本番で初めて同期するとき：β2で同期していた単語帳を引き継ぐ
      try{
        const bf = await koDriveFind('ko-data-beta2.json');
        if(bf) remote = await (await gdriveFetch('https://www.googleapis.com/drive/v3/files/' + bf.id + '?alt=media')).json() || {};
      }catch(_){ remote = {}; }
    }
    koLoad();
    const local = { words: _koWords, del: koDelMap(), stats: koStats() };
    const merged = koMergeData(local, remote);
    const gBefore = JSON.stringify(koGramAll());
    merged.gram = koGramMerge(koGramAll(), remote.gram || {});
    koGramSaveAll(merged.gram);
    const before = JSON.stringify(local.words), after = JSON.stringify(merged.words);
    const changedLocal = before !== after;
    _koWords = merged.words;
    koSaveWords(true);
    koSetDelMap(merged.del);
    try{ localStorage.setItem(KO_STATS_LS, JSON.stringify(merged.stats)); }catch(_){}
    const payload = { app: 'ikasumi-ko', version: 1, syncedAt: new Date().toISOString(), words: merged.words, del: merged.del, stats: merged.stats, gram: merged.gram };
    const remoteSame = file && JSON.stringify(remote.gram || {}) === JSON.stringify(merged.gram) && JSON.stringify(remote.words || {}) === after && JSON.stringify(remote.del || {}) === JSON.stringify(merged.del) && JSON.stringify(remote.stats || {}) === JSON.stringify(merged.stats);
    if(!remoteSame){
      const boundary = '-------ko-boundary-' + Date.now();
      const meta = { name: KO_SYNC_FILE, mimeType: 'application/json' };
      if(!file) meta.parents = ['appDataFolder'];
      const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + boundary +
        '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(payload) + '\r\n--' + boundary + '--';
      await gdriveFetch(file
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + file.id + '?uploadType=multipart'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        { method: file ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
    }
    if(changedLocal) koRerender();
    return changedLocal;
  })();
  try{ return await _koSyncing; } finally { _koSyncing = null; }
}
function setupKoSync(){
  koUpdateBadge();
  setTimeout(() => { koMigrateFromBeta2().catch(() => {}); }, 1200);
  setInterval(koUpdateBadge, 10 * 60 * 1000); // 日付が変わったとき用
  // 起動して少ししたら、ほかの端末の単語を取り込む
  setTimeout(() => koSyncWords().catch(e => console.warn('ko sync', e)), 3000);
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') koSyncWords().catch(() => {});
    else if(_koSyncTimer){ clearTimeout(_koSyncTimer); _koSyncTimer = null; koSyncWords().catch(() => {}); }
  });
}

function openKoSettings(){
  const m = koShowMode(), tm = koTrMode(), nw = koNewOn(), hl = koHideLearned(), np = koNewPerDay();
  const seg = (items, cur, fn) => `<div class="ko-seg">${items.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" onclick="${fn}(${JSON.stringify(v).replace(/"/g, "'")});openKoSettings()">${l}</button>`).join('')}</div>`;
  const pr = koTrProgress();
  document.getElementById('ko-sheet-body').innerHTML = `
    <div class="ko-title">表示の設定</div>
    <div class="ko-set">
      <div class="ko-set-l">単語の意味<small>登録した単語の上に出す意味</small></div>
      ${seg([['on', '表示'], ['hide', '隠す'], ['off', 'オフ']], m, 'koSetShowMode')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">自分の訳<small>${pr ? `この話 ${pr.done}/${pr.all}段落` : '段落の下に書く訳'}</small></div>
      ${seg([['write', '書く'], ['show', '表示'], ['off', '隠す'], ['only', '訳で読む']], tm, 'koSetTrMode')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">だんだん隠す<small>復習で正解した回数がこれ以上の単語は、意味を隠して点線だけに。タップで答え合わせ</small></div>
      ${seg([[0, 'オフ'], [2, '2回'], [3, '3回'], [5, '5回']], koFadeN(), 'koSetFadeN')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">単語を押したら発音<small>小説に書いてあるとおりの形で読みます（🔊ボタンは辞書の形）</small></div>
      ${seg([[true, 'オン'], [false, 'オフ']], koTapSpeakOn(), 'koSetTapSpeak')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">文法帳の☆<small>「〜ㅂ니다」「〜었다」のような、よく出る語尾にも☆を出すか</small></div>
      ${seg([[false, '出さない'], [true, '出す']], koGramBasicOn(), 'koSetGramBasic')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">単語を押したときの画面<small>かんたん：形・メモなどの欄を「くわしく」にたたむ</small></div>
      ${seg([[false, 'ぜんぶ'], [true, 'かんたん']], koSimpleOn(), 'koSetSimple')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">新しく登録した単語<small>本文に意味を出すか（単語ごとにも変えられます）</small></div>
      ${seg([[true, '出す'], [false, '単語帳だけ']], koShowNewDefault(), 'koSetShowNewDefault')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">未登録の単語<small>うすい黄色で目立たせる</small></div>
      ${seg([[true, '色付き'], [false, 'なし']], nw, 'koSetNew')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">覚えた単語<small>次の復習が3週間以上先の単語</small></div>
      ${seg([[true, '意味なし'], [false, '意味あり']], hl, 'koSetHideLearned')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">復習の向き<small>韓→日：韓国語を見て意味を思い出す</small></div>
      ${seg([['ko', '韓→日'], ['ja', '日→韓'], ['mix', '両方']], koCardDir(), 'koSetCardDir')}
    </div>
    <div class="ko-set">
      <div class="ko-set-l">新しい単語<small>1日に復習へ入れる数</small></div>
      ${seg([[5, '5'], [10, '10'], [20, '20'], [50, '50']], np, 'koSetNewPerDayUI')}
    </div>
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="openKoMenu()">戻る</button></div>`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
}
function koSetNewPerDayUI(n){ koSetNewPerDay(n); koUpdateBadge(); }

let _koTrPrev = 'show';
function koToggleTrOnly(){
  if(koTrMode() === 'only'){ koSetTrMode(_koTrPrev === 'only' ? 'show' : _koTrPrev); showToast('原文で表示しています'); }
  else{ _koTrPrev = koTrMode(); koSetTrMode('only'); showToast('自分の訳で表示しています（まだ訳していない段落はうすい原文）'); }
  koCloseSheet();
}
// 訳だけを書き出す：段落の位置は原文と同じ。訳していない段落は原文のまま、空行は空行のまま
function koExportTrOnly(){
  const ep = state.novel && state.novel.episodes.find(e => e.id === state.currentEpisodeId);
  if(!ep) return;
  const trs = state.novel.koTr || {};
  const out = [];
  let missing = 0;
  state.pages.forEach(pg => (pg.paras || []).forEach(para => {
    if(para.type !== 'text') return;
    const plain = koParaPlain(para);
    if(!plain.trim()){ out.push(''); return; }
    if(!KO_HANGUL.test(plain)){ out.push(plain); return; }
    const t = trs[koHash(plain)];
    if(t) out.push(t); else { out.push(plain); missing++; }
  }));
  const blob = new Blob([out.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (ep.title || '訳') + '_訳.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast(missing ? `書き出しました（まだ訳していない${missing}段落は原文のまま）` : '書き出しました');
}


/* ══════ 本番のクラウドから本を取り込む（読むだけ・本番のデータは変えない） ══════ */
async function koImportFromMain(){
  if(!gdriveIsSignedIn()){ gdriveSignIn(); return; }
  if(!confirm('本番（イカ墨ノベル）のクラウドにある本を、このβ2に取り込みますか？\n\n・本番のデータは変わりません（読むだけ）\n・同じ本がある場合は、新しい方にそろえます\n・β2で書いた訳・メモ・単語帳は消えません')) return;
  try{
    showToast('本番のクラウドを読み込み中...');
    await gdriveEnsureToken();
    const url = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=' + encodeURIComponent("name='novel-reader-data.json'");
    const list = await (await gdriveFetch(url)).json();
    const f = list.files && list.files[0];
    if(!f){ showToast('本番のクラウドにデータがありません（本番で一度「クラウドへ同期」してください）'); return; }
    const data = await (await gdriveFetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media')).json();
    const remote = (data && data.library) || [];
    let add = 0, upd = 0, keep = 0;
    for(const rn of remote){
      if(!rn || !rn.id) continue;
      const i = state.library.findIndex(n => n.id === rn.id);
      if(i < 0){ state.library.push(rn); await libDbPut(rn); add++; continue; }
      const ln = state.library[i];
      if((rn.updatedAt || '') > (ln.updatedAt || '')){
        const merged = Object.assign({}, rn, { koTr: ln.koTr, koNotes: ln.koNotes, koSense: ln.koSense }); // β2だけのデータは残す
        await autoBackup(ln, true, true).catch(() => {});
        state.library[i] = merged; await libDbPut(merged); upd++;
      }else keep++;
    }
    // 「無題の小説」だけの空の本棚なら、取り込んだ後は消す
    state.library = state.library.filter(n => !(n.title === '無題の小説' && remote.length && (n.episodes || []).length <= 1 && !n.koTr && !remote.some(r => r.id === n.id) && (n.episodes || []).every(e => (e.charCount || 0) < 200)));
    if(state.currentNovelId && !state.library.some(n => n.id === state.currentNovelId)){ state.currentNovelId = null; state.currentEpisodeId = null; }
    showLibrary();
    showToast(`追加${add}冊・更新${upd}冊・そのまま${keep}冊`);
    scheduleGdriveAutoSync();
  }catch(e){
    console.warn('koImportFromMain', e);
    showToast('取り込めませんでした：' + e.message);
  }
}

function koHi(sentence, key){
  const esc = escapeHtml(sentence);
  const ek = escapeHtml(key);
  return ek ? esc.split(ek).join(`<b>${ek}</b>`) : esc;
}
function koQuizBack(k, e, noMeans){
  const ms = koMs(e);
  const fav = Array.isArray(e.fav) && e.fav[0];
  const ctx = fav ? { c: fav.s } : ms.find(x => x.c);
  return (noMeans ? '' : `<div class="ko-quiz-ms">${ms.map(x => escapeHtml(x.m)).join('<span class="ko-dict-sep">／</span>')}</div>`)
    + (e.n ? `<div class="ko-quiz-n">${escapeHtml(e.n)}</div>` : '')
    + (ctx ? `<div class="ko-quiz-ctx" onclick="koSpeak(${JSON.stringify(ctx.c).replace(/"/g, '&quot;')})">${koHi(ctx.c, k)}</div>` : '<div class="ko-quiz-ctx" id="ko-quiz-use" hidden></div>');
}

/* ══════ よく出る未登録の単語（今の話から） ══════ */
function koFreqScan(){
  koLoad();
  const groups = {}, phrases = koPhraseList();
  let total = 0, known = 0;
  (state.pages || []).forEach(pg => (pg.paras || []).forEach(para => {
    if(para.type !== 'text') return;
    const plain = koParaPlain(para);
    // フレーズで登録した部分は「読める」として数え、単語の一覧からは外す
    let rest = plain;
    phrases.forEach(pp => {
      // 最後の語の活用部分（끄덕[였다]）まで含める
      const re = new RegExp(pp.re.source.slice(0, -1) + '[\\uAC00-\\uD7A3]*)', 'g');
      rest = rest.replace(re, (all, pre, body) => {
        const n = (body.match(KO_RUN) || []).length;
        total += n; known += n;
        return pre + ' '.repeat(body.length);
      });
    });
    (rest.match(KO_RUN) || []).forEach(run => {
      total++;
      if(koFindKey(run)){ known++; return; }
      const g = koCandidates(run).slice(-1)[0] || run;
      const o = groups[g] = groups[g] || { g, n: 0, forms: {}, sentence: plain };
      o.n++; o.forms[run] = (o.forms[run] || 0) + 1;
    });
  }));
  const list = Object.values(groups).sort((a, b) => b.n - a.n);
  return { total, known, list };
}
let _koFromFreq = false;
function openKoFreq(){
  const f = koFreqScan();
  const pct = f.total ? Math.round(f.known / f.total * 100) : 0;
  const top = f.list.slice(0, 40);
  window._koFreqRows = top;
  document.getElementById('ko-sheet-body').innerHTML = `
    <div class="ko-title">よく出る未登録の単語</div>
    <div class="ko-freq-cov">
      <div class="ko-freq-bar"><div style="width:${pct}%"></div></div>
      <div class="ko-freq-cov-t">この話で読める単語 <b>${pct}%</b>（${f.known}/${f.total}語）</div>
    </div>
    ${(() => { const nm = koNameScan(); window._koNameRows = nm; return nm.length ? `<div class="ko-label">人名かも？（辞書になくて、何回も出る語）</div>` + nm.map((r, i) =>
      `<div class="ko-name-row"><button class="ko-freq-row" onclick="koNamePick(${i})"><span class="ko-freq-w">${escapeHtml(r.b)}</span><span class="ko-freq-f">${escapeHtml(r.kana)}</span><span class="ko-freq-n">${r.n}回</span></button><button class="ko-name-no" onclick="koNameNo(${escapeHtml(JSON.stringify(r.b))})" title="人名じゃない">✕</button></div>`).join('') : ''; })()}
    <div class="ko-dict-msg" style="margin:8px 0 4px">上から登録すると、読める割合が早く上がります。タップで登録</div>
    ${top.length ? top.map((r, i) => {
      const sample = Object.entries(r.forms).sort((a, b) => b[1] - a[1])[0][0];
      return `<button class="ko-freq-row" onclick="koFreqPick(${i})"><span class="ko-freq-w">${escapeHtml(r.g)}</span><span class="ko-freq-f">${escapeHtml(Object.keys(r.forms).slice(0, 3).join('・'))}</span><span class="ko-freq-n">${r.n}回</span></button>`;
    }).join('') : '<div class="ko-empty">この話の単語は全部登録済みです！</div>'}
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="openKoMenu()">戻る</button></div>`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
}
function koFreqPick(i){
  const r = window._koFreqRows[i];
  if(!r) return;
  const sample = Object.entries(r.forms).sort((a, b) => b[1] - a[1])[0][0];
  koOpenSheet({ type: 'word', key: null, eojeol: sample, sentence: r.sentence, pi: -1, qi: -1, fromFreq: true });
}


/* ══════ 韓国語の本だけで使う（自動判定＋本ごとの設定） ══════ */
const _koDetectCache = {};
// 本の中にハングルがある程度あるか（最初の数話を見る）
function koKoRatio(eps, minKo, minRatio){
  let ko = 0, all = 0;
  for(const ep of eps){
    for(const pg of (ep.pages || [])){
      for(const pa of (pg.paras || [])){
        if(pa.type !== 'text') continue;
        const t = pa.text || '';
        for(const ch of t){ if(/\S/.test(ch)){ all++; if(KO_HANGUL.test(ch)) ko++; } }
        if(all > 4000) break;
      }
    }
  }
  return ko >= (minKo || 30) && ko / Math.max(1, all) >= (minRatio || 0.15);
}
function koNovelHasKo(n){
  if(!n) return false;
  const ck = n.id + '|' + (n.updatedAt || '') + '|' + ((n.episodes || []).length);
  if(_koDetectCache[ck] != null) return _koDetectCache[ck];
  const r = koKoRatio((n.episodes || []).slice().sort((a, b) => a.number - b.number).slice(0, 5));
  _koDetectCache[ck] = r;
  return r;
}
// 今開いている話が韓国語か（日本語の本に韓国語の話を足したとき用）
function koEpisodeHasKo(){
  if(!state.currentEpisodeId || !state.pages) return false;
  const ck = 'ep|' + state.currentEpisodeId + '|' + (state.pages[0] && (state.pages[0].paras || []).length);
  if(_koDetectCache[ck] != null) return _koDetectCache[ck];
  return (_koDetectCache[ck] = koKoRatio([{ pages: state.pages }], 8, 0.3));
}
function koNovelMode(n){ n = n || state.novel; return (n && n.koMode) || 'auto'; }
// 今開いている本で韓国語メモを使うか
function koEnabled(){
  if(!state.currentNovelId || !state.novel) return false;
  const m = koNovelMode();
  if(m === 'on') return true;
  if(m === 'off') return false;
  return koNovelHasKo(state.novel) || koEpisodeHasKo();
}
function koApplyVisibility(){
  const on = koEnabled();
  const btn = document.getElementById('topbar-ko');
  if(btn) btn.style.display = on ? '' : 'none';
  document.body.classList.toggle('ko-on', on);
  koRenderPanelRow();
  koUpdateLibReview();
}
function koSetNovelMode(v){
  if(!state.novel) return;
  if(v === 'auto') delete state.novel.koMode; else state.novel.koMode = v;
  koPersistNovel();
  koApplyVisibility();
  koRerender();
}
// 設定パネル（歯車）の「韓国語メモ」
function koRenderPanelRow(){
  const box = document.getElementById('ko-panel-row');
  if(!box) return;
  // 設定パネルのいちばん下に置く（日本語の本では邪魔にならないように）
  const pb = document.getElementById('panel-body');
  if(pb && pb.lastElementChild !== box) pb.appendChild(box);
  if(!state.currentNovelId){ box.style.display = 'none'; return; }
  box.style.display = '';
  const m = koNovelMode();
  const auto = koNovelHasKo(state.novel);
  box.querySelectorAll('.ob').forEach(b => b.classList.toggle('active', b.dataset.v === m));
  const hint = box.querySelector('.ko-panel-hint');
  if(hint) hint.textContent = m === 'auto' ? (auto ? '韓国語の本と判定：「한」ボタンを出しています' : '日本語の本と判定：「한」ボタンを出していません') : '';
}
// 本棚の「今日の復習」
function koUpdateLibReview(){
  const b = document.getElementById('lib-ko-review');
  if(!b) return;
  const cnt = Object.keys(koLoad()).length;
  if(!cnt){ b.style.display = 'none'; return; }
  const n = koReviewCounts().total;
  b.style.display = '';
  b.classList.toggle('done', !n);
  b.querySelector('.n').textContent = n ? n : '✓';
}
function openKoFromLibrary(){
  openKoMenu();
}

/* ── 単語帳に入る形（見出し）と、本文で探すほかの形 ── */
let _koHeadAuto = true, _koForms = [];
// 辞書がまだ無いときの見出しの推測：動詞・形容詞っぽければ「語幹＋다」
function koGuessHead(key, eojeol){
  if(!key || /\s/.test(key)) return key;
  if(_koDict){
    const found = koDictLookup(eojeol || key);
    if(found.length) return found[0].head;
    if(_koDict[key]) return key;
    if(_koDict[key + '다']) return key + '다';
  }
  const rest = (eojeol || '').slice(key.length);
  if(rest && KO_VERB_REST.some(e => rest.startsWith(e)) && !KO_PARTICLES.includes(rest)) return key + '다';
  return key;
}
function koSetHead(h){
  const el = document.getElementById('ko-headw');
  if(el && h){ el.value = h; }
}
function koRenderForms(){
  const box = document.getElementById('ko-forms');
  if(!box) return;
  box.innerHTML = _koForms.length ? _koForms.map((f, i) => `<span class="ko-form">${escapeHtml(f)}<button onclick="_koForms.splice(${i},1);koRenderForms()">✕</button></span>`).join('') : '<span class="ko-dict-msg">なし</span>';
}
function koAddForm(){
  const inp = document.getElementById('ko-form-in');
  const f = (inp.value || '').trim();
  if(!f || !KO_HANGUL.test(f)) return;
  if(f !== document.getElementById('ko-key').value.trim() && !_koForms.includes(f)) _koForms.push(f);
  inp.value = '';
  koRenderForms();
}
// 見出しがまだ無い単語に、辞書で見出しを付ける（前のバージョンで登録した単語）
async function koMigrateHeads(){
  const w = koLoad();
  const need = Object.keys(w).filter(k => !w[k].h);
  if(!need.length) return false;
  try{ await koDictLoad(); }catch(_){ return false; }
  need.forEach(k => {
    const e = w[k];
    let h = null;
    const mm = (e.n || '').match(/^([가-힣]+다)\s/); // 辞書から選んだときのメモ「짓다 動」
    if(/\s/.test(k)) h = k;
    else if(mm && (mm[1].startsWith(k) || _koDict[mm[1]])) h = mm[1];
    else if(_koDict[k] && _koDict[k + '다']){
      // 名詞と動詞の両方ある語：意味が動詞っぽい（〜る・〜い・〜だ）なら動詞
      h = /[るいだ]$/.test((e.m || '').split(/[・、／]/)[0]) ? k + '다' : k;
    }
    else if(_koDict[k]) h = k;
    else if(_koDict[k + '다']) h = k + '다';
    else h = k;
    e.h = h; // 同じ計算をほかの端末でもするので、更新時刻は変えない
  });
  koSaveWords(true);
  return true;
}


/* ══════ 本番：β2で使っていたデータを引き継ぐ（1回だけ） ══════
   同じサイト（ikazu23.github.io）なので、β2の保存場所もこの端末から読める */
// β2の本を本番の本棚に合わせる：同じ本は訳・メモ・場所ごとの意味だけ足す（本番で書いたものが優先）、β2にしか無い本は追加
async function koMergeBeta2Novels(novels){
  let added = 0, merged = 0;
  for(const bn of novels || []){
    if(!bn || !bn.id) continue;
    const has = ['koTr', 'koNotes', 'koSense'].some(f => bn[f] && Object.keys(bn[f]).length) || bn.koMode;
    const i = state.library.findIndex(n => n.id === bn.id);
    if(i >= 0){
      if(!has) continue;
      const n = state.library[i];
      const before = JSON.stringify([n.koTr, n.koNotes, n.koSense, n.koMode]);
      ['koTr', 'koNotes', 'koSense'].forEach(f => { if(bn[f]) n[f] = Object.assign({}, bn[f], n[f] || {}); });
      if(bn.koMode && !n.koMode) n.koMode = bn.koMode;
      if(JSON.stringify([n.koTr, n.koNotes, n.koSense, n.koMode]) === before) continue;
      await libDbPut(n).catch(() => {});
      if(state.novel && state.novel.id === n.id) ['koTr', 'koNotes', 'koSense', 'koMode'].forEach(f => { state.novel[f] = n[f]; });
      merged++;
    }else if(bn.title !== '無題の小説' || has){
      state.library.push(bn);
      await libDbPut(bn).catch(() => {});
      added++;
    }
  }
  return { added, merged };
}
// 本番：β2のクラウド（Googleドライブ）から引き継ぐ。アプリとウェブで保存場所が違うときや、別の端末から
async function koImportFromBeta2Cloud(){
  if(KO_IS_BETA2 || KO_IS_BETA1) return;
  if(typeof gdriveIsSignedIn !== 'function' || !gdriveIsSignedIn()){ showToast('先にGoogleドライブにログインしてください'); try{ gdriveSignIn(); }catch(_){} return; }
  if(!confirm('お試し版（β2）のクラウドにある単語帳・訳・メモ・本を、本番に引き継ぎますか？\n\n・先にβ2で「クラウドへ同期」しておいてください\n・本番のデータは消えません（足すだけ）\n・両方にある本は、本文はそのままで訳・メモだけ足します\n・何回やっても、同じ単語や本が2つにはなりません')) return;
  try{
    showToast('β2のクラウドを読み込み中...');
    await gdriveEnsureToken();
    const get = async name => { const f = await koDriveFind(name); return f ? await (await gdriveFetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media')).json() : null; };
    const kd = await get('ko-data-beta2.json').catch(() => null);
    const nd = await get('novel-reader-data-beta2.json').catch(() => null);
    if(!kd && !nd){ showToast('β2のクラウドにデータがありません（β2で一度「クラウドへ同期」してください）'); return; }
    let words = 0;
    if(kd && kd.words){
      koLoad();
      const beforeN = Object.keys(_koWords).length, before = JSON.stringify(_koWords);
      const m = koMergeData({ words: _koWords, del: koDelMap(), stats: koStats() }, kd);
      _koWords = m.words; koSaveWords(true); koSetDelMap(m.del);
      try{ localStorage.setItem(KO_STATS_LS, JSON.stringify(m.stats)); }catch(_){}
      words = Math.max(0, Object.keys(_koWords).length - beforeN);
      if(JSON.stringify(_koWords) !== before && !words) words = -1; // 数は同じでも中身が変わった
    }
    const r = await koMergeBeta2Novels((nd && nd.library) || []);
    try{ localStorage.setItem('ko-migrated-beta2', '1'); }catch(_){}
    if(!state.currentNovelId) try{ renderLibrary(); }catch(_){}
    koUpdateBadge(); koRerender();
    try{ await koSyncWords(); }catch(_){}
    try{ scheduleGdriveAutoSync(); }catch(_){}
    const parts = [];
    if(words > 0) parts.push(`単語${words}語`); else if(words < 0) parts.push('単語帳を更新');
    if(r.added) parts.push(`本${r.added}冊を追加`);
    if(r.merged) parts.push(`${r.merged}冊に訳・メモを追加`);
    showToast(parts.length ? '引き継ぎました：' + parts.join('・') : '新しく引き継ぐものはありませんでした');
  }catch(e){
    console.warn('koImportFromBeta2Cloud', e);
    showToast('引き継げませんでした：' + e.message);
  }
}
async function koMigrateFromBeta2(){
  if(KO_IS_BETA2 || KO_IS_BETA1) return;
  if(localStorage.getItem('ko-migrated-beta2') === '1') return;
  let moved = 0;
  try{
    // 単語帳・記録・設定
    const bw = JSON.parse(localStorage.getItem('beta2-ko-words') || 'null');
    if(bw && Object.keys(bw).length){
      koLoad();
      const merged = koMergeData({ words: _koWords, del: koDelMap(), stats: koStats() },
        { words: bw, del: JSON.parse(localStorage.getItem('beta2-ko-words-del') || '{}'), stats: JSON.parse(localStorage.getItem('beta2-ko-stats') || '{}') });
      _koWords = merged.words; koSaveWords(true); koSetDelMap(merged.del);
      try{ localStorage.setItem(KO_STATS_LS, JSON.stringify(merged.stats)); }catch(_){}
      moved += Object.keys(bw).length;
    }
    ['ko-show', 'ko-new', 'ko-tr-mode', 'ko-hide-learned', 'ko-new-per-day', 'ko-card-dir', 'ko-show-new', 'ko-fade', 'ko-tap-speak', 'ko-simple'].forEach(k => {
      const v = localStorage.getItem('beta2-' + k);
      if(v != null && localStorage.getItem(k) == null) try{ localStorage.setItem(k, v); }catch(_){}
    });
    // 本ごとの訳・メモ・場所ごとの意味（β2の本棚から）
    const novels = await new Promise(res => {
      let created = false;
      const rq = indexedDB.open('novel-reader-db-beta2');
      rq.onupgradeneeded = () => { created = true; try{ rq.transaction.abort(); }catch(_){} };
      rq.onerror = () => res([]);
      rq.onsuccess = () => {
        const db = rq.result;
        if(created || !db.objectStoreNames.contains(DB_LIBRARY_STORE)){ db.close(); res([]); return; }
        const q = db.transaction(DB_LIBRARY_STORE).objectStore(DB_LIBRARY_STORE).getAll();
        q.onsuccess = () => { res(q.result || []); db.close(); };
        q.onerror = () => { res([]); db.close(); };
      };
    });
    const r = await koMergeBeta2Novels(novels);
    moved += r.added + r.merged;
  }catch(e){ console.warn('koMigrateFromBeta2', e); return; }
  try{ localStorage.setItem('ko-migrated-beta2', '1'); }catch(_){}
  if(moved){
    if(!state.currentNovelId) try{ renderLibrary(); }catch(_){}
    koUpdateBadge();
    showToast('お試し版（β2）の単語帳・訳・メモを引き継ぎました');
  }
}

/* ══════ この形の意味（語尾の説明） ══════ */
// 語尾（つなげた形でも探す）。d=説明、j=「〜する」の変わり方、a=名詞の前
const KO_END_TABLE = {
  '었습니다': ['〜しました（かたい）', 'しました'], '었어요': ['〜しました', 'しました'],
  '었다는': ['〜したという', 'したという', 1], '었다고': ['〜したと', 'したと'], '었다가': ['〜してから（途中で）', 'してから'],
  '었다': ['〜した', 'した'], '었어': ['〜した（くだけた）', 'した'], '었지': ['〜したよね・〜したでしょ', 'したでしょ'],
  '었던': ['〜していた・〜した（名詞の前）', 'していた', 1], '었는데': ['〜したけど・〜したのに', 'したけど'],
  '었지만': ['〜したけど', 'したけど'], '었고': ['〜して・〜したし', 'して'], '었으면': ['〜したら', 'したら'],
  '었을': ['〜した（だろう）（名詞の前）', null, 1], '었으니': ['〜したから', 'したから'], '었': ['過去（〜た）', null],
  '겠습니다': ['〜します（かたい・意志）', 'します'], '겠다': ['〜するつもりだ・〜しそうだ', null], '겠': ['〜するつもり・〜だろう', null],
  'ㅂ니다': ['〜します（かたい）', 'します'], 'ㅂ니까': ['〜しますか（かたい）', 'しますか'],
  '어요': ['〜します（ていねい）', 'します'], '세요': ['〜してください・〜なさいます', 'してください'], '시': ['尊敬（お〜になる）', null],
  'ㄴ다고': ['〜すると（言う・思う）', 'すると'], '는다고': ['〜すると（言う・思う）', 'すると'], '다고': ['〜だと（言う・思う）', null],
  '라고': ['〜しろと（命令を伝える）', 'しろと'], '라는': ['〜しろという', 'しろという'], '자고': ['〜しようと', 'しようと'], '냐고': ['〜かと（聞く）', 'かと'], '느냐고': ['〜かと（聞く）', 'かと'],
  'ㄴ다': ['〜する（書き言葉）', 'する'], '는다': ['〜する（書き言葉）', 'する'],
  '는가': ['〜するのか・〜か（問いかけ・かたい）', 'するのか'], 'ㄴ가': ['〜なのか・〜か（問いかけ）', null], '나요': ['〜ですか・〜ますか', null],
  '어본': ['〜してみた・〜したことのある（名詞の前）', 'してみた', 1], '어보는': ['〜してみる（名詞の前）', 'してみる', 1], '어볼': ['〜してみる（これから・名詞の前）', 'してみる', 1],
  '어봤던': ['〜してみた（名詞の前）', 'してみた', 1], '어봤다': ['〜してみた', 'してみた'], '어봤어': ['〜してみた（くだけた）', 'してみた'], '어봤어요': ['〜してみました', 'してみました'],
  '어봤는데': ['〜してみたけど', 'してみたけど'], '어봤지만': ['〜してみたけど', 'してみたけど'], '어봤자': ['〜してみたところで', 'してみたところで'],
  '어보다': ['〜してみる', 'してみる'], '어봐요': ['〜してみてください・〜してみます', 'してみてください'], '어봐': ['〜してみて・〜してみる（くだけた）', 'してみて'],
  '어보세요': ['〜してみてください', 'してみてください'],
  '어주다': ['〜してあげる・〜してくれる', 'してあげる'], '어준': ['〜してくれた・〜してあげた（名詞の前）', 'してくれた', 1], '어주는': ['〜してくれる（名詞の前）', 'してくれる', 1],
  '어줄': ['〜してあげる（これから・名詞の前）', 'してあげる', 1], '어줄게': ['〜してあげるね', 'してあげるね'], '어줘요': ['〜してください', 'してください'], '어줘': ['〜してくれ・〜してあげて', 'してくれ'],
  '어주세요': ['〜してください', 'してください'], '어줬던': ['〜してくれた（名詞の前）', 'してくれた', 1], '어줬다': ['〜してくれた・〜してあげた', 'してくれた'], '어줬어': ['〜してくれた（くだけた）', 'してくれた'],
  '어주고': ['〜してあげて・〜してくれて', 'してあげて'], '어주면': ['〜してくれたら', 'してくれたら'], '어주겠다': ['〜してやる', 'してやる'], '어주지': ['〜してあげない（否定の前）・〜してくれよ', null],
  '어버리다': ['〜してしまう', 'してしまう'], '어버린': ['〜してしまった（名詞の前）', 'してしまった', 1], '어버리는': ['〜してしまう（名詞の前）', 'してしまう', 1], '어버릴': ['〜してしまう（これから・名詞の前）', 'してしまう', 1],
  '어버렸던': ['〜してしまった（名詞の前）', 'してしまった', 1], '어버렸다': ['〜してしまった', 'してしまった'], '어버렸어': ['〜してしまった（くだけた）', 'してしまった'], '어버려': ['〜してしまえ・〜してしまう', 'してしまえ'],
  '어버리고': ['〜してしまって', 'してしまって'], '어버리면': ['〜してしまえば', 'してしまえば'],
  '지도': ['〜しも（〜しない）', null],
  '곤': ['〜したりする（くり返し・〜하곤 했다）', null], '고서야': ['〜しなくては・〜でなければ', null], 'ㄴ들': ['〜したとしても', null], '거든': ['〜なんだよ（理由）・〜したら', null], '거든요': ['〜なんですよ（理由）', null],
  '다니까': ['〜だってば', null], '다니까요': ['〜ですってば', null], '라면': ['〜なら（아니라면＝〜でないなら）', null], '길래': ['〜するから・〜なので', null],
  '어달라는': ['〜してくれという', null], '어달라고': ['〜してくれと', null], '어달라': ['〜してくれ（と）', null], '어줬었다': ['〜してくれていた（過去）', null],
  '었던가': ['〜したっけ・〜だったか', null], '던가': ['〜だったっけ', null], '었으나': ['〜したが', 'したが'], 'ㄹ까봐': ['〜するかと思って・〜しそうで', null], '답시고': ['〜するとか言って', null],
  '질': ['〜しは（＝지를）', null], '어봤지': ['〜してみたさ・〜してみたよね', null], '어봤': ['〜してみた', null],
  '어드리다': ['〜して差し上げる', null], '어드리': ['〜して差し上げる', null], '어드릴까': ['〜して差し上げようか', null], '어드릴게요': ['〜して差し上げますね', null], '어드립니다': ['〜いたします', null],
  '어드려요': ['〜いたします', null], '어드렸다': ['〜して差し上げた', null], '어드리겠습니다': ['〜いたします', null], '어드린': ['〜して差し上げた（名詞の前）', null, 1], '어드리려고': ['〜して差し上げようと', null],
  '어간다': ['〜していく', null], '어간다는': ['〜していくという', null], '어가는': ['〜していく（名詞の前）', null, 1], '어갔다': ['〜していった', null], '어갈': ['〜していく（これから・名詞の前）', null, 1],
  '고선': ['〜してからは・〜しては', 'してから'], '어선': ['〜しては（＝어서는）', null],
  '거예요': ['〜でしょう・〜するつもりです（ㄹ 거예요）', null], '거야': ['〜だろう・〜するつもりだ（ㄹ 거야）', null], '거다': ['〜だろう・〜するつもりだ（ㄹ 거다）', null], '거지': ['〜だろう？（ㄹ 거지）', null],
  '진': ['〜しは（＝지는）', null], '지는': ['〜しは（〜しない）', null], '긴': ['〜することは（＝기는）', null], '기는': ['〜することは', null],
  '게도': ['〜なことに・〜にも', null], '는지도': ['〜するのかも', null], '는다든가': ['〜するとか', null], 'ㄴ다든가': ['〜するとか', null], '다든가': ['〜とか', null], '든가': ['〜とか', null],
  '려던': ['〜しようとしていた（名詞の前）', 'しようとしていた', 1], '려나': ['〜するのかな', null], '려': ['〜しようと', 'しようと'], '기까지': ['〜するまで', 'するまで'], '기가': ['〜することが', 'することが'],
  '어지다': ['〜される・〜になる', 'される'], '어진': ['〜された・〜になった（名詞の前）', 'された', 1], '어지는': ['〜される（名詞の前）', 'される', 1], '어질': ['〜される（これから・名詞の前）', 'される', 1],
  '어졌던': ['〜された（名詞の前）', 'された', 1], '어졌는데': ['〜できたのに・〜されたけど（過去）', null], '어졌지만': ['〜されたけど（過去）', null], '어졌고': ['〜されて（過去）', null],
  '어졌어요': ['〜されました・〜できました（過去）', null], '어졌습니다': ['〜されました（過去）', null], '어졌어': ['〜された（くだけた・過去）', null], '어졌으니까': ['〜されたから（過去）', null], '어지는데': ['〜できるけど・〜されるけど', null], '어졌다': ['〜された・〜になった', 'された'], '어져서': ['〜されて・〜になって', 'されて'], '어져': ['〜されて・〜になって', 'されて'], '어지고': ['〜されて', 'されて'],
  '어주': ['〜してくれる・〜してあげる', null], '어보': ['〜してみる', null], '어버리': ['〜してしまう', null], '어가': ['〜していく', null], '어오': ['〜してくる', null],
  '어온': ['〜してきた（名詞の前）', 'してきた', 1], '어왔던': ['〜してきた（名詞の前）', 'してきた', 1], '어왔다': ['〜してきた', 'してきた'], '어있': ['〜している（状態）', null],
  '어둬': ['〜しておいて', 'しておいて'], '어둔': ['〜しておいた（名詞の前）', 'しておいた', 1], '어뒀다': ['〜しておいた', 'しておいた'], '어두다': ['〜しておく', 'しておく'],
  '어놓은': ['〜しておいた（名詞の前）', 'しておいた', 1], '어놨다': ['〜しておいた', 'しておいた'], '어놓다': ['〜しておく', 'しておく'],
  '어야겠다': ['〜しなくちゃ', 'しなくちゃ'], '야겠다': ['〜しなくちゃ・〜しよう', 'しなくちゃ'], '었어야': ['〜すべきだった', 'すべきだった'], '잖습니까': ['〜じゃないですか（かたい）', null],
  '는구나': ['〜するんだなあ・〜なんだね', null], '는군요': ['〜するんですね', null], '는군': ['〜するんだな', null], '군요': ['〜ですね・〜なんですね', null],
  'ㄴ대요': ['〜するんだって（ていねい）', null], 'ㄴ대': ['〜するんだって', null], '는대요': ['〜するんだって（ていねい）', null], '는대': ['〜するんだって', null],
  '대요': ['〜だって（ていねい）', null], '래요': ['〜しろって・〜だって（ていねい）', null], 'ㄹ래요': ['〜します（つもり）・〜しますか', null], 'ㄹ래': ['〜する（つもり）・〜する？', null],
  '더니': ['〜したら・〜していたが', null], '더라고': ['〜していたんだよ（見聞きしたこと）', null], '더라': ['〜していたよ（見聞きしたこと）', null], '더군': ['〜していたなあ', null], '던데': ['〜していたけど', null],
  '기로': ['〜することに', 'することに'], '기에': ['〜するので・〜するには', 'するので'], '기도': ['〜することも', 'することも'], '기를': ['〜することを', 'することを'], '길': ['〜することを', 'することを'],
  'ㄹ수록': ['〜するほど', 'するほど'], 'ㄹ지도': ['〜するかもしれない', null], 'ㄹ지': ['〜するかどうか・〜するのか', null],
  '었으니까': ['〜したから', 'したから'], '었을까': ['〜しただろうか', 'しただろうか'], '었음': ['〜したこと・〜した（メモ書き）', 'したこと'],
  '십시오': ['〜してください（かたい）', 'してください'], '므로': ['〜するので', 'するので'], '든지': ['〜しようが・〜でも', null], '든': ['〜しようが・〜でも', null],
  '느라고': ['〜していて（そのせいで）', 'していて'], '느라': ['〜していて（そのせいで）', 'していて'], '잖아요': ['〜じゃないですか', null], '잖아': ['〜じゃないか・〜でしょ', null],
  '려면': ['〜するには・〜しようとするなら', 'するには'], '고서': ['〜してから', 'してから'], '고는': ['〜しては・〜してからは', 'しては'],
  '면서도': ['〜しながらも', 'しながらも'], '었다니': ['〜したなんて', 'したなんて'], '다니': ['〜するなんて', 'するなんて'], '어보고': ['〜してみて', 'してみて'], '어보면': ['〜してみると', 'してみると'], '어보니': ['〜してみたら', 'してみたら'],
  '어볼까': ['〜してみようか', 'してみようか'], '어보자': ['〜してみよう', 'してみよう'], '어보기': ['〜してみること', 'してみること'], '어보려고': ['〜してみようと', 'してみようと'],
  '는데': ['〜するけど・〜するのに', 'するけど'], '는지': ['〜するのか', 'するのか'],
  '는': ['〜する（名詞の前・いま）', 'する', 1],
  'ㄴ데': ['〜けど・〜のに', null], 'ㄴ지': ['〜したのか・〜なのか', null],
  'ㄴ': ['〜した（名詞の前・過去）', 'した', 1],
  'ㄹ까': ['〜しようか・〜だろうか', 'しようか'], 'ㄹ게': ['〜するね（約束）', 'するね'], 'ㄹ': ['〜する（これから・名詞の前）', 'する', 1],
  '던': ['〜していた（名詞の前）', 'していた', 1],
  '고': ['〜して・〜くて', 'して'], '어서': ['〜して・〜なので', 'して'], '어도': ['〜しても', 'しても'],
  '어야': ['〜しないと・〜してこそ（うしろに 하다 で「〜しなければならない」）', 'しないと'], '어라': ['〜しろ', 'しろ'], '어': ['〜して・〜する（くだけた）', 'して'],
  '면서': ['〜しながら', 'しながら'], '며': ['〜しながら・〜して', 'しながら'], '면': ['〜すれば・〜したら', 'すれば'],
  '니까': ['〜するから・〜したら', 'するから'], '지만': ['〜けど', 'するけど'], '지요': ['〜でしょう', null], '죠': ['〜でしょう', null],
  '지': ['〜（うしろの 않다・못하다 と合わせて「〜ない」）・〜でしょ', null], '게': ['〜く・〜ように', 'するように'], '도록': ['〜するように', 'するように'],
  '기': ['〜すること', 'すること'], 'ㅁ': ['〜すること', 'すること'],
  '자마자': ['〜するやいなや', 'するやいなや'], '자': ['〜しよう・〜するとすぐ', 'しよう'],
  '려고': ['〜しようと', 'しようと'], '러': ['〜しに', 'しに'], '거나': ['〜したり', 'したり'], '다가': ['〜していて（途中で）', 'していて'],
  '듯': ['〜するように', 'するように'], '다': ['言い切り（〜する）', 'する'],
  '네': ['〜だね・〜するね', null], '군': ['〜だなあ', null], '구나': ['〜だなあ', null],
  '냐': ['〜か？', null], '니': ['〜の？', null], '나': ['〜の？・〜か', null], '요': ['ていねい（〜です・〜ます）', null]
};
// 었（過去）が入った語尾は、説明に「（過去）」を付ける
Object.keys(KO_END_TABLE).forEach(k => { const v = KO_END_TABLE[k]; if(v && /[었았였]/.test(k) && !/過去/.test(v[0])) v[0] += '（過去）'; });
// 形容詞のときは意味が変わるもの
const KO_END_ADJ = { 'ㄴ': ['〜い・〜な（名詞の前）', null, 1], 'ㄴ다': null, '는다': null, 'ㄴ데': ['〜けど・〜のに', null],
  'ㅂ니다': ['〜です（かたい）', 'です'], 'ㅂ니까': ['〜ですか（かたい）', null], '어요': ['〜です（ていねい）', 'です'], '어': ['〜だ・〜くて（くだけた）', null],
  '어서': ['〜くて・〜なので', null], '는': ['〜な・〜い（名詞の前）', null, 1], '는데': ['〜けど・〜のに', null], '는가': ['〜のか・〜か（問いかけ）', null],
  '었습니다': ['〜でした（かたい・過去）', null], '었어요': ['〜でした（過去）', null], '었다': ['〜だった（過去）', null], '었어': ['〜だった（くだけた・過去）', null],
  '었던': ['〜だった（名詞の前・過去）', null, 1], '었으니까': ['〜だったから（過去）', null], '었으니': ['〜だったから（過去）', null], '었는데': ['〜だったけど（過去）', null],
  '었지만': ['〜だったけど（過去）', null], '었고': ['〜で（あって）（過去）', null], '었을': ['〜だった（だろう）（名詞の前・過去）', null, 1], '었으면': ['〜だったら（過去）', null], '겠다': ['〜だろう・〜そうだ', null], '네요': ['〜ですね', null], '세요': ['〜でいらっしゃいます', null] };
// 名詞のうしろ（助詞など）。j=日本語でそのまま付けられる形
const KO_PART_TABLE = {
  '은': ['〜は', 'は'], '는': ['〜は', 'は'], '이': ['〜が', 'が'], '가': ['〜が', 'が'], '을': ['〜を', 'を'], '를': ['〜を', 'を'],
  '에': ['〜に', 'に'], '에서': ['〜で・〜から', 'で'], '에게': ['〜に（人）', 'に'], '한테': ['〜に（人）', 'に'], '께': ['〜に（尊敬）', 'に'],
  '에게서': ['〜から（人）', 'から'], '한테서': ['〜から（人）', 'から'], '의': ['〜の', 'の'], '도': ['〜も', 'も'], '만': ['〜だけ', 'だけ'],
  '과': ['〜と', 'と'], '와': ['〜と', 'と'], '하고': ['〜と', 'と'], '랑': ['〜と', 'と'], '이랑': ['〜と', 'と'],
  '로': ['〜で・〜へ', 'で'], '으로': ['〜で・〜へ', 'で'], '로서': ['〜として', 'として'], '으로서': ['〜として', 'として'],
  '로써': ['〜によって', 'によって'], '으로써': ['〜によって', 'によって'], '까지': ['〜まで', 'まで'], '부터': ['〜から', 'から'],
  '처럼': ['〜のように', 'のように'], '보다': ['〜より', 'より'], '마저': ['〜さえ', 'さえ'], '조차': ['〜さえ', 'さえ'],
  '밖에': ['〜しか', 'しか'], '이나': ['〜や・〜でも・（数のあと）〜も', 'や'], '나': ['〜や・〜でも・（数のあと）〜も', 'や'], '께서': ['〜が（尊敬）', 'が'],
  '들': ['〜たち', 'たち'], '님': ['〜さん・〜様', 'さん'], '씨': ['〜さん', 'さん'],
  '적': ['〜的', '的'], '적인': ['〜的な', '的な'], '적으로': ['〜的に', '的に'], '적이다': ['〜的だ', '的だ'],
  '이다': ['〜だ', 'だ'], '다': ['〜だ', 'だ'], '입니다': ['〜です', 'です'], '이에요': ['〜です', 'です'], '예요': ['〜です', 'です'],
  '이야': ['〜だよ', 'だよ'], '야': ['〜だよ', 'だよ'], '인': ['〜である（名詞の前）', null], '이라는': ['〜という', 'という'], '라는': ['〜という', 'という'],
  '서': ['〜で（＝에서）', 'で'], '에선': ['〜では', 'では'], '엔': ['〜には（＝에는）', 'には'], '께선': ['〜は（尊敬）', 'は'],
  '한텐': ['〜には（人）', 'には'], '부턴': ['〜からは', 'からは'], '끼리': ['〜同士で', '同士で'], '마다': ['〜ごとに', 'ごとに'], '같이': ['〜のように', 'のように'],
  '답게': ['〜らしく', 'らしく'], '측': ['〜側', '側'], '분': ['〜さん（ていねい）', 'さん'], '쯤': ['〜くらい・〜ごろ', 'くらい'], '뿐': ['〜だけ', 'だけ'],
  '대로': ['〜のとおり・〜のままに', 'のとおり'], '만큼': ['〜ほど', 'ほど'], '이라도': ['〜でも', 'でも'], '라도': ['〜でも', 'でも'], '이고': ['〜で・〜だし', 'で'],
  '인데요': ['〜なんですけど', null], '인데': ['〜なんだけど', 'なんだけど'], '인지': ['〜なのか', 'なのか'], '인가요': ['〜なんですか', 'なんですか'], '인가': ['〜なのか', 'なのか'],
  '인건가': ['〜なのかな', null], '이라서': ['〜なので', 'なので'], '라서': ['〜なので', 'なので'], '이라': ['〜なので・〜だから', null], '라': ['〜なので・〜だから', null],
  '이라면': ['〜なら', 'なら'], '라면': ['〜なら', 'なら'], '이면': ['〜なら', 'なら'], '이라니': ['〜だなんて', 'だなんて'], '라니': ['〜だなんて', 'だなんて'],
  '이잖아': ['〜じゃないか', null], '잖아': ['〜じゃないか', null], '이었으나': ['〜だったが', 'だったが'], '였으나': ['〜だったが', 'だったが'],
  '이었던': ['〜だった（名詞の前）', null], '였던': ['〜だった（名詞の前）', null], '이기도': ['〜でもある', null], '이니까': ['〜だから', 'だから'], '니까': ['〜だから', 'だから'],
  '이네요': ['〜ですね', null], '네요': ['〜ですね', null], '이죠': ['〜でしょう', null], '죠': ['〜でしょう', null], '이지': ['〜だよ・〜でしょ', null], '임': ['〜であること（メモ書き）', null],
  '이란': ['〜とは・〜という', null], '란': ['〜とは・〜という', null], '이겠지': ['〜だろう', null], '이었으니까': ['〜だったから', 'だったから'],
  '이라고': ['〜だと・〜って（引用）', 'だと'], '라고': ['〜だと・〜って（引用）', 'だと'], '이었다': ['〜だった', 'だった'], '였다': ['〜だった', 'だった'], '요': ['ていねい', null],
  '여': ['〜よ（呼びかけ）', null], '일': ['〜である（これから・名詞の前）', null], '일까': ['〜だろうか', null], '일지': ['〜なのか', null], '일지도': ['〜かもしれない', null],
  '이길래': ['〜だからって・〜なので', null], '길래': ['〜だからって・〜なので', null], '이세요': ['〜でいらっしゃいます・〜ですか', null], '세요': ['〜でいらっしゃいます・〜ですか（＝이세요）', null],
  '이지만': ['〜だけど', null], '지만': ['〜だけど（＝이지만）', null], '면': ['〜なら（＝이면）', 'なら'], '지': ['〜だよ・〜でしょ（＝이지）', null], '이었죠': ['〜でしたよね（過去）', null], '였죠': ['〜でしたよね（過去）', null],
  '이던': ['〜だった（名詞の前）', null], '던': ['〜だった（名詞の前・＝이던）', null], '째': ['〜目', '目'], '겠어요': ['〜でしょう（＝이겠어요）', null], '겠습니까': ['〜でしょうか（＝이겠습니까）', null],
  '로서는': ['〜としては', 'としては'], '으로서는': ['〜としては', 'としては'], '이여': ['〜よ（呼びかけ）', null], '고': ['〜で（＝이고）', 'で'], '에겐': ['〜には（人）', 'には'], '한테는': ['〜には（人）', 'には'],
  '이었습니다': ['〜でした', 'でした'], '였습니다': ['〜でした', 'でした'], '이었어요': ['〜でした', 'でした'], '였어요': ['〜でした', 'でした'], '이었고': ['〜で（あって）', null], '였고': ['〜で（あって）', null],
  '이었지만': ['〜だったけど', null], '였지만': ['〜だったけど', null], '이었는데': ['〜だったけど', null], '였는데': ['〜だったけど', null], '이었으면': ['〜だったら', null], '였으면': ['〜だったら', null],
  '이라던데': ['〜だそうだけど', null], '라던데': ['〜だそうだけど', null], '이라든가': ['〜とか', null], '라든가': ['〜とか', null], '겠지': ['〜だろう（＝이겠지）', null],
  '겠지요': ['〜でしょうね（＝이겠지요）', null], '겠죠': ['〜でしょうね（＝이겠죠）', null], '였으니까': ['〜だったから', null], '였어': ['〜だった（くだけた）', null]
};
Object.keys(KO_PART_TABLE).forEach(k => { const v = KO_PART_TABLE[k]; if(v && /[었였]/.test(k) && !/過去/.test(v[0])) v[0] += '（過去）'; });
// 母音で終わる名詞のあとで 이 が落ちた形（하나죠・필수겠지요・팝업스토어고）
const KO_COP_V = ['지만', '세요', '길래', '겠어요', '겠습니까', '겠어', '일', '일까', '일지', '던', '지', '고', '죠', '다', '야', '라', '라고', '라는', '라서', '라면', '라도', '란', '였다', '였던', '였고', '였지만', '였는데', '였어', '였어요', '였습니다', '였으니까', '였으면', '예요', '니까', '면', '겠지', '겠지요', '겠죠', '라던데', '라든가'];
function koCopV(head, rest){
  const d = koDec(String(head).slice(-1));
  return !!d && !d.T && KO_COP_V.includes(rest);
}
const KO_T_JAMO = { 4: 'ㄴ', 8: 'ㄹ', 16: 'ㅁ', 17: 'ㅂ', 20: 'ㅆ' };
// 動詞・形容詞：辞書の語幹のうしろに付いた部分
function koVerbTail(eojeol, stem){
  // 르不規則：모르＋았 → 몰랐（前の字に ㄹ が付いて、르 が 라/러 になる）
  if(stem.length >= 2 && stem.endsWith('르')){
    const i = stem.length - 2, a = koDec(stem[i]), e1 = eojeol[i] ? koDec(eojeol[i]) : null, e2 = eojeol[i + 1] ? koDec(eojeol[i + 1]) : null;
    if(eojeol.startsWith(stem.slice(0, i)) && a && e1 && e2 && !a.T && e1.L === a.L && e1.V === a.V && e1.T === 8 && e2.L === 5 && (e2.V === 0 || e2.V === 4)){
      if(e2.T === 20) return '었' + eojeol.slice(i + 2);
      if(!e2.T) return '어' + eojeol.slice(i + 2);
    }
  }
  let k = 0;
  while(k < stem.length && k < eojeol.length && eojeol[k] === stem[k]) k++;
  if(k === stem.length){
    const rest = eojeol.slice(k), ls = koDec(stem[stem.length - 1]);
    // 가 보다→가본・서 보다→서봐：아/어 が前の母音にとけた形（〜してみる）
    if(ls && !ls.T && [0, 1, 4, 5, 6].includes(ls.V) && /^[보봐봤본볼봅주줘줬준줄버]/.test(rest)) return '어' + rest;
    // 가서・서서・신나서・보내드릴까：아/어 がとけて消えた形
    if(ls && !ls.T && [0, 1, 4, 5, 6].includes(ls.V) && /^(서|선|드|간|가는|갈|갔|야)/.test(rest)) return '어' + rest;
    // 넘어서・솟아나・돌아서：語幹そのまま（母音で終わる）＝ 아/어 がとけた形
    if(!rest && ls && !ls.T && [0, 1, 4, 5, 6].includes(ls.V) && stem.length >= 2) return '어';
    // 들・만들・알：ㄹ で終わる語幹は、그대로で「〜する（名詞の前）」
    if(!rest && ls && ls.T === 8) return 'ㄹ';
    if(ls && ls.T === 8 && /^[으은을음]/.test(rest)) return null;
    if(ls && !ls.T && /^[으은을음]/.test(rest)) return null;                  // 지으며→지다 ではない（짓다）
    if(/^[짓낫붓잇긋젓]$/.test(stem[stem.length - 1]) && stem.length === 1 && /^[으은을음어었아았]/.test(rest)) return null; // 짓을→짓（名詞）
    return rest;
  }
  if(k !== stem.length - 1 || k >= eojeol.length) return null;
  const s = koDec(stem[k]), e = koDec(eojeol[k]), rest = eojeol.slice(k + 1);
  if(!s || !e || s.L !== e.L) return null;
  if(s.T === 27 && e.V === 1 && (s.V === 4 || s.V === 0)) return e.T === 20 ? '었' + rest : (!e.T ? '어' + rest : null); // ㅎ不規則（그렇다→그래・그랬다）
  if(s.V === e.V){
    if(s.T === 27){ if(KO_T_JAMO[e.T]) return KO_T_JAMO[e.T] + rest; if(!e.T) return rest; } // ㅎ不規則（그럴・그런・그러면）
    if(!s.T && KO_T_JAMO[e.T]) return KO_T_JAMO[e.T] + rest;                   // 한→ㄴ 할→ㄹ 합→ㅂ 갔→ㅆ
    if(s.T === 8 && (KO_T_JAMO[e.T] || !e.T)) return (KO_T_JAMO[e.T] || '') + rest; // ㄹ脱落（살다→사는・산）
    if(s.T === 17 && !e.T && rest){                                             // ㅂ不規則（고맙다→고마워・고마운）
      const r = koDec(rest[0]);
      if(r && r.L === 11 && (r.V === 14 || (r.V === 9 && s.V === 8))) return (r.T === 20 ? '었' : '어') + rest.slice(1);
      if(r && r.L === 11 && r.V === 13) return (KO_T_JAMO[r.T] || '') + rest.slice(1);
      return null;
    }
    if(s.T === 17 && e.T === 4) return 'ㄴ' + rest;                             // 새삼스런＝새삼스러운
    if(s.T && s.T !== e.T){                                                     // ㅅ・ㄷ不規則（짓다→지어、듣다→들어）：うしろが母音のときだけ
      const r0 = rest ? koDec(rest[0]) : null;
      return r0 && r0.L === 11 ? rest : null;
    }
    return null;
  }
  if(!s.T){                                                                     // 母音がくっついた形（해・했、와・왔、돼・됐）
    if(s.V === 18 && e.V === 0 && stem.length === 1) return null;             // 트다 は 타 にならない（터）
    if(e.T === 20) return '었' + rest;
    if(!e.T) return '어' + rest;
  }
  return null;
}
function koNormTail(t){
  if(!t) return t;
  if(t.length > 1 && t[0] === '으' && !/^[은을음]/.test(t)) t = t.slice(1);     // 받으셨어요・들으셨잖습니까
  t = t.replace(/^[았였]/, '었').replace(/^[아여]/, '어').replace(/^ㅆ/, '었').replace(/^셨/, '시었').replace(/^셔/, '시어').replace(/^실/, '시ㄹ').replace(/^신/, '시ㄴ').replace(/^십/, '시ㅂ').replace(/^습니/, 'ㅂ니');
  if(t[0] === '은') t = 'ㄴ' + t.slice(1);
  else if(t[0] === '을') t = 'ㄹ' + t.slice(1);
  else if(t[0] === '음') t = 'ㅁ' + t.slice(1);
  else if(t[0] === '으') t = t.slice(1);
  return t;
}
// 長いものから当てはめる → [{k, d, j, a}]、ぜんぶ当てはまらなければ null
const _koKeyCache = new WeakMap();
function koSplitTail(t, table){
  let keys = _koKeyCache.get(table);
  if(!keys){ keys = Object.keys(table).sort((a, b) => b.length - a.length); _koKeyCache.set(table, keys); }
  const out = [];
  let guard = 0;
  while(t && guard++ < 8){
    if(out.length && table !== KO_PART_TABLE) t = t.replace(/^셨/, '시었').replace(/^셔/, '시어').replace(/^실/, '시ㄹ').replace(/^신/, '시ㄴ').replace(/^십/, '시ㅂ').replace(/^습니/, 'ㅂ니').replace(/^[았였]/, '었');
    const k = keys.find(x => table[x] && t.startsWith(x));
    if(!k) return out.length ? { parts: out, left: t } : null;
    if(table !== KO_PART_TABLE && out.length && ['나', '죠', '지요'].includes(out[out.length - 1].k) && k !== '요') return { parts: out, left: t };
    // 〜다＋는・면・고（어야겠다는・어버렸다는）：引用の縮まった形として説明
    const QD = { '는': ['〜という（＝다고 하는）', 'という', 1], '면': ['〜なら（＝다고 하면）', 'なら'], '고': ['〜と（引用）', 'と'], '면서': ['〜と言いながら', null], '거나': ['〜とか', 'とか'] };
    if(table !== KO_PART_TABLE && out.length && /다$/.test(out[out.length - 1].k) && QD[k] && !(k === '고' && out[out.length - 1].k === '다')){ const q = QD[k]; out.push({ k, d: q[0], j: q[1], a: q[2] }); }
    else out.push({ k, d: table[k][0], j: table[k][1], a: table[k][2] });
    t = t.slice(k.length);
    if(table !== KO_PART_TABLE && t && /[기ㅁ]$/.test(k) && KO_PARTICLES.includes(t)){ out.push({ k: t, d: (KO_PART_TABLE[t] || [''])[0], j: null }); t = ''; }
    if(/^[ㄱ-ㅎ]/.test(t) && !keys.some(x => table[x] && t.startsWith(x))) return { parts: out, left: t };
  }
  return { parts: out, left: t };
}
function koFirstMean(m){ return String(m || '').split(/[・、,／]/)[0].trim(); }
// head: 辞書の形、pos: 品詞、mean: 意味（日本語）
function koFormInfo(eojeol, head, pos, mean){
  if(!eojeol || !head || eojeol === head) return null;
  const verb = /다$/.test(head) && head.length > 1 && (/^(動|形|補動|補形)$/.test(pos || '') || !pos);
  const m1 = koFirstMean(mean);
  if(verb){
    const t = koNormTail(koVerbTail(eojeol, head.slice(0, -1)));
    if(!t) return null;
    const adj = /形/.test(pos || '');
    const table = adj ? (window._koEndAdj || (window._koEndAdj = Object.assign({}, KO_END_TABLE, KO_END_ADJ))) : KO_END_TABLE;
    const sp = koSplitTail(t, table);
    if(!sp) return null;
    let ja = '';
    const p0 = sp.parts[0];
    if(!adj && sp.parts.length === 1 && !sp.left && p0.j){
      if(/する$/.test(m1)) ja = m1.slice(0, -2) + p0.j + (p0.a ? '〜' : '');
      else if(p0.j === 'する' && /[うくぐすつぬぶむる]$/.test(m1)) ja = m1 + (p0.a ? '〜' : '');
    }
    return { head, mean: m1, parts: sp.parts, left: sp.left, ja };
  }
  if(!eojeol.startsWith(head)){
    const cp = koCopShortParts(eojeol, head);
    return cp ? { head, mean: m1, parts: cp, left: '', ja: m1 ? m1 + cp[0].d.replace(/^〜/, '') : '' } : null;
  }
  const rest = eojeol.slice(head.length);
  if(!rest) return null;
  const sp = koSplitTail(rest, KO_PART_TABLE);
  if(!sp) return null;
  let ja = '';
  if(m1 && !sp.left && sp.parts.every(p => p.j && KO_SAFE_J.includes(p.j))) ja = m1 + sp.parts.map(p => p.j).join('');
  else if(m1 && /的$/.test(m1) && !sp.left && sp.parts.length === 1 && sp.parts[0].k === '인') ja = m1 + 'な〜';
  return { head, mean: m1, parts: sp.parts, left: sp.left, ja };
}
// 辞書に無いとき：はっきりわかる語尾だけ
const KO_GUESS_ENDS = ['었습니다','았습니다','였습니다','했습니다','었어요','았어요','였어요','했어요','었는데','았는데','였는데','했는데','었지만','았지만','였지만','했지만','었다','았다','였다','했다','었던','았던','였던','했던','었고','았고','였고','했고','습니다','적으로','적인','적이다','적'];
function koFormGuess(eojeol){
  const e = KO_GUESS_ENDS.find(x => eojeol.length > x.length && eojeol.endsWith(x));
  if(!e) return null;
  const noun = e[0] === '적';
  const t = noun ? e : koNormTail(e.replace(/^했/, '었'));
  const sp = koSplitTail(t, noun ? KO_PART_TABLE : KO_END_TABLE);
  if(!sp || sp.left) return null;
  return { head: null, parts: sp.parts, left: '', ja: '', guess: true, front: eojeol.slice(0, -e.length) };
}
function koRenderFormInfo(info){
  const box = document.getElementById('ko-form-info');
  if(!box) return;
  try{
    if(_koCur && _koCur.type === 'word' && !_koPhrase){
      const extra = koMustNote(_koCur, info);
      if(extra && !info) info = { head: _koCur.eojeol, mean: '', parts: [], left: '', ja: '', noteOnly: true };
      if(extra){ const ns = String(info.note || '').split('\n').filter(Boolean); extra.split('\n').forEach(x => { if(!ns.includes(x)) ns.push(x); }); info.note = ns.join('\n'); }
    }
  }catch(_){}
  if(!info || ((!info.parts || !info.parts.length) && !info.ja && !info.note)){ box.innerHTML = ''; box.style.display = 'none'; return; }
  info.parts = info.parts || [];
  window._koGramCand = [];
  const gIdx = g => window._koGramCand.push(g) - 1;
  const gBtn = g => { const i = gIdx(g); return `<button class="ko-gram-add${koGramHas(g.id) ? ' on' : ''}" data-gi="${i}" onclick="event.stopPropagation();koGramToggle(${i},this)" title="文法帳">${koGramHas(g.id) ? '★' : '☆'}</button>`; };
  const parts = info.parts.map(p => `<span class="ko-fi-plus">＋</span><span class="ko-fi-end">${escapeHtml(p.k)}</span><span class="ko-fi-d">${escapeHtml(p.d)}</span>${koGramPartOk(p) ? gBtn(koGramFromPart(p)) : ''}`).join('');
  const head = info.head ? `<span class="ko-fi-h">${escapeHtml(info.head)}</span>${info.mean ? `<span class="ko-fi-d">${escapeHtml(info.mean)}</span>` : ''}` : `<span class="ko-fi-h">${escapeHtml(info.front || '')}…</span>`;
  box.innerHTML = `${info.ja ? `<div class="ko-fi-ja">${escapeHtml(info.ja)}</div>` : ''}
    ${info.noteOnly ? '' : `<div class="ko-fi-row">${head}${parts}${info.left ? `<span class="ko-fi-d">＋${escapeHtml(info.left)}</span>` : ''}</div>`}
    ${info.guess ? '<div class="ko-fi-note">辞書に無いので、語尾だけの推測です</div>' : ''}${info.note ? String(info.note).split('\n').filter(Boolean).map(x => { const g = koGramFromNote(x); return `<div class="ko-fi-note">${escapeHtml(x)}${g ? gBtn(g) : ''}</div>`; }).join('') : ''}`;
  box.style.display = '';
  try{ koGramSeen(); }catch(_){}
}
// 登録済みの単語：保存してある見出しと意味から
function koFormInfoForEntry(eojeol, key, ent){
  const head = koHead(key, ent);
  const ms = koMs(ent);
  const pos = /다$/.test(head) && head.length > 1 ? '' : '名';
  const mean = ms.length ? ms[0].m : '';
  if(_koDict && _koDict[head]){ const d = _koDict[head][0]; if(d) return koFormInfo(eojeol, head, d[0], mean); }
  return koFormInfo(eojeol, head, pos, mean);
}

/* ══════ かんたん表示（細かい欄をたたむ） ══════ */
const KO_SIMPLE_LS = LS_PREFIX + 'ko-simple';
function koSimpleOn(){ return localStorage.getItem(KO_SIMPLE_LS) === '1'; }
function koSetSimple(on){ try{ localStorage.setItem(KO_SIMPLE_LS, on ? '1' : '0'); }catch(_){} }
function koToggleMore(btn){
  const sh = document.getElementById('ko-sheet');
  const open = sh.classList.toggle('ko-more');
  if(btn) btn.textContent = open ? '▼ くわしく（とじる）' : '▶ くわしく（形を変える・メモ など）';
}


/* ══════ 表示用の飾り（意味・未登録の色・文のメモ印・訳）を本文の保存データに入れない ══════ */
function koHasMarks(html){ return !!html && /class="[^"]*\b(kw|ko-new|ko-note-mark|ko-tr|ko-tr-only|ko-untr)\b/.test(html); }
function koStripDom(root){
  root.querySelectorAll('.ko-tr-only[data-orig], .ko-untr[data-orig]').forEach(el => {
    const t = document.createElement('template'); t.innerHTML = el.getAttribute('data-orig') || ''; el.replaceWith(t.content);
  });
  root.querySelectorAll('.ko-untr').forEach(el => el.replaceWith(...el.childNodes));
  root.querySelectorAll('.ko-note-mark, .ko-tr').forEach(el => el.remove());
  root.querySelectorAll('span.kw, span.ko-new').forEach(el => el.replaceWith(...el.childNodes));
}
function koStripHtml(html){
  if(!koHasMarks(html)) return html;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  koStripDom(tmp);
  return tmp.innerHTML;
}
// 前のバージョンで本文に焼き付いた意味などを外す（本を開いたとき）
function koCleanBakedNovel(novel){
  let changed = false;
  (novel && novel.episodes || []).forEach(ep => (ep.pages || []).forEach(pg => (pg.paras || []).forEach(pa => {
    if(pa.type !== 'text') return;
    if(koHasMarks(pa.html)){
      const c = koStripHtml(pa.html);
      if(c !== pa.html){ pa.html = c; changed = true; }
    }
    // 文のメモの印（✎）が文字として入ってしまったもの
    if(typeof pa.text === 'string' && /✎\s*$/.test(pa.text) && !/✎\s*$/.test(String(pa.html || '').replace(/<[^>]*>/g, ''))){
      pa.text = pa.text.replace(/\s*✎\s*$/, ''); changed = true;
    }
  })));
  return changed;
}


/* ══════ 数の言葉のあと（몇 개・세 가지・두 명） ══════ */
const KO_NUM_WORDS = ['몇','몇몇','한','두','세','네','다섯','여섯','일곱','여덟','아홉','열','스무','서른','마흔','쉰','여러','수십','수백','수천','수만','대여섯','서너','두세','한두','십','백','천','만'];
function koIsNumberWord(t){
  t = String(t || '').trim();
  if(!t) return false;
  if(/^(백|천|만|십|수십|수백|수천)여$/.test(t)) return true;
  return /^[0-9０-９]+$/.test(t) || KO_NUM_WORDS.includes(t) || /^(열|스물|서른|마흔|쉰)(한|두|세|네|다섯|여섯|일곱|여덟|아홉)$/.test(t);
}
function koPrevTok(hit){
  if(!hit || !hit.sentence) return '';
  const nb = koNeighbors(hit.sentence, hit.eojeol, hit.occ);
  const raw = nb.raw && nb.i >= 0 ? nb.raw[nb.i] : '';
  const dm = raw && raw.match(/([0-9０-９]+)[\uAC00-\uD7A3]/);
  if(dm) return dm[1];
  if(nb.i > 0 && nb.raw && /^[0-9０-９]+$/.test(nb.raw[nb.i - 1])) return nb.raw[nb.i - 1];
  return nb.i > 0 && !nb.end[nb.i - 1] ? nb.toks[nb.i - 1] : '';
}
// 次の語（해야 하다 の「하다」を見るため）
function koNextTok(hit){
  if(!hit || !hit.sentence) return '';
  const nb = koNeighbors(hit.sentence, hit.eojeol, hit.occ);
  return nb.i >= 0 && nb.i + 1 < nb.toks.length && !nb.end[nb.i] ? nb.toks[nb.i + 1] : '';
}

/* ══════ つなげたフレーズを、単語ごとに分けて見せる ══════ */
let _koPhrase = null;
// 1語ぶん：単語帳にあればその意味、なければ辞書（数のあとは単位を先に）
function koWordInfo(tok, prevTok){
  const words = koLoad();
  const fd = koFindForm(tok);
  if(fd && words[fd.key] && !/\s/.test(fd.key)){
    const e = words[fd.key], head = koHead(fd.key, e);
    const mean = koGlossText((koMs(e)[0] || {}).m || '');
    const pos = _koDict && _koDict[head] && _koDict[head][0] ? _koDict[head][0][0] : (/다$/.test(head) && head.length > 1 ? '' : '名');
    const info = koFormInfo(tok, head, pos, mean);
    return { tok, head, mean, parts: info ? info.parts : [], mine: true };
  }
  // 数の言葉は、辞書の1つ目（数人・幾 など）より分かりやすい言い方で
  const NUM_JA = { '몇': 'いくつ', '한': '一つの', '두': '二つの', '세': '三つの', '네': '四つの', '다섯': '五つの', '여섯': '六つの', '일곱': '七つの', '여덟': '八つの', '아홉': '九つの', '열': '十の', '여러': 'いくつもの', '몇몇': 'いくつかの' };
  if(NUM_JA[tok]) return { tok, head: tok, mean: NUM_JA[tok], parts: [] };
  const gi = koGrammarInfo(tok, prevTok);
  if(gi) return { tok, head: gi.head, mean: gi.ja, parts: gi.parts.slice(1) };
  if(_koDict){
    const f = koDictLookup(tok, prevTok);
    if(f.length){
      const e = f[0].ents[0];
      const cm = (e[0] === '依名' || KO_COUNTER_ANY.has(f[0].head)) && koIsNumberWord(prevTok) ? KO_COUNTER_JA[f[0].head] : '';
      const mean = cm || koFirstMean(koJaShort(e[1][0]));
      const info = koFormInfo(tok, f[0].head, e[0], mean);
      return { tok, head: f[0].head, mean, parts: info ? info.parts : [], counter: koIsNumberWord(prevTok) && (e[0] === '依名' || KO_COUNTER_ANY.has(f[0].head)) };
    }
  }
  const g = koFormGuess(tok);
  return { tok, head: g ? g.front : tok, mean: '', parts: g ? g.parts : [] };
}
function koShowPhraseInfo(toks, hit, before){
  _koPhrase = { toks: toks.slice(), hit, before: before || '' };
  const go = () => { if(_koPhrase && _koPhrase.toks === _koPhrase.toks) koRenderPhraseInfo(); };
  if(_koDict) go(); else koDictLoad().then(go).catch(go);
}
function koRenderPhraseInfo(){
  const box = document.getElementById('ko-form-info');
  const ph = _koPhrase;
  if(!box || !ph) return;
  const infos = ph.toks.map((t, i) => koWordInfo(t, i ? ph.toks[i - 1] : ph.before));
  const own = (_koEdit.ms[_koEdit.sel] || _koEdit.ms[0] || {}).m || '';
  const last = infos[infos.length - 1] || { parts: [] };
  // 自分の意味のうしろに、最後の語の助詞（이→が など）を付ける
  // 意味のうしろに付けてよいのは、はっきりした助詞だけ（이나＝や／も のように意味が変わるものは付けない）
  let tailJa = last.parts.length && last.parts.every(p => p.j && KO_SAFE_J.includes(p.j)) && !/다$/.test(last.head || '') ? last.parts.map(p => p.j).join('') : '';
  if(tailJa && koGlossText(own).endsWith(tailJa)) tailJa = '';
  const seg = infos.map((w, i) => {
    const h = `<button class="ko-fi-h ko-fi-tap" onclick="koOpenPhraseWord(${i})">${escapeHtml(w.head || w.tok)}</button>`
      + (w.mean ? `<span class="ko-fi-d">${escapeHtml(w.mean)}</span>` : '<span class="ko-fi-d ko-fi-none">？</span>')
      + (w.mine ? '<span class="ko-fi-mine">単語帳</span>' : '')
      + (w.counter ? '<span class="ko-fi-cnt">数のあと</span>' : '');
    const ps = w.parts.map(p => `<span class="ko-fi-plus">＋</span><span class="ko-fi-end">${escapeHtml(p.k)}</span><span class="ko-fi-d">${escapeHtml(p.d)}</span>`).join('');
    return (i ? '<span class="ko-fi-plus">＋</span>' : '') + h + ps;
  }).join('');
  box.innerHTML = (own ? `<div class="ko-fi-ja">${escapeHtml(koGlossText(own) + tailJa)}</div>` : '<div class="ko-fi-empty">意味はまだ入っていません（下で入れてね）</div>')
    + `<div class="ko-fi-row">${seg}</div><div class="ko-fi-note">単語をタップすると、その単語だけのシートが開きます</div>`;
  box.style.display = '';
}
function koOpenPhraseWord(i){
  const ph = _koPhrase;
  if(!ph || !ph.toks[i]) return;
  const h = ph.hit || {};
  const tok = ph.toks[i];
  // 文の中で何回目か（前のフレーズの位置から数える）
  const nb = h.sentence ? koNeighbors(h.sentence, ph.toks[0], h.occ) : null;
  let occ = 0;
  if(nb && nb.i >= 0){ const at = nb.i + i; occ = nb.toks.slice(0, at).filter(t => t === tok).length; }
  koOpenSheet({ type: 'word', key: null, eojeol: tok, sentence: h.sentence || tok, pi: h.pi, qi: h.qi, occ });
}


/* ══════ 「〜거란・〜거야・〜건」など：것（こと・の）＋だ・という…（辞書に無い言い回し） ══════ */
// 거／것 のうしろ：[説明, ㄹ・을のあと（〜だろう）, ㄴ・는のあと（〜の）]
const KO_GEO_REST = {
  '': ['', '〜こと・〜もの', '〜こと・〜の'],
  '란': ['＝라는（〜という）', '〜だろうという', '〜という（こと）'], '라는': ['〜という', '〜だろうという', '〜という（こと）'], '이라는': ['〜という', '〜だろうという', '〜という（こと）'],
  '라고': ['〜と', '〜だろうと', '〜ということだと'], '이라고': ['〜と', '〜だろうと', '〜ということだと'],
  '야': ['〜だ（くだけた）', '〜だろう・〜するつもりだ', '〜なんだ'], '이야': ['〜だ（くだけた）', '〜だろう・〜するつもりだ', '〜なんだ'],
  '예요': ['〜です', '〜でしょう・〜するつもりです', '〜なんです'], '에요': ['〜です', '〜でしょう・〜するつもりです', '〜なんです'], '이에요': ['〜です', '〜でしょう・〜するつもりです', '〜なんです'],
  '입니다': ['〜です（かたい）', '〜でしょう・〜するつもりです', '〜なのです'],
  '다': ['〜だ', '〜だろう', '〜のだ'], '이다': ['〜だ', '〜だろう', '〜のだ'],
  '지': ['〜でしょ', '〜だろう？', '〜なんでしょ'], '이지': ['〜でしょ', '〜だろう？', '〜なんでしょ'], '죠': ['〜でしょう', '〜でしょう', '〜なんでしょう'],
  '니까': ['〜だから', '〜だろうから', '〜なんだから'], '이니까': ['〜だから', '〜だろうから', '〜なんだから'],
  '면': ['〜なら', '〜するなら', '〜なら'], '라면': ['〜なら', '〜するなら', '〜なら'], '이라면': ['〜なら', '〜するなら', '〜なら'],
  '였다': ['〜だった', '〜だっただろう', '〜のだった'], '이었다': ['〜だった', '〜だっただろう', '〜のだった'],
  '은': ['〜は', '〜ことは', '〜のは'], '을': ['〜を', '〜ことを', '〜のを'], '이': ['〜が', '〜ことが', '〜のが'], '도': ['〜も', '〜ことも', '〜のも'],
  '만': ['〜だけ', '〜ことだけ', '〜のだけ'],
  '으로': ['〜で', '〜ことで', '〜ことで（〜と）'], '임': ['〜なのだ（ネット口調）', '〜なのだ（ネット口調）', '〜なのだ（ネット口調）'], '인가요': ['〜なんですか', '〜のでしょうか', '〜なんですか'], '인지는': ['〜なのかは', '〜のかは', '〜なのかは'],
  '일까요': ['〜でしょうか', '〜のでしょうか', '〜なのでしょうか'], '인데요': ['〜なんですけど', '〜するつもりなんですか・〜はずなんですけど', '〜なんですけど'],
  '인지': ['〜なのか', '〜のだろうか', '〜なのか'], '인가': ['〜なのか', '〜のだろうか', '〜なのか'], '일까': ['〜だろうか', '〜のだろうか', '〜なのだろうか'], '인데': ['〜なんだけど', '〜はずなんだけど', '〜なんだけど'], '처럼': ['〜のように', '〜ように', '〜のように'], '같다': ['〜みたいだ', '〜しそうだ', '〜みたいだ'], '같은': ['〜みたいな', '〜しそうな', '〜みたいな']
};
// 縮まった形：건＝것은、걸＝것을、게＝것이
const KO_GEO_SHORT = { '건': '은', '걸': '을', '게': '이', '건지': '인지', '건가': '인가', '걸까': '일까', '건데': '인데', '겁니다': '입니다', '걸로': '으로', '건가요': '인가요', '건지는': '인지는', '걸까요': '일까요', '건데요': '인데요' };
// 듯 のうしろ：[説明, ㄹ・을のあと, ㄴ・는のあと]
const KO_DEUT_REST = {
  '': ['〜ように', '〜しそうに', '〜かのように・〜そうに'], '이': ['〜ように', '〜しそうに', '〜かのように・〜そうに'],
  '한': ['〜ような（名詞の前）', '〜しそうな', '〜かのような'],
  '하다': ['〜ようだ', '〜しそうだ', '〜ようだ'], '했다': ['〜ようだった', '〜しそうだった', '〜ようだった'],
  '합니다': ['〜ようです', '〜しそうです', '〜ようです'], '해요': ['〜ようです', '〜しそうです', '〜ようです'],
  '하게': ['〜ように', '〜しそうに', '〜かのように'], '해': ['〜ようで', '〜しそうで', '〜ようで'], '해서': ['〜ようで', '〜しそうで', '〜ようで'],
  '하고': ['〜ようで', '〜しそうで', '〜ようで'], '했던': ['〜ようだった（名詞の前）', '〜しそうだった', '〜ようだった'], '하면서': ['〜ようにしながら', '〜しそうにしながら', '〜かのようにしながら']
};
function koGrammarInfo(tok, prev){
  tok = String(tok || ''); prev = String(prev || '');
  if(!tok) return null;
  // 이게＝이것이（これが）など、縮まった形
  const dm = koDemoInfo(tok);
  if(dm) return dm;
  // 할 텐데（〜だろうに）・할 테니까（〜だろうから）：터（はず・つもり）が縮まった形
  const plT = prev ? koDec(prev[prev.length - 1]) : null;
  if(KO_TEO[tok] && plT && plT.T === 8){
    const [orig, ja] = KO_TEO[tok];
    return { head: '터', rest: tok, ja, parts: [{ k: '터', d: '（はず・つもり）' }, { k: tok + '＝' + orig, d: ja }], note: `${tok} は ${orig} の縮まった形です`, mean: 'はず', msg: '터（はず・つもり）を使った言い回しです。辞書には載っていない形です' };
  }
  const pl = prev ? koDec(prev[prev.length - 1]) : null;
  const attOk = !prev || !_koDict || koIsAttr(prev);       // 전화를 건（걸다）の 를 は名詞の前の形ではない
  const fut = attOk && !!pl && pl.T === 8;                       // 살아남을・할 → 「〜だろう」
  const att = attOk && (fut || (!!pl && pl.T === 4) || /던$/.test(prev)); // 한・는・은・던 → 「〜の・〜こと」
  // 〜는 듯／〜ㄴ 듯／〜ㄹ 듯：「〜かのように・〜しそうに」
  if(/^듯/.test(tok)){
    const rest = tok.slice(1);
    if(!att || !(rest in KO_DEUT_REST)) return null;
    const r = KO_DEUT_REST[rest];
    const parts = [{ k: '듯', d: '（〜よう・〜ように）' }];
    if(rest) parts.push({ k: rest, d: r[0] });
    const note = fut ? `前の「${prev}」が「〜する（これから・名詞の前）」の形なので「〜しそう」になります`
               : `前の「${prev}」が名詞の前の形なので「〜かのよう」になります`;
    return { head: '듯', rest, ja: fut ? r[1] : r[2], parts, note, fut, mean: '〜よう', msg: '듯（〜よう）を使った言い回しです' };
  }
  let head, rest;
  if(KO_GEO_SHORT[tok]){ if(!att) return null; head = '거'; rest = KO_GEO_SHORT[tok]; }
  else if(/^[거것]/.test(tok)){ head = tok[0]; rest = tok.slice(1); }
  else return null;
  if(!(rest in KO_GEO_REST)) return null;
  // 前が「〜する（名詞の前）」の形でないときは、はっきりした言い回しだけ（거＝それ と区別）
  if(!att && !['란', '라는', '라고', '야', '예요', '에요', '니까'].includes(rest) && head === '거') return null;
  if(!att && head === '것' && !rest) return null;
  const r = KO_GEO_REST[rest];
  const ja = fut ? r[1] : r[2];
  const parts = [{ k: head, d: (head === '거' ? '＝것（' : '（') + 'こと・の）' }];
  if(rest) parts.push({ k: KO_GEO_SHORT[tok] ? tok + '＝것' + rest : rest, d: r[0] });
  const note = fut ? `前の「${prev}」が「〜する（これから・名詞の前）」の形なので「〜だろう」になります`
             : att ? `前の「${prev}」が名詞の前の形なので「〜の・〜こと」になります` : '';
  return { head, rest, ja, parts, note, fut, mean: 'こと・の', msg: '거（것＝こと・の）を使った言い回しです。辞書には載っていない形です' };
}
function koFillGrammar(hit, gi, addMode){
  const box = document.getElementById('ko-dict');
  if(box){
    box.innerHTML = `<button class="ko-dict-row on" onclick="koAddMeaning(${escapeHtml(JSON.stringify(gi.ja))})">
      <span class="ko-dict-h">${escapeHtml(hit.eojeol)}</span><span class="ko-dict-pos">言い回し</span>
      <span class="ko-dict-ja">${escapeHtml(gi.ja)}</span></button>
      <div class="ko-dict-msg">${escapeHtml(gi.msg || '')}</div>`;
  }
  if(addMode) return;
  if(!_koEdit.ms.length){ koAddMeaning(gi.ja); _koEdit._auto = true; }
  try{ koSetKey(hit.eojeol); }catch(_){}
  if(_koHeadAuto) koSetHead(hit.eojeol);
  koRenderFormInfo({ head: gi.head, mean: gi.mean || 'こと・の', parts: gi.parts.slice(1), left: '', ja: gi.ja, note: gi.note });
}

// 数のあとの単位（依存名詞）の、分かりやすい意味
// 辞書の1つ目の意味より、よく使う言い方を先に出す単語
const KO_PREF_JA = { '하다': 'する・やる', '쓰다': '書く・使う', '인상': '印象・人相', '뜻': '意味・意志', '줄': '列・紐', '바탕': '下地・背景', '가리다': '覆う・隠す・選ぶ',
  '타다': '乗る・燃える', '만나다': '会う・出会う', '불리다': '呼ばれる・増やす', '지경': '羽目・ありさま', '바로': 'まさに・すぐ・まっすぐ', '딱지': '札・ステッカー・かさぶた',
  '말다': '〜するのをやめる（지 말다）・巻く', '연차': '有給休暇・年次', '주다': 'あげる・くれる', '위로': '慰め・慰労', '노리다': '狙う', '나다': '出る・生じる・起こる', '고개': '頭・首',
  '저거': 'あれ', '돌아가다': '帰る・戻る・回る', '내리다': '降りる・降ろす・降る', '인도하다': '案内する・導く', '버튼': 'ボタン', '칸': 'マス・区切り・車両', '등수': '順位',
  '크다': '大きい', '들다': '持つ・入る・挙げる', '뜨다': '浮かぶ・表示される・離れる・開ける', '털리다': '奪われる・はたかれる', '내다': '出す', '덕': 'おかげ・徳',
  '민망하다': '気まずい・恥ずかしい', '뒤덮이다': '覆われる', '세상': '世界・世の中', '바르다': '正しい・塗る', '채우다': '満たす・埋める', '놓이다': '置かれる',
  '모시다': 'お連れする・仕える', '맞다': '合う・正しい・当たる', '일': 'こと・仕事', '밝다': '明るい', '틀다': '流す・ひねる', '달다': '付ける・甘い・吊るす', '총': '総〜・全部で・銃',
  '아쉽다': '残念だ・惜しい', '끔찍하다': 'ひどい・恐ろしい', '정적': '静寂・静的', '오그라들다': '縮こまる', '유리하다': '有利だ', '입장': '立場・入場', '뒤지다': '漁る・遅れる・くたばる（俗）',
  '힘겹다': '苦しい・大変だ', '일진': '不良グループ・日柄', '찍히다': '目をつけられる・撮られる', '당하다': '〜される・遭う', '배치되다': '配置される', '문장': '文章', '다하다': '尽くす・尽きる',
  '이르다': '至る・早い・言う', '쪽지': 'メモ・メッセージ', '벌어먹다': '稼いで暮らす', '도시락': 'お弁当', '꼭': '必ず・ぎゅっと', '일정': '日程・一定', '잡히다': '決まる・捕まる',
  '역사': '歴史・駅舎', '띄우다': '浮かべる・表示する', '거르다': 'ふるいにかける・抜く', '달리다': '走る・付く・ぶら下がる', '익숙하다': '慣れている・見慣れた', '갈리다': 'すり潰される・割れる',
  '대체': '一体・代替', '대다': '当てる・付ける', '쇳물': '溶けた鉄', '공고': '募集・公告', '나르다': '運ぶ', '시점': '視点・時点', '궁금하다': '気になる・知りたい', '떠들다': 'しゃべる・騒ぐ', '전송하다': '送信する・電送する', '원고': '原稿・原告', '얻다': '得る・もらう',
  '놓다': '置く・放す', '전작': '前作・全作品', '뜻하다': '意味する・志す', '군': '軍・郡', '설화': '説話・物語・舌禍', '어울리다': '似合う・付き合う', '먹고살다': '食べていく・暮らす',
  '노릇': 'こと・ありさま（〜하는 노릇＝〜するわけにもいかない）', '짓다': '作る・建てる・（表情を）浮かべる', '찍다': '撮る・押す・（記録を）出す', '벌컥벌컥': 'ごくごく（飲む）・かっと', '깜짝이야': 'びっくりした', '세다': '強い・数える', '새하얗다': '真っ白だ', '공지': 'お知らせ・告知', '확': '一気に・ぐっと・ぱっと', '수사': '修辞・捜査', '맨': '一番の・素の', '이쪽': 'こちら', '저쪽': 'あちら', '그쪽': 'そちら', '공사': '公社・工事', '장기': '長期・臓器', '위하다': '〜のために・大事にする', '전대': '戦隊', '제약': '製薬・制約', '수습': '見習い・収拾', '공포': '恐怖', '있다': 'ある・いる', '없다': 'ない・いない', '꽂히다': '刺さる・ハマる', '괜찮다': '大丈夫だ・平気だ', '같다': '〜のようだ・同じだ',
  '진짜': '本当に・本物', '정말': '本当に・本当', '사원': '社員・寺院' };
// その語だけで出てきたときだけ、先に出す意味（안에＝中に、のように助詞が付いたら辞書どおり）
// その形のときに先に出す意味（辞書は 애초＝最初 だけなので）
const KO_PREF_WORD = { '죽어라': '死ぬ気で・必死に（死ね）', '짠하고': 'ジャーンと（現れて）', '드림': '〜より（手紙の結び）', '이젠': '今は・もう（＝이제는）', '안다': '知っている（알다）', '누가': '誰が・誰かが', '술술': 'すらすら・するする', '애초에': 'そもそも・最初から', '그에': 'それに・彼に', '이에': 'これに', '사실': '実は・事実', '사실은': '実は', '실은': '実は', '아무래도': 'どうやら・どう考えても',
  '도대체': '一体', '도저히': 'とても（〜ない）・到底', '설마': 'まさか', '하긴': '確かに・まあ（そういえば）', '하여튼': 'とにかく', '어쩐지': 'どうりで・なんだか', '괜히': 'わけもなく・余計に' };
// 助詞が付いたときだけ先に出す意味（세를＝勢いを、세＝三 はそのまま）
const KO_PREF_PART = { '세': '勢い・勢力' };
const KO_PREF_EXACT = { '안': '〜しない（否定）', '못': '〜できない', '아무': '何の・どんな（〜も）', '도로': '元通りに・また（道路）', '제': '私の・私', '이': 'この・これ', '그': 'その・彼', '저': 'あの・私', '네': 'はい・君の', '자': 'さあ',
  '하': 'はぁ（ため息）', '허': 'はっ（あきれ）', '맨': '一番（맨 앞＝一番前）', '대체': '一体（〜）', '척': 'ぱっと・一目で', '서': '立って（서다）', '마': 'おい（方言）', '참': '本当に・そういえば' };
// 辞書では「単位」になっていなくても、数のすぐあとなら単位として読む語
const KO_COUNTER_ANY = new Set(['화', '회', '부', '편', '장', '권', '층', '개월', '시간', '주', '년', '월', '일']);
const KO_COUNTER_JA = { '만': '万', '천': '千', '백': '百', '억': '億', '화': '話（第〜話）', '회': '回', '부': '部', '편': '編・話', '시간': '時間', '개월': 'か月', '주': '週', '월': '月', '일': '日', '번': '回・度', '개': '個', '가지': '種類', '명': '人', '살': '歳', '권': '冊', '마리': '匹', '시': '時', '분': '分', '초': '秒', '달': 'か月', '년': '年', '층': '階', '잔': '杯', '병': '本（瓶）', '장': '枚', '대': '台・〜代（年代）', '세': '歳', '채': '軒', '벌': '着', '켤레': '足', '송이': '輪', '그루': '本（木）', '자루': '本（ペン等）', '줄': '行・列', '주일': '週間', '군데': 'か所', '살짜리': '歳の' };
// 日本語の意味のうしろに、そのまま付けてよい助詞
const KO_SAFE_J = ['が', 'を', 'は', 'に', 'で', 'の', 'も', 'と', 'へ', 'から', 'まで', 'より', 'たち', 'だけ', '的', '的な', '的に', 'さん', 'として', 'のように', 'しか', 'さえ', 'によって', 'だ', 'です', 'だった', 'という', 'だと'];


/* ══════ だんだん隠す：復習で何回か正解した単語は、本文では点線だけにする ══════ */
const KO_FADE_LS = LS_PREFIX + 'ko-fade';
function koFadeN(){ return parseInt(localStorage.getItem(KO_FADE_LS) || '0', 10) || 0; }
function koSetFadeN(n){ try{ localStorage.setItem(KO_FADE_LS, String(n)); }catch(_){} koRerender(); }
// 「もう一回」と答えた直後（次の復習が今日）は、また意味を出す
function koFaded(e){ const n = koFadeN(); return !!e && n > 0 && (e.ok || 0) >= n && (e.ivl || 0) >= 1; }
/* 単語を押したら発音（最初はオフ） */
const KO_TAPSPEAK_LS = LS_PREFIX + 'ko-tap-speak';
function koTapSpeakOn(){ return localStorage.getItem(KO_TAPSPEAK_LS) === '1'; }
function koSetTapSpeak(on){ try{ localStorage.setItem(KO_TAPSPEAK_LS, on ? '1' : '0'); }catch(_){} }


const KO_TEO = { '텐데': ['터인데', '〜だろうに・〜はずなのに'], '텐데요': ['터인데요', '〜だろうに（ていねい）'], '테니까': ['터이니까', '〜だろうから・〜するから'], '테니': ['터이니', '〜だろうから・〜するから'],
  '테지': ['터이지', '〜だろう'], '테고': ['터이고', '〜だろうし'], '테니까요': ['터이니까요', '〜だろうから（ていねい）'], '테니깐': ['터이니까', '〜だろうから'], '테지만': ['터이지만', '〜だろうけど'], '테죠': ['터이지요', '〜でしょう'], '테지요': ['터이지요', '〜でしょう'], '테야': ['터이야', '〜するつもりだ'], '테다': ['터이다', '〜するつもりだ'] };
/* ══════ 이게（これが）・그건（それは）・뭘（何を）など、縮まった形 ══════ */
const KO_DEMO_BASE = { '이': ['이것', 'これ'], '그': ['그것', 'それ'], '저': ['저것', 'あれ'] };
// 縮まった語尾：[元の形, 説明, 日本語]
const KO_DEMO_END = {
  '게': ['이', '〜が', 'が'], '건': ['은', '〜は', 'は'], '걸': ['을', '〜を', 'を'], '거': ['', '', ''],
  '거야': ['이야', '〜だよ', 'だよ'], '거다': ['이다', '〜だ', 'だ'], '거지': ['이지', '〜でしょ', 'でしょ'], '거예요': ['이에요', '〜です', 'です'],
  '거랑': ['이랑', '〜と', 'と'], '거나': ['이나', '〜でも', 'でも'], '거로': ['으로', '〜で', 'で'], '걸로': ['으로', '〜で', 'で'],
  '건가': ['인가', '〜なのか', 'なのか'], '건데': ['인데', '〜なんだけど', 'なんだけど'], '거라고': ['이라고', '〜だと', 'だと'], '거란': ['이라는', '〜という', 'という']
};
const KO_WHAT = {
  '뭘': ['무엇을', '何を'], '뭘로': ['무엇으로', '何で'], '뭔': ['무슨', '何の'], '뭔가': ['무엇인가', '何か'], '뭐야': ['무엇이야', '何だ・何なの'], '뭐지': ['무엇이지', '何だろう'],
  '뭐가': ['무엇이', '何が'], '뭐든': ['무엇이든', '何でも'], '뭐라고': ['무엇이라고', '何だって'], '뭐야?': ['무엇이야', '何だ・何なの'], '뭐냐': ['무엇이냐', '何だ・何なのか']
};
const KO_SHORT = {
  '내가': ['나가', '私が', '나'], '네가': ['너가', '君が', '너'], '제가': ['저가', '私が（ていねい）', '저'], '난': ['나는', '私は', '나'], '넌': ['너는', '君は', '너'],
  '내': ['나의', '私の', '나'], '그땐': ['그때는', 'その時は', '그때'], '이땐': ['이때는', 'この時は', '이때'],
  '얘긴': ['얘기는', '話は', '얘기'], '걘': ['그 아이는', 'あの子は', '걔'], '얜': ['이 아이는', 'この子は', '얘'], '넘': ['너무', 'すごく・あまりに', '너무'],
  '뭐라도': ['무엇이라도', '何でも', '뭐'], '누군가': ['누구인가', '誰か', '누구'], '어딘가': ['어디인가', 'どこか', '어디'], '언젠가': ['언제인가', 'いつか', '언제'], '무언가': ['무엇인가', '何か', '무엇']
};
function koShortInfo(tok){
  let key = KO_SHORT[tok] ? tok : null, pt = '';
  if(!key){ key = ['누군가', '어딘가', '언젠가', '무언가', '내게', '네게', '제게', '니들', '저들', '언제부턴가'].find(k => tok.length > k.length && tok.startsWith(k) && KO_PART_TABLE[tok.slice(k.length)]); if(key) pt = tok.slice(key.length); }
  if(!key) return null;
  const [orig, ja, base] = KO_SHORT[key];
  const parts = [{ k: base, d: '' }, { k: key + '＝' + orig, d: ja }];
  let jj = ja;
  if(pt){ const pj = KO_PART_TABLE[pt]; parts.push({ k: pt, d: pj[0] }); jj = ja.split('・')[0] + ((/^(어디|어딘가)$/.test(key) && /^(로|으로)$/.test(pt)) ? 'へ' : (pj[1] || '')); }
  return { head: base, rest: tok, ja: jj, parts, note: `${key} は ${orig} の縮まった形です`, mean: ja, msg: '会話でよく使う縮まった形です。辞書には載っていない形です' };
}
function koDemoInfo(tok){
  const si = koShortInfo(tok);
  if(si) return si;
  if(!KO_WHAT[tok]){
    // 助詞が付けられるのは「뭔가（何か）」「뭐든（何でも）」だけ（뭘＝무엇을 などは、もう助詞が入っている）
    const wk = ['뭔가', '뭐든'].find(k => tok.length > k.length && tok.startsWith(k) && KO_PART_TABLE[tok.slice(k.length)]);
    if(wk){
      const [orig, ja] = KO_WHAT[wk], pt = tok.slice(wk.length), pj = KO_PART_TABLE[pt];
      const jj = ja.split('・')[0] + (pj[1] || '');
      return { head: '뭐', rest: tok, ja: jj, parts: [{ k: '뭐', d: '（＝무엇、何）' }, { k: wk + '＝' + orig, d: ja }, { k: pt, d: pj[0] }], note: `${wk} は ${orig} の縮まった形です`, mean: '何', msg: '会話でよく使う縮まった形です。辞書には載っていない形です' };
    }
  }
  if(KO_WHAT[tok]){
    const [orig, ja] = KO_WHAT[tok];
    return { head: '뭐', rest: tok, ja, parts: [{ k: '뭐', d: '（＝무엇、何）' }, { k: tok + '＝' + orig, d: ja }], note: `${tok} は ${orig} の縮まった形です`, mean: '何', msg: '会話でよく使う縮まった形です。辞書には載っていない形です' };
  }
  const b = KO_DEMO_BASE[tok[0]], end = tok.slice(1);
  if(!b || !(end in KO_DEMO_END)) return null;
  const [orig, d, j] = KO_DEMO_END[end];
  const full = b[0] + orig;
  const ja = b[1] + j;
  const parts = [{ k: b[0], d: '（' + b[1] + '）' }];
  if(orig) parts.push({ k: tok + '＝' + full, d });
  return { head: b[0], rest: end, ja, parts, note: orig ? `${tok} は ${full} の縮まった形です` : `${tok} は ${b[0]} の話し言葉です`, mean: b[1], msg: 'これ・それ・あれ（이것・그것・저것）が縮まった形です。辞書には載っていない形です' };
}

// 辞書に無い語（名前など）が、はっきりした助詞で終わっているとき、その前を名詞とみなす
const KO_NOUN_TAILS = ['에서부터','에게서','한테서','으로서','으로써','에서는','에게는','이라고','라고','이라는','라는','에서','에게','한테','께서','까지','부터','처럼','보다','마저','조차','밖에','이랑'];
function koNounGuess(eojeol){
  const t = KO_NOUN_TAILS.find(x => eojeol.length > x.length && eojeol.endsWith(x));
  return t ? eojeol.slice(0, -t.length) : null;
}

/* ══════ 追加（d・e・f の本文から） ══════ */
(function(){
  const addMissing = (o, add) => Object.keys(add).forEach(k => { if(!(k in o)) o[k] = add[k]; });
  addMissing(KO_EXTRA_DICT, {
    '다들': ['副', 'みんな'], '딥페이크': ['名', 'ディープフェイク'], '클라우드': ['名', 'クラウド'], '메인': ['名', 'メイン'], '히로인': ['名', 'ヒロイン'],
    '서사': ['名', 'ストーリー・叙事'], '스크립트': ['名', 'スクリプト・台本'], '스킬': ['名', 'スキル'], '페널티': ['名', 'ペナルティ'], '클리어': ['名', 'クリア'],
    '코인': ['名', 'コイン'], '아바타': ['名', 'アバター'], '로고': ['名', 'ロゴ'], '맨투맨': ['名', 'トレーナー（スウェット）'], '스트림': ['名', 'ストリーム'],
    '망캐': ['名', 'ダメキャラ・不遇キャラ（俗）'], '등신대': ['名', '等身大パネル'], '반경': ['名', '半径'], '나노': ['名', 'ナノ'],
    '하나둘': ['副', '一つ二つ・ちらほら'], '보아하니': ['副', '見たところ'], '한사람': ['名', '一人'], '십여': ['数', '十余り'],
    '앱': ['名', 'アプリ'], '잠시간': ['名', 'しばらくの間'], '회차': ['名', '話数・回'], '작중': ['名', '作中'], '충무로': ['名', 'チュンムロ（地名）'],
    '중고등학생': ['名', '中高生'], '총개수': ['名', '総数'], '중년인': ['名', '中年の人'], '피지컬': ['名', 'フィジカル・体格'],
    '괜하다': ['形', '余計だ・無駄だ'], '허여멀겋다': ['形', '生っ白い'], '헌앙하다': ['形', '凛々しい・堂々としている'], '리얼하다': ['形', 'リアルだ'],
    '궁금해하다': ['動', '気にする・知りたがる']
  });
  Object.assign(KO_PREF_JA, {
    '연기하다': '演じる・延期する', '입안': '口の中・立案', '맡다': '引き受ける・嗅ぐ', '대사': '台詞・大使', '보상': '報酬・補償', '문신': '入れ墨・文臣',
    '기사': '記事・騎士・運転手', '슬슬': 'そろそろ・こっそり', '금방': 'すぐ・今さっき', '낫다': 'ましだ・治る', '까먹다': '忘れる（俗）・使い果たす',
    '댓글': 'コメント・レス', '닥치다': '黙る（俗）・迫る', '체하다': '〜ふりをする・もたれる', '분기': '分岐・四半期', '가늠하다': '見当をつける・推し量る',
    '고르다': '選ぶ・整える', '전하다': '伝える・伝わる', '구하다': '救う・求める', '밝히다': '明かす・照らす', '궁금해하다': '気にする・知りたがる',
    '빌다': '祈る・願う・借りる'
  });
  Object.assign(KO_PREF_EXACT, { '채': 'まだ（〜しないうちに）・〜したまま', '오': 'おお（感嘆）・五', '흠': 'ふむ・傷', '참': 'とても・本当に', '씩': 'にやっと・〜ずつ' });
  addMissing(KO_SHORT, {
    '내게': ['나에게', '私に', '나'], '네게': ['너에게', '君に', '너'], '제게': ['저에게', '私に（ていねい）', '저'],
    '여긴': ['여기는', 'ここは', '여기'], '거긴': ['거기는', 'そこは', '거기'], '저긴': ['저기는', 'あそこは', '저기'],
    '누굴': ['누구를', '誰を', '누구'], '니들': ['너희들', 'お前ら（くだけた）', '너'], '어디선가': ['어디에서인가', 'どこかで・どこからか', '어디'],
    '이봐요': ['이 보아요', 'ちょっと・ねえ（呼びかけ）', '보다'], '이봐': ['이 보아', 'おい・ちょっと（呼びかけ）', '보다']
  });
  addMissing(KO_DEMO_END, { '거라': ['이라', '〜だと（〜だろうと）', 'だと'], '거라면': ['이라면', '〜なら', 'なら'] });
  addMissing(KO_END_TABLE, {
    '어봐도': ['〜してみても', 'してみても'], '어봐야': ['〜してみたところで', null], '어봤자': ['〜したところで', null],
    '어야만': ['〜してこそ・〜しなければ（ならない）', null], '어야지': ['〜しなくちゃ・〜すべきだ', null], '었어야지': ['〜するべきだった（のに）', null], '었어야': ['〜するべきだった', null],
    '구만': ['〜だなあ（くだけた）', null], '구먼': ['〜だなあ（くだけた）', null], '시오': ['〜しなさい（かたい命令）', null],
    'ㅂ시다': ['〜しましょう', 'しましょう'], '읍시다': ['〜しましょう', 'しましょう']
  });
  addMissing(KO_PART_TABLE, {
    '였으면': ['〜だったら', 'だったら'], '이신지': ['〜でいらっしゃるのか', 'なのか'], '신지': ['〜でいらっしゃるのか', 'なのか'],
    '입니까': ['〜ですか', 'ですか'], '이어서': ['〜なので', 'なので'], '여서': ['〜なので', 'なので'], '이었지': ['〜だったよね・〜だった', 'だった'], '였지': ['〜だったよね・〜だった', 'だった'],
    '이기': ['〜であること', 'であること'], '일까요': ['〜でしょうか', 'でしょうか'], '씩': ['〜ずつ', 'ずつ'], '이었음': ['〜だった（こと）', 'だった'], '였음': ['〜だった（こと）', 'だった'],
    '일지도': ['〜かもしれない', 'かもしれない']
  });
  ['씩'].forEach(k => { if(!KO_PARTICLES.includes(k)) KO_PARTICLES.push(k); });
  ['이었으면', '이었던', '이었고', '이었는데', '이었지만', '이었으니까', '이었지', '이었어', '이었어요', '이었습니다', '이었음', '일지도', '일지', '일까', '일까요', '이신지', '입니까', '이어서', '이니까', '이면', '이라면', '이라서', '이기', '이지만', '이던', '이겠지', '인지', '인가', '인데']
    .forEach(k => { if(!KO_COPULA.includes(k)) KO_COPULA.push(k); });
  ['일지도', '일까요', '였지', '였음', '신지', '여서'].forEach(k => { if(!KO_COP_V.includes(k)) KO_COP_V.push(k); });
  ['거', '곤'].forEach(k => { if(!KO_VERB_REST.includes(k)) KO_VERB_REST.push(k); });
  addMissing(KO_COUNTER_JA, { '분간': '分間', '년간': '年間', '일간': '日間', '주간': '週間' });
  ['분간', '년간', '일간', '주간'].forEach(k => KO_COUNTER_ANY.add(k));
  addMissing(KO_GEO_REST, { '라': ['＝라고（〜と）', '〜だろうと', '〜ということだと'], '라면': ['〜なら', '〜するのなら', '〜ということなら'] });
  addMissing(KO_END_TABLE, { '어줍시다': ['〜してあげましょう・（みんなで）〜しましょう', null] });
})();

/* 本文の上の意味：前の語とセットのときは、補助の意味を出す（쓰고 있는＝ている、써 봐야＝みる） */
function koAuxGloss(prev, cur){
  prev = String(prev || ''); cur = String(cur || '');
  if(!prev || !cur) return '';
  if(/고$/.test(prev)){ if(/^계/.test(cur)) return 'ていらっしゃる'; if(/^있/.test(cur)) return 'ている'; if(/^싶/.test(cur)) return 'たい'; }
  if(/[^이]야$/.test(prev) && /^(하|해|했|한|할|합|되|돼|됐|된|될|됩)/.test(cur)) return 'ならない';
  if(/게$/.test(prev) && /^(되|돼|됐|된|될|됩)/.test(cur)) return 'ようになる';
  if(/지$/.test(prev)){ if(/^(않|안)/.test(cur)) return 'ない'; if(/^못/.test(cur)) return 'できない'; if(/^(말|마)/.test(cur)) return 'ないで'; }
  if(EO_A.test(prev) && _koDict && koIsVerbTok(prev, true)){
    if(/^(보|봐|봤|본|볼|봅)/.test(cur)) return 'みる';
    if(/^(드리|드려|드렸|드린|드릴|드립)/.test(cur)) return '差し上げる';
    if(/^(주|줘|줬|준|줄|줍)/.test(cur)) return 'くれる・あげる';
    if(/^(버리|버려|버렸|버린|버릴)/.test(cur)) return 'しまう';
    if(/^(놓|놨|둬|두|뒀|둔|둘)/.test(cur)) return 'おく';
    if(/^있/.test(cur)) return 'ている（状態）';
  }
  return '';
}
(function(){
  const addMissing = (o, add) => Object.keys(add).forEach(k => { if(!(k in o)) o[k] = add[k]; });
  Object.assign(KO_PREF_JA, {
    '일단': 'とりあえず・ひとまず・一旦', '잠시': 'しばらく・少しの間', '머릿속': '頭の中', '아저씨': 'おじさん', '이곳': 'ここ', '저곳': 'あそこ', '그곳': 'そこ',
    '이대로': 'このまま', '그대로': 'そのまま', '저렇게': 'あんなに・あのように', '때문': '〜のせい・〜ため', '모습': '姿・様子', '모양': '様子・形・模様',
    '이상하다': '変だ・おかしい', '눈앞': '目の前', '하마터면': '危うく', '은근슬쩍': 'こっそり・さりげなく', '몇': 'いくつ・何〜・いくつか',
    '방금': 'さっき・今しがた', '그냥': 'ただ・なんとなく・そのまま', '딱히': '別に・特に', '이벤트': 'イベント', '이분': 'この方', '그분': 'その方・あの方',
    '이래저래': 'あれこれ', '이미': 'もう・すでに', '크다': '大きい・育つ', '메뚜기': 'バッタ', '바퀴벌레': 'ゴキブリ'
  });
  Object.assign(KO_PREF_EXACT, { '한': '一つの・ある〜・一', '시': '〜時（とき）・市', '의': '〜の' });
  addMissing(KO_EXTRA_DICT, {
    '등가': ['名', '等価'], '환풍구': ['名', '換気口'], '턱짓': ['名', 'あごで示すこと'], '극초반': ['名', '序盤・最初のほう'], '첫번째': ['名', '1番目・最初'],
    '이번에야말로': ['副', '今度こそ'], '한테는': ['助', '〜には（人）'], '라든가': ['助', '〜とか'], '장난스레': ['副', 'いたずらっぽく'],
    '보송하다': ['形', 'さらっとした・ふわふわの'], '서글서글하다': ['形', '人当たりがいい・気さくだ'], '서글서글': ['副', '人当たりよく・気さくに'],
    '해대다': ['動', '〜しまくる・やたらとする'], '만져지다': ['動', '触れる・手に触れる'], '행성계': ['名', '惑星系'], '채집통': ['名', '採集容器'],
    '메뚜기알': ['名', 'バッタの卵'], '모음집': ['名', '作品集・まとめ集'], '백여': ['数', '百余り'], '이젠': ['副', '今は・もう（＝이제는）'],
    '금호': ['名', 'クムホ（地名）'], '금호역': ['名', 'クムホ駅（地名）'], '위튜브': ['名', 'ウィーチューブ（YouTubeのもじり）'], '난수': ['名', '乱数'],
    '스타팅': ['名', 'スターティング・開始時の'], '괴물놈': ['名', '化け物野郎'], '탐사자': ['名', '探査者']
  });
  addMissing(KO_SHORT, {
    '저들': ['저 사람들', 'あいつら・彼ら', '저'], '언제부턴가': ['언제부터인가', 'いつからか', '언제'], '뭔진': ['무엇인지는', '何なのかは', '뭐']
  });
  addMissing(KO_WHAT, { '뭘까': ['무엇일까', '何だろう'], '뭘까요': ['무엇일까요', '何でしょう'] });
  addMissing(KO_PART_TABLE, { '이었기': ['〜だったこと（〜기）', 'だったこと'], '였기': ['〜だったこと（〜기）', 'だったこと'], '한테는': ['〜には（人）', 'には'], '이여': ['〜よ（呼びかけ）', 'よ'] });
  ['이었기', '일'].forEach(k => { if(!KO_COPULA.includes(k)) KO_COPULA.push(k); });
  ['였기'].forEach(k => { if(!KO_COP_V.includes(k)) KO_COP_V.push(k); });
  ['한테는'].forEach(k => { if(!KO_PARTICLES.includes(k)) KO_PARTICLES.push(k); });
})();

/* 引用の縮まった形（다고 하는→다는 など）・〜다면・〜자면 をひとまとまりで */
(function(){
  const addMissing = (o, add) => Object.keys(add).forEach(k => { if(!(k in o)) o[k] = add[k]; });
  addMissing(KO_END_TABLE, {
    'ㄴ다는': ['〜するという（＝ㄴ다고 하는）', 'するという', 1], '는다는': ['〜するという（＝는다고 하는）', 'するという', 1], '다는': ['〜だという（＝다고 하는）', 'という', 1],
    '겠다는': ['〜するという・〜したいという', 'するという', 1], '냐는': ['〜かという（＝냐고 하는）', 'かという', 1], '었냐는': ['〜したのかという', 'したのかという', 1],
    '자는': ['〜しようという（＝자고 하는）', 'しようという', 1], '었다는': ['〜したという', 'したという', 1],
    'ㄴ다면': ['〜するなら（＝ㄴ다고 하면）', 'するなら'], '는다면': ['〜するなら', 'するなら'], '다면': ['〜なら（＝다고 하면）', 'なら'], '었다면': ['〜したなら', 'したなら'], '겠다면': ['〜するというなら', 'するなら'],
    '자면': ['〜しようとすると・〜するなら（말하자면＝言うなら）', null], '자니': ['〜していると・〜しようとすると', null], '자는데': ['〜しようと言うけど', null],
    'ㄴ다거나': ['〜するとか', 'するとか'], '는다거나': ['〜するとか', 'するとか'], '다거나': ['〜だとか', 'だとか'],
    'ㄴ다면서': ['〜すると言いながら・〜するんだって？', null], '다면서': ['〜だと言いながら・〜なんだって？', null], '겠다면서': ['〜すると言いながら・〜すると言ってたのに', null],
    '겠다고': ['〜だろうと・〜すると・〜したいと', null]
  });
  addMissing(KO_SHORT, {
    '누구길래': ['누구이길래', '誰だから・何者だからって', '누구'], '뭐길래': ['무엇이길래', '何だからって・何なので', '뭐'],
    '아니라는': ['아니라고 하는', '〜ではないという', '아니다'], '아니라고': ['아니다＋라고', '〜ではないと', '아니다']
  });
})();

/* ══════ 追加（ジャンル用語・意味の順番・古風な語尾 など） ══════ */
(function(){
  const addMissing = (o, add) => Object.keys(add).forEach(k => { if(!(k in o)) o[k] = add[k]; });
  addMissing(KO_EXTRA_DICT, {
    // ファンタジー・ゲーム
    '회귀자': ['名', '回帰者'], '빙의자': ['名', '憑依者'], '각성자': ['名', '覚醒者'], '등반자': ['名', '登攀者（塔を登る者）'], '상태창': ['名', 'ステータスウィンドウ'],
    '경험치': ['名', '経験値'], '인벤토리': ['名', 'インベントリ'], '퀘스트': ['名', 'クエスト'], '길드': ['名', 'ギルド'], '길드장': ['名', 'ギルド長'], '마나': ['名', 'マナ'],
    '마석': ['名', '魔石'], '마정석': ['名', '魔晶石'], '몬스터': ['名', 'モンスター'], '레이드': ['名', 'レイド'], '랭커': ['名', 'ランカー'], '튜토리얼': ['名', 'チュートリアル'],
    '능력치': ['名', '能力値・ステータス'], '각성석': ['名', '覚醒石'], '포션': ['名', 'ポーション'], '디버프': ['名', 'デバフ'], '탱커': ['名', 'タンク'], '힐러': ['名', 'ヒーラー'],
    '서포터': ['名', 'サポーター'], '히든': ['名', 'ヒドゥン・隠し'], '히든피스': ['名', '隠しアイテム'], '성기사': ['名', '聖騎士'], '마족': ['名', '魔族'], '마물': ['名', '魔物'],
    '드래곤': ['名', 'ドラゴン'], '엘프': ['名', 'エルフ'], '드워프': ['名', 'ドワーフ'], '고블린': ['名', 'ゴブリン'], '언데드': ['名', 'アンデッド'], '리치': ['名', 'リッチ（死霊の魔法使い）'],
    '뱀파이어': ['名', 'ヴァンパイア'], '정령': ['名', '精霊'], '정령사': ['名', '精霊使い'], '소환사': ['名', '召喚士'], '연금술사': ['名', '錬金術師'], '궁수': ['名', '弓手・アーチャー'],
    '암살자': ['名', '暗殺者'], '성기사단': ['名', '聖騎士団'], '대신관': ['名', '大神官'], '랭크': ['名', 'ランク'], '미드': ['名', 'ミッド（中央レーン）・アメドラ'], '팀운': ['名', 'チーム運'],
    // ロマンスファンタジー
    '황태자비': ['名', '皇太子妃'], '황녀': ['名', '皇女'], '황자': ['名', '皇子'], '공작가': ['名', '公爵家'], '공작부인': ['名', '公爵夫人'], '공녀': ['名', '公女（公爵令嬢）'],
    '후작': ['名', '侯爵'], '남작': ['名', '男爵'], '영애': ['名', '令嬢'], '영식': ['名', '令息'], '기사단': ['名', '騎士団'], '기사단장': ['名', '騎士団長'], '데뷔탕트': ['名', 'デビュタント'],
    '계약결혼': ['名', '契約結婚'], '정략결혼': ['名', '政略結婚'], '악녀': ['名', '悪女'], '여주': ['名', 'ヒロイン（女主人公）'], '남주': ['名', 'ヒーロー（男主人公）'], '서브남주': ['名', '当て馬（サブヒーロー）'],
    '황위': ['名', '皇位'],
    // 武侠
    '무림': ['名', '武林'], '내공': ['名', '内功'], '외공': ['名', '外功'], '심법': ['名', '心法'], '검법': ['名', '剣法'], '도법': ['名', '刀法'], '권법': ['名', '拳法'], '경공': ['名', '軽功'],
    '보법': ['名', '歩法'], '초절정': ['名', '超絶頂（武の境地）'], '화경': ['名', '化境（武の境地）'], '현경': ['名', '玄境（武の境地）'], '생사경': ['名', '生死境（武の境地）'], '혈도': ['名', '穴（ツボ）・経穴'],
    '주화입마': ['名', '走火入魔'], '환골탈태': ['名', '換骨奪胎'], '반로환동': ['名', '返老還童（若返り）'], '검기': ['名', '剣気'], '검강': ['名', '剣罡'], '협객': ['名', '侠客'], '마교': ['名', '魔教'],
    '사파': ['名', '邪派'], '마두': ['名', '魔頭'], '장문인': ['名', '掌門人（門派の長）'], '사매': ['名', '妹弟子'], '문파': ['名', '門派'], '세가': ['名', '世家'], '무림맹': ['名', '武林盟'], '객잔': ['名', '客桟（宿屋）'],
    '점소이': ['名', '店小二（給仕）'], '비급': ['名', '秘笈（秘伝書）'], '영약': ['名', '霊薬'], '독공': ['名', '毒功'], '검끝': ['名', '剣先'],
    // 現代・呼び方
    '상무': ['名', '常務'], '본부장': ['名', '本部長'], '주주총회': ['名', '株主総会'], '형씨': ['名', 'あんた・兄さん（くだけた呼びかけ）'], '소저': ['名', '小姐（お嬢さん）'], '노부': ['代', 'わし（老人の自称）'],
    '본좌': ['代', '本座（わし・偉い人の自称）'], '본녀': ['代', 'わらわ・私（女性の古風な自称）'], '이몸': ['代', 'この身・俺様'], '핵노잼': ['名', '超つまらない（俗）'], '레전드': ['名', 'レジェンド'], '갓생': ['名', '充実した生活（俗）'],
    '씨익': ['副', 'にやりと'], '냉혈한': ['名', '冷血漢'], '밥값': ['名', '食費・食い扶持（밥값을 하다＝働きに見合う）'], '속내': ['名', '本音・内心'], '짜증나다': ['動', 'イライラする・ムカつく'],
    '어라': ['感', 'あれ？・おや'], '일월수금': ['名', '日・月・水・金曜日'],
    // 外来語
    '스토리': ['名', 'ストーリー'], '스릴러': ['名', 'スリラー'], '멜로': ['名', 'メロドラマ・恋愛もの'], '로맨틱': ['名', 'ロマンチック'], '애니': ['名', 'アニメ'], '다큐': ['名', 'ドキュメンタリー'],
    '히어로': ['名', 'ヒーロー'], '엔딩': ['名', 'エンディング'], '피크닉': ['名', 'ピクニック'], '아이돌': ['名', 'アイドル'], '웹사이트': ['名', 'ウェブサイト']
  });
  Object.assign(KO_PREF_JA, {
    // ジャンルでよく使う意味を先に
    '검사': '検査・剣士・検事', '공작': '公爵・工作', '사제': '弟弟子・司祭', '사형': '兄弟子・死刑', '사저': '姉弟子・私邸', '신관': '神官・新館', '교단': '教団・教壇', '영주': '領主・永住',
    '자작': '子爵・自作', '전무': '専務・皆無', '과장': '課長・誇張', '저하': '邸下（世子への敬称）・低下', '마마': '（王族への敬称）・天然痘', '공자': '公子（若様）・孔子', '소인': '小人（へりくだった自称）',
    '외상': '外傷・掛け売り', '암기': '暗器・暗記', '정파': '正派・政派', '공대': '攻略隊（ゲーム）・工大', '환생': '転生・生まれ変わり', '초식': '招式（技の型）・草食', '공략': '攻略',
    // 意味の順番（ORVの話・ニュースなどから）
    '감상': '感想・鑑賞', '양': '量・羊', '폭음': '爆音・暴飲', '깜빡하다': 'うっかり忘れる・まばたく', '훔치다': '盗む・拭う', '상정하다': '想定する', '인기척': '人の気配', '뚝딱뚝딱': 'てきぱき・さっさと',
    '무리': '群れ・無理', '해': '日・太陽・年', '불': '火・明かり', '싸다': '安い・包む・（大小便を）する', '권': '冊・券', '공모전': 'コンテスト・公募', '놓치다': '逃す・取り逃がす', '비치다': '映る・照る',
    '바닥': '床・底・地面', '주머니': 'ポケット・袋', '외투': 'コート・外套', '구매': '購入', '구매하다': '購入する', '생김새': '見た目・顔立ち', '조카': '甥・姪', '사촌': 'いとこ', '음료수': '飲み物・ジュース',
    '승강장': 'ホーム・乗り場', '폭죽': '花火・クラッカー', '물방울': '水滴・しずく', '쳐다보다': '見つめる・見る', '섣불리': '軽はずみに・うかつに', '부라리다': '（目を）むく・にらみつける',
    '허탈하다': '虚しい・気が抜ける', '진심': '本心・真心', '아이디': 'ID', '황급히': '慌てて', '혼자': '一人で・独り', '답변': '返事・回答', '축하하다': '祝う・おめでとう', '그러니까': 'だから・つまり',
    '집다': 'つまむ・手に取る', '대학생': '大学生', '시절': '頃・時代', '공지하다': '告知する・お知らせする', '뒷모습': '後ろ姿', '상영관': '上映室・映画館', '살짝': '少し・そっと', '찌푸리다': 'しかめる',
    '마주치다': '（目が）合う・出くわす', '밥': 'ご飯・食事', '곧장': 'すぐに・まっすぐ', '해맑다': '無邪気だ・明るい', '저격하다': '狙撃する・撃ち抜く', '소소하다': 'ささやかだ・細かい', '학생': '学生・生徒',
    '챙기다': '（忘れずに）用意する・手に取る・気にかける', '룰렛판': 'ルーレット盤', '툭': 'ぽんと・ぽとっと', '어지럽다': 'くらくらする・散らかっている', '출렁거리다': 'ゆらゆら揺れる・波打つ',
    '사회초년생들': '新社会人たち', '놀림당하다': 'からかわれる', '끝자락': '終わり際・末', '충만감': '満ち足りた気持ち・充実感', '성의껏': '心を込めて・誠意をもって', '고고하다': '気高い・高潔だ',
    '재미': '面白さ・面白み', '교도관': '刑務官', '어설프다': '中途半端だ・下手だ', '엮다': 'つなげる・絡める・編む', '흐뭇해하다': '微笑ましく思う・満足に思う', '그새': 'いつの間にか・その間に',
    '고조되다': '高まる・盛り上がる', '공지되다': '告知される', '아이고': 'あらまあ・やれやれ', '홀리다': '惑わす・たぶらかす', '낯익다': '見覚えがある', '생전': '生まれてこのかた・生前', '쭉': 'ずっと・ずらっと',
    '안일하다': 'のんきだ・甘い', '고통받다': '苦しむ', '문밖': '扉の外・門の外', '급하다': '急いでいる・焦っている', '흥건하다': 'びしょびしょだ・水浸しだ', '놈': 'やつ・野郎', '넘어가다': '移る・過ぎる・倒れる',
    '다물다': '（口を）閉じる', '오래전': 'ずっと前', '미처': '（〜し）きれず・まだ', '담기다': '込められる・入る', '은근히': 'なんとなく・ひそかに', '뿌리다': 'まく・ばらまく', '소용': '役に立つこと・使い道',
    '걸치다': '羽織る・かける・またがる', '장난': 'いたずら・ふざけ', '송출': '送出・配信', '몸체': '体・胴体', '두드러지다': '目立つ', '씨름하다': '格闘する・取っ組み合う', '틈': '隙・すき間', '손안': '手の中',
    '어렴풋이': 'ぼんやり・かすかに', '불빛': '明かり・灯', '제발': 'どうか・お願いだから', '여부': '〜かどうか', '갸웃하다': '首をかしげる', '어우러지다': '入り混じる・調和する', '한동안': 'しばらく',
    '종전': '先ほどの・以前の', '맴돌다': 'ぐるぐる回る・付きまとう', '뭐하다': '何をする・何だ（気まずい）', '컥컥': 'げほげほ', '옅다': 'かすかだ・薄い', '쥐새끼': 'ネズミ（のようなやつ）', '쯧쯧': 'ちっちっ（舌打ち）',
    '이윽고': 'やがて', '문득': 'ふと', '불현듯': 'ふと・不意に', '심지어': 'さらには・しかも', '도저히': 'とても（〜ない）・到底', '목록': 'リスト・一覧', '손뼉': '手のひら（손뼉을 치다＝手を叩く）',
    '멈칫하다': 'ぎくっとする・一瞬止まる', '그저': 'ただ・単に', '허공': '宙・空中', '야': 'おい・やあ', '놀랍다': '驚くべきだ・驚いた', '와중': '最中', '정장': 'スーツ・正装', '담다': '入れる・詰める・込める',
    '계산': '会計・計算', '탄성': '歓声・感嘆の声', '당장': '今すぐ・当面', '문구': '文言・コピー', '웬': 'なんの・見知らぬ（웬 〜）', '함성': '歓声・叫び声', '차림': '服装・格好', '수많다': '数多い・たくさんの', '꼴': 'ざま・格好',
    '빤히': 'じっと', '철렁': 'どきっと（胸が）', '픽': 'ふっと（笑う）・ばたっと', '멈칫': 'ぎくっと・はたと', '다시다': '舌なめずりする（입맛을 다시다）',
    '경우': '場合・境遇', '폭발': '爆発', '폭발하다': '爆発する', '연쇄폭발': '連鎖爆発', '출연하다': '出演する', '출신': '出身', '밝혀지다': '明らかになる', '서울': 'ソウル', '정상': '頂上・正常',
    '한편': '一方・味方', '표': '票・表・切符', '잘하다': '上手だ・うまくやる', '안하다': 'しない（＝안 하다）', '진정하다': '落ち着く・鎮める', '주제': 'テーマ・身の程', '출전하다': '出場する',
    '호주': 'オーストラリア・戸主', '인도': 'インド・人道・引き渡し', '딱': 'ちょうど・ぴったり・きっぱり', '완전': '完全・めっちゃ（俗）', '이에': 'これに・これを受けて', '맘': '気持ち・心',
    '이분': 'この方', '그분': 'その方・あの方'
  });
  Object.assign(KO_PREF_EXACT, { '가': '〜が（助詞）・端', '은': '〜は（助詞）・銀', '에': '〜に（助詞）', '도': '〜も（助詞）・度', '과': '〜と（助詞）・課', '라': '〜という（引用）',
    '어라': 'あれ？・おや', '어이': 'おい（呼びかけ）', '맨': 'いちばん〜・〜だけ', '새': '新しい〜・鳥', '미': '米（アメリカ）・美', '밖에': '外に・〜しか', '차': '次（第〜次）・茶・車' });
  addMissing(KO_COUNTER_JA, { '배': '倍', '차': '次（第〜次）' });
  ['배', '차'].forEach(k => KO_COUNTER_ANY.add(k));
  Object.assign(KO_AFTER_ATTR, { '해': '年（〜した年）', '데': '所・こと（〜する데）', '식': 'やり方・〜という具合（〜는 식）' });
  addMissing(KO_SHORT, { '내의': ['내(内)＋의', '〜内の', '내'], '내에서': ['내(内)＋에서', '〜内で', '내'], '내에': ['내(内)＋에', '〜内に', '내'] });
  // 古風な語尾（時代劇・ロマンスファンタジー・武侠）・くっついた語尾
  addMissing(KO_END_TABLE, {
    '소': ['〜だ・〜である（古風・하오体）', null], '오': ['〜だ・〜である（古風・하오体）', null], '느냐': ['〜か（古風・目上から目下へ）', null], '으냐': ['〜か（古風）', null],
    '거라': ['〜しなさい（古風な命令）', null], '너라': ['〜しなさい（古風な命令）', null], '구려': ['〜だなあ（古風）', null], '는구려': ['〜するのだなあ（古風）', null],
    '나봐요': ['〜みたいです（＝나 봐요）', null], '나봐': ['〜みたいだ（＝나 봐）', null], '나보다': ['〜みたいだ（＝나 보다）', null], '나봅니다': ['〜ようです（＝나 봅니다）', null],
    'ㄴ가봐요': ['〜みたいです（＝ㄴ가 봐요）', null], 'ㄴ가봐': ['〜みたいだ（＝ㄴ가 봐）', null], 'ㄴ가보다': ['〜みたいだ', null], 'ㄴ가봅니다': ['〜ようです', null],
    'ㄹ텐데': ['〜だろうに・〜はずなのに（＝ㄹ 텐데）', null], 'ㄹ텐데요': ['〜だろうに（ていねい）', null], 'ㄹ테니까': ['〜だろうから・〜するから', null], 'ㄹ테니': ['〜だろうから', null], 'ㄹ테니까요': ['〜でしょうから', null],
    '답니다': ['〜だそうです・〜なんですよ', null], 'ㄴ답니다': ['〜するそうです・〜するんですよ', null], '는답니다': ['〜するそうです', null], '었답니다': ['〜したそうです', null],
    '대': ['〜だって（伝聞・＝다고 해）', null], 'ㄴ대': ['〜するって（伝聞）', null], '는대': ['〜するって（伝聞）', null], '겠대': ['〜するって（伝聞）', null], '었대': ['〜したって（伝聞）', null],
    '대요': ['〜だそうです（伝聞）', null], 'ㄴ대요': ['〜するそうです', null], '는대요': ['〜するそうです', null], '었대요': ['〜したそうです', null],
    '었으며': ['〜し・〜しており', null], '으며': ['〜しながら・〜し', null]
  });
  addMissing(KO_PART_TABLE, { '이오': ['〜である（古風）', 'である'], '이구나': ['〜だなあ', 'だなあ'], '구나': ['〜だなあ', 'だなあ'], '로구나': ['〜だなあ（古風）', 'だなあ'], '이로구나': ['〜だなあ（古風）', 'だなあ'],
    '이며': ['〜であり', 'であり'], '며': ['〜であり', 'であり'], '이었을까': ['〜だったのか（だろうか）', 'だったのか'], '였을까': ['〜だったのか', 'だったのか'], '이자': ['〜であり・〜でもある', 'であり'],
    '였나': ['〜だったか', 'だったか'], '이었나': ['〜だったか', 'だったか'], '아': ['〜よ（呼びかけ）', 'よ'], '야': ['〜だよ・〜よ（呼びかけ）', 'よ'], '이네': ['〜だね', 'だね'], '네': ['〜だね', 'だね'] });
  ['이오', '이구나', '로구나', '이로구나', '이며', '이었을까', '이자', '이었나', '이네'].forEach(k => { if(!KO_COPULA.includes(k)) KO_COPULA.push(k); });
  ['구나', '로구나', '며', '였을까', '였나', '네'].forEach(k => { if(!KO_COP_V.includes(k)) KO_COP_V.push(k); });
})();

/* ══════ 辞書（한국어기초사전）に入っている慣用句・ことわざ・文法表現を、本文の並びから見つける ══════
   例：군침이 흘렀다 → 「군침이 흐르다」、먹기 마련이다 → 「-기 마련이다」 */
let _koPhIdx = null;
function koPhVariants(w){
  // 구들장(을) → 구들장을／구들장、가렵다[간지럽다] → 가렵다／간지럽다
  let vs = [w.replace(/\[[^\]]*\]/g, '')];
  const alt = w.match(/\[([^\]]+)\]/);
  if(alt) alt[1].split(/[\/,]/).forEach(a => vs.push(a.trim()));
  const out = [];
  vs.forEach(v => { if(/\(([^)]*)\)/.test(v)){ out.push(v.replace(/\(([^)]*)\)/g, '$1')); out.push(v.replace(/\([^)]*\)/g, '')); } else out.push(v); });
  return out.filter((x, i, a) => x && a.indexOf(x) === i);
}
function koPhIndex(){
  if(_koPhIdx || !_koDict) return _koPhIdx;
  const idi = {}, gr = [];
  Object.keys(_koDict).forEach(k => {
    if(!/\s/.test(k)) return;
    const e = (_koDict[k] || [])[0]; if(!e || !e[1] || !e[1][0]) return;
    const ja = koJaShort(e[1][0]).split('・').slice(0, 2).join('・');
    if(!ja) return;
    if(k.startsWith('-')){
      const ws = k.slice(1).split(/\s+/);
      if(ws.length < 2 || ws.length > 4) return;
      const heads = ws[0].split('/').flatMap(koPhVariants);
      gr.push({ key: k, heads, rest: ws.slice(1).map(koPhVariants), ja });
    } else {
      const ws = k.split(/\s+/).filter(w => !/^[…·]+$/.test(w));
      if(ws.length < 2 || ws.length > 5) return;
      const vs = ws.map(koPhVariants);
      vs[0].forEach(f => { (idi[f] = idi[f] || []).push({ key: k, vs, ja }); });
    }
  });
  _koPhIdx = { idi, gr };
  return _koPhIdx;
}
// 最後の語：動詞・形容詞なら活用してもよい（흐르다 → 흘렀다）、名詞なら助詞が付いてもよい
function koPhLast(tok, vs){
  return vs.some(w => {
    if(tok === w) return true;
    if(/다$/.test(w) && w.length >= 2){
      try{ return koDictLookup(tok, '', '', 1).some(r => r.head === w && r.verb && r.full); }catch(_){ return false; }
    }
    return tok.startsWith(w) && tok.length - w.length <= 3;
  });
}
// 文法の前の部分（-기・-ㄹ・-ㄴ가・-아/어 など）が、語の終わりに合うか
function koPhTail(tok, x){
  if(!tok || !x) return false;
  if(/^[ㄱ-ㅎ]/.test(x)){
    if(koIsVerbTok(tok, false) !== true) return false;
    const j = { 'ㄴ': 4, 'ㄹ': 8, 'ㅁ': 16, 'ㅂ': 17 }[x[0]];
    if(!j) return false;
    const rest = x.slice(1);
    if(!tok.endsWith(rest) || tok.length <= rest.length) return false;
    const d = koDec(tok[tok.length - rest.length - 1]);
    return !!d && d.T === j && tok.length - rest.length >= 1;
  }
  if(x === '아' || x === '어' || x === '여') return EO_A.test(tok) && koIsVerbTok(tok, true) === true;
  return tok.length > x.length && tok.endsWith(x) && koIsVerbTok(tok, false) === true;
}
function koDictPhraseNotes(toks, i, end, hasHand){
  const ix = koPhIndex();
  if(!ix || !toks || i < 0) return [];
  const out = [], seen = new Set();
  const brk = j => end && end[j];                              // 文の終わりはまたがない
  // 慣用句・ことわざ・名詞句（長いものを先に。その中に入る短いもの・同じ範囲のものは出さない）
  const cand = [];
  const inside = (a, b) => a.st >= b.st && a.st + a.n <= b.st + b.n;
  for(let st = Math.max(0, i - 4); st <= i; st++){
    let ok = true; for(let j = st; j < i; j++) if(brk(j)) ok = false;
    if(!ok) continue;
    (ix.idi[toks[st]] || []).forEach(p => {
      const n = p.vs.length;
      if(st + n - 1 < i || st + n > toks.length || seen.has(p.key)) return;
      for(let j = st; j < st + n - 1; j++) if(brk(j)) return;
      for(let q = 1; q < n - 1; q++) if(!p.vs[q].includes(toks[st + q])) return;
      if(!koPhLast(toks[st + n - 1], p.vs[n - 1])) return;
      seen.add(p.key);
      if(hasHand && n === 2) return;                            // 同じ2語の説明がもうあるとき
      cand.push({ st, n, key: p.key, text: `「${toks.slice(st, st + n).join(' ')}」は「${p.key}」＝${p.ja}（辞書の言い回し）` });
    });
  }
  cand.sort((a, b) => b.n - a.n).forEach(c => { if(!out.some(o => inside(c, o))) out.push(c); });
  // 文法表現（-기 마련이다・-나 보다・-는 바람에 …）
  if(!hasHand){
    for(let st = Math.max(0, i - 3); st <= i; st++){
      ix.gr.forEach(g => {
        if(seen.has(g.key)) return;
        const n = 1 + g.rest.length;
        if(st + n - 1 < i || st + n > toks.length) return;
        for(let j = st; j < st + n - 1; j++) if(brk(j)) return;
        if(!g.heads.some(h => koPhTail(toks[st], h))) return;
        for(let q = 0; q < g.rest.length - 1; q++) if(!g.rest[q].includes(toks[st + 1 + q])) return;
        if(!koPhLast(toks[st + n - 1], g.rest[g.rest.length - 1])) return;
        seen.add(g.key);
        const span = st + '|' + n;
        if(out.some(o => o.ja === g.ja || o.span === span || (o.n && inside({ st, n }, o)))) return;
        out.push({ span, ja: g.ja, key: g.key, text: `「${toks.slice(st, st + n).join(' ')}」は「${g.key}」＝${g.ja}（辞書の文法）` });
      });
    }
  }
  return out.slice(0, 3);
}

/* ══════ 似た言葉を重ねた言い方（이 모양 이 꼴・우물쭈물 など）・音や様子の言葉 ══════ */
(function(){
  const addMissing = (o, add) => Object.keys(add).forEach(k => { if(!(k in o)) o[k] = add[k]; });
  addMissing(KO_EXTRA_DICT, {
    '이 모양 이 꼴': ['', 'こんなざま・こんな有様（似た言葉を重ねて強調）'], '이 꼴 저 꼴': ['', 'あれこれの醜態・みっともない姿の数々'],
    '왔다 갔다': ['', '行ったり来たり'], '들락날락': ['副', '出たり入ったり'], '아기자기': ['副', 'こまごまとかわいらしく'],
    '이판사판': ['名', 'やけくそ・どうにでもなれ'], '이도 저도 아닌': ['', 'どっちつかずの'], '앞뒤 가리지 않고': ['', '後先考えずに'],
    '물불을 가리지 않고': ['', '手段を選ばず・何が何でも'], '옹기종기': ['副', '寄り集まって・ちょこんと並んで'], '비척비척': ['副', 'よろよろ'],
    '얼씨구절씨구': ['感', 'いいぞいいぞ（はやし言葉）'], '어리둥절': ['副', 'きょとんと・面食らって'], '이러지도 저러지도': ['', 'どうにもこうにも（〜できない）'],
    '여차저차': ['副', 'かくかくしかじか'], '이차저차': ['副', 'かくかくしかじか'], '흐리멍덩': ['副', 'ぼんやり・いい加減に'],
    '엎치락뒤치락': ['副', '追いつ追われつ・二転三転'], '이래도 저래도': ['', 'どうやっても・どっちにしても'], '이래저래': ['副', 'あれこれ（で）・なんだかんだで']
  });
  Object.assign(KO_PREF_JA, {
    '이리저리': 'あちこち・あれこれ', '흥청망청': '浮かれ騒いで・湯水のように（使う）', '오밀조밀': 'こぢんまりと・細々と', '알쏭달쏭': 'よく分からない・はっきりしない',
    '산전수전': '海千山千（산전수전 다 겪다＝修羅場をくぐる）', '좌충우돌': '手当たり次第にぶつかる・右往左往', '천방지축': 'むちゃくちゃに・あわてふためいて',
    '애지중지': '大事に大事に（かわいがる）', '요리조리': 'あちこちと・うまく（かわす）', '울며 겨자 먹기': 'いやいや仕方なく（泣きながら芥子を食べる）',
    '먹고 살다': '食べていく・生活する', '이러나저러나': 'どっちにしても・ところで', '그럭저럭': 'なんとか・どうにか', '아옹다옹': 'いがみ合って・言い争って',
    '빙글빙글': 'くるくる・にこにこ', '훌쩍훌쩍': 'しくしく（泣く）・ちびちび', '콩닥콩닥': 'どきどき（胸が）・とんとん', '활활': 'めらめら（燃える）',
    '모락모락': 'もくもく（湯気・煙）・すくすく', '쩝쩝': 'くちゃくちゃ・ちっ（舌打ち）', '쭈뼛쭈뼛': 'おずおず・もじもじ', '쭈뼛': 'ぞくっと（髪が逆立つ）・おずおず',
    '기웃기웃': 'きょろきょろ（覗き込む）', '이글이글': 'めらめら・ぎらぎら', '씩씩': 'はあはあ・ふんふん（怒って）', '폴짝': 'ぴょんと', '펑펑': 'ぽろぽろ（泣く）・どんどん・ぱんぱん',
    '이것저것': 'あれこれ（似た言葉を重ねて）', '우물쭈물': 'ぐずぐず・もたもた（似た音を重ねて）', '오락가락': '行ったり来たり・降ったりやんだり', '이러쿵저러쿵': 'ああだこうだ・どうのこうの',
    '티격태격': 'ああだこうだと言い争って', '갈팡질팡': '右往左往・おろおろ', '허둥지둥': 'あたふた', '엉망진창': 'めちゃくちゃ', '뒤죽박죽': 'ごちゃごちゃ・めちゃくちゃ',
    '울고불고': '泣きわめいて', '싱숭생숭': 'そわそわ・落ち着かない', '안절부절': 'そわそわ・やきもき（안절부절못하다＝落ち着かない）', '긴가민가': 'そうかどうか（はっきりしない）'
  });
})();

// ===== 訳のチェック（自分のGeminiキーで、端末から直接）=====
// キーはこの端末の localStorage だけに保存。同期・バックアップには入らない。
const KO_GEMINI_KEY_LS = LS_PREFIX + 'ko-gemini-key';
const KO_GEMINI_MODEL = 'gemini-3.8-flash';
function koGeminiKey(){ try{ return localStorage.getItem(KO_GEMINI_KEY_LS) || ''; }catch(e){ return ''; } }
function koGeminiKeySave(){
  const el = document.getElementById('ko-gem-key'); if(!el) return;
  const v = el.value.trim();
  try{ if(v) localStorage.setItem(KO_GEMINI_KEY_LS, v); else localStorage.removeItem(KO_GEMINI_KEY_LS); }catch(e){}
  koTrCheck();
}
function koGeminiKeyForget(){
  try{ localStorage.removeItem(KO_GEMINI_KEY_LS); }catch(e){}
  const out = document.getElementById('ko-tr-chk-out'); if(out) out.innerHTML = '<div class="ko-note">キーを消したよ。</div>';
}
function koTrKeyForm(out, msg){
  out.innerHTML = `<div class="ko-note">${msg || 'AIチェックには自分の Gemini APIキーが必要だよ。キーはこの端末にだけ保存されて、同期やバックアップには入らないよ。'}<br>
    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">→ Google AI Studio でキーを作る</a></div>
    <input id="ko-gem-key" class="ko-input" type="password" autocomplete="off" placeholder="APIキーを貼ってね">
    <div class="ko-actions"><button class="ko-save" onclick="koGeminiKeySave()">保存してチェック</button></div>`;
}
let koTrChkBusy = false;
async function koTrCheck(){
  const out = document.getElementById('ko-tr-chk-out');
  const body = document.getElementById('ko-sheet-body');
  const ta = document.getElementById('ko-tr-edit');
  if(!out || !ta || koTrChkBusy) return;
  const ko = (body && body.dataset.trPlain) || '';
  const ja = ta.value.trim();
  if(!ja){ out.innerHTML = '<div class="ko-note">先に自分の訳を書いてね。</div>'; return; }
  const key = koGeminiKey();
  if(!key){ koTrKeyForm(out); return; }
  const prompt = `あなたは韓国語→日本語翻訳の先生です。学習者の訳をチェックしてください。
原文（韓国語）:
${ko}

学習者の訳（日本語）:
${ja}

次の形式で、やさしく短く日本語で答えてください（全体で200字くらいまで）。
判定: ◎ / ○ / △ のどれか（◎=ほぼ完璧、○=意味は合っている、△=誤訳あり）
よい点: 1行
直すと良い点: 誤訳や不自然な所を箇条書き（なければ「なし」）。原文の該当語も添える
訳例: 自然な日本語訳を1つ`;
  koTrChkBusy = true;
  out.innerHTML = '<div class="ko-note">チェック中…</div>';
  try{
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${KO_GEMINI_MODEL}:generateContent`, {
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body: JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{temperature:0.3}})
    });
    if(r.status === 400 || r.status === 401 || r.status === 403){
      let t=''; try{ t = (await r.json()).error.message || ''; }catch(e){}
      if(/api key|API_KEY|permission|unauth/i.test(t) || r.status !== 400){ koTrKeyForm(out, 'キーが使えないみたい。もう一度貼ってみてね。'); return; }
      throw new Error(t || ('HTTP ' + r.status));
    }
    if(r.status === 429){ out.innerHTML = '<div class="ko-note">使いすぎで一時的に止められてるよ。少し待ってからもう一度ね。</div>'; return; }
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const txt = ((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(x=>x.text||'').join('').trim();
    if(!txt) throw new Error('空の返事');
    out.innerHTML = `<div class="ko-trchk-res">${escapeHtml(txt).replace(/\*\*/g,'').replace(/\n/g,'<br>')}</div>
      <div class="ko-note" style="font-size:11px;opacity:.7">AIの答えは間違うこともあるよ。 <a href="#" onclick="koGeminiKeyForget();return false;">キーを消す</a></div>`;
  }catch(e){
    out.innerHTML = `<div class="ko-note">うまくいかなかった…（${escapeHtml(String(e.message||e))}）</div>`;
  }finally{ koTrChkBusy = false; }
}

// ===== 文法帳（語尾・言い回しの説明を★で保存。例文も一緒に） =====
const KO_GRAM_LS = LS_PREFIX + 'ko-gram';
function koGramAll(){ try{ return JSON.parse(localStorage.getItem(KO_GRAM_LS) || '{}') || {}; }catch(_){ return {}; } }
function koGramSaveAll(g){ try{ localStorage.setItem(KO_GRAM_LS, JSON.stringify(g)); }catch(_){} }
function koGramList(){ return Object.entries(koGramAll()).filter(([, v]) => v && !v.x).map(([id, v]) => Object.assign({ id }, v)); }
function koGramHas(id){ const v = koGramAll()[id]; return !!(v && !v.x); }
function koGramMerge(a, b){
  const out = {};
  new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach(k => {
    const x = (a || {})[k], y = (b || {})[k];
    const w = x && y ? ((y.u || '') > (x.u || '') ? y : x) : (x || y);
    if(w && w.x && (w.u || '') < new Date(Date.now() - 180 * 864e5).toISOString()) return;
    if(w) out[k] = w;
  });
  return out;
}
// 助詞（을・는 など）や「〜する（いま）」のような毎回出る形は★を出さない
const KO_GRAM_SKIP = /^(었다|았다|였다|했다|었어|았어|였어|었습니다|았습니다|었어요|았어요|어|아|여|어요|아요|해요|는다|ㄴ다|은다|합니다|이|가|을|를|은|는|의|에|도|만|와|과|로|으로|에서|에게|한테|께|다|요|고|게|지|기|음|ㅁ|ㄴ|은|는|ㄹ|을|던|았|었|였|했|겠|시|으시|들|님|씨|이다|입니다|습니다|ㅂ니다)$/;
function koGramPartOk(p){ return p && p.k && p.d && (koGramBasicOn() ? !/^(이|가|을|를|은|는|의|에|도|만|와|과)$/.test(String(p.k)) : !KO_GRAM_SKIP.test(String(p.k).replace(/^[-〜~]/, ''))); }
const KO_GRAM_BASIC_LS = LS_PREFIX + 'ko-gram-basic';
function koGramBasicOn(){ try{ return localStorage.getItem(KO_GRAM_BASIC_LS) === '1'; }catch(_){ return false; } }
function koSetGramBasic(on){ try{ localStorage.setItem(KO_GRAM_BASIC_LS, on ? '1' : '0'); }catch(_){} }
function koGramFromPart(p){ const k = String(p.k).replace(/^[-〜~]/, ''); return { id: 'p:' + k + '|' + p.d, k: '〜' + k, t: p.d }; }
function koGramFromNote(x){
  if(!x || /辞書に無い|推測|縮まった形|話し言葉です|の形なので/.test(x)) return null;
  let t = String(x).replace(/^(次|前)の「[^」]*」と合わせて/, '').trim().replace(/^「([^「」]*)」$/, '$1');
  const m = t.match(/（([^（）]*[가-힣][^（）]*)）\s*$/);
  const k = m ? m[1] : '';
  if(m) t = t.slice(0, m.index).trim().replace(/^「([^「」]*)」$/, '$1');
  return { id: 'n:' + (k || t), k, t };
}
function koGramToggle(i, btn){
  const g = (window._koGramCand || [])[i]; if(!g) return;
  const all = koGramAll(), now = new Date().toISOString();
  const cur = all[g.id];
  if(cur && !cur.x){
    all[g.id] = { x: 1, u: now };
    if(btn){ btn.classList.remove('on'); btn.textContent = '☆'; }
    showToast('文法帳から外したよ');
  }else{
    const ex = _koCur && _koCur.sentence ? [_koCur.sentence.trim().slice(0, 120)] : [];
    all[g.id] = { k: g.k, t: g.t, ex, exw: ex.length ? [_koCur.eojeol] : [], w: _koCur ? _koCur.eojeol : '', at: now, u: now, n: 1 };
    if(btn){ btn.classList.add('on'); btn.textContent = '★'; }
    showToast('文法帳に入れたよ');
  }
  koGramSaveAll(all); koSyncSoon();
}
// もう入っている文法にまた出会ったら、例文を足す（3つまで）
function koGramSeen(){
  if(!_koCur || !_koCur.sentence) return;
  const all = koGramAll(); let ch = false;
  (window._koGramCand || []).forEach(g => {
    const v = all[g.id]; if(!v || v.x) return;
    const sn = _koCur.sentence.trim().slice(0, 120);
    v.ex = v.ex || [];
    if(!v.ex.includes(sn)){ v.exw = v.exw || v.ex.map(() => v.w || ''); v.ex.unshift(sn); v.exw.unshift(_koCur.eojeol || ''); v.ex = v.ex.slice(0, 3); v.exw = v.exw.slice(0, 3); v.n = (v.n || 1) + 1; v.u = new Date().toISOString(); ch = true; }
  });
  if(ch){ koGramSaveAll(all); koSyncSoon(); }
}
function koGramDel(id){
  const all = koGramAll(); all[id] = { x: 1, u: new Date().toISOString() };
  koGramSaveAll(all); koSyncSoon(); openKoGram(document.getElementById('ko-gram-q') ? document.getElementById('ko-gram-q').value : '');
}
function koGramHl(sent, w){
  const e = escapeHtml(sent);
  if(!w) return e;
  const ew = escapeHtml(w);
  const i = e.indexOf(ew);
  return i < 0 ? e : e.slice(0, i) + '<b>' + ew + '</b>' + e.slice(i + ew.length);
}
function openKoGram(q){
  q = q || '';
  const list = koGramList().filter(g => !q || (g.k + g.t + (g.ex || []).join('')).includes(q)).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const body = document.getElementById('ko-sheet-body');
  body.innerHTML = `
    <div class="ko-title">文法帳<span class="ko-gram-cnt">${koGramList().length}個</span></div>
    <div class="ko-note">単語の画面の「形」の説明にある☆を押すと、ここに入るよ。また同じ文法に出会うと例文が増えるよ。</div>
    ${koGramList().length ? `<input id="ko-gram-q" class="ko-input" placeholder="さがす（例：면・ならない）" value="${escapeHtml(q)}" oninput="clearTimeout(window._kgq);window._kgq=setTimeout(()=>{const v=this.value;openKoGram(v);const e=document.getElementById('ko-gram-q');e.focus();e.setSelectionRange(v.length,v.length);},300)">
    <button class="ko-menu-item" onclick="openKoGramQuiz()">文法の復習<span class="ko-mi-sub">例文を見て意味を思い出す</span></button>` : ''}
    <div class="ko-gram-list">${list.map(g => `<div class="ko-gram-row">
      <div class="ko-gram-h">${g.k ? `<span class="ko-gram-k">${escapeHtml(g.k)}</span>` : ''}<span class="ko-gram-t">${escapeHtml(g.t)}</span>
        <button class="ko-gram-x" onclick="if(confirm('文法帳から外す？'))koGramDel(${escapeHtml(JSON.stringify(g.id))})">✕</button></div>
      ${(g.ex || []).map((x, j) => `<button class="ko-ex-row" onclick="koSpeak(this.textContent)">${koGramHl(x, (g.exw || [])[j] || g.w)}</button>`).join('')}
    </div>`).join('') || (q ? '<div class="ko-note">見つからなかったよ。</div>' : '')}</div>
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="openKoMenu()">戻る</button></div>`;
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
}
function openKoGramQuiz(){
  const list = koGramList().filter(g => (g.ex || []).length);
  if(!list.length){ showToast('例文のある文法がまだないよ'); return; }
  const g = list[Math.floor(Math.random() * list.length)];
  const xi = Math.floor(Math.random() * g.ex.length), x = g.ex[xi];
  g.w = (g.exw || [])[xi] || g.w;
  window._koGramQ = g;
  document.getElementById('ko-sheet-body').innerHTML = `
    <div class="ko-title">文法の復習</div>
    <div class="ko-sentence">${koGramHl(x, g.w)}</div>
    ${g.k ? `<div class="ko-gram-qk">${escapeHtml(g.k)}</div>` : ''}
    <div id="ko-gram-ans" class="ko-gram-ans" style="display:none">${escapeHtml(g.t)}</div>
    <div class="ko-actions">
      <button class="ko-cancel" onclick="openKoGram()">戻る</button>
      <button class="ko-cancel" onclick="koSpeak(${escapeHtml(JSON.stringify(x))})">🔊</button>
      <button class="ko-save" id="ko-gram-next" onclick="const a=document.getElementById('ko-gram-ans');if(a.style.display==='none'){a.style.display='';this.textContent='次へ';}else openKoGramQuiz();">答え</button>
    </div>`;
}

// ===== 人名かも？（ハングル→カタカナの読み、よく出る辞書にない語） =====
const KO_SURNAMES = new Set('김이박최정강조윤장임한오서신권황안송류유홍전고문양손배백허남심노하곽성차주우구민진나지엄원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용'.split(''));
const KO_KANA_ROWS = {
  '':  ['ア','イ','ウ','エ','オ','ヤ','ユ','ヨ','イェ','ワ','ウィ','ウェ','ウォ','ウ'],
  k:  ['カ','キ','ク','ケ','コ','キャ','キュ','キョ','キェ','クァ','クィ','クェ','クォ','ク'],
  g:  ['ガ','ギ','グ','ゲ','ゴ','ギャ','ギュ','ギョ','ギェ','グァ','グィ','グェ','グォ','グ'],
  n:  ['ナ','ニ','ヌ','ネ','ノ','ニャ','ニュ','ニョ','ニェ','ヌァ','ヌィ','ヌェ','ヌォ','ヌ'],
  t:  ['タ','ティ','トゥ','テ','ト','ティャ','ティュ','ティョ','ティェ','トァ','トィ','トェ','トォ','トゥ'],
  d:  ['ダ','ディ','ドゥ','デ','ド','ディャ','ディュ','ディョ','ディェ','ドァ','ドィ','ドェ','ドォ','ドゥ'],
  r:  ['ラ','リ','ル','レ','ロ','リャ','リュ','リョ','リェ','ルァ','ルィ','ルェ','ルォ','ル'],
  m:  ['マ','ミ','ム','メ','モ','ミャ','ミュ','ミョ','ミェ','ムァ','ムィ','ムェ','ムォ','ム'],
  p:  ['パ','ピ','プ','ペ','ポ','ピャ','ピュ','ピョ','ピェ','プァ','プィ','プェ','プォ','プ'],
  b:  ['バ','ビ','ブ','ベ','ボ','ビャ','ビュ','ビョ','ビェ','ブァ','ブィ','ブェ','ブォ','ブ'],
  s:  ['サ','シ','ス','セ','ソ','シャ','シュ','ショ','シェ','スァ','スィ','スェ','スォ','ス'],
  j:  ['ジャ','ジ','ジュ','ジェ','ジョ','ジャ','ジュ','ジョ','ジェ','ジュァ','ジュィ','ジュェ','ジュォ','ズ'],
  c:  ['チャ','チ','チュ','チェ','チョ','チャ','チュ','チョ','チェ','チュァ','チュィ','チュェ','チュォ','チュ'],
  h:  ['ハ','ヒ','フ','ヘ','ホ','ヒャ','ヒュ','ヒョ','ヒェ','ファ','フィ','フェ','フォ','フ']
};
// 母音 ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ → 上の列の番号
const KO_KANA_V = [0, 3, 5, 8, 4, 3, 7, 8, 4, 9, 11, 11, 7, 2, 12, 11, 10, 6, 13, 10, 1];
// 初声：語頭 / 語中
const KO_KANA_L = [['k','g'],['k','k'],['n','n'],['t','d'],['t','t'],['r','r'],['m','m'],['p','b'],['p','p'],['s','s'],['s','s'],['',''],['c','j'],['c','c'],['c','c'],['k','k'],['t','t'],['p','p'],['h','h']];
// 終声 → カナ（と、次がㅇのときに移る初声）
const KO_KANA_T = [null,['ク',0],['ク',1],['ク',0],['ン',2],['ン',2],['ン',2],['ッ',3],['ル',5],['ク',0],['ム',6],['プ',7],['ル',5],['ル',5],['プ',7],['ル',5],['ム',6],['プ',7],['プ',7],['ッ',9],['ッ',10],['ン',null],['ッ',12],['ッ',14],['ク',15],['ッ',16],['プ',17],['',18]];
function koToKana0(word, mid){
  const syl = [...String(word)].map(koDec);
  if(!syl.length || syl.some(x => !x)) return '';
  let out = '';
  for(let i = 0; i < syl.length; i++){
    const s = syl[i], nx = syl[i + 1];
    let L = s.L, medial = i > 0 || !!mid;
    let row = KO_KANA_L[L][medial ? 1 : 0];
    if(medial && s._lk != null) row = s._lk;
    let col = KO_KANA_V[s.V];
    if(row && (s.V === 19 || s.V === 3 || s.V === 7)) col = s.V === 19 ? 1 : 3;   // 희→ヒ、혜→ヘ
    if(/^[cjs]$/.test(row) && (s.V === 10 || s.V === 11 || s.V === 15)) col = 3;   // 최→チェ
    let kana = KO_KANA_ROWS[row][col];
    if(row === 's' && s.V === 20) kana = 'シ';
    out += kana;
    if(s.T){
      const t = KO_KANA_T[s.T];
      if(nx && nx.L === 11 && t[1] != null){ nx.L = t[1]; nx._lk = KO_KANA_L[t[1]][1]; continue; }   // 連音（서연이→ソヨニ）
      if(nx && s.T === 8 && nx.L === 5) continue;                                                     // ㄹㄹ（에블린→エブリン）
      out += t[0];
    }
  }
  return out;
}
function koToKana(word){
  word = String(word);
  if(word.length === 3 && KO_SURNAMES.has(word[0])) return koToKana0(word[0]) + '・' + koToKana0(word.slice(1), true);
  return koToKana0(word);
}
// 後ろの助詞をとった形（김독자는 → 김독자）
const KO_NAME_TAIL = /(에게서|한테서|께서는|께서|에게는|에게|한테|이라고|라고|이라는|라는|이란|이랑|랑|이나|이여|이시여|이에게|님은|님이|님의|님|씨는|씨가|씨의|씨|이는|이가|이를|이의|이도|이와|이야|처럼|보다|까지|부터|만큼|에서|으로|에|로|은|는|이|가|을|를|의|와|과|도|만|아|야)$/;
function koNameBase(run){
  const m = String(run).match(KO_NAME_TAIL);
  if(!m) return run;
  const b = run.slice(0, -m[1].length);
  if(b.length < 2) return '';
  if(_koDict){ const b1 = run.slice(0, -1); if(b1.length >= 2 && _koDict[b1] && /[이가은는을를의도만와과야아]$/.test(run)) return b1; }   // 아저씨가 → 아저씨
  const d = koDec(b.slice(-1)); if(!d) return run;
  const t = m[1];
  // 받침のあるなしと助詞が合わないなら外さない
  if(/^(은|이|을|과|아|으로)$/.test(t) && !d.T) return run;
  if(/^(는|가|를|와|야|로)$/.test(t) && d.T && !(t === '로' && d.T === 8)) return run;
  return b;
}
function koNameUnknown(b){
  if(!b || b.length < 2 || b.length > 5) return false;
  const D = _koDict || {};
  if(D[b]) return false;
  if(koFindKey(b)) return false;
  if(/(었|았|였|겠|했|된|한|하|되|다|요|죠)$/.test(b) && b.length >= 3 && !(b.length === 3 && KO_SURNAMES.has(b[0]) && !/다$/.test(b))) return false;
  // 누군가・있을지（〜ㄴ가・〜ㄹ지 の形）
  if(b.length >= 3 && /[가지까]$/.test(b)){ const d = koDec(b.slice(-2, -1)); if(d && (d.T === 4 || d.T === 8)) return false; }
  // 사람들・독자들・직원분 など（辞書の語＋들/분/님）
  const sx = b.match(/^(.+?)(분들|님들|들|분|님|씨)$/);
  if(sx && (D[sx[1]] || koFindKey(sx[1]))) return false;
  // 휴대전화・신입사원（2文字以上の語が2つ）、슬픔역・강연실（語＋1文字の接尾）
  for(let i = 2; i <= b.length - 2; i++) if(D[b.slice(0, i)] && D[b.slice(i)]) return false;
  if(b.length >= 3 && D[b.slice(0, -1)] && /[실역화장소관사비력적식품기권층론법점]$/.test(b)) return false;
  try{ const f = koDictLookup(b, '', ''); if(f.some(x => !x.guess && (x.head === b || x.head === b + '다' || (x.head.length >= 2 && x.head.length >= b.length - 1 && (x.n || 0) >= b.length - 1 && b.startsWith(x.head.replace(/다$/, '')))))) return false; }catch(_){}
  return true;
}
const KO_NAME_NG_LS = LS_PREFIX + 'ko-name-ng';
function koNameNg(){ try{ return JSON.parse(localStorage.getItem(KO_NAME_NG_LS) || '{}') || {}; }catch(_){ return {}; } }
function koNameNo(b){ const n = koNameNg(); n[b] = 1; try{ localStorage.setItem(KO_NAME_NG_LS, JSON.stringify(n)); }catch(_){} openKoFreq(); }
// この話で何回も出る、辞書にない語（助詞が付いて出てくるもの）
function koNameScan(){
  if(!_koDict){
    koDictLoad().then(() => { const t = document.querySelector('#ko-sheet.show .ko-title'); if(t && t.textContent === 'よく出る未登録の単語') openKoFreq(); }).catch(() => {});
    return [];
  }
  const cnt = {}, withTail = {}, sent = {}, ng = koNameNg();
  (state.pages || []).forEach(pg => (pg.paras || []).forEach(para => {
    if(para.type !== 'text') return;
    const plain = koParaPlain(para);
    (plain.match(KO_RUN) || []).forEach(run => {
      const b = _koDict[run] ? run : koNameBase(run);
      if(!b || b.length < 2) return;
      cnt[b] = (cnt[b] || 0) + 1;
      if(b !== run) withTail[b] = (withTail[b] || 0) + 1;
      if(!sent[b]) sent[b] = plain;
    });
  }));
  const out = [];
  Object.keys(cnt).forEach(b => {
    if(ng[b]) return;
    const n = cnt[b], wt = withTail[b] || 0;
    const sur = b.length === 3 && KO_SURNAMES.has(b[0]);
    if(!(wt >= 2 && n >= 3) && !(sur && wt >= 1 && n >= 2)) return;
    if(!koNameUnknown(b)) return;
    try{ if(koDictLookup(b, '', '').some(x => x.verb && (x.n || 0) >= b.length - (/[다해요]$/.test(b) ? 1 : 0))) return; }catch(_){}   // 했다・생각해・그럴
    for(let i = 2; i <= b.length - 2; i++) if(cnt[b.slice(0, i)] && _koDict[b.slice(i)]) return;   // 김독자대표
    out.push({ b, n, kana: koToKana(b), sentence: sent[b] });
  });
  return out.sort((a, b) => b.n - a.n).slice(0, 8);
}
function koNamePick(i){
  const r = (window._koNameRows || [])[i]; if(!r) return;
  _koFromFreq = true;
  koOpenSheet({ type: 'word', key: null, eojeol: r.b, sentence: r.sentence, pi: -1, qi: -1, fromFreq: true, nameKana: r.kana });
}
// 単語の画面で「人名として入れる」
function koNameFill(b, kana){
  b = b || (_koCur ? koNameBase(_koCur.eojeol) : ''); kana = kana || koToKana(b);
  if(!b || !kana) return;
  koSetKey(b); koSetHead(b); _koHeadAuto = false;
  _koEdit.ms = []; koAddMeaning(kana); _koEdit._auto = false;
  const memo = document.getElementById('ko-memo'); if(memo && !memo.value) memo.value = '人名';
  showToast('人名として入れたよ。読みは直せるよ');
}

// 動詞＋ㄴ／은（名詞の前・過去）：쓴 글＝書いた文、먹은 밥＝食べたご飯 → 本文の意味に「（た）」
function koPastAttr(key, run){
  try{
    if(!_koDict || !run || /\s/.test(key)) return false;
    const h = koHead(key);
    if(!/다$/.test(h)) return false;
    const es = _koDict[h] || [];
    if(!es.some(e => e[0] === '動')) return false;
    // 意味（日本語）が動詞の形（書く・食べる・する）のときだけ。쓰다＝苦い のような形容詞の意味なら付けない
    const m0 = String((_koWords[key] || {}).m || '').split(/[・／,、]/)[0].replace(/[（(].*$/, '').trim();
    if(!/[うくぐすつぬぶむる]$/.test(m0)) return false;
    if(h === '있다' || h === '없다' || h === '이다' || h === '아니다') return false;
    const last = koDec(run.slice(-1));
    if(!last || last.T !== 4) return false;
    if(/(는|던|은가|ㄴ가)$/.test(run)) return false;
    const stem = h.slice(0, -1);
    if(run === stem) return false;                       // 안다 の 안、신다 の 신
    if(run.length > stem.length + 2) return false;       // 語尾が長いもの（〜었던・〜한다는 など）は付けない
    // 語幹の最後の字＋ㄴ（쓰→쓴、가→간、만들→만든）か、語幹＋은（먹→먹은）
    if(run === stem + '은') return true;
    if(run.length === stem.length){
      const a = koDec(stem.slice(-1)); if(!a) return false;
      if(run.slice(0, -1) !== stem.slice(0, -1)) return false;
      if(a.L === last.L && a.V === last.V && (a.T === 0 || a.T === 8)) return true;   // ㄹ語幹（만들→만든）も
      return false;
    }
    if(/하다$/.test(h) && run === stem.slice(0, -1) + '한') return true;
    if(/하다$/.test(h) && run.endsWith('한') && run.length === stem.length) return true;
    if(/(되|된)/.test(run.slice(-1)) && /되다$/.test(h) && run === stem.slice(0, -1) + '된') return true;
    return false;
  }catch(_){ return false; }
}

(function(){
  const add = { '저놈': ['代', 'あいつ・あの野郎'], '그놈': ['代', 'そいつ・あいつ'], '저년': ['代', 'あの女（悪口）'], '그년': ['代', 'あの女（悪口）'], '거거든': ['語尾', '〜なんだから・〜するんだよ（＝것이거든）'] };
  Object.keys(add).forEach(k => { if(!(k in KO_EXTRA_DICT)) KO_EXTRA_DICT[k] = add[k]; });
})();

// ===== 擬音語・叫び声（와아아아・투투투툭・흐음）と、分かち書きなし（빨간셔츠）=====
function koOnoGuess(w){
  w = String(w || '');
  if(w.length < 2) return '';
  const syl = [...w];
  const D = _koDict || {};
  // のばした音を縮める（와아아아→와아→와、이야아아→이야、흐음→흠、아아악→악）
  const vowelOnly = ch => { const d = koDec(ch); return d && d.L === 11 && !d.T; };
  let base = syl[0]; for(let i = 1; i < syl.length; i++){ if(!(vowelOnly(syl[i]) && syl[i] === syl[i - 1])) base += syl[i]; }
  const cands = [base, base.replace(/(.)\1+/g, '$1'), w.replace(/아+(?=[^아]|$)/g, '아')];
  const st = w.replace(/^(.)\1+/, '$1'); cands.push(st);
  for(let n = 3; n >= 2; n--) cands.push(w.slice(0, n));
  let tr = w; while(tr.length > 1 && vowelOnly(tr.slice(-1))) tr = tr.slice(0, -1); cands.push(tr);   // 와아아아→와
  if(w.length === 2 && koDec(w[1]) && koDec(w[1]).L === 11 && koDec(w[1]).V === 18){ const a = koDec(w[0]), b = koDec(w[1]); if(a && !a.T) cands.push(koCmp(a.L, a.V, b.T)); }   // 흐음→흠
  const hit = cands.find(c => c && c !== w && D[c] && D[c].some(e => /^(感|副)$/.test(e[0])));
  if(hit){ const e = D[hit].find(e => /^(感|副)$/.test(e[0])); return `「${hit}」をのばした形かも（${koJaShort(e[1][0])}）。擬音・叫び声として読んでOK`; }
  // 同じ音のくり返し・ㅅ/ㄱで終わる短い音（투투투툭・즈즈즛・츠츠츳・두근두근）
  const rep = /(.)\1/.test(w) || (w.length >= 4 && w.length % 2 === 0 && w.slice(0, w.length / 2) === w.slice(w.length / 2));
  if(rep) return '同じ音のくり返し：擬音語・擬態語（音や様子を表す言葉）っぽいよ';
  return '';
}
function koSplitGuess(w){
  w = String(w || '');
  if(w.length < 3 || !_koDict) return null;
  const D = _koDict;
  const known = x => { if(D[x]) return true; try{ const f = koDictLookup(x, '', ''); return f.some(r => !r.guess && r.head.replace(/다$/, '').length >= Math.min(2, x.length) && x.startsWith(r.head.replace(/다$/, '').slice(0, 1))); }catch(_){ return false; } };
  let best = null;
  for(let i = w.length - 1; i >= 1; i--){
    const a = w.slice(0, i), b = w.slice(i);
    if(a.length < 2 && b.length < 2) continue;
    if(!(D[a] || (a.length >= 2 && known(a)))) continue;
    if(!known(b)) continue;
    const sc = Math.min(a.length, b.length) * 10 + (D[a] ? 5 : 0) + (D[b] ? 3 : 0);
    if(!best || sc > best.sc) best = { sc, p: [a, b] };
  }
  return best && best.sc >= 20 ? best.p : null;
}
function koLookupPart(i){
  const p = (window._koSplitNow || [])[i]; if(!p || !_koCur) return;
  koOpenSheet(Object.assign({}, _koCur, { key: null, eojeol: p, joined: null, place: null }));
}

// 日本語の動詞を「〜た」に（書く→書いた、食べる→食べた、する→した）。分からないときは「（た）」を付ける
function koJaPast(m){
  const segs = String(m || '').split('・');
  const one = w => {
    w = w.trim();
    const mm = w.match(/^(.*?)([（(].*)?$/); const v = mm[1], tail = mm[2] || '';
    const r = (() => {
      if(/(する)$/.test(v)) return v.slice(0, -2) + 'した';
      if(/(来る|くる)$/.test(v)) return v.slice(0, -2) + (v.endsWith('来る') ? '来た' : 'きた');
      if(/(行く|いく)$/.test(v)) return v.slice(0, -1) + 'った';
      if(/く$/.test(v)) return v.slice(0, -1) + 'いた';
      if(/ぐ$/.test(v)) return v.slice(0, -1) + 'いだ';
      if(/す$/.test(v)) return v.slice(0, -1) + 'した';
      if(/[うつ]$/.test(v)) return v.slice(0, -1) + 'った';
      if(/[ぬぶむ]$/.test(v)) return v.slice(0, -1) + 'んだ';
      if(/る$/.test(v)){
        const p = v.slice(-2, -1);
        if(/(帰る|入る|知る|切る|走る|要る|限る|減る|蹴る|滑る|喋る|焦る|握る|練る|散る|参る|茂る|湿る|陥る|遮る|混じる|交じる|捻る|罵る)$/.test(v)) return v.slice(0, -1) + 'った';
        if(/[えけげせぜてでねへべぺめれいきぎしじちにひびぴみり]/.test(p)) return v.slice(0, -1) + 'た';
        if(/(見る|着る|寝る|似る|煮る|居る|得る|出る|経る)$/.test(v)) return v.slice(0, -1) + 'た';
        if(/[一-鿿]/.test(p)) return v.slice(0, -1) + 'った';
        if(/[あかさたなはまやらわがざだばぱおこそとのほもよろごぞどぼぽうくすつぬふむゆるぐずづぶぷ]/.test(p)) return v.slice(0, -1) + 'った';
      }
      return '';
    })();
    return r ? r + tail : '';
  };
  const out = segs.map(one);
  if(out[0]) return out.map((x, i) => x || segs[i]).join('・');
  return m + '（た）';
}

// ===== 辞書にない語（小説によく出る）・〜어 내다／대다／오르다 =====
(function(){
  const add = {
    '어그러뜨리다': ['動', '崩す・台無しにする・ぶち壊す'], '어그러트리다': ['動', '崩す・台無しにする・ぶち壊す'], '어그러지다': ['動', '崩れる・食い違う・台無しになる'],
    '패대기치다': ['動', 'たたきつける・投げつける'], '패대기': ['名', 'たたきつけること'],
    '박살': ['名', '粉々・こっぱみじん'], '박살나다': ['動', '粉々になる・こっぱみじんになる'], '박살내다': ['動', '粉々にする・ぶち壊す'],
    '아뜩하다': ['形', '気が遠くなる・目の前が真っ暗になる'], '어질하다': ['形', 'くらっとする・めまいがする'], '어질': ['副', 'くらっと'],
    '촐싹': ['副', 'ちょこまか・そわそわ'], '촐싹거리다': ['動', '落ち着きなく振る舞う・ちょこまかする'], '촐싹대다': ['動', '落ち着きなく振る舞う・ちょこまかする'], '촐싹이다': ['動', '落ち着きなく振る舞う・ちょこまかする'],
    '그르렁': ['副', 'ゴロゴロ・ゼーゼー（のど）'], '그르렁거리다': ['動', 'ゴロゴロ鳴る・ゼーゼーいう（のど）'], '그르렁대다': ['動', 'ゴロゴロ鳴る・ゼーゼーいう（のど）'],
    '색색거리다': ['動', 'すうすう寝息を立てる・ぜいぜい息をする'], '색색대다': ['動', 'すうすう寝息を立てる・ぜいぜい息をする'],
    '껌뻑': ['副', 'ぱちっ（まばたき）'], '끔뻑': ['副', 'ぱちっ（まばたき）'], '껌뻑이다': ['動', '（目を）ぱちぱちさせる'], '끔뻑이다': ['動', '（目を）ぱちぱちさせる'],
    '껌뻑거리다': ['動', '（目を）しきりにぱちぱちさせる'], '끔뻑거리다': ['動', '（目を）しきりにぱちぱちさせる'],
    '밀쳐내다': ['動', '押しのける・突き放す'], '떨쳐내다': ['動', '振り払う・払いのける'], '그어대다': ['動', '（線を）引きまくる・こすりまくる']
  };
  Object.keys(add).forEach(k => { if(!(k in KO_EXTRA_DICT)) KO_EXTRA_DICT[k] = add[k]; });
  const end = {
    '어내다': ['〜しきる・〜し出す（어 내다）', 'しきる'], '어내': ['〜しきる・〜し出す（어 내다）', null], '어내고': ['〜しきって・〜し出して', 'しきって'],
    '어냈다': ['〜しきった・〜し出した', 'しきった'], '어냈던': ['〜しきった（名詞の前）', 'しきった', 1], '어낸': ['〜しきった（名詞の前）', 'しきった', 1],
    '어내는': ['〜しきる（名詞の前）', 'しきる', 1], '어낼': ['〜しきる（これから・名詞の前）', 'しきる', 1], '어내며': ['〜しきりながら', 'しきりながら'],
    '어내려': ['〜し出そうと', 'し出そうと'], '어내면': ['〜しきれば', 'しきれば'], '어냈어': ['〜しきった（くだけた）', 'しきった'], '어냈습니다': ['〜しきりました', 'しきりました'],
    '어대다': ['〜しまくる（어 대다）', 'しまくる'], '어대': ['〜しまくる（어 대다）', null], '어대고': ['〜しまくって', 'しまくって'], '어댔다': ['〜しまくった', 'しまくった'],
    '어대는': ['〜しまくる（名詞の前）', 'しまくる', 1], '어댄': ['〜しまくった（名詞の前）', 'しまくった', 1], '어대며': ['〜しまくりながら', 'しまくりながら'],
    '어오르다': ['〜しあがる（어 오르다）', 'しあがる'], '어오르': ['〜しあがる（어 오르다）', null], '어오르고': ['〜しあがって', 'しあがって'], '어올랐다': ['〜しあがった', 'しあがった'],
    '어오르는': ['〜しあがる（名詞の前）', 'しあがる', 1], '어오른': ['〜しあがった（名詞の前）', 'しあがった', 1], '어올라': ['〜しあがって', 'しあがって']
  };
  Object.keys(end).forEach(k => { if(!(k in KO_END_TABLE)) KO_END_TABLE[k] = end[k]; });
})();

// ===== 苦手な単語（復習でよく間違える） =====
function koWeakKeys(){
  const w = koLoad();
  return Object.keys(w).filter(k => ((w[k].lapses || 0) + (w[k].ng || 0)) >= 2)
    .sort((a, b) => ((w[b].lapses || 0) * 2 + (w[b].ng || 0)) - ((w[a].lapses || 0) * 2 + (w[a].ng || 0)));
}
function koWordRowsHtml(keys, extra){
  const w = koLoad();
  return keys.map(k => `<button class="ko-weak-row" onclick="koCloseSheet();setTimeout(()=>openKoWordList(${escapeHtml(JSON.stringify(koHead(k)))}),60)">
    <span class="ko-weak-h">${escapeHtml(koHead(k))}</span><span class="ko-weak-m">${escapeHtml(koGlossText(w[k].m || ''))}</span><span class="ko-weak-n">${extra(k)}</span></button>`).join('');
}
function openKoWeak(){
  const keys = koWeakKeys(), w = koLoad();
  window._koListKeys = keys;
  document.getElementById('ko-sheet-body').innerHTML = `
    <div class="ko-title">苦手な単語<span class="ko-gram-cnt">${keys.length}語</span></div>
    <div class="ko-note">復習で「もう一回」を2回以上押した単語だよ。まとめて練習しても、次の復習の日は変わらないよ。</div>
    ${keys.length ? `<button class="ko-review-big" onclick="openKoQuiz({keys: window._koListKeys})"><span class="t">まとめて練習</span><span class="n">${Math.min(30, keys.length)}枚</span></button>` : ''}
    <div class="ko-weak-list">${koWordRowsHtml(keys, k => `✕${(w[k].lapses || 0) + (w[k].ng || 0)}`) || '<div class="ko-note">苦手な単語はまだないよ。</div>'}</div>
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="openKoMenu()">戻る</button></div>`;
}

// ===== この話の単語（登録済みで、この話に出てくるもの） =====
function koEpWordList(){
  if(!state.pages || !state.currentEpisodeId) return [];
  koLoad();
  const cnt = {};
  (state.pages || []).forEach(pg => (pg.paras || []).forEach(pa => {
    if(pa.type !== 'text') return;
    (koParaPlain(pa).match(KO_RUN) || []).forEach(run => { const k = koFindKey(run); if(k && _koWords[k]) cnt[k] = (cnt[k] || 0) + 1; });
  }));
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map(k => ({ k, n: cnt[k] }));
}
function openKoEpWords(){
  const list = koEpWordList();
  window._koListKeys = list.map(x => x.k);
  const n = {}; list.forEach(x => n[x.k] = x.n);
  document.getElementById('ko-sheet-body').innerHTML = `
    <div class="ko-title">この話の単語<span class="ko-gram-cnt">${list.length}語</span></div>
    <div class="ko-note">この話に出てくる、登録した単語だよ（多く出る順）。まとめて練習しても、次の復習の日は変わらないよ。</div>
    ${list.length ? `<button class="ko-review-big" onclick="openKoQuiz({keys: window._koListKeys})"><span class="t">この話の単語を練習</span><span class="n">${Math.min(30, list.length)}枚</span></button>` : ''}
    <div class="ko-weak-list">${koWordRowsHtml(list.map(x => x.k), k => `${n[k]}回`) || '<div class="ko-note">この話にはまだ登録した単語がないよ。</div>'}</div>
    <div class="ko-actions"><span></span><button class="ko-cancel" onclick="openKoMenu()">戻る</button></div>`;
}

// ===== 読んだ量（韓国語の文字数：同じページを5秒以上開いていたら、1日1回数える） =====
const KO_READ_LS = LS_PREFIX + 'ko-read-pages';
let _koReadCur = null;
function koStatAdd(field, n){
  if(!n) return;
  const all = koStats(), dev = koDeviceId(), day = koDay();
  all[dev] = all[dev] || {};
  const rec = all[dev][day] = all[dev][day] || {};
  rec[field] = (rec[field] || 0) + n;
  try{ localStorage.setItem(KO_STATS_LS, JSON.stringify(all)); }catch(_){}
  koSyncSoon();
}
function koReadTick(){
  try{
    if(!state.currentEpisodeId || state.editMode || document.hidden || !koEnabled() || !state.pages) { _koReadCur = null; return; }
    const id = state.currentNovelId + '|' + state.currentEpisodeId + '|' + state.curPage;
    if(!_koReadCur || _koReadCur.id !== id){ _koReadCur = { id, at: Date.now() }; return; }
    if(_koReadCur.done || Date.now() - _koReadCur.at < 5000) return;
    _koReadCur.done = true;
    const day = koDay();
    let m = {}; try{ m = JSON.parse(localStorage.getItem(KO_READ_LS) || '{}') || {}; }catch(_){}
    if(m.day !== day) m = { day, p: {} };
    if(m.p[id]) return;
    const pg = state.pages[state.curPage];
    let n = 0;
    ((pg && pg.paras) || []).forEach(pa => { if(pa.type === 'text') n += (koParaPlain(pa).match(/[가-힣]/g) || []).length; });
    m.p[id] = 1;
    try{ localStorage.setItem(KO_READ_LS, JSON.stringify(m)); }catch(_){}
    koStatAdd('c', n);
  }catch(_){}
}
setInterval(koReadTick, 2500);

// ===== 聞き流し（原文 → 自分の訳） =====
let _koListen = null;
function koListenStart(){
  if(!('speechSynthesis' in window)){ showToast('この端末では読み上げが使えません'); return; }
  if(!state.pages){ return; }
  const items = [];
  const trs = koTrs();
  for(let pi = state.curPage || 0; pi < state.pages.length; pi++){
    (state.pages[pi].paras || []).forEach(pa => {
      if(pa.type !== 'text') return;
      const t = koParaPlain(pa).trim();
      if(!/[가-힣]/.test(t)) return;
      items.push({ ko: t, ja: (trs[koHash(t)] || '').trim(), pi });
    });
  }
  if(!items.length){ showToast('このページから先に韓国語の段落がないよ'); return; }
  koCloseSheet();
  koListenStop(true);
  _koListen = { items, i: 0, stop: false };
  let bar = document.getElementById('ko-listen-bar');
  if(!bar){
    bar = document.createElement('div'); bar.id = 'ko-listen-bar';
    bar.innerHTML = '<span id="ko-listen-t"></span><button onclick="koListenSkip()" aria-label="次の段落へ">⏭</button><button onclick="koListenStop()">止める</button>';
    document.body.appendChild(bar);
  }
  bar.style.display = '';
  koListenNext();
}
function koListenSpeak(text, lang, rate, done){
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = rate;
  const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  if(v) u.voice = v;
  u.onend = done; u.onerror = done;
  speechSynthesis.speak(u);
}
function koListenNext(){
  const L = _koListen;
  if(!L || L.stop) return;
  if(L.i >= L.items.length){ koListenStop(); showToast('この話の最後まで聞いたよ'); return; }
  const it = L.items[L.i];
  const t = document.getElementById('ko-listen-t');
  if(t) t.textContent = `聞き流し ${L.i + 1}/${L.items.length}${it.ja ? '' : '（訳なし）'}`;
  if(it.pi !== state.curPage && typeof goToPage === 'function'){ try{ goToPage(it.pi); }catch(_){} }   // 読んでいる段落のページへ（goPage は読み上げを止めるので使わない）
  const me = L;
  koListenSpeak(it.ko, 'ko-KR', 0.9, () => {
    if(me !== _koListen || me.stop) return;
    const after = () => { if(me !== _koListen || me.stop) return; me.i++; setTimeout(koListenNext, 500); };
    if(it.ja) setTimeout(() => koListenSpeak(it.ja, 'ja-JP', 1.0, after), 300); else after();
  });
}
function koListenSkip(){ if(!_koListen) return; const L = _koListen; L.stop = true; speechSynthesis.cancel(); _koListen = Object.assign({}, L, { stop: false, i: L.i + 1 }); koListenNext(); }
function koListenStop(quiet){
  if(_koListen) _koListen.stop = true;
  _koListen = null;
  try{ speechSynthesis.cancel(); }catch(_){}
  const bar = document.getElementById('ko-listen-bar'); if(bar) bar.style.display = 'none';
}


// ===== 本の中で使われている文（単語帳の例文） =====
// 本棚の本から、その単語が出てくる文を探す。今の本 → ほかの本の順。見つかったら早めに止める（重くしないため）
const _koUseCache = {};
function koUseForms(k){
  const e = koLoad()[k] || {};
  return [k].concat(Array.isArray(e.ks) ? e.ks : []).filter((x, i, a) => x && a.indexOf(x) === i).sort((a, b) => b.length - a.length);
}
function koUseHi(sentence, forms){
  let h = escapeHtml(sentence);
  const f = (forms || []).find(x => sentence.includes(x));
  if(f){ const ef = escapeHtml(f); const i = h.indexOf(ef); if(i >= 0) h = h.slice(0, i) + '<b>' + ef + '</b>' + h.slice(i + ef.length); }
  return h;
}
// 段落の中から、その語がある1文を切り出す（長い段落でも読みやすいように）
function koUseSentence(plain, at){
  const ends = /[.!?。…」』”"\n]/;
  let a = at, b = at;
  while(a > 0 && !ends.test(plain[a - 1])) a--;
  while(b < plain.length && !ends.test(plain[b])) b++;
  while(b < plain.length && /[.!?。…」』”"]/.test(plain[b])) b++;
  let t = plain.slice(a, b).trim();
  if(t.length > 140){ const c = Math.max(0, at - a - 50); t = (c ? '…' : '') + t.slice(c, c + 130) + '…'; }
  return t;
}
async function koUsesSearch(k, want){
  const key = k + '|' + want;
  if(_koUseCache[key] && Date.now() - _koUseCache[key].at < 60000) return _koUseCache[key];
  const forms = koUseForms(k);
  const found = [], seen = new Set();
  const novels = [];
  if(state.novel && state.currentNovelId) novels.push(state.novel);
  (state.library || []).forEach(n => { if(!state.currentNovelId || n.id !== state.currentNovelId) novels.push(n); });
  let steps = 0, done = false;
  const maxCand = want <= 1 ? 3 : 40;
  outer:
  for(const n of novels){
    if(!n || !koNovelHasKo(n)) continue;
    const eps = (n.episodes || []).slice().sort((a, b) => a.number - b.number);
    // 今読んでいる話を先に
    if(n === state.novel && state.currentEpisodeId){ const i = eps.findIndex(e => e.id === state.currentEpisodeId); if(i > 0) eps.unshift(eps.splice(i, 1)[0]); }
    for(const ep of eps){
      const pages = (n === state.novel && ep.id === state.currentEpisodeId && state.pages) ? state.pages : (ep.pages || []);
      for(let pi = 0; pi < pages.length; pi++){
        const paras = (pages[pi] && pages[pi].paras) || [];
        for(let qi = 0; qi < paras.length; qi++){
          const pa = paras[qi];
          if(pa.type !== 'text') continue;
          if(++steps % 400 === 0) await new Promise(r => setTimeout(r, 0));   // 画面が固まらないように、少しずつ
          const plain = koParaPlain(pa);
          if(!plain || !forms.some(f => plain.includes(f))) continue;
          KO_RUN.lastIndex = 0;
          const runs = []; let m;
          while((m = KO_RUN.exec(plain))) runs.push([m[0], m.index]);
          const hit = runs.find(([r]) => forms.some(f => r.startsWith(f)) && koFindKey(r) === k);
          if(!hit) continue;
          const sen = koUseSentence(plain, hit[1]);
          if(seen.has(sen)) continue;
          seen.add(sen);
          const tr = (n.koTr || {})[koHash(plain)] || '';
          found.push({ s: sen, tr: tr.trim(), nid: n.id, eid: ep.id, pi, qi, forms, where: `${n.title || '無題'}・${ep.title || ('第' + ep.number + '話')}` });
          if(found.length >= maxCand){ done = true; break outer; }
        }
      }
    }
  }
  // 自分の訳がある文 → 長すぎない文 → いろいろな話から
  const epCount = {};
  found.forEach(f => { f.score = (f.tr ? 0 : 10) + Math.abs(Math.min(f.s.length, 120) - 45) / 15; });
  found.sort((a, b) => a.score - b.score);
  const list = [];
  const rest = [];
  found.forEach(f => { const c = epCount[f.eid] || 0; if(c < 2){ list.push(f); epCount[f.eid] = c + 1; } else rest.push(f); });
  const r = { list: list.concat(rest), more: done, at: Date.now() };
  _koUseCache[key] = r;
  return r;
}
async function koShowUses(k, shown){
  const box = document.getElementById('ko-uses');
  if(!box) return;
  shown = shown || 4;
  if(!box.dataset.k){ box.dataset.k = k; box.innerHTML = '<div class="ko-label">本の中の文</div><div class="ko-uses-msg">さがしています…</div>'; }
  let r;
  try{ r = await koUsesSearch(k, 40); }catch(_){ return; }
  if(document.getElementById('ko-uses') !== box) return;
  const we = koLoad()[k] || {};
  const favs = Array.isArray(we.fav) ? we.fav : [];
  const regs = koMs(we).map(x => x.c).filter(Boolean).filter(c => !favs.some(f => c.includes(f.s.replace(/^…|…$/g, ''))));
  if(!r.list.length && !regs.length && !favs.length){ box.innerHTML = ''; return; }
  window._koUses = r.list.filter(u => !favs.some(f => f.s === u.s));
  window._koFavK = k;
  const favRows = favs.map((u, j) => `
    <div class="ko-use fav">
      <button class="ko-use-star on" onclick="koUseFavDel(${j})" aria-label="お気に入りから外す">★</button>
      <div class="ko-use-s" onclick="koSpeak(koLoad()[window._koFavK].fav[${j}].s)">${koUseHi(u.s, koUseForms(k))}</div>
      ${u.tr ? `<div class="ko-use-tr">${escapeHtml(u.tr.length > 120 ? u.tr.slice(0, 120) + '…' : u.tr)}</div>` : ''}
      ${u.nid ? `<button class="ko-use-w" onclick="koUseJumpTo(koLoad()[window._koFavK].fav[${j}])">${escapeHtml(u.w || '')} ›</button>` : ''}
    </div>`).join('');
  const regRows = regs.filter(c => !r.list.some(u => u.s && c.includes(u.s.replace(/^…|…$/g, '')))).slice(0, 2).map(c =>
    `<div class="ko-use"><div class="ko-use-s" onclick="koSpeak(this.textContent)">${koUseHi(c, koUseForms(k))}</div><div class="ko-use-w">登録したときの文</div></div>`).join('');
  box.innerHTML = '<div class="ko-label">本の中の文<span class="ko-use-help">☆でお気に入り</span></div>' + favRows + regRows + window._koUses.slice(0, shown).map((u, i) => `
    <div class="ko-use">
      <button class="ko-use-star" onclick="koUseFavAdd(${i})" aria-label="お気に入りにする">☆</button>
      <div class="ko-use-s" onclick="koSpeak(window._koUses[${i}].s)">${koUseHi(u.s, u.forms)}</div>
      ${u.tr ? `<div class="ko-use-tr">${escapeHtml(u.tr.length > 120 ? u.tr.slice(0, 120) + '…' : u.tr)}</div>` : ''}
      <button class="ko-use-w" onclick="koUseJump(${i})">${escapeHtml(u.where)} ›</button>
    </div>`).join('') +
    (window._koUses.length > shown ? `<button class="ko-uses-more" onclick="koShowUses(${escapeHtml(JSON.stringify(k))}, ${shown + 5})">もっと見る</button>` : '');
}
// 文をタップ → その本・その話のそのページへ
function koUseJump(i){ koUseJumpTo((window._koUses || [])[i]); }
async function koUseJumpTo(u){
  if(!u) return;
  if(!(state.library || []).some(n => n.id === u.nid)){ showToast('その本は本棚にありません'); return; }
  koCloseSheet();
  try{ closeKoWordList(); }catch(_){}
  try{
    if(state.currentNovelId !== u.nid){ await openNovel(u.nid); }
    if(state.currentEpisodeId !== u.eid) openEpisode(u.eid);
    setTimeout(() => {
      try{ if(state.curPage !== u.pi) goToPage(u.pi); }catch(_){}
      setTimeout(() => {
        const p = document.querySelector(`p[data-pi="${u.pi}"][data-qi="${u.qi}"]`);
        if(p){ try{ p.scrollIntoView({ block: 'center' }); }catch(_){} p.classList.add('ko-use-flash'); setTimeout(() => p.classList.remove('ko-use-flash'), 2200); }
      }, 500);
    }, 350);
  }catch(e){ showToast('その場所を開けませんでした'); }
}

// ===== 例文のお気に入り（単語ごとに10文まで・同期される） =====
function koUseFavAdd(i){
  const k = window._koFavK, u = (window._koUses || [])[i];
  const e = koLoad()[k]; if(!e || !u) return;
  e.fav = Array.isArray(e.fav) ? e.fav : [];
  if(e.fav.some(f => f.s === u.s)) return;
  if(e.fav.length >= 10){ showToast('お気に入りは10文までです'); return; }
  e.fav.push({ s: u.s, tr: (u.tr || '').slice(0, 200), w: u.where, nid: u.nid, eid: u.eid, pi: u.pi, qi: u.qi });
  e.u = new Date().toISOString();
  koSaveWords();
  const box = document.getElementById('ko-uses'); if(box){ delete box.dataset.k; }
  koShowUses(k);
  showToast('お気に入りにしたよ');
}
function koUseFavDel(j){
  const k = window._koFavK, e = koLoad()[k];
  if(!e || !Array.isArray(e.fav)) return;
  e.fav.splice(j, 1);
  if(!e.fav.length) delete e.fav;
  e.u = new Date().toISOString();
  koSaveWords();
  koShowUses(k);
}

// ===== 穴埋めクイズ（本の文で、どの単語が入るか選ぶ。復習の間隔は変えない練習） =====
let _koCz = null;
function koShuffle(a){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
async function koClozeSentence(k){
  const e = koLoad()[k] || {}, forms = koUseForms(k);
  const has = t => t && forms.some(f => t.includes(f));
  const fav = (Array.isArray(e.fav) ? koShuffle(e.fav) : []).find(f => has(f.s));
  if(fav) return { s: fav.s, tr: fav.tr || '', where: fav.w || '' };
  const c = koMs(e).map(x => x.c).find(has);
  if(c) return { s: c, tr: '', where: '登録したときの文' };
  try{ const r = await koUsesSearch(k, 1); if(r.list[0]) return { s: r.list[0].s, tr: r.list[0].tr, where: r.list[0].where }; }catch(_){}
  return null;
}
async function openKoCloze(keysIn){
  const w = koLoad();
  const all = Object.keys(w).filter(k => !/\s/.test(k));
  if(all.length < 2){ showToast('単語を2つ以上登録してね'); return; }
  koCloseSheet(); try{ closeKoWordList(); }catch(_){}
  const body = document.getElementById('ko-sheet-body');
  body.innerHTML = '<div class="ko-title">穴埋めクイズ</div><div class="ko-uses-msg" id="ko-cz-loading">本の中から問題を作っています…</div>';
  document.getElementById('ko-sheet').classList.add('show');
  document.getElementById('ko-sheet-ov').classList.add('show');
  const due = new Set(koDueKeys()), weak = new Set(koWeakKeys());
  const cand = keysIn ? koShuffle(keysIn.filter(k => w[k])) : koShuffle(all).sort((a, b) => (weak.has(b) + due.has(b)) - (weak.has(a) + due.has(a)));
  const qs = [];
  const token = {};
  _koCz = { token };
  for(const k of cand.slice(0, 40)){
    if(qs.length >= 10 || _koCz.token !== token || !document.getElementById('ko-cz-loading')) break;
    const sen = await koClozeSentence(k);
    if(!sen) continue;
    qs.push(Object.assign({ k }, sen));
  }
  if(_koCz.token !== token || !document.getElementById('ko-sheet').classList.contains('show') || !document.getElementById('ko-cz-loading')) return;
  if(!qs.length){
    body.innerHTML = `<div class="ko-title">穴埋めクイズ</div><div class="ko-note">本の中に、登録した単語が出てくる文が見つからなかったよ。韓国語の本を読みながら単語を登録してね。</div>
      <div class="ko-actions"><button class="ko-save" onclick="koCloseSheet()">閉じる</button></div>`;
    return;
  }
  _koCz = { token, qs, i: 0, ok: 0, wrong: [] };
  koClozeShow();
}
function koClozeChoices(k){
  const w = koLoad(), head = koHead(k, w[k]);
  const verb = /다$/.test(head);
  const others = koShuffle(Object.keys(w).filter(x => x !== k && !/\s/.test(x)));
  const labels = [head];
  const pick = list => { for(const x of list){ if(labels.length >= 4) break; const h = koHead(x, w[x]); if(h && !labels.includes(h)) labels.push(h); } };
  pick(others.filter(x => /다$/.test(koHead(x, w[x])) === verb));
  pick(others);
  return koShuffle(labels);
}
function koClozeShow(){
  const q = _koCz, body = document.getElementById('ko-sheet-body');
  if(!q || !q.qs) return;
  if(q.i >= q.qs.length){ koClozeDone(); return; }
  const it = q.qs[q.i], forms = koUseForms(it.k);
  const f = forms.find(x => it.s.includes(x)) || it.k;
  const at = it.s.indexOf(f);
  it.choices = it.choices || koClozeChoices(it.k);
  const e = koLoad()[it.k] || {};
  body.innerHTML = `
    <div class="ko-quiz-top"><span class="ko-tag">穴埋め</span><span>${q.i + 1} / ${q.qs.length}</span></div>
    <div class="ko-cz-s" id="ko-cz-s">${escapeHtml(it.s.slice(0, at))}<span class="ko-cz-blank">${'＿'.repeat(Math.min(4, Math.max(2, f.length)))}</span>${escapeHtml(it.s.slice(at + f.length))}</div>
    ${it.tr ? `<div class="ko-use-tr ko-cz-tr">${escapeHtml(it.tr.length > 140 ? it.tr.slice(0, 140) + '…' : it.tr)}</div>` : ''}
    <button class="ko-cz-hint" id="ko-cz-hint" onclick="koClozeHint()">ヒント（意味を見る）</button>
    <div class="ko-cz-choices">${it.choices.map((c, j) => `<button class="ko-cz-c" data-j="${j}" onclick="koClozeAnswer(${j})">${escapeHtml(c)}</button>`).join('')}</div>
    <div id="ko-cz-after"></div>`;
}
function koClozeHint(){
  const q = _koCz; if(!q || !q.qs) return;
  const it = q.qs[q.i], e = koLoad()[it.k] || {};
  const h = document.getElementById('ko-cz-hint');
  if(h) h.outerHTML = `<div class="ko-cz-hintv">意味：${escapeHtml(koMs(e).map(x => x.m).join('／'))}</div>`;
}
function koClozeAnswer(j){
  const q = _koCz; if(!q || !q.qs) return;
  const it = q.qs[q.i];
  if(it.answered) return;
  it.answered = true;
  const e = koLoad()[it.k] || {};
  const right = it.choices[j] === koHead(it.k, e);
  if(right) q.ok++; else q.wrong.push(it.k);
  document.querySelectorAll('.ko-cz-c').forEach(b => {
    const c = it.choices[+b.dataset.j];
    b.disabled = true;
    if(c === koHead(it.k, e)) b.classList.add('ok'); else if(+b.dataset.j === j) b.classList.add('ng');
  });
  const s = document.getElementById('ko-cz-s');
  if(s) s.innerHTML = koUseHi(it.s, koUseForms(it.k));
  const h = document.getElementById('ko-cz-hint'); if(h) h.remove();
  document.getElementById('ko-cz-after').innerHTML = `
    <div class="ko-cz-res ${right ? 'ok' : 'ng'}">${right ? 'せいかい！' : 'ざんねん…'}</div>
    <div class="ko-cz-mean"><b>${escapeHtml(koHead(it.k, e))}</b>　${escapeHtml(koMs(e).map(x => x.m).join('／'))}</div>
    ${it.where ? `<div class="ko-use-w">${escapeHtml(it.where)}</div>` : ''}
    <div class="ko-actions"><button class="ko-cancel" onclick="koSpeak(_koCz.qs[_koCz.i].s)">🔊 文を聞く</button><button class="ko-save" onclick="_koCz.i++;koClozeShow()">${q.i + 1 >= q.qs.length ? '結果を見る' : '次へ'}</button></div>`;
  koSpeak(it.s, true);
}
function koClozeDone(){
  const q = _koCz, body = document.getElementById('ko-sheet-body');
  window._koCzWrong = q.wrong.slice();
  body.innerHTML = `<div class="ko-title">おつかれさま！</div>
    <div class="ko-quiz-res">${q.qs.length}問中 ${q.ok}問 せいかい</div>
    ${q.wrong.length ? `<div class="ko-quiz-sub">まちがえた単語：${q.wrong.map(k => escapeHtml(koHead(k, koLoad()[k] || {}))).join('、')}</div>` : '<div class="ko-quiz-sub">全問せいかい！すごい！</div>'}
    <div class="ko-actions">
      ${q.wrong.length ? '<button class="ko-cancel" onclick="openKoCloze(window._koCzWrong)" style="background:none;color:#007070;padding-left:0">まちがえた単語をもう一回</button>' : '<button class="ko-cancel" onclick="openKoCloze()" style="background:none;color:#007070;padding-left:0">もう一回</button>'}
      <button class="ko-save" onclick="koCloseSheet()">閉じる</button>
    </div>`;
}
