# src（作業用の元ファイル）

アプリの動作には使われません。作業場所が消えても、ここから作り直せるように置いています。

- ko_feature.js / ko_feature.css … 韓国語メモ機能
- aozora.js / aozora.css … 青空文庫（名作の本棚・テキスト取り込み）
- build.py … 上の4つを index.html・beta2/index.html・beta/index.html に入れ直す
- worker.js … Cloudflare Worker の最新版の控え（秘密の値は入っていません）
- tests/ … 動作確認用のスクリプト（Playwright）

../aozora/ … 名作の本棚の作品（青空文庫のテキストをUTF-8にしたもの）と一覧 catalog.json。
作品を足すときは、著作権が切れているか（図書カードの「著作権存続」がないか）を必ず確認すること。

※ APIキー・合言葉・STATS_KEY などは、ここにも書かないこと。
