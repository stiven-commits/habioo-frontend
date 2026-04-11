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
  <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 overflow-x-hidden overflow-y-auto animate-fadeIn">
    <div className={`bg-white dark:bg-donezo-card-dark rounded-3xl w-full ${maxWidth} shadow-2xl border border-gray-100 dark:border-gray-800 relative my-2 sm:my-6 max-h-[calc(100vh-1rem)] sm:max-h-[90vh] overflow-hidden flex flex-col`}>
      <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div>
          <h3 className="text-2xl font-black text-gray-800 dark:text-white">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={disableClose}
          className="ml-4 shrink-0 text-gray-400 hover:text-red-500 font-bold text-2xl transition-colors leading-none disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Cerrar"
        >
          x
        </button>
      </div>

      <div className="px-6 pb-6 min-h-0 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  </div>
);

export default ModalBase;
