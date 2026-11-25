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
      <section className="bg-[#081421]/40 backdrop-blur-[1px] border-b border-white/15 py-8 text-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            {tr('Реалізовані проєкти СЕС та систем живлення в Одеській області', 'Реализованные солнечные электростанции и системы питания в Одесской области')}
          </h1>
          <p className="text-sm text-slate-200 max-w-2xl">
            {tr('Комерційні СЕС до 110 кВт та приватні системи резервного живлення для квартир і будинків.', 'Коммерческие солнечные электростанции до 110 кВт и системы резервного питания для квартир и домов.')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate py-12">
        <VideoBackground position="absolute" tone="light" start={28} end={44} />
        <div className="relative max-w-[1180px] mx-auto px-5">
          <h2 className="sr-only">{tr('Кейси встановлених сонячних електростанцій та систем резервного живлення', 'Примеры установленных солнечных электростанций и систем резервного питания')}</h2>
          <div className="inline-flex flex-wrap gap-1 p-1 bg-[#0d1f33]/85 backdrop-blur-md border border-white/20 rounded-lg mb-7 shadow-md">
            <button
              type="button"
              onClick={() => setSeg('all')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                seg === 'all' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-100 hover:text-white'
              }`}
            >
              {tr('Усі проєкти', 'Все проекты')} ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setSeg('b2b')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                seg === 'b2b' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-100 hover:text-white'
              }`}
            >
              {tr('Бізнес B2B')} ({projects.filter((p) => p.seg === 'b2b').length})
            </button>
            <button
              type="button"
              onClick={() => setSeg('b2c')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                seg === 'b2c' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-100 hover:text-white'
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
                className="bg-white/95 backdrop-blur-md border border-white/25 rounded-xl overflow-hidden flex flex-col cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="relative h-52 bg-[#0d1f33]">
                  <SmartImage src={c.img} alt={isRussian ? c.titleRu ?? c.title : c.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-[11px] font-bold text-white">
                    {isRussian ? c.tagRu ?? c.tag : c.tag}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">{isRussian ? c.titleRu ?? c.title : c.title}</h3>
                    <p className="text-xs text-[#334155] font-medium leading-relaxed">{isRussian ? c.taskRu ?? c.task : c.task}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="font-mono text-[#0d1f33] truncate">{isRussian ? c.specsRu ?? c.specs : c.specs}</span>
                    <span className="text-[#1769aa] shrink-0">{tr('Деталі')} →</span>
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
