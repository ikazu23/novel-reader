# src（作業用の元ファイル）

アプリの動作には使われません。作業場所が消えても、ここから作り直せるように置いています。

- ko_feature.js / ko_feature.css … 韓国語メモ機能（3つのHTMLに同じものが入っています）
- build.py … 上の2つを index.html・beta2/index.html・beta/index.html に入れ直す
- worker.js … Cloudflare Worker の最新版の控え（秘密の値は入っていません。Cloudflare の変数・シークレットに入っています）
- tests/ … 動作確認用のスクリプト（Playwright）

※ APIキー・合言葉・STATS_KEY などは、ここにも書かないこと。
