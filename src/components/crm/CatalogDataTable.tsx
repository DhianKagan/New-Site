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
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { Check, Pencil, Plus, Search, X } from 'lucide-react';
import type { Product, ProductCategory } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { SmartImage } from '../SmartImage.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { SortDirectionIcon, TablePagination } from './TablePagination.tsx';

export type CatalogStockFilter = 'all' | 'in_stock' | 'on_order';

interface CatalogDataTableProps {
  products: Product[];
  catQuery: string;
  onCatQueryChange: (val: string) => void;
  catFilter: 'all' | ProductCategory;
  onCatFilterChange: (val: 'all' | ProductCategory) => void;
  stockFilter: CatalogStockFilter;
  onStockFilterChange: (val: CatalogStockFilter) => void;
  quickEditId: string | null;
  quickTitle: string;
  quickPrice: string;
  quickOldPrice: string;
  quickInStock: boolean;
  savingQuickId: string | null;
  onQuickTitleChange: (val: string) => void;
  onQuickPriceChange: (val: string) => void;
  onQuickOldPriceChange: (val: string) => void;
  onQuickInStockChange: (val: boolean) => void;
  onStartQuickEdit: (product: Product) => void;
  onCancelQuickEdit: () => void;
  onSaveQuickEdit: (product: Product) => void;
  onToggleStockQuick: (product: Product) => void;
  onOpenEditModal: (product: Product) => void;
  onOpenCreateModal: () => void;
}

const CAT_NAMES: Record<ProductCategory, string> = {
  kits: 'Готові рішення',
  inverters: 'Інвертори',
  batteries: 'Акумулятори',
  panels: 'Сонячні панелі',
  parts: 'Комплектуючі',
};

const catalogTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
});

const columnHelper = createColumnHelper<typeof catalogTableFeatures, Product>();

export function CatalogDataTable({
  products,
  catQuery,
  onCatQueryChange,
  catFilter,
  onCatFilterChange,
  stockFilter,
  onStockFilterChange,
  quickEditId,
  quickTitle,
  quickPrice,
  quickOldPrice,
  quickInStock,
  savingQuickId,
  onQuickTitleChange,
  onQuickPriceChange,
  onQuickOldPriceChange,
  onQuickInStockChange,
  onStartQuickEdit,
  onCancelQuickEdit,
  onSaveQuickEdit,
  onToggleStockQuick,
  onOpenEditModal,
  onOpenCreateModal,
}: CatalogDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [catQuery, catFilter, stockFilter]);

  const inStockCount = useMemo(() => products.filter((p) => p.inStock).length, [products]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('sku', {
          header: () => <span>{tr('Фото / SKU', 'Фото / SKU')}</span>,
          cell: (info) => {
            const p = info.row.original;
            return (
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onOpenEditModal(p)}
                  title={tr('Змінити фото та характеристики', 'Изменить фото и характеристики')}
                  className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center hover:border-[#1769aa] cursor-pointer"
                >
                  <SmartImage src={p.img} alt={p.title} className="w-full h-full object-contain" />
                </button>
                <span className="font-mono text-sm font-semibold text-slate-500">{p.sku || '—'}</span>
              </div>
            );
          },
        }),
        columnHelper.accessor('title', {
          header: () => <span>{tr('Товар та категорія', 'Товар и категория')}</span>,
          cell: (info) => {
            const p = info.row.original;
            const isQuick = quickEditId === p.id;
            if (isQuick) {
              return (
                <input
                  type="text"
                  value={quickTitle}
                  onChange={(e) => onQuickTitleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveQuickEdit(p);
                    if (e.key === 'Escape') onCancelQuickEdit();
                  }}
                  className="w-full min-w-[240px] h-10 px-3.5 rounded-lg border border-[#1769aa] text-[15px] font-semibold text-[#0d1f33] bg-white"
                />
              );
            }
            return (
              <div className="min-w-[240px] max-w-md">
                <button
                  type="button"
                  onClick={() => onOpenEditModal(p)}
                  className="font-semibold text-[15px] text-[#0d1f33] hover:text-[#1769aa] text-left line-clamp-2 cursor-pointer"
                >
                  {p.title}
                </button>
                <div className="text-sm text-slate-500 mt-0.5">
                  {CAT_NAMES[p.cat]}
                  {p.specs.length > 0 ? ` · ${p.specs.length} ${tr('хар-к', 'хар-к')}` : ''}
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('brand', {
          header: () => <span>{tr('Бренд')}</span>,
          cell: (info) => <span className="text-[15px] font-medium text-slate-700 whitespace-nowrap">{info.getValue()}</span>,
        }),
        columnHelper.accessor((row) => (row.inStock ? 1 : 0), {
          id: 'inStock',
          header: () => <span>{tr('Наявність', 'Наличие')}</span>,
          cell: (info) => {
            const p = info.row.original;
            const isQuick = quickEditId === p.id;
            const isBusy = savingQuickId === p.id;
            if (isQuick) {
              return (
                <label className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#0d1f33] cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={quickInStock}
                    onChange={(e) => onQuickInStockChange(e.target.checked)}
                    className="w-4.5 h-4.5 accent-[#1769aa]"
                  />
                  {tr('В наявності', 'В наличии')}
                </label>
              );
            }
            return (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onToggleStockQuick(p)}
                title={tr('Натисніть, щоб швидко перемкнути наявність', 'Нажмите, чтобы быстро изменить наличие')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                  p.inStock
                    ? 'bg-emerald-50 border-emerald-200 text-[#169374] hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {p.statusLabel || (p.inStock ? tr('В наявності', 'В наличии') : tr('Під замовлення', 'Под заказ'))}
              </button>
            );
          },
        }),
        columnHelper.accessor('price', {
          header: () => <span className="ml-auto">{tr('Ціна USD', 'Цена USD')}</span>,
          cell: (info) => {
            const p = info.row.original;
            const isQuick = quickEditId === p.id;
            if (isQuick) {
              return (
                <div className="inline-flex items-center justify-end gap-2">
                  <input
                    type="number"
                    min="0"
                    value={quickPrice}
                    onChange={(e) => onQuickPriceChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveQuickEdit(p);
                      if (e.key === 'Escape') onCancelQuickEdit();
                    }}
                    placeholder={tr('Ціна', 'Цена')}
                    className="w-26 h-10 px-3 rounded-lg border border-[#1769aa] text-right font-mono text-[15px] bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    value={quickOldPrice}
                    onChange={(e) => onQuickOldPriceChange(e.target.value)}
                    placeholder={tr('Стара', 'Старая')}
                    title={tr('Стара ціна (закреслена)', 'Старая цена (зачёркнута)')}
                    className="w-22 h-10 px-2.5 rounded-lg border border-slate-300 text-right font-mono text-sm text-slate-500 bg-white"
                  />
                </div>
              );
            }
            return (
              <div className="text-right font-mono tabular-nums whitespace-nowrap">
                <div className="text-[15px] font-bold text-[#0d1f33]">
                  {p.price > 0 ? `$${p.price.toLocaleString('uk-UA')}` : tr('За запитом', 'По запросу')}
                </div>
                {p.oldPrice > p.price && (
                  <div className="text-sm text-slate-400 line-through font-normal">
                    ${p.oldPrice.toLocaleString('uk-UA')}
                  </div>
                )}
              </div>
            );
          },
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="ml-auto">{tr('Дії', 'Действия')}</span>,
          cell: (info) => {
            const p = info.row.original;
            const isQuick = quickEditId === p.id;
            const isBusy = savingQuickId === p.id;
            if (isQuick) {
              return (
                <div className="inline-flex items-center justify-end gap-1.5 w-full">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onSaveQuickEdit(p)}
                    className="bg-[#169374] hover:bg-[#127a60] text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {tr('Ок', 'Ок')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCancelQuickEdit}
                    aria-label={tr('Скасувати', 'Отмена')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            }
            return (
              <div className="inline-flex items-center justify-end gap-1.5 w-full">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onStartQuickEdit(p)}
                >
                  {tr('Швидко', 'Быстро')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenEditModal(p)}
                  className="border-[#1769aa]/30 bg-sky-50/50 hover:bg-sky-50 text-[#1769aa]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {tr('Фото / Картка', 'Фото / Карточка')}
                </Button>
              </div>
            );
          },
        }),
      ]),
    [
      quickEditId,
      quickTitle,
      quickPrice,
      quickOldPrice,
      quickInStock,
      savingQuickId,
      onQuickTitleChange,
      onQuickPriceChange,
      onQuickOldPriceChange,
      onQuickInStockChange,
      onStartQuickEdit,
      onCancelQuickEdit,
      onSaveQuickEdit,
      onToggleStockQuick,
      onOpenEditModal,
    ],
  );

  const table = useTable({
    features: catalogTableFeatures,
    data: products,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="search"
              value={catQuery}
              onChange={(e) => onCatQueryChange(e.target.value)}
              placeholder={tr('Пошук товару, SKU або бренду...', 'Поиск товара, SKU или бренда...')}
              className="pl-10"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => onCatFilterChange(e.target.value as 'all' | ProductCategory)}
            className="h-11 px-3.5 rounded-lg border border-slate-300 text-[15px] bg-white font-semibold text-[#0d1f33]"
          >
            <option value="all">{tr('Усі категорії', 'Все категории')}</option>
            <option value="kits">{tr('Готові рішення')}</option>
            <option value="inverters">{tr('Інвертори')}</option>
            <option value="batteries">{tr('Акумулятори')}</option>
            <option value="panels">{tr('Сонячні панелі')}</option>
            <option value="parts">{tr('Комплектуючі')}</option>
          </select>
          <select
            value={stockFilter}
            onChange={(e) => onStockFilterChange(e.target.value as CatalogStockFilter)}
            className="h-11 px-3.5 rounded-lg border border-slate-300 text-[15px] bg-white font-semibold text-[#0d1f33]"
          >
            <option value="all">{tr('Будь-яка наявність', 'Любое наличие')}</option>
            <option value="in_stock">{tr('В наявності', 'В наличии')}</option>
            <option value="on_order">{tr('Під замовлення', 'Под заказ')}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm font-semibold text-slate-500 tabular-nums hidden sm:block">
            {tr('Позицій:', 'Позиций:')} <strong className="text-[#0d1f33]">{products.length}</strong> ·{' '}
            {tr('В наявності:', 'В наличии:')} <strong className="text-[#169374]">{inStockCount}</strong>
          </div>
          <Button type="button" onClick={onOpenCreateModal}>
            <Plus className="w-4 h-4" />
            {tr('Додати товар', 'Добавить товар')}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead key={header.id}>
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 font-bold hover:text-[#1769aa] cursor-pointer w-full"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortDirectionIcon sorted={header.column.getIsSorted()} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-[15px] text-slate-500">
                  {tr('За вашим запитом товарів не знайдено', 'По вашему запросу товаров не найдено')}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

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
