import React, { useState, useRef, useEffect } from 'react';

interface MenuFilterDropdownOption<T = string | number | null | undefined> {
  label: string;
  value: T;
  description?: string;
}

interface MenuFilterDropdownProps<T = string | number | null | undefined> {
  label: string;
  displayValue?: string;
  placeholder?: string;
  options: MenuFilterDropdownOption<T>[];
  onSelect: (value: T) => void;
  disabled?: boolean;
}

const MenuFilterDropdown = <T,>({
  label,
  displayValue,
  placeholder = 'All',
  options,
  onSelect,
  disabled = false,
}: MenuFilterDropdownProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`min-w-[160px] h-10 px-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface flex items-center justify-between gap-3 text-left shadow-sm transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-boh-primary'
        }`}
      >
        <div className="flex-1 flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
            {label}
          </span>
          <span className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate">
            {displayValue || placeholder}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-lg max-h-64 overflow-y-auto boh-dropdown-scrollbar">
          {options.map((option) => (
            <button
              key={String(option.value ?? 'all')}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
            >
              <p className="font-medium text-boh-text-light dark:text-boh-text">{option.label}</p>
              {option.description && (
                <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{option.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuFilterDropdown;
