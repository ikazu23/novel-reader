# 韓国語メモ（ko_feature.*）と青空文庫（aozora.*）を、公開中の3つのHTMLに入れ直す。
# 使い方：リポジトリのいちばん上で  python3 src/build.py
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
here = os.path.join(root, 'src')
rd = lambda n: open(os.path.join(here, n), encoding='utf-8').read()
js = rd('ko_feature.js') + '\n\n' + rd('aozora.js').rstrip('\n')
css = rd('ko_feature.css').rstrip('\n') + '\n' + rd('aozora.css').rstrip('\n')
for f in ['index.html', 'beta2/index.html', 'beta/index.html']:
    p = os.path.join(root, f)
    s = open(p, encoding='utf-8').read()
    a = s.index('/* ══════════════════════════════════════════════════════════\n   韓国語メモ（beta2）'); b = s.index('\n\nfunction setupDoubleTap(){', a)
    s = s[:a] + js + s[b:]
    a = s.index('/* ══════ 韓国語メモ（beta2） ══════ */'); b = s.index('\n</style>', a)
    s = s[:a] + css + s[b:]
    open(p, 'w', encoding='utf-8').write(s)
    print('ok', f)
