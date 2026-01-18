# 艦娘サーバー (Kanmusu Server)

これはKantai Managerプロジェクトのバックエンドサーバーです。艦娘（かんむす）データの管理（ステータス、装備、その他関連情報を含む）を行うためのRESTful APIを提供します。

## 使用技術

*   **Node.js**: JavaScriptランタイム環境
*   **Express**: Node.js用Webアプリケーションフレームワーク
*   **File System**: JSONファイルによるデータ永続化

## 始め方

### 前提条件

*   Node.js (LTSバージョン推奨)

### インストール

1.  リポジトリをクローンします:
    ```bash
    git clone https://github.com/your-username/kantai-manager.git
    cd kantai-manager/kanmusu-server
    ```

2.  依存関係をインストールします:
    ```bash
    npm install
    ```

### 設定

デフォルトではポート **3002** で起動し、`data/` ディレクトリにJSONファイルを保存します。
設定を変更する場合は `server.js` を直接編集してください。

### サーバーの起動

サーバーを起動するには以下のコマンドを実行します:

```bash
node server.js
```

または PM2 を使用する場合:

```bash
pm2 start server.js --name "kanmusu-api"
```

サーバーは `http://localhost:3002` で稼働します。

## APIエンドポイント

APIは以下の主要なリソースを提供します:

*   `/api/login`: 簡易ログイン（ユーザー名の検証）。
*   `/api/ships`: 所持艦娘データの取得・保存。
*   `/api/decks`: 艦隊編成データの取得・保存。
*   `/api/bonus`: 特効データの取得・保存。

データは `data/` ディレクトリ内のJSONファイルとして保存されます。

## プロジェクト構成

```text
kanmusu-server/
├── data/                # ユーザーデータ保存用ディレクトリ (JSONファイル)
├── node_modules/        # 依存パッケージ
├── package.json         # プロジェクト設定と依存関係
├── README.md            # プロジェクト説明書
└── server.js            # サーバーのエントリーポイント
```
