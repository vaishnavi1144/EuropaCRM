import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, HardDrive, ShieldCheck, Save, Globe, AtSign, CheckCircle2, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ConnectedAccount {
  id: string;
  provider: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'storage' | 'security' | 'email-accounts'>('general');
  const [saving, setSaving] = useState(false);

  // Email Accounts State
  const [emailAccounts, setEmailAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

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

  const loadEmailAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await api.getEmailAccounts();
      if (res && Array.isArray(res.data)) {
        setEmailAccounts(res.data);
      }
    } catch {
      // Ignore initial silent fail
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    // Handle redirect params from Google OAuth
    const tabParam = searchParams.get('tab');
    const connectedParam = searchParams.get('connected');
    const errorParam = searchParams.get('error');

    if (tabParam === 'email-accounts') {
      setActiveTab('email-accounts');
    }

    if (connectedParam === 'google') {
      toast.success('Google account connected successfully! Outgoing emails will now be sent via your Gmail.');
      setActiveTab('email-accounts');
      setSearchParams({}, { replace: true });
    } else if (errorParam) {
      toast.error(`Google authentication failed: ${errorParam}`);
      setActiveTab('email-accounts');
      setSearchParams({}, { replace: true });
    }

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

    loadEmailAccounts();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      setConnectingGoogle(true);
      const res = await api.getGoogleConnectUrl();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error('Could not obtain Google authentication URL');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect Google account');
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? CRM emails will no longer be sent from this Gmail address.')) {
      return;
    }
    try {
      setDisconnectingGoogle(true);
      await api.disconnectGoogleAccount();
      toast.success('Google account disconnected successfully');
      await loadEmailAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect Google account');
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const normalizedFrom = smtpFrom.trim() || smtpUser.trim();
      const saved = await api.saveSettings<Record<string, unknown>>({
        companyName,
        timezone,
        currency,
        smtpHost: smtpHost.trim(),
        smtpPort: smtpPort.trim(),
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        smtpFrom: normalizedFrom,
        s3Bucket,
        s3Region,
        s3AccessKey,
        s3SecretKey,
        mfaEnabled,
        rolePartitioning
      });
      setSmtpFrom(normalizedFrom);
      setSmtpPass('');
      setS3AccessKey('');
      setS3SecretKey('');
      if (saved.smtpPassConfigured === true) setSmtpPassConfigured(true);
      if (saved.s3AccessKeyConfigured === true || saved.s3SecretKeyConfigured === true) setS3CredentialsConfigured(true);
      toast.success('System settings saved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const googleAccount = emailAccounts.find(acc => acc.provider === 'GOOGLE');

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
          <TabButton active={activeTab === 'email-accounts'} onClick={() => setActiveTab('email-accounts')} icon={<AtSign className="h-4 w-4" />}>Email Accounts (Gmail)</TabButton>
          <TabButton active={activeTab === 'email'} onClick={() => setActiveTab('email')} icon={<Mail className="h-4 w-4" />}>SMTP Server Setup</TabButton>
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

            {activeTab === 'email-accounts' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#071B4A] flex items-center gap-2">
                    <AtSign className="h-4 w-4 text-[#009E92]" />
                    Connected Email Accounts (Gmail OAuth)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Connect your personal or work Gmail account. When you send emails, EuropaCRM uses the official Google Gmail API to send directly from your account without storing your password.
                  </p>
                </div>

                {/* Google Connection Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-sm">
                        <svg className="h-6 w-6" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.15C3.26 21.36 7.34 24 12 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.24C.45 8.18 0 9.94 0 12s.45 3.82 1.24 5.39l4.03-3.15z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.61l4.03 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-base font-bold text-[#071B4A]">Google Gmail Account</h4>
                          {googleAccount ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                              Not Connected
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {googleAccount ? (
                            <>
                              Connected as <span className="font-semibold text-slate-700">{googleAccount.emailAddress}</span>.
                              Emails sent by you will use this address.
                            </>
                          ) : (
                            'Authorize your Gmail account using Google OAuth 2.0 to send emails directly.'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {googleAccount ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleConnectGoogle}
                            disabled={connectingGoogle || disconnectingGoogle}
                            className="text-xs"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${connectingGoogle ? 'animate-spin' : ''}`} />
                            Reconnect
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={handleDisconnectGoogle}
                            disabled={disconnectingGoogle}
                            className="text-xs flex items-center gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleConnectGoogle}
                          disabled={connectingGoogle}
                          className="bg-[#009E92] hover:bg-[#00877D] text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 shadow-sm"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {connectingGoogle ? 'Redirecting to Google...' : 'Connect with Google'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {googleAccount && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                      <div>
                        Provider ID: <span className="font-mono text-slate-700">{googleAccount.id}</span>
                      </div>
                      <div>
                        Connected On: <span className="text-slate-700">{new Date(googleAccount.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Workflow Architecture Card */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#071B4A]">How EuropaCRM Gmail Integration Works</h4>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                    <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-2xs">
                      <div className="font-bold text-[#009E92] mb-1">1. User Identity</div>
                      <p>EuropaCRM identifies the currently logged-in CRM user and checks their connected Gmail account.</p>
                    </div>
                    <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-2xs">
                      <div className="font-bold text-[#009E92] mb-1">2. Secure Tokens</div>
                      <p>Your Google refresh token is encrypted with AES-256-GCM. No employee passwords are ever stored.</p>
                    </div>
                    <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-2xs">
                      <div className="font-bold text-[#009E92] mb-1">3. Direct Delivery</div>
                      <p>Sent via official Google Gmail API (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">users.messages.send</code>). Emails appear in your Sent folder.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'email' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#071B4A] flex items-center gap-2"><Mail className="h-4 w-4 text-[#009E92]" />Email SMTP Relay Configuration</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Save the fallback SMTP account used if a user hasn't connected Google OAuth. Gmail accounts must use a Google App Password.</p>
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

            {activeTab !== 'email-accounts' && (
              <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Configuration'}</Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

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
