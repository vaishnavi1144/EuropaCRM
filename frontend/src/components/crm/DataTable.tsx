import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowDown, ArrowUp, CalendarDays, Download, Edit3, Eye, MoreVertical, Sparkles, Star, Trash2, X } from 'lucide-react';
import type { ColumnConfig, RecordRow } from '@/types';
import { Badge, resolveBadgeTone } from '@/components/ui/Badge';
import { formatIndianCurrency, initials } from '@/lib/utils';

export function DataTable({ rows, columns, page, pageSize, total, sortBy, sortOrder, onPage, onPageSize, onSort, onEdit, onDelete, onView, onAutomation, automationLabel, rowMenuActions, rowAction, onRowClick, selectedRowId, onBulkDelete, onExport, fitToContainer = false, selectedIds: propSelectedIds, onSelectionChange, bulkActions }: {
  rows: RecordRow[];
  columns: ColumnConfig[];
  page: number;
  pageSize: number;
  total: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onSort: (key: string) => void;
  onEdit: (row: RecordRow) => void;
  onDelete: (row: RecordRow) => void;
  onView: (row: RecordRow) => void;
  onAutomation?: (row: RecordRow) => void;
  automationLabel?: string;
  rowMenuActions?: Array<{ label: string; disabled?: boolean; icon?: React.ReactNode; inline?: boolean; onClick: (row: RecordRow) => void }> | ((row: RecordRow) => Array<{ label: string; disabled?: boolean; icon?: React.ReactNode; inline?: boolean; onClick: (row: RecordRow) => void }>);
  rowAction?: (action: string, row: RecordRow) => void;
  onRowClick?: (row: RecordRow) => void;
  selectedRowId?: string;
  onBulkDelete: (rows: RecordRow[]) => void;
  onExport: (rows?: RecordRow[]) => void;
  fitToContainer?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  bulkActions?: Array<{ label: string; onClick: (rows: RecordRow[]) => void; variant?: 'primary' | 'secondary'; icon?: React.ReactNode }>;
}) {
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = propSelectedIds ?? localSelectedIds;
  const setSelectedIds = (next: Set<string> | ((curr: Set<string>) => Set<string>)) => {
    const nextSet = typeof next === 'function' ? next(selectedIds) : next;
    if (propSelectedIds === undefined) {
      setLocalSelectedIds(nextSet);
    }
    onSelectionChange?.(nextSet);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allCurrentSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id));
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds]);

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => rows.some((row) => row.id === id))));
  }, [rows]);

  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allCurrentSelected) currentIds.forEach((id) => next.delete(id));
      else currentIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      {selectedRows.length > 0 && (
        bulkActions ? (
          <div className="flex items-center justify-between border-b border-[#E4ECF3] bg-slate-50 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <input aria-label="Clear selection" type="checkbox" checked={true} onChange={() => setSelectedIds(new Set())} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="font-bold text-slate-800 ml-1">{selectedRows.length} Selected</span>
              <div className="flex items-center gap-2 ml-4">
                {bulkActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={action.variant === 'primary' ? "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#009E92] hover:bg-[#008277] px-3.5 text-[10px] font-semibold text-white transition shadow-sm" : "crm-secondary-button h-8 px-3.5 text-[10px] transition"}
                    onClick={() => action.onClick(selectedRows)}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="text-[#b91c1c] hover:text-red-700 font-bold flex items-center gap-1 text-[11px] transition"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3.5 w-3.5" />
              Clear Selection
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-[#E4ECF3] bg-[#D9F5F1]/30 px-4 py-2.5 text-xs">
            <span className="font-semibold text-[#009E92]">{selectedRows.length} record{selectedRows.length === 1 ? '' : 's'} selected</span>
            <div className="flex items-center gap-2">
              <button className="crm-secondary-button h-8 px-3 text-[10px]" onClick={() => onExport(selectedRows)}><Download className="h-3.5 w-3.5" />Export</button>
              <button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[10px] font-semibold text-white hover:bg-red-700" onClick={() => onBulkDelete(selectedRows)}><Trash2 className="h-3.5 w-3.5" />Delete</button>
              <button className="px-2 text-[10px] font-semibold text-slate-600" onClick={() => setSelectedIds(new Set())}>Deselect</button>
            </div>
          </div>
        )
      )}
      <div className="overflow-x-auto">
        <table className={`w-full table-auto border-collapse ${onAutomation ? 'min-w-[1420px]' : fitToContainer ? 'min-w-[1120px]' : 'min-w-[1080px]'}`}>
          <thead className="bg-[#fcfdfd]">
            <tr className="border-b border-slate-200">
              <th className="w-10 px-3 py-3"><input aria-label="Select current page" checked={allCurrentSelected} onChange={toggleAll} type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300" /></th>
              {columns.map((column) => (
                <th key={column.key} className={`crm-table-head px-3 py-3 ${column.key === 'ownerName' ? 'min-w-[190px]' : ''}`} style={{ width: column.width, minWidth: column.key === 'ownerName' ? '190px' : column.width }}>
                  <button type="button" onClick={() => onSort(column.key)} className="inline-flex items-center gap-1.5 hover:text-[#009E92]">
                    {column.label}
                    {sortBy === column.key && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
              <th className="crm-table-head w-44 min-w-44 px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 2} className="px-5 py-16 text-center"><div className="text-sm font-semibold text-slate-700">No records found</div><div className="mt-1 text-xs text-slate-500">Add a record or change the current search and filters.</div></td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} onClick={() => onRowClick?.(row)} className={`border-b border-slate-100 transition hover:bg-[#fbfefd] last:border-0 ${onRowClick ? 'cursor-pointer' : ''} ${selectedRowId === row.id ? 'bg-[#E6F8F4]' : ''}`}>
                <td className="px-3 py-3"><input aria-label={`Select ${row.id}`} checked={selectedIds.has(row.id)} onChange={(event) => { event.stopPropagation(); toggleOne(row.id); }} onClick={(event) => event.stopPropagation()} type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300" /></td>
                {columns.map((column, index) => <td key={column.key} className={`crm-table-cell ${column.key === 'ownerName' ? 'min-w-[190px]' : ''} ${fitToContainer ? 'whitespace-normal break-words align-top' : ''}`} style={{ minWidth: column.key === 'ownerName' ? '190px' : column.width }}>{renderCell(row, column, index === 0 ? () => onView(row) : undefined, rowAction)}</td>)}
                <td className="w-44 min-w-44 px-3 py-3 align-middle">
                  <div className="flex flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap text-slate-400">
                    {onAutomation && <button type="button" title={automationLabel ?? 'View matches'} onClick={(event) => { event.stopPropagation(); onAutomation(row); }} className="rounded-md bg-[#D9F5F1] p-1.5 text-[#008277] hover:bg-[#BDECE6] transition"><Sparkles className="h-3.5 w-3.5" /></button>}
                    <button type="button" title="View" onClick={(event) => { event.stopPropagation(); onView(row); }} className="hover:text-[#009E92] transition"><Eye className="h-3.5 w-3.5" /></button>
                    <button type="button" title="Edit" onClick={(event) => { event.stopPropagation(); onEdit(row); }} className="hover:text-[#009E92] transition"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button type="button" title="Delete" onClick={(event) => { event.stopPropagation(); onDelete(row); }} className="hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                    {((typeof rowMenuActions === 'function' ? rowMenuActions(row) : rowMenuActions) ?? [])
                      .filter((action) => action.inline)
                      .map((action) => (
                        <button key={action.label} type="button" title={action.label} onClick={(event) => { event.stopPropagation(); action.onClick(row); }} className="rounded-md bg-[#D9F5F1] p-1.5 text-[#008277] hover:bg-[#BDECE6] transition">
                          {action.icon ?? <CalendarDays className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button type="button" aria-label="More record actions" title="More actions" onClick={(event) => event.stopPropagation()} className="rounded p-1 hover:bg-[#D9F5F1]/30 hover:text-[#009E92]"><MoreVertical className="h-3.5 w-3.5" /></button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content sideOffset={6} align="end" collisionPadding={12} className="z-50 w-44 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xl">
                          {((typeof rowMenuActions === 'function' ? rowMenuActions(row) : rowMenuActions) ?? []).map((action) => (
                            <DropdownMenu.Item key={action.label} disabled={action.disabled} onPointerDown={(event) => event.stopPropagation()} onSelect={() => action.onClick(row)} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 outline-none hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" >
                              {action.icon}
                              <span>{action.label}</span>
                            </DropdownMenu.Item>
                          ))}
                          {((typeof rowMenuActions === 'function' ? rowMenuActions(row) : rowMenuActions) ?? []).length ? <DropdownMenu.Separator className="my-1 h-px bg-slate-100" /> : null}
                          {onAutomation && <DropdownMenu.Item onPointerDown={(event) => event.stopPropagation()} onSelect={() => onAutomation(row)} className="cursor-pointer rounded-md px-2.5 py-2 font-semibold text-[#008277] outline-none hover:bg-[#D9F5F1]/50">{automationLabel ?? 'View matches'}</DropdownMenu.Item>}
                          <DropdownMenu.Item onPointerDown={(event) => event.stopPropagation()} onSelect={() => onView(row)} className="cursor-pointer rounded-md px-2.5 py-2 outline-none hover:bg-slate-50">View details</DropdownMenu.Item>
                          <DropdownMenu.Item onPointerDown={(event) => event.stopPropagation()} onSelect={() => onEdit(row)} className="cursor-pointer rounded-md px-2.5 py-2 outline-none hover:bg-slate-50">Edit record</DropdownMenu.Item>
                          <DropdownMenu.Item onPointerDown={(event) => event.stopPropagation()} onSelect={() => onExport([row])} className="cursor-pointer rounded-md px-2.5 py-2 outline-none hover:bg-slate-50">Export record</DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
                          <DropdownMenu.Item onPointerDown={(event) => event.stopPropagation()} onSelect={() => onDelete(row)} className="cursor-pointer rounded-md px-2.5 py-2 text-red-600 outline-none hover:bg-red-50">Delete record</DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[10px] text-slate-600">
        <span>Showing {(page - 1) * pageSize + (rows.length ? 1 : 0)} to {(page - 1) * pageSize + rows.length} of {total.toLocaleString()} results</span>
        <div className="flex items-center gap-2">
          <PageButton disabled={page === 1} onClick={() => onPage(1)}>«</PageButton>
          <PageButton disabled={page === 1} onClick={() => onPage(page - 1)}>‹</PageButton>
          {pageNumbers(page, pages).map((p) => <PageButton key={p} active={p === page} onClick={() => onPage(p)}>{p}</PageButton>)}
          <PageButton disabled={page === pages} onClick={() => onPage(page + 1)}>›</PageButton>
          <PageButton disabled={page === pages} onClick={() => onPage(pages)}>»</PageButton>
          <select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="crm-select ml-2 h-8 text-[10px]">
            {[10,25,50,100].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function pageNumbers(page: number, pages: number) {
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  return Array.from({ length: Math.min(3, pages) }, (_, index) => start + index);
}

function PageButton({ children, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={`h-8 min-w-8 rounded-md border px-2 ${active ? 'border-[#009E92] bg-[#009E92] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#009E92]/30'} disabled:opacity-40`} {...props}>{children}</button>;
}

function renderCell(row: RecordRow, column: ColumnConfig, onPrimaryClick?: () => void, rowAction?: (action: string, row: RecordRow) => void) {
  const value = row[column.key];
  const text = value?.toString() ?? '—';
  const primaryClass = onPrimaryClick ? 'cursor-pointer hover:text-[#009E92] hover:underline' : '';
  // Show a 'View' action for resume/file URLs instead of printing the raw link
  if (column.key === 'resumeUrl') {
    if (!value) return <span>—</span>;
    const url = String(value);
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="crm-secondary-button inline-flex h-8 items-center justify-center gap-2 px-3 text-xs">
        View
      </a>
    );
  }
  if (column.render === 'person') {
    const content = <><Avatar name={text} /><div><div className="font-medium text-[#071B4A]">{text}</div>{column.subtitleKey && row[column.subtitleKey] && <Badge tone={resolveBadgeTone(String(row[column.subtitleKey]))} className="mt-1">{String(row[column.subtitleKey])}</Badge>}</div></>;
    return onPrimaryClick ? <button type="button" onClick={(event) => { event.stopPropagation(); onPrimaryClick(); }} className={`flex items-center gap-2.5 text-left ${primaryClass}`}>{content}</button> : <div className="flex items-center gap-2.5 text-left">{content}</div>;
  }
  if (column.render === 'account') {
    const content = <><div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#D9F5F1]/50 text-[#009E92]">▥</div><div><div className="font-medium text-[#071B4A]">{text}</div>{column.subtitleKey && <div className="mt-0.5 text-[9px] text-slate-500">{String(row[column.subtitleKey] ?? '')}</div>}</div></>;
    return onPrimaryClick ? <button type="button" onClick={(event) => { event.stopPropagation(); onPrimaryClick(); }} className={`flex items-center gap-2.5 text-left ${primaryClass}`}>{content}</button> : <div className="flex items-center gap-2.5 text-left">{content}</div>;
  }
  if (column.render === 'titleSubtitle') {
    const content = <><div className="font-medium text-[#071B4A]">{text}</div>{column.subtitleKey && <div className="mt-1 max-w-[210px] truncate text-[10px] text-slate-500">{String(row[column.subtitleKey] ?? '')}</div>}</>;
    return onPrimaryClick ? <button type="button" onClick={(event) => { event.stopPropagation(); onPrimaryClick(); }} className={`text-left ${primaryClass}`}>{content}</button> : <div className="text-left">{content}</div>;
  }
  if (column.render === 'schedule') {
    const disabled = String(row.status) !== 'Interview Requested';
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) rowAction?.('scheduleInterview', row);
        }}
        className="crm-secondary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CalendarDays className="h-4 w-4" />
        Schedule
      </button>
    );
  }
  if (column.render === 'badge') return <Badge tone={column.badgeTone && column.badgeTone !== 'auto' ? column.badgeTone : resolveBadgeTone(text)}>{text}</Badge>;
  if (column.render === 'rating') {
    const rating = Number(value ?? 0);
    return <div className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-3 w-3 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</div>;
  }
  if (column.render === 'probability') {
    const probability = Math.min(100, Math.max(0, Number(value ?? 0)));
    return <div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded bg-slate-100"><div className="h-full rounded bg-[#009E92]" style={{ width: `${probability}%` }} /></div><span>{probability}%</span></div>;
  }
  if (column.render === 'currency') return <span className="font-medium text-[#071B4A]">{formatIndianCurrency(Number(value ?? 0))}</span>;
  if (column.render === 'dateTime') return <div className="leading-4"><div>{formatDisplayValue(text)}</div>{column.subtitleKey && <div className="text-[10px] text-slate-500">{String(row[column.subtitleKey] ?? '')}</div>}</div>;
  return onPrimaryClick ? <button type="button" onClick={(event) => { event.stopPropagation(); onPrimaryClick(); }} className={primaryClass}>{formatDisplayValue(text)}</button> : <span>{formatDisplayValue(text)}</span>;
}

function formatDisplayValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }
  return value;
}

function Avatar({ name }: { name: string }) {
  const palettes = ['from-amber-200 to-orange-400', 'from-sky-200 to-blue-400', 'from-emerald-200 to-teal-400', 'from-rose-200 to-pink-400', 'from-violet-200 to-purple-400'];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${palettes[index]} text-[9px] font-bold text-slate-700 ring-1 ring-white`}>{initials(name)}</span>;
}
