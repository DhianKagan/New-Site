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
    <section id="how-it-works" className="relative overflow-hidden isolate ec-section border-b border-white/25">
      <VideoBackground position="absolute" tone="light" tint="cyan" start={11} end={17} brightness={0.54} />
      <div className="relative ec-container">
        <div className="ec-glass-plate rounded-2xl p-6 sm:p-7 mb-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="text-xs font-extrabold text-[#0b66b2] mb-1.5">
              {tr('Архітектура системи наочно', 'Архитектура системы наглядно')}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e] mb-2">
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
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <article className="ec-glass-card rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#e6f3ff] text-[#0b66b2] flex items-center justify-center shrink-0">
                <Cable className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-extrabold text-[#07213e]">
                {tr('Як і куди підключається', 'Как и куда подключается')}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#1c3d5e] leading-relaxed">
              {tr(activeNode.howConnectsUk, activeNode.howConnectsRu)}
            </p>
          </article>

          <article className="ec-glass-card rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-amber-50 text-[#d97706] flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-extrabold text-[#07213e]">
                {tr('Навіщо потрібен у системі', 'Зачем нужен в системе')}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#1c3d5e] leading-relaxed">
              {tr(activeNode.whyNeededUk, activeNode.whyNeededRu)}
            </p>
          </article>

          <article className="ec-glass-card rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0d9488] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-extrabold text-[#07213e]">
                {tr('Що дає власнику', 'Что даёт владельцу')}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#1c3d5e] leading-relaxed">
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
