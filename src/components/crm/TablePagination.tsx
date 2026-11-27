import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { tr } from '../../lib/i18n.ts';
import { Button } from '../ui/button.tsx';

export function SortDirectionIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') {
    return <ArrowUp className="w-3.5 h-3.5 text-[#1769aa] shrink-0" />;
  }
  if (sorted === 'desc') {
    return <ArrowDown className="w-3.5 h-3.5 text-[#1769aa] shrink-0" />;
  }
  return <ArrowUpDown className="w-3.5 h-3.5 opacity-45 shrink-0" />;
}

interface TablePaginationProps {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  totalRows: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function TablePagination({
  pageIndex,
  pageSize,
  pageCount,
  totalRows,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  onPageIndexChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100],
}: TablePaginationProps) {
  if (totalRows === 0) return null;

  const safePageCount = Math.max(1, pageCount);
  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min(totalRows, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 sm:px-4 py-3 border-t border-slate-200 bg-slate-50/80 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-3">
        <span className="tabular-nums">
          {tr('Показано', 'Показано')}{' '}
          <strong className="text-[#0d1f33]">
            {startRow}–{endRow}
          </strong>{' '}
          {tr('з', 'из')} <strong className="text-[#0d1f33]">{totalRows}</strong>
        </span>
        <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600">
          <span>{tr('На сторінці:', 'На странице:')}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label={tr('Рядків на сторінці', 'Строк на странице')}
            className="h-8 sm:h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs sm:text-sm font-bold text-[#0d1f33] focus:outline-none focus:border-[#1769aa]"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPreviousPage}
          onClick={onPreviousPage}
          aria-label={tr('Попередня сторінка', 'Предыдущая страница')}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{tr('Назад')}</span>
        </Button>

        <div className="inline-flex items-center gap-1.5 px-2.5 text-sm font-bold text-[#0d1f33] tabular-nums">
          <input
            type="number"
            min={1}
            max={safePageCount}
            value={pageIndex + 1}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (!Number.isNaN(parsed)) {
                const clamped = Math.max(1, Math.min(safePageCount, Math.trunc(parsed)));
                onPageIndexChange(clamped - 1);
              }
            }}
            aria-label={tr('Номер сторінки', 'Номер страницы')}
            className="w-12 h-8 sm:h-9 rounded-lg border border-slate-300 bg-white text-center text-xs sm:text-sm font-bold text-[#0d1f33]"
          />
          <span className="text-slate-500">/ {safePageCount}</span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canNextPage}
          onClick={onNextPage}
          aria-label={tr('Наступна сторінка', 'Следующая страница')}
        >
          <span className="hidden sm:inline">{tr('Далі', 'Далее')}</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
