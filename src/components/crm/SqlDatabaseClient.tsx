import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronTree,
  Code2,
  Database,
  Download,
  FileJson,
  Filter,
  History,
  KeyRound,
  Link2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import type {
  DbColumnMeta,
  DbOverviewResponse,
  DbQueryResponse,
  DbRowsResponse,
  DbTableMeta,
} from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';

interface SqlDatabaseClientProps {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onDataMutated?: () => Promise<void>;
}

type SqlSubMode = 'browser' | 'console';

interface QueryHistoryItem {
  id: string;
  sql: string;
  durationMs: number;
  rowCount: number;
  command: string;
  ok: boolean;
  ranAt: string;
}

const SQL_TEMPLATES: Array<{ label: string; sql: string }> = [
  {
    label: 'Останні 20 угод',
    sql: 'SELECT id, deal_number, type, stage, customer_name, phone, total_usd, assignee, created_at\nFROM deals\nORDER BY id DESC\nLIMIT 20;',
  },
  {
    label: 'Статистика каталогу за категоріями',
    sql: 'SELECT cat, COUNT(*) AS total, SUM(CASE WHEN in_stock = 1 THEN 1 ELSE 0 END) AS in_stock_cnt, MIN(price) AS min_usd, MAX(price) AS max_usd\nFROM products\nGROUP BY cat\nORDER BY total DESC;',
  },
  {
    label: 'Товари з нульовою ціною',
    sql: 'SELECT id, sku, title, brand, cat, price\nFROM products\nWHERE price <= 0\nORDER BY title ASC;',
  },
  {
    label: 'Активні задачі команди',
    sql: 'SELECT t.id, t.title, t.status, t.priority, t.assignee, t.due_date, d.deal_number\nFROM tasks t\nLEFT JOIN deals d ON d.id = t.deal_id\nWHERE t.status != \'done\'\nORDER BY t.id DESC;',
  },
  {
    label: 'Налаштування сайту (settings)',
    sql: 'SELECT key, value, updated_at\nFROM settings\nWHERE key != \'admin_password_hash\'\nORDER BY key ASC;',
  },
  {
    label: 'Розміри таблиць PostgreSQL',
    sql: "SELECT relname AS table_name, n_live_tup AS est_rows, pg_size_pretty(pg_total_relation_size(relid)) AS total_size\nFROM pg_stat_user_tables\nORDER BY pg_total_relation_size(relid) DESC;",
  },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function formatCellPreview(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isJsonLikeColumn(col: DbColumnMeta): boolean {
  return col.name.endsWith('_json') || col.udtName === 'json' || col.udtName === 'jsonb';
}

function isLongTextColumn(col: DbColumnMeta): boolean {
  return (
    isJsonLikeColumn(col) ||
    ['description', 'notes', 'body', 'task', 'solution', 'result', 'stack', 'component_stack', 'value'].includes(
      col.name,
    )
  );
}

function buildPkKey(row: Record<string, unknown>, pkCols: string[]): string {
  return JSON.stringify(pkCols.map((c) => row[c]));
}

function extractPkObject(row: Record<string, unknown>, pkCols: string[]): Record<string, unknown> {
  const pk: Record<string, unknown> = {};
  for (const c of pkCols) pk[c] = row[c];
  return pk;
}

export function SqlDatabaseClient({ authFetch, onDataMutated }: SqlDatabaseClientProps) {
  const [overview, setOverview] = useState<DbOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewErr, setOverviewErr] = useState('');

  const [tableSearch, setTableSearch] = useState('');
  const [expandedSchemaTable, setExpandedSchemaTable] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('deals');
  const [subMode, setSubMode] = useState<SqlSubMode>('browser');

  // Table Browser state
  const [rowsData, setRowsData] = useState<DbRowsResponse | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsErr, setRowsErr] = useState('');
  const [rowsMsg, setRowsMsg] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filterCol, setFilterCol] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  // Row Modal (Create / Edit)
  const [rowModalMode, setRowModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingRowPk, setEditingRowPk] = useState<Record<string, unknown> | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>({});
  const [savingRow, setSavingRow] = useState(false);
  const [rowModalErr, setRowModalErr] = useState('');

  // SQL Console state
  const [sqlText, setSqlText] = useState(SQL_TEMPLATES[0].sql);
  const [allowWrite, setAllowWrite] = useState(false);
  const [runningQuery, setRunningQuery] = useState(false);
  const [queryErr, setQueryErr] = useState('');
  const [queryResult, setQueryResult] = useState<DbQueryResponse | null>(null);
  const [resultViewMode, setResultViewMode] = useState<'table' | 'json'>('table');
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewErr('');
    try {
      const resp = await authFetch('/api/crm/data/db/overview');
      const data = (await resp.json()) as DbOverviewResponse & { error?: string };
      if (!resp.ok) {
        setOverviewErr(data.error || 'Не вдалося завантажити структуру БД');
        return;
      }
      setOverview(data);
      if (data.tables.length > 0 && !data.tables.some((t) => t.name === selectedTable)) {
        setSelectedTable(data.tables[0].name);
      }
    } catch {
      setOverviewErr('Помилка з’єднання під час завантаження схеми БД');
    } finally {
      setLoadingOverview(false);
    }
  }, [authFetch, selectedTable]);

  const loadTableRows = useCallback(async () => {
    if (!selectedTable) return;
    setLoadingRows(true);
    setRowsErr('');
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortDir,
      });
      if (sortBy) qs.set('sortBy', sortBy);
      if (appliedSearch) qs.set('search', appliedSearch);
      if (filterCol && filterVal) {
        qs.set('filterCol', filterCol);
        qs.set('filterVal', filterVal);
      }
      const resp = await authFetch(
        `/api/crm/data/db/tables/${encodeURIComponent(selectedTable)}/rows?${qs.toString()}`,
      );
      const data = (await resp.json()) as DbRowsResponse & { error?: string };
      if (!resp.ok) {
        setRowsErr(data.error || 'Не вдалося завантажити рядки таблиці');
        return;
      }
      setRowsData(data);
      setSelectedRowKeys(new Set());
    } catch {
      setRowsErr('Помилка з’єднання при читанні таблиці');
    } finally {
      setLoadingRows(false);
    }
  }, [authFetch, selectedTable, page, limit, sortBy, sortDir, appliedSearch, filterCol, filterVal]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (subMode === 'browser' && selectedTable) {
      void loadTableRows();
    }
  }, [subMode, selectedTable, loadTableRows]);

  const activeTableMeta: DbTableMeta | null = useMemo(() => {
    if (!overview) return null;
    return overview.tables.find((t) => t.name === selectedTable) ?? null;
  }, [overview, selectedTable]);

  const filteredTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!overview) return [];
    if (!q) return overview.tables;
    return overview.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [overview, tableSearch]);

  const totalRowsAcrossTables = useMemo(
    () => (overview?.tables ?? []).reduce((s, t) => s + t.rowCount, 0),
    [overview],
  );

  function selectTable(name: string) {
    setSelectedTable(name);
    setPage(1);
    setSortBy('');
    setSortDir('desc');
    setSearchInput('');
    setAppliedSearch('');
    setFilterCol('');
    setFilterVal('');
    setRowsMsg('');
    setRowsErr('');
  }

  function toggleSort(colName: string) {
    if (sortBy === colName) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(colName);
      setSortDir('asc');
    }
    setPage(1);
  }

  function openCreateModal() {
    if (!rowsData) return;
    const initialVals: Record<string, string> = {};
    const initialNulls: Record<string, boolean> = {};
    const nowIso = new Date().toISOString();
    for (const col of rowsData.columns) {
      if (col.isAutoGenerated) {
        initialVals[col.name] = '';
        initialNulls[col.name] = false;
      } else if (col.name === 'created_at' || col.name === 'updated_at') {
        initialVals[col.name] = nowIso;
        initialNulls[col.name] = false;
      } else if (col.nullable) {
        initialVals[col.name] = '';
        initialNulls[col.name] = true;
      } else if (isJsonLikeColumn(col)) {
        initialVals[col.name] = col.defaultValue?.includes('{}') ? '{}' : '[]';
        initialNulls[col.name] = false;
      } else {
        initialVals[col.name] = '';
        initialNulls[col.name] = false;
      }
    }
    setFormValues(initialVals);
    setNullFlags(initialNulls);
    setEditingRowPk(null);
    setRowModalErr('');
    setRowModalMode('create');
  }

  function openEditModal(row: Record<string, unknown>) {
    if (!rowsData) return;
    const initialVals: Record<string, string> = {};
    const initialNulls: Record<string, boolean> = {};
    for (const col of rowsData.columns) {
      const val = row[col.name];
      if (val === null || val === undefined) {
        initialVals[col.name] = '';
        initialNulls[col.name] = true;
      } else if (typeof val === 'object') {
        initialVals[col.name] = JSON.stringify(val, null, 2);
        initialNulls[col.name] = false;
      } else if (isJsonLikeColumn(col) && typeof val === 'string') {
        try {
          initialVals[col.name] = JSON.stringify(JSON.parse(val), null, 2);
        } catch {
          initialVals[col.name] = val;
        }
        initialNulls[col.name] = false;
      } else {
        initialVals[col.name] = String(val);
        initialNulls[col.name] = false;
      }
    }
    setFormValues(initialVals);
    setNullFlags(initialNulls);
    setEditingRowPk(extractPkObject(row, rowsData.primaryKey));
    setRowModalErr('');
    setRowModalMode('edit');
  }

  async function handleSaveRowModal(e: FormEvent) {
    e.preventDefault();
    if (!rowsData) return;
    setSavingRow(true);
    setRowModalErr('');
    try {
      const payload: Record<string, unknown> = {};
      for (const col of rowsData.columns) {
        if (rowModalMode === 'create' && col.isAutoGenerated && !formValues[col.name]?.trim()) {
          continue;
        }
        if (rowModalMode === 'edit' && rowsData.primaryKey.includes(col.name)) {
          continue;
        }
        if (nullFlags[col.name]) {
          payload[col.name] = null;
        } else {
          let valToSave = formValues[col.name] ?? '';
          if (isJsonLikeColumn(col) && valToSave.trim()) {
            // Validate & compact JSON before storing in text/json columns
            const parsed = JSON.parse(valToSave);
            valToSave = JSON.stringify(parsed);
          }
          payload[col.name] = valToSave;
        }
      }

      const url = `/api/crm/data/db/tables/${encodeURIComponent(rowsData.table)}/rows`;
      const resp = await authFetch(url, {
        method: rowModalMode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          rowModalMode === 'create'
            ? { values: payload }
            : { pk: editingRowPk, updates: payload },
        ),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setRowModalErr(data.error || 'Не вдалося зберегти запис');
        return;
      }
      setRowModalMode(null);
      setRowsMsg(
        rowModalMode === 'create'
          ? tr(`Додано новий рядок у таблицю ${rowsData.table}`, `Добавлена новая строка в таблицу ${rowsData.table}`)
          : tr(`Рядок у таблиці ${rowsData.table} оновлено`, `Строка в таблице ${rowsData.table} обновлена`),
      );
      await Promise.all([loadTableRows(), loadOverview()]);
      if (onDataMutated) await onDataMutated();
    } catch (err) {
      setRowModalErr(err instanceof Error ? err.message : 'Помилка збереження рядка');
    } finally {
      setSavingRow(false);
    }
  }

  async function handleDeleteRows(pks: Array<Record<string, unknown>>) {
    if (!rowsData || pks.length === 0) return;
    setRowsErr('');
    setRowsMsg('');
    try {
      const resp = await authFetch(
        `/api/crm/data/db/tables/${encodeURIComponent(rowsData.table)}/rows`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pks }),
        },
      );
      const data = (await resp.json()) as { deleted?: number; error?: string };
      if (!resp.ok) {
        setRowsErr(data.error || 'Не вдалося видалити рядки');
        return;
      }
      setRowsMsg(tr(`Видалено рядків: ${data.deleted ?? pks.length}`, `Удалено строк: ${data.deleted ?? pks.length}`));
      await Promise.all([loadTableRows(), loadOverview()]);
      if (onDataMutated) await onDataMutated();
    } catch {
      setRowsErr('Помилка з’єднання при видаленні рядків');
    }
  }

  async function handleExportTable(format: 'csv' | 'json') {
    if (!selectedTable) return;
    try {
      const resp = await authFetch(
        `/api/crm/data/db/export?table=${encodeURIComponent(selectedTable)}&format=${format}`,
      );
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setRowsErr('Не вдалося експортувати таблицю');
    }
  }

  async function handleRunSql(customSql?: string) {
    const sqlToRun = (customSql ?? sqlText).trim();
    if (!sqlToRun) return;
    setRunningQuery(true);
    setQueryErr('');
    try {
      const resp = await authFetch('/api/crm/data/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlToRun, allowWrite }),
      });
      const data = (await resp.json()) as DbQueryResponse & { error?: string };
      if (!resp.ok) {
        setQueryErr(data.error || 'Помилка виконання SQL-запиту');
        setQueryHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            sql: sqlToRun,
            durationMs: 0,
            rowCount: 0,
            command: 'ERROR',
            ok: false,
            ranAt: new Date().toLocaleTimeString('uk-UA'),
          },
          ...prev.slice(0, 14),
        ]);
        return;
      }
      setQueryResult(data);
      setQueryHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          sql: sqlToRun,
          durationMs: data.durationMs,
          rowCount: data.rowCount,
          command: data.command,
          ok: true,
          ranAt: new Date().toLocaleTimeString('uk-UA'),
        },
        ...prev.slice(0, 14),
      ]);
      if (allowWrite && ['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'CREATE', 'DROP'].includes(data.command)) {
        await loadOverview();
        if (onDataMutated) await onDataMutated();
      }
    } catch {
      setQueryErr('Помилка з’єднання із сервером при виконанні SQL');
    } finally {
      setRunningQuery(false);
    }
  }

  function exportQueryResult(format: 'csv' | 'json') {
    if (!queryResult) return;
    let content = '';
    let mime = 'application/json; charset=utf-8';
    if (format === 'json') {
      content = JSON.stringify(queryResult.rows, null, 2);
    } else {
      mime = 'text/csv; charset=utf-8';
      const cols = queryResult.columns;
      const head = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
      const body = queryResult.rows.map((r) =>
        cols
          .map((c) => `"${formatCellPreview(r[c]).replace(/"/g, '""')}"`)
          .join(','),
      );
      content = `\uFEFF${[head, ...body].join('\n')}`;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql-result-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = rowsData ? Math.max(1, Math.ceil(rowsData.total / rowsData.limit)) : 1;

  return (
    <div className="space-y-4">
      {/* Database Connection & KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Database className="w-5 h-5 text-[#1769aa]" />
              <h2 className="text-lg font-extrabold text-[#0d1f33]">
                {tr('SQL-клієнт бази даних', 'SQL-клиент базы данных')}
              </h2>
              {overview && (
                <Badge variant={overview.mode === 'postgresql' ? 'success' : 'warning'}>
                  {overview.mode === 'postgresql' ? 'PostgreSQL Live' : 'Preview In-Memory'}
                </Badge>
              )}
            </div>
            {overview && (
              <p className="text-sm text-[#52657a]">
                <span className="font-mono font-bold text-[#0d1f33]">{overview.databaseName}</span> · {overview.hostLabel} ·{' '}
                {overview.version}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setSubMode('browser')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-bold transition-colors cursor-pointer ${
                  subMode === 'browser' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
                }`}
              >
                <Table2 className="w-4 h-4 text-[#1769aa]" />
                {tr('Таблиці та редактор', 'Таблицы и редактор')}
              </button>
              <button
                type="button"
                onClick={() => setSubMode('console')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-bold transition-colors cursor-pointer ${
                  subMode === 'console' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
                }`}
              >
                <Code2 className="w-4 h-4 text-[#169374]" />
                {tr('SQL-консоль', 'SQL-консоль')}
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadOverview();
                if (subMode === 'browser') void loadTableRows();
              }}
              disabled={loadingOverview || loadingRows}
            >
              <RefreshCw className={`w-4 h-4 ${loadingOverview || loadingRows ? 'animate-spin' : ''}`} />
              {tr('Оновити', 'Обновить')}
            </Button>
          </div>
        </div>

        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-sm font-bold text-slate-500">{tr('Таблиць у схемі')}</div>
              <div className="font-mono text-lg font-extrabold text-[#0d1f33] mt-1 tabular-nums">{overview.tables.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-sm font-bold text-slate-500">{tr('Загалом записів')}</div>
              <div className="font-mono text-lg font-extrabold text-[#1769aa] mt-1 tabular-nums">
                {totalRowsAcrossTables.toLocaleString('uk-UA')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-sm font-bold text-slate-500">{tr('Розмір БД')}</div>
              <div className="font-mono text-lg font-extrabold text-[#169374] mt-1 tabular-nums">{formatBytes(overview.sizeBytes)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-sm font-bold text-slate-500">{tr('Активні сесії PG')}</div>
              <div className="font-mono text-lg font-extrabold text-[#0d1f33] mt-1 tabular-nums">{overview.activeConnections}</div>
            </div>
          </div>
        )}

        {overviewErr && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
            {overviewErr}
          </div>
        )}
      </div>

      {/* Main Two-Column Workbench */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Left Schema Explorer */}
        <aside className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder={tr('Пошук таблиці або колонки...', 'Поиск таблицы или колонки...')}
              className="pl-9 h-10 text-sm"
            />
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-0.5">
            {filteredTables.map((t) => {
              const isSelected = selectedTable === t.name;
              const isExpanded = expandedSchemaTable === t.name;
              return (
                <div key={t.name} className="rounded-lg border border-transparent">
                  <div
                    className={`flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'bg-[#0d1f33] text-white'
                        : 'hover:bg-slate-100 text-[#0d1f33]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSchemaTable(isExpanded ? null : t.name)}
                      className="p-0.5 rounded hover:bg-white/10 cursor-pointer shrink-0"
                      aria-label={tr('Показати колонки')}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronTree className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (subMode === 'console') {
                          setSqlText(`SELECT * FROM ${t.name} LIMIT 50;`);
                          setSelectedTable(t.name);
                        } else {
                          selectTable(t.name);
                        }
                      }}
                      className="flex-1 text-left font-mono font-bold truncate cursor-pointer"
                      title={t.name}
                    >
                      {t.name}
                    </button>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded tabular-nums shrink-0 ${
                        isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.rowCount}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="ml-4 pl-2.5 border-l border-slate-200 py-1.5 space-y-0.5">
                      {t.columns.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            if (subMode === 'console') {
                              setSqlText((prev) => `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${c.name}`);
                            }
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-50 text-xs text-left cursor-pointer"
                          title={`${c.name} (${c.dataType})${c.foreignKey ? ` → ${c.foreignKey.table}.${c.foreignKey.column}` : ''}`}
                        >
                          <span className="inline-flex items-center gap-1 min-w-0 truncate font-mono text-slate-700">
                            {c.isPrimaryKey && <KeyRound className="w-3 h-3 text-amber-500 shrink-0" />}
                            {c.foreignKey && <Link2 className="w-3 h-3 text-[#1769aa] shrink-0" />}
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 shrink-0">{c.udtName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Workspace: Table Data Browser OR SQL Console */}
        <div className="min-w-0 space-y-4">
          {subMode === 'browser' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              {/* Table Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-mono text-base font-extrabold text-[#0d1f33]">{selectedTable}</h3>
                    {activeTableMeta && (
                      <span className="font-mono text-sm text-slate-500">
                        {formatBytes(activeTableMeta.totalBytes)} · PK: {activeTableMeta.primaryKey.join(', ') || '—'}
                      </span>
                    )}
                    {rowsData && (
                      <span className="font-mono text-sm text-[#169374]">
                        {rowsData.executionMs} ms
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedRowKeys.size > 0 && rowsData?.writable && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const pks = rowsData.rows
                          .filter((r) => selectedRowKeys.has(buildPkKey(r, rowsData.primaryKey)))
                          .map((r) => extractPkObject(r, rowsData.primaryKey));
                        void handleDeleteRows(pks);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      {tr(`Видалити (${selectedRowKeys.size})`, `Удалить (${selectedRowKeys.size})`)}
                    </Button>
                  )}

                  {rowsData?.writable && (
                    <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
                      <Plus className="w-4 h-4" />
                      {tr('Додати рядок', 'Добавить строку')}
                    </Button>
                  )}

                  <Button type="button" variant="outline" size="sm" onClick={() => void handleExportTable('csv')}>
                    <Download className="w-4 h-4" />
                    CSV
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleExportTable('json')}>
                    <FileJson className="w-4 h-4" />
                    JSON
                  </Button>
                </div>
              </div>

              {/* Search + Column Filter Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedSearch(searchInput.trim());
                  setPage(1);
                }}
                className="flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5"
              >
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={tr('Пошук по всіх колонках...', 'Поиск по всем колонкам...')}
                    className="pl-9 h-10 text-sm bg-white"
                  />
                </div>

                <div className="inline-flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={filterCol}
                    onChange={(e) => {
                      setFilterCol(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-[#0d1f33]"
                  >
                    <option value="">{tr('Колонка фільтра', 'Колонка фильтра')}</option>
                    {(rowsData?.columns ?? activeTableMeta?.columns ?? []).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {filterCol && (
                    <Input
                      value={filterVal}
                      onChange={(e) => {
                        setFilterVal(e.target.value);
                        setPage(1);
                      }}
                      placeholder={tr('Значення...', 'Значение...')}
                      className="w-44 h-10 text-sm bg-white"
                    />
                  )}
                </div>

                <Button type="submit" variant="default" size="sm">
                  {tr('Застосувати', 'Применить')}
                </Button>

                {(appliedSearch || filterCol || filterVal) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchInput('');
                      setAppliedSearch('');
                      setFilterCol('');
                      setFilterVal('');
                      setPage(1);
                    }}
                  >
                    <X className="w-4 h-4" />
                    {tr('Скинути', 'Сбросить')}
                  </Button>
                )}
              </form>

              {rowsErr && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
                  {rowsErr}
                </div>
              )}
              {rowsMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm font-semibold text-[#169374]">
                  {rowsMsg}
                </div>
              )}

              {/* Data Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[560px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        {rowsData?.writable && (
                          <TableHead className="w-10 px-3">
                            <input
                              type="checkbox"
                              checked={
                                Boolean(rowsData.rows.length) &&
                                rowsData.rows.every((r) => selectedRowKeys.has(buildPkKey(r, rowsData.primaryKey)))
                              }
                              onChange={(e) => {
                                if (!rowsData) return;
                                if (e.target.checked) {
                                  setSelectedRowKeys(
                                    new Set(rowsData.rows.map((r) => buildPkKey(r, rowsData.primaryKey))),
                                  );
                                } else {
                                  setSelectedRowKeys(new Set());
                                }
                              }}
                              className="w-4 h-4 accent-[#1769aa]"
                              aria-label={tr('Вибрати всі рядки')}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-24 text-right">{tr('Дії', 'Действия')}</TableHead>
                        {(rowsData?.columns ?? []).map((col) => (
                          <TableHead key={col.name} className="whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort(col.name)}
                              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#0d1f33] hover:text-[#1769aa] cursor-pointer"
                            >
                              {col.isPrimaryKey && <KeyRound className="w-3.5 h-3.5 text-amber-500" />}
                              <span>{col.name}</span>
                              {sortBy === col.name &&
                                (sortDir === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-[#1769aa]" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-[#1769aa]" />
                                ))}
                            </button>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingRows ? (
                        <TableRow>
                          <TableCell
                            colSpan={(rowsData?.columns.length ?? 4) + 2}
                            className="py-10 text-center text-sm text-slate-400"
                          >
                            {tr('Завантаження рядків...', 'Загрузка строк...')}
                          </TableCell>
                        </TableRow>
                      ) : !rowsData || rowsData.rows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={(rowsData?.columns.length ?? 4) + 2}
                            className="py-10 text-center text-sm text-slate-400"
                          >
                            {tr('Записів не знайдено', 'Записи не найдены')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        rowsData.rows.map((row, idx) => {
                          const pkKey =
                            rowsData.primaryKey.length > 0
                              ? buildPkKey(row, rowsData.primaryKey)
                              : String(idx);
                          const isChecked = selectedRowKeys.has(pkKey);
                          return (
                            <TableRow key={pkKey} className={isChecked ? 'bg-sky-50/70' : undefined}>
                              {rowsData.writable && (
                                <TableCell className="px-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setSelectedRowKeys((prev) => {
                                        const next = new Set(prev);
                                        if (e.target.checked) next.add(pkKey);
                                        else next.delete(pkKey);
                                        return next;
                                      });
                                    }}
                                    className="w-4 h-4 accent-[#1769aa]"
                                  />
                                </TableCell>
                              )}
                              <TableCell className="whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(row)}
                                    title={rowsData.writable ? tr('Редагувати') : tr('Перегляд')}
                                    className="p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[#1769aa] cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  {rowsData.writable && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDeleteRows([extractPkObject(row, rowsData.primaryKey)])
                                      }
                                      title={tr('Видалити рядок')}
                                      className="p-2 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                              {rowsData.columns.map((col) => {
                                const rawVal = row[col.name];
                                const text = formatCellPreview(rawVal);
                                const isNull = rawVal === null || rawVal === undefined;
                                return (
                                  <TableCell
                                    key={col.name}
                                    className="max-w-[260px] truncate font-mono text-sm"
                                    title={text}
                                  >
                                    {isNull ? (
                                      <span className="italic text-slate-400">NULL</span>
                                    ) : isJsonLikeColumn(col) ? (
                                      <span className="inline-block max-w-[240px] truncate rounded bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                                        {text}
                                      </span>
                                    ) : (
                                      <span className="text-[#0d1f33]">{text}</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination Footer */}
              {rowsData && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                  <div>
                    {tr('Показано', 'Показано')}{' '}
                    <strong className="font-mono text-[#0d1f33] tabular-nums">{rowsData.rows.length}</strong>{' '}
                    {tr('із', 'из')}{' '}
                    <strong className="font-mono text-[#0d1f33] tabular-nums">{rowsData.total}</strong>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-10 px-3 rounded-lg border border-slate-300 bg-white font-mono text-sm"
                    >
                      <option value={25}>25 / стор.</option>
                      <option value={50}>50 / стор.</option>
                      <option value={100}>100 / стор.</option>
                    </select>

                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="px-2.5 font-mono font-bold text-[#0d1f33] tabular-nums">
                        {page} / {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Interactive SQL Console */
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-500 mr-1">
                    {tr('Шаблони:', 'Шаблоны:')}
                  </span>
                  {SQL_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setSqlText(tpl.sql)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold text-[#0d1f33] cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowWrite}
                    onChange={(e) => setAllowWrite(e.target.checked)}
                    className="w-4 h-4 accent-[#1769aa]"
                  />
                  {allowWrite ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                      Write Mode (INSERT/UPDATE/DELETE)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#169374]">
                      <ShieldCheck className="w-4 h-4" />
                      Read-Only (SELECT)
                    </span>
                  )}
                </label>
              </div>

              <div className="space-y-2.5">
                <textarea
                  rows={7}
                  value={sqlText}
                  onChange={(e) => setSqlText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      void handleRunSql();
                    }
                  }}
                  spellCheck={false}
                  placeholder="SELECT * FROM deals LIMIT 20;"
                  className="w-full rounded-xl border border-slate-300 bg-[#0d1f33] text-sky-100 font-mono text-sm p-4 focus:outline-none focus:ring-2 focus:ring-[#1769aa]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-500">
                    {tr('Підказка: Ctrl+Enter / Cmd+Enter — виконати запит. Ліміт виводу — 500 рядків, таймаут — 10 сек.', 'Подсказка: Ctrl+Enter / Cmd+Enter — выполнить запрос. Лимит вывода — 500 строк, таймаут — 10 сек.')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={runningQuery}
                      onClick={() => void handleRunSql()}
                    >
                      <Play className="w-4 h-4" />
                      {runningQuery ? tr('Виконується...', 'Выполняется...') : tr('Виконати SQL', 'Выполнить SQL')}
                    </Button>
                  </div>
                </div>
              </div>

              {queryErr && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm font-mono text-red-700 whitespace-pre-wrap">
                  {queryErr}
                </div>
              )}

              {queryResult && (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge variant={queryResult.readOnly ? 'info' : 'warning'}>
                        {queryResult.command}
                      </Badge>
                      <span className="font-mono font-bold text-[#0d1f33] tabular-nums">
                        {queryResult.rowCount} {tr('рядків')}
                      </span>
                      <span className="font-mono text-[#169374] tabular-nums">{queryResult.durationMs} ms</span>
                      {queryResult.truncated && (
                        <Badge variant="warning">{tr('Показано перші 500 рядків')}</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                        <button
                          type="button"
                          onClick={() => setResultViewMode('table')}
                          className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                            resultViewMode === 'table' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          Таблиця
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultViewMode('json')}
                          className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                            resultViewMode === 'json' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          JSON
                        </button>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => exportQueryResult('csv')}>
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => exportQueryResult('json')}>
                        <FileJson className="w-3.5 h-3.5" />
                        JSON
                      </Button>
                    </div>
                  </div>

                  {resultViewMode === 'json' ? (
                    <pre className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-[#0d1f33] max-h-96 overflow-auto">
                      {JSON.stringify(queryResult.rows, null, 2)}
                    </pre>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-auto max-h-96">
                      <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
                          <TableRow>
                            {queryResult.columns.map((c) => (
                              <TableHead key={c} className="font-mono text-xs whitespace-nowrap">
                                {c}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResult.rows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={Math.max(1, queryResult.columns.length)}
                                className="py-8 text-center text-sm text-slate-400"
                              >
                                {tr('Команда виконана без результуючих рядків')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            queryResult.rows.map((r, i) => (
                              <TableRow key={i}>
                                {queryResult.columns.map((c) => {
                                  const preview = formatCellPreview(r[c]);
                                  return (
                                    <TableCell
                                      key={c}
                                      className="max-w-[260px] truncate font-mono text-sm"
                                      title={preview}
                                    >
                                      {r[c] === null ? (
                                        <span className="italic text-slate-400">NULL</span>
                                      ) : (
                                        preview
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Session Query History */}
              {queryHistory.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                    <History className="w-4 h-4" />
                    {tr('Історія запитів сесії', 'История запросов сессии')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {queryHistory.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSqlText(h.sql)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono cursor-pointer max-w-[300px] ${
                          h.ok
                            ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0d1f33]'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                        title={h.sql}
                      >
                        <span className="font-bold">{h.command}</span>
                        <span className="truncate">{h.sql.replace(/\s+/g, ' ')}</span>
                        {h.ok && <span className="text-slate-400 shrink-0 tabular-nums">{h.durationMs}ms</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Row Dialog */}
      <Dialog open={Boolean(rowModalMode && rowsData)} onOpenChange={(open) => !open && setRowModalMode(null)}>
        <DialogContent className="max-w-3xl">
          {rowModalMode && rowsData && (
            <>
              <DialogHeader>
                <div className="font-mono text-sm font-bold text-[#1769aa] mb-0.5">
                  {rowsData.table} · {rowModalMode === 'create' ? 'INSERT' : rowsData.writable ? 'UPDATE' : 'VIEW'}
                </div>
                <DialogTitle>
                  {rowModalMode === 'create'
                    ? tr('Новий рядок у таблиці', 'Новая строка в таблице')
                    : rowsData.writable
                      ? tr('Редагування рядка', 'Редактирование строки')
                      : tr('Перегляд запису (тільки читання)', 'Просмотр записи (только чтение)')}
                </DialogTitle>
                <DialogDescription>
                  {tr('Поля таблиці та значення колонок', 'Поля таблицы и значения колонок')}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveRowModal} className="p-7 space-y-5 text-[15px]">
                {rowsData.columns.map((col) => {
                  const isReadOnlyField =
                    !rowsData.writable ||
                    (rowModalMode === 'edit' && rowsData.primaryKey.includes(col.name));
                  const isAutoSkip = rowModalMode === 'create' && col.isAutoGenerated;
                  const isNull = Boolean(nullFlags[col.name]);
                  const val = formValues[col.name] ?? '';
                  const isJson = isJsonLikeColumn(col);
                  const isLong = isLongTextColumn(col);

                  return (
                    <div key={col.name} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                          {col.isPrimaryKey && <KeyRound className="w-4 h-4 text-amber-500" />}
                          <span className="font-bold text-[#0d1f33] text-[15px]">{col.name}</span>
                          <span className="text-sm text-slate-500">{col.dataType}</span>
                          {col.foreignKey && (
                            <span className="inline-flex items-center gap-1 text-sm text-[#1769aa]">
                              <Link2 className="w-3.5 h-3.5" />
                              {col.foreignKey.table}.{col.foreignKey.column}
                            </span>
                          )}
                          {isAutoSkip && <Badge variant="info">AUTO</Badge>}
                        </div>

                        <div className="flex items-center gap-3">
                          {isJson && !isNull && !isReadOnlyField && (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  const pretty = JSON.stringify(JSON.parse(val), null, 2);
                                  setFormValues((prev) => ({ ...prev, [col.name]: pretty }));
                                } catch {
                                  // keep current text
                                }
                              }}
                              className="text-sm font-bold text-[#1769aa] hover:underline cursor-pointer"
                            >
                              Форматувати JSON
                            </button>
                          )}
                          {col.nullable && !isReadOnlyField && (
                            <label className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isNull}
                                onChange={(e) =>
                                  setNullFlags((prev) => ({ ...prev, [col.name]: e.target.checked }))
                                }
                                className="w-4.5 h-4.5 accent-[#1769aa]"
                              />
                              NULL
                            </label>
                          )}
                        </div>
                      </div>

                      {isLong ? (
                        <textarea
                          rows={isJson ? 4 : 3}
                          disabled={isReadOnlyField || isNull}
                          value={isNull ? '' : val}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                          }
                          placeholder={isNull ? 'NULL' : isAutoSkip ? 'Згенерується автоматично' : ''}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      ) : (
                        <input
                          type="text"
                          disabled={isReadOnlyField || isNull}
                          value={isNull ? '' : val}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                          }
                          placeholder={isNull ? 'NULL' : isAutoSkip ? 'Згенерується автоматично' : ''}
                          className="w-full h-11 rounded-lg border border-slate-300 bg-white px-4 font-mono text-sm disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      )}
                    </div>
                  );
                })}

                {rowModalErr && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-[15px] font-semibold text-red-700">
                    {rowModalErr}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button type="button" variant="outline" onClick={() => setRowModalMode(null)}>
                    {tr('Закрити', 'Закрыть')}
                  </Button>
                  {rowsData.writable && (
                    <Button type="submit" variant="primary" disabled={savingRow}>
                      {savingRow
                        ? tr('Зберігаємо...', 'Сохраняем...')
                        : rowModalMode === 'create'
                          ? tr('Створити запис', 'Создать запись')
                          : tr('Зберегти зміни', 'Сохранить изменения')}
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
