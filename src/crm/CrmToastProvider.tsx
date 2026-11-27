import { useCallback, useMemo, useState } from 'react';
import type { NotificationProvider, OpenNotificationParams } from '@refinedev/core';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

interface ToastItem extends OpenNotificationParams {
  id: string;
}

export function useCrmToastNotificationProvider(): {
  notificationProvider: NotificationProvider;
  toasts: ToastItem[];
  dismiss: (key: string) => void;
} {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const close = useCallback((key: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== key && item.key !== key));
  }, []);

  const open = useCallback((params: OpenNotificationParams) => {
    const id = params.key || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => {
      const filtered = prev.filter((item) => item.id !== id && item.key !== id);
      return [...filtered.slice(-3), { ...params, id, key: id }];
    });

    if (params.type !== 'progress') {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4200);
    }
  }, []);

  const notificationProvider = useMemo<NotificationProvider>(
    () => ({ open, close }),
    [open, close],
  );

  return { notificationProvider, toasts, dismiss: close };
}

export function CrmToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isProgress = toast.type === 'progress';
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3.5 shadow-lg bg-white flex items-start gap-3 text-[15px] ${
              isError
                ? 'border-red-200 text-red-900'
                : isProgress
                  ? 'border-sky-200 text-[#0d1f33]'
                  : 'border-emerald-200 text-[#0d1f33]'
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {isError ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : isProgress ? (
                <Loader2 className="w-5 h-5 text-[#1769aa] animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#169374]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold leading-snug">{toast.message}</div>
              {toast.description && (
                <div className="text-sm text-slate-600 mt-1 break-words">{toast.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Закрити сповіщення"
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
