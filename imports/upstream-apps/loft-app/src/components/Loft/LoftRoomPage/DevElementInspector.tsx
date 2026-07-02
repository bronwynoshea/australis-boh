import type { PointerEvent } from 'react';

export function DevElementInspector() {
  if (!(import.meta as any)?.env?.DEV) return null;

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const transportBar = document.getElementById('loft-transport-bar');
    const roomHeader = document.getElementById('loft-room-header');
    const isInTransportBar = transportBar?.contains(el as Node);
    const isInRoomHeader = roomHeader?.contains(el as Node);
    if (!isInTransportBar && !isInRoomHeader) {
      e.stopPropagation();
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999, pointerEvents: 'none' }} />
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999999, pointerEvents: 'auto', background: 'transparent' }}
        onPointerDownCapture={handlePointerDown}
      />
    </>
  );
}
