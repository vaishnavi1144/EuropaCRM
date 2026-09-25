import { useEffect, useState } from 'react';
import { AtSign, CheckCircle2, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';

interface ConnectedAccount {
  id: string;
  provider: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
}

interface EmailAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailAccountDialog({ open, onOpenChange }: EmailAccountDialogProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.getEmailAccounts();
      if (res && Array.isArray(res.data)) {
        setAccounts(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAccounts();
    }
  }, [open]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await api.getGoogleConnectUrl();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error('Could not get Google authorization URL');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect Google account');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) return;
    try {
      setDisconnecting(true);
      await api.disconnectGoogleAccount();
      toast.success('Google account disconnected successfully');
      await loadAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const googleAccount = accounts.find((a) => a.provider === 'GOOGLE');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E6F7F5] text-[#009E92]">
            <AtSign className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-[#071B4A]">
              My Email Account
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Connect your Gmail account to send CRM emails from your own address.
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#071B4A]">Google Gmail</span>
                    {googleAccount ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {googleAccount ? (
                      <>Connected as <span className="font-semibold text-slate-700">{googleAccount.emailAddress}</span></>
                    ) : (
                      'Authorize EuropaCRM to send emails using your Gmail account.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              {googleAccount ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleConnect}
                    disabled={connecting || disconnecting}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${connecting ? 'animate-spin' : ''}`} />
                    Reconnect
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-[#009E92] hover:bg-[#00877D] text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {connecting ? 'Redirecting to Google...' : 'Connect with Google'}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700">How this works:</div>
            <div>• All outbound emails you compose in EuropaCRM are sent directly via the Gmail API.</div>
            <div>• Emails show up in your real Gmail Sent mailbox.</div>
            <div>• EuropaCRM does not store or see your Google account password.</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
