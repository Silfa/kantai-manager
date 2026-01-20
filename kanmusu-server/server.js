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

// マスタデータ保存
app.post('/api/master', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');
  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }

  try {
    let rawData = req.body.data;
    // svdata=... 形式への対応
    if (typeof rawData === 'string') {
        if (rawData.startsWith('svdata=')) {
            rawData = rawData.substring(7);
        }
        try {
            rawData = JSON.parse(rawData);
        } catch (e) {
            // JSONパース失敗は後続のチェックで弾く
        }
    }
    
    // 構造の正規化 (api_dataがあるかどうか)
    const dataRoot = rawData.api_data ? rawData.api_data : rawData;

    if (!dataRoot || !dataRoot.api_mst_ship || !dataRoot.api_mst_stype) {
        return res.status(400).send('有効なマスタデータ(api_mst_ship, api_mst_stype)が見つかりません');
    }

    const masterData = {
        api_mst_ship: dataRoot.api_mst_ship,
        api_mst_stype: dataRoot.api_mst_stype
    };

    const dir = path.join(__dirname, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const filePath = path.join(dir, `${userId}_master.json`);
    
    fs.writeFile(filePath, JSON.stringify(masterData, null, 2), (err) => {
      if (err) return res.status(500).send('保存失敗');
      res.send('マスタデータ保存完了！');
    });
  } catch (e) {
      console.error(e);
      res.status(500).send('データ処理中にエラーが発生しました');
  }
});

// マスタデータ読み込み
app.get('/api/master', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');
  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }

  const filePath = path.join(__dirname, 'data', `${userId}_master.json`);
  if (!fs.existsSync(filePath)) return res.json({}); // 空オブジェクトを返す
  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(500).send('読み込み失敗');
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      res.json({});
    }
  });
});

// 艦種設定保存
app.post('/api/stype_config', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');
  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }

  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const filePath = path.join(dir, `${userId}_stype_config.json`);
  
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) return res.status(500).send('保存失敗');
    res.send('艦種設定保存完了！');
  });
});

// 艦種設定読み込み
app.get('/api/stype_config', (req, res) => {
  const userId = req.headers['x-user-token'];
  if (!userId) return res.status(401).send('未認証');
  if (!/^[a-z0-9\-_]+$/i.test(userId)) {
    return res.status(400).send('ユーザー名に使用できない文字が含まれています');
  }

  const filePath = path.join(__dirname, 'data', `${userId}_stype_config.json`);
  if (!fs.existsSync(filePath)) return res.json([]); // 空配列を返す
  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(500).send('読み込み失敗');
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      res.json([]);
    }
  });
});

app.listen(PORT, () => {
  console.log(`サーバー起動中：http://localhost:${PORT}`);
});
