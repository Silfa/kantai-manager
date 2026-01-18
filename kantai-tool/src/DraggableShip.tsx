import React, { forwardRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { RawShip, ShipMasterData } from './types';

interface ShipItemProps extends React.HTMLAttributes<HTMLDivElement> {
  ship: RawShip;
  name: string;
  stypeName?: string;
  detailMode?: boolean;
  bonusText?: string;
}

// 表示用コンポーネント（DragOverlayでも使うため分離）
export const ShipItem = forwardRef<HTMLDivElement, ShipItemProps>(
  ({ ship, name, stypeName, detailMode, bonusText, style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      border: '1px solid #ccc',
      padding: '4px',
      background: bonusText ? '#fff3cd' : '#e0f7ff',
      width: detailMode ? '100%' : '160px', // 詳細モードは行表示（100%）
      boxSizing: 'border-box',
      cursor: 'grab',
      touchAction: 'none', // スクロール防止
      userSelect: 'none',  // 範囲選択防止
      ...style,
    };

    // 艦娘データをanyにキャストしてプロパティにアクセス
    const s = ship as any;

    return (
      <div ref={ref} style={baseStyle} {...props}>
        {detailMode ? (
          <div style={{ display: 'flex', alignItems: 'center', textAlign: 'left', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ flex: '0 0 150px' }}>
              <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>ID: {ship.api_ship_id}</div>
              {/* 特効表示 (詳細モード) */}
              {bonusText && <div style={{ color: 'crimson', fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{bonusText}</div>}
            </div>
            
            <div style={{ flex: '0 0 80px' }}>{stypeName}</div>
            <div style={{ flex: '0 0 50px' }}>{ship.api_lv > 0 ? `Lv ${ship.api_lv}` : ""}</div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
               <div>火力:{s.api_karyoku ? s.api_karyoku[0] : '?'}</div>
               <div>雷装:{s.api_raisou ? s.api_raisou[0] : '?'}</div>
               <div>対空:{s.api_taiku ? s.api_taiku[0] : '?'}</div>
               <div>装甲:{s.api_soukou ? s.api_soukou[0] : '?'}</div>
               <div>耐久:{s.api_maxhp ? s.api_maxhp : '?'}</div>
               <div>運:{s.api_lucky ? s.api_lucky[0] : '?'}</div>
            </div>
          </div>
        ) : (
          <>
            <div>{name} {ship.api_lv > 0 ? `Lv${ship.api_lv}` : ""}</div>
            {/* 特効表示 (簡易モード) */}
            {bonusText && <div style={{ color: 'crimson', fontWeight: 'bold', fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>{bonusText}</div>}
          </>
        )}
      </div>
    );
  }
);

interface DraggableShipProps {
  ship: RawShip;
  shipMaster: Record<string, ShipMasterData>;
  stypeMaster?: Record<string, string>;
  id: string; // ユニークIDを受け取るように変更
  detailMode?: boolean;
  isUsed?: boolean;
  bonusText?: string;
}

export function DraggableShip({ ship, shipMaster, stypeMaster, id, detailMode, isUsed, bonusText }: DraggableShipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: id,
    data: { ship }, // 艦娘オブジェクトそのものを渡す
    disabled: isUsed // 編成済みの場合はドラッグ不可
  });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : (isUsed ? 0.5 : 1), // 使用中は半透明
    filter: isUsed ? 'grayscale(100%)' : undefined, // 使用中はグレーアウト
    cursor: isUsed ? 'not-allowed' : undefined, // カーソル変更
  };

  const info = shipMaster[String(ship.api_ship_id)];
  const name = info?.name ?? '???';
  const stypeName = stypeMaster && info ? stypeMaster[String(info.stype)] : '';

  return (
    <ShipItem
      ref={setNodeRef}
      ship={ship}
      name={name}
      stypeName={stypeName}
      detailMode={detailMode}
      bonusText={bonusText}
      style={style}
      {...listeners}
      {...attributes}
    />
  );
}
