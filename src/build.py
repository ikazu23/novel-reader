# 韓国語メモ（ko_feature.*）・青空文庫（aozora.*）・使いやすさ（ux.*）・読み上げ音声の保存（tts_cache.*）を beta2/・beta/ に入れ直し、
# 本番 index.html を β1（beta/index.html）から作り直す（make_prod.py）。
# 使い方：リポジトリのいちばん上で  python3 src/build.py
import os, subprocess
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
here = os.path.join(root, 'src')
rd = lambda n: open(os.path.join(here, n), encoding='utf-8').read()
js = rd('ko_feature.js') + '\n\n' + rd('aozora.js').rstrip('\n') + '\n\n' + rd('ux.js').rstrip('\n') + '\n\n' + rd('tts_cache.js').rstrip('\n') + '\n\n' + rd('sync_fix.js').rstrip('\n') + '\n\n' + rd('sync_merge.js').rstrip('\n') + '\n\n' + rd('db_fix.js').rstrip('\n') + '\n\n' + rd('font_std.js').rstrip('\n')
css = rd('ko_feature.css').rstrip('\n') + '\n' + rd('aozora.css').rstrip('\n') + '\n' + rd('ux.css').rstrip('\n') + '\n' + rd('tts_cache.css').rstrip('\n')
for f in ['beta2/index.html', 'beta/index.html']:
    p = os.path.join(root, f)
    s = open(p, encoding='utf-8').read()
    a = s.index('/* ══════════════════════════════════════════════════════════\n   韓国語メモ（beta2）'); b = s.index('\n\nfunction setupDoubleTap(){', a)
    s = s[:a] + js + s[b:]
    a = s.index('/* ══════ 韓国語メモ（beta2） ══════ */'); b = s.index('\n</style>', a)
    s = s[:a] + css + s[b:]
    open(p, 'w', encoding='utf-8').write(s)
    print('ok', f)
subprocess.run(['python3', os.path.join(here, 'make_prod.py'), os.path.join(root, 'beta/index.html'), os.path.join(root, 'index.html')], check=True)
