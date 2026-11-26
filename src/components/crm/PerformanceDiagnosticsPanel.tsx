import { useState, useSyncExternalStore } from 'react';
import { Activity, Check, Copy, Gauge, Layers, RefreshCw, Trash2 } from 'lucide-react';
import {
  clearPerformanceMetrics,
  exportPerformanceReport,
  getPerformanceSnapshot,
  subscribePerformanceMonitor,
} from '../../lib/performanceMonitor.ts';
import { tr } from '../../lib/i18n.ts';

function formatMs(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return `${val.toFixed(2)} ms`;
}

export function PerformanceDiagnosticsPanel() {
  const snapshot = useSyncExternalStore(
    subscribePerformanceMonitor,
    getPerformanceSnapshot,
    getPerformanceSnapshot,
  );
  const [copiedReport, setCopiedReport] = useState(false);

  async function handleCopyReport() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPerformanceReport(), null, 2));
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      setCopiedReport(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#0d1f33] flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#1769aa]" />
            {tr(
              'Моніторинг продуктивності (React.Profiler & Lazy Load)',
              'Мониторинг производительности (React.Profiler & Lazy Load)',
            )}
          </h2>
          <p className="text-xs text-[#52657a] mt-0.5 max-w-2xl">
            {tr(
              `Час завантаження lazy-компонентів і продуктивність рендерингу великих списків товарів. Поріг повільного кадру: > ${snapshot.slowRenderThresholdMs} ms (60 FPS).`,
              `Время загрузки lazy-компонентов и производительность рендеринга больших списков товаров. Порог медленного кадра: > ${snapshot.slowRenderThresholdMs} ms (60 FPS).`,
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyReport()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-[#169374]" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedReport ? tr('Скопійовано JSON', 'Скопирован JSON') : tr('Експорт JSON', 'Экспорт JSON')}
          </button>
          {snapshot.totalRenders > 0 || snapshot.totalComponentLoads > 0 ? (
            <button
              type="button"
              onClick={() => clearPerformanceMetrics()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {tr('Скинути', 'Сбросить')}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500">
              <RefreshCw className="w-3 h-3" />
              {tr('Очікує вимірів', 'Ожидает замеров')}
            </span>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3.5">
          <div className="text-[11px] font-bold text-slate-500">
            {tr('Відстежувані зони', 'Отслеживаемые зоны')}
          </div>
          <div className="mt-1 text-lg font-extrabold font-mono text-[#0d1f33] tabular-nums">
            {snapshot.profilers.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3.5">
          <div className="text-[11px] font-bold text-slate-500">
            {tr('Зафіксовано рендерів', 'Зафиксировано рендеров')}
          </div>
          <div className="mt-1 text-lg font-extrabold font-mono text-[#1769aa] tabular-nums">
            {snapshot.totalRenders}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3.5">
          <div className="text-[11px] font-bold text-slate-500">
            {tr(`Повільні (> ${snapshot.slowRenderThresholdMs} ms)`, `Медленные (> ${snapshot.slowRenderThresholdMs} ms)`)}
          </div>
          <div
            className={`mt-1 text-lg font-extrabold font-mono tabular-nums ${
              snapshot.totalSlowRenders > 0 ? 'text-amber-600' : 'text-[#169374]'
            }`}
          >
            {snapshot.totalSlowRenders}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3.5">
          <div className="text-[11px] font-bold text-slate-500">
            {tr('Завантажено lazy-модулів', 'Загружено lazy-модулей')}
          </div>
          <div className="mt-1 text-lg font-extrabold font-mono text-[#0d1f33] tabular-nums">
            {snapshot.componentLoads.length}
          </div>
        </div>
      </div>

      {/* Profiler Render Metrics Table */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold text-[#0d1f33] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#1769aa]" />
          {tr('Профілювання списків товарів та представлень (React.Profiler)', 'Профилирование списков товаров и представлений (React.Profiler)')}
        </div>
        {snapshot.profilers.length === 0 ? (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            {tr('Ще немає даних профілювання рендерингу.', 'Пока нет данных профилирования рендеринга.')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500">
                  <th className="py-2 px-3">{tr('Profiler ID', 'Profiler ID')}</th>
                  <th className="py-2 px-3 text-right">{tr('Рендерів', 'Рендеров')}</th>
                  <th className="py-2 px-3 text-right">{tr('Середній (actual)', 'Средний (actual)')}</th>
                  <th className="py-2 px-3 text-right">{tr('Макс (actual)', 'Макс (actual)')}</th>
                  <th className="py-2 px-3 text-right">{tr('Останній (base)', 'Последний (base)')}</th>
                  <th className="py-2 px-3 text-right">{tr('Позицій', 'Позиций')}</th>
                  <th className="py-2 px-3 text-right">{tr('Повільних', 'Медленных')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.profilers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-[#0d1f33] whitespace-nowrap">
                      {item.id}
                      <span className="ml-2 text-[10px] font-normal text-slate-400">
                        ({item.lastPhase})
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {item.rendersCount}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#1769aa] font-semibold">
                      {formatMs(item.avgActualDurationMs)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono tabular-nums font-bold ${
                        item.maxActualDurationMs > snapshot.slowRenderThresholdMs
                          ? 'text-amber-600'
                          : 'text-[#169374]'
                      }`}
                    >
                      {formatMs(item.maxActualDurationMs)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                      {formatMs(item.lastBaseDurationMs)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                      {item.lastItemCount ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold ${
                          item.slowRendersCount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-[#169374]'
                        }`}
                      >
                        {item.slowRendersCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Component Load Timings Table */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold text-[#0d1f33] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#169374]" />
          {tr('Час завантаження компонентів (Dynamic Import → Mount)', 'Время загрузки компонентов (Dynamic Import → Mount)')}
        </div>
        {snapshot.componentLoads.length === 0 ? (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            {tr('Дані завантаження з’являться після відкриття lazy-розділів.', 'Данные загрузки появятся после открытия lazy-разделов.')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500">
                  <th className="py-2 px-3">{tr('Компонент', 'Компонент')}</th>
                  <th className="py-2 px-3 text-right">{tr('Чанк (import)', 'Чанк (import)')}</th>
                  <th className="py-2 px-3 text-right">{tr('Перший mount', 'Первый mount')}</th>
                  <th className="py-2 px-3 text-right">{tr('Разом до готовності', 'Итого до готовности')}</th>
                  <th className="py-2 px-3 text-right">{tr('Спроб', 'Попыток')}</th>
                  <th className="py-2 px-3 text-right">{tr('Статус', 'Статус')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.componentLoads.map((load) => (
                  <tr key={load.componentName} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-[#0d1f33] whitespace-nowrap">
                      {load.componentName}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatMs(load.chunkLoadMs)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#1769aa]">
                      {formatMs(load.mountActualDurationMs)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#0d1f33]">
                      {formatMs(load.totalLoadToMountMs)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                      {load.attempts}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                          load.status === 'loaded'
                            ? 'bg-emerald-50 text-[#169374]'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {load.status === 'loaded' ? 'OK' : 'ERROR'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Slow Renders */}
      {snapshot.recentSlowRenders.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-extrabold text-amber-800">
            {tr(`Останні повільні рендери (> ${snapshot.slowRenderThresholdMs} ms)`, `Последние медленные рендеры (> ${snapshot.slowRenderThresholdMs} ms)`)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {snapshot.recentSlowRenders.slice(0, 6).map((sample, idx) => (
              <div
                key={`${sample.id}-${sample.commitTime}-${idx}`}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/50 font-mono"
              >
                <span className="truncate font-bold text-[#0d1f33]">
                  {sample.id} ({sample.phase}
                  {sample.itemCount !== null ? `, ${sample.itemCount} items` : ''})
                </span>
                <span className="shrink-0 font-bold text-amber-700 tabular-nums">
                  {formatMs(sample.actualDurationMs)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
