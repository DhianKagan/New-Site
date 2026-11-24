import { useState } from 'react';
import type { ProjectCase } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';

interface ProjectsViewProps {
  projects: ProjectCase[];
  onBackHome: () => void;
  onSelectCase: (project: ProjectCase) => void;
}

export function ProjectsView({ projects, onBackHome, onSelectCase }: ProjectsViewProps) {
  const [seg, setSeg] = useState<'all' | 'b2b' | 'b2c'>('all');
  const filtered = projects.filter((p) => seg === 'all' || p.seg === seg);

  return (
    <div>
      <section className="bg-gradient-to-b from-[#f3f7fc] to-white border-b border-slate-200 py-8">
        <div className="max-w-[1180px] mx-auto px-5">
          <nav aria-label="Хлібні крихти" className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <a
              href="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onBackHome();
                }
              }}
              className="text-[#1769aa] font-bold hover:underline"
            >
              Головна
            </a>
            <span aria-hidden="true">/</span>
            <span>Реалізовані об’єкти</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
            Реалізовані проєкти СЕС та систем живлення в Одеській області
          </h1>
          <p className="text-sm text-[#52657a] max-w-2xl">
            Комерційні СЕС до 110 кВт та приватні системи резервного живлення для квартир і будинків.
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <h2 className="sr-only">Кейси встановлених сонячних електростанцій та систем резервного живлення</h2>
          <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg mb-7">
            <button
              type="button"
              onClick={() => setSeg('all')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                seg === 'all' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              Усі проєкти ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setSeg('b2b')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                seg === 'b2b' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              Бізнес B2B ({projects.filter((p) => p.seg === 'b2b').length})
            </button>
            <button
              type="button"
              onClick={() => setSeg('b2c')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                seg === 'b2c' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              Дім і квартира B2C ({projects.filter((p) => p.seg === 'b2c').length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filtered.map((c) => (
              <article
                key={c.id}
                onClick={() => onSelectCase(c)}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="relative h-52 bg-[#0d1f33]">
                  <SmartImage src={c.img} alt={c.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-[11px] font-bold text-white">
                    {c.tag}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">{c.title}</h3>
                    <p className="text-xs text-[#52657a] leading-relaxed">{c.task}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="font-mono text-[#0d1f33] truncate">{c.specs}</span>
                    <span className="text-[#1769aa] shrink-0">Деталі →</span>
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
