# src（作業用の元ファイル）

アプリの動作には使われません。作業場所が消えても、ここから作り直せるように置いています。

- ko_feature.js / ko_feature.css … 韓国語メモ機能
- aozora.js / aozora.css … 青空文庫（名作の本棚・テキスト取り込み）
- ux.js / ux.css … 使いやすさ（続きを読む・バーを隠す・設定のタブ・メニュー整理）
- tts_cache.js / tts_cache.css … Googleの高音質読み上げの音声を端末に保存（同じ文は2回目から無料）
- sync_fix.js … クラウド同期の直し（同期中に押したとき・止まったとき・最終同期の時刻）
- sync_merge.js … 本棚の同期を「混ぜ合わせ」に（消した本が戻らない・足した話が消えない・復元も混ぜ合わせ）
- make_prod.py … β1（beta/index.html）から本番 index.html を作る（試験版の印を外す・IS_BETA=false など）
- build.py … 上をまとめて、beta2/・beta/・本番 index.html を作り直す
- worker.js … Cloudflare Worker の最新版の控え（秘密の値は入っていません）
- tests/ … 動作確認用のスクリプト（Playwright）

本番は β1 と同じ中身（投稿・共有つき）。直すときは beta/index.html を直してから build.py を実行する。

../aozora/ … 名作の本棚の作品（青空文庫のテキストをUTF-8にして外字を文字にしたもの）と一覧 catalog.json。
作品を足すときは、著作権が切れているか（図書カードの「著作権存続」がないか）を必ず確認すること。

※ APIキー・合言葉・STATS_KEY などは、ここにも書かないこと。
