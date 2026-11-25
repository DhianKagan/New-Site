import { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { tr } from '../lib/i18n.ts';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded bg-sky-500/20 border border-sky-400/35 hover:bg-sky-500/30 text-sky-200 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer"
        title={tr('Встановити додаток Energo Comfort', 'Установить приложение Energo Comfort')}
      >
        <Download className="w-3 h-3 shrink-0" />
        <span className="hidden sm:inline">{tr('Додаток', 'Приложение')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 border border-white/15 hover:bg-white/20 text-sky-200 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3 h-3 shrink-0" />
          <span className="hidden sm:inline">{tr('Додаток', 'Приложение')}</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tr('Встановлення на iPhone або iPad', 'Установка на iPhone или iPad')}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-[#0d1f33] shadow-xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-base font-extrabold">
                  {tr('Встановити EnergoShop на iOS', 'Установить EnergoShop на iOS')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={tr('Закрити')}
                  className="p-1 rounded-lg text-slate-400 hover:text-[#0d1f33] hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2 text-xs text-slate-600 leading-relaxed list-decimal pl-4">
                <li>
                  {tr(
                    'Натисніть кнопку «Поділитися» у нижній панелі Safari.',
                    'Нажмите кнопку «Поделиться» на нижней панели Safari.',
                  )}
                </li>
                <li>
                  {tr(
                    'Прокрутіть меню вниз та оберіть «На Початковий екран».',
                    'Прокрутите меню вниз и выберите «На экран «Домой»».',
                  )}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#0d1f33] py-2.5 text-xs font-bold text-white hover:bg-[#16324f] cursor-pointer"
              >
                {tr('Зрозуміло', 'Понятно')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-400/50 bg-[#0d1f33]/95 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-amber-200 shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
      <span>
        {tr(
          'Офлайн-режим — доступний кешований каталог',
          'Офлайн-режим — доступен кешированный каталог',
        )}
      </span>
    </div>
  );
}
