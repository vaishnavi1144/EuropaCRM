import { useEffect, useState } from 'react';
import { Mail, HardDrive, ShieldCheck, Save, Globe, AtSign, Plug, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'accounts' | 'storage' | 'security'>('general');
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [emailAccounts, setEmailAccounts] = useState<GmailAccount[]>([]);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // State values
  const [companyName, setCompanyName] = useState('Europa CRM');
  const [timezone, setTimezone] = useState('Asia/Kolkata (GMT+05:30)');
  const [currency, setCurrency] = useState('INR (₹)');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpPassConfigured, setSmtpPassConfigured] = useState(false);
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('ap-south-1');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [s3CredentialsConfigured, setS3CredentialsConfigured] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [rolePartitioning, setRolePartitioning] = useState(true);

  useEffect(() => {
    api.getSettings<Record<string, unknown>>().then((settings) => {
      if (typeof settings.companyName === 'string') setCompanyName(settings.companyName);
      if (typeof settings.timezone === 'string') setTimezone(settings.timezone);
      if (typeof settings.currency === 'string') setCurrency(settings.currency);
      if (typeof settings.smtpHost === 'string') setSmtpHost(settings.smtpHost);
      if (typeof settings.smtpPort === 'string') setSmtpPort(settings.smtpPort);
      if (typeof settings.smtpUser === 'string') setSmtpUser(settings.smtpUser);
      if (typeof settings.smtpFrom === 'string') setSmtpFrom(settings.smtpFrom);
      if (settings.smtpPassConfigured === true) setSmtpPassConfigured(true);
      if (typeof settings.s3Bucket === 'string') setS3Bucket(settings.s3Bucket);
      if (typeof settings.s3Region === 'string') setS3Region(settings.s3Region);
      if (settings.s3AccessKeyConfigured === true || settings.s3SecretKeyConfigured === true) setS3CredentialsConfigured(true);
      if (typeof settings.mfaEnabled === 'boolean') setMfaEnabled(settings.mfaEnabled);
      if (typeof settings.rolePartitioning === 'boolean') setRolePartitioning(settings.rolePartitioning);
    }).catch(() => toast.error('Unable to load saved settings'));
  }, []);

  const loadEmailAccounts = async () => {
    try {
      const response = await api.listEmailAccounts<GmailAccount>();
      setEmailAccounts(response.data);
      setOauthConfigured(response.oauthConfigured);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load email accounts');
    }
  };

  useEffect(() => {
    void loadEmailAccounts();
  }, []);

  useEffect(() => {
    const status = searchParams.get('gmail');
    if (!status) return;
    setActiveTab('accounts');
    if (status === 'connected') toast.success('Gmail account connected');
    else toast.error(searchParams.get('message') ?? 'Unable to connect Gmail account');
    searchParams.delete('gmail');
    searchParams.delete('message');
    setSearchParams(searchParams, { replace: true });
    void loadEmailAccounts();
  }, [searchParams, setSearchParams]);

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const { url } = await api.startGmailOAuth();
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start Google authorization');
      setConnecting(false);
    }
  };

  const disconnectGmail = async (id: string) => {
    try {
      await api.disconnectEmailAccount(id);
      toast.success('Gmail account disconnected');
      await loadEmailAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to disconnect account');
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const normalizedFrom = smtpFrom.trim() || smtpUser.trim();
      const saved = await api.saveSettings<Record<string, unknown>>({ companyName, timezone, currency, smtpHost: smtpHost.trim(), smtpPort: smtpPort.trim(), smtpUser: smtpUser.trim(), smtpPass: smtpPass.trim(), smtpFrom: normalizedFrom, s3Bucket, s3Region, s3AccessKey, s3SecretKey, mfaEnabled, rolePartitioning });
      setSmtpFrom(normalizedFrom);
      setSmtpPass(''); setS3AccessKey(''); setS3SecretKey('');
      if (saved.smtpPassConfigured === true) setSmtpPassConfigured(true);
      if (saved.s3AccessKeyConfigured === true || saved.s3SecretKeyConfigured === true) setS3CredentialsConfigured(true);
      toast.success('System settings saved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save settings');
    } finally { setSaving(false); }
  };

  return (
    <div className="px-5 py-5 max-w-4fr">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px] text-[#009E92]">
            <span>System</span>
            <span>›</span>
            <span className="font-semibold text-slate-700">Settings</span>
          </div>
          <h1 className="text-[23px] font-bold text-slate-950">System Configuration</h1>
        </div>
      </div>

      <div className="mt-6 flex gap-6 items-start">
        {/* Tabs Column */}
        <div className="w-56 shrink-0 space-y-1.5">
          <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Globe className="h-4 w-4" />}>General Config</TabButton>
          <TabButton active={activeTab === 'email'} onClick={() => setActiveTab('email')} icon={<Mail className="h-4 w-4" />}>SMTP Server Setup</TabButton>
          <TabButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<AtSign className="h-4 w-4" />}>Email Accounts</TabButton>
          <TabButton active={activeTab === 'storage'} onClick={() => setActiveTab('storage')} icon={<HardDrive className="h-4 w-4" />}>AWS S3 Storage</TabButton>
          <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<ShieldCheck className="h-4 w-4" />}>Permissions & Security</TabButton>
        </div>

        {/* Content Box */}
        <div className="flex-1 crm-card p-6 min-h-[420px]">
          <form onSubmit={saveSettings}>
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#071B4A] flex items-center gap-2"><Globe className="h-4 w-4 text-[#009E92]" />Corporate Settings</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Define corporate identifier and locale properties for this workspace.</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">Company Identity *</span>
                    <input type="text" className="crm-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">Base Currency</span>
                    <input type="text" className="crm-input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">System Timezone</span>
                    <select className="crm-input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      <option>Asia/Kolkata (GMT+05:30)</option>
                      <option>America/New_York (GMT-05:00)</option>
                      <option>Europe/London (GMT+00:00)</option>
                      <option>Asia/Singapore (GMT+08:00)</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'email' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#071B4A] flex items-center gap-2"><Mail className="h-4 w-4 text-[#009E92]" />Email SMTP Relay Configuration</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Save the SMTP account used by Activities → Send Email. Gmail accounts must use a Google App Password.</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">SMTP Host</span>
                    <input type="text" className="crm-input" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">SMTP Port</span>
                    <input type="text" className="crm-input" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">SMTP Username / Credential</span>
                    <input type="email" className="crm-input" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">From Address (defaults to SMTP username)</span>
                    <input type="text" placeholder="Europa CRM &lt;crm@example.com&gt;" className="crm-input" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">SMTP Relay Password</span>
                    <input type="password" placeholder={smtpPassConfigured ? 'Configured — leave blank to keep existing password' : 'Enter SMTP password'} className="crm-input" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'accounts' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#071B4A] flex items-center gap-2"><AtSign className="h-4 w-4 text-[#009E92]" />Gmail Accounts</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Connect your own Gmail mailbox to send and receive mail inside S-mail, IT-mail, Bench-mail, and AI-mail. Each user sees only their own mailbox.</p>
                </div>
                {!oauthConfigured && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI, and GOOGLE_TOKEN_ENCRYPTION_KEY.</div>}
                <div className="space-y-2">
                  {emailAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between rounded-lg border border-[#E4ECF3] p-3">
                      <div>
                        <div className="text-xs font-bold text-slate-800">{account.email}</div>
                        <div className="text-[10px] text-slate-500">{account.displayName ?? account.provider} · {account.lastSyncedAt ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}` : 'Never synced'}</div>
                      </div>
                      <button type="button" onClick={() => void disconnectGmail(account.id)} className="crm-secondary-button"><Trash2 className="h-4 w-4" />Disconnect</button>
                    </div>
                  ))}
                  {!emailAccounts.length && <div className="py-6 text-center text-xs text-slate-500">No Gmail account connected yet.</div>}
                </div>
                <button type="button" disabled={connecting || !oauthConfigured} onClick={() => void connectGmail()} className="crm-primary-button disabled:cursor-not-allowed disabled:opacity-50"><Plug className="h-4 w-4" />{connecting ? 'Redirecting…' : 'Connect with Google'}</button>
              </div>
            )}

            {activeTab === 'storage' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#071B4A] flex items-center gap-2"><HardDrive className="h-4 w-4 text-[#009E92]" />AWS S3 Cloud Assets Storage</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Integrate file storage buckets to host profile resumes, contracts, and attachments.</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">S3 Bucket Name</span>
                    <input type="text" className="crm-input" value={s3Bucket} onChange={(e) => setS3Bucket(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">AWS Region</span>
                    <input type="text" className="crm-input" value={s3Region} onChange={(e) => setS3Region(e.target.value)} />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">AWS IAM Access Key ID</span>
                    <input type="password" placeholder={s3CredentialsConfigured ? 'Configured — leave blank to keep existing key' : 'Enter access key ID'} className="crm-input" value={s3AccessKey} onChange={(e) => setS3AccessKey(e.target.value)} />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">AWS IAM Secret Access Key</span>
                    <input type="password" placeholder={s3CredentialsConfigured ? 'Configured — leave blank to keep existing secret' : 'Enter secret access key'} className="crm-input" value={s3SecretKey} onChange={(e) => setS3SecretKey(e.target.value)} />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#071B4A] flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#009E92]" />Permissions & Security Controls</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Enforce system-wide policies for login credentials, roles, and two-factor authentication.</p>
                </div>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Two-Factor Authentication (MFA)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Require all employees to setup Google Authenticator for login verification.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={mfaEnabled} onChange={(e) => setMfaEnabled(e.target.checked)} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#009E92]"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Role-Based Data Partitioning</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Restricts employees from accessing listings outside their role scope (e.g. Sales can only access leads).</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={rolePartitioning} onChange={(e) => setRolePartitioning(e.target.checked)} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#009E92]"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Configuration'}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type GmailAccount = { id: string; provider: string; email: string; displayName: string | null; isActive: boolean; lastSyncedAt: string | null };

function TabButton({ children, active, onClick, icon }: { children: React.ReactNode; active?: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition ${
        active
          ? 'bg-[#009E92] text-white shadow-sm'
          : 'bg-white border border-[#E4ECF3] text-[#071B4A] hover:bg-[#D9F5F1]/30 hover:text-[#009E92]'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
