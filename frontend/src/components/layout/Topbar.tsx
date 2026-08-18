import { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, ChevronDown, LogOut, Mail, Settings, UserCog, HelpCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp, UserRole } from '@/context/AppContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type SearchHit = { resource: string; id: string; label: string; subtitle: string; path: string };
type ActivityHit = { id: string; activity?: string; status?: string; dueDate?: string; type?: string };
type ModuleInbox = { label: string; address: string; permission: string; module: string };

const moduleInboxes: ModuleInbox[] = [
  { label: 'S-mail', address: 'Separate sales SMTP', permission: 'activities', module: 's-mail' },
  { label: 'IT-mail', address: 'Separate recruitment SMTP', permission: 'candidates', module: 'it-mail' },
  { label: 'Bench-mail', address: 'Separate bench SMTP', permission: 'bench', module: 'bench-mail' },
  { label: 'AI-mail', address: 'Separate AI Team SMTP', permission: 'ai-projects', module: 'ai-mail' },
];

const roleLabels: Record<UserRole,string> = {
  'Super Admin':'Super Admin', SALES:'Sales & Marketing', RECRUITER:'IT Recruiter', BENCHSALES:'Bench Sales', AITEAM:'AI Team',
};

// "+ New" action options based on permissions
const createOptions = [
  { label: 'Lead', path: '/leads?action=add', permission: 'leads' },
  { label: 'Contact', path: '/contacts?action=add', permission: 'contacts' },
  { label: 'Account', path: '/accounts?action=add', permission: 'accounts' },
  { label: 'Opportunity', path: '/opportunities?action=add', permission: 'opportunities' },
  { label: 'Candidate', path: '/candidates?action=add', permission: 'candidates' },
  { label: 'Job', path: '/jobs?action=add', permission: 'jobs' },
  { label: 'Bench Consultant', path: '/bench?action=add', permission: 'bench' },
  { label: 'Submission', path: '/submissions?action=add', permission: 'submissions' },
  { label: 'AI Project', path: '/ai-projects?action=add', permission: 'ai-projects' },
  { label: 'AI Task', path: '/tasks?action=add', permission: 'tasks' },
];

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRole, currentUser, logout, hasPermission } = useApp();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [activities, setActivities] = useState<ActivityHit[]>([]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.globalSearch<{ data: SearchHit[] }>(query.trim());
        setResults(response.data);
        setSearchOpen(true);
      } catch { setResults([]); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadActivities = async () => {
    try {
      const response = await api.list<ActivityHit>('activities', { limit: 8, filters: { status: 'Pending' } });
      setActivities(response.data);
    } catch { setActivities([]); }
  };

  const initials = (currentUser?.name || currentUser?.username || 'EU').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const allowedCreateOptions = createOptions.filter(opt => hasPermission(opt.permission));

  const handlePlusNewClick = () => {
    // If we're on a module page, we can directly trigger the add dialog of that page
    const currentPath = location.pathname;
    const directOption = allowedCreateOptions.find(opt => opt.path.startsWith(currentPath));
    if (directOption) {
      navigate(directOption.path);
    }
  };

  return (
    <header className="crm-topbar fixed right-0 top-0 z-30 h-20 border-b border-[#E4ECF3] bg-white/95 shadow-sm backdrop-blur">
      <div className="flex h-full items-center justify-end gap-3 px-6 sm:gap-4">
        {/* Actions section */}
        <div className="ml-auto flex items-center gap-2.5 sm:gap-3.5">
          {/* "+ New" button removed per UI update request */}

          {/* Notifications Trigger */}
          {hasPermission('activities') && (
            <DropdownMenu.Root onOpenChange={(open) => { if (open) void loadActivities(); }}>
              <DropdownMenu.Trigger className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#071B4A]/80 hover:bg-slate-100 transition" aria-label="Notifications">
                <Bell className="h-5 w-5" strokeWidth={2} />
                {activities.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                    {activities.length}
                  </span>
                )}
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-[300px] rounded-xl border border-[#E4ECF3] bg-white p-1.5 shadow-xl text-[13px]">
                  <div className="px-2.5 py-2 font-bold text-[#071B4A]">Pending Activities</div>
                  <DropdownMenu.Separator className="h-px bg-[#E4ECF3] my-1" />
                  {activities.length ? activities.map((act) => (
                    <DropdownMenu.Item key={act.id} onSelect={() => navigate(`/activities?search=${encodeURIComponent(act.activity ?? '')}`)} className="cursor-pointer rounded-lg px-2.5 py-2 outline-none hover:bg-slate-50">
                      <div className="font-bold text-[#071B4A]">{act.activity ?? 'Activity'}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{act.type ?? 'Task'} · {act.dueDate ?? 'No due date'}</div>
                    </DropdownMenu.Item>
                  )) : (
                    <div className="px-2.5 py-4 text-center text-slate-400 font-semibold">No pending activities</div>
                  )}
                  <DropdownMenu.Separator className="h-px bg-[#E4ECF3] my-1" />
                  <DropdownMenu.Item onSelect={() => navigate('/activities')} className="cursor-pointer rounded-lg px-2 py-2 text-center font-bold text-[#009E92] outline-none hover:bg-[#D9F5F1]/30">
                    View all activities
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Module Mailboxes Trigger */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#071B4A]/80 hover:bg-slate-100 transition" aria-label="Mailboxes">
              <Mail className="h-5 w-5" strokeWidth={2} />
              {/* Badge for mail, matching the message/mail visual badge */}
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#009E92] px-1 text-[9px] font-bold text-white ring-2 ring-white">5</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border border-[#E4ECF3] bg-white p-1.5 shadow-xl text-[13px]">
                <div className="px-2.5 py-2 font-bold text-[#071B4A]">Module Mailboxes</div>
                <DropdownMenu.Separator className="h-px bg-[#E4ECF3] my-1" />
                {moduleInboxes.filter((inbox) => hasPermission(inbox.permission)).map((inbox) => (
                  <DropdownMenu.Item key={inbox.module} onSelect={() => navigate(`/${inbox.module}`)} className="cursor-pointer rounded-lg px-2.5 py-2 outline-none hover:bg-[#D9F5F1]/30">
                    <div className="font-bold text-[#071B4A]">{inbox.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{inbox.address}</div>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Help Button */}
          <button aria-label="Help" className="flex h-10 w-10 items-center justify-center rounded-xl text-[#071B4A]/80 hover:bg-slate-100 transition">
            <HelpCircle className="h-5 w-5" strokeWidth={2} />
          </button>

          {/* Vertical Separator */}
          <div className="h-6 w-px bg-[#E4ECF3]" />

          {/* User Profile Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2.5 rounded-xl p-1 hover:bg-slate-50 transition outline-none">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D9F5F1] text-[13px] font-bold text-[#009E92] ring-1 ring-[#009E92]/20">
                  {initials}
                </div>
                <div className="hidden text-left leading-tight xl:block">
                  <div className="truncate text-[13px] font-bold text-[#071B4A]">{currentUser?.name ?? 'Europa User'}</div>
                  <div className="truncate text-[11px] font-semibold text-slate-400">{roleLabels[activeRole]}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-[#071B4A]/60" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 w-56 rounded-xl border border-[#E4ECF3] bg-white p-1.5 text-[13px] font-semibold text-[#071B4A] shadow-xl" sideOffset={8} align="end">
                <div className="px-3 py-2 border-b border-[#E4ECF3]/60 mb-1">
                  <div className="font-bold text-[#071B4A]">{currentUser?.name}</div>
                  <div className="text-[11px] text-slate-400">@{currentUser?.username ?? currentUser?.email}</div>
                  <div className="mt-1 text-[11px] font-bold text-[#009E92]">{roleLabels[activeRole]}</div>
                </div>
                {hasPermission('users') && (
                  <DropdownMenu.Item onSelect={() => navigate('/users')} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 outline-none hover:bg-slate-50">
                    <UserCog className="h-4 w-4" />
                    <span>Users & Roles</span>
                  </DropdownMenu.Item>
                )}
                {hasPermission('settings') && (
                  <DropdownMenu.Item onSelect={() => navigate('/settings')} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 outline-none hover:bg-slate-50">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="h-px bg-[#E4ECF3] my-1" />
                <DropdownMenu.Item
                  onSelect={() => { void logout().then(() => navigate('/login', { replace: true })); toast.success('Signed out successfully'); }}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-red-600 outline-none hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}
