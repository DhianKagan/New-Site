import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, Download, Plus, Search } from 'lucide-react';
import type { Deal, DealStage, DealType } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';

interface DealsDataTableProps {
  deals: Deal[];
  stages: Array<{ id: DealStage; label: string; colorClass: string }>;
  dealQuery: string;
  onDealQueryChange: (val: string) => void;
  dealTypeFilter: 'all' | 'order' | 'lead';
  onDealTypeFilterChange: (val: 'all' | 'order' | 'lead') => void;
  onSelectDeal: (deal: Deal) => void;
  onExportCsv: () => void;
  onCreateDeal?: (type: DealType) => void;
}

const dealsTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
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
  dealQuery,
  onDealQueryChange,
  dealTypeFilter,
  onDealTypeFilterChange,
  onSelectDeal,
  onExportCsv,
  onCreateDeal,
}: DealsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('dealNumber', {
          header: () => <span>ID</span>,
          cell: (info) => <span className="font-mono font-bold text-[#0d1f33]">{info.getValue()}</span>,
        }),
        columnHelper.accessor('type', {
          header: () => <span>{tr('Тип')}</span>,
          cell: (info) =>
            info.getValue() === 'order' ? (
              <Badge variant="success">{tr('Кошик', 'Корзина')}</Badge>
            ) : (
              <Badge variant="info">{tr('Лід')}</Badge>
            ),
        }),
        columnHelper.accessor('customerName', {
          header: () => <span>{tr('Клієнт / Контакт')}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div>
                <div className="font-bold text-[#0d1f33]">{row.customerName}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  {row.phone} · {row.city}
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('topic', {
          header: () => <span>{tr('Задача або позиції')}</span>,
          cell: (info) => (
            <div className="text-slate-700 max-w-[260px] truncate" title={info.getValue()}>
              {info.getValue()}
            </div>
          ),
        }),
        columnHelper.accessor('stage', {
          header: () => <span>{tr('Етап')}</span>,
          cell: (info) => {
            const st = stageMap.get(info.getValue());
            return (
              <Badge variant="default" className={st?.colorClass}>
                {st ? tr(st.label) : info.getValue()}
              </Badge>
            );
          },
        }),
        columnHelper.accessor('totalUsd', {
          header: () => <span>{tr('Сума')}</span>,
          cell: (info) => (
            <span className="font-mono font-bold text-[#0d1f33] tabular-nums">
              {info.getValue() > 0 ? `$${info.getValue().toLocaleString('uk-UA')}` : '—'}
            </span>
          ),
        }),
        columnHelper.accessor('createdAt', {
          header: () => <span>{tr('Створено')}</span>,
          cell: (info) => (
            <span className="text-slate-500 whitespace-nowrap">
              {new Date(info.getValue()).toLocaleDateString('uk-UA')}
            </span>
          ),
        }),
      ]),
    [stageMap],
  );

  const table = useTable({
    features: dealsTableFeatures,
    data: deals,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="search"
              value={dealQuery}
              onChange={(e) => onDealQueryChange(e.target.value)}
              placeholder={tr('Пошук за номером, телефоном, клієнтом...')}
              className="pl-8 w-64"
              aria-label={tr('Пошук угод')}
            />
          </div>
          <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                ['all', tr('Усі')],
                ['order', tr('Замовлення із кошика')],
                ['lead', tr('Інженерні ліди')],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => onDealTypeFilterChange(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                  dealTypeFilter === t ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onCreateDeal && (
            <>
              <Button type="button" onClick={() => onCreateDeal('lead')} className="bg-[#1769aa] hover:bg-[#12568c] text-white">
                <Plus className="w-3.5 h-3.5" />
                {tr('Нова угода', 'Новая сделка')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onCreateDeal('order')}
                className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950"
              >
                <Plus className="w-3.5 h-3.5 text-amber-700" />
                {tr('Нове замовлення', 'Новый заказ')}
              </Button>
            </>
          )}
          <Button type="button" variant="outline" onClick={onExportCsv}>
            <Download className="w-3.5 h-3.5" />
            {tr('Завантажити CSV')}
          </Button>
        </div>
      </div>

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
                      className="inline-flex items-center gap-1 hover:text-[#0d1f33] cursor-pointer"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
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
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {deals.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            {tr('Угод за вибраним фільтром не знайдено')}
          </div>
        )}
      </Card>
    </div>
  );
}
