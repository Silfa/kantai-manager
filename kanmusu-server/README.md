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

APIは以下の主要なリソースを提供します。多くのエンドポイントで `x-user-token` ヘッダーによる認証（ユーザー名）が必要です。

*   **認証**:
    *   `POST /api/login`: 簡易ログイン（ユーザー名の検証）。
*   **ユーザーデータ**:
    *   `GET/POST /api/ships`: 所持艦娘データの取得・保存。
    *   `GET/POST /api/decks`: 艦隊編成データの取得・保存。
    *   `GET/POST /api/bonus`: 特効グループデータの取得・保存。
*   **設定・マスターデータ**:
    *   `GET/POST /api/master`: ゲームのマスターデータ (`api_mst_ship`, `api_mst_stype`) の取得・保存。
    *   `GET/POST /api/stype_config`: 艦種フィルタリング設定の取得・保存。

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
