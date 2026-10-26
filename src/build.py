# 韓国語メモの部分（ko_feature.js / ko_feature.css）を、公開中の3つのHTMLに入れ直す。
# 使い方：リポジトリのいちばん上で  python3 src/build.py
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
here = os.path.join(root, 'src')
js = open(os.path.join(here, 'ko_feature.js'), encoding='utf-8').read()
css = open(os.path.join(here, 'ko_feature.css'), encoding='utf-8').read()
for f in ['index.html', 'beta2/index.html', 'beta/index.html']:
    p = os.path.join(root, f)
    s = open(p, encoding='utf-8').read()
    a = s.index('/* ══════════════════════════════════════════════════════════\n   韓国語メモ（beta2）'); b = s.index('\n\nfunction setupDoubleTap(){', a)
    s = s[:a] + js + s[b:]
    a = s.index('/* ══════ 韓国語メモ（beta2） ══════ */'); b = s.index('\n</style>', a)
    s = s[:a] + css + s[b:]
    open(p, 'w', encoding='utf-8').write(s)
    print('ok', f)
