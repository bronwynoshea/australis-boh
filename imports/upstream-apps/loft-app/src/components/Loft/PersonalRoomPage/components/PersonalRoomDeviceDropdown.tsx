import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp } from 'lucide-react';

interface PersonalRoomDeviceDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

const PersonalRoomDeviceDropdown: React.FC<PersonalRoomDeviceDropdownProps> = ({ label, value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    return options.find(o => o.value === value)?.label || options[0]?.label || '';
  }, [options, value]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      const menuEl = menuRef.current;
      if (!el) return;
      if (menuEl && e.target instanceof Node && menuEl.contains(e.target)) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!options.some(o => o.value === value) && options[0]?.value) {
      onChange(options[0].value);
    }
  }, [options, value, onChange]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const handle = () => updateMenuPosition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [open, updateMenuPosition]);

  const dropdownMenu = open && menuPosition
    ? createPortal(
        <div
          ref={(node) => { menuRef.current = node; }}
          className="z-[9999] rounded-xl loft-panel shadow-2xl overflow-hidden"
          style={{
            position: 'absolute',
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
          }}
        >
          <div className="max-h-56 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors border-b border-[var(--loft-border)] last:border-b-0 ${
                  opt.value === value
                    ? 'bg-cafe/15 text-main dark:text-white'
                    : 'text-main/70 dark:text-white/70 hover:bg-[var(--loft-surface-strong)]'
                }`}
              >
                <span className="block truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={rootRef} className="space-y-2 relative overflow-visible">
      <div className="text-sm font-medium text-main/40 dark:text-white/40 px-1">{label}</div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        ref={triggerRef}
        className="w-full loft-panel rounded-xl px-4 py-3 text-sm font-medium text-main/70 dark:text-white/70 outline-none flex items-center justify-between gap-3"
      >
        <span className="truncate text-left flex-1">{selectedLabel}</span>
        <ChevronUp className={`w-4 h-4 shrink-0 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
      {dropdownMenu}
    </div>
  );
};

export default PersonalRoomDeviceDropdown;
