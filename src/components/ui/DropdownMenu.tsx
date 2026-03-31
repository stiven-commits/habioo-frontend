import { useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface DropdownMenuItem {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  icon?: ReactNode;
  className?: string;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  label?: ReactNode;
  width?: number;
}

const DropdownMenu: FC<DropdownMenuProps> = ({ items, label = 'Opciones', width = 200 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const estMenuHeight = items.length * 44 + 8;
    const padding = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const openUp = rect.bottom + estMenuHeight > viewportH - padding;
    const top = openUp
      ? Math.max(padding, rect.top - estMenuHeight - 6)
      : Math.min(viewportH - estMenuHeight - padding, rect.bottom + 6);
    const left = Math.min(
      viewportW - width - padding,
      Math.max(padding, rect.right - width),
    );

    setMenuPos({ top, left });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent): void => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return;
      setIsOpen(false);
    };

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScroll = (): void => setIsOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {label}
        <ChevronDown size={13} strokeWidth={2.5} className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 animate-fadeIn"
          style={{ top: menuPos.top, left: menuPos.left, width }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setIsOpen(false);
                item.onClick();
              }}
              className={[
                'w-full text-left px-4 py-3 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2',
                item.variant === 'danger'
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
                item.className ?? '',
              ].join(' ')}
            >
              {item.icon && <span className="shrink-0 w-4">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};

export default DropdownMenu;
