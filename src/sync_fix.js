/* ══════ クラウド同期の直し ══════ */
// ・同期中にもう一度「クラウドへ同期」を押すと、何もしないのに「同期しました」と出ていた
//   → いまの同期が終わるのを待ってから、もう一度（最新の内容で）同期する
// ・最終同期の時刻は、本のデータを送れた時点で更新する（挿絵はそのあと裏で送る）
// ・通信が止まったまま戻ってこないときは、3分で打ち切ってエラーにする（次の同期ができなくなるのを防ぐ）
let _gdUpP = null, _gdUpAt = 0, _gdNext = null, _gdImgP = null;
const GD_TIMEOUT = 180000;
function gdFmtSize(n){ return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB'; }
async function gdUploadOnce(){
  _gdriveUploading = true;
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), GD_TIMEOUT) : null;
  let size = 0;
  try{
    await gdriveEnsureToken();
    const payload = {
      app: 'novel-reader',
      version: 1,
      syncedAt: new Date().toISOString(),
      library: state.library || [],
      settings: Object.assign({}, state.settings || {}, { ttsApiKey: undefined }), // APIキーは上げない
    };
    const json = JSON.stringify(payload);
    size = json.length;
    const existing = await gdriveFindFile();
    const boundary = '-------novel-boundary-' + Date.now();
    const meta = { name: GDRIVE_FILE_NAME, mimeType: 'application/json' };
    if(!existing) meta.parents = ['appDataFolder'];
    const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n' +
      '--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + json + '\r\n--' + boundary + '--';
    const url = existing
      ? 'https://www.googleapis.com/upload/drive/v3/files/' + existing.id + '?uploadType=multipart'
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    await gdriveFetch(url, Object.assign({ method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }, ac ? { signal: ac.signal } : {}));
    // 本のデータが送れた時点で「最終同期」を更新
    localStorage.setItem(LS_LAST_SYNC, payload.syncedAt);
    localStorage.removeItem(LS_LAST_ERR);
    // 挿絵は裏で（失敗しても本のデータの同期は終わっている。次の同期でまた送る）
    if(!_gdImgP) _gdImgP = gdriveUploadImages().catch(e => console.warn('gdriveUploadImages:', e)).finally(() => { _gdImgP = null; });
  }catch(e){
    let msg = e && e.name === 'AbortError' ? '通信が止まったので打ち切りました' : (e && e.message) || '不明';
    if(/Drive API 413/.test(msg) || (size > 5 * 1024 * 1024 && /Drive API 4\d\d/.test(msg))) msg += `（データが大きすぎるかも：${gdFmtSize(size)}）`;
    try{ localStorage.setItem(LS_LAST_ERR, msg); }catch(_){}
    const err = new Error(msg); err.cause = e;
    throw err;
  }finally{
    if(timer) clearTimeout(timer);
  }
}
if(typeof gdriveUploadData === 'function'){
  gdriveUploadData = function(){
    // 前の同期がまだ終わっていない：終わってからもう一度（最新の内容で）
    if(_gdUpP && Date.now() - _gdUpAt < GD_TIMEOUT + 10000){
      if(!_gdNext) _gdNext = _gdUpP.catch(() => {}).then(() => { _gdNext = null; return gdriveUploadData(); });
      return _gdNext;
    }
    _gdUpAt = Date.now();
    const p = gdUploadOnce().finally(() => {
      if(_gdUpP === p){ _gdUpP = null; _gdriveUploading = false; }
      try{ if(gdriveIsSignedIn()) updateGdriveUI(true); }catch(_){}
    });
    _gdUpP = p;
    return p;
  };
}
if(typeof gdriveSyncNow === 'function'){
  gdriveSyncNow = async function(){
    if(!gdriveIsSignedIn()){ gdriveSignIn(); return; }
    try{
      if(state.editMode && state.curPage != null){
        try{ syncEditorToState(state.curPage); }catch(_){}
        syncCurrentEpisode();
      }
      showToast(_gdUpP ? '前の同期が終わるのを待っています…' : '同期中...');
      await gdriveUploadData();
      try{ await koSyncWords(); }catch(e){ console.warn('ko sync', e); }
      showToast('クラウドに同期しました');
    }catch(e){
      console.warn('gdriveSyncNow:', e);
      showToast('同期失敗：' + e.message);
    }finally{
      try{ updateGdriveUI(true); }catch(_){}
    }
  };
}
/* ══════ クラウド同期の直しここまで ══════ */
