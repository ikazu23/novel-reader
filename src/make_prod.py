# β1（beta/index.html）から本番（index.html）を作る。
# 使い方：python3 make_prod.py <beta/index.html> <出力 index.html>
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
def rp(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:80], s.count(a))
    s = s.replace(a, b)
rp('<title>イカ墨ノベル（試験版）</title>', '<title>イカ墨ノベル</title>')
rp('<meta name="robots" content="noindex,nofollow">',
   '<link rel="canonical" href="https://ikazu23.github.io/novel-reader/">\n<meta name="robots" content="index,follow">\n<meta name="google-site-verification" content="CbERytln58krZ6x10OR8RH-m8vo3qT4LIkjYLzfmF4o" />')
rp('<link rel="apple-touch-icon" href="../icon-192.png">',
   '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-192.png">')
rp('''    <span id="beta-badge" style="flex-shrink:0;font-family:'Noto Sans JP',sans-serif;font-size:10px;font-weight:700;color:#fff;background:#e0701b;border-radius:10px;padding:2px 8px;">試験版</span>\n''', '')
rp('const IS_BETA = true;', 'const IS_BETA = false;')
# β2から引き継ぐボタン（本番だけ）
SYNC_BTN_END = '''    クラウドへ同期
  </button>
'''
rp(SYNC_BTN_END, SYNC_BTN_END + '''  <button id="ko-import-beta2" onclick="closeBackupMenu();koImportFromBeta2Cloud();" style="display:flex;align-items:center;gap:10px;width:100%;border:none;background:none;padding:10px 16px;font-size:13px;color:#007070;cursor:pointer;text-align:left;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><polyline points="9 9 12 12 15 9"/><line x1="12" y1="5" x2="12" y2="12"/></svg>
    お試し版（β2）のクラウドから引き継ぐ
  </button>
''')
open(dst, 'w', encoding='utf-8').write(s)
print('ok prod', dst)
