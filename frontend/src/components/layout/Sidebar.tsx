import {
  BarChart3, Bot, BriefcaseBusiness, Building2, CheckSquare2, ChevronLeft, ChevronRight, Contact,
  FileBarChart, Handshake, LayoutDashboard, Mail, Megaphone, PackageCheck, Settings,
  Target, UserCog, UserRound, UsersRound, CalendarCheck2, ClipboardList, Send, Sparkles, X, ChevronDown, List,
  Plus, UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { useDashboardLayout } from '@/context/DashboardLayoutContext';

type NavChild = { label: string; path: string; icon: typeof List; permission: string };
type NavItem = { label: string; path: string; icon: typeof List; permission: string; children?: NavChild[] };
type NavSection = { title: string; items: NavItem[] };

const moduleItem = (item: Omit<NavItem, 'children'>, primaryLabel?: string, importLabel?: string, listLabel = `${item.label} List`): NavItem => ({
  ...item,
  children: [
    { label: listLabel, path: item.path, icon: List, permission: item.permission },
    ...(primaryLabel ? [{ label: primaryLabel, path: `${item.path}?action=add`, icon: Plus, permission: item.permission }] : []),
    ...(importLabel ? [{ label: importLabel, path: `${item.path}?action=import`, icon: UploadCloud, permission: item.permission }] : []),
  ],
});

const sections: NavSection[] = [
  { title: '', items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard' }] },
  {
    title: 'SALES / MARKETING',
    items: [
      moduleItem({ label: 'Leads', path: '/leads', icon: UserRound, permission: 'leads' }, 'Add Lead', 'Import Leads'),
      moduleItem({ label: 'Contacts', path: '/contacts', icon: Contact, permission: 'contacts' }, 'Add Contact', 'Import Contacts'),
      moduleItem({ label: 'Accounts', path: '/accounts', icon: Building2, permission: 'accounts' }, 'Add Account', 'Import Accounts'),
      moduleItem({ label: 'Opportunities', path: '/opportunities', icon: Target, permission: 'opportunities' }, 'Add Opportunity', 'Import Opportunities'),
      moduleItem({ label: 'Campaigns', path: '/campaigns', icon: Megaphone, permission: 'campaigns' }, 'Create Campaign', 'Import Campaigns'),
      moduleItem({ label: 'Activities', path: '/activities', icon: CheckSquare2, permission: 'activities' }, 'Add Activity', 'Import Activities'),
      { label: 'Reports & Analytics', path: '/reports', icon: BarChart3, permission: 'sales-reports' },
      { label: 'S-mail', path: '/s-mail', icon: Mail, permission: 'sales-mail-view' },
    ],
  },
  {
    title: 'BENCH SALES',
    items: [
      moduleItem({ label: 'Jobs', path: '/jobs', icon: BriefcaseBusiness, permission: 'jobs' }, 'Add Job', 'Import Jobs', 'Job List'),
      moduleItem({ label: 'Bench Consultants', path: '/bench', icon: PackageCheck, permission: 'bench' }, 'Add Consultant', 'Import Consultants', 'Consultant List'),
      moduleItem({ label: 'Submissions', path: '/submissions', icon: Send, permission: 'submissions' }, 'Add Submission', undefined, 'Submission List'),
      moduleItem({ label: 'Interviews', path: '/bench-interviews', icon: CalendarCheck2, permission: 'submissions' }, 'Schedule Interview', undefined, 'Interview List'),
      moduleItem({ label: 'Offers', path: '/bench-offers', icon: Handshake, permission: 'placements' }, 'Add Offer', undefined, 'Offer List'),
      moduleItem({ label: 'Placements', path: '/placements', icon: ClipboardList, permission: 'placements' }, 'Add Placement', undefined, 'Placement List'),
      { label: 'Reports', path: '/bench-reports', icon: CalendarCheck2, permission: 'bench-reports' },
      { label: 'Bench-mail', path: '/bench-mail', icon: Mail, permission: 'bench-mail-view' },
    ],
  },
  {
    title: 'IT RECRUITMENT',
    items: [
      moduleItem({ label: 'Candidates', path: '/candidates', icon: UserRound, permission: 'candidates' }, 'Add Candidate', 'Import Candidates'),
      moduleItem({ label: 'Interviews', path: '/interviews', icon: UsersRound, permission: 'interviews' }, 'Schedule Interview', 'Import Interviews'),
      moduleItem({ label: 'Offers', path: '/offers', icon: Handshake, permission: 'offers' }, 'Create Offer', 'Import Offers'),
      { label: 'Reports', path: '/recruitment-reports', icon: FileBarChart, permission: 'recruitment-reports' },
      { label: 'IT-mail', path: '/it-mail', icon: Mail, permission: 'recruitment-mail-view' },
    ],
  },
  {
    title: 'AI TEAM',
    items: [
      moduleItem({ label: 'AI Projects', path: '/ai-projects', icon: Bot, permission: 'ai-projects' }, 'Add AI Project', 'Import AI Projects'),
      moduleItem({ label: 'Tasks', path: '/tasks', icon: CheckSquare2, permission: 'tasks' }, 'Add Task', 'Import Tasks'),
      moduleItem({ label: 'Resources', path: '/resources', icon: Sparkles, permission: 'resources' }, 'Add Resource', 'Import Resources'),
      { label: 'Reports', path: '/ai-reports', icon: FileBarChart, permission: 'ai-reports' },
      { label: 'AI-mail', path: '/ai-mail', icon: Mail, permission: 'ai-mail-view' },
    ],
  },
];

export function Sidebar({ collapsed, mobileOpen, onToggle, onClose }: { collapsed: boolean; mobileOpen: boolean; onToggle: () => void; onClose: () => void }) {
  const { hasPermission, currentUser } = useApp();
  const { dashboardData, selectedUser, setSelectedUser } = useDashboardLayout();
  const location = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const visibleSections = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => hasPermission(item.permission)) }))
    .filter((section) => section.items.length > 0);
  const isCompact = collapsed && !mobileOpen;
  const roleNormalized = currentUser?.role ? currentUser.role.toUpperCase() : 'SALES';
  const isAdminOrManager = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(roleNormalized);
  const benchRecruiters = dashboardData?.recruiters ?? [];

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation overlay" onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px] lg:hidden" />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-[#E6F7F5] text-[#071B4A] border-r border-[#E4ECF3] transition-all duration-300 lg:z-30 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        isCompact ? 'w-[88px]' : 'w-[286px]',
      )}>
        {/* Brand Area */}
        <div className={cn('flex h-24 items-center border-b border-[#E4ECF3]', isCompact ? 'justify-center px-4' : 'pl-5 pr-3 gap-2')}>
          {isCompact ? (
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1 border border-[#E4ECF3]">
              <img src="/europa-mark.png" alt="Europa" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="h-14 flex items-center">
              <img src="/europa-logo.png" alt="Europa CRM" className="h-13 object-contain object-left" />
            </div>
          )}
          <button onClick={onClose} aria-label="Close navigation" className="ml-auto rounded-lg p-1.5 text-[#071B4A] hover:bg-slate-100/50 lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {visibleSections.map((section, index) => (
            <div key={`${section.title}-${index}`} className="rounded-2xl border border-[#E4ECF3] bg-white p-3 space-y-2 shadow-[0_2px_8px_rgba(7,27,74,0.02)]">
              {section.title && !isCompact && (
                <div className="px-1.5 pb-1 text-[10px] font-bold tracking-wider text-[#071B4A]/50 uppercase">{section.title}</div>
              )}
              <div className="space-y-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                  const isExpanded = expanded[item.path] ?? isActive;
                  return (
                    <div key={item.path}>
                      <div className="flex items-center gap-1">
                        <NavLink to={item.path} onClick={onClose} title={isCompact ? item.label : undefined} className={cn(
                          'flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 text-[14px] font-semibold text-[#071B4A]/80 transition hover:bg-[#D9F5F1]/30 hover:text-[#009E92]',
                          isActive && 'bg-[#D9F5F1] border border-[#009E92]/10 font-bold text-[#009E92] shadow-sm hover:bg-[#D9F5F1] hover:text-[#009E92]',
                          isCompact && 'justify-center px-0',
                        )}>
                          <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2.25} />
                          {!isCompact && <span className="truncate">{item.label}</span>}
                        </NavLink>
                        {!isCompact && item.children && (
                          <button type="button" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`} onClick={() => setExpanded((current) => ({ ...current, [item.path]: !isExpanded }))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#071B4A]/45 transition hover:bg-[#D9F5F1]/50 hover:text-[#009E92]">
                            <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                          </button>
                        )}
                      </div>
                      {!isCompact && item.children && isExpanded && (
                        <div className="ml-7 mt-1.5 space-y-1 border-l border-[#D8E8E8] pl-3">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childUrl = new URL(child.path, window.location.origin);
                            const childActive = location.pathname === childUrl.pathname && location.search === childUrl.search;
                            return (
                              <NavLink key={child.path} to={child.path} onClick={onClose} className={cn(
                                'flex min-h-9 items-center gap-2 rounded-lg px-3 py-1 text-[12px] font-semibold leading-5 text-[#071B4A]/65 transition hover:bg-[#D9F5F1]/40 hover:text-[#009E92]',
                                childActive && 'bg-[#D9F5F1]/80 font-bold text-[#009E92]',
                              )}>
                                <ChildIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                                <span className="truncate">{child.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Settings Section */}
          <div className="rounded-2xl border border-[#E4ECF3] bg-white p-3 space-y-2 shadow-[0_2px_8px_rgba(7,27,74,0.02)]">
            {!isCompact && (
              <div className="px-1.5 pb-1 text-[10px] font-bold tracking-wider text-[#071B4A]/50 uppercase">Settings</div>
            )}
            <div className="space-y-1">
              {hasPermission('users') && (
                <NavLink to="/users" onClick={onClose} title={isCompact ? 'Users & Roles' : undefined} className={({ isActive }) => cn(
                  'flex h-10 items-center gap-3 rounded-xl px-2.5 text-[14px] font-semibold text-[#071B4A]/80 transition hover:bg-[#D9F5F1]/30 hover:text-[#009E92]',
                  isActive && 'bg-[#D9F5F1] border border-[#009E92]/10 font-bold text-[#009E92] shadow-sm hover:bg-[#D9F5F1] hover:text-[#009E92]',
                  isCompact && 'justify-center px-0'
                )}>
                  <UserCog className="h-4.5 w-4.5 shrink-0" strokeWidth={2.25} />{!isCompact && <span>Users & Roles</span>}
                </NavLink>
              )}
              {hasPermission('settings') && (
                <NavLink to="/settings" onClick={onClose} title={isCompact ? 'Settings' : undefined} className={({ isActive }) => cn(
                  'flex h-10 items-center gap-3 rounded-xl px-2.5 text-[14px] font-semibold text-[#071B4A]/80 transition hover:bg-[#D9F5F1]/30 hover:text-[#009E92]',
                  isActive && 'bg-[#D9F5F1] border border-[#009E92]/10 font-bold text-[#009E92] shadow-sm hover:bg-[#D9F5F1] hover:text-[#009E92]',
                  isCompact && 'justify-center px-0'
                )}>
                  <Settings className="h-4.5 w-4.5 shrink-0" strokeWidth={2.25} />{!isCompact && <span>Settings</span>}
                </NavLink>
              )}
            </div>
          </div>

          {!isCompact && isAdminOrManager && hasPermission('users') && (
            <div className="rounded-2xl border border-[#E4ECF3] bg-white p-2.5 shadow-[0_2px_8px_rgba(7,27,74,0.02)]">
              <div className="mb-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-[#071B4A]/50">USERS (Bench Sales)</h3>
              </div>

              <div className="space-y-1">
                {benchRecruiters.map((rec: any) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setSelectedUser(rec)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition',
                      selectedUser?.id === rec.id ? 'bg-[#D9F5F1] text-[#009E92]' : 'hover:bg-[#D9F5F1]/30 text-slate-700'
                    )}
                  >
                    <span className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold',
                      selectedUser?.id === rec.id ? 'bg-[#009E92] text-white' : 'bg-gradient-to-br from-indigo-100 to-cyan-100 text-slate-600'
                    )}>
                      {rec.name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
                    </span>
                    <span className="truncate text-[11px] font-black">{rec.name}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { onClose(); location.pathname !== '/users' && window.location.assign('/users'); }}
                className="mt-2 flex w-full items-center justify-between border-t border-[#E4ECF3] pt-2 text-[10px] font-bold text-slate-500 hover:text-[#009E92]"
              >
                <span>View All Users</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </nav>

        {/* Collapse Button */}
        <button onClick={onToggle} className="hidden h-14 items-center gap-3 border-t border-[#E4ECF3] px-6 text-[14px] font-semibold text-[#071B4A]/80 hover:bg-slate-50 transition lg:flex">
          <ChevronLeft className={cn('h-5 w-5 text-[#071B4A]/60 transition', isCompact && 'rotate-180')} />
          {!isCompact && <span>Collapse Sidebar</span>}
        </button>
      </aside>
    </>
  );
}
