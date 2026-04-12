import type { FC, ReactNode } from 'react';

interface ModalBaseProps {
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  maxWidth?: string;
  disableClose?: boolean;
  children: ReactNode;
}

const ModalBase: FC<ModalBaseProps> = ({
  onClose,
  title,
  subtitle,
  maxWidth = 'max-w-2xl',
  disableClose = false,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden animate-fadeIn"
    onClick={!disableClose ? onClose : undefined}
  >
    <div
      className={`bg-white dark:bg-donezo-card-dark rounded-2xl w-full ${maxWidth} shadow-2xl border border-gray-200/60 dark:border-gray-700/60 relative max-h-[90vh] overflow-hidden flex flex-col animate-modalEnter`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gradient-to-r from-gray-50/50 to-white dark:from-gray-800/50 dark:to-donezo-card-dark">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{title}</h3>
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

export default ModalBase;
