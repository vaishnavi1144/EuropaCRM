import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Forward,
  Inbox,
  Link2,
  Mail,
  Paperclip,
  Pencil,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Star,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import type { RoleMailConfig } from '@/data/roleMailConfigs';

type MailLabel = { id: string; name: string; color: string };
type MailMessage = {
  id: string;
  gmailThreadId: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: { filename: string; mimeType: string; size?: number }[] | null;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  isTrashed: boolean;
  isArchived: boolean;
  receivedAt: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  submissionId: string | null;
  benchConsultantId: string | null;
  jobId: string | null;
  labels: { label: MailLabel }[];
};
type FolderCounts = { inbox: number; unread: number; sent: number; drafts: number; starred: number; archived: number; trash: number };
type Connection = { connected: boolean; email?: string; lastSyncedAt?: string | null };
type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';
type ComposeState = { mode: ComposeMode; to: string; cc: string; subject: string; body: string; messageId?: string };

const systemFolders = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'drafts', label: 'Drafts', icon: Pencil },
  { key: 'starred', label: 'Starred', icon: Star },
  { key: 'archived', label: 'Archived', icon: Archive },
  { key: 'trash', label: 'Trash', icon: Trash2 },
] as const;

const emptyCounts: FolderCounts = { inbox: 0, unread: 0, sent: 0, drafts: 0, starred: 0, archived: 0, trash: 0 };

function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString();
}

function displayName(address: string) {
  const match = address.match(/^\s*"?([^"<]*)"?\s*<(.+)>\s*$/);
  return (match?.[1]?.trim() || match?.[2] || address).trim();
}

function quote(message: MailMessage) {
  const original = message.bodyText || message.snippet || '';
  return `<br/><br/><blockquote style="border-left:2px solid #E4ECF3;padding-left:12px;color:#64748b">On ${new Date(message.receivedAt).toLocaleString()}, ${displayName(message.fromAddress)} wrote:<br/>${original}</blockquote>`;
}

export function RoleMailPage({ config }: { config: RoleMailConfig }) {
  const { hasPermission } = useApp();
  const canCompose = hasPermission(config.permissionCompose);
  const [folder, setFolder] = useState<string>('inbox');
  const [entityType, setEntityType] = useState<string>('');
  const [labelFilter, setLabelFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [counts, setCounts] = useState<FolderCounts>(emptyCounts);
  const [labels, setLabels] = useState<MailLabel[]>([]);
  const [connection, setConnection] = useState<Connection>({ connected: false });
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [thread, setThread] = useState<MailMessage[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [linkTarget, setLinkTarget] = useState<MailMessage | null>(null);
  const [linkValues, setLinkValues] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const failure = (error: unknown, fallback: string) => toast.error(error instanceof Error ? error.message : fallback);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.roleMailMessages<MailMessage>(config.module, { folder, search, labelId: labelFilter || undefined, entityType: entityType || undefined, limit: 50 });
      setMessages(response.data);
    } catch (error) {
      failure(error, 'Unable to load messages');
    } finally {
      setLoading(false);
    }
  }, [config.module, folder, search, labelFilter, entityType]);

  const loadSidebar = useCallback(async () => {
    try {
      const [folderCounts, labelList, status] = await Promise.all([
        api.roleMailFolders<FolderCounts>(config.module),
        api.roleMailLabels<MailLabel>(config.module),
        api.roleMailCheck<Connection>(config.module),
      ]);
      setCounts(folderCounts);
      setLabels(labelList.data);
      setConnection(status);
    } catch (error) {
      failure(error, 'Unable to load mailbox');
    }
  }, [config.module]);

  useEffect(() => {
    setSelected(null);
    setChecked([]);
    setFolder('inbox');
    setEntityType('');
    setLabelFilter('');
    setSearch('');
  }, [config.module]);

  useEffect(() => {
    void loadSidebar();
  }, [loadSidebar]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const openMessage = async (message: MailMessage) => {
    try {
      const full = await api.roleMailMessage<MailMessage>(config.module, message.id);
      setSelected(full);
      setMessages((current) => current.map((item) => (item.id === full.id ? { ...item, isRead: true } : item)));
      if (full.gmailThreadId) {
        const threadResponse = await api.roleMailThread<MailMessage>(config.module, full.gmailThreadId);
        setThread(threadResponse.data);
      } else {
        setThread([full]);
      }
      void loadSidebar();
    } catch (error) {
      failure(error, 'Unable to open message');
    }
  };

  const patchMessage = async (message: MailMessage, patch: Record<string, boolean>) => {
    try {
      const updated = await api.roleMailUpdate<MailMessage>(config.module, message.id, patch);
      setMessages((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      if (selected?.id === updated.id) setSelected({ ...selected, ...updated });
      await Promise.all([loadSidebar(), loadMessages()]);
    } catch (error) {
      failure(error, 'Unable to update message');
    }
  };

  const bulkPatch = async (patch: Record<string, boolean>) => {
    if (!checked.length) return;
    try {
      await api.roleMailBulkUpdate(config.module, { ids: checked, ...patch });
      setChecked([]);
      await Promise.all([loadSidebar(), loadMessages()]);
    } catch (error) {
      failure(error, 'Unable to update messages');
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      const result = await api.roleMailSync(config.module);
      toast.success(`Synced ${result.imported} new message${result.imported === 1 ? '' : 's'}`);
      await Promise.all([loadSidebar(), loadMessages()]);
    } catch (error) {
      failure(error, 'Unable to sync mailbox');
    } finally {
      setBusy(false);
    }
  };

  const startCompose = (mode: ComposeMode, message?: MailMessage) => {
    if (mode === 'new' || !message) {
      setCompose({ mode: 'new', to: '', cc: '', subject: '', body: '' });
      return;
    }
    const subject = message.subject ?? '';
    if (mode === 'forward') {
      setCompose({ mode, to: '', cc: '', subject: subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`, body: quote(message), messageId: message.id });
      return;
    }
    setCompose({
      mode,
      to: message.fromAddress,
      cc: mode === 'replyAll' ? [...message.toAddresses, ...message.ccAddresses].filter((address) => address !== connection.email).join(', ') : '',
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      body: quote(message),
      messageId: message.id,
    });
  };

  const submitCompose = async (asDraft = false) => {
    if (!compose) return;
    setBusy(true);
    try {
      const payload = { to: compose.to, cc: compose.cc || undefined, subject: compose.subject, body: compose.body };
      if (asDraft) await api.roleMailDraft(config.module, payload);
      else if (compose.mode === 'reply' || compose.mode === 'replyAll') await api.roleMailReply(config.module, { ...payload, messageId: compose.messageId });
      else await api.roleMailCompose(config.module, payload);
      toast.success(asDraft ? 'Draft saved' : 'Email sent');
      setCompose(null);
      await Promise.all([loadSidebar(), loadMessages()]);
    } catch (error) {
      failure(error, asDraft ? 'Unable to save draft' : 'Unable to send email');
    } finally {
      setBusy(false);
    }
  };

  const saveLinks = async () => {
    if (!linkTarget) return;
    setBusy(true);
    try {
      const payload: Record<string, string | null> = { linkedEntityType: entityType || linkTarget.linkedEntityType, linkedEntityId: linkValues.linkedEntityId || null };
      config.crmLinkFields.forEach((field) => {
        payload[field.key] = linkValues[field.key] || null;
      });
      await api.roleMailLink(config.module, linkTarget.id, payload);
      toast.success('CRM links updated');
      setLinkTarget(null);
      await loadMessages();
    } catch (error) {
      failure(error, 'Unable to link message');
    } finally {
      setBusy(false);
    }
  };

  const createLabel = async () => {
    if (!newLabel.trim()) return;
    try {
      await api.roleMailCreateLabel(config.module, { name: newLabel.trim() });
      setNewLabel('');
      await loadSidebar();
    } catch (error) {
      failure(error, 'Unable to create label');
    }
  };

  const removeLabel = async (label: MailLabel) => {
    try {
      await api.roleMailDeleteLabel(config.module, label.id);
      if (labelFilter === label.id) setLabelFilter('');
      await loadSidebar();
    } catch (error) {
      failure(error, 'Unable to delete label');
    }
  };

  const toggleLabel = async (message: MailMessage, label: MailLabel) => {
    try {
      await api.roleMailToggleLabel(config.module, message.id, label.id);
      await loadMessages();
      if (selected?.id === message.id) await openMessage(message);
    } catch (error) {
      failure(error, 'Unable to update labels');
    }
  };

  const countFor = (key: string) => (counts as unknown as Record<string, number>)[key] ?? 0;
  const headerSubtitle = useMemo(
    () => (connection.connected ? `Connected as ${connection.email}` : 'No Gmail account connected'),
    [connection],
  );

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-[#009E92]">Email</div>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-950">{config.title}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{headerSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={config.groupsPath} className="crm-secondary-button"><Users className="h-4 w-4" />Mail groups</Link>
          <button type="button" disabled={busy} onClick={() => void sync()} className="crm-secondary-button"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Sync</button>
          {canCompose && <button type="button" onClick={() => startCompose('new')} className="crm-primary-button"><Pencil className="h-4 w-4" />Compose</button>}
        </div>
      </div>

      {!connection.connected && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Connect your Gmail account in <Link className="underline" to="/settings">Settings → Email Accounts</Link> to send and receive mail from {config.title}.
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="crm-card h-fit p-4">
          <nav className="space-y-1">
            {systemFolders.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { setFolder(item.key); setEntityType(''); setSelected(null); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${folder === item.key && !entityType ? 'bg-[#009E92]/10 text-[#009E92]' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span className="flex items-center gap-2"><item.icon className="h-4 w-4" />{item.label}</span>
                <span className="text-xs">{item.key === 'inbox' ? counts.unread || counts.inbox : countFor(item.key)}</span>
              </button>
            ))}
          </nav>

          <div className="mt-5">
            <div className="px-3 text-xs font-extrabold uppercase tracking-wide text-slate-400">CRM</div>
            <nav className="mt-2 space-y-1">
              {config.crmFolders.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setEntityType(item.key); setFolder('inbox'); setSelected(null); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${entityType === item.key ? 'bg-[#009E92]/10 text-[#009E92]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <item.icon className="h-4 w-4" />{item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-5">
            <div className="px-3 text-xs font-extrabold uppercase tracking-wide text-slate-400">Labels</div>
            <div className="mt-2 space-y-1">
              {labels.map((label) => (
                <div key={label.id} className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-slate-50">
                  <button type="button" onClick={() => setLabelFilter(labelFilter === label.id ? '' : label.id)} className={`flex items-center gap-2 text-sm font-bold ${labelFilter === label.id ? 'text-[#009E92]' : 'text-slate-600'}`}>
                    <Tag className="h-4 w-4" style={{ color: label.color }} />{label.name}
                  </button>
                  <button type="button" onClick={() => void removeLabel(label)} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2 px-1">
              <input className="crm-input h-9 text-sm" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="New label" />
              <button type="button" onClick={() => void createLabel()} className="crm-secondary-button h-9 px-3">Add</button>
            </div>
          </div>
        </aside>

        <section className="crm-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="crm-input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title}`} />
            </div>
            {checked.length > 0 && (
              <div className="flex gap-2">
                <button type="button" onClick={() => void bulkPatch({ isRead: true })} className="crm-secondary-button"><Mail className="h-4 w-4" />Mark read</button>
                <button type="button" onClick={() => void bulkPatch({ isArchived: true })} className="crm-secondary-button"><Archive className="h-4 w-4" />Archive</button>
                <button type="button" onClick={() => void bulkPatch({ isTrashed: true })} className="crm-secondary-button"><Trash2 className="h-4 w-4" />Trash</button>
              </div>
            )}
          </div>

          {selected ? (
            <article className="mt-4">
              <button type="button" onClick={() => setSelected(null)} className="crm-secondary-button"><ArrowLeft className="h-4 w-4" />Back to list</button>
              <h2 className="mt-4 text-xl font-extrabold text-slate-950">{selected.subject || '(no subject)'}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {canCompose && <button type="button" onClick={() => startCompose('reply', selected)} className="crm-secondary-button"><Reply className="h-4 w-4" />Reply</button>}
                {canCompose && <button type="button" onClick={() => startCompose('replyAll', selected)} className="crm-secondary-button"><ReplyAll className="h-4 w-4" />Reply all</button>}
                {canCompose && <button type="button" onClick={() => startCompose('forward', selected)} className="crm-secondary-button"><Forward className="h-4 w-4" />Forward</button>}
                <button type="button" onClick={() => void patchMessage(selected, { isStarred: !selected.isStarred })} className="crm-secondary-button"><Star className={`h-4 w-4 ${selected.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />Star</button>
                <button type="button" onClick={() => void patchMessage(selected, { isArchived: !selected.isArchived })} className="crm-secondary-button"><Archive className="h-4 w-4" />{selected.isArchived ? 'Unarchive' : 'Archive'}</button>
                <button type="button" onClick={() => void patchMessage(selected, { isTrashed: true })} className="crm-secondary-button"><Trash2 className="h-4 w-4" />Trash</button>
                <button type="button" onClick={() => { setLinkTarget(selected); setLinkValues({ submissionId: selected.submissionId ?? '', benchConsultantId: selected.benchConsultantId ?? '', jobId: selected.jobId ?? '', linkedEntityId: selected.linkedEntityId ?? '' }); }} className="crm-secondary-button"><Link2 className="h-4 w-4" />Link to CRM</button>
              </div>
              <div className="mt-4 space-y-4">
                {(thread.length ? thread : [selected]).map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#E4ECF3] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="font-bold text-slate-900">{displayName(item.fromAddress)}</div>
                      <div className="text-slate-500">{new Date(item.receivedAt).toLocaleString()}</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">To: {item.toAddresses.join(', ') || '—'}{item.ccAddresses.length ? ` · Cc: ${item.ccAddresses.join(', ')}` : ''}</div>
                    {item.bodyHtml ? (
                      <div className="prose mt-3 max-w-none text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
                    ) : (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.bodyText || item.snippet}</p>
                    )}
                    {!!item.attachments?.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.attachments.map((attachment) => (
                          <span key={attachment.filename} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><Paperclip className="h-3 w-3" />{attachment.filename}</span>
                        ))}
                      </div>
                    )}
                    {!!labels.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {labels.map((label) => {
                          const attached = item.labels?.some((entry) => entry.label.id === label.id);
                          return (
                            <button key={label.id} type="button" onClick={() => void toggleLabel(item, label)} className={`rounded-full px-3 py-1 text-xs font-bold ${attached ? 'bg-[#009E92] text-white' : 'bg-slate-100 text-slate-600'}`}>{label.name}</button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ) : (
            <div className="mt-4 divide-y divide-[#E4ECF3]">
              {loading && <div className="py-10 text-center text-slate-500">Loading messages…</div>}
              {!loading && !messages.length && <div className="py-10 text-center text-slate-500">No messages in this folder.</div>}
              {!loading && messages.map((message) => (
                <div key={message.id} className={`flex items-center gap-3 px-2 py-3 ${message.isRead ? '' : 'bg-slate-50'}`}>
                  <input type="checkbox" checked={checked.includes(message.id)} onChange={(event) => setChecked((current) => (event.target.checked ? [...current, message.id] : current.filter((id) => id !== message.id)))} />
                  <button type="button" onClick={() => void patchMessage(message, { isStarred: !message.isStarred })}>
                    <Star className={`h-4 w-4 ${message.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  </button>
                  <button type="button" onClick={() => void openMessage(message)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`truncate text-sm ${message.isRead ? 'font-semibold text-slate-700' : 'font-extrabold text-slate-950'}`}>
                        {message.direction === 'OUTBOUND' ? `To: ${message.toAddresses.map(displayName).join(', ')}` : displayName(message.fromAddress)}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">{formatDate(message.receivedAt)}</span>
                    </div>
                    <div className="truncate text-sm font-bold text-slate-800">{message.subject || '(no subject)'}</div>
                    <div className="truncate text-xs text-slate-500">{message.snippet}</div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">{compose.mode === 'new' ? 'New message' : compose.mode === 'forward' ? 'Forward message' : 'Reply'}</h2>
              <button type="button" onClick={() => setCompose(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block"><span className="mb-1.5 block text-sm font-bold">From</span><input className="crm-input bg-slate-50" value={connection.email ?? 'No Gmail account connected'} readOnly /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold">To</span><input className="crm-input" value={compose.to} onChange={(event) => setCompose({ ...compose, to: event.target.value })} placeholder="recipient@example.com" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold">Cc</span><input className="crm-input" value={compose.cc} onChange={(event) => setCompose({ ...compose, cc: event.target.value })} /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold">Subject</span><input className="crm-input" value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold">Message</span><textarea className="min-h-56 w-full rounded-lg border-2 border-[#E4ECF3] p-3" value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCompose(null)} className="crm-secondary-button">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void submitCompose(true)} className="crm-secondary-button">Save draft</button>
              <button type="button" disabled={busy || !connection.connected} onClick={() => void submitCompose(false)} className="crm-primary-button"><Send className="h-4 w-4" />{busy ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}

      {linkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Link to CRM</h2>
              <button type="button" onClick={() => setLinkTarget(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-3">
              {config.crmLinkFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1.5 block text-sm font-bold">{field.label}</span>
                  <input className="crm-input" value={linkValues[field.key] ?? ''} onChange={(event) => setLinkValues({ ...linkValues, [field.key]: event.target.value })} placeholder={field.placeholder} />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setLinkTarget(null)} className="crm-secondary-button">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void saveLinks()} className="crm-primary-button">Save links</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
