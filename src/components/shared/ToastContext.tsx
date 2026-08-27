import React, { createContext, useContext, useState, useCallback } from 'react';
import { ShieldCheck, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'shield';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  shield: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ type, title, message, duration = 3500 }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => {
    showToast({ type: 'success', title, message });
  }, [showToast]);

  const error = useCallback((title: string, message?: string) => {
    showToast({ type: 'error', title, message });
  }, [showToast]);

  const info = useCallback((title: string, message?: string) => {
    showToast({ type: 'info', title, message });
  }, [showToast]);

  const shield = useCallback((title: string, message?: string) => {
    showToast({ type: 'shield', title, message, duration: 4000 });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, shield }}>
      {children}
      {/* Toast Notification Layer */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 opacity-100 flex items-start gap-3 text-left ${
              t.type === 'shield'
                ? 'bg-slate-900/95 border-cyan-500/50 shadow-cyan-500/20 text-slate-100'
                : t.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/50 shadow-emerald-500/20 text-slate-100'
                : t.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/50 shadow-rose-500/20 text-slate-100'
                : 'bg-slate-900/95 border-indigo-500/50 shadow-indigo-500/20 text-slate-100'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'shield' && <ShieldCheck className="w-5 h-5 text-cyan-400 animate-pulse" />}
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-indigo-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold tracking-tight text-white">{t.title}</div>
              {t.message && <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">{t.message}</div>}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
