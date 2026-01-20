# Kantai Manager

「艦隊これくしょん -艦これ-」の艦隊編成を管理するためのWebアプリケーションプロジェクトです。
Reactによるフロントエンドと、Node.jsによるバックエンドサーバーで構成されています。

## プロジェクト構成

このリポジトリは以下の2つのサブプロジェクトを含んでいます。

*   **kantai-tool**: フロントエンド (React)
    *   艦隊編成シミュレーション（通常艦隊・遊撃部隊・連合艦隊対応）。
    *   ドラッグ＆ドロップによる直感的な操作。
    *   イベント海域ごとの特効グループ作成機能。
*   **kanmusu-server**: バックエンド (Node.js/Express)
    *   艦娘データ、編成データ、特効データのRESTful API。
    *   JSONファイルベースのデータ永続化。

## セットアップと起動

動作させるには、バックエンドとフロントエンドの両方を起動する必要があります。

### 1. 前提条件

*   Node.js (LTS推奨) がインストールされていること。

### 2. バックエンド (kanmusu-server) の起動

```bash
cd kanmusu-server
npm install
node server.js
# または pm2 start server.js --name "kanmusu-api"
```

サーバーはポート **3002** で起動し、`data/` ディレクトリにデータを保存します。

### 3. フロントエンド (kantai-tool) の起動

**注意**: 初回のみ、艦娘マスターデータ (`shipMaster.json`) を `kantai-tool/public/` に配置する必要があります。

```bash
cd kantai-tool
npm install
npm start
```

ブラウザで `http://localhost:3000` が開き、アプリケーションが利用可能になります。
ログイン画面では任意のユーザー名を入力してください（初回は自動登録されます）。

## ドキュメント

詳細な仕様や使い方は各ディレクトリの README を参照してください。

*   フロントエンド (kantai-tool) README
*   バックエンド (kanmusu-server) README
