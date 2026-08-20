import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { moduleConfigs } from '@/data/moduleConfigs';
import { ModulePage } from '@/pages/ModulePage';
import { Reports } from '@/pages/Reports';
import { Dashboard } from '@/pages/Dashboard';
import { UsersPage } from '@/pages/UsersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { MailPage } from '@/pages/MailPage';
import { RoleMailPage } from '@/pages/RoleMailPage';
import { roleMailConfigs } from '@/data/roleMailConfigs';
import { useApp } from '@/context/AppContext';

function ProtectedRoute() {
  const { isAuthenticated, authLoading } = useApp();
  const location = useLocation();
  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-[#F7FAFC] text-base font-bold text-[#071B4A]">Loading Europa CRM…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <Outlet />;
}

function AccessGate({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission, firstAllowedPath } = useApp();
  if (hasPermission(permission)) return children;
  return <Navigate to={firstAllowedPath} replace />;
}

function HomeRoute() {
  const { hasPermission, firstAllowedPath } = useApp();
  return hasPermission('dashboard') ? <Dashboard /> : <Navigate to={firstAllowedPath} replace />;
}

function NoAccess() {
  return <div className="flex min-h-[70vh] items-center justify-center px-6"><div className="max-w-lg rounded-2xl border border-[#E4ECF3] bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-extrabold text-[#071B4A]">No access assigned</h1><p className="mt-3 text-sm font-medium leading-6 text-slate-500">Ask an administrator to tick at least one module permission for this user account.</p></div></div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<HomeRoute />} />
          <Route path="dashboard" element={<AccessGate permission="dashboard"><Dashboard /></AccessGate>} />

          <Route path="leads" element={<AccessGate permission="leads"><ModulePage config={moduleConfigs.leads} /></AccessGate>} />
          <Route path="contacts" element={<AccessGate permission="contacts"><ModulePage config={moduleConfigs.contacts} /></AccessGate>} />
          <Route path="accounts" element={<AccessGate permission="accounts"><ModulePage config={moduleConfigs.accounts} /></AccessGate>} />
          <Route path="opportunities" element={<AccessGate permission="opportunities"><ModulePage config={moduleConfigs.opportunities} /></AccessGate>} />
          <Route path="campaigns" element={<AccessGate permission="campaigns"><ModulePage config={moduleConfigs.campaigns} /></AccessGate>} />
          <Route path="activities" element={<AccessGate permission="activities"><ModulePage config={moduleConfigs.activities} /></AccessGate>} />
          <Route path="reports" element={<AccessGate permission="sales-reports"><Reports type="sales" /></AccessGate>} />
          <Route path="s-mail" element={<AccessGate permission="sales-mail-view"><RoleMailPage config={roleMailConfigs.sales} /></AccessGate>} />
          <Route path="s-mail/groups" element={<AccessGate permission="sales-mail-view"><MailPage module="sales" /></AccessGate>} />

          <Route path="candidates" element={<AccessGate permission="candidates"><ModulePage config={moduleConfigs.candidates} /></AccessGate>} />
          <Route path="jobs" element={<AccessGate permission="jobs"><ModulePage config={moduleConfigs.jobs} /></AccessGate>} />
          <Route path="interviews" element={<AccessGate permission="interviews"><ModulePage config={moduleConfigs.interviews} /></AccessGate>} />
          <Route path="offers" element={<AccessGate permission="offers"><ModulePage config={moduleConfigs.offers} /></AccessGate>} />
          <Route path="recruitment-reports" element={<AccessGate permission="recruitment-reports"><Reports type="recruitment" /></AccessGate>} />
          <Route path="it-mail" element={<AccessGate permission="recruitment-mail-view"><RoleMailPage config={roleMailConfigs.it} /></AccessGate>} />
          <Route path="it-mail/groups" element={<AccessGate permission="recruitment-mail-view"><MailPage module="it" /></AccessGate>} />

          <Route path="bench" element={<AccessGate permission="bench"><ModulePage config={moduleConfigs.bench} /></AccessGate>} />
          <Route path="submissions" element={<AccessGate permission="submissions"><ModulePage config={moduleConfigs.submissions} /></AccessGate>} />
          <Route path="bench-interviews" element={<AccessGate permission="submissions"><ModulePage config={moduleConfigs['bench-interviews']} /></AccessGate>} />
          <Route path="bench-offers" element={<AccessGate permission="placements"><ModulePage config={moduleConfigs['bench-offers']} /></AccessGate>} />
          <Route path="placements" element={<AccessGate permission="placements"><ModulePage config={moduleConfigs.placements} /></AccessGate>} />
          <Route path="bench-reports" element={<AccessGate permission="bench-reports"><Reports type="bench" /></AccessGate>} />
          <Route path="bench-mail" element={<AccessGate permission="bench-mail-view"><RoleMailPage config={roleMailConfigs.bench} /></AccessGate>} />
          <Route path="bench-mail/groups" element={<AccessGate permission="bench-mail-view"><MailPage module="bench" /></AccessGate>} />

          <Route path="ai-projects" element={<AccessGate permission="ai-projects"><ModulePage config={moduleConfigs['ai-projects']} /></AccessGate>} />
          <Route path="tasks" element={<AccessGate permission="tasks"><ModulePage config={moduleConfigs.tasks} /></AccessGate>} />
          <Route path="resources" element={<AccessGate permission="resources"><ModulePage config={moduleConfigs.resources} /></AccessGate>} />
          <Route path="ai-reports" element={<AccessGate permission="ai-reports"><Reports type="ai" /></AccessGate>} />
          <Route path="ai-mail" element={<AccessGate permission="ai-mail-view"><RoleMailPage config={roleMailConfigs.ai} /></AccessGate>} />
          <Route path="ai-mail/groups" element={<AccessGate permission="ai-mail-view"><MailPage module="ai" /></AccessGate>} />

          <Route path="users" element={<AccessGate permission="users"><UsersPage /></AccessGate>} />
          <Route path="settings" element={<AccessGate permission="settings"><SettingsPage /></AccessGate>} />
          <Route path="no-access" element={<NoAccess />} />
          <Route path="*" element={<HomeRoute />} />
        </Route>
      </Route>
    </Routes>
  );
}
