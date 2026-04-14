import type { FC, ReactNode } from 'react';
import Tooltip from '@rc-component/tooltip';
import '@rc-component/tooltip/assets/bootstrap_white.css';

type ModalWidthSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
type ModalWidth = ModalWidthSize | `max-w-${string}`;

interface ModalBaseProps {
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  helpTooltip?: ReactNode;
  maxWidth?: ModalWidth;
  disableClose?: boolean;
  closeOnOverlayClick?: boolean;
  children: ReactNode;
}

const MODAL_WIDTH_CLASS: Record<ModalWidthSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

const resolveMaxWidthClass = (maxWidth: ModalWidth): string => {
  if (String(maxWidth).startsWith('max-w-')) return String(maxWidth);
  return MODAL_WIDTH_CLASS[maxWidth as ModalWidthSize] || 'max-w-2xl';
};

const ModalBase: FC<ModalBaseProps> = ({
  onClose,
  title,
  subtitle,
  helpTooltip,
  maxWidth = 'max-w-2xl',
  disableClose = false,
  closeOnOverlayClick = true,
  children,
}) => {
  const maxWidthClass = resolveMaxWidthClass(maxWidth);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden animate-fadeIn"
      onClick={!disableClose && closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`bg-white dark:bg-donezo-card-dark rounded-2xl w-full ${maxWidthClass} shadow-2xl border border-gray-200/60 dark:border-gray-700/60 relative max-h-[90vh] overflow-hidden flex flex-col animate-modalEnter`}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gradient-to-r from-gray-50/50 to-white dark:from-gray-800/50 dark:to-donezo-card-dark">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{title}</h3>
            {helpTooltip && (
              <Tooltip
                placement="right"
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
                showArrow
                overlay={
                  <div className="max-w-[320px] whitespace-normal rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl">
                    {helpTooltip}
                  </div>
                }
                classNames={{ root: 'z-[70]' }}
              >
                <button
                  type="button"
                  className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  aria-label="Ayuda del modal"
                  title="Ayuda"
                >
                  ?
                </button>
              </Tooltip>
            )}
          </div>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={disableClose}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-5 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {children}
      </div>
      </div>
    </div>
  );
};

export default ModalBase;
