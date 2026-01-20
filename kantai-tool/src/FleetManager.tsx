import React, { useEffect, useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core";
import { DraggableShip, ShipItem } from "./DraggableShip";
import FleetSlot from "./FleetSlot";
import { RawShip, ShipMasterData, ApiMstShip, ApiMstStype } from "./types";

// --- 新しい型定義 ---
type FleetType = "Normal" | "Combined" | "Third";
type ShipId = number | null;

interface NormalFleet {
  type: "Normal";
  shipIds: ShipId[]; // 6隻
}

interface CombinedFleet {
  type: "Combined";
  mainIds: ShipId[]; // 主力6隻
  escortIds: ShipId[]; // 随伴6隻
}

interface ThirdFleet {
  type: "Third";
  shipIds: ShipId[]; // 7隻
}

type FleetData = NormalFleet | CombinedFleet | ThirdFleet;

interface Deck {
  name: string;
  fleet: FleetData;
}

interface BonusGroup {
  id: string;
  text: string;
  shipIds: number[];
}

const DEFAULT_SHIP_TYPE_CATEGORIES = [
  { name: "駆逐", ids: [1, 2] }, // 海防艦, 駆逐艦
  { name: "巡洋", ids: [3, 4, 5, 6, 21] }, // 軽巡, 雷巡, 重巡, 航巡, 練巡
  { name: "戦艦", ids: [8, 9, 10, 12] }, // 巡洋戦艦, 戦艦, 航戦, 超弩級戦艦
  { name: "空母", ids: [7, 11, 18] }, // 軽空母, 正規空母, 装甲空母
  { name: "潜水", ids: [13, 14] }, // 潜水艦, 潜水空母
  { name: "他", ids: [] }, // その他 (上記以外すべて)
];

interface ShipTypeCategory {
  name: string;
  ids: number[];
  rawIds?: string;
}

const generateUUID = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

function BonusDropArea({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        border: "2px dashed #ccc",
        padding: "1rem",
        backgroundColor: isOver ? "#f0f8ff" : "#fff",
        minHeight: "100px",
        borderRadius: "8px",
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [decks, setDecks] = useState<Deck[]>([
    {
      name: "第1艦隊",
      fleet: { type: "Normal", shipIds: Array(6).fill(null) },
    },
  ]);
  const [allSets, setAllSets] = useState<Record<string, Deck[]>>({});
  const [currentSetName, setCurrentSetName] = useState<string>("");

  const [currentDeckIndex, setCurrentDeckIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"fleet" | "edit" | "bonus" | "list" | "master">(
    "fleet",
  );
  const [activeShip, setActiveShip] = useState<RawShip | null>(null);
  const [sortMode, setSortMode] = useState<"lv" | "stype" | "id">("lv");
  const [isDetailView, setIsDetailView] = useState(false);
  const [bonusMap, setBonusMap] = useState<Record<number, string>>({});
  const [masterShips, setMasterShips] = useState<ApiMstShip[]>([]);
  const [bonusGroups, setBonusGroups] = useState<BonusGroup[]>([]);
  const [stypeConfig, setStypeConfig] = useState<ShipTypeCategory[]>(DEFAULT_SHIP_TYPE_CATEGORIES);
  const [masterDataInput, setMasterDataInput] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // IDから艦娘データを高速に引くためのMap
  const shipMapById = useMemo(() => {
    const map = new Map<number, RawShip>();
    ships.forEach((s) => map.set(s.api_id, s));
    return map;
  }, [ships]);

  // ① マスターデータ読み込み (APIから取得、なければpublicから取得)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        let data: {
          api_mst_ship?: ApiMstShip[];
          api_mst_stype?: ApiMstStype[];
        } = {};

        try {
          const res = await fetch("/api/master", {
            headers: { "x-user-token": token },
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch (e) {
          console.warn("Server master fetch failed", e);
        }

        // サーバーにデータがない場合、publicのjsonをフォールバック
        if (
          !data ||
          !data.api_mst_ship ||
          !Array.isArray(data.api_mst_ship) ||
          data.api_mst_ship.length === 0
        ) {
          console.log("Using default_master_data.json");
          const fallbackRes = await fetch("default_master_data.json");
          if (fallbackRes.ok) {
            data = await fallbackRes.json();
          }
        }

        const ships = data.api_mst_ship || [];
        const stypes = data.api_mst_stype || [];

        const shipMap: Record<string, ShipMasterData> = {};
        ships.forEach((ship) => {
          shipMap[ship.api_id] = {
            name: ship.api_name,
            stype: ship.api_stype,
            sortId: ship.api_sort_id,
          };
        });

        const stypeMap: Record<string, string> = {};
        stypes.forEach((stype) => {
          stypeMap[stype.api_id] = stype.api_name;
        });

        setMasterShips(ships);
        setShipMaster(shipMap);
        setStypeMaster(stypeMap);
      } catch (err) {
        console.error("マスターデータ読み込みエラー:", err);
      }
    };

    fetchMasterData();
  }, [token]);

  // 艦種設定読み込み
  useEffect(() => {
    const fetchStypeConfig = async () => {
      let data: ShipTypeCategory[] = [];
      try {
        const res = await fetch("/api/stype_config", {
          headers: { "x-user-token": token },
        });
        if (res.ok) data = await res.json();
      } catch (e) {
        console.warn("Server stype_config fetch failed", e);
      }

      if (!Array.isArray(data) || data.length === 0) {
        try {
          const res = await fetch("default_stype_config.json");
          if (res.ok) data = await res.json();
        } catch (e) {
          console.warn("Default stype_config fetch failed", e);
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        setStypeConfig(data);
      }
    };
    fetchStypeConfig();
  }, [token]);

  // ② 艦娘データ読み込み (変更なし)
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

  // ③ 艦隊データ読み込み（マイグレーション対応）
  useEffect(() => {
    fetch("/api/decks", {
      headers: { "x-user-token": token },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        let setsData: Record<string, Deck[]> = {};
        let initialSetName = "Default";

        if (Array.isArray(data)) {
          // 旧形式 (Deck[]) の場合
          if (data.length > 0) {
            const fixedData: Deck[] = data.map((d: any) => {
              if (d.fleet && d.fleet.type) return d;
              let ids: ShipId[] = [];
              if (d.ships) ids = d.ships.map((s: any) => (s ? s.api_id : null));
              else if (d.shipIds) ids = d.shipIds;
              else ids = Array(6).fill(null);
              while (ids.length < 6) ids.push(null);
              return {
                name: d.name,
                fleet: { type: "Normal", shipIds: ids.slice(0, 6) },
              };
            });
            setsData = { [initialSetName]: fixedData };
          }
        } else if (
          typeof data === "object" &&
          data !== null &&
          Object.keys(data).length > 0
        ) {
          // 新形式の場合
          setsData = data;
          initialSetName = Object.keys(data)[0];
        }

        // データが全くない場合
        if (Object.keys(setsData).length === 0) {
          const defaultDecks = [
            {
              name: "第1艦隊",
              fleet: {
                type: "Normal",
                shipIds: Array(6).fill(null),
              } as FleetData,
            },
          ];
          setsData = { Default: defaultDecks };
          initialSetName = "Default";
        }

        setAllSets(setsData);
        setCurrentSetName(initialSetName);
        setDecks(setsData[initialSetName]);
        setCurrentDeckIndex(0);
      })
      .catch((err) => console.error("艦隊データ読み込みエラー:", err));
  }, [token]);

  // ... (bonusGroups useEffect, handleSave, handleSaveBonus, handleDownloadBonus, handleImportBonus, handleBonusFileChange は変更なし) ...
  // bonusGroups の変更を検知して bonusMap (表示用) を更新
  useEffect(() => {
    const newMap: Record<number, string> = {};
    bonusGroups.forEach((group) => {
      group.shipIds.forEach((id) => {
        const shipId = Number(id);
        if (!isNaN(shipId)) {
          newMap[shipId] = newMap[shipId]
            ? `${newMap[shipId]}\n${group.text}`
            : group.text;
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
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          const groups = data.map((item: any, index: number) => ({
            id: String(index),
            text: item.text,
            shipIds: item.ids || [],
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

  const handleSave = () => {
    try {
      let jsonStr = inputText.trim();
      if (jsonStr.startsWith("svdata=")) {
        jsonStr = jsonStr.replace(/^svdata=/, "");
      }
      const parsed = JSON.parse(jsonStr);
      let rawShips: RawShip[] = [];
      if (Array.isArray(parsed)) {
        rawShips = parsed;
      } else if (parsed.api_data && Array.isArray(parsed.api_data.api_ship)) {
        rawShips = parsed.api_data.api_ship;
      } else {
        throw new Error("艦娘データが見つかりませんでした");
      }
      const isIdMissing = rawShips.length > 0 && !rawShips[0].api_id;
      if (isIdMissing) {
        if (
          !window.confirm(
            "IDが含まれていないデータ形式です。\nIDが再生成されるため、現在の編成データはリセットされますがよろしいですか？",
          )
        ) {
          return;
        }
        setDecks([
          {
            name: "第1艦隊",
            fleet: { type: "Normal", shipIds: Array(6).fill(null) },
          },
        ]);
        setCurrentDeckIndex(0);
      }
      const normalizedShips = rawShips.map((ship, index) => ({
        ...ship,
        api_id: ship.api_id || index + 100000,
      }));
      fetch("/api/ships", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-token": token },
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

  const handleSaveMaster = () => {
    if (!masterDataInput.trim()) return;
    // JSON形式かどうかの簡易チェックはサーバー側でも行うが、ここでも軽く
    try {
      // 送信
      fetch("/api/master", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-token": token },
        body: JSON.stringify({ data: masterDataInput }),
      })
        .then(async (res) => {
          const msg = await res.text();
          if (!res.ok) throw new Error(msg);
          alert(msg);
          // リロードして反映
          window.location.reload();
        })
        .catch((e) => alert(`保存エラー: ${e.message}`));
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    }
  };

  const handleSaveStypeConfig = () => {
    fetch("/api/stype_config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-token": token },
      body: JSON.stringify(stypeConfig),
    })
      .then((res) =>
        res.ok ? alert("艦種設定を保存しました！") : alert("保存に失敗しました"),
      )
      .catch((e) => alert(`通信エラー: ${e.message}`));
  };

  const handleDownloadMaster = async () => {
    try {
      const res = await fetch("/api/master", {
        headers: { "x-user-token": token },
      });
      if (!res.ok) throw new Error("Download failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "master_data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`ダウンロードエラー: ${e.message}`);
    }
  };

  const handleImportMaster = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const str = event.target?.result as string;
      setMasterDataInput(str);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDownloadStypeConfig = () => {
    const blob = new Blob([JSON.stringify(stypeConfig, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stype_config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportStypeConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setStypeConfig(json);
        } else {
          alert("Invalid format");
        }
      } catch (err) {
        console.error(err);
        alert("読み込みに失敗しました");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const saveAllSetsToServer = (
    setsToSave: Record<string, Deck[]>,
    alertMessage: string,
  ) => {
    fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-token": token },
      body: JSON.stringify(setsToSave),
    })
      .then((res) =>
        res.ok ? alert(alertMessage) : alert("保存に失敗しました"),
      )
      .catch((e) => alert(`通信エラー: ${e.message}`));
  };

  const handleSaveBonus = () => {
    const payload = bonusGroups
      .map((g) => ({ ids: g.shipIds, text: g.text }))
      .filter((g) => g.text || g.ids.length > 0);
    fetch("/api/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-token": token },
      body: JSON.stringify(payload),
    })
      .then((res) =>
        res.ok
          ? alert("特効データを保存しました！")
          : alert("保存に失敗しました"),
      )
      .catch((e) => alert(`通信エラー: ${e.message}`));
  };

  const handleDownloadBonus = () => {
    const payload = bonusGroups
      .map((g) => ({ ids: g.shipIds, text: g.text }))
      .filter((g) => g.text || g.ids.length > 0);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bonus_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBonus = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          const groups = json.map((item: any) => ({
            id: generateUUID(),
            text: item.text || "",
            shipIds: Array.isArray(item.ids) ? item.ids : [],
          }));
          setBonusGroups(
            groups.length > 0
              ? groups
              : [{ id: generateUUID(), text: "", shipIds: [] }],
          );
        }
      } catch (err) {
        console.error(err);
        alert("読み込みに失敗しました");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleBonusFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          const groups = json.map((item: any) => ({
            id: generateUUID(),
            text: item.text || "",
            shipIds: Array.isArray(item.ids) ? item.ids : [],
          }));
          setBonusGroups(groups);
          const uniqueIds = new Set<number>();
          groups.forEach((g: BonusGroup) =>
            g.shipIds.forEach((id) => uniqueIds.add(id)),
          );
          alert(`特効データを読み込みました (${uniqueIds.size}隻分)`);
        }
      } catch (err) {
        console.error(err);
        alert(
          "特効データの読み込みに失敗しました。JSON形式を確認してください。",
        );
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveShip(event.active.data.current?.ship || null);
  };

  // ドラッグ終了処理（大幅更新）
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveShip(null);
    if (!over) return;

    // 特効モードのドロップ処理
    if (viewMode === "bonus" && String(active.id).startsWith("master-")) {
      const shipId = parseInt(String(active.id).replace("master-", ""), 10);
      const groupId = String(over.id).replace("bonus-group-", "");
      setBonusGroups((prev) =>
        prev.map((g) => {
          if (g.id === groupId && !g.shipIds.includes(shipId)) {
            return { ...g, shipIds: [...g.shipIds, shipId] };
          }
          return g;
        }),
      );
      return;
    }

    const ship = active.data.current?.ship as RawShip | undefined;
    const overId = String(over.id);
    if (!overId.startsWith("slot-")) return;

    // slot-{deckIndex}-{section}-{slotIndex}
    // section: 0=Main/Normal/Third, 1=Escort
    const parts = overId.replace("slot-", "").split("-");
    if (parts.length !== 3) return;

    const targetDeckIndex = parseInt(parts[0], 10);
    const section = parseInt(parts[1], 10);
    const targetSlotIndex = parseInt(parts[2], 10);

    if (!ship) return;

    // 1. 移動判定: ドロップ先の艦隊に既に含まれているかチェック
    let sourceInfo: {
      deckIndex: number;
      section: number;
      slotIndex: number;
      deckName: string;
    } | null = null;
    let isMove = false;

    // ヘルパー関数: 指定したデッキ内で艦娘を検索
    const findShipInDeck = (d: Deck, dIdx: number) => {
      if (d.fleet.type === "Combined") {
        const mainIdx = d.fleet.mainIds.indexOf(ship.api_id);
        if (mainIdx >= 0)
          return {
            deckIndex: dIdx,
            section: 0,
            slotIndex: mainIdx,
            deckName: d.name,
          };
        const escortIdx = d.fleet.escortIds.indexOf(ship.api_id);
        if (escortIdx >= 0)
          return {
            deckIndex: dIdx,
            section: 1,
            slotIndex: escortIdx,
            deckName: d.name,
          };
      } else {
        const idx = d.fleet.shipIds.indexOf(ship.api_id);
        if (idx >= 0)
          return {
            deckIndex: dIdx,
            section: 0,
            slotIndex: idx,
            deckName: d.name,
          };
      }
      return null;
    };

    // まず、ドロップ先のデッキ内を検索 (同一デッキ内移動の判定)
    sourceInfo = findShipInDeck(decks[targetDeckIndex], targetDeckIndex);

    if (sourceInfo) {
      isMove = true;
    } else {
      // ターゲットデッキにいない場合、他のデッキを検索 (重複判定)
      for (let dIdx = 0; dIdx < decks.length; dIdx++) {
        if (dIdx === targetDeckIndex) continue;
        const info = findShipInDeck(decks[dIdx], dIdx);
        if (info) {
          sourceInfo = info;
          break;
        }
      }
    }

    if (sourceInfo) {
      // 全く同じ場所へのドロップなら何もしない
      if (
        sourceInfo.deckIndex === targetDeckIndex &&
        sourceInfo.section === section &&
        sourceInfo.slotIndex === targetSlotIndex
      ) {
        return;
      }

      if (!isMove) {
        // 別デッキからの重複編成確認
        const shipName = shipMaster[String(ship.api_ship_id)]?.name || "艦娘";
        if (
          !window.confirm(
            `${shipName}は既に${sourceInfo.deckName}に編成済みです。\n重複して編成しますか？`,
          )
        ) {
          return;
        }
      }
    }

    setDecks((prevDecks) => {
      const newDecks = [...prevDecks];
      const targetDeck = newDecks[targetDeckIndex];
      if (!targetDeck) return prevDecks;

      // 艦隊データをコピーして更新
      const newFleet = { ...targetDeck.fleet };

      // 配列もコピー
      if (newFleet.type === "Combined") {
        newFleet.mainIds = [...newFleet.mainIds];
        newFleet.escortIds = [...newFleet.escortIds];
      } else {
        newFleet.shipIds = [...newFleet.shipIds];
      }

      // 移動の場合は元の場所から削除 (同一デッキ内移動)
      if (isMove && sourceInfo) {
        if (newFleet.type === "Combined") {
          if (sourceInfo.section === 0)
            newFleet.mainIds[sourceInfo.slotIndex] = null;
          else newFleet.escortIds[sourceInfo.slotIndex] = null;
        } else {
          newFleet.shipIds[sourceInfo.slotIndex] = null;
        }
      }

      if (newFleet.type === "Normal") {
        if (section !== 0) return prevDecks;
        newFleet.shipIds[targetSlotIndex] = ship.api_id;
      } else if (newFleet.type === "Third") {
        if (section !== 0) return prevDecks;
        newFleet.shipIds[targetSlotIndex] = ship.api_id;
      } else if (newFleet.type === "Combined") {
        if (section === 0) {
          newFleet.mainIds[targetSlotIndex] = ship.api_id;
        } else {
          newFleet.escortIds[targetSlotIndex] = ship.api_id;
        }
      }

      newDecks[targetDeckIndex] = {
        ...targetDeck,
        fleet: newFleet as FleetData,
      };
      return newDecks;
    });
  };

  // 削除処理（更新）
  const handleRemoveShip = (
    deckIndex: number,
    section: number,
    slotIndex: number,
  ) => {
    setDecks((prevDecks) => {
      const newDecks = [...prevDecks];
      const targetDeck = newDecks[deckIndex];
      if (!targetDeck) return prevDecks;

      const newFleet = { ...targetDeck.fleet };

      if (newFleet.type === "Normal" && section === 0) {
        newFleet.shipIds = newFleet.shipIds.map((id, i) =>
          i === slotIndex ? null : id,
        );
      } else if (newFleet.type === "Third" && section === 0) {
        newFleet.shipIds = newFleet.shipIds.map((id, i) =>
          i === slotIndex ? null : id,
        );
      } else if (newFleet.type === "Combined") {
        if (section === 0) {
          newFleet.mainIds = newFleet.mainIds.map((id, i) =>
            i === slotIndex ? null : id,
          );
        } else {
          newFleet.escortIds = newFleet.escortIds.map((id, i) =>
            i === slotIndex ? null : id,
          );
        }
      }

      newDecks[deckIndex] = { ...targetDeck, fleet: newFleet as FleetData };
      return newDecks;
    });
  };

  const handleRenameDeck = (index: number) => {
    const deck = decks[index];
    const newName = window.prompt("新しい艦隊名を入力してください", deck.name);
    if (newName === null || newName === deck.name) return;
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    if (decks.some((d, i) => i !== index && d.name === trimmedName)) {
      alert("その艦隊名は既に使用されています");
      return;
    }
    setDecks((prevDecks) =>
      prevDecks.map((d, idx) =>
        idx === index ? { ...d, name: trimmedName } : d,
      ),
    );
  };

  const handleAddDeck = () => {
    setDecks([
      ...decks,
      {
        name: `第${decks.length + 1}艦隊`,
        fleet: { type: "Normal", shipIds: Array(6).fill(null) },
      },
    ]);
    setCurrentDeckIndex(decks.length);
  };

  const handleDeleteDeck = (index: number) => {
    if (decks.length <= 1) {
      alert("これ以上削除できません");
      return;
    }
    if (!window.confirm(`「${decks[index].name}」を削除しますか？`)) return;

    const newDecks = decks.filter((_, i) => i !== index);
    setDecks(newDecks);

    if (index <= currentDeckIndex) {
      setCurrentDeckIndex(Math.max(0, currentDeckIndex - 1));
    }
  };

  const handleSaveCurrentSet = () => {
    const newAllSets = { ...allSets, [currentSetName]: decks };
    setAllSets(newAllSets);
    saveAllSetsToServer(
      newAllSets,
      `編成セット「${currentSetName}」を上書き保存しました！`,
    );
  };

  const handleSelectSet = (setName: string) => {
    if (JSON.stringify(decks) !== JSON.stringify(allSets[currentSetName])) {
      if (
        !window.confirm(
          "現在の変更は保存されていません。セットを切り替えますか？ (変更は破棄されます)",
        )
      ) {
        const selectElement = document.getElementById(
          "fleet-set-selector",
        ) as HTMLSelectElement;
        if (selectElement) {
          selectElement.value = currentSetName;
        }
        return;
      }
    }
    setCurrentSetName(setName);
    setDecks(allSets[setName]);
    setCurrentDeckIndex(0);
  };

  const handleSaveAsNewSet = () => {
    const newName = window.prompt("新しい編成セット名を入力してください");
    if (!newName || newName.trim() === "") {
      return;
    }
    if (allSets[newName]) {
      if (!window.confirm("その名前は既に使用されています。上書きしますか？")) {
        return;
      }
    }
    const newAllSets = {
      ...allSets,
      [currentSetName]: decks,
      [newName]: decks,
    };
    setAllSets(newAllSets);
    setCurrentSetName(newName);
    saveAllSetsToServer(newAllSets, `「${newName}」として保存しました！`);
  };

  const handleDeleteSet = () => {
    if (Object.keys(allSets).length <= 1) {
      alert("これ以上削除できません。");
      return;
    }
    if (!window.confirm(`編成セット「${currentSetName}」を削除しますか？`)) {
      return;
    }
    const deletedSetName = currentSetName;
    const newSets = { ...allSets };
    delete newSets[deletedSetName];
    setAllSets(newSets);
    saveAllSetsToServer(newSets, `「${deletedSetName}」を削除しました。`);
    handleSelectSet(Object.keys(newSets)[0]);
  };

  // 艦隊タイプ変更処理
  const handleChangeFleetType = (deckIndex: number, newType: FleetType) => {
    const deck = decks[deckIndex];
    const currentFleet = deck.fleet;

    // 現在の艦娘IDリストを作成（チェック用）
    const currentIdsCheck =
      currentFleet.type === "Combined"
        ? [...currentFleet.mainIds, ...currentFleet.escortIds]
        : [...currentFleet.shipIds];

    // 新しいタイプで保持できる数
    let keepCount = 6;
    if (newType === "Third") keepCount = 7;
    else if (newType === "Combined") keepCount = 12;

    // 削除される部分に艦娘がいるかチェック
    const shipsToRemove = currentIdsCheck
      .slice(keepCount)
      .filter((id) => id !== null);

    if (shipsToRemove.length > 0) {
      if (
        !window.confirm(
          "編成枠が減るため、一部の艦娘が編成から外れます。\nよろしいですか？",
        )
      ) {
        return;
      }
    }

    setDecks((prevDecks) => {
      const newDecks = [...prevDecks];
      const deck = newDecks[deckIndex];

      // 既存の艦娘を維持しつつ構造変換
      let newFleet: FleetData;
      const currentIds =
        deck.fleet.type === "Combined"
          ? [...deck.fleet.mainIds, ...deck.fleet.escortIds]
          : [...deck.fleet.shipIds];

      if (newType === "Normal") {
        newFleet = { type: "Normal", shipIds: currentIds.slice(0, 6) };
        while (newFleet.shipIds.length < 6) newFleet.shipIds.push(null);
      } else if (newType === "Third") {
        newFleet = { type: "Third", shipIds: currentIds.slice(0, 7) };
        while (newFleet.shipIds.length < 7) newFleet.shipIds.push(null);
      } else {
        // Combined
        const mainIds = currentIds.slice(0, 6);
        while (mainIds.length < 6) mainIds.push(null);
        const escortIds = currentIds.slice(6, 12);
        while (escortIds.length < 6) escortIds.push(null);
        newFleet = { type: "Combined", mainIds, escortIds };
      }

      newDecks[deckIndex] = { ...deck, fleet: newFleet };
      return newDecks;
    });
  };

  // カテゴリによるフィルタリング関数
  const filterByCategory = (stypeId: number | undefined) => {
    if (selectedCategory === null) return true;
    if (stypeId === undefined) return false;

    const category = stypeConfig.find((c) => c.name === selectedCategory);
    if (!category) return true;

    if (category.name === "他") {
      const otherIds = new Set(stypeConfig.filter((c) => c.name !== "他").flatMap((c) => c.ids));
      return !otherIds.has(stypeId);
    }
    return category.ids.includes(stypeId);
  };

  const filteredShips = ships
    .filter((ship) => {
      const stypeId = shipMaster[String(ship.api_ship_id)]?.stype;
      return filterByCategory(stypeId);
    })
    .sort((a, b) => {
      if (sortMode === "lv") {
        return b.api_lv - a.api_lv || a.api_ship_id - b.api_ship_id;
      }
      if (sortMode === "stype") {
        const stypeA = shipMaster[String(a.api_ship_id)]?.stype || 0;
        const stypeB = shipMaster[String(b.api_ship_id)]?.stype || 0;
        return stypeA - stypeB || b.api_lv - a.api_lv;
      }
      const sortA = shipMaster[String(a.api_ship_id)]?.sortId || a.api_ship_id;
      const sortB = shipMaster[String(b.api_ship_id)]?.sortId || b.api_ship_id;
      return sortA - sortB;
    });

  const filteredMasterShips = masterShips
    .filter((ship) => {
      if (ship.api_id > 1500) return false;
      return filterByCategory(ship.api_stype);
    })
    .sort((a, b) => {
      const sortA = a.api_sort_id || a.api_id;
      const sortB = b.api_sort_id || b.api_id;
      return sortA - sortB;
    });

  // 使用済み艦娘IDセットの作成（更新）
  const usedShipIds = new Set<number>();
  decks.forEach((deck) => {
    if (deck.fleet.type === "Combined") {
      deck.fleet.mainIds.forEach((id) => id && usedShipIds.add(id));
      deck.fleet.escortIds.forEach((id) => id && usedShipIds.add(id));
    } else {
      deck.fleet.shipIds.forEach((id) => id && usedShipIds.add(id));
    }
  });

  return (
    <div style={{ padding: "1rem" }}>
      {/* ... (モード切り替えボタンなどは変更なし) ... */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div>
          <button
            onClick={() => setViewMode("fleet")}
            disabled={viewMode === "fleet"}
            style={{ marginRight: "8px" }}
          >
            ⚓ 艦隊編成
          </button>
          <button
            onClick={() => setViewMode("list")}
            disabled={viewMode === "list"}
            style={{ marginRight: "8px" }}
          >
            📋 編成一覧
          </button>
          <button
            onClick={() => setViewMode("bonus")}
            disabled={viewMode === "bonus"}
            style={{ marginRight: "8px" }}
          >
            ⚡ 特効作成
          </button>
          <button
            onClick={() => setViewMode("master")}
            disabled={viewMode === "master"}
            style={{ marginRight: "8px" }}
          >
            ⚙️ マスタ設定
          </button>
          <button
            onClick={() => setViewMode("edit")}
            disabled={viewMode === "edit"}
          >
            📄 艦娘登録
          </button>
        </div>
        <button
          onClick={onLogout}
          style={{ backgroundColor: "#f88", color: "white" }}
        >
          🚪 ログアウト
        </button>
      </div>

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
      ) : viewMode === "master" ? (
        <div style={{ display: "flex", gap: "2rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h3>ゲームデータ(api_start2)登録</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <label style={{ cursor: "pointer", border: "1px solid #ccc", padding: "2px 6px", borderRadius: "2px", background: "#fff", fontSize: "0.85rem" }}>
                  📂 読込
                  <input type="file" accept=".json,.txt" onChange={handleImportMaster} style={{ display: "none" }} />
                </label>
                <button onClick={handleDownloadMaster}>💾 DL</button>
              </div>
            </div>
            <p style={{ fontSize: "0.9rem", color: "#666" }}>
              ゲームの通信データ(api_start2)のレスポンスボディを貼り付けてください。<br/>
              艦娘データ(api_mst_ship)と艦種データ(api_mst_stype)を抽出して保存します。
            </p>
            <textarea
              rows={10}
              style={{ width: "100%", fontFamily: "monospace" }}
              placeholder='{"api_result":1, "api_data": { ... }}'
              value={masterDataInput}
              onChange={(e) => setMasterDataInput(e.target.value)}
            />
            <button onClick={handleSaveMaster} style={{ marginTop: "0.5rem" }}>
              マスタデータを更新
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>艦種カテゴリー設定</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <label style={{ cursor: "pointer", border: "1px solid #ccc", padding: "2px 6px", borderRadius: "2px", background: "#fff", fontSize: "0.85rem" }}>
                  📂 読込
                  <input type="file" accept=".json" onChange={handleImportStypeConfig} style={{ display: "none" }} />
                </label>
                <button onClick={handleDownloadStypeConfig}>💾 DL</button>
                <button onClick={handleSaveStypeConfig}>設定を保存</button>
              </div>
            </div>
            <div style={{ maxHeight: "70vh", overflowY: "auto", border: "1px solid #ccc", padding: "0.5rem" }}>
              {stypeConfig.map((cat, idx) => (
                <div key={idx} style={{ marginBottom: "1rem", padding: "0.5rem", border: "1px solid #eee", background: "#f9f9f9" }}>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => {
                        const newConfig = [...stypeConfig];
                        newConfig[idx].name = e.target.value;
                        setStypeConfig(newConfig);
                      }}
                      placeholder="カテゴリ名"
                      style={{ width: "100px" }}
                    />
                    <button onClick={() => {
                      if (idx > 0) {
                        const newConfig = [...stypeConfig];
                        [newConfig[idx - 1], newConfig[idx]] = [newConfig[idx], newConfig[idx - 1]];
                        setStypeConfig(newConfig);
                      }
                    }}>↑</button>
                    <button onClick={() => {
                      if (idx < stypeConfig.length - 1) {
                        const newConfig = [...stypeConfig];
                        [newConfig[idx + 1], newConfig[idx]] = [newConfig[idx], newConfig[idx + 1]];
                        setStypeConfig(newConfig);
                      }
                    }}>↓</button>
                    <button onClick={() => {
                      if (window.confirm("削除しますか？")) {
                        setStypeConfig(stypeConfig.filter((_, i) => i !== idx));
                      }
                    }} style={{ color: "red" }}>削除</button>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.8rem" }}>艦種ID (カンマ区切り):</span>
                    <input
                      type="text"
                      value={cat.rawIds ?? cat.ids.join(",")}
                      onChange={(e) => {
                        const val = e.target.value;
                        const ids = val.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                        const newConfig = [...stypeConfig];
                        newConfig[idx] = { ...newConfig[idx], ids, rawIds: val };
                        setStypeConfig(newConfig);
                      }}
                      style={{ width: "100%" }}
                      aria-label="艦種ID入力"
                    />
                    <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>
                      {cat.ids.map(id => stypeMaster[String(id)]).filter(Boolean).join(", ")}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setStypeConfig([...stypeConfig, { name: "新規", ids: [] }])}>＋ カテゴリ追加</button>
            </div>
          </div>
        </div>
      ) : viewMode === "bonus" ? (
        // ... (特効作成画面は変更なし) ...
        <DndContext
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          collisionDetection={pointerWithin}
          autoScroll={false}
        >
          <div
            style={{
              display: "flex",
              gap: "1rem",
              height: "calc(100vh - 100px)",
            }}
          >
            {/* 左カラム：マスター艦娘一覧 */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #ccc",
                padding: "0.5rem",
                borderRadius: "4px",
              }}
            >
              <h3>マスター艦娘一覧</h3>
              <div
                style={{
                  marginBottom: "0.5rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px",
                }}
              >
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    fontWeight: selectedCategory === null ? "bold" : "normal",
                  }}
                >
                  すべて
                </button>
                {stypeConfig.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      fontWeight:
                        selectedCategory === cat.name ? "bold" : "normal",
                      backgroundColor:
                        selectedCategory === cat.name ? "#007bff" : "#eee",
                      color: selectedCategory === cat.name ? "#fff" : "#000",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      padding: "2px 6px",
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px",
                  alignContent: "flex-start",
                }}
              >
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
                      api_slot_ex: 0,
                    }}
                    shipMaster={shipMaster}
                    stypeMaster={stypeMaster}
                    detailMode={false}
                    bonusText={`No.${ship.api_sort_id}`}
                  />
                ))}
              </div>
            </div>

            {/* 右カラム：特効グループ編集 */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>特効設定</h3>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <label
                    style={{
                      backgroundColor: "#fff",
                      color: "#333",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                      padding: "2px 6px",
                      fontSize: "0.85rem",
                      borderRadius: "2px",
                    }}
                  >
                    📂 読込
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBonus}
                      style={{ display: "none" }}
                    />
                  </label>
                  <button onClick={handleDownloadBonus}>💾 DL</button>
                  <button
                    onClick={() =>
                      setBonusGroups([
                        ...bonusGroups,
                        { id: generateUUID(), text: "", shipIds: [] },
                      ])
                    }
                  >
                    ＋ 追加
                  </button>
                  <button onClick={handleSaveBonus}>☁️ 保存</button>
                </div>
              </div>

              {bonusGroups.map((group, index) => (
                <div
                  key={group.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: "1rem",
                    borderRadius: "8px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
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
                    <button
                      onClick={() => {
                        if (
                          window.confirm("この特効グループを削除しますか？")
                        ) {
                          setBonusGroups(
                            bonusGroups.filter((_, i) => i !== index),
                          );
                        }
                      }}
                      style={{ color: "red" }}
                    >
                      削除
                    </button>
                  </div>
                  <BonusDropArea id={`bonus-group-${group.id}`}>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}
                    >
                      {group.shipIds.length === 0 && (
                        <div style={{ color: "#aaa" }}>
                          ここに艦娘をドロップ
                        </div>
                      )}
                      {group.shipIds.map((shipId) => (
                        <div
                          key={shipId}
                          style={{
                            border: "1px solid #ccc",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "#fff",
                            fontSize: "0.9rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {shipMaster[String(shipId)]?.name || `ID:${shipId}`}
                          <button
                            onClick={() => {
                              const newGroups = [...bonusGroups];
                              newGroups[index].shipIds = group.shipIds.filter(
                                (id) => id !== shipId,
                              );
                              setBonusGroups(newGroups);
                            }}
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              color: "#888",
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
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
                name={shipMaster[String(activeShip.api_ship_id)]?.name ?? "???"}
                stypeName={
                  stypeMaster[
                    String(shipMaster[String(activeShip.api_ship_id)]?.stype)
                  ]
                }
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
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.5rem",
                border: "1px solid #999",
                borderRadius: "4px",
                backgroundColor: "#eef",
              }}
            >
              <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                編成セット
              </h4>
              <select
                id="fleet-set-selector"
                value={currentSetName}
                onChange={(e) => handleSelectSet(e.target.value)}
                aria-label="艦隊セット選択"
              >
                {Object.keys(allSets).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveCurrentSet}
                style={{ marginLeft: "8px" }}
              >
                上書き保存
              </button>
              <button
                onClick={handleSaveAsNewSet}
                style={{ marginLeft: "8px" }}
              >
                名前を付けて保存
              </button>
              <button
                onClick={handleDeleteSet}
                disabled={Object.keys(allSets).length <= 1}
                style={{ marginLeft: "8px" }}
              >
                このセットを削除
              </button>
            </div>

            <div
              style={{
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              {viewMode === "fleet" && (
                <div
                  style={{
                    marginBottom: "0.5rem",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={currentDeckIndex}
                    onChange={(e) =>
                      setCurrentDeckIndex(Number(e.target.value))
                    }
                    style={{ fontSize: "1.1rem", padding: "4px" }}
                    aria-label="艦隊選択"
                  >
                    {decks?.map((deck, idx) => (
                      <option key={idx} value={idx}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleAddDeck}>＋ 追加</button>
                </div>
              )}
              {viewMode === "list" && (
                <div
                  style={{
                    marginBottom: "0.5rem",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <button onClick={handleAddDeck}>＋ 艦隊追加</button>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {(viewMode === "list"
                  ? decks.map((d, i) => ({ d, i }))
                  : [{ d: decks[currentDeckIndex], i: currentDeckIndex }]
                ).map(({ d: deck, i: deckIndex }) => {
                  if (!deck) return null;
                  const fleet = deck.fleet;

                  // 合計レベル計算ヘルパー
                  const calcTotalLv = (ids: ShipId[]) =>
                    ids.reduce((acc: number, id) => {
                      const ship = id ? shipMapById.get(id) : null;
                      return acc + (ship?.api_lv || 0);
                    }, 0);

                  return (
                    <div
                      key={deckIndex}
                      style={{
                        border: "1px solid #ddd",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <div
                        style={{
                          marginBottom: "0.5rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          borderBottom: "1px solid #eee",
                          paddingBottom: "4px",
                        }}
                      >
                        <span
                          style={{ fontWeight: "bold", fontSize: "1.1rem" }}
                        >
                          {deck.name}
                        </span>
                        <button onClick={() => handleRenameDeck(deckIndex)}>
                          名前変更
                        </button>
                        <select
                          value={fleet.type}
                          onChange={(e) =>
                            handleChangeFleetType(
                              deckIndex,
                              e.target.value as FleetType,
                            )
                          }
                          style={{ padding: "2px" }}
                          aria-label="艦隊タイプ選択"
                        >
                          <option value="Normal">通常艦隊 (6隻)</option>
                          <option value="Combined">連合艦隊 (12隻)</option>
                          <option value="Third">遊撃部隊 (7隻)</option>
                        </select>
                        <button
                          onClick={() => handleDeleteDeck(deckIndex)}
                          disabled={decks.length <= 1}
                        >
                          削除
                        </button>
                      </div>

                      {/* 通常艦隊 or 遊撃部隊 */}
                      {(fleet.type === "Normal" || fleet.type === "Third") && (
                        <>
                          <div
                            style={{
                              marginBottom: "0.5rem",
                              fontSize: "0.9rem",
                              textAlign: "right",
                            }}
                          >
                            合計Lv: {calcTotalLv(fleet.shipIds)}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              overflowX: "auto",
                              paddingBottom: "0.5rem",
                            }}
                          >
                            {fleet.shipIds.map((shipId, idx) => (
                              <FleetSlot
                                key={`main-${deckIndex}-${idx}`}
                                slotId={`slot-${deckIndex}-0-${idx}`} // section 0
                                index={idx}
                                ship={
                                  shipId
                                    ? shipMapById.get(shipId) || null
                                    : null
                                }
                                shipMaster={shipMaster}
                                stypeMaster={stypeMaster}
                                onRemove={() =>
                                  handleRemoveShip(deckIndex, 0, idx)
                                }
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {/* 連合艦隊 */}
                      {fleet.type === "Combined" && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                          }}
                        >
                          {/* 主力艦隊 */}
                          <div>
                            <div
                              style={{
                                marginBottom: "0.5rem",
                                fontWeight: "bold",
                                display: "flex",
                                justifyContent: "space-between",
                                color: "#d32f2f",
                              }}
                            >
                              <span>{deck.name} (主力艦隊)</span>
                              <span
                                style={{
                                  fontSize: "0.9rem",
                                  fontWeight: "normal",
                                }}
                              >
                                合計Lv: {calcTotalLv(fleet.mainIds)}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                overflowX: "auto",
                                paddingBottom: "0.5rem",
                                borderBottom: "1px dashed #ccc",
                              }}
                            >
                              {fleet.mainIds.map((shipId, idx) => (
                                <FleetSlot
                                  key={`main-${deckIndex}-${idx}`}
                                  slotId={`slot-${deckIndex}-0-${idx}`} // section 0
                                  index={idx}
                                  ship={
                                    shipId
                                      ? shipMapById.get(shipId) || null
                                      : null
                                  }
                                  shipMaster={shipMaster}
                                  stypeMaster={stypeMaster}
                                  onRemove={() =>
                                    handleRemoveShip(deckIndex, 0, idx)
                                  }
                                />
                              ))}
                            </div>
                          </div>
                          {/* 随伴艦隊 */}
                          <div>
                            <div
                              style={{
                                marginBottom: "0.5rem",
                                fontWeight: "bold",
                                display: "flex",
                                justifyContent: "space-between",
                                color: "#1976d2",
                              }}
                            >
                              <span>{deck.name} (随伴艦隊)</span>
                              <span
                                style={{
                                  fontSize: "0.9rem",
                                  fontWeight: "normal",
                                }}
                              >
                                合計Lv: {calcTotalLv(fleet.escortIds)}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                overflowX: "auto",
                                paddingBottom: "0.5rem",
                              }}
                            >
                              {fleet.escortIds.map((shipId, idx) => (
                                <FleetSlot
                                  key={`escort-${deckIndex}-${idx}`}
                                  slotId={`slot-${deckIndex}-1-${idx}`} // section 1
                                  index={idx}
                                  ship={
                                    shipId
                                      ? shipMapById.get(shipId) || null
                                      : null
                                  }
                                  shipMaster={shipMaster}
                                  stypeMaster={stypeMaster}
                                  onRemove={() =>
                                    handleRemoveShip(deckIndex, 1, idx)
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 艦種タブエリア (変更なし) */}
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              <div style={{ marginRight: "1rem", display: "flex", gap: "4px" }}>
                {[
                  { key: "lv", label: "Lv順" },
                  { key: "stype", label: "艦種順" },
                  { key: "id", label: "図鑑順" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setSortMode(mode.key as any)}
                    style={{
                      fontWeight: sortMode === mode.key ? "bold" : "normal",
                      backgroundColor:
                        sortMode === mode.key ? "#6c757d" : "#f8f9fa",
                      color: sortMode === mode.key ? "#fff" : "#000",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
                <button
                  onClick={() => setIsDetailView(!isDetailView)}
                  style={{
                    marginLeft: "8px",
                    backgroundColor: "#fff",
                    color: "#333",
                    border: "1px solid #ccc",
                    cursor: "pointer",
                  }}
                >
                  {isDetailView ? "≡ 簡易" : "≣ 一覧"}
                </button>
                <label
                  style={{
                    marginLeft: "8px",
                    backgroundColor: "#ffc107",
                    color: "#000",
                    border: "1px solid #ccc",
                    cursor: "pointer",
                    padding: "1px 6px",
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  ⚡ 特効読込
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleBonusFileChange}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <button
                onClick={() => setSelectedCategory(null)}
                style={{
                  fontWeight: selectedCategory === null ? "bold" : "normal",
                  backgroundColor: selectedCategory === null ? "#007bff" : "#eee",
                  color: selectedCategory === null ? "#fff" : "#000",
                  border: "1px solid #ccc",
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                すべて
              </button>
              {stypeConfig.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  style={{
                    fontWeight: selectedCategory === cat.name ? "bold" : "normal",
                    backgroundColor:
                      selectedCategory === cat.name ? "#007bff" : "#eee",
                    color: selectedCategory === cat.name ? "#fff" : "#000",
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 艦娘一覧 (変更なし) */}
          <div
            style={{
              display: "flex",
              flexWrap: isDetailView ? "nowrap" : "wrap",
              flexDirection: isDetailView ? "column" : "row",
              gap: "0.5rem",
              maxHeight: "500px",
              overflowY: "auto",
              border: "1px solid #eee",
              padding: "0.5rem",
            }}
          >
            {filteredShips.map((ship, index) => (
              <DraggableShip
                key={`${ship.api_id}-${index}`}
                id={`ship-${ship.api_id}-${index}`}
                ship={ship}
                shipMaster={shipMaster}
                stypeMaster={stypeMaster}
                detailMode={isDetailView}
                isUsed={usedShipIds.has(ship.api_id)}
                bonusText={bonusMap[ship.api_ship_id]}
              />
            ))}
          </div>

          {/* ドラッグ中の要素を最前面に描画 (変更なし) */}
          <DragOverlay>
            {activeShip ? (
              <ShipItem
                ship={activeShip}
                name={shipMaster[String(activeShip.api_ship_id)]?.name ?? "???"}
                stypeName={
                  stypeMaster[
                    String(shipMaster[String(activeShip.api_ship_id)]?.stype)
                  ]
                }
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
