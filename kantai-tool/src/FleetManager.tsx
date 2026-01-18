import React, { useEffect, useState } from "react";
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent, 
  DragOverlay, 
  PointerSensor, 
  useSensor, 
  useSensors,
  pointerWithin,
  useDroppable
} from "@dnd-kit/core";
import { DraggableShip, ShipItem } from "./DraggableShip";
import FleetSlot from "./FleetSlot";
import { RawShip, ShipMasterData, ApiMstShip, ApiMstStype } from "./types";

interface Deck {
  name: string;
  ships: (RawShip | null)[];
  isCombined?: boolean;
}

interface BonusGroup {
  id: string;
  text: string;
  shipIds: number[];
}

function BonusDropArea({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        border: "2px dashed #ccc",
        padding: "1rem",
        backgroundColor: isOver ? "#f0f8ff" : "#fff",
        minHeight: "100px",
        borderRadius: "8px"
      }}
    >
      {children}
    </div>
  );
}

export default function FleetManager({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [ships, setShips] = useState<RawShip[]>([]);
  const [inputText, setInputText] = useState("");
  const [shipMaster, setShipMaster] = useState<Record<string, ShipMasterData>>(
    {},
  );
  const [stypeMaster, setStypeMaster] = useState<Record<string, string>>({});
  const [selectedStype, setSelectedStype] = useState<string | null>(null);
  const [decks, setDecks] = useState<Deck[]>([
    { name: "第1艦隊", ships: Array(6).fill(null) }
  ]);
  const [currentDeckIndex, setCurrentDeckIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"fleet" | "edit" | "bonus">("fleet");
  const [activeShip, setActiveShip] = useState<RawShip | null>(null);
  const [sortMode, setSortMode] = useState<"lv" | "stype" | "id">("lv");
  const [isDetailView, setIsDetailView] = useState(false);
  const [bonusMap, setBonusMap] = useState<Record<number, string>>({});
  const [masterShips, setMasterShips] = useState<ApiMstShip[]>([]);
  const [bonusGroups, setBonusGroups] = useState<BonusGroup[]>([]);

  // PointerSensorに変更（マウス・タッチ両対応、スクロール誤爆防止）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ① マスターデータ読み込み
  useEffect(() => {
    fetch("shipMaster.json")
      .then((res) => res.json())
      .then((data: { api_mst_ship: ApiMstShip[]; api_mst_stype: ApiMstStype[] }) => {
        const ships = data.api_mst_ship || [];
        setMasterShips(ships);
        const stypes = data.api_mst_stype || [];

        const shipMap: Record<string, ShipMasterData> = {};
        ships.forEach((ship) => {
          shipMap[ship.api_id] = {
            name: ship.api_name,
            stype: ship.api_stype,
          };
        });

        const stypeMap: Record<string, string> = {};
        stypes.forEach((stype) => {
          stypeMap[stype.api_id] = stype.api_name;
        });

        setShipMaster(shipMap);
        setStypeMaster(stypeMap);
      });
  }, []);

  // ② 艦娘データ読み込み
  useEffect(() => {
    fetch("/api/ships", {
      headers: { "x-user-token": token },
    })
      .then(async (res) => {
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }
        return res.json();
      })
      .then((data) => {
        console.log("📦 受け取った艦娘データ:", data);
        setShips(data);
      })
      .catch((err) => console.error("データ読み込みエラー:", err));
  }, [token]);

  // ③ 艦隊データ読み込み（追加）
  useEffect(() => {
    fetch("/api/decks", {
      headers: { "x-user-token": token },
    })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const fixedData = data.map((d: any) => ({
            ...d,
            ships: d.ships.length < 6 
              ? [...d.ships, ...Array(6 - d.ships.length).fill(null)]
              : d.ships
          }));
          setDecks(fixedData);
        }
      })
      .catch((err) => console.error("艦隊データ読み込みエラー:", err));
  }, [token]);

  // bonusGroups の変更を検知して bonusMap (表示用) を更新
  useEffect(() => {
    const newMap: Record<number, string> = {};
    bonusGroups.forEach((group) => {
      group.shipIds.forEach((id) => {
        const shipId = Number(id);
        if (!isNaN(shipId)) {
          newMap[shipId] = newMap[shipId] ? `${newMap[shipId]}\n${group.text}` : group.text;
        }
      });
    });
    setBonusMap(newMap);
  }, [bonusGroups]);

  // 特効データ読み込み
  useEffect(() => {
    fetch("/api/bonus", {
      headers: { "x-user-token": token },
    })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          // サーバー形式 ({ ids: [], text: "" }) から内部形式 (BonusGroup) に変換
          const groups = data.map((item: any, index: number) => ({
            id: String(index),
            text: item.text,
            shipIds: item.ids || []
          }));
          if (groups.length === 0) {
            setBonusGroups([{ id: "0", text: "", shipIds: [] }]);
          } else {
            setBonusGroups(groups);
          }
        }
      })
      .catch((err) => console.error("特効データ読み込みエラー:", err));
  }, [token]);

  // ③ 保存処理
  const handleSave = () => {
    try {
      // 'svdata=' で始まる場合は除去してJSONとしてパース
      let jsonStr = inputText.trim();
      if (jsonStr.startsWith("svdata=")) {
        jsonStr = jsonStr.replace(/^svdata=/, "");
      }

      const parsed = JSON.parse(jsonStr);
      
      let rawShips: RawShip[] = [];

      // データ構造の判別
      if (Array.isArray(parsed)) {
        // 配列そのものの場合 (kanmusu.json)
        rawShips = parsed;
      } else if (parsed.api_data && Array.isArray(parsed.api_data.api_ship)) {
        // APIレスポンス形式の場合 (kanmusu2.json)
        rawShips = parsed.api_data.api_ship;
      } else {
        throw new Error("艦娘データが見つかりませんでした");
      }

      // IDがないデータの検出（kanmusu.json等）
      const isIdMissing = rawShips.length > 0 && !rawShips[0].api_id;

      if (isIdMissing) {
        if (!window.confirm("IDが含まれていないデータ形式です。\nIDが再生成されるため、現在の編成データはリセットされますがよろしいですか？")) {
          return;
        }
        // デッキをリセット
        setDecks([{ name: "第1艦隊", ships: Array(6).fill(null) }]);
        setCurrentDeckIndex(0);
      }

      // データの正規化: api_id がない場合はインデックスから生成して付与
      const normalizedShips = rawShips.map((ship, index) => ({
        ...ship,
        api_id: ship.api_id || (index + 100000) 
      }));

      fetch("/api/ships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-token": token,
        },
        body: JSON.stringify(normalizedShips),
      })
        .then(async (res) => {
          const msg = await res.text();
          if (!res.ok) throw new Error(msg);
          return msg;
        })
        .then((msg) => {
          alert(msg);
          setShips(normalizedShips);
        })
        .catch((e) => alert(`保存エラー: ${e.message}`));
    } catch (e) {
      console.error(e);
      alert("JSONの形式が正しくないか、対応していないデータ形式です！");
    }
  };

  // 艦隊保存処理（追加）
  const handleSaveDecks = () => {
    fetch("/api/decks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-token": token,
      },
      body: JSON.stringify(decks),
    })
      .then((res) => res.ok ? alert("艦隊を保存しました！") : alert("保存に失敗しました"))
      .catch((e) => alert(`通信エラー: ${e.message}`));
  };

  // 特効データ保存処理
  const handleSaveBonus = () => {
    // 内部形式からサーバー形式 ({ ids: [], text: "" }) に変換
    const payload = bonusGroups.map(g => ({ ids: g.shipIds, text: g.text })).filter(g => g.text || g.ids.length > 0);
    
    fetch("/api/bonus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-token": token,
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) {
          alert("特効データを保存しました！");
        } else {
          alert("保存に失敗しました");
        }
      })
      .catch((e) => alert(`通信エラー: ${e.message}`));
  };

  // 特効データダウンロード
  const handleDownloadBonus = () => {
    const payload = bonusGroups.map(g => ({ ids: g.shipIds, text: g.text })).filter(g => g.text || g.ids.length > 0);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bonus_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 特効データインポート (編集用)
  const handleImportBonus = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          const groups = json.map((item: any) => ({
            id: crypto.randomUUID(),
            text: item.text || "",
            shipIds: Array.isArray(item.ids) ? item.ids : []
          }));
          setBonusGroups(groups.length > 0 ? groups : [{ id: crypto.randomUUID(), text: "", shipIds: [] }]);
        }
      } catch (err) {
        console.error(err);
        alert("読み込みに失敗しました");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleDragStart = (event: DragStartEvent) => {
    // IDではなくデータから艦娘オブジェクトを取得
    setActiveShip(event.active.data.current?.ship || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveShip(null);
    if (!over) return;

    // 特効モードのドロップ処理
    if (viewMode === "bonus" && String(active.id).startsWith("master-")) {
      const shipId = parseInt(String(active.id).replace("master-", ""), 10);
      const groupId = String(over.id).replace("bonus-group-", "");
      
      setBonusGroups(prev => prev.map(g => {
        if (g.id === groupId && !g.shipIds.includes(shipId)) {
          return { ...g, shipIds: [...g.shipIds, shipId] };
        }
        return g;
      }));
      return;
    }

    const ship = active.data.current?.ship as RawShip | undefined;
    const slotIndex = parseInt(String(over.id).replace("slot-", ""), 10);
    const overId = String(over.id);
    if (!overId.startsWith("slot-")) return;

    const parts = overId.replace("slot-", "").split("-");
    if (parts.length !== 2) return;

    const targetDeckIndex = parseInt(parts[0], 10);
    const targetSlotIndex = parseInt(parts[1], 10);

    if (!ship) return;

    setDecks((prevDecks) => {
      const newDecks = [...prevDecks];
      if (!newDecks[targetDeckIndex]) return prevDecks;

      const targetDeck = { ...newDecks[targetDeckIndex] };
      const newFleet = [...targetDeck.ships];

      // 既に同じ艦娘が編成されている場合は重複させない
      // const existingIndex = newFleet.findIndex((s) => s && s.api_id === ship.api_id);
      // if (existingIndex !== -1) {
      //   newFleet[existingIndex] = null;
      // }

      newFleet[targetSlotIndex] = ship;
      targetDeck.ships = newFleet;
      newDecks[targetDeckIndex] = targetDeck;
      return newDecks;
    });
  };

  const handleRemoveShip = (deckIndex: number, slotIndex: number) => {
    setDecks((prevDecks) =>
      prevDecks.map((deck, idx) =>
        idx === deckIndex ? { ...deck, ships: deck.ships.map((s, i) => (i === slotIndex ? null : s)) } : deck
      )
    );
  };

  // 特効データ読み込みハンドラ
  const handleBonusFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          const groups = json.map((item: any) => ({
            id: crypto.randomUUID(),
            text: item.text || "",
            shipIds: Array.isArray(item.ids) ? item.ids : []
          }));
          setBonusGroups(groups);
          
          const uniqueIds = new Set<number>();
          groups.forEach((g: BonusGroup) => g.shipIds.forEach(id => uniqueIds.add(id)));
          alert(`特効データを読み込みました (${uniqueIds.size}隻分)`);
        }
      } catch (err) {
        console.error(err);
        alert("特効データの読み込みに失敗しました。JSON形式を確認してください。");
      }
      // inputをリセットして同じファイルを再選択できるようにする
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleRenameDeck = () => {
    const currentDeck = decks[currentDeckIndex];
    const newName = window.prompt("新しい艦隊名を入力してください", currentDeck.name);

    if (newName === null || newName === currentDeck.name) return;

    const trimmedName = newName.trim();
    if (!trimmedName) return;

    if (decks.some((d, i) => i !== currentDeckIndex && d.name === trimmedName)) {
      alert("その艦隊名は既に使用されています");
      return;
    }
    setDecks((prevDecks) =>
      prevDecks.map((deck, idx) =>
        idx === currentDeckIndex ? { ...deck, name: trimmedName } : deck
      )
    );
  };

  const handleAddDeck = () => {
    setDecks([...decks, { name: `第${decks.length + 1}艦隊`, ships: Array(6).fill(null) }]);
    setCurrentDeckIndex(decks.length);
  };

  const handleDeleteDeck = () => {
    if (decks.length <= 1) {
      alert("これ以上削除できません");
      return;
    }
    const newDecks = decks.filter((_, i) => i !== currentDeckIndex);
    setDecks(newDecks);
    setCurrentDeckIndex(Math.max(0, currentDeckIndex - 1));
  };

  const handleAddSlot = (deckIndex: number) => {
    setDecks((prevDecks) =>
      prevDecks.map((deck, idx) =>
        idx === deckIndex && deck.ships.length < 7
          ? { ...deck, ships: [...deck.ships, null] }
          : deck
      )
    );
  };

  const handleRemoveSlot = (deckIndex: number) => {
    setDecks((prevDecks) =>
      prevDecks.map((deck, idx) =>
        idx === deckIndex && deck.ships.length > 6
          ? { ...deck, ships: deck.ships.slice(0, 6) }
          : deck
      )
    );
  };

  // ④ フィルター済み艦娘
  const filteredShips = ships.filter((ship) => {
    const stypeId = shipMaster[String(ship.api_ship_id)]?.stype;
    const stypeName = stypeMaster[String(stypeId)];
    return selectedStype === null || stypeName === selectedStype;
  }).sort((a, b) => {
    if (sortMode === "lv") {
      return b.api_lv - a.api_lv || a.api_ship_id - b.api_ship_id; // レベル降順 -> ID昇順
    }
    if (sortMode === "stype") {
      const stypeA = shipMaster[String(a.api_ship_id)]?.stype || 0;
      const stypeB = shipMaster[String(b.api_ship_id)]?.stype || 0;
      return stypeA - stypeB || b.api_lv - a.api_lv; // 艦種ID昇順 -> レベル降順
    }
    // id (図鑑No順)
    return a.api_ship_id - b.api_ship_id;
  });

  // フィルター済みマスター艦娘（特効作成モード用）
  const filteredMasterShips = masterShips.filter((ship) => {
    // 深海棲艦などを除外（ID 1500以下を表示）
    if (ship.api_id > 1500) return false;
    const stypeName = stypeMaster[String(ship.api_stype)];
    return selectedStype === null || stypeName === selectedStype;
  }).sort((a, b) => a.api_sortno && b.api_sortno ? a.api_sortno - b.api_sortno : a.api_id - b.api_id);

  // 所持している艦娘に含まれる艦種IDのリスト（ID順でソートしてから名前でユニーク化）
  const availableStypeIds = Array.from(new Set(ships.map(s => {
    const master = shipMaster[String(s.api_ship_id)];
    return master ? Number(master.stype) : 0;
  }))).filter(id => id !== 0 && !isNaN(id)).sort((a, b) => a - b);
  const availableStypeNames = Array.from(new Set(availableStypeIds.map(id => stypeMaster[String(id)]))).filter(Boolean);

  // マスターデータ用の艦種リスト
  const masterStypeNames = Array.from(new Set(masterShips.map(s => {
    if (s.api_id > 1500) return null;
    return stypeMaster[String(s.api_stype)];
  }))).filter(Boolean).sort();

  // 編成済み艦娘のIDセットを作成
  const usedShipIds = new Set<number>();
  decks.forEach((deck) => {
    deck.ships.forEach((s) => {
      if (s && s.api_id) usedShipIds.add(s.api_id);
    });
  });

  // 表示用の基準となる艦隊インデックス（連合艦隊の随伴艦隊を選択中も、主力艦隊から表示するため）
  let displayDeckIndex = currentDeckIndex;
  if (currentDeckIndex > 0 && decks[currentDeckIndex - 1]?.isCombined) {
    displayDeckIndex = currentDeckIndex - 1;
  }

  return (
    <div style={{ padding: "1rem" }}>
      {/* モード切り替え & ログアウトボタン */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div>
          <button onClick={() => setViewMode("fleet")} disabled={viewMode === "fleet"} style={{ marginRight: "8px" }}>⚓ 艦隊編成</button>
          <button onClick={() => setViewMode("bonus")} disabled={viewMode === "bonus"} style={{ marginRight: "8px" }}>⚡ 特効作成</button>
          <button onClick={() => setViewMode("edit")} disabled={viewMode === "edit"}>📄 艦娘登録</button>
        </div>
        <button
          onClick={onLogout}
          style={{ backgroundColor: "#f88", color: "white" }}
        >
          🚪 ログアウト
        </button>
      </div>

      {/* 表示切り替え */}
      {viewMode === "edit" ? (
        <>
          <textarea
            rows={10}
            cols={60}
            placeholder="ここにデータを貼り付けて保存！（制空シミュと同じやり方）"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ fontFamily: "monospace", width: "100%" }}
          />
          <br />
          <button onClick={handleSave}>保存する</button>
        </>
      ) : viewMode === "bonus" ? (
        <DndContext 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd} 
          sensors={sensors}
          collisionDetection={pointerWithin}
          autoScroll={false}
        >
          <div style={{ display: "flex", gap: "1rem", height: "calc(100vh - 100px)" }}>
            {/* 左カラム：マスター艦娘一覧 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid #ccc", padding: "0.5rem", borderRadius: "4px" }}>
              <h3>マスター艦娘一覧</h3>
              <div style={{ marginBottom: "0.5rem", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                <button onClick={() => setSelectedStype(null)} style={{ fontWeight: selectedStype === null ? "bold" : "normal" }}>すべて</button>
                {masterStypeNames.map(stypeName => (
                  <button
                    key={stypeName}
                    onClick={() => setSelectedStype(stypeName)}
                    style={{
                      fontWeight: selectedStype === stypeName ? "bold" : "normal",
                      backgroundColor: selectedStype === stypeName ? "#007bff" : "#eee",
                      color: selectedStype === stypeName ? "#fff" : "#000",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      padding: "2px 6px"
                    }}
                  >
                    {stypeName}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "4px", alignContent: "flex-start" }}>
                {filteredMasterShips.map((ship) => (
                  <DraggableShip
                    key={`master-${ship.api_id}`}
                    id={`master-${ship.api_id}`}
                    ship={{
                      api_id: -ship.api_id, // ダミーID
                      api_ship_id: ship.api_id,
                      api_lv: 0,
                      api_kyouka: [],
                      api_exp: [],
                      api_slot_ex: 0
                    }}
                    shipMaster={shipMaster}
                    stypeMaster={stypeMaster}
                    detailMode={false}
                  />
                ))}
              </div>
            </div>

            {/* 右カラム：特効グループ編集 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>特効設定</h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <label style={{
                    backgroundColor: "#fff",
                    color: "#333",
                    border: "1px solid #ccc",
                    cursor: "pointer",
                    padding: "2px 6px",
                    fontSize: "0.85rem",
                    borderRadius: "2px"
                  }}>
                    📂 読込
                    <input type="file" accept=".json" onChange={handleImportBonus} style={{ display: 'none' }} />
                  </label>
                  <button onClick={handleDownloadBonus}>💾 DL</button>
                  <button onClick={() => setBonusGroups([...bonusGroups, { id: crypto.randomUUID(), text: "", shipIds: [] }])}>＋ 追加</button>
                  <button onClick={handleSaveBonus}>☁️ 保存</button>
                </div>
              </div>
              
              {bonusGroups.map((group, index) => (
                <div key={group.id} style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input 
                      type="text" 
                      placeholder="特効テキスト (例: E-1ボス x1.5)" 
                      value={group.text}
                      onChange={(e) => {
                        const newGroups = [...bonusGroups];
                        newGroups[index].text = e.target.value;
                        setBonusGroups(newGroups);
                      }}
                      style={{ flex: 1, padding: "4px" }}
                    />
                    <button onClick={() => setBonusGroups(bonusGroups.filter((_, i) => i !== index))} style={{ color: "red" }}>削除</button>
                  </div>
                  <BonusDropArea id={`bonus-group-${group.id}`}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {group.shipIds.length === 0 && <div style={{ color: "#aaa" }}>ここに艦娘をドロップ</div>}
                      {group.shipIds.map(shipId => (
                        <div key={shipId} style={{ border: "1px solid #ccc", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#fff", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "4px" }}>
                          {shipMaster[String(shipId)]?.name || `ID:${shipId}`}
                          <button onClick={() => {
                            const newGroups = [...bonusGroups];
                            newGroups[index].shipIds = group.shipIds.filter(id => id !== shipId);
                            setBonusGroups(newGroups);
                          }} style={{ border: "none", background: "none", cursor: "pointer", color: "#888", padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  </BonusDropArea>
                </div>
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeShip ? (
              <ShipItem 
                ship={activeShip} 
                name={shipMaster[String(activeShip.api_ship_id)]?.name ?? '???'} 
                stypeName={stypeMaster[String(shipMaster[String(activeShip.api_ship_id)]?.stype)]}
                detailMode={false}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <DndContext 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd} 
          sensors={sensors}
          collisionDetection={pointerWithin}
          autoScroll={false}
        >
          {/* 艦隊スロット */}
          <div style={{ marginBottom: "1rem", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}>
            <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select 
                value={currentDeckIndex} 
                onChange={(e) => setCurrentDeckIndex(Number(e.target.value))}
                style={{ fontSize: "1.1rem", padding: "4px" }}
                aria-label="艦隊選択"
              >
                {decks.map((deck, idx) => (
                  <option key={idx} value={idx}>{deck.name}</option>
                ))}
              </select>
              <label style={{ marginLeft: "8px", display: "flex", alignItems: "center", fontSize: "0.9rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!decks[displayDeckIndex].isCombined}
                  onChange={(e) => {
                    const newDecks = [...decks];
                    if (e.target.checked && displayDeckIndex >= newDecks.length - 1) {
                      newDecks.push({ name: `第${newDecks.length + 1}艦隊`, ships: Array(6).fill(null) });
                    }
                    newDecks[displayDeckIndex] = { ...newDecks[displayDeckIndex], isCombined: e.target.checked };
                    setDecks(newDecks);
                  }}
                  style={{ marginRight: "4px" }}
                />
                連合艦隊表示
              </label>
              <button onClick={handleRenameDeck}>✏️ 艦隊名変更</button>
              <button onClick={handleAddDeck}>＋ 追加</button>
              <button onClick={handleDeleteDeck} disabled={decks.length <= 1}>🗑️ 削除</button>
              <button onClick={handleSaveDecks} style={{ marginLeft: "auto" }}>💾 編成を保存</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[displayDeckIndex, (decks[displayDeckIndex].isCombined && decks[displayDeckIndex + 1]) ? displayDeckIndex + 1 : -1].filter(idx => idx !== -1 && decks[idx]).map((deckIdx) => {
                const deck = decks[deckIdx];
                const deckTotalLv = deck.ships.reduce((acc, ship) => acc + (ship?.api_lv || 0), 0);
                
                return (
                  <div key={deckIdx} style={{ border: "1px solid #ddd", padding: "0.5rem", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                    <div style={{ marginBottom: "0.5rem", fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
                      <span>{deck.name}</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: "normal" }}>合計Lv: {deckTotalLv}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
                      {deck.ships.map((ship, idx) => (
                        <FleetSlot
                          key={`${deckIdx}-${idx}`}
                          slotId={`slot-${deckIdx}-${idx}`}
                          index={idx}
                          ship={ship}
                          shipMaster={shipMaster}
                          stypeMaster={stypeMaster}
                          onRemove={() => handleRemoveShip(deckIdx, idx)}
                        />
                      ))}
                      {deck.ships.length < 7 ? (
                        <button
                          onClick={() => handleAddSlot(deckIdx)}
                          style={{
                            minWidth: "40px",
                            cursor: "pointer",
                            border: "2px dashed #ccc",
                            backgroundColor: "#f9f9f9",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.2rem"
                          }}
                          title="7隻目を追加"
                        >
                          +
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRemoveSlot(deckIdx)}
                          style={{
                            minWidth: "40px",
                            cursor: "pointer",
                            border: "2px dashed #ccc",
                            backgroundColor: "#ffecec",
                            color: "red",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.2rem"
                          }}
                          title="7隻目を削除"
                        >
                          -
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 艦種タブエリア */}
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {/* ソートボタン */}
              <div style={{ marginRight: "1rem", display: "flex", gap: "4px" }}>
                {[
                  { key: "lv", label: "Lv順" },
                  { key: "stype", label: "艦種順" },
                  { key: "id", label: "図鑑順" }
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setSortMode(mode.key as any)}
                    style={{
                      fontWeight: sortMode === mode.key ? "bold" : "normal",
                      backgroundColor: sortMode === mode.key ? "#6c757d" : "#f8f9fa",
                      color: sortMode === mode.key ? "#fff" : "#000",
                      border: "1px solid #ccc",
                      cursor: "pointer"
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
                {/* 表示切替ボタン */}
                <button
                  onClick={() => setIsDetailView(!isDetailView)}
                  style={{
                    marginLeft: "8px",
                    backgroundColor: "#fff",
                    color: "#333",
                    border: "1px solid #ccc",
                    cursor: "pointer"
                  }}
                >
                  {isDetailView ? "≡ 簡易" : "≣ 一覧"}
                </button>

                {/* 特効データ読込ボタン */}
                <label style={{
                  marginLeft: "8px",
                  backgroundColor: "#ffc107",
                  color: "#000",
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  padding: "1px 6px",
                  fontSize: "0.85rem",
                  display: "inline-flex",
                  alignItems: "center"
                }}>
                  ⚡ 特効読込
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleBonusFileChange} 
                    style={{ display: 'none' }} 
                  />
                </label>
              </div>

              <button
                onClick={() => setSelectedStype(null)}
                style={{
                  fontWeight: selectedStype === null ? "bold" : "normal",
                  backgroundColor: selectedStype === null ? "#007bff" : "#eee",
                  color: selectedStype === null ? "#fff" : "#000",
                  border: "1px solid #ccc",
                  padding: "4px 8px",
                  cursor: "pointer"
                }}
              >
                すべて
              </button>
              {availableStypeNames.map(stypeName => (
                <button
                  key={stypeName}
                  onClick={() => setSelectedStype(stypeName)}
                  style={{
                    fontWeight: selectedStype === stypeName ? "bold" : "normal",
                    backgroundColor: selectedStype === stypeName ? "#007bff" : "#eee",
                    color: selectedStype === stypeName ? "#fff" : "#000",
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    cursor: "pointer"
                  }}
                >
                  {stypeName}
                </button>
              ))}
            </div>
          </div>

          {/* 艦娘一覧 */}
          <div style={{ 
            display: "flex", 
            flexWrap: isDetailView ? "nowrap" : "wrap", 
            flexDirection: isDetailView ? "column" : "row",
            gap: "0.5rem", 
            maxHeight: "500px", 
            overflowY: "auto",
            border: "1px solid #eee",
            padding: "0.5rem"
          }}>
            {filteredShips.map((ship, index) => (
              <DraggableShip
                key={`${ship.api_id}-${index}`} // ユニークなキー
                id={`ship-${ship.api_id}-${index}`} // ユニークなID
                ship={ship}
                shipMaster={shipMaster}
                stypeMaster={stypeMaster}
                detailMode={isDetailView}
                isUsed={usedShipIds.has(ship.api_id)}
                bonusText={bonusMap[ship.api_ship_id]}
              />
            ))}
          </div>

          {/* ドラッグ中の要素を最前面に描画 */}
          <DragOverlay>
            {activeShip ? (
              <ShipItem 
                ship={activeShip} 
                name={shipMaster[String(activeShip.api_ship_id)]?.name ?? '???'} 
                stypeName={stypeMaster[String(shipMaster[String(activeShip.api_ship_id)]?.stype)]}
                detailMode={isDetailView}
                bonusText={bonusMap[activeShip.api_ship_id]}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
