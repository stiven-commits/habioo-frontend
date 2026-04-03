import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableComboboxOption {
  value: string;
  label: string;
  searchText?: string;
}

interface SearchableComboboxProps {
  options: SearchableComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  emptyMessage?: string;
  searchInputTestId?: string;
  buttonTestId?: string;
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
  disabled = false,
  emptyMessage = 'Sin resultados',
  searchInputTestId,
  buttonTestId,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const selected = options.find((opt) => opt.value === value);
    setQuery(selected?.label || '');
  }, [value, options]);

  useEffect(() => {
    const onDocMouseDown = (ev: globalThis.MouseEvent): void => {
      const target = ev.target as Node | null;
      if (!target) return;
      const clickInsideInput = rootRef.current?.contains(target);
      const clickInsideMenu = menuRef.current?.contains(target);
      if (!clickInsideInput && !clickInsideMenu) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const txt = query.trim().toLowerCase();
    if (!txt) return options;
    return options.filter((opt) => {
      const haystack = `${opt.label} ${opt.searchText || ''}`.toLowerCase();
      return haystack.includes(txt);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open || !inputRef.current) return;

    const updatePosition = (): void => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <input
        data-testid={searchInputTestId}
        ref={inputRef}
        type="text"
        value={query}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} ${!disabled ? 'pr-10' : ''}`}
      />
      {!disabled && (
        <button
          data-testid={buttonTestId}
          type="button"
          onClick={() => {
            setQuery('');
            onChange('');
            setOpen(true);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title="Limpiar seleccion"
          aria-label="Limpiar seleccion"
        >
          x
        </button>
      )}
      {open && !disabled && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[260] max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
          style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setQuery(opt.label);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {opt.label}
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default SearchableCombobox;
