import { useEffect, useState } from 'react';

export function TouchDebugOverlay() {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const logEvent = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      const info = `${e.type} @ ${target.tagName}.${target.className.split(' ')[0]} z:${getComputedStyle(target).zIndex}`;
      setEvents(prev => [info, ...prev].slice(0, 5));
    };

    document.addEventListener('touchstart', logEvent, true);
    document.addEventListener('click', logEvent, true);
    document.addEventListener('touchend', logEvent, true);

    return () => {
      document.removeEventListener('touchstart', logEvent, true);
      document.removeEventListener('click', logEvent, true);
      document.removeEventListener('touchend', logEvent, true);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      background: 'rgba(0,0,0,0.8)',
      color: 'lime',
      padding: '10px',
      fontSize: '10px',
      zIndex: 99999,
      pointerEvents: 'none'
    }}>
      {events.map((e, i) => <div key={i}>{e}</div>)}
    </div>
  );
}
