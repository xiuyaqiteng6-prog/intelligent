# NOOS — 仮想知性育成シミュレーター

Obsidian の「第二の脳」のようなグラフの中で、あなただけの仮想知性を育てるシミュレーターゲームです。ブラウザ(PWA、iOS/iPad/Windows/Macどこでも)に加えて、**Windowsデスクトップアプリ(.exe)** としても動作し、**ローカルLLM(Ollama / LM Studio など)** に接続してAIとの対話をより自然にすることができます。

## 遊び方

1. `index.html` を開く(下記「起動方法」参照)
2. あなたの仮想知性に **名前をつけ**、最初に伸ばしたい力(論理・創造・共感・好奇心・規律)を1つ選んで育成をはじめる
3. 中央のグラフ画面には、意識の核(コアノード)が表示される。これがあなたのAIそのもの
4. 左のサイドバー(モバイルでは下部タブ)から:
   - **育成する** — 集中力ポイントを使って新しい概念(ノート)を学ばせる。学ぶたびにグラフにノードが増え、繋がりが生まれる。同じ画面から「内省させる」も行え、時間経過(オフラインでも進行)でノート同士の新しい繋がりを見つける
   - **対話する** — チャット形式で語りかける。性格(現在最も高い能力)に応じて応答が変わる
   - **日誌を見る** — ランダムに発生する「できごと」の選択履歴が記録される
5. ノードをクリックすると、そのノートの詳細と繋がりを確認できる
6. 学習したノート数に応じて意識は「芽生え → 若木の心 → 結びつく知性 → 創発する意識 → 越境する知性 → 第二の脳、完成へ」と進化していく

進行状況はブラウザの `localStorage` に自動保存され、閉じてもそのまま続きから遊べます。オフライン中も集中力の回復や内省は時間経過分だけ進みます。

## 起動方法

ビルド不要の静的サイトです。お好きな方法でどうぞ。

```bash
# 方法1: Pythonの簡易サーバー
python3 -m http.server 8000

# 方法2: Node.js (npx serve)
npx serve .
```

ブラウザで `http://localhost:8000` (または表示されたURL) を開いてください。

### iPhone / iPad で「アプリ」として使う

1. 上記サーバーを常時稼働するホスティング先(GitHub Pages, Netlify, Vercel など)にデプロイする
2. iPhone の Safari でアクセスし、共有ボタン →「ホーム画面に追加」
3. ホーム画面のアイコンから起動すると、アドレスバーなしのフルスクリーンアプリとして動作する(`manifest.webmanifest` / `sw.js` によるPWA対応)

## Windows版(デスクトップアプリ)を作る

Electron でラップした Windows 向け実行ファイルをビルドできます。ビルド自体は Windows・Mac・Linux どの開発機からでも実行可能です(このリポジトリでは Linux 上で wine を使い、実際に `NOOS 1.0.0.exe` の生成まで確認済みです)。

```bash
npm install          # electron / electron-builder を取得
npm start             # 開発時にそのままアプリを起動して動作確認
npm run build:win     # dist/NOOS <version>.exe (ポータブル版、インストール不要)を生成
```

生成された `dist/NOOS <version>.exe` をそのままダブルクリックすれば起動します(インストーラ不要のポータブル形式)。配布したい場合はこの1ファイルを共有するだけで大丈夫です。

- `electron/main.js` — Electronのメインプロセス(ウィンドウ生成、`index.html`をfile://で読み込み)
- `package.json` の `build` フィールド — electron-builder の設定(アイコンは `icons/icon.ico`)
- Web版と全く同じ `index.html` / `js/` / `css/` を読み込んでいるため、機能差はありません

## ローカルLLMと接続する(対話の質を上げる)

デフォルトの対話はテンプレートベースの簡易応答ですが、お使いのPCで動いているローカルLLM(**OpenAI互換のchat completions API**を持つサーバーなら何でも: Ollama, LM Studio, llama.cpp server, text-generation-webui など)に接続すると、LLMが生成する自然な応答に切り替わります。

1. ローカルLLMサーバーを起動する
   - **Ollama**: `ollama run llama3.1` などでモデルを起動(既定で `http://localhost:11434` を待ち受け。OpenAI互換エンドポイントは `http://localhost:11434/v1`)
   - **LM Studio**: 「Local Server」タブでサーバーを起動(既定で `http://localhost:1234/v1`)
2. アプリ右上の「⋯」ボタン(または対話パネルの接続バッジ)から設定を開く
3. 「ローカルLLMを使う」をオン、ベースURLとモデル名を入力し、「接続テスト」で疎通確認
4. 「保存して閉じる」で反映。以降、対話パネルの応答がLLM生成になる(接続に失敗した場合は自動的にテンプレート応答にフォールバックする)

**ブラウザ版を使う場合の注意:** ブラウザから直接ローカルサーバーへ接続するには CORS 許可が必要です。Ollama なら起動前に `OLLAMA_ORIGINS=*`(または配信元のURLを指定)を環境変数として設定してください。**Windows版(Electron)アプリではこの制限を受けません**(file://から直接fetchするため)。

対話の応答は `js/llm.js` の `buildSystemPrompt()` が、AIの名前・成長段階・最も高い能力・これまでに学んだ概念からシステムプロンプトを自動生成して渡しているため、育成の進み具合に応じてキャラクター性が変化します。

## 技術構成

外部ライブラリやビルドツールに依存しない、素の HTML / CSS / JavaScript (ES Modules) で実装しています。

```
index.html          # 3ペインレイアウト(Obsidian風)とモバイル用タブ、各種モーダル
css/style.css        # ダークテーマ・レスポンシブ対応スタイル
js/data.js            # カテゴリ・語彙バンク・進化段階・ランダムイベント・対話テンプレートの定義
js/state.js           # ゲーム状態の生成・永続化(localStorage)・派生計算
js/graph.js           # Canvas上の力学モデル(force-directed)によるグラフ描画・パン/ズーム/選択
js/dialogue.js         # 性格(能力値)に応じたテンプレート応答生成(ローカルLLM未使用時のフォールバック)
js/llm.js               # ローカルLLM(OpenAI互換API)への接続・システムプロンプト構築・接続テスト
js/events.js           # ランダムイベントの発火スケジューリング
js/ui.js               # 全パネルの描画とユーザー操作のハンドリング
js/main.js             # 起動処理・ゲームループ・オフライン進行計算・保存
manifest.webmanifest  # PWAマニフェスト
sw.js                  # オフラインキャッシュ用 Service Worker
icons/                 # アプリアイコン(SVG / PNG / Windows用ICO)
electron/main.js       # Windowsデスクトップアプリ(Electron)のエントリポイント
package.json           # Electron / electron-builder のビルド設定
```

## 今後拡張しやすいポイント

- `js/data.js` の `CATEGORIES.<key>.words` に語彙を追加すれば、育成できる概念(ノート)が増える
- `js/data.js` の `EVENTS` にオブジェクトを追加すれば、新しいランダムイベントが増える
- `js/data.js` の `EVOLUTION_STAGES` を調整すれば、進化のペースや段階名を変更できる
