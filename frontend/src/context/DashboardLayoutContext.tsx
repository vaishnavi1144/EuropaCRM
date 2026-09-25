import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type DashboardLayoutContextValue = {
  dashboardData: any;
  setDashboardData: (value: any) => void;
  selectedUser: any;
  setSelectedUser: (value: any) => void;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | undefined>(undefined);

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const value = useMemo(() => ({ dashboardData, setDashboardData, selectedUser, setSelectedUser }), [dashboardData, selectedUser]);

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout() {
  const context = useContext(DashboardLayoutContext);
  if (!context) {
    throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
  }
  return context;
}
