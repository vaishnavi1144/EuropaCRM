import { CircleAlert, Home } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Placeholder() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-10">
      <div className="crm-card max-w-lg p-10 text-center">
        <CircleAlert className="mx-auto h-12 w-12 text-[#009b84]" />
        <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">No Europa CRM route exists for <strong>{location.pathname}</strong>.</p>
        <button onClick={() => navigate('/')} className="crm-primary-button mx-auto mt-6"><Home className="h-4 w-4" />Return to Dashboard</button>
      </div>
    </div>
  );
}
