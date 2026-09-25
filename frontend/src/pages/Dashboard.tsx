import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Handshake,
  Mail,
  MessageSquareText,
  UsersRound,
  Wallet,
  ArrowRight,
  ChevronRight,
  X,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import { useDashboardLayout } from '@/context/DashboardLayoutContext';
import { useNavigate } from 'react-router-dom';

type Summary = {
  totalUsers: number;
  totalConsultants: number;
  totalSubmissions: number;
  totalInterviews: number;
  totalOffers: number;
  totalPlacements: number;
  totalRevenue: number;
  attention: DashboardAction[];
  todayActions: DashboardAction[];
  agingBuckets: { label: string; count: number; min: number; max: number }[];
  conversion: { label: string; value: number }[];
};

type DashboardAction = { key: string; label: string; count: number; path: string };

type RecruiterMetric = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  submissions: number;
  interviews: number;
  rounds: Record<string, number>;
  offers: number;
  placements: number;
  revenue: number;
};

type FunnelStage = {
  stage: string;
  count: number;
};

type TopVendor = {
  name: string;
  count: number;
  percentage: number;
};

type RecentActivity = {
  id: string;
  date: string;
  user: string;
  consultant: string;
  action: string;
  vendor: string;
  job: string;
};

type BenchDashboardData = {
  summary: Summary;
  recruiters: RecruiterMetric[];
  pipelineFunnel: FunnelStage[];
  roundSelections: { label: string; value: number }[];
  topVendors: TopVendor[];
  recentActivities: RecentActivity[];
};

const chartColors = ['#009E92', '#9C7AE6', '#F29A6B', '#F5C45B', '#4FC3D3', '#FF7CA6'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function Dashboard() {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  // Filters state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedDept, setSelectedDept] = useState('All Departments');

  const { dashboardData: contextDashboardData, setDashboardData: setContextDashboardData, selectedUser: selectedUserFromContext, setSelectedUser: setSelectedUserInContext } = useDashboardLayout();
  const [activeDashboard, setActiveDashboard] = useState<string>(currentUser?.dashboardType || 'BENCHSALES');
  const [overviewData, setOverviewData] = useState<any>(null);

  // Sync active dashboard when currentUser changes
  useEffect(() => {
    if (currentUser?.dashboardType) {
      setActiveDashboard(currentUser.dashboardType);
    }
  }, [currentUser]);

  // Dashboard metrics state
  const dashboardData = contextDashboardData as BenchDashboardData | null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected recruiter drawer state
  const selectedUser = selectedUserFromContext as RecruiterMetric | null;
  const setSelectedUser = setSelectedUserInContext;
  const [detailTab, setDetailTab] = useState('Overview');
  const [detailSubs, setDetailSubs] = useState<any[]>([]);
  const [detailInts, setDetailInts] = useState<any[]>([]);
  const [detailOffers, setDetailOffers] = useState<any[]>([]);
  const [detailPlacs, setDetailPlacs] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const roleNormalized = currentUser?.role ? currentUser.role.toUpperCase() : 'SALES';
  const isAdminOrManager = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(roleNormalized);

  // Load dashboard data
  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const filters: Record<string, string> = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (selectedRole !== 'All Roles') filters.role = selectedRole;

      const [data, overview] = await Promise.all([
        api.benchDashboard<BenchDashboardData>(filters),
        api.overview<any>()
      ]);
      setContextDashboardData(data);
      setOverviewData(overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [dateFrom, dateTo, selectedRole]);

  // Load recruiter detailed list when selected
  useEffect(() => {
    if (!selectedUser) return;
    const loadDetails = async () => {
      setDetailLoading(true);
      try {
        const [subsRes, intsRes, offersRes, placsRes] = await Promise.all([
          api.list<any>('submissions', { limit: 100, filters: { ownerName: selectedUser.name } }),
          api.list<any>('bench-interviews', { limit: 100, filters: { ownerName: selectedUser.name } }),
          api.list<any>('bench-offers', { limit: 100, filters: { ownerName: selectedUser.name } }),
          api.list<any>('placements', { limit: 100, filters: { ownerName: selectedUser.name } }),
        ]);
        setDetailSubs(subsRes.data || []);
        setDetailInts(intsRes.data || []);
        setDetailOffers(offersRes.data || []);
        setDetailPlacs(placsRes.data || []);
      } catch (err) {
        console.error('Error loading recruiter details', err);
      } finally {
        setDetailLoading(false);
      }
    };
    void loadDetails();
  }, [selectedUser]);

  // Dynamic round selections for comparison table
  const maxRoundsCount = useMemo(() => {
    if (!dashboardData?.recruiters) return 3;
    let max = 3;
    dashboardData.recruiters.forEach(rec => {
      const keys = Object.keys(rec.rounds);
      keys.forEach(k => {
        const match = k.match(/\d+/);
        if (match) {
          const num = parseInt(match[0]);
          if (num > max) max = num;
        }
      });
    });
    return max;
  }, [dashboardData]);

  const roundColumns = useMemo(() => {
    const cols = [];
    for (let i = 1; i <= maxRoundsCount; i++) {
      cols.push({ key: `Round ${i}`, label: `R${i}` });
    }
    return cols;
  }, [maxRoundsCount]);

  // Recruiter drawer Overview calculations
  const drawerOverviewStats = useMemo(() => {
    const revenue = detailPlacs.reduce((sum, p) => sum + (p.billingRate || 0) * 160, 0);
    const round1Count = detailInts.filter(i => (i.interviewRound || '').toLowerCase().includes('1') && i.result === 'Selected').length;
    const round2Count = detailInts.filter(i => (i.interviewRound || '').toLowerCase().includes('2') && i.result === 'Selected').length;
    const round3Count = detailInts.filter(i => (i.interviewRound || '').toLowerCase().includes('3') && i.result === 'Selected').length;
    const totalNextRound = round1Count + round2Count + round3Count;

    return [
      { label: 'Submissions', value: detailSubs.length, icon: Mail, bg: 'bg-[#D9F5F1]', text: 'text-[#009E92]' },
      { label: 'Interviews', value: detailInts.length, icon: CalendarDays, bg: 'bg-[#F0E6FF]', text: 'text-[#8b5cf6]' },
      { label: 'Next Round', value: totalNextRound, icon: UsersRound, bg: 'bg-[#E0F2FE]', text: 'text-[#3b82f6]' },
      { label: 'Offers Sent', value: detailOffers.length, icon: Handshake, bg: 'bg-[#FEF3C7]', text: 'text-[#e59e0b]' },
      { label: 'Placements', value: detailPlacs.length, icon: CheckCheck, bg: 'bg-[#DCFCE7]', text: 'text-[#22c55e]' },
      { label: 'Revenue', value: formatCurrency(revenue), icon: CircleDollarSign, bg: 'bg-[#EDE9FE]', text: 'text-[#7c3aed]' },
    ];
  }, [detailSubs, detailInts, detailOffers, detailPlacs]);

  const drawerSubmissionsByVendor = useMemo(() => {
    const vendorsMap = new Map<string, any>();
    const getOrCreate = (vendor: string) => {
      if (!vendorsMap.has(vendor)) {
        vendorsMap.set(vendor, { vendor, submissions: 0, interviews: 0, selected: 0, offers: 0, placed: 0 });
      }
      return vendorsMap.get(vendor);
    };

    detailSubs.forEach(s => {
      const v = s.vendorCompany || 'Unknown';
      getOrCreate(v).submissions++;
    });

    detailInts.forEach(i => {
      const v = i.vendorCompany || 'Unknown';
      const entry = getOrCreate(v);
      entry.interviews++;
      if (i.status === 'Completed' && i.result === 'Selected') {
        entry.selected++;
      }
    });

    detailOffers.forEach(o => {
      const v = o.vendorCompany || 'Unknown';
      getOrCreate(v).offers++;
    });

    detailPlacs.forEach(p => {
      const v = p.vendorCompany || 'Unknown';
      getOrCreate(v).placed++;
    });

    const list = [...vendorsMap.values()];
    const totals = list.reduce(
      (acc, cur) => {
        acc.submissions += cur.submissions;
        acc.interviews += cur.interviews;
        acc.selected += cur.selected;
        acc.offers += cur.offers;
        acc.placed += cur.placed;
        return acc;
      },
      { vendor: 'Total', submissions: 0, interviews: 0, selected: 0, offers: 0, placed: 0 }
    );

    return { list, totals };
  }, [detailSubs, detailInts, detailOffers, detailPlacs]);

  const drawerInterviewRoundsTable = useMemo(() => {
    const roundsMap = new Map<string, any>();
    const getOrCreate = (round: string) => {
      if (!roundsMap.has(round)) {
        roundsMap.set(round, { round, selected: 0, nextRound: 0, rejected: 0 });
      }
      return roundsMap.get(round);
    };

    detailInts.forEach(i => {
      const rnd = i.interviewRound || 'Round 1';
      const entry = getOrCreate(rnd);
      if (i.status === 'Completed' && i.result === 'Selected') {
        entry.selected++;
      } else if (i.result === 'Next Round') {
        entry.nextRound++;
      } else if (i.result === 'Rejected') {
        entry.rejected++;
      }
    });

    return [...roundsMap.values()].sort((a, b) => a.round.localeCompare(b.round));
  }, [detailInts]);

  // Personal statistics for logged-in Recruiter
  const personalKPIs = useMemo(() => {
    if (!dashboardData?.recruiters || isAdminOrManager) return [];
    const rec = dashboardData.recruiters[0];
    if (!rec) return [];
    
    return [
      { label: 'Submissions', value: rec.submissions, delta: 12, icon: Mail, bg: 'bg-[#D9F5F1]', text: 'text-[#009E92]' },
      { label: 'Offers Sent', value: rec.offers, delta: 15, icon: Handshake, bg: 'bg-[#FEF3C7]', text: 'text-[#e59e0b]' },
      { label: 'Placements', value: rec.placements, delta: 20, icon: CheckCheck, bg: 'bg-[#DCFCE7]', text: 'text-[#22c55e]' },
      { label: 'Total Revenue', value: formatCurrency(rec.revenue), delta: 22, icon: CircleDollarSign, bg: 'bg-[#EDE9FE]', text: 'text-[#7c3aed]' },
    ];
  }, [dashboardData, isAdminOrManager]);

  const personalActivities = useMemo(() => {
    if (!dashboardData?.recentActivities || isAdminOrManager) return [];
    return dashboardData.recentActivities.slice(0, 10);
  }, [dashboardData, isAdminOrManager]);

  return (
    <div className="min-h-screen bg-[#F7FAFC] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1450px]">
        
        {/* Top Header & Filters */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-[24px] font-black text-[#071B4A]">
              {activeDashboard === 'SALES' ? 'Sales & Marketing Dashboard' :
               activeDashboard === 'RECRUITER' ? 'IT Recruitment Dashboard' :
               activeDashboard === 'AITEAM' ? 'AI Projects Dashboard' :
               isAdminOrManager ? 'Admin Dashboard' : 'Recruiter Dashboard'}
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
             {/* Date Filters */}
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#E4ECF3] bg-white px-3 py-1.5 shadow-sm">
              <CalendarDays className="h-4 w-4 text-[#009E92]" />
              <input
                type="date"
                className="bg-transparent text-[13px] font-semibold text-[#071B4A] outline-none"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-slate-400 font-bold">—</span>
              <input
                type="date"
                className="bg-transparent text-[13px] font-semibold text-[#071B4A] outline-none"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
 
            {/* Dashboard Switcher (Admins only) */}
            {['SUPER_ADMIN', 'ADMIN'].includes(String(currentUser?.role).toUpperCase()) && (
              <div className="relative">
                <select
                  className="appearance-none rounded-lg border border-[#E4ECF3] bg-white pl-4 pr-10 py-2 text-[13px] font-bold text-[#009E92] shadow-sm outline-none cursor-pointer"
                  value={activeDashboard}
                  onChange={(e) => setActiveDashboard(e.target.value)}
                >
                  <option value="BENCHSALES">Bench Sales Dashboard</option>
                  <option value="SALES">Sales Dashboard</option>
                  <option value="RECRUITER">Recruitment Dashboard</option>
                  <option value="AITEAM">AI Team Dashboard</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#009E92] pointer-events-none" />
              </div>
            )}
 
            {/* Role dropdown */}
            {isAdminOrManager && activeDashboard === 'BENCHSALES' && (
              <div className="relative">
                <select
                  className="appearance-none rounded-lg border border-[#E4ECF3] bg-white pl-4 pr-10 py-2 text-[13px] font-bold text-[#071B4A] shadow-sm outline-none cursor-pointer"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="All Roles">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="SALES">Sales & Marketing</option>
                  <option value="RECRUITER">IT Recruitment</option>
                  <option value="BENCHSALES">Bench Sales</option>
                  <option value="AITEAM">AI Team</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-2xl border border-[#E4ECF3] bg-white p-10 text-center text-[14px] font-semibold text-slate-400">Loading dashboard analytics…</div>
        ) : (
          <div className="w-full">
            {/* Main Area */}
            <div className="space-y-6 min-w-0">
              
              {/* Top Summary Cards */}
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {activeDashboard === 'SALES' ? (
                  <>
                    <SummaryCard label="Total Leads" value={overviewData?.leads ?? 0} delta={8} deltaText="vs last month" icon={BriefcaseBusiness} bg="bg-[#E0F2FE]" text="text-[#3b82f6]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Total Contacts" value={overviewData?.contacts ?? 0} delta={12} deltaText="vs last month" icon={UsersRound} bg="bg-[#D9F5F1]" text="text-[#009E92]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Total Accounts" value={overviewData?.accounts ?? 0} delta={5} deltaText="vs last month" icon={Wallet} bg="bg-[#FEF3C7]" text="text-[#e59e0b]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Total Opportunities" value={overviewData?.opportunities ?? 0} delta={18} deltaText="vs last month" icon={Handshake} bg="bg-[#DCFCE7]" text="text-[#22c55e]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Pipeline Value" value={formatCurrency(overviewData?.pipelineValue ?? 0)} delta={22} deltaText="vs last month" icon={CircleDollarSign} bg="bg-[#EDE9FE]" text="text-[#7c3aed]" className="min-w-[175px] flex-1" />
                  </>
                ) : activeDashboard === 'RECRUITER' ? (
                  <>
                    <SummaryCard label="Candidates" value={overviewData?.candidates ?? 0} delta={10} deltaText="vs last month" icon={UsersRound} bg="bg-[#E0F2FE]" text="text-[#3b82f6]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Open Jobs" value={overviewData?.jobs ?? 0} delta={6} deltaText="vs last month" icon={BriefcaseBusiness} bg="bg-[#D9F5F1]" text="text-[#009E92]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Interviews" value={overviewData?.benchInterviews ?? 0} delta={15} deltaText="vs last month" icon={Clock3} bg="bg-[#FEF3C7]" text="text-[#e59e0b]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Offers" value={overviewData?.benchOffers ?? 0} delta={12} deltaText="vs last month" icon={Handshake} bg="bg-[#DCFCE7]" text="text-[#22c55e]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Placements" value={overviewData?.placements ?? 0} delta={20} deltaText="vs last month" icon={CheckCheck} bg="bg-[#EDE9FE]" text="text-[#7c3aed]" className="min-w-[175px] flex-1" />
                  </>
                ) : activeDashboard === 'AITEAM' ? (
                  <>
                    <SummaryCard label="AI Projects" value={overviewData?.aiProjects ?? 0} delta={14} deltaText="vs last month" icon={BriefcaseBusiness} bg="bg-[#E0F2FE]" text="text-[#3b82f6]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Total Tasks" value={overviewData?.tasks ?? 0} delta={20} deltaText="vs last month" icon={Clock3} bg="bg-[#D9F5F1]" text="text-[#009E92]" className="min-w-[175px] flex-1" />
                  </>
                ) : isAdminOrManager ? (
                  <>
                    <SummaryCard label="Total Users" value={dashboardData?.summary.totalUsers ?? 0} delta={5} deltaText="vs last month" icon={UsersRound} bg="bg-[#E0F2FE]" text="text-[#3b82f6]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Total Submissions" value={dashboardData?.summary.totalSubmissions ?? 0} delta={14} deltaText="vs last month" icon={Mail} bg="bg-[#D9F5F1]" text="text-[#009E92]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Offers Sent" value={dashboardData?.summary.totalOffers ?? 0} delta={12} deltaText="vs last month" icon={Handshake} bg="bg-[#FEF3C7]" text="text-[#e59e0b]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Placements" value={dashboardData?.summary.totalPlacements ?? 0} delta={20} deltaText="vs last month" icon={CheckCheck} bg="bg-[#DCFCE7]" text="text-[#22c55e]" className="min-w-[175px] flex-1" />
                    <SummaryCard label="Total Revenue" value={formatCurrency(dashboardData?.summary.totalRevenue ?? 0)} delta={22} deltaText="vs last month" icon={CircleDollarSign} bg="bg-[#EDE9FE]" text="text-[#7c3aed]" className="min-w-[175px] flex-1" />
                  </>
                ) : (
                  personalKPIs.map((card) => (
                    <SummaryCard
                      key={card.label}
                      label={card.label}
                      value={card.value}
                      delta={card.delta}
                      deltaText="vs last month"
                      icon={card.icon}
                      bg={card.bg}
                      text={card.text}
                      className="min-w-[175px] flex-1"
                    />
                  ))
                )}
              </div>

              {/* User Performance Comparison Table */}
              {activeDashboard === 'BENCHSALES' && isAdminOrManager && dashboardData && (
                <div className="crm-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] font-black text-[#071B4A]">User Performance Overview</h2>
                  </div>
                  
                  <div className="overflow-x-auto md:overflow-x-visible">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-left" style={{ width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '15%' }} />
                        {roundColumns.map((col) => (
                          <col key={col.key} style={{ width: '6%' }} />
                        ))}
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '4%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400 align-middle">User Name</th>
                          <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400 align-middle">Role</th>
                          <th className="pb-3 pr-3 text-center text-[11px] font-black uppercase text-slate-400 align-middle whitespace-nowrap px-2">Submissions</th>
                          <th className="pb-3 pr-3 text-center align-middle whitespace-nowrap px-2">
                            <span className="block text-[11px] font-black uppercase leading-[1.05] text-slate-400">Interviews</span>
                            <span className="block text-[11px] font-black uppercase leading-[1.05] text-slate-400">Scheduled</span>
                          </th>
                          {roundColumns.map((col) => (
                            <th key={col.key} className="pb-3 pr-3 text-center text-[11px] font-black uppercase text-slate-400 align-middle whitespace-nowrap px-1">{col.label}</th>
                          ))}
                          <th className="pb-3 pr-3 text-center text-[11px] font-black uppercase text-slate-400 align-middle whitespace-nowrap px-2">Offers Sent</th>
                          <th className="pb-3 pr-3 text-center text-[11px] font-black uppercase text-slate-400 align-middle whitespace-nowrap px-2">Placements</th>
                          <th className="pb-3 pr-3 text-right text-[11px] font-black uppercase text-slate-400 align-middle whitespace-nowrap px-2">Revenue</th>
                          <th className="pb-3 w-10 align-middle"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.recruiters.map((rec) => (
                          <tr key={rec.id} className="align-middle hover:bg-slate-50">
                            <td className="border-t border-[#E4ECF3] py-3 pr-3 text-[13px] font-black text-[#071B4A] align-middle">{rec.name}</td>
                            <td className="border-t border-[#E4ECF3] py-3 pr-3 text-[12px] text-slate-500 align-middle">{rec.role === 'BENCHSALES' ? 'Bench Sales' : rec.role}</td>
                            <td className="border-t border-[#E4ECF3] py-3 pr-3 text-center text-[13px] font-bold text-slate-600 align-middle">{rec.submissions}</td>
                            <td className="border-t border-[#E4ECF3] py-3 pr-3 text-center text-[13px] font-bold text-slate-600 align-middle">{rec.interviews}</td>
                            {roundColumns.map((col) => (
                              <td key={`${rec.id}-${col.key}`} className="border-t border-[#E4ECF3] py-3 pr-3 text-center text-[13px] text-slate-500 align-middle">
                                {rec.rounds[col.key] || '—'}
                              </td>
                            ))}
                            <td className="border-t border-[#E4ECF3] py-3 pr-3 text-center text-[13px] font-bold text-slate-600 align-middle">{rec.offers}</td>
                            <td className="border-t border-[#E4ECF3] py-3 pr-3 text-center text-[13px] font-bold text-slate-600 align-middle">{rec.placements}</td>
                            <td className="border-t border-[#E4ECF3] py-3 pr-3 text-right text-[13px] font-black text-[#009E92] align-middle">{formatCurrency(rec.revenue)}</td>
                            <td className="border-t border-[#E4ECF3] py-3 text-right align-middle">
                              <button onClick={() => setSelectedUser(rec)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pipeline charts (only for BENCHSALES) */}
              {activeDashboard === 'BENCHSALES' && dashboardData && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <ActionDashboardCard title="Action Required" items={dashboardData.summary.attention ?? []} onNavigate={navigate} />
                  <ActionDashboardCard title="Today's Activity" items={dashboardData.summary.todayActions ?? []} onNavigate={navigate} />
                  <div className="crm-card p-4">
                    <h3 className="mb-3 text-[14px] font-black text-[#071B4A]">Bench Aging</h3>
                    <div className="space-y-2.5">
                      {(dashboardData.summary.agingBuckets ?? []).map((bucket) => {
                        const max = Math.max(...(dashboardData.summary.agingBuckets ?? []).map((item) => item.count), 1);
                        return <button key={bucket.label} onClick={() => navigate(`/bench?aging=${bucket.min}-${bucket.max === Infinity ? 'plus' : bucket.max}`)} className="group flex w-full items-center gap-2 text-left text-[11px] text-slate-600">
                          <span className="w-[68px] shrink-0 font-semibold">{bucket.label}</span>
                          <span className="h-5 flex-1 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded bg-[#009E92] transition group-hover:bg-[#007f75]" style={{ width: `${Math.max(bucket.count ? 8 : 0, bucket.count / max * 100)}%` }} /></span>
                          <strong className="w-6 text-right text-[#071B4A]">{bucket.count}</strong>
                        </button>;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeDashboard === 'BENCHSALES' && dashboardData && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  
                  {/* Dynamic CSS Funnel Chart */}
                  <div className="crm-card p-5 flex min-w-0 flex-col h-full">
                    <h3 className="mb-4 text-[14px] font-black text-[#071B4A]">Pipeline Funnel (All Users)</h3>
                    <div className="flex-1 flex flex-col justify-center space-y-2">
                      {dashboardData.pipelineFunnel.map((item, index) => {
                        const maxValue = Math.max(...dashboardData.pipelineFunnel.map((f) => f.count), 1);
                        const widthPercent = Math.max(12, Math.round((item.count / maxValue) * 100));
                        return (
                          <div key={item.stage} className="flex min-w-0 items-center gap-3">
                            <div className="w-[92px] shrink-0 text-right text-[11px] font-bold text-slate-400 truncate" title={item.stage}>{item.stage}</div>
                            <div className="min-w-0 flex-1">
                              <div className="h-7 w-full overflow-hidden rounded bg-slate-50">
                                <div
                                  className="h-full flex items-center justify-center rounded text-white text-[11px] font-black transition-all shadow-sm"
                                  style={{
                                    width: `${Math.min(Math.max(widthPercent, item.count ? 8 : 0), 100)}%`,
                                    minWidth: item.count ? '30px' : '0px',
                                    maxWidth: '100%',
                                    background: chartColors[index % chartColors.length],
                                  }}
                                >
                                  {item.count}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Round Wise Selections Bar Chart */}
                  <div className="crm-card min-w-0 p-5 h-full">
                    <h3 className="mb-4 text-[14px] font-black text-[#071B4A]">Round Wise Selections (All Users)</h3>
                    <div className="h-[220px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.roundSelections} margin={{ left: 8, right: 8 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={34} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#9C7AE6" barSize={34}>
                            {dashboardData.roundSelections.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={chartColors[(idx + 1) % chartColors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Vendors Pie Chart */}
                  <div className="crm-card min-w-0 p-5 h-full">
                    <h3 className="mb-4 text-[14px] font-black text-[#071B4A]">Top Vendors (By Submissions)</h3>
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="h-[140px] w-[140px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={dashboardData.topVendors}
                              dataKey="count"
                              nameKey="name"
                              innerRadius={35}
                              outerRadius={55}
                              stroke="none"
                            >
                              {dashboardData.topVendors.map((_, idx) => (
                                <Cell key={`cell-${idx}`} fill={chartColors[idx % chartColors.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[16px] font-black text-[#071B4A]">{dashboardData.summary.totalSubmissions}</span>
                          <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Total</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 w-full space-y-1">
                        {dashboardData.topVendors.map((item, idx) => (
                          <div key={item.name} className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="flex items-center gap-1.5 font-bold">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: chartColors[idx % chartColors.length] }} />
                              <span className="truncate max-w-[120px]">{item.name}</span>
                            </span>
                            <span className="font-extrabold text-[#071B4A]">{item.count} ({item.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {activeDashboard === 'BENCHSALES' && dashboardData && (
                <div className="crm-card p-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-black text-[#071B4A]">Conversion Metrics</h3><span className="text-[10px] font-semibold text-slate-400">Selected dashboard period</span></div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {(dashboardData.summary.conversion ?? []).map((metric) => <div key={metric.label} className="rounded-lg border border-[#E4ECF3] bg-[#F7FAFC] px-3 py-2.5"><div className="text-[11px] font-semibold text-slate-500">{metric.label}</div><div className="mt-1 text-xl font-black text-[#009E92]">{metric.value}</div></div>)}
                  </div>
                </div>
              )}

              {/* Recent Activities feed / Recruiters Own Dashboard layout */}
              {activeDashboard === 'BENCHSALES' && isAdminOrManager ? (
                dashboardData && (
                  <div className="crm-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-[16px] font-black text-[#071B4A]">Recent Activities (All Users)</h3>
                      <button onClick={() => navigate('/activities')} className="text-[12px] font-bold text-[#009E92] hover:underline">View All</button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-0 text-left">
                        <thead>
                          <tr>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Date</th>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">User</th>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Consultant</th>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Action</th>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Vendor</th>
                            <th className="pb-3 text-[11px] font-black uppercase text-slate-400">Job</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.recentActivities.map((act) => (
                            <tr key={act.id} className="hover:bg-slate-50">
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[12px] text-slate-500">
                                {new Date(act.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </td>
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[13px] font-bold text-[#071B4A]">{act.user}</td>
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[13px] font-semibold text-slate-700">{act.consultant}</td>
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[12px] text-slate-600">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  act.action.includes('placed') || act.action.includes('placed') || act.action.includes('Candidate placed')
                                    ? 'bg-green-50 text-green-700'
                                    : act.action.includes('offer')
                                    ? 'bg-amber-50 text-amber-700'
                                    : act.action.includes('interview')
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'bg-cyan-50 text-cyan-700'
                                }`}>
                                  {act.action}
                                </span>
                              </td>
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[13px] text-slate-600">{act.vendor}</td>
                              <td className="border-t border-[#E4ECF3] py-2.5 text-[13px] text-slate-600">{act.job}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : (
                // Non-admin Recruiter Layout (Self Overview)
                dashboardData && dashboardData.recentActivities && (
                  <div className="crm-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-[16px] font-black text-[#071B4A]">Recent Activities</h3>
                      <button onClick={() => navigate('/activities')} className="text-[12px] font-bold text-[#009E92] hover:underline">View All</button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-0 text-left">
                        <thead>
                          <tr>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Date</th>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Consultant</th>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Action</th>
                            <th className="pb-3 pr-3 text-[11px] font-black uppercase text-slate-400">Vendor</th>
                            <th className="pb-3 text-[11px] font-black uppercase text-slate-400">Job</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalActivities.map((act) => (
                            <tr key={act.id} className="hover:bg-slate-50">
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[12px] text-slate-500">
                                {new Date(act.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </td>
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[13px] font-semibold text-slate-700">{act.consultant}</td>
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[12px] text-slate-600">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  act.action.includes('placed') || act.action.includes('placed') || act.action.includes('Candidate placed')
                                    ? 'bg-green-50 text-green-700'
                                    : act.action.includes('offer')
                                    ? 'bg-amber-50 text-amber-700'
                                    : act.action.includes('interview')
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'bg-cyan-50 text-cyan-700'
                                }`}>
                                  {act.action}
                                </span>
                              </td>
                              <td className="border-t border-[#E4ECF3] py-2.5 pr-3 text-[13px] text-slate-600">{act.vendor}</td>
                              <td className="border-t border-[#E4ECF3] py-2.5 text-[13px] text-slate-600">{act.job}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}

            </div>
          </div>
        )}

      </div>

      {/* sliding panel (User Performance Details Drawer) */}
      {selectedUser && (
        <>
          {/* Overlay backdrop */}
          <div onClick={() => setSelectedUser(null)} className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px]" />
          
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[650px] bg-white border-l border-[#E4ECF3] flex flex-col shadow-2xl transition-transform duration-300">
            
            {/* Drawer Header */}
            <div className="border-b border-[#E4ECF3] p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#009E92] text-white text-base font-extrabold">
                  {selectedUser.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                </span>
                <div>
                  <h2 className="text-[18px] font-black text-[#071B4A]">{selectedUser.name}</h2>
                  <p className="text-[12px] font-bold text-slate-400">{selectedUser.role === 'BENCHSALES' ? 'Bench Sales' : selectedUser.role} • {selectedUser.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Stats in header */}
                <div className="flex gap-4 text-right">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Total Submissions</div>
                    <div className="text-[15px] font-black text-[#071B4A]">{selectedUser.submissions}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Total Placements</div>
                    <div className="text-[15px] font-black text-[#071B4A]">{selectedUser.placements}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Total Revenue</div>
                    <div className="text-[15px] font-black text-[#009E92]">{formatCurrency(selectedUser.revenue)}</div>
                  </div>
                </div>
                
                <button onClick={() => setSelectedUser(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-[#E4ECF3] bg-slate-50 px-4">
              {['Overview', 'Submissions', 'Interviews', 'Rounds', 'Offers', 'Placements', 'Activity'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`border-b-2 px-3 py-3 text-[12px] font-bold transition ${
                    detailTab === tab
                      ? 'border-[#009E92] text-[#009E92]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="py-12 text-center text-[13px] font-semibold text-slate-400">Loading details…</div>
              ) : (
                <>
                  {detailTab === 'Overview' && (
                    <div className="space-y-6">
                      
                      {/* Overview Grid Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {drawerOverviewStats.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={item.label} className="rounded-xl border border-[#E4ECF3] bg-slate-50/50 p-3.5">
                              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${item.bg}`}>
                                <Icon className={`h-4.5 w-4.5 ${item.text}`} />
                              </div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</div>
                              <div className="mt-1 text-[20px] font-black text-[#071B4A]">{item.value}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Submissions by Vendor Table */}
                      <div className="rounded-xl border border-[#E4ECF3] p-4 bg-white">
                        <h4 className="mb-3 text-[13px] font-black text-[#071B4A]">Submissions by Vendor</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left">
                            <thead>
                              <tr>
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase">Vendor</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Submissions</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Interview Scheduled</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Selected</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Offers</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Placed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drawerSubmissionsByVendor.list.map((row) => (
                                <tr key={row.vendor} className="hover:bg-slate-50">
                                  <td className="border-t border-[#E4ECF3] py-2 text-[12px] font-bold text-slate-700">{row.vendor}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] font-semibold text-slate-600">{row.submissions}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] text-slate-500">{row.interviews}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] text-slate-500">{row.selected}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] text-slate-500">{row.offers}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] text-slate-500">{row.placed}</td>
                                </tr>
                              ))}
                              {/* Total Row */}
                              <tr className="bg-slate-50/70 font-bold">
                                <td className="border-t border-[#E4ECF3] py-2.5 text-[12px] text-[#071B4A]">Total</td>
                                <td className="border-t border-[#E4ECF3] py-2.5 text-center text-[12px] text-[#071B4A]">{drawerSubmissionsByVendor.totals.submissions}</td>
                                <td className="border-t border-[#E4ECF3] py-2.5 text-center text-[12px] text-[#071B4A]">{drawerSubmissionsByVendor.totals.interviews}</td>
                                <td className="border-t border-[#E4ECF3] py-2.5 text-center text-[12px] text-[#071B4A]">{drawerSubmissionsByVendor.totals.selected}</td>
                                <td className="border-t border-[#E4ECF3] py-2.5 text-center text-[12px] text-[#071B4A]">{drawerSubmissionsByVendor.totals.offers}</td>
                                <td className="border-t border-[#E4ECF3] py-2.5 text-center text-[12px] text-[#071B4A]">{drawerSubmissionsByVendor.totals.placed}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Interview Rounds Table */}
                      <div className="rounded-xl border border-[#E4ECF3] p-4 bg-white">
                        <h4 className="mb-3 text-[13px] font-black text-[#071B4A]">Interview Rounds</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left">
                            <thead>
                              <tr>
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase">Round</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Selected</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Moved to Next Round</th>
                                <th className="pb-2 text-center text-[10px] font-bold text-slate-400 uppercase">Rejected</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drawerInterviewRoundsTable.map((row) => (
                                <tr key={row.round} className="hover:bg-slate-50">
                                  <td className="border-t border-[#E4ECF3] py-2 text-[12px] font-bold text-slate-700">{row.round}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] text-[#009E92] font-semibold">{row.selected || '—'}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] text-blue-600 font-semibold">{row.nextRound || '—'}</td>
                                  <td className="border-t border-[#E4ECF3] py-2 text-center text-[12px] text-red-600 font-semibold">{row.rejected || '—'}</td>
                                </tr>
                              ))}
                              {drawerInterviewRoundsTable.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-4 text-center text-[12px] text-slate-400">No interviews logged yet</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pipeline Stage Overview horizontal node bar */}
                      <div className="rounded-xl border border-[#E4ECF3] p-4 bg-white">
                        <h4 className="mb-4 text-[13px] font-black text-[#071B4A]">Pipeline Stage Overview</h4>
                        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
                          
                          <PipelineNode count={detailSubs.length} label="Submitted" active={true} />
                          <PipelineArrow />
                          
                          <PipelineNode count={detailInts.length} label="Interview Scheduled" active={detailInts.length > 0} />
                          <PipelineArrow />
                          
                          <PipelineNode count={detailInts.filter(i => i.result === 'Next Round').length} label="Next Round" active={detailInts.some(i => i.result === 'Next Round')} />
                          <PipelineArrow />
                          
                          <PipelineNode count={detailOffers.length} label="Offers Sent" active={detailOffers.length > 0} />
                          <PipelineArrow />
                          
                          <PipelineNode count={detailPlacs.length} label="Placed" active={detailPlacs.length > 0} />
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Submissions Tab */}
                  {detailTab === 'Submissions' && (
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-black text-[#071B4A]">Submissions ({detailSubs.length})</h4>
                      <div className="space-y-2">
                        {detailSubs.map((row) => (
                          <div key={row.id} className="rounded-xl border border-[#E4ECF3] p-3 flex justify-between items-start hover:bg-slate-50 transition">
                            <div>
                              <div className="text-[13px] font-black text-[#071B4A]">{row.candidateName}</div>
                              <div className="text-[11px] text-slate-500">{row.jobTitle} • {row.vendorCompany}</div>
                              <div className="mt-1.5 text-[10px] font-bold text-slate-400">Date: {row.submissionDate}</div>
                            </div>
                            <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700">{row.status}</span>
                          </div>
                        ))}
                        {detailSubs.length === 0 && <div className="py-8 text-center text-[12px] text-slate-400">No submissions found</div>}
                      </div>
                    </div>
                  )}

                  {/* Interviews Tab */}
                  {detailTab === 'Interviews' && (
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-black text-[#071B4A]">Interviews ({detailInts.length})</h4>
                      <div className="space-y-2">
                        {detailInts.map((row) => (
                          <div key={row.id} className="rounded-xl border border-[#E4ECF3] p-3 flex justify-between items-start hover:bg-slate-50 transition">
                            <div>
                              <div className="text-[13px] font-black text-[#071B4A]">{row.candidateName}</div>
                              <div className="text-[11px] text-slate-500">{row.interviewRound} round • {row.clientCompany} ({row.vendorCompany})</div>
                              {row.interviewDate && (
                                <div className="mt-1 text-[11px] font-semibold text-slate-600">
                                  {row.interviewDate} at {row.interviewTime || 'TBD'}
                                </div>
                              )}
                              {row.feedback && (
                                <div className="mt-2 text-[11px] text-slate-400 bg-slate-50 p-2 rounded border border-slate-100">
                                  Feedback: {row.feedback}
                                </div>
                              )}
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              row.status === 'Completed' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'
                            }`}>{row.status}</span>
                          </div>
                        ))}
                        {detailInts.length === 0 && <div className="py-8 text-center text-[12px] text-slate-400">No interviews found</div>}
                      </div>
                    </div>
                  )}

                  {/* Rounds Tab */}
                  {detailTab === 'Rounds' && (
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-black text-[#071B4A]">Interview Rounds Details</h4>
                      <div className="space-y-3">
                        {drawerInterviewRoundsTable.map((row) => (
                          <div key={row.round} className="rounded-xl border border-[#E4ECF3] p-4">
                            <h5 className="text-[13px] font-black text-[#071B4A] border-b border-[#E4ECF3] pb-1.5 mb-3">{row.round}</h5>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-green-50/50 p-2 rounded-lg border border-green-100">
                                <div className="text-[9px] uppercase tracking-wider font-semibold text-green-700">Selected</div>
                                <div className="text-[16px] font-black text-green-700 mt-0.5">{row.selected}</div>
                              </div>
                              <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                <div className="text-[9px] uppercase tracking-wider font-semibold text-blue-700">Next Round</div>
                                <div className="text-[16px] font-black text-blue-700 mt-0.5">{row.nextRound}</div>
                              </div>
                              <div className="bg-red-50/50 p-2 rounded-lg border border-red-100">
                                <div className="text-[9px] uppercase tracking-wider font-semibold text-red-700">Rejected</div>
                                <div className="text-[16px] font-black text-red-700 mt-0.5">{row.rejected}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {drawerInterviewRoundsTable.length === 0 && <div className="py-8 text-center text-[12px] text-slate-400">No round metrics available</div>}
                      </div>
                    </div>
                  )}

                  {/* Offers Tab */}
                  {detailTab === 'Offers' && (
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-black text-[#071B4A]">Offers ({detailOffers.length})</h4>
                      <div className="space-y-2">
                        {detailOffers.map((row) => (
                          <div key={row.id} className="rounded-xl border border-[#E4ECF3] p-3 flex justify-between items-start hover:bg-slate-50 transition">
                            <div>
                              <div className="text-[13px] font-black text-[#071B4A]">{row.candidateName}</div>
                              <div className="text-[11px] text-slate-500">{row.jobTitle} • {row.clientCompany}</div>
                              <div className="mt-1 text-[11px] font-bold text-[#009E92]">Rate: {formatCurrency(row.billRate)}/hr</div>
                              <div className="mt-1 text-[10px] font-bold text-slate-400">Date: {row.offerDate}</div>
                            </div>
                            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">{row.status}</span>
                          </div>
                        ))}
                        {detailOffers.length === 0 && <div className="py-8 text-center text-[12px] text-slate-400">No offers found</div>}
                      </div>
                    </div>
                  )}

                  {/* Placements Tab */}
                  {detailTab === 'Placements' && (
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-black text-[#071B4A]">Placements ({detailPlacs.length})</h4>
                      <div className="space-y-2">
                        {detailPlacs.map((row) => (
                          <div key={row.id} className="rounded-xl border border-[#E4ECF3] p-3 flex justify-between items-start hover:bg-slate-50 transition">
                            <div>
                              <div className="text-[13px] font-black text-[#071B4A]">{row.candidateName}</div>
                              <div className="text-[11px] text-slate-500">{row.clientCompany} ({row.vendorCompany})</div>
                              <div className="mt-1 text-[11px] font-bold text-[#009E92]">Billing: {formatCurrency(row.billingRate)}/hr • Est. Monthly: {formatCurrency(row.billingRate * 160)}</div>
                              <div className="mt-1 text-[10px] font-bold text-slate-400">Start Date: {row.startDate || '—'}</div>
                            </div>
                            <span className="inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-bold text-green-700">{row.status}</span>
                          </div>
                        ))}
                        {detailPlacs.length === 0 && <div className="py-8 text-center text-[12px] text-slate-400">No placements found</div>}
                      </div>
                    </div>
                  )}

                  {/* Recruiter-specific Activity Timeline */}
                  {detailTab === 'Activity' && (
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-black text-[#071B4A]">User Activity History</h4>
                      <div className="relative border-l-2 border-slate-100 pl-4 ml-2 space-y-4 py-2">
                        {detailSubs.slice(0, 10).map((s, idx) => (
                          <div key={`sub-act-${idx}`} className="relative">
                            <span className="absolute -left-[21px] top-1 flex h-2 w-2 rounded-full bg-[#009E92]" />
                            <div className="text-[12px] font-bold text-slate-700">Submitted consultant to vendor</div>
                            <div className="text-[11px] text-slate-500">{s.candidateName} to {s.vendorCompany} for {s.jobTitle}</div>
                            <div className="text-[9px] font-bold text-slate-400 mt-0.5">{s.submissionDate}</div>
                          </div>
                        ))}
                        {detailInts.slice(0, 10).map((i, idx) => (
                          <div key={`int-act-${idx}`} className="relative">
                            <span className="absolute -left-[21px] top-1 flex h-2 w-2 rounded-full bg-purple-500" />
                            <div className="text-[12px] font-bold text-slate-700">{i.status === 'Scheduled' ? 'Interview scheduled' : 'Interview completed'}</div>
                            <div className="text-[11px] text-slate-500">{i.candidateName} — {i.interviewRound} round with {i.clientCompany}</div>
                            <div className="text-[9px] font-bold text-slate-400 mt-0.5">{i.interviewDate}</div>
                          </div>
                        ))}
                        {detailSubs.length === 0 && detailInts.length === 0 && (
                          <div className="text-[12px] text-slate-400">No activity logged yet</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
}

// Summary Card helper component
function SummaryCard({ label, value, icon: Icon, bg, text, className = '' }: { label: string; value: string | number; delta?: number; deltaText?: string; icon: any; bg: string; text: string; className?: string }) {
  return (
    <div className={`crm-card p-4 flex-shrink-0 ${className}`}>
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${bg}`}>
        <Icon className={`h-4.5 w-4.5 ${text}`} />
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">{label}</div>
      <div className="mt-2 text-[22px] font-black leading-none text-[#071B4A] truncate">{String(value)}</div>
    </div>
  );
}

function ActionDashboardCard({ title, items, onNavigate }: { title: string; items: DashboardAction[]; onNavigate: (path: string) => void }) {
  return <div className="crm-card p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-black text-[#071B4A]">{title}</h3><span className="text-[10px] font-semibold text-slate-400">Needs attention</span></div><div className="space-y-1">{items.map((item) => <button key={item.key} type="button" onClick={() => onNavigate(item.path)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-slate-600 transition hover:bg-[#D9F5F1]/50 hover:text-[#008277]"><span className="truncate pr-3">{item.label}</span><span className="min-w-7 rounded-full bg-[#D9F5F1] px-2 py-0.5 text-center font-black text-[#008277]">{item.count}</span></button>)}</div></div>;
}

// Pipeline stage nodes visual components
function PipelineNode({ count, label, active }: { count: number; label: string; active: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-[13px] font-extrabold transition ${
        active
          ? 'bg-[#D9F5F1] border-[#009E92] text-[#009E92]'
          : 'bg-slate-50 border-slate-200 text-slate-400'
      }`}>
        {count}
      </div>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500 max-w-[70px] truncate" title={label}>{label}</span>
    </div>
  );
}

function PipelineArrow() {
  return (
    <div className="pb-4">
      <ArrowRight className="h-4 w-4 text-slate-300" />
    </div>
  );
}
