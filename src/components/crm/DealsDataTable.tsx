import { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { Download, LayoutDashboard, Plus, Search, Table2, UserCheck } from 'lucide-react';
import type { Deal, DealStage, DealType } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { SortDirectionIcon, TablePagination } from './TablePagination.tsx';

interface DealsDataTableProps {
  deals: Deal[];
  stages: Array<{ id: DealStage; label: string; colorClass: string }>;
  assignees?: string[];
  dealQuery: string;
  onDealQueryChange: (val: string) => void;
  dealTypeFilter: 'all' | 'order' | 'lead';
  onDealTypeFilterChange: (val: 'all' | 'order' | 'lead') => void;
  onSelectDeal: (deal: Deal) => void;
  onExportCsv: () => void;
  onCreateDeal?: (type: DealType) => void;
  onSwitchToKanban?: () => void;
}

const dealsTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
});

const columnHelper = createColumnHelper<typeof dealsTableFeatures, Deal>();

export function DealsDataTable({
  deals,
  stages,
  assignees = [],
  dealQuery,
  onDealQueryChange,
  dealTypeFilter,
  onDealTypeFilterChange,
  onSelectDeal,
  onExportCsv,
  onCreateDeal,
  onSwitchToKanban,
}: DealsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [stageFilter, setStageFilter] = useState<'all' | DealStage>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const assigneeOptions = useMemo(() => {
    const set = new Set(assignees.filter(Boolean));
    for (const d of deals) {
      if (d.assignee) set.add(d.assignee);
    }
    return Array.from(set);
  }, [assignees, deals]);

  const tableDeals = useMemo(() => {
    return deals.filter((d) => {
      if (stageFilter !== 'all' && d.stage !== stageFilter) return false;
      if (assigneeFilter !== 'all' && d.assignee !== assigneeFilter) return false;
      return true;
    });
  }, [deals, stageFilter, assigneeFilter]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [dealQuery, dealTypeFilter, stageFilter, assigneeFilter]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('dealNumber', {
          header: () => <span>ID / {tr('Тип')}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="space-y-1 whitespace-nowrap">
                <div className="font-mono text-sm font-bold text-[#0d1f33]">{row.dealNumber}</div>
                {row.type === 'order' ? (
                  <Badge variant="success">{tr('Кошик', 'Корзина')}</Badge>
                ) : (
                  <Badge variant="info">{tr('Лід')}</Badge>
                )}
              </div>
            );
          },
        }),
        columnHelper.accessor('customerName', {
          header: () => <span>{tr('Клієнт / Контакт')}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="min-w-[130px]">
                <div className="font-bold text-[#0d1f33] text-sm leading-snug">{row.customerName}</div>
                <div className="font-mono text-xs text-slate-500 mt-0.5 break-words">
                  {row.phone}
                  {row.city ? ` · ${row.city}` : ''}
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('topic', {
          header: () => <span>{tr('Задача або позиції')}</span>,
          cell: (info) => (
            <div className="text-slate-700 text-sm min-w-[140px] max-w-[300px] whitespace-normal line-clamp-2" title={info.getValue()}>
              {info.getValue()}
            </div>
          ),
        }),
        columnHelper.accessor('stage', {
          header: () => <span>{tr('Етап / Виконавець', 'Этап / Исполнитель')}</span>,
          cell: (info) => {
            const row = info.row.original;
            const st = stageMap.get(info.getValue());
            return (
              <div className="space-y-1">
                <Badge variant="default" className={st?.colorClass}>
                  {st ? tr(st.label) : info.getValue()}
                </Badge>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[140px]">{row.assignee || '—'}</span>
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('totalUsd', {
          header: () => <span className="ml-auto">{tr('Сума / Дата', 'Сумма / Дата')}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="text-right whitespace-nowrap">
                <div className="font-mono text-sm font-bold text-[#0d1f33] tabular-nums">
                  {info.getValue() > 0 ? `$${info.getValue().toLocaleString('uk-UA')}` : '—'}
                </div>
                <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                  {new Date(row.createdAt).toLocaleDateString('uk-UA')}
                </div>
              </div>
            );
          },
        }),
      ]),
    [stageMap],
  );

  const table = useTable({
    features: dealsTableFeatures,
    data: tableDeals,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const totalUsdFiltered = useMemo(
    () => tableDeals.reduce((sum, d) => sum + (d.totalUsd || 0), 0),
    [tableDeals],
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="search"
                value={dealQuery}
                onChange={(e) => onDealQueryChange(e.target.value)}
                placeholder={tr('Пошук за номером, телефоном, клієнтом...')}
                className="pl-9 w-full"
                aria-label={tr('Пошук угод')}
              />
            </div>

            <div className="inline-flex flex-wrap p-1 bg-slate-100 border border-slate-200 rounded-lg">
              {(
                [
                  ['all', tr('Усі')],
                  ['order', tr('Кошик', 'Корзина')],
                  ['lead', tr('Ліди', 'Лиды')],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onDealTypeFilterChange(t)}
                  className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                    dealTypeFilter === t ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as 'all' | DealStage)}
              aria-label={tr('Фільтр за етапом', 'Фильтр по этапу')}
              className="h-9 sm:h-10 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#0d1f33]"
            >
              <option value="all">{tr('Усі етапи', 'Все этапы')}</option>
              {stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {tr(st.label)}
                </option>
              ))}
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              aria-label={tr('Фільтр за відповідальним', 'Фильтр по ответственному')}
              className="h-9 sm:h-10 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#0d1f33]"
            >
              <option value="all">{tr('Усі відповідальні', 'Все ответственные')}</option>
              {assigneeOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSwitchToKanban && (
              <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={onSwitchToKanban}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs sm:text-sm font-bold text-slate-600 hover:text-[#0d1f33] cursor-pointer transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  {tr('Канбан', 'Канбан')}
                </button>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs sm:text-sm font-bold bg-white text-[#0d1f33] shadow-2xs">
                  <Table2 className="w-3.5 h-3.5 text-[#1769aa]" />
                  {tr('Список', 'Список')}
                </span>
              </div>
            )}
            {onCreateDeal && (
              <>
                <Button type="button" variant="primary" size="sm" onClick={() => onCreateDeal('lead')}>
                  <Plus className="w-4 h-4" />
                  {tr('Нова угода', 'Новая сделка')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateDeal('order')}
                  className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950"
                >
                  <Plus className="w-4 h-4 text-amber-700" />
                  {tr('Нове замовлення', 'Новый заказ')}
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="w-4 h-4" />
              {tr('CSV', 'CSV')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs sm:text-sm text-slate-600">
          <span>
            {tr('Вибірка:', 'Выборка:')}{' '}
            <strong className="text-[#0d1f33] tabular-nums">{tableDeals.length}</strong>{' '}
            {tr('угод', 'сделок')}
          </span>
          <span className="font-mono tabular-nums">
            {tr('Сума вибірки:', 'Сумма выборки:')}{' '}
            <strong className="text-[#169374]">${totalUsdFiltered.toLocaleString('uk-UA')}</strong>
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1.5 hover:text-[#0d1f33] cursor-pointer"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortDirectionIcon sorted={header.column.getIsSorted()} />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} onClick={() => onSelectDeal(row.original)} className="cursor-pointer">
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {tableDeals.length === 0 && (
          <div className="p-12 text-center text-[15px] text-slate-400">
            {tr('Угод за вибраним фільтром не знайдено')}
          </div>
        )}
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          pageCount={table.getPageCount()}
          totalRows={table.getRowCount()}
          canPreviousPage={table.getCanPreviousPage()}
          canNextPage={table.getCanNextPage()}
          onPreviousPage={() => table.previousPage()}
          onNextPage={() => table.nextPage()}
          onPageIndexChange={(idx) => table.setPageIndex(idx)}
          onPageSizeChange={(size) => table.setPageSize(size)}
          pageSizeOptions={[15, 25, 50, 100]}
        />
      </Card>
    </div>
  );
}
