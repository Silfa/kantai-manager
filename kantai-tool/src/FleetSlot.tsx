import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { RawShip, ShipMasterData } from './types';

interface FleetSlotProps {
  slotId: string;
  index: number;
  ship: RawShip | null;
  shipMaster: Record<string, ShipMasterData>;
  stypeMaster: Record<string, string>;
  onRemove: () => void;
}

export default function FleetSlot({ slotId, index, ship, shipMaster, stypeMaster, onRemove }: FleetSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId
  });

  const style: React.CSSProperties = {
    width: '140px',
    height: '60px',
    border: '2px dashed #888',
    background: isOver ? '#d0f0ff' : '#f9f9f9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    fontSize: '0.8rem'
  };

  const removeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    right: '2px',
    background: '#ff4444',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    lineHeight: '1'
  };

  if (!ship) return <div ref={setNodeRef} style={style}>空き{index === 6 && <><br/>(7隻目)</>}</div>;

  const info = shipMaster[String(ship.api_ship_id)];
  const name = info?.name ?? '???';
  const stype = stypeMaster?.[String(info?.stype)] ?? '？';

  return (
    <div ref={setNodeRef} style={{ ...style, border: '2px solid #444', background: '#fff' }}>
      <button style={removeButtonStyle} onClick={onRemove}>×</button>
      <div style={{ fontWeight: 'bold' }}>{name}</div>
      <div>{stype} Lv{ship.api_lv}</div>
    </div>
  );
}
