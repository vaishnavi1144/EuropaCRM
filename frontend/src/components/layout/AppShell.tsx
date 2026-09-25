import { useEffect, useState, type CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { DashboardLayoutProvider } from '@/context/DashboardLayoutContext';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const sidebarWidth = collapsed ? 88 : 286;

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <DashboardLayoutProvider>
      <div className="crm-app min-h-screen bg-[#f7fafb]" style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onToggle={() => setCollapsed((value) => !value)} />
        <Topbar onMenu={() => { if (window.innerWidth >= 1024) setCollapsed((value) => !value); else setMobileOpen(true); }} />
        <main className="crm-main min-h-screen pt-20 transition-[margin] duration-300">
          <Outlet />
        </main>
      </div>
    </DashboardLayoutProvider>
  );
}
