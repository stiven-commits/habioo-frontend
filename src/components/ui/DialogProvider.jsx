import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const DialogContext = createContext(null);

const VARIANT_STYLES = {
  info: {
    icon: 'i',
    iconClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  success: {
    icon: 'OK',
    iconClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  warning: {
    icon: '!',
    iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  danger: {
    icon: '!',
    iconClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
};

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [queue, setQueue] = useState([]);
  const resolverRef = useRef(null);

  const closeDialog = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog && queue.length > 0) {
      const next = queue[0];
      resolverRef.current = next.resolve;
      setDialog(next.config);
      setQueue((prev) => prev.slice(1));
    }
  }, [dialog, queue]);

  const enqueueDialog = useCallback((config, resolve) => {
    setQueue((prev) => [...prev, { config, resolve }]);
  }, []);

  const showAlert = useCallback((opts) => {
    return new Promise((resolve) => {
      enqueueDialog({
        type: 'alert',
        title: opts?.title || 'Aviso',
        message: opts?.message || '',
        confirmText: opts?.confirmText || 'Aceptar',
        variant: opts?.variant || 'info',
      }, resolve);
    });
  }, [enqueueDialog]);

  const showConfirm = useCallback((opts) => {
    return new Promise((resolve) => {
      enqueueDialog({
        type: 'confirm',
        title: opts?.title || 'Confirmar accion',
        message: opts?.message || '',
        confirmText: opts?.confirmText || 'Confirmar',
        cancelText: opts?.cancelText || 'Cancelar',
        variant: opts?.variant || 'warning',
      }, resolve);
    });
  }, [enqueueDialog]);

  useEffect(() => {
    const nativeAlert = window.alert;
    window.alert = (message) => {
      showAlert({
        title: 'Aviso',
        message: String(message ?? ''),
        variant: 'info',
      });
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, [showAlert]);

  const contextValue = useMemo(
    () => ({ showAlert, showConfirm }),
    [showAlert, showConfirm],
  );

  const variant = dialog?.variant || 'info';
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

  return (
    <DialogContext.Provider value={contextValue}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-[2px]">
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${style.iconClass}`}>
                {style.icon}
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{dialog.title}</h3>
            </div>

            <p className="mb-6 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{dialog.message}</p>

            <div className="flex justify-end gap-2">
              {dialog.type === 'confirm' && (
                <button
                  type="button"
                  onClick={() => closeDialog(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {dialog.cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={() => closeDialog(dialog.type === 'confirm' ? true : undefined)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${style.confirmClass}`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog debe usarse dentro de DialogProvider');
  }
  return context;
}

