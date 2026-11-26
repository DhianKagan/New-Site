import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, Cable, HelpCircle, RefreshCw, TrendingUp } from 'lucide-react';
import {
  SYSTEM_MODES,
  SYSTEM_NODES,
  type SystemFlowMode,
  type SystemNodeId,
} from '../lib/howItWorksNodes.ts';
import { lazyWithRetry } from '../lib/lazyWithRetry.ts';
import { tr } from '../lib/i18n.ts';
import { PerformanceProfiler } from './PerformanceProfiler.tsx';
import { VideoBackground } from './VideoBackground.tsx';

const LazyHowItWorks3DCanvas = lazyWithRetry(
  () => import('./HowItWorks3DCanvas.tsx').then((m) => ({ default: m.HowItWorks3DCanvas })),
  { componentName: 'HowItWorks3DCanvas' },
);

interface Scene3DErrorBoundaryProps {
  children: ReactNode;
  selectedNodeId: SystemNodeId;
  activeMode: SystemFlowMode;
  onSelectNode: (id: SystemNodeId) => void;
  onSelectMode: (mode: SystemFlowMode) => void;
}

interface Scene3DErrorBoundaryState {
  hasError: boolean;
  retryAttempt: number;
}

class Scene3DErrorBoundary extends Component<Scene3DErrorBoundaryProps, Scene3DErrorBoundaryState> {
  state: Scene3DErrorBoundaryState = {
    hasError: false,
    retryAttempt: 0,
  };

  static getDerivedStateFromError(): Partial<Scene3DErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    console.warn('[HowItWorks] 3D scene fallback activated:', error.message);
  }

  private handleRetry = (): void => {
    if (this.state.retryAttempt >= 1 && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState((prev) => ({
      hasError: false,
      retryAttempt: prev.retryAttempt + 1,
    }));
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return <div key={this.state.retryAttempt}>{this.props.children}</div>;
    }

    const { selectedNodeId, activeMode, onSelectNode, onSelectMode } = this.props;
    const modeInfo = SYSTEM_MODES.find((m) => m.id === activeMode) ?? SYSTEM_MODES[0];

    return (
      <div className="rounded-2xl overflow-hidden border border-sky-200/35 bg-gradient-to-br from-[#07182e] via-[#0a2547] to-[#061830] shadow-xl p-5 sm:p-7 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-sky-200/20">
          <div>
            <div className="text-xs font-mono font-bold text-sky-300">
              {tr('Інтерактивна 2D-схема роботи СЕС', 'Интерактивная 2D-схема работы СЭС')}
            </div>
            <h3 className="text-lg font-extrabold text-white mt-0.5">
              {tr(modeInfo.labelUk, modeInfo.labelRu)}
            </h3>
            <p className="text-xs sm:text-sm text-sky-100/85 mt-1 max-w-2xl">
              {tr(modeInfo.summaryUk, modeInfo.summaryRu)}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-sky-300/35 bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors shrink-0 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{tr('Спробувати 3D-режим знову', 'Повторить загрузку 3D-режима')}</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={tr('Режими роботи станції', 'Режимы работы станции')}>
          {SYSTEM_MODES.map((mode) => {
            const isActive = mode.id === activeMode;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectMode(mode.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#f59e0b] text-[#07213e]'
                    : 'bg-white/10 text-sky-100 hover:bg-white/18 border border-sky-200/20'
                }`}
              >
                {tr(mode.labelUk, mode.labelRu)}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-3">
          {SYSTEM_NODES.map((node) => {
            const isSelected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                className={`text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/25 border-[#f59e0b] shadow-md'
                    : 'bg-white/8 border-sky-200/20 hover:bg-white/14'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-sky-200">
                  <span>{node.order}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: node.accentHex }}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-1.5 text-xs font-extrabold text-white">
                  {tr(node.titleUk, node.titleRu)}
                </div>
                <div className="mt-1 text-[11px] text-sky-100/75 leading-snug">
                  {tr(node.shortUk, node.shortRu)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}

interface HowItWorksProps {
  onOpenLeadModal: (
    topic: string,
    estimatedTotalUsd?: number,
    placement?: 'hero' | 'sticky' | 'section' | 'footer',
    initialNotes?: string,
  ) => void;
}

export function HowItWorks({ onOpenLeadModal }: HowItWorksProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<SystemNodeId>('inverter');
  const [activeMode, setActiveMode] = useState<SystemFlowMode>('day_solar');
  const [shouldLoad3D, setShouldLoad3D] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (shouldLoad3D || typeof IntersectionObserver === 'undefined') {
      setShouldLoad3D(true);
      return;
    }
    const target = sectionRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad3D(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoad3D]);

  const activeNode = SYSTEM_NODES.find((n) => n.id === selectedNodeId) ?? SYSTEM_NODES[1];

  function scrollToCalculator() {
    const el = document.getElementById('payback-calculator');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative overflow-hidden isolate ec-section border-b border-white/25"
    >
      <VideoBackground position="absolute" tone="light" tint="cyan" start={11} end={17} brightness={0.54} />
      <div className="relative ec-container break-words hyphens-none">
        <div className="ec-glass-plate rounded-2xl p-4 sm:p-6 lg:p-7 mb-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="text-xs font-extrabold text-[#0b66b2] mb-1.5">
              {tr('Архітектура системи наочно', 'Архитектура системы наглядно')}
            </div>
            <h2 className="text-[clamp(1.2rem,4.5vw,1.875rem)] font-extrabold text-[#07213e] leading-tight mb-2">
              {tr('Як це працює: схема підключення у 3D', 'Как это работает: схема подключения в 3D')}
            </h2>
            <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed">
              {tr(
                'Обертайте 3D-макет, натискайте на елементи станції або перемикайте режим («Сонячний день», «Блекаут», «Нічний тариф») — щоб побачити, як усе поєднується і що дає кожен вузол.',
                'Вращайте 3D-макет, нажимайте на элементы станции или переключайте режим («Солнечный день», «Блекаут», «Ночной тариф») — чтобы увидеть, как всё подключается и что даёт каждый узел.',
              )}
            </p>
          </div>

          <div className="text-xs text-[#0b66b2] bg-[#e6f3ff]/85 border border-sky-200/80 rounded-xl px-3.5 py-2.5 font-bold shrink-0">
            {tr('Клік по 3D-вузлу або вибір нижче фокусує камеру', 'Клик по 3D-узлу или выбор ниже фокусирует камеру')}
          </div>
        </div>

        {/* Interactive 3D Viewport with resilient ErrorBoundary + 2D schematic fallback */}
        {shouldLoad3D ? (
          <Scene3DErrorBoundary
            selectedNodeId={selectedNodeId}
            activeMode={activeMode}
            onSelectNode={setSelectedNodeId}
            onSelectMode={setActiveMode}
          >
            <Suspense
              fallback={
                <div className="rounded-2xl overflow-hidden border border-sky-200/35 bg-[#07182e] shadow-xl">
                  <div className="w-full h-[300px] sm:h-[420px] lg:h-[470px] flex items-center justify-center text-sky-200/80 text-xs font-bold">
                    {tr('Завантаження 3D-схеми станції…', 'Загрузка 3D-схемы станции…')}
                  </div>
                </div>
              }
            >
              <PerformanceProfiler id="HowItWorks3DCanvas" trackLoad>
                <LazyHowItWorks3DCanvas
                  selectedNodeId={selectedNodeId}
                  activeMode={activeMode}
                  onSelectNode={setSelectedNodeId}
                  onSelectMode={setActiveMode}
                />
              </PerformanceProfiler>
            </Suspense>
          </Scene3DErrorBoundary>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-sky-200/35 bg-[#07182e] shadow-xl">
            <div className="w-full h-[300px] sm:h-[420px] lg:h-[470px] flex items-center justify-center text-sky-200/75 text-xs font-bold">
              {tr('Інтерактивна 3D-схема СЕС…', 'Интерактивная 3D-схема СЭС…')}
            </div>
          </div>
        )}

        {/* Node Selector Tabs */}
        <div
          role="tablist"
          aria-label={tr('Вузли сонячної електростанції', 'Узлы солнечной электростанции')}
          className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {SYSTEM_NODES.map((node) => {
            const isSelected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedNodeId(node.id)}
                className={`text-left px-4 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/95 border-[#f59e0b] text-[#07213e] shadow-lg'
                    : 'ec-glass-card text-[#07213e] hover:bg-white/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold mb-1">
                  <span style={{ color: isSelected ? '#0b66b2' : '#1c3d5e' }}>{node.order}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: node.accentHex }}
                    aria-hidden="true"
                  />
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-[#07213e] truncate">
                  {tr(node.titleUk, node.titleRu)}
                </div>
                <div className="text-[11px] text-[#1c3d5e]/85 font-medium truncate mt-0.5">
                  {tr(node.shortUk, node.shortRu)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Node Header */}
        <div className="mt-6 ec-glass-sapphire rounded-2xl px-5 py-4 sm:px-6 sm:py-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono font-bold text-sky-200">
              {activeNode.order} · {tr(activeNode.specHighlightUk, activeNode.specHighlightRu)}
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
              {tr(activeNode.titleUk, activeNode.titleRu)}
            </h3>
          </div>
          <div className="text-xs font-mono font-semibold text-sky-50 bg-white/12 border border-sky-200/25 rounded-xl px-3.5 py-2">
            {tr(activeNode.connectionPathUk, activeNode.connectionPathRu)}
          </div>
        </div>

        {/* Selected Node Breakdown: 3 Uniform Glass Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          <article className="ec-glass-card rounded-2xl p-5 sm:p-6 h-full flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#e6f3ff] text-[#0b66b2] flex items-center justify-center shrink-0">
                <Cable className="w-4 h-4" />
              </span>
              <h4 className="text-[15px] font-extrabold text-[#061c36]">
                {tr('Як і куди підключається', 'Как и куда подключается')}
              </h4>
            </div>
            <p className="text-sm text-[#133659] font-medium leading-[1.65]">
              {tr(activeNode.howConnectsUk, activeNode.howConnectsRu)}
            </p>
          </article>

          <article className="ec-glass-card rounded-2xl p-5 sm:p-6 h-full flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-amber-50 text-[#d97706] flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4" />
              </span>
              <h4 className="text-[15px] font-extrabold text-[#061c36]">
                {tr('Навіщо потрібен у системі', 'Зачем нужен в системе')}
              </h4>
            </div>
            <p className="text-sm text-[#133659] font-medium leading-[1.65]">
              {tr(activeNode.whyNeededUk, activeNode.whyNeededRu)}
            </p>
          </article>

          <article className="ec-glass-card rounded-2xl p-5 sm:p-6 h-full flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0d9488] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h4 className="text-[15px] font-extrabold text-[#061c36]">
                {tr('Що дає власнику', 'Что даёт владельцу')}
              </h4>
            </div>
            <p className="text-sm text-[#133659] font-medium leading-[1.65]">
              {tr(activeNode.whatGivesUk, activeNode.whatGivesRu)}
            </p>
          </article>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={scrollToCalculator}
            className="ec-glass-plate inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-extrabold text-[#0b66b2] hover:text-[#07213e] hover:bg-white/90 transition-colors cursor-pointer"
          >
            <span>{tr('Перейти до калькулятора окупності', 'Перейти к калькулятору окупаемости')}</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenLeadModal(
                `Підбір системи (вузол: ${activeNode.titleUk})`,
                undefined,
                'section',
                `Користувач вивчав 3D-схему «Як це працює» (елемент: ${activeNode.titleUk}).`,
              )
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#07213e] hover:text-white text-xs font-extrabold shadow-md transition-colors cursor-pointer"
          >
            <span>{tr('Підібрати схему під мій об’єкт', 'Подобрать схему под мой объект')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
