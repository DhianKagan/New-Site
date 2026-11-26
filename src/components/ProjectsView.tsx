import { useState } from 'react';
import type { ProjectCase } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import { getActiveLocale, tr } from '../lib/i18n.ts';

interface ProjectsViewProps {
  projects: ProjectCase[];
  onBackHome?: () => void;
  onSelectCase: (project: ProjectCase) => void;
}

export function ProjectsView({ projects, onSelectCase }: ProjectsViewProps) {
  const isRussian = getActiveLocale() === 'ru';
  const [seg, setSeg] = useState<'all' | 'b2b' | 'b2c'>('all');
  const filtered = projects.filter((p) => seg === 'all' || p.seg === seg);

  return (
    <div>
      <section className="ec-banner text-[#07213e]">
        <div className="ec-container">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#07213e] mb-2">
            {tr('Реалізовані проєкти СЕС та систем живлення в Одеській області', 'Реализованные солнечные электростанции и системы питания в Одесской области')}
          </h1>
          <p className="text-sm text-[#1c3d5e] font-medium max-w-2xl">
            {tr('Комерційні СЕС до 110 кВт та приватні системи резервного живлення для квартир і будинків.', 'Коммерческие солнечные электростанции до 110 кВт и системы резервного питания для квартир и домов.')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground position="absolute" tone="light" tint="emerald" start={32} end={44} brightness={0.56} />
        <div className="relative ec-container">
          <h2 className="sr-only">{tr('Кейси встановлених сонячних електростанцій та систем резервного живлення', 'Примеры установленных солнечных электростанций и систем резервного питания')}</h2>
          <div className="inline-flex flex-wrap gap-1.5 p-1.5 ec-glass-plate rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setSeg('all')}
              className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                seg === 'all' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e] hover:bg-white/60'
              }`}
            >
              {tr('Усі проєкти', 'Все проекты')} ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setSeg('b2b')}
              className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                seg === 'b2b' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e] hover:bg-white/60'
              }`}
            >
              {tr('Бізнес B2B')} ({projects.filter((p) => p.seg === 'b2b').length})
            </button>
            <button
              type="button"
              onClick={() => setSeg('b2c')}
              className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                seg === 'b2c' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e] hover:bg-white/60'
              }`}
            >
              {tr('Дім і квартира B2C')} ({projects.filter((p) => p.seg === 'b2c').length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filtered.map((c) => (
              <article
                key={c.id}
                onClick={() => onSelectCase(c)}
                className="ec-glass-card rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="relative h-48 bg-[#07213e]">
                  <SmartImage src={c.img} alt={isRussian ? c.titleRu ?? c.title : c.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5 bg-gradient-to-t from-[#041830]/85 to-transparent text-[11px] font-bold text-white">
                    {isRussian ? c.tagRu ?? c.tag : c.tag}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#07213e] mb-1.5">{isRussian ? c.titleRu ?? c.title : c.title}</h3>
                    <p className="text-xs text-[#1c3d5e] font-medium leading-relaxed">{isRussian ? c.taskRu ?? c.task : c.task}</p>
                  </div>
                  <div className="pt-3 border-t border-sky-200/75 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="font-mono text-[#07213e] truncate">{isRussian ? c.specsRu ?? c.specs : c.specs}</span>
                    <span className="text-[#0b66b2] shrink-0">{tr('Деталі')} →</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
