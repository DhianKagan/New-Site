import { useState } from 'react';
import { ArrowDown, ArrowRight, Cable, HelpCircle, TrendingUp } from 'lucide-react';
import {
  SYSTEM_NODES,
  type SystemFlowMode,
  type SystemNodeId,
} from '../lib/howItWorksNodes.ts';
import { tr } from '../lib/i18n.ts';
import { HowItWorks3DCanvas } from './HowItWorks3DCanvas.tsx';
import { VideoBackground } from './VideoBackground.tsx';

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

  const activeNode = SYSTEM_NODES.find((n) => n.id === selectedNodeId) ?? SYSTEM_NODES[1];

  function scrollToCalculator() {
    const el = document.getElementById('payback-calculator');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <section id="how-it-works" className="relative overflow-hidden isolate py-14 border-b border-white/15">
      <VideoBackground position="absolute" tone="light" start={10} end={25} />
      <div className="relative max-w-[1180px] mx-auto px-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7">
          <div className="max-w-2xl">
            <div className="text-xs font-extrabold text-sky-300 text-on-video mb-1.5">
              {tr('Архітектура системи наочно', 'Архитектура системы наглядно')}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-on-video mb-2">
              {tr('Як це працює: схема підключення у 3D', 'Как это работает: схема подключения в 3D')}
            </h2>
            <p className="text-sm text-slate-100 font-medium text-on-video leading-relaxed">
              {tr(
                'Обертайте 3D-макет, натискайте на елементи станції або перемикайте режим («Сонячний день», «Блекаут», «Нічний тариф») — щоб побачити, як усе поєднується і що дає кожен вузол.',
                'Вращайте 3D-макет, нажимайте на элементы станции или переключайте режим («Солнечный день», «Блекаут», «Ночной тариф») — чтобы увидеть, как всё подключается и что даёт каждый узел.',
              )}
            </p>
          </div>

          <div className="text-xs text-slate-200 font-semibold text-on-video shrink-0">
            {tr('Клік по 3D-вузлу або вибір нижче фокусує камеру', 'Клик по 3D-узлу или выбор ниже фокусирует камеру')}
          </div>
        </div>

        {/* Interactive 3D Viewport */}
        <HowItWorks3DCanvas
          selectedNodeId={selectedNodeId}
          activeMode={activeMode}
          onSelectNode={setSelectedNodeId}
          onSelectMode={setActiveMode}
        />

        {/* Node Selector Tabs */}
        <div
          role="tablist"
          aria-label={tr('Вузли сонячної електростанції', 'Узлы солнечной электростанции')}
          className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
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
                className={`text-left px-3.5 py-3 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-white border-[#f59e0b] text-[#0d1f33] shadow-lg'
                    : 'bg-white/92 backdrop-blur-md border-white/25 text-[#0d1f33] hover:bg-white shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold mb-1">
                  <span style={{ color: isSelected ? '#1769aa' : '#334155' }}>{node.order}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: node.accentHex }}
                    aria-hidden="true"
                  />
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-[#0d1f33] truncate">
                  {tr(node.titleUk, node.titleRu)}
                </div>
                <div className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                  {tr(node.shortUk, node.shortRu)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Node Header */}
        <div className="mt-6 rounded-xl border border-white/15 bg-[#081421]/75 backdrop-blur-md px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="text-xs font-mono font-bold text-sky-300">
              {activeNode.order} · {tr(activeNode.specHighlightUk, activeNode.specHighlightRu)}
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white text-on-video mt-0.5">
              {tr(activeNode.titleUk, activeNode.titleRu)}
            </h3>
          </div>
          <div className="text-xs font-mono font-semibold text-slate-100 bg-white/10 border border-white/15 rounded-lg px-3 py-2">
            {tr(activeNode.connectionPathUk, activeNode.connectionPathRu)}
          </div>
        </div>

        {/* Selected Node Breakdown: 3 Separate Cards */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-white/25 border-t-4 border-t-[#1769aa] bg-white/95 backdrop-blur-md shadow-xl p-5 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-[#eff6fc] text-[#1769aa] flex items-center justify-center shrink-0">
                <Cable className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-extrabold text-[#0d1f33]">
                {tr('Як і куди підключається', 'Как и куда подключается')}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#1e293b] leading-relaxed">
              {tr(activeNode.howConnectsUk, activeNode.howConnectsRu)}
            </p>
          </article>

          <article className="rounded-2xl border border-white/25 border-t-4 border-t-[#f59e0b] bg-white/95 backdrop-blur-md shadow-xl p-5 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-amber-50 text-[#d97706] flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-extrabold text-[#0d1f33]">
                {tr('Навіщо потрібен у системі', 'Зачем нужен в системе')}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#1e293b] leading-relaxed">
              {tr(activeNode.whyNeededUk, activeNode.whyNeededRu)}
            </p>
          </article>

          <article className="rounded-2xl border border-white/25 border-t-4 border-t-[#169374] bg-white/95 backdrop-blur-md shadow-xl p-5 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-[#169374] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-extrabold text-[#0d1f33]">
                {tr('Що дає власнику', 'Что даёт владельцу')}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#1e293b] leading-relaxed">
              {tr(activeNode.whatGivesUk, activeNode.whatGivesRu)}
            </p>
          </article>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={scrollToCalculator}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#081421]/75 hover:bg-[#081421]/90 border border-white/20 text-xs font-extrabold text-sky-300 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] hover:text-white text-xs font-extrabold shadow-lg transition-colors cursor-pointer"
          >
            <span>{tr('Підібрати схему під мій об’єкт', 'Подобрать схему под мой объект')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
