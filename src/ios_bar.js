/* ══════ iPhone：編集バーの位置 ══════ */
// iPhoneだけ：
// ・キーボードを出すと、iPhoneが付ける灰色のバー（∧ ∨ ✓）が編集バーにかぶる → 編集バーを上に出せるようにする（最初は「上」）
// ・ホーム画面から開いたとき、画面の下のホームバー（アプリを切り替える横線）に編集バーが重なる → 下に余白を空ける
// AndroidとPCは今まで通り（設定にも出さない）
const IOSBAR_LS = LS_PREFIX + 'ios-editbar';
function iosIs(){
  if(window._fakeIOS) return true;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function iosBarPos(){ try{ return localStorage.getItem(IOSBAR_LS) === 'bottom' ? 'bottom' : 'top'; }catch(_){ return 'top'; } }
function iosSetBarPos(p){
  try{ localStorage.setItem(IOSBAR_LS, p === 'bottom' ? 'bottom' : 'top'); }catch(_){}
  iosBarUpdate(); iosBarPanelRefresh();
}
// ホームバーの分の余白（ホーム画面から開いたときだけ。ホームボタンのある iPhone には無い）
function iosHomePad(){
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if(!standalone && !window._fakeIOS) return 0;
  const tall = Math.max(screen.width, screen.height) >= 812;
  return tall ? 28 : 0;
}
let _iosBarRaf = 0, _iosTouched = false;
// 位置の微調整（端末ごと）：位置（上／下）×キーボード（あり／なし）ごとに、px
const IOSADJ_LS = LS_PREFIX + 'ios-editbar-adj';
function iosAdjAll(){ try{ return JSON.parse(localStorage.getItem(IOSADJ_LS) || '{}') || {}; }catch(_){ return {}; } }
function iosAdj(pos, kb){ const v = parseFloat(iosAdjAll()[pos + (kb ? '-kb' : '')]); return isFinite(v) ? v : 0; }
function iosAdjSet(pos, kb, v){
  const m = iosAdjAll(); const k = pos + (kb ? '-kb' : '');
  if(v) m[k] = v; else delete m[k];
  try{ localStorage.setItem(IOSADJ_LS, JSON.stringify(m)); }catch(_){}
}
function iosAdjStep(kb, d){
  const pos = iosBarPos();
  iosAdjSet(pos, kb, Math.min(160, Math.max(-40, iosAdj(pos, kb) + d)));
  iosBarUpdate(); iosBarPanelRefresh();
}
function iosAdjReset(){
  const pos = iosBarPos(); iosAdjSet(pos, false, 0); iosAdjSet(pos, true, 0);
  iosBarUpdate(); iosBarPanelRefresh();
}
function iosBarUpdate(){
  if(!iosIs()) return;
  cancelAnimationFrame(_iosBarRaf);
  _iosBarRaf = requestAnimationFrame(() => {
    try{
      const bb = document.getElementById('botbar'), vp = document.getElementById('viewport');
      if(!bb || !vp) return;
      const vv = window.visualViewport;
      const kb = vv ? Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height))) : 0;
      const top = state.editMode && iosBarPos() === 'top';
      document.body.classList.toggle('ios-bar-top', top);
      if(!state.editMode){
        // 読むときは今まで通り（編集のときに変えたところだけ戻す）
        bb.style.paddingBottom = ''; bb.style.top = '';
        if(_iosTouched){ vp.style.top = ''; _iosTouched = false; }
        return;
      }
      _iosTouched = true;
      // ホームバーの余白：キーボードが出ていないときだけ（出ているときはキーボードの裏）
      const kbOn = kb >= 40;
      const adj = iosAdj(top ? 'top' : 'bottom', kbOn);
      const pad = (!top && !kbOn) ? Math.max(0, iosHomePad() + adj) : 0;
      bb.style.paddingBottom = pad ? pad + 'px' : '';
      if(top){
        // 上のバーが見えていればそのすぐ下、キーボードで画面がずれていれば、見えている範囲のいちばん上
        const topH = (document.getElementById('topbar') || {}).offsetHeight || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 50;
        const off = vv ? vv.offsetTop : 0;
        const y = Math.max(0, Math.max(topH, Math.round(off)) + adj);
        bb.style.top = y + 'px'; bb.style.bottom = 'auto';
        vp.style.top = (topH + bb.offsetHeight + Math.max(0, iosAdj('top', false))) + 'px';
        vp.style.bottom = kb + 'px';
      } else {
        // 下：キーボードなしは余白（pad）で、キーボードありは持ち上げる高さで調整
        const lift = kbOn ? Math.max(0, kb + adj) : 0;
        bb.style.top = '';
        bb.style.bottom = lift + 'px';
        vp.style.top = '';
        vp.style.bottom = (lift + bb.offsetHeight) + 'px';
      }
    }catch(e){ console.warn('ios bar', e); }
  });
}
if(iosIs()){
  document.documentElement.classList.add('ios');
  if(window.visualViewport){
    // もとのキーボード対応のあとに動くように、少し遅らせて登録
    setTimeout(() => {
      window.visualViewport.addEventListener('resize', iosBarUpdate);
      window.visualViewport.addEventListener('scroll', iosBarUpdate);
    }, 0);
  }
  window.addEventListener('resize', iosBarUpdate);
  ['enterEditMode', 'exitEditMode', 'openEpisode', 'showToc', 'showLibrary'].forEach(fn => {
    if(typeof window[fn] !== 'function') return;
    const orig = window[fn];
    window[fn] = function(){ const r = orig.apply(this, arguments); iosBarUpdate(); setTimeout(iosBarUpdate, 350); return r; };
  });
  try{ const bb = document.getElementById('botbar'); if(bb && window.ResizeObserver) new ResizeObserver(iosBarUpdate).observe(bb); }catch(_){}
  setTimeout(iosBarUpdate, 0);
}
// 設定（その他）に「編集バーの位置」：iPhoneのときだけ
function iosBarPanelInstall(){
  if(!iosIs() || document.getElementById('ios-bar-row')) return;
  const body = document.getElementById('panel-body'); if(!body) return;
  const row = document.createElement('div');
  row.className = 'ps'; row.id = 'ios-bar-row'; row.dataset.uxT = 'etc';
  row.innerHTML = `<div class="pl">編集バーの位置<small>iPhone</small></div><div class="pr"><button class="ob" data-p="top" onclick="iosSetBarPos('top')">上</button><button class="ob" data-p="bottom" onclick="iosSetBarPos('bottom')">下</button></div><div class="fs-hint ios-hint">キーボードを出すと、iPhoneの灰色のバーが下の編集バーにかぶるときは「上」にしてね</div>
    <div class="ios-adj">
      <div class="ios-adj-k">位置の微調整</div>
      <div class="stepper-line"><div class="pl">キーボードなし</div><div class="stepper-row"><button class="stepper-btn" onclick="iosAdjStep(false,-4)">－</button><span class="stepper-val" id="ios-adj-0">0</span><button class="stepper-btn" onclick="iosAdjStep(false,4)">＋</button></div></div>
      <div class="stepper-line"><div class="pl">キーボードあり</div><div class="stepper-row"><button class="stepper-btn" onclick="iosAdjStep(true,-4)">－</button><span class="stepper-val" id="ios-adj-1">0</span><button class="stepper-btn" onclick="iosAdjStep(true,4)">＋</button></div></div>
      <div class="ios-adj-foot"><span class="ios-adj-dir"></span><button class="ios-adj-reset" onclick="iosAdjReset()">もとに戻す</button></div>
    </div>`;
  body.appendChild(row);
}
function iosBarPanelRefresh(){
  const row = document.getElementById('ios-bar-row'); if(!row) return;
  const pos = iosBarPos();
  row.querySelectorAll('.ob').forEach(b => b.classList.toggle('active', b.dataset.p === pos));
  [false, true].forEach((kb, i) => { const el = document.getElementById('ios-adj-' + i); if(el){ const v = iosAdj(pos, kb); el.textContent = (v > 0 ? '+' : '') + v + 'px'; } });
  const dir = row.querySelector('.ios-adj-dir');
  if(dir) dir.textContent = pos === 'top' ? '＋で下に、－で上に動きます' : '＋で上に、－で下に動きます';
}
if(typeof togglePanel === 'function'){
  const _iosOrigTP = togglePanel;
  togglePanel = function(){
    const r = _iosOrigTP.apply(this, arguments);
    try{ iosBarPanelInstall(); iosBarPanelRefresh(); }catch(_){}
    return r;
  };
}
/* ══════ iPhone：編集バーの位置ここまで ══════ */
