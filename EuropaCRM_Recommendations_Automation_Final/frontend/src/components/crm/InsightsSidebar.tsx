import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { CalendarDays, ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import type { ChartDatum } from '@/types';

const chartColors = ['#009b84', '#4b82e9', '#7357e8', '#f2aa2c', '#72c5b7', '#ef5b68'];

export function InsightsSidebar({ donutTitle, donutData, barTitle, barData, quickFilters, calendar = false, onQuickFilter, onDateSelect, layout = 'sidebar' }: {
  donutTitle: string;
  donutData: ChartDatum[];
  barTitle: string;
  barData: ChartDatum[];
  quickFilters: { label: string; value: string }[];
  calendar?: boolean;
  onQuickFilter: (label: string) => void;
  onDateSelect: (date: string) => void;
  layout?: 'sidebar' | 'dashboard';
}) {
  const donutPanel = (
    <Panel title={donutTitle}>
      {donutData.length ? (
        <div className="flex items-center gap-3">
          <div className="h-[112px] w-[112px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={donutData} dataKey="value" innerRadius={29} outerRadius={46} paddingAngle={1} stroke="none">{donutData.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {donutData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: chartColors[index % chartColors.length] }} /><span className="truncate">{item.name}</span></span>
                <span className="font-semibold text-slate-700">{item.detail ?? item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <Empty />}
    </Panel>
  );

  const barPanel = (
    <Panel title={barTitle}>
      {barData.length ? (
        <div className="space-y-3">
          {barData.map((item) => {
            const max = Math.max(...barData.map((datum) => datum.value), 1);
            return (
              <div key={item.name} className="grid grid-cols-[100px_1fr_38px] items-center gap-2 text-[10px]">
                <span className="truncate text-slate-700">{item.name}</span>
                <div className="h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-[#009b84]" style={{ width: `${Math.max(8, item.value / max * 100)}%` }} /></div>
                <span className="text-right font-semibold text-slate-600">{item.detail ?? item.value}</span>
              </div>
            );
          })}
        </div>
      ) : <Empty />}
    </Panel>
  );

  const quickPanel = quickFilters.length ? (
    <Panel title="Quick Filters">
      <div className={layout === 'dashboard' ? 'grid grid-cols-1 gap-2 sm:grid-cols-3' : 'space-y-2.5'}>
        {quickFilters.map((item, index) => (
          <button onClick={() => onQuickFilter(item.label)} key={item.label} className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-[10px] text-slate-600 transition hover:border-[#009E92]/20 hover:bg-[#D9F5F1]/30 hover:text-[#008d79]">
            {index % 2 ? <CalendarDays className="h-3.5 w-3.5 text-[#009b84]" /> : <UserRound className="h-3.5 w-3.5 text-[#009b84]" />}
            <span className="flex-1">{item.label}</span><span className="rounded-md bg-[#eaf8f5] px-2 py-1 font-semibold text-[#007d6e]">{item.value}</span>
          </button>
        ))}
      </div>
    </Panel>
  ) : null;

  if (layout === 'dashboard') {
    return <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">{donutPanel}{barPanel}{quickPanel}</section>;
  }

  return (
    <aside className="w-[240px] shrink-0 space-y-3">
      {donutPanel}
      {barPanel}
      {quickPanel}
      {calendar && <MiniCalendar onDateSelect={onDateSelect} />}
    </aside>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="crm-card min-h-[170px] p-4"><h3 className="mb-3 text-[11px] font-bold text-slate-900">{title}</h3>{children}</section>;
}

function Empty() {
  return <div className="py-6 text-center text-[10px] text-slate-400">No database data yet</div>;
}

function MiniCalendar({ onDateSelect }: { onDateSelect: (date: string) => void }) {
  const [month, setMonth] = useState(new Date());
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const cells: { day: number; current: boolean; date: Date }[] = [];
    for (let index = first.getDay() - 1; index >= 0; index--) {
      const date = new Date(month.getFullYear(), month.getMonth(), -index);
      cells.push({ day: date.getDate(), current: false, date });
    }
    for (let day = 1; day <= last.getDate(); day++) cells.push({ day, current: true, date: new Date(month.getFullYear(), month.getMonth(), day) });
    while (cells.length < 42) {
      const date = new Date(month.getFullYear(), month.getMonth() + 1, cells.length - first.getDay() - last.getDate() + 1);
      cells.push({ day: date.getDate(), current: false, date });
    }
    return cells;
  }, [month]);

  const move = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  return (
    <Panel title="Calendar View">
      <div className="mb-2 flex items-center justify-between text-[10px] text-slate-600">
        <button aria-label="Previous month" onClick={() => move(-1)} className="rounded p-1 hover:bg-slate-100"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button aria-label="Next month" onClick={() => move(1)} className="rounded p-1 hover:bg-slate-100"><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[8px] text-slate-500">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[9px]">
        {days.map((cell) => <button key={cell.date.toISOString()} onClick={() => onDateSelect(cell.date.toISOString().slice(0,10))} className={`rounded py-1 hover:bg-[#D9F5F1] hover:text-[#009E92] ${cell.current ? 'text-slate-700' : 'text-slate-300'}`}>{cell.day}</button>)}
      </div>
    </Panel>
  );
}
