import { X, ArrowUpRight } from 'lucide-react';
import type { ProjectCase } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { getActiveLocale, tr } from '../lib/i18n.ts';

interface CaseModalProps {
  project: ProjectCase | null;
  onClose: () => void;
  onQuote: (project: ProjectCase) => void;
}

export function CaseModal({ project, onClose, onQuote }: CaseModalProps) {
  if (!project) return null;
  const isRussian = getActiveLocale() === 'ru';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-64 bg-[#0d1f33]">
          <SmartImage src={project.img} alt={isRussian ? project.titleRu ?? project.title : project.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end justify-between p-5">
            <div>
              <div className="text-xs font-semibold text-sky-200 mb-1">{isRussian ? project.tagRu ?? project.tag : project.tag}</div>
              <h3 id="case-modal-title" className="text-xl font-extrabold text-white">{isRussian ? project.titleRu ?? project.title : project.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Закрити', 'Закрыть')}
              className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 mb-1">Задача клієнта</div>
            <div className="text-sm text-[#0d1f33] leading-relaxed">{isRussian ? project.taskRu ?? project.task : project.task}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 mb-1">Інженерне рішення та обладнання</div>
            <div className="text-sm text-[#0d1f33] leading-relaxed">{isRussian ? project.solutionRu ?? project.solution : project.solution}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 mb-1">Технічні параметри</div>
            <div className="font-mono text-xs font-semibold text-[#1769aa]">{isRussian ? project.specsRu ?? project.specs : project.specs}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-[11px] font-bold text-[#169374] mb-1">Результат</div>
            <div className="text-sm text-[#0d1f33] leading-relaxed">{isRussian ? project.resultRu ?? project.result : project.result}</div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onQuote(project);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              {tr('Замовити схожий розрахунок', 'Заказать похожий расчёт')}
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-[#0d1f33] hover:bg-slate-50 cursor-pointer"
            >
              {tr('Закрити', 'Закрыть')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
