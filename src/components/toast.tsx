'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast πρέπει να χρησιμοποιείται μέσα σε <ToastProvider>.');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);

  const push = React.useCallback((message: string, tone: ToastTone = 'info') => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const value = React.useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:bottom-auto sm:right-0 sm:top-0 sm:items-end"
        role="region"
        aria-label="Ειδοποιήσεις"
      >
        {toasts.map((toast) => (
          <output
            key={toast.id}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto w-full max-w-sm animate-fade-in rounded-lg border px-4 py-3 text-sm shadow-lg',
              toast.tone === 'success' && 'border-primary/40 bg-primary text-primary-foreground',
              toast.tone === 'error' && 'border-destructive/40 bg-destructive text-destructive-foreground',
              toast.tone === 'info' && 'border-border bg-card text-card-foreground',
            )}
          >
            {toast.message}
          </output>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
