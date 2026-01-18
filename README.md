# Kantai Manager

「艦隊これくしょん -艦これ-」の艦隊編成を管理するためのWebアプリケーションプロジェクトです。
Reactによるフロントエンドと、Node.jsによるバックエンドサーバーで構成されています。

## プロジェクト構成

このリポジトリは以下の2つのサブプロジェクトを含んでいます。

*   **[kantai-tool](./kantai-tool)**: フロントエンド (React)
    *   艦隊編成のUI、ドラッグ＆ドロップ操作、特効データ作成など。
*   **[kanmusu-server](./kanmusu-server)**: バックエンド (Node.js/Express)
    *   艦娘データ、編成データ、特効データの保存・管理API。

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

サーバーはポート **3002** で起動します。

### 3. フロントエンド (kantai-tool) の起動

**注意**: 初回のみ、艦娘マスターデータ (`shipMaster.json`) を `kantai-tool/public/` に配置する必要があります。

```bash
cd kantai-tool
npm install
npm start
```

ブラウザで `http://localhost:3000` が開き、アプリケーションが利用可能になります。

## 使い方

詳細な使い方は各ディレクトリの README を参照してください。

*   フロントエンドのドキュメント
*   バックエンドのドキュメント
