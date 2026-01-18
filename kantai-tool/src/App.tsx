import React, { useState, useEffect } from 'react';
import Login from './Login';
import FleetManager from './FleetManager'; // ← これは後で作る艦隊画面

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('userToken');
    if (saved) {
      setToken(saved);
      console.log('saved:',saved);
    }
    setLoading(false);
  }, []);

  if (loading) return <div>読み込み中...</div>;

return token ? (
  <FleetManager
    token={token}
    onLogout={() => {
      localStorage.removeItem('userToken'); // 保存されてたトークンも削除！
      setToken(null); // ログアウト状態にする
    }}
  />
) : (
  <Login onLogin={(newToken) => {
    localStorage.setItem('userToken', newToken); // ログイン時に保存！
    setToken(newToken);
  }} />
);
}

export default App;
