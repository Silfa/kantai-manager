// Login.tsx
import React, { useState } from 'react';

interface Props {
  onLogin: (token: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');

  const handleLogin = async () => {
    // クライアントサイドでの簡易チェック
    if (!username) return;
    if (!/^[a-z0-9\-_]+$/i.test(username)) {
      alert('ユーザー名には半角英数字、ハイフン、アンダースコアのみ使用できます');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('userToken', data.token);
        onLogin(data.token);
      } else {
        alert('ログイン失敗');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'サーバーに接続できませんでした');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>艦隊司令部ログイン</h2>
      <input
        type="text"
        placeholder="ユーザー名を入力"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button onClick={handleLogin} style={{ marginLeft: '1rem' }}>
        ログイン
      </button>
    </div>
  );
}
