// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3002;

app.use(express.json({ limit: '50mb' }));
app.use(require('cors')());

// ユーザー名でログイン（トークン代わりにそのまま返す）
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).send('ユーザー名が必要です');
  const userId = username.trim().toLowerCase();
  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }
  res.json({ token: userId });
});

// 艦娘データ保存
app.post('/api/ships', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');

  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }
  const filePath = path.join(dir, `${userId}.json`);
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) return res.status(500).send('保存失敗');
    res.send('保存完了！');
  });
});

// 艦娘データ読み込み
app.get('/api/ships', (req, res) => {
  const userId = req.headers['x-user-token'];
  console.log('読み込みトークン:',userId);
  if (!userId) return res.status(401).send('未認証');

  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }
  const filePath = path.join(__dirname, 'data', `${userId}.json`);
  if (!fs.existsSync(filePath)) return res.json([]);
  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(500).send('読み込み失敗');
    res.json(JSON.parse(data));
  });
});

// 艦隊データ保存
app.post('/api/decks', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');

  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }
  const filePath = path.join(dir, `${userId}_decks.json`);
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) return res.status(500).send('保存失敗');
    res.send('艦隊保存完了！');
  });
});

// 艦隊データ読み込み
app.get('/api/decks', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');

  const filePath = path.join(__dirname, 'data', `${userId}_decks.json`);
  if (!fs.existsSync(filePath)) return res.json([]);
  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(500).send('読み込み失敗');
    res.json(JSON.parse(data));
  });
});

// 特効データ保存
app.post('/api/bonus', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');

  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }
  const filePath = path.join(dir, `${userId}_bonus.json`);
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) return res.status(500).send('保存失敗');
    res.send('特効データ保存完了！');
  });
});

// 特効データ読み込み
app.get('/api/bonus', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');

  const filePath = path.join(__dirname, 'data', `${userId}_bonus.json`);
  if (!fs.existsSync(filePath)) return res.json([]);
  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(500).send('読み込み失敗');
    res.json(JSON.parse(data));
  });
});

app.listen(PORT, () => {
  console.log(`サーバー起動中：http://localhost:${PORT}`);
});
