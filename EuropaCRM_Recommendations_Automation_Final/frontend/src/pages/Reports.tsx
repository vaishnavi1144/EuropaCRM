import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Download, RefreshCw, Trophy } from 'lucide-react';
import { KpiCard } from '@/components/crm/KpiCard';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { KpiConfig } from '@/types';

type ReportType = 'sales' | 'recruitment' | 'bench' | 'ai';
type ReportPayload = {
  kpis: KpiConfig[];
  donut: { name: string; value: number }[];
  bar: { name: string; value: number }[];
  trend: { label: string; total: number; success: number; closed: number }[];
  funnel: { name: string; value: number }[];
  table1: { headers: string[]; rows: string[][]; title: string; path: string; linkText: string };
  table2: { headers: string[]; rows: string[][]; title: string; path: string; linkText: string };
  benchTabs?: {
    pipeline: { id: string; consultant: string; technology: string; status: string; ageDays: number; owner: string; submissions: number; interviews: number }[];
    submissions: { total: number; status: { name: string; value: number }[]; clients: { name: string; value: number }[]; consultants: { name: string; value: number }[]; trend: { label: string; total: number; success: number; closed: number }[] };
    placements: { consultant: string; client: string; vendor: string; date: string; rate: number; owner: string; status: string }[];
    revenue: { monthly: { name: string; value: number }[]; consultants: { name: string; value: number }[]; clients: { name: string; value: number }[]; total: number; margin: number };
    team: { id: string; name: string; submissions: number; interviews: number; placements: number; conversionRate: number; revenue: number }[];
  };
};

const colors = ['#009b84','#4b82e9','#f2aa2c','#ef5b68','#7357e8','#94a3b8'];
const titles: Record<ReportType,{section:string;title:string;subtitle:string}> = {
  sales:{section:'Sales/Marketing',title:'Sales & Marketing Analytics',subtitle:'Sales, marketing and pipeline performance.'},
  recruitment:{section:'IT Recruitment',title:'IT Recruitment Reports',subtitle:'Candidate, job, interview and offer performance.'},
  bench:{section:'Bench Sales',title:'Bench Sales Reports & Analytics',subtitle:'Consultant, submission and placement performance.'},
  ai:{section:'AI Team',title:'AI Projects & Resource Analytics',subtitle:'AI project, task and resource performance.'},
};

export function Reports({ type = 'sales' }: { type?: ReportType }) {
  const navigate = useNavigate();
  const [data,setData] = useState<ReportPayload | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [activeTab,setActiveTab] = useState('Overview');
  const [group,setGroup] = useState('Monthly');
  const [compare,setCompare] = useState('Previous period');
  const [dateFrom,setDateFrom] = useState(() => { const d=new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [dateTo,setDateTo] = useState(() => new Date().toISOString().slice(0,10));

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await api.report<ReportPayload>(`${type}?dateFrom=${dateFrom}&dateTo=${dateTo}&group=${group.toLowerCase()}`)); }
    catch (reason) { setData(null); setError(reason instanceof Error ? reason.message : 'Unable to load report data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [type,dateFrom,dateTo,group]);

  const meta=titles[type];
  const tabs = type === 'sales' ? ['Overview','Lead Analytics','Pipeline Analytics','Campaign Analytics','Activity Analytics','Team Performance'] : type === 'recruitment' ? ['Overview','Candidate Pipeline','Jobs','Interviews','Offers','Team Performance'] : type === 'bench' ? ['Overview','Bench Pipeline','Submissions','Placements','Revenue','Team Performance'] : ['Overview','Projects','Tasks','Resources','Milestones','Team Performance'];

  const exportReport = () => {
    if (!data) return;
    const rows: unknown[][] = [['Report',meta.title],['Date From',dateFrom],['Date To',dateTo],['Comparison',compare],[],['Metric','Value'],...data.kpis.map((item)=>[item.label,item.value]),[],data.table1.headers,...data.table1.rows,[],data.table2.headers,...data.table2.rows];
    const csv=rows.map((row)=>row.map(csvCell).join(',')).join('\n'); const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); link.download=`europa-${type}-report-${dateTo}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const filteredContentTitle = activeTab === 'Overview' ? 'Overview' : activeTab;
  const funnelMax = useMemo(()=>Math.max(...(data?.funnel.map((item)=>item.value) ?? [1]),1),[data]);

  return <div className="px-5 py-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-[13px]"><span className="text-[#009E92]">{meta.section}</span><span>›</span><span className="font-semibold">Reports & Analytics</span></div><h1 className="text-[23px] font-bold text-slate-950">{meta.title}</h1></div>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px]"><CalendarDays className="h-4 w-4 text-[#009E92]" /><input aria-label="Report start date" type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="h-9 outline-none" /><span>to</span><input aria-label="Report end date" type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="h-9 outline-none" /></label>
        <select aria-label="Comparison period" className="crm-secondary-button min-w-[150px] text-sm" value={compare} onChange={(e)=>setCompare(e.target.value)}><option>Previous period</option><option>Last month</option><option>Last quarter</option><option>Last year</option></select>
        <select aria-label="Report grouping" className="crm-secondary-button min-w-[150px] text-sm" value={group} onChange={(e)=>setGroup(e.target.value)}><option>Daily</option><option>Weekly</option><option>Monthly</option></select>
        <button onClick={()=>void load()} className="crm-secondary-button min-w-[150px] text-sm"><RefreshCw className="h-4 w-4" />Refresh</button>
        <button onClick={exportReport} disabled={!data} className="crm-primary-button min-w-[150px] text-sm disabled:opacity-50"><Download className="h-4 w-4" />Export Report</button>
      </div>
    </div>
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
    {loading ? <div className="mt-8 rounded-xl border border-slate-200 bg-white py-24 text-center text-sm text-slate-500">Loading report data…</div> : data ? <>
      <div className="mt-5 grid grid-cols-6 gap-3">{data.kpis.map((item)=><KpiCard key={item.label} item={item}/>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-8 border-b border-slate-200 text-[11px] font-medium text-slate-600">{tabs.map((tab)=><button onClick={()=>setActiveTab(tab)} key={tab} className={`h-11 border-b-2 px-1 ${activeTab===tab?'border-[#009E92] text-[#009E92]':'border-transparent hover:text-[#009E92]'}`}>{tab}</button>)}</div>
      <div className="mt-3 rounded-lg border border-[#D9F5F1] bg-[#D9F5F1]/20 px-4 py-2 text-xs text-[#009E92]">Showing {filteredContentTitle} · {dateFrom} to {dateTo} · Compared with {compare}</div>
      {type === 'bench' && activeTab !== 'Overview' && data.benchTabs ? <BenchTabContent tab={activeTab} data={data.benchTabs} group={group} onGroup={setGroup} /> : <>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <ReportCard title="Pipeline / Status Funnel" group={group} onGroup={setGroup}><div className="space-y-3 pt-2">{data.funnel.length?data.funnel.map((item,index)=><div key={item.name}><div className="mb-1 flex justify-between text-[9px]"><span className="min-w-0 break-words pr-2">{item.name}</span><strong className="shrink-0">{item.value}</strong></div><div className="h-6 overflow-hidden rounded bg-slate-100"><div className="h-full min-w-0 rounded" style={{width:`${Math.max(5,item.value/funnelMax*100)}%`,background:colors[index%colors.length]}}/></div></div>):<Empty/>}</div></ReportCard>
        <ReportCard title="Distribution" group={group} onGroup={setGroup}>{data.donut.length?<div className="flex h-[185px] items-center"><div className="h-40 w-40"><ResponsiveContainer><PieChart><Pie data={data.donut} dataKey="value" innerRadius={42} outerRadius={70} stroke="none">{data.donut.map((_,index)=><Cell key={index} fill={colors[index%colors.length]}/>)}</Pie></PieChart></ResponsiveContainer></div><div className="flex-1 space-y-3">{data.donut.map((item,index)=><div key={item.name} className="flex justify-between text-[9px]"><span><i className="mr-2 inline-block h-2 w-2 rounded-full" style={{background:colors[index%colors.length]}}/>{item.name}</span><span>{item.value}</span></div>)}</div></div>:<Empty/>}</ReportCard>
        <ReportCard title="Trend" group={group} onGroup={setGroup}>{data.trend.length?<ResponsiveContainer width="100%" height={185}><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f1"/><XAxis dataKey="label" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}}/><Tooltip/><Line type="monotone" dataKey="total" stroke="#009E92" strokeWidth={2}/><Line type="monotone" dataKey="success" stroke="#4b82e9" strokeWidth={2}/><Line type="monotone" dataKey="closed" stroke="#ef5b68" strokeWidth={2}/></LineChart></ResponsiveContainer>:<Empty/>}</ReportCard>
        <ReportCard title={data.table1.title} group={group} onGroup={setGroup}><SimpleTable {...data.table1}/><button onClick={()=>navigate(data.table1.path)} className="mt-4 text-[10px] font-semibold text-blue-600 hover:underline">{data.table1.linkText}</button></ReportCard>
        <ReportCard title="Volume" group={group} onGroup={setGroup}>{data.bar.length?<ResponsiveContainer width="100%" height={185}><BarChart data={data.bar}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f1"/><XAxis dataKey="name" tick={{fontSize:8}}/><YAxis tick={{fontSize:9}}/><Tooltip/><Bar dataKey="value" fill="#009E92" radius={[4,4,0,0]} barSize={28}/></BarChart></ResponsiveContainer>:<Empty/>}</ReportCard>
        <ReportCard title={data.table2.title} group={group} onGroup={setGroup}><SimpleTable {...data.table2}/><button onClick={()=>navigate(data.table2.path)} className="mt-4 text-[10px] font-semibold text-blue-600 hover:underline">{data.table2.linkText}</button></ReportCard>
      </div>
      <div className="mt-3 grid grid-cols-[2fr_1fr] gap-3"><ReportCard title="Reports Quick Access" group={group} onGroup={setGroup}><div className="grid grid-cols-6 gap-3">{tabs.slice(1).map((name,index)=><button onClick={()=>{setActiveTab(name);toast.info(`${name} report selected`);}} key={name} className="flex h-20 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white text-[9px] hover:border-primary/30 hover:bg-[#D9F5F1]/30"><span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#D9F5F1] text-[#009E92]">{index===1?'$':'◉'}</span>{name}</button>)}</div></ReportCard><ReportCard title="Key Insights" group={group} onGroup={setGroup}><div className="space-y-3 text-[10px] text-slate-600"><div className="flex gap-3"><Trophy className="h-4 w-4 text-[#009E92]"/>All figures reflect the selected reporting period.</div><div className="flex gap-3"><Trophy className="h-4 w-4 text-[#009E92]"/>Use the date and grouping controls to refresh analysis.</div></div></ReportCard></div>
      </>}
    </> : null}
  </div>;
}

function BenchTabContent({ tab, data, group, onGroup }: { tab: string; data: NonNullable<ReportPayload['benchTabs']>; group: string; onGroup: (value: string) => void }) {
  if (tab === 'Bench Pipeline') return <div className="mt-3 grid grid-cols-2 gap-3"><ReportCard title="Consultant Pipeline" group={group} onGroup={onGroup}><SimpleTable headers={['Consultant', 'Technology', 'Status', 'Age', 'Owner']} rows={data.pipeline.map((item) => [item.consultant, item.technology, item.status, `${item.ageDays} days`, item.owner])} /></ReportCard><ReportCard title="Pipeline Status" group={group} onGroup={onGroup}><SimpleTable headers={['Status', 'Consultants']} rows={['Available', 'Submitted', 'Interview', 'Placed'].map((status) => [status, String(data.pipeline.filter((item) => item.status === status).length)])} /></ReportCard></div>;
  if (tab === 'Submissions') return <div className="mt-3 grid grid-cols-2 gap-3"><ReportCard title="Submission Status" group={group} onGroup={onGroup}><SimpleTable headers={['Status', 'Total']} rows={data.submissions.status.map((item) => [item.name, String(item.value)])} /></ReportCard><ReportCard title="Submission Trend" group={group} onGroup={onGroup}>{data.submissions.trend.length ? <ResponsiveContainer width="100%" height={220}><LineChart data={data.submissions.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f1"/><XAxis dataKey="label" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}}/><Tooltip/><Line type="monotone" dataKey="total" stroke="#009E92" strokeWidth={2}/><Line type="monotone" dataKey="success" stroke="#4b82e9" strokeWidth={2}/></LineChart></ResponsiveContainer> : <Empty/>}</ReportCard><ReportCard title="Client-wise Submissions" group={group} onGroup={onGroup}><SimpleTable headers={['Client', 'Total']} rows={data.submissions.clients.map((item) => [item.name, String(item.value)])} /></ReportCard><ReportCard title="Consultant-wise Submissions" group={group} onGroup={onGroup}><SimpleTable headers={['Consultant', 'Total']} rows={data.submissions.consultants.map((item) => [item.name, String(item.value)])} /></ReportCard></div>;
  if (tab === 'Placements') return <div className="mt-3"><ReportCard title="Placed Consultants" group={group} onGroup={onGroup}><SimpleTable headers={['Consultant', 'Client', 'Vendor', 'Placement Date', 'Rate', 'Owner', 'Status']} rows={data.placements.map((item) => [item.consultant, item.client, item.vendor, formatDisplayDate(item.date), formatCurrency(item.rate), item.owner, item.status])} /></ReportCard></div>;
  if (tab === 'Revenue') return <div className="mt-3 grid grid-cols-3 gap-3"><ReportCard title="Revenue Summary" group={group} onGroup={onGroup}><div className="space-y-4 pt-3"><MetricLine label="Total Revenue" value={formatCurrency(data.revenue.total)} /><MetricLine label="Estimated Margin" value={formatCurrency(data.revenue.margin)} /></div></ReportCard><ReportCard title="Monthly Revenue" group={group} onGroup={onGroup}>{data.revenue.monthly.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={data.revenue.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f1"/><XAxis dataKey="name" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}}/><Tooltip/><Bar dataKey="value" fill="#009E92" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer> : <Empty/>}</ReportCard><ReportCard title="Consultant / Client Revenue" group={group} onGroup={onGroup}><SimpleTable headers={['Consultant', 'Revenue']} rows={data.revenue.consultants.map((item) => [item.name, formatCurrency(item.value)])} /><div className="mt-4 border-t border-slate-100 pt-3"><SimpleTable headers={['Client', 'Revenue']} rows={data.revenue.clients.map((item) => [item.name, formatCurrency(item.value)])} /></div></ReportCard></div>;
  if (tab === 'Team Performance') return <div className="mt-3"><ReportCard title="Bench Sales Team Performance" group={group} onGroup={onGroup}><SimpleTable headers={['User', 'Submissions', 'Interviews', 'Placements', 'Conversion', 'Revenue']} rows={data.team.map((item) => [item.name, String(item.submissions), String(item.interviews), String(item.placements), `${item.conversionRate}%`, formatCurrency(item.revenue)])} /></ReportCard></div>;
  return null;
}

function MetricLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs"><span className="text-slate-500">{label}</span><strong className="text-lg text-[#071B4A]">{value}</strong></div>; }
function formatCurrency(value: number) { return `$ ${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`; }
function formatDisplayDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value || '—') : date.toLocaleDateString(); }

function ReportCard({title,group,onGroup,children}:{title:string;group:string;onGroup:(value:string)=>void;children:React.ReactNode}) { return <section className="crm-card min-h-[235px] p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[11px] font-bold text-slate-900">{title}</h3><select aria-label={`${title} grouping`} value={group} onChange={(e)=>onGroup(e.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-500"><option>Daily</option><option>Weekly</option><option>Monthly</option></select></div>{children}</section>; }
function SimpleTable({headers,rows}:{headers:string[];rows:string[][]}) { return <div>{rows.length?<><div className="grid border-b border-slate-100 pb-2 text-[8px] font-semibold text-slate-500" style={{gridTemplateColumns:`repeat(${headers.length},minmax(0,1fr))`}}>{headers.map((header)=><span key={header}>{header}</span>)}</div>{rows.map((row,index)=><div key={index} className="grid border-b border-slate-50 py-2 text-[8.5px] text-slate-700" style={{gridTemplateColumns:`repeat(${headers.length},minmax(0,1fr))`}}>{row.map((value,cell)=><span key={cell} className="truncate pr-2">{value}</span>)}</div>)}</>:<Empty/>}</div>; }
function Empty(){return <div className="flex h-[170px] items-center justify-center text-xs text-slate-400">No data for the selected period</div>;}
function csvCell(value:unknown){return `"${String(value??'').replace(/"/g,'""')}"`;}
