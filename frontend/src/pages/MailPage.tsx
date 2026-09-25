import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Inbox, Send, Star, Users, Search, RefreshCw, Mail, Trash2,
  Paperclip, ArrowLeft, Reply, CheckCircle2, Pencil, Plus,
  Square, CheckSquare, X, Minimize2, Maximize2,
  Archive, AlertOctagon, FileText, Download, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApp } from '@/context/AppContext';

type MailModule = 'sales' | 'it' | 'bench' | 'ai';
type Ref = { entityType: string; entityId: string };
type Recipient = Ref & { name: string; email: string };
type Group = { id: string; groupName: string; description?: string | null; module: MailModule; members?: Ref[]; recipients?: Recipient[]; _count?: { members: number } };

export type EmailMessageItem = {
  id: string;
  module: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam';
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  ccEmail?: string | null;
  bccEmail?: string | null;
  subject: string;
  body: string;
  snippet?: string | null;
  attachments?: Array<{ filename: string; content?: string; contentType?: string; sizeText?: string }> | null;
  isRead: boolean;
  isStarred: boolean;
  status: string;
  submissionId?: string | null;
  ownerName?: string | null;
  sentAt?: string | null;
  createdAt: string;
};

type MailFolder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam' | 'groups';

type AttachedFile = {
  filename: string;
  content: string;
  contentType: string;
  sizeText?: string;
};

const details: Record<MailModule, { title: string; description: string; defaultFrom: string; entities: { value: string; label: string }[]; prefix: string }> = {
  sales: { title: 'S-mail', description: 'Sales and marketing email workspace.', defaultFrom: 'sales@europacrm.local', prefix: 'sales-mail', entities: [{ value: 'lead', label: 'Leads' }, { value: 'contact', label: 'Contacts' }, { value: 'account', label: 'Accounts' }] },
  it: { title: 'IT-mail', description: 'IT recruitment email workspace.', defaultFrom: 'recruiter@europacrm.local', prefix: 'recruitment-mail', entities: [{ value: 'candidate', label: 'Candidates' }] },
  bench: { title: 'Bench-mail', description: 'Bench consultant email workspace.', defaultFrom: 'bench@europacrm.local', prefix: 'bench-mail', entities: [{ value: 'candidate', label: 'Consultants' }] },
  ai: { title: 'AI-mail', description: 'AI Team email workspace.', defaultFrom: 'ai@europacrm.local', prefix: 'ai-mail', entities: [{ value: 'contact', label: 'Contacts' }, { value: 'account', label: 'Accounts' }, { value: 'user', label: 'Team Users' }] },
};

function getInitials(name?: string | null, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function MailPage({ module }: { module: MailModule }) {
  const meta = useMemo(() => details[module], [module]);
  const { hasPermission, currentUser } = useApp();

  // Active folder / view
  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [messages, setMessages] = useState<EmailMessageItem[]>([]);
  const [counts, setCounts] = useState({
    inbox: 0,
    inboxUnread: 0,
    sent: 0,
    starred: 0,
    drafts: 0,
    archive: 0,
    trash: 0,
    spam: 0,
  });
  const [search, setSearch] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [readingMessage, setReadingMessage] = useState<EmailMessageItem | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Compose State (Floating / Modal)
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeMaximized, setComposeMaximized] = useState(false);
  const [fromAddress, setFromAddress] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signoff, setSignoff] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<AttachedFile[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  // Inline Reply state in reader
  const [inlineReplyOpen, setInlineReplyOpen] = useState(false);
  const [inlineReplyBody, setInlineReplyBody] = useState('');
  const [inlineReplyAttachments, setInlineReplyAttachments] = useState<AttachedFile[]>([]);
  const [sendingInlineReply, setSendingInlineReply] = useState(false);
  const [savingInlineDraft, setSavingInlineDraft] = useState(false);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);

  // Groups State
  const [groups, setGroups] = useState<Group[]>([]);
  const [editing, setEditing] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState(meta.entities[0].value);
  const [memberSearch, setMemberSearch] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [members, setMembers] = useState<Recipient[]>([]);
  const [customEmail, setCustomEmail] = useState('');

  // Bench Consultants State for auto-generating consultant tables
  type BenchConsultantInfo = {
    id: string;
    candidateName: string;
    skills: string;
    visaStatus: string;
    experienceYears: string | number;
    ratePerHour: string | number;
    rateType: string;
    currentLocation: string;
    availability: string;
    resumeUrl?: string;
    resumeOriginalName?: string;
  };
  const [benchConsultants, setBenchConsultants] = useState<BenchConsultantInfo[]>([]);

  useEffect(() => {
    if (module === 'bench') {
      void api.list<any>('bench', { limit: 200 }).then((res) => {
        const rows = (res.data || []).map((b: any) => ({
          id: b.id,
          candidateName: b.candidateName || b.name || 'Consultant',
          skills: b.skills || b.primarySkill || 'Software Engineer',
          visaStatus: b.visaStatus || 'H1B',
          experienceYears: b.experienceYears || b.experience || '4',
          ratePerHour: b.ratePerHour || b.customData?.expectedRate || b.expectedRate || '65',
          rateType: b.customData?.rateType || b.rateType || 'C2C',
          currentLocation: b.customData?.currentLocation || b.currentLocation || 'New York',
          availability: b.customData?.availableFrom || b.customData?.noticePeriod || b.availability || 'Immediate',
          resumeUrl: b.resumeUrl,
          resumeOriginalName: b.customData?.resumeOriginalName,
        }));
        setBenchConsultants(rows);
      }).catch(() => {});
    }
  }, [module]);

  const attachedConsultantsTable = useMemo(() => {
    if (module !== 'bench' || composeAttachments.length === 0) return [];

    return composeAttachments.map((att) => {
      const filename = att.filename;
      const lower = filename.toLowerCase();
      const clean = lower.replace(/[^a-z0-9]/g, ' ');

      // Find match in benchConsultants
      const matched = benchConsultants.find((b) => {
        const bName = b.candidateName.toLowerCase();
        const bOriginal = (b.resumeOriginalName || '').toLowerCase();
        const bUrl = (b.resumeUrl || '').toLowerCase();

        if (bOriginal && lower.includes(bOriginal)) return true;
        if (bUrl && bUrl.includes(lower)) return true;

        const nameTokens = bName.split(/\s+/).filter((t) => t.length >= 2);
        if (nameTokens.length > 0 && nameTokens.every((t) => clean.includes(t))) {
          return true;
        }
        return false;
      });

      if (matched) {
        return {
          ...matched,
          attachmentFilename: filename,
        };
      }

      // Fallback: parse name and technology from filename (e.g. Harsha_Vardhan_AI_Engineer_Resume.pdf)
      const stripped = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').replace(/\bresume\b/gi, '').trim();
      const parts = stripped.split(/\s+/);
      const inferredName = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ') || 'Consultant';
      const inferredTech = parts.slice(2).join(' ') || 'Software Engineer';

      return {
        id: filename,
        candidateName: inferredName,
        skills: inferredTech,
        experienceYears: '4',
        visaStatus: 'H1B',
        currentLocation: 'New York',
        availability: 'Immediate',
        ratePerHour: '65',
        rateType: 'C2C',
        attachmentFilename: filename,
      };
    });
  }, [module, composeAttachments, benchConsultants]);

  const can = (a: string) => hasPermission(`${meta.prefix}-${a}`);

  const getSubmissionsSignoff = () => {
    return [
      'Thanks & Regards,',
      currentUser?.name || 'Vaishnavi Vangala',
      currentUser?.role ? `${currentUser.role.replace(/_/g, ' ')} | Europa CRM` : 'BENCHSALES | Europa CRM',
      currentUser?.email || 'vvvaishnavi199@gmail.com',
    ].filter(Boolean).join('\n');
  };

  useEffect(() => {
    setFromAddress(currentUser?.email || meta.defaultFrom);
    setSignoff(getSubmissionsSignoff());
  }, [currentUser, meta.defaultFrom]);

  // Load Messages
  const loadMessages = async (targetFolder?: MailFolder) => {
    const f = targetFolder ?? (folder === 'groups' ? 'inbox' : folder);
    setLoadingMessages(true);
    try {
      const res = await api.listEmailMessages<EmailMessageItem>(module, f, search);
      setMessages(res.data ?? []);
      setCounts((prev) => ({
        inbox: res.counts?.inbox ?? prev.inbox,
        inboxUnread: res.counts?.inboxUnread ?? prev.inboxUnread,
        sent: res.counts?.sent ?? prev.sent,
        starred: res.counts?.starred ?? prev.starred,
        drafts: res.counts?.drafts ?? prev.drafts,
        archive: res.counts?.archive ?? prev.archive,
        trash: res.counts?.trash ?? prev.trash,
        spam: res.counts?.spam ?? prev.spam,
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to load emails');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (folder !== 'groups') {
      void loadMessages(folder);
    }
    if (folder === 'inbox') {
      const timer = setInterval(() => {
        void loadMessages('inbox');
      }, 45000);
      return () => clearInterval(timer);
    }
  }, [folder, module]);

  const loadGroups = async () => {
    try {
      const res = await api.listMailGroups<Group>(module, search);
      setGroups(res.data || []);
    } catch (_) {}
  };

  useEffect(() => {
    void loadGroups();
  }, [module]);

  const openMessage = async (msg: EmailMessageItem) => {
    if (msg.folder === 'drafts') {
      setDraftId(msg.id);
      setTo(msg.toEmail || '');
      setCc(msg.ccEmail || '');
      setSubject(msg.subject || '');
      setBody(msg.body || '');
      setComposeAttachments(
        Array.isArray(msg.attachments)
          ? msg.attachments.map((a) => ({
              filename: a.filename,
              content: a.content || '',
              contentType: a.contentType || 'application/octet-stream',
              sizeText: a.sizeText || '',
            }))
          : []
      );
      setComposeOpen(true);
      setComposeMinimized(false);
      return;
    }

    setReadingMessage(msg);
    setInlineReplyOpen(false);
    setInlineReplyBody('');
    if (!msg.isRead && msg.folder === 'inbox') {
      try {
        await api.getEmailMessage(msg.id);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
        setCounts((c) => ({ ...c, inboxUnread: Math.max(0, c.inboxUnread - 1) }));
      } catch (_) {}
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 15MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const sizeText =
          file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        setComposeAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content,
            contentType: file.type || 'application/octet-stream',
            sizeText,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setComposeAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const downloadAttachment = (att: { filename: string; content?: string; contentType?: string }) => {
    if (!att.content) {
      toast.error('File content not available for download');
      return;
    }
    const link = document.createElement('a');
    link.href = att.content.startsWith('data:')
      ? att.content
      : `data:${att.contentType || 'application/octet-stream'};base64,${att.content}`;
    link.download = att.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buildResumeDownloadHref = (resumeValue: string | null | undefined) => {
    const resume = String(resumeValue ?? '').trim();
    if (!resume) return '';
    const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '';
    const apiOrigin = configuredApiUrl ? configuredApiUrl.replace(/\/api\/?$/, '') : `${window.location.protocol}//${window.location.hostname}:4000`;
    try {
      return new URL(resume, apiOrigin).toString();
    } catch {
      return resume;
    }
  };

  const openOrDownloadAttachment = (filename: string, resumeUrl?: string) => {
    const att = composeAttachments.find((a) => a.filename === filename);
    if (att && att.content) {
      try {
        const mime = att.contentType || (filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
        const rawContent = att.content.replace(/^data:[^;]+;base64,/, '');
        const byteCharacters = atob(rawContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });
        const blobUrl = URL.createObjectURL(blob);

        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        return;
      } catch (e) {
        console.error('Failed to open attachment blob', e);
        downloadAttachment(att);
        return;
      }
    }

    if (resumeUrl) {
      const fullUrl = buildResumeDownloadHref(resumeUrl);
      window.open(fullUrl, '_blank');
      return;
    }

    toast.info(`Attachment "${filename}" is included with this email.`);
  };

  const handleSaveDraft = async () => {
    if (!to.trim() && !subject.trim() && !body.trim() && composeAttachments.length === 0) {
      toast.error('Draft is empty');
      return;
    }
    setSavingDraft(true);
    try {
      const res = await api.saveEmailDraft<{ id: string }>({
        id: draftId || undefined,
        module,
        to: to.trim() || undefined,
        cc: cc.trim() || undefined,
        subject: subject.trim() || '(No Subject)',
        body: body.trim(),
        attachments: composeAttachments,
      });
      if (res?.id) setDraftId(res.id);
      toast.success('Draft saved successfully');
      void loadMessages(folder);
    } catch (e) {
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const deleteMessage = async (msg: EmailMessageItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (msg.folder === 'trash') {
      if (!confirm('Permanently delete this email? This cannot be undone.')) return;
      try {
        await api.deleteEmailMessage(msg.id, true);
        toast.success('Email permanently deleted');
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
        if (readingMessage?.id === msg.id) setReadingMessage(null);
        void loadMessages(folder);
      } catch (e) {
        toast.error('Failed to permanently delete email');
      }
      return;
    }

    try {
      await api.deleteEmailMessage(msg.id, false);
      toast.success('Moved to Trash');
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
      if (readingMessage?.id === msg.id) setReadingMessage(null);
      void loadMessages(folder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete email');
    }
  };

  const moveToFolder = async (msgId: string, targetFolder: 'inbox' | 'archive' | 'trash' | 'spam') => {
    try {
      await api.moveEmailFolder(msgId, targetFolder);
      toast.success(`Moved to ${targetFolder.charAt(0).toUpperCase() + targetFolder.slice(1)}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (readingMessage?.id === msgId) setReadingMessage(null);
      void loadMessages(folder);
    } catch (e) {
      toast.error(`Failed to move to ${targetFolder}`);
    }
  };

  const bulkMoveFolder = async (targetFolder: 'inbox' | 'archive' | 'trash' | 'spam') => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await api.bulkMoveEmailFolder(ids, targetFolder);
      toast.success(`Moved ${ids.length} email(s) to ${targetFolder.charAt(0).toUpperCase() + targetFolder.slice(1)}`);
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      void loadMessages(folder);
    } catch (e) {
      toast.error(`Failed to move to ${targetFolder}`);
    }
  };

  const bulkDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const isTrash = folder === 'trash';
    if (!confirm(isTrash ? `Permanently delete ${ids.length} selected emails?` : `Move ${ids.length} selected emails to Trash?`)) return;
    try {
      await api.bulkDeleteEmailMessages(ids, isTrash);
      toast.success(isTrash ? 'Selected emails permanently deleted' : 'Selected emails moved to Trash');
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      void loadMessages(folder);
    } catch (e) {
      toast.error('Failed to delete selected');
    }
  };

  const toggleStar = async (msg: EmailMessageItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.starEmailMessage(msg.id);
      const nextStarred = !msg.isStarred;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isStarred: nextStarred } : m)));
      setCounts((c) => ({ ...c, starred: nextStarred ? c.starred + 1 : Math.max(0, c.starred - 1) }));
      if (readingMessage?.id === msg.id) {
        setReadingMessage((prev) => (prev ? { ...prev, isStarred: nextStarred } : null));
      }
    } catch (_) {}
  };

  const openComposeWithReply = (msg: EmailMessageItem) => {
    setTo(msg.fromEmail);
    setSubject(msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`);
    setBody(`\n\n\n--- On ${new Date(msg.sentAt || msg.createdAt).toLocaleString()}, ${msg.fromName || msg.fromEmail} wrote:\n> ${msg.body.replace(/<[^>]*>/g, '').replace(/\n/g, '\n> ')}`);
    setComposeOpen(true);
    setComposeMinimized(false);
  };

  const handleInlineReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 15MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const sizeText =
          file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        setInlineReplyAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content,
            contentType: file.type || 'application/octet-stream',
            sizeText,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeInlineReplyAttachment = (index: number) => {
    setInlineReplyAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveInlineReplyDraft = async () => {
    if (!readingMessage || (!inlineReplyBody.trim() && inlineReplyAttachments.length === 0)) {
      toast.error('Reply draft is empty');
      return;
    }
    setSavingInlineDraft(true);
    try {
      const repSubject = readingMessage.subject.toLowerCase().startsWith('re:')
        ? readingMessage.subject
        : `Re: ${readingMessage.subject}`;
      await api.saveEmailDraft({
        module,
        to: readingMessage.fromEmail,
        subject: repSubject,
        body: inlineReplyBody.trim(),
        attachments: inlineReplyAttachments,
      });
      toast.success('Reply draft saved');
      setCounts((c) => ({ ...c, drafts: c.drafts + 1 }));
      if (folder === 'drafts') void loadMessages('drafts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save draft');
    } finally {
      setSavingInlineDraft(false);
    }
  };

  const popOutInlineReplyToCompose = () => {
    if (!readingMessage) return;
    const repSubject = readingMessage.subject.toLowerCase().startsWith('re:')
      ? readingMessage.subject
      : `Re: ${readingMessage.subject}`;
    setTo(readingMessage.fromEmail);
    setSubject(repSubject);
    setBody(inlineReplyBody || `\n\n\n--- On ${new Date(readingMessage.sentAt || readingMessage.createdAt).toLocaleString()}, ${readingMessage.fromName || readingMessage.fromEmail} wrote:\n> ${readingMessage.body.replace(/<[^>]*>/g, '').replace(/\n/g, '\n> ')}`);
    setComposeAttachments(inlineReplyAttachments);
    setInlineReplyOpen(false);
    setComposeOpen(true);
    setComposeMinimized(false);
  };

  const handleSendInlineReply = async () => {
    if (!readingMessage || !inlineReplyBody.trim()) {
      toast.error('Please write a reply message');
      return;
    }
    setSendingInlineReply(true);
    try {
      const repSubject = readingMessage.subject.toLowerCase().startsWith('re:')
        ? readingMessage.subject
        : `Re: ${readingMessage.subject}`;
      await api.sendEmail({
        module,
        from: fromAddress.trim() || currentUser?.email || meta.defaultFrom,
        to: readingMessage.fromEmail,
        subject: repSubject,
        body: inlineReplyBody.trim(),
        attachments: inlineReplyAttachments.length ? inlineReplyAttachments : undefined,
      });
      toast.success('Reply sent successfully');
      setInlineReplyBody('');
      setInlineReplyAttachments([]);
      setInlineReplyOpen(false);
      setCounts((c) => ({ ...c, sent: c.sent + 1 }));
      if (folder === 'sent') void loadMessages('sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSendingInlineReply(false);
    }
  };

  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() && recipients.length === 0) {
      toast.error('Recipient email (To) is required');
      return;
    }
    setBusy(true);
    try {
      let finalBody = body;
      const defaultSignoff = getSubmissionsSignoff();
      let activeSignoff = signoff.trim() || defaultSignoff;

      // In case user also typed or kept a sign-off in the pitch body, separate it cleanly
      let introText = body;
      const signoffRegex = /(?:^|\n)\s*(thanks\s*(?:&|&amp;|and)?\s*regards|regards|best\s*regards|warm\s*regards|sincerely)/i;
      const match = body.match(signoffRegex);

      if (match && match.index !== undefined) {
        const offset = match[0].search(/\S/);
        const actualIndex = match.index + (offset > 0 ? offset : 0);
        introText = body.slice(0, actualIndex).trim();
        if (!signoff.trim()) {
          activeSignoff = body.slice(actualIndex).trim();
        }
      }

      const formattedIntro = introText.replace(/\n/g, '<br />');
      const formattedClosing = activeSignoff.replace(/\n/g, '<br />');

      if (attachedConsultantsTable.length > 0) {
        const rowsHtml = attachedConsultantsTable
          .map(
            (c) => `
          <tr>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.candidateName}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.skills}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.experienceYears}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.visaStatus}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.currentLocation || '-'}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.availability || '-'}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.ratePerHour}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">${c.rateType || 'C2C'}</td>
            <td style="border:1px solid #dfe7ef;padding:8px 10px;">
              ${c.resumeUrl
                ? `<a href="${buildResumeDownloadHref(c.resumeUrl)}" target="_blank" download style="color:#009E92;text-decoration:underline;cursor:pointer;">${c.attachmentFilename}</a>`
                : `<a href="#" download="${c.attachmentFilename}" style="color:#009E92;text-decoration:underline;cursor:pointer;">${c.attachmentFilename}</a>`
              }
            </td>
          </tr>`
          )
          .join('');

        finalBody = `
          <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
            <div>${formattedIntro}</div>
            <br />
            <table contenteditable="false" style="border-collapse:collapse;width:100%;margin:12px 0;border:1px solid #dfe7ef;font-size:13px;user-select:none;">
              <thead>
                <tr style="background:#f5f7fa;">
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Candidate</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Technology</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Experience</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Visa</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Location</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Availability</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Rate</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Rate Type</th>
                  <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Resume</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <br />
            <div style="margin-top:12px;">${formattedClosing}</div>
          </div>
        `;
      } else {
        finalBody = `
          <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
            <div>${formattedIntro}</div>
            ${formattedClosing ? `<br /><br /><div>${formattedClosing}</div>` : ''}
          </div>
        `;
      }

      await api.sendEmail({
        module,
        from: fromAddress.trim() || currentUser?.email || meta.defaultFrom,
        to: to.trim() ? to.trim() : undefined,
        cc: cc.trim() ? cc.trim() : undefined,
        subject,
        body: finalBody,
        attachments: composeAttachments,
        groupId: selectedGroup || undefined,
        members: recipients.map((r) => ({ entityType: r.entityType, entityId: r.entityId })),
      });
      if (draftId) {
        try {
          await api.deleteEmailMessage(draftId, true);
        } catch (_) {}
      }
      toast.success('Email sent successfully & logged to Sent');
      setComposeOpen(false);
      setDraftId(null);
      setComposeAttachments([]);
      setSubject('');
      setBody('');
      setTo('');
      setCc('');
      setSelectedGroup('');
      setRecipients([]);
      setCounts((c) => ({ ...c, sent: c.sent + 1, drafts: draftId ? Math.max(0, c.drafts - 1) : c.drafts }));
      setFolder('sent');
      setReadingMessage(null);
      void loadMessages('sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send email');
    } finally {
      setBusy(false);
    }
  };

  // Group helpers
  const selectGroup = async (gid: string) => {
    setSelectedGroup(gid);
    if (!gid) {
      setRecipients([]);
      return;
    }
    try {
      const g = await api.getMailGroup<Group>(gid);
      setRecipients(g.recipients || []);
    } catch (_) {}
  };

  const lookupRecipients = async (searchType = entityType, query = memberSearch) => {
    try {
      const res = await api.searchMailRecipients<Recipient>(module, searchType, query);
      setResults(res.data || []);
    } catch (_) {}
  };

  const openNewGroup = () => {
    const defaultType = meta.entities[0]?.value || 'candidate';
    setEditing({ id: '', groupName: '', description: '', module });
    setGroupName('');
    setDescription('');
    setEntityType(defaultType);
    setMemberSearch('');
    setCustomEmail('');
    setMembers([]);
    void lookupRecipients(defaultType, '');
  };

  const openEditGroup = async (g: Group) => {
    const defaultType = meta.entities[0]?.value || 'candidate';
    setEditing(g);
    setGroupName(g.groupName);
    setDescription(g.description || '');
    setEntityType(defaultType);
    setMemberSearch('');
    setCustomEmail('');
    try {
      const full = await api.getMailGroup<Group>(g.id);
      setMembers(full.recipients || []);
    } catch (_) {
      setMembers([]);
    }
    void lookupRecipients(defaultType, '');
  };

  const handleAddCustomEmail = () => {
    const raw = customEmail.trim();
    if (!raw) return;
    const emails = raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let addedCount = 0;

    for (const em of emails) {
      if (!emailRegex.test(em)) {
        toast.error(`"${em}" is not a valid email address.`);
        continue;
      }
      if (members.some((m) => m.email.toLowerCase() === em)) {
        toast.error(`"${em}" is already in this group.`);
        continue;
      }
      setMembers((prev) => [
        ...prev,
        {
          entityType: 'custom',
          entityId: em,
          name: em.split('@')[0],
          email: em,
        },
      ]);
      addedCount++;
    }
    if (addedCount > 0) {
      toast.success(`Added ${addedCount} email(s) to group`);
      setCustomEmail('');
    }
  };

  const saveGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        groupName: groupName.trim(),
        description: description.trim() || null,
        module,
        members: members.map((m) => ({ entityType: m.entityType, entityId: m.entityId })),
      };
      if (editing?.id) {
        await api.updateMailGroup(editing.id, payload);
        toast.success('Group updated');
      } else {
        await api.createMailGroup(payload);
        toast.success('Group created');
      }
      setEditing(null);
      void loadGroups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save group');
    } finally {
      setBusy(false);
    }
  };

  const removeGroup = async (g: Group) => {
    if (!confirm(`Delete mail group "${g.groupName}"?`)) return;
    try {
      await api.deleteMailGroup(g.id);
      toast.success('Group deleted');
      void loadGroups();
    } catch (_) {}
  };

  // Selection helpers
  const allSelected = messages.length > 0 && messages.every((m) => selectedIds.has(m.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(messages.map((m) => m.id)));
  };
  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] max-h-[1100px] w-full bg-[#F6F8FA] p-3 md:p-5 overflow-hidden">
      {/* Top Header / App Brand */}
      <div className="flex items-center justify-between pb-3 px-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#009E92] to-[#00C4B4] flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-[#071B4A] tracking-tight">{meta.title}</h1>
              <span className="rounded-full bg-emerald-100/70 border border-emerald-300/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{meta.description}</p>
          </div>
        </div>
      </div>

      {/* Main Mail App Window (Classic Gmail/Outlook 2-Rail Frame) */}
      <div className="flex-1 flex overflow-hidden rounded-2xl border border-[#DCE4EC] bg-white shadow-sm">
        {/* LEFT RAIL: Navigation & Folders */}
        <aside className="w-56 md:w-64 border-r border-[#E4ECF3] bg-[#FAFBFD] flex flex-col justify-between shrink-0 select-none">
          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Big Gmail-Style Compose Button */}
            <button
              onClick={() => {
                setDraftId(null);
                setTo('');
                setCc('');
                setSubject(module === 'bench' ? 'Consultant Profiles / Resumes - Available for Direct Client Requirements' : '');
                setBody(module === 'bench' ? 'Hi Team,\n\nPlease find our available bench consultants list for your direct client requirements below:' : '');
                setSignoff(getSubmissionsSignoff());
                setComposeAttachments([]);
                setComposeOpen(true);
                setComposeMinimized(false);
              }}
              className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-2xl bg-[#009E92] hover:bg-[#00897F] text-white font-bold text-sm shadow-md shadow-teal-700/15 hover:shadow-lg transition-all transform active:scale-[0.98]"
            >
              <Pencil className="h-4 w-4" />
              <span>Compose</span>
            </button>

            {/* Folder Navigation */}
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setFolder('inbox');
                  setReadingMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  folder === 'inbox'
                    ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Inbox className={`h-4 w-4 ${folder === 'inbox' ? 'text-[#009E92]' : 'text-slate-500'}`} />
                  <span>Inbox</span>
                </div>
                {counts.inboxUnread > 0 ? (
                  <span className="rounded-full bg-[#009E92] text-white px-2 py-0.5 text-[10px] font-bold">
                    {counts.inboxUnread}
                  </span>
                ) : counts.inbox > 0 ? (
                  <span className="text-[11px] text-slate-400 font-semibold">{counts.inbox}</span>
                ) : null}
              </button>

              <button
                onClick={() => {
                  setFolder('starred');
                  setReadingMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  folder === 'starred'
                    ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Star className={`h-4 w-4 ${folder === 'starred' ? 'text-amber-500 fill-amber-400' : 'text-slate-500'}`} />
                  <span>Starred</span>
                </div>
                {counts.starred > 0 && (
                  <span className="text-[11px] text-slate-400 font-semibold">{counts.starred}</span>
                )}
              </button>

              <button
                onClick={() => {
                  setFolder('sent');
                  setReadingMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  folder === 'sent'
                    ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Send className={`h-4 w-4 ${folder === 'sent' ? 'text-[#009E92]' : 'text-slate-500'}`} />
                  <span>Sent</span>
                </div>
                {counts.sent > 0 && (
                  <span className="text-[11px] text-slate-400 font-semibold">{counts.sent}</span>
                )}
              </button>

              <button
                onClick={() => {
                  setFolder('drafts');
                  setReadingMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  folder === 'drafts'
                    ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`h-4 w-4 ${folder === 'drafts' ? 'text-[#009E92]' : 'text-slate-500'}`} />
                  <span>Drafts</span>
                </div>
                {counts.drafts > 0 && (
                  <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-[10px] font-bold">
                    {counts.drafts}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setFolder('archive');
                  setReadingMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  folder === 'archive'
                    ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Archive className={`h-4 w-4 ${folder === 'archive' ? 'text-[#009E92]' : 'text-slate-500'}`} />
                  <span>Archive</span>
                </div>
                {counts.archive > 0 && (
                  <span className="text-[11px] text-slate-400 font-semibold">{counts.archive}</span>
                )}
              </button>

              <button
                onClick={() => {
                  setFolder('trash');
                  setReadingMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  folder === 'trash'
                    ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Trash2 className={`h-4 w-4 ${folder === 'trash' ? 'text-[#009E92]' : 'text-slate-500'}`} />
                  <span>Trash</span>
                </div>
                {counts.trash > 0 && (
                  <span className="text-[11px] text-slate-400 font-semibold">{counts.trash}</span>
                )}
              </button>

              <button
                onClick={() => {
                  setFolder('spam');
                  setReadingMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  folder === 'spam'
                    ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertOctagon className={`h-4 w-4 ${folder === 'spam' ? 'text-amber-600' : 'text-slate-500'}`} />
                  <span>Spam</span>
                </div>
                {counts.spam > 0 && (
                  <span className="text-[11px] text-slate-400 font-semibold">{counts.spam}</span>
                )}
              </button>

              {can('groups-view') && (
                <button
                  onClick={() => {
                    setFolder('groups');
                    setReadingMessage(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                    folder === 'groups'
                      ? 'bg-[#E6F5F4] text-[#00897F] font-bold shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className={`h-4 w-4 ${folder === 'groups' ? 'text-[#009E92]' : 'text-slate-500'}`} />
                    <span>Mail Groups</span>
                  </div>
                  {groups.length > 0 && (
                    <span className="rounded-full bg-slate-200/80 text-slate-600 px-2 py-0.5 text-[10px] font-bold">
                      {groups.length}
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>
        </aside>

        {/* RIGHT MAIN AREA: Action Toolbar + (Email List OR Reading Pane OR Mail Groups) */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Top Search & Action Bar (Gmail Style) */}
          <div className="h-14 border-b border-[#E4ECF3] px-4 flex items-center justify-between gap-3 bg-white shrink-0">
            {/* Left Tools: Selection, Refresh */}
            <div className="flex items-center gap-2">
              {folder !== 'groups' && !readingMessage && (
                <button
                  onClick={toggleSelectAll}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                >
                  {allSelected ? <CheckSquare className="h-4 w-4 text-[#009E92]" /> : <Square className="h-4 w-4" />}
                </button>
              )}

              {readingMessage ? (
                <button
                  onClick={() => setReadingMessage(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-[#009E92] hover:bg-slate-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to {folder.charAt(0).toUpperCase() + folder.slice(1)}</span>
                </button>
              ) : (
                <button
                  onClick={() => void loadMessages(folder === 'groups' ? 'inbox' : folder)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#009E92] transition-colors"
                  title="Refresh mail list"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                </button>
              )}

              {selectedIds.size > 0 && !readingMessage && (
                <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                  <span className="text-xs font-semibold text-slate-500 px-1">{selectedIds.size} selected</span>
                  {folder !== 'archive' && (
                    <button
                      onClick={() => void bulkMoveFolder('archive')}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                      title="Move to Archive"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  {folder !== 'spam' && (
                    <button
                      onClick={() => void bulkMoveFolder('spam')}
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                      title="Report Spam"
                    >
                      <AlertOctagon className="h-4 w-4" />
                    </button>
                  )}
                  {(folder === 'archive' || folder === 'trash' || folder === 'spam') && (
                    <button
                      onClick={() => void bulkMoveFolder('inbox')}
                      className="p-1.5 rounded-lg hover:bg-teal-50 text-slate-500 hover:text-[#009E92] transition-colors"
                      title="Move to Inbox"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => void bulkDeleteSelected()}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                    title={folder === 'trash' ? 'Permanently Delete' : 'Move to Trash'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Middle: Integrated Real Mail Search Bar */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadMessages(folder === 'groups' ? 'inbox' : folder);
                }}
                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-transparent focus:border-[#009E92] pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 transition-all outline-none"
                placeholder={
                  folder === 'inbox'
                    ? 'Search inbox messages, senders, subjects...'
                    : folder === 'sent'
                    ? 'Search sent emails, recipients, subjects...'
                    : folder === 'starred'
                    ? 'Search starred messages...'
                    : folder === 'drafts'
                    ? 'Search drafts...'
                    : folder === 'archive'
                    ? 'Search archive...'
                    : folder === 'trash'
                    ? 'Search trash...'
                    : folder === 'spam'
                    ? 'Search spam...'
                    : 'Search mail groups...'
                }
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch('');
                    void loadMessages(folder === 'groups' ? 'inbox' : folder);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Right: Count / Pagination indicator */}
            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
              {!readingMessage && messages.length > 0 && (
                <span>
                  1-{messages.length} of {messages.length}
                </span>
              )}
            </div>
          </div>

          {/* Body Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* VIEW 1: Reading Pane View */}
            {readingMessage ? (
              <div className="p-6 max-w-5xl mx-auto">
                {/* Header Action Row */}
                <div className="flex items-center justify-between border-b border-[#E4ECF3] pb-4 mb-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => openComposeWithReply(readingMessage)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#009E92] hover:bg-[#00897F] text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      <span>Reply</span>
                    </button>
                    <button
                      onClick={(e) => toggleStar(readingMessage, e)}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-500 transition-colors"
                      title={readingMessage.isStarred ? 'Unstar' : 'Star'}
                    >
                      <Star className={`h-4 w-4 ${readingMessage.isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
                    </button>

                    {readingMessage.folder !== 'archive' && (
                      <button
                        onClick={() => moveToFolder(readingMessage.id, 'archive')}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}

                    {(readingMessage.folder === 'archive' || readingMessage.folder === 'trash' || readingMessage.folder === 'spam') && (
                      <button
                        onClick={() => moveToFolder(readingMessage.id, 'inbox')}
                        className="p-2 rounded-lg hover:bg-teal-50 text-slate-500 hover:text-[#009E92] transition-colors"
                        title="Move to Inbox"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}

                    {readingMessage.folder !== 'spam' && (
                      <button
                        onClick={() => moveToFolder(readingMessage.id, 'spam')}
                        className="p-2 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Report Spam"
                      >
                        <AlertOctagon className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={(e) => deleteMessage(readingMessage, e)}
                      className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      title={readingMessage.folder === 'trash' ? 'Delete Permanently' : 'Move to Trash'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {new Date(readingMessage.sentAt || readingMessage.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Subject Heading */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <h2 className="text-xl font-black text-[#071B4A] leading-snug">
                    {readingMessage.subject}
                  </h2>
                  <span className="shrink-0 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    {readingMessage.status}
                  </span>
                </div>

                {/* Sender & Recipient Identity Card */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#009E92] to-teal-400 flex items-center justify-center text-white font-black text-sm shadow-xs">
                      {getInitials(readingMessage.fromName, readingMessage.fromEmail)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {readingMessage.fromName || readingMessage.fromEmail}
                        </span>
                        <span className="text-xs text-slate-500">&lt;{readingMessage.fromEmail}&gt;</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        to <span className="font-semibold text-slate-700">{readingMessage.toEmail}</span>
                        {readingMessage.ccEmail && (
                          <span className="ml-2 text-slate-400">cc: {readingMessage.ccEmail}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Direct Delivery</span>
                  </div>
                </div>

                {/* Email Body Pane (Real Paper Styling) */}
                <div
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 min-h-64 shadow-xs text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-normal"
                  onClick={(e) => {
                    const target = (e.target as HTMLElement).closest('a');
                    if (target) {
                      const text = target.textContent?.trim() || '';
                      const matchedAtt = readingMessage.attachments?.find((att) =>
                        att.filename === text || target.getAttribute('download') === att.filename || target.getAttribute('href')?.includes(att.filename)
                      );
                      if (matchedAtt) {
                        e.preventDefault();
                        downloadAttachment(matchedAtt);
                      }
                    }
                  }}
                >
                  <div dangerouslySetInnerHTML={{ __html: readingMessage.body }} />
                </div>

                {/* Attachments if any */}
                {Array.isArray(readingMessage.attachments) && readingMessage.attachments.length > 0 && (
                  <div className="mt-5 border-t border-[#E4ECF3] pt-4">
                    <div className="text-xs font-bold text-slate-600 mb-2.5 flex items-center gap-1.5">
                      <Paperclip className="h-4 w-4 text-slate-400" />
                      <span>Attachments ({readingMessage.attachments.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {readingMessage.attachments.map((att, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => downloadAttachment(att)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50/60 hover:border-[#009E92] hover:text-[#009E92] transition-all shadow-2xs group cursor-pointer text-left"
                          title={`Click to download ${att.filename}`}
                        >
                          <Paperclip className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#009E92] shrink-0" />
                          <span className="text-xs font-bold text-slate-800 group-hover:text-[#009E92] truncate max-w-[180px]">
                            {att.filename}
                          </span>
                          {att.sizeText && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({att.sizeText})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline Quick Reply Box (Gmail Style) */}
                <div className="mt-6 border-t border-[#E4ECF3] pt-5">
                  {!inlineReplyOpen ? (
                    <button
                      onClick={() => setInlineReplyOpen(true)}
                      className="flex items-center gap-2 w-full p-4 rounded-2xl border border-slate-300/80 bg-slate-50/70 hover:bg-white hover:border-[#009E92] text-slate-500 hover:text-slate-800 text-xs font-bold transition-all text-left shadow-xs"
                    >
                      <Reply className="h-4 w-4 text-[#009E92]" />
                      <span>Click here to reply to {readingMessage.fromName || readingMessage.fromEmail}...</span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-[#009E92] bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                        <div className="font-bold text-slate-700 flex items-center gap-1.5 truncate pr-2">
                          <Reply className="h-3.5 w-3.5 text-[#009E92] shrink-0" />
                          <span className="truncate">Replying to {readingMessage.fromName ? `${readingMessage.fromName} <${readingMessage.fromEmail}>` : readingMessage.fromEmail}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={popOutInlineReplyToCompose}
                            className="p-1 text-slate-400 hover:text-[#009E92] rounded hover:bg-slate-100 transition-colors"
                            title="Pop out to full compose window"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInlineReplyOpen(false);
                              setInlineReplyBody('');
                              setInlineReplyAttachments([]);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                            title="Close"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={4}
                        autoFocus
                        value={inlineReplyBody}
                        onChange={(e) => setInlineReplyBody(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full text-xs text-slate-800 leading-relaxed outline-none resize-y"
                      />

                      {/* Attached files preview */}
                      {inlineReplyAttachments.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            <span>Attachments ({inlineReplyAttachments.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                            {inlineReplyAttachments.map((file, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-700 font-medium group"
                              >
                                <Paperclip className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#009E92]" />
                                <span className="max-w-[140px] truncate" title={file.filename}>
                                  {file.filename}
                                </span>
                                {file.sizeText && (
                                  <span className="text-[10px] text-slate-400 font-semibold">{file.sizeText}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeInlineReplyAttachment(idx)}
                                  className="text-slate-400 hover:text-red-500 rounded p-0.5 ml-0.5"
                                  title="Remove file"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={inlineFileInputRef}
                            onChange={handleInlineReplyFileSelect}
                            multiple
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => inlineFileInputRef.current?.click()}
                            className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-[#009E92] hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold border border-slate-200"
                            title="Attach files (PDF, docs, images, etc.)"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            <span>Attach</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingInlineDraft || sendingInlineReply}
                            onClick={handleSaveInlineReplyDraft}
                            className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-semibold border border-slate-200"
                            title="Save current reply as draft"
                          >
                            {savingInlineDraft ? 'Saving…' : 'Save Draft'}
                          </button>
                          <span className="text-[11px] text-slate-400 hidden sm:inline ml-1">
                            Sent directly via {fromAddress || meta.defaultFrom}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setInlineReplyOpen(false);
                              setInlineReplyBody('');
                              setInlineReplyAttachments([]);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            disabled={sendingInlineReply}
                            onClick={handleSendInlineReply}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#009E92] hover:bg-[#00897F] text-white font-bold text-xs shadow-xs"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>{sendingInlineReply ? 'Sending…' : 'Send Reply'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : folder === 'groups' ? (
              /* VIEW 2: Mail Groups Manager */
              <div className="p-6 max-w-5xl mx-auto">
                <div className="flex items-center justify-between border-b border-[#E4ECF3] pb-4 mb-4">
                  <div>
                    <h2 className="text-lg font-black text-[#071B4A]">Mail Groups</h2>
                    <p className="text-xs text-slate-500">
                      Manage recipient lists for quick, 1-click bulk mailings.
                    </p>
                  </div>
                  {can('groups-create') && (
                    <button
                      onClick={openNewGroup}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#009E92] hover:bg-[#00897F] text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Group</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#009E92]/50 hover:shadow-xs transition-all"
                    >
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">{g.groupName}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {g.description || 'No description'} ·{' '}
                          <b className="text-slate-700">{g._count?.members ?? 0} members</b>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void openEditGroup(g)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View / Edit
                        </button>
                        {can('groups-delete') && (
                          <button
                            onClick={() => void removeGroup(g)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete group"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {!groups.length && (
                    <div className="py-16 text-center text-slate-400">
                      <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <div className="font-bold text-slate-600 text-sm">No mail groups created yet</div>
                      <p className="text-xs text-slate-400 mt-1">Create groups of consultants, vendors, or contacts for fast sending.</p>
                      {can('groups-create') && (
                        <button
                          onClick={openNewGroup}
                          className="mt-4 px-4 py-2 rounded-xl bg-[#009E92] text-white text-xs font-bold shadow-xs mx-auto"
                        >
                          + Create First Group
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* VIEW 3: Real Mail Row Grid (Inbox, Starred, Sent) */
              <div className="divide-y divide-slate-100">
                {messages.map((msg) => {
                  const isSelected = selectedIds.has(msg.id);
                  const isUnread = !msg.isRead && folder === 'inbox';
                  return (
                    <div
                      key={msg.id}
                      onClick={() => void openMessage(msg)}
                      className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none ${
                        isSelected
                          ? 'bg-teal-50/60'
                          : isUnread
                          ? 'bg-[#F3FAF9] hover:bg-[#EAF6F5]'
                          : 'bg-white hover:bg-slate-50/90'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => toggleSelectOne(msg.id, e)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#009E92]" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>

                      {/* Star Icon */}
                      <button
                        onClick={(e) => toggleStar(msg, e)}
                        className="text-slate-300 hover:text-amber-500 p-0.5 transition-colors"
                        title={msg.isStarred ? 'Unstar' : 'Star'}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            msg.isStarred ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                          }`}
                        />
                      </button>

                      {/* Sender / Recipient Column */}
                      <div className="w-48 md:w-56 shrink-0 truncate">
                        <span
                          className={`text-xs truncate block ${
                            isUnread ? 'font-black text-slate-900' : 'font-semibold text-slate-700'
                          }`}
                        >
                          {folder === 'sent' ? (
                            `To: ${msg.toEmail}`
                          ) : folder === 'drafts' ? (
                            <span className="text-amber-700 font-semibold">[Draft] {msg.toEmail || '(No recipient)'}</span>
                          ) : (
                            msg.fromName || msg.fromEmail
                          )}
                        </span>
                      </div>

                      {/* Subject + Snippet Column (Real Mail Row Format) */}
                      <div className="flex-1 min-w-0 flex items-center gap-2 truncate">
                        <span
                          className={`text-xs truncate ${
                            isUnread ? 'font-bold text-slate-900' : 'font-normal text-slate-700'
                          }`}
                        >
                          {msg.subject || '(No subject)'}
                        </span>
                        <span className="text-slate-300 font-normal shrink-0">—</span>
                        <span className="text-xs text-slate-400 font-normal truncate">
                          {msg.snippet || msg.body.replace(/<[^>]*>/g, '').slice(0, 100)}
                        </span>
                      </div>

                      {/* Paperclip if attachments */}
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}

                      {/* Date & Hover Action Buttons */}
                      <div className="w-24 shrink-0 text-right flex items-center justify-end">
                        {/* Default date view */}
                        <span
                          className={`text-xs group-hover:hidden ${
                            isUnread ? 'font-bold text-slate-800' : 'font-normal text-slate-400'
                          }`}
                        >
                          {formatDate(msg.sentAt || msg.createdAt)}
                        </span>

                        {/* Quick Action Icons on hover */}
                        <div className="hidden group-hover:flex items-center gap-1">
                          {folder === 'drafts' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void openMessage(msg);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-[#009E92] hover:bg-slate-200/60"
                              title="Edit draft"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : folder === 'trash' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void moveToFolder(msg.id, 'inbox');
                              }}
                              className="p-1 rounded text-slate-400 hover:text-[#009E92] hover:bg-slate-200/60"
                              title="Restore to Inbox"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openComposeWithReply(msg);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-[#009E92] hover:bg-slate-200/60"
                              title="Reply"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => deleteMessage(msg, e)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title={folder === 'trash' ? 'Permanently Delete' : 'Move to Trash'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty State */}
                {!messages.length && !loadingMessages && (
                  <div className="py-20 text-center text-slate-400">
                    <Mail className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <div className="font-bold text-slate-600 text-sm">
                      Your {folder} folder is empty
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {folder === 'inbox' && 'Incoming emails from vendors, clients, and partners will show up here.'}
                      {folder === 'sent' && 'Emails sent from this workspace will be recorded here.'}
                      {folder === 'starred' && 'No messages have been starred yet.'}
                      {folder === 'drafts' && 'No draft messages saved.'}
                      {folder === 'archive' && 'Archived conversations will appear here.'}
                      {folder === 'trash' && 'Trash is empty.'}
                      {folder === 'spam' && 'No messages reported as spam.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* FLOATING GMAIL-STYLE COMPOSE MODAL (Bottom Right) */}
      {composeOpen && (
        <div
          className={`fixed z-50 bg-white border border-[#DCE4EC] rounded-t-2xl shadow-2xl transition-all duration-200 flex flex-col ${
            composeMaximized
              ? 'inset-6 md:inset-12 rounded-2xl'
              : composeMinimized
              ? 'bottom-0 right-8 w-80 h-11'
              : 'bottom-0 right-6 md:right-10 w-[580px] max-w-[calc(100vw-32px)] h-[620px] max-h-[85vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="h-11 bg-[#071B4A] text-white px-4 rounded-t-2xl flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5 text-[#009E92]" />
              <span className="text-xs font-bold">{draftId ? 'Edit Draft' : 'New Message'}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setComposeMinimized(!composeMinimized)}
                className="p-1 text-slate-300 hover:text-white rounded"
                title="Minimize"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setComposeMaximized(!composeMaximized)}
                className="p-1 text-slate-300 hover:text-white rounded"
                title="Maximize"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setComposeOpen(false)}
                className="p-1 text-slate-300 hover:text-white rounded"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Form Body (Hidden if minimized) */}
          {!composeMinimized && (
            <form onSubmit={handleSendCompose} className="flex-1 flex flex-col overflow-hidden bg-white">
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {/* Send From Field */}
                <div className="flex items-center border-b border-slate-100 pb-2">
                  <span className="w-14 text-xs font-bold text-slate-500">From:</span>
                  <input
                    type="email"
                    required
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                    placeholder="anyemail@yourcompany.com"
                    className="flex-1 text-xs font-medium text-slate-800 outline-none"
                  />
                </div>

                {/* To Field with Mail Group Selector */}
                <div className="flex items-center border-b border-slate-100 pb-2">
                  <span className="w-14 text-xs font-bold text-slate-500">To:</span>
                  <input
                    type="email"
                    required={recipients.length === 0}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 text-xs font-medium text-slate-800 outline-none"
                  />
                  {groups.length > 0 && (
                    <select
                      value={selectedGroup}
                      onChange={(e) => void selectGroup(e.target.value)}
                      className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 outline-none ml-2"
                    >
                      <option value="">+ Mail Group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.groupName} ({g._count?.members ?? 0})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Selected group recipient tags */}
                {recipients.length > 0 && (
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Group Members ({recipients.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {recipients.map((r) => (
                        <span
                          key={`${r.entityType}:${r.entityId}`}
                          className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {r.name}
                          <button
                            type="button"
                            onClick={() => setRecipients((all) => all.filter((x) => x !== r))}
                            className="text-slate-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CC Field */}
                <div className="flex items-center border-b border-slate-100 pb-2">
                  <span className="w-14 text-xs font-bold text-slate-500">Cc:</span>
                  <input
                    type="email"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com (optional)"
                    className="flex-1 text-xs font-medium text-slate-800 outline-none"
                  />
                </div>

                {/* Subject Field */}
                <div className="flex items-center border-b border-slate-100 pb-2">
                  <span className="w-14 text-xs font-bold text-slate-500">Subject:</span>
                  <input
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject"
                    className="flex-1 text-xs font-bold text-slate-900 outline-none"
                  />
                </div>

                {/* Message Body (Editable) */}
                <textarea
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email pitch, requirement details, or message..."
                  className="w-full h-28 text-xs leading-relaxed text-slate-800 outline-none resize-y pt-2"
                />

                {/* Consultant Summary Table (Auto-Generated from Attached Resumes · Non-Editable) */}
                {attachedConsultantsTable.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 select-none my-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-black uppercase text-[#071B4A] tracking-wide">
                        Consultant Summary Table
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-[#009E92] border border-teal-200">
                        Auto-Generated ({attachedConsultantsTable.length})
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-[#dfe7ef] bg-white shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#f5f7fa] text-slate-800 font-bold border-b border-[#dfe7ef]">
                            <th className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">Candidate</th>
                            <th className="p-2 border-r border-[#dfe7ef]">Technology</th>
                            <th className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">Experience</th>
                            <th className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">Visa</th>
                            <th className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">Location</th>
                            <th className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">Availability</th>
                            <th className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">Rate</th>
                            <th className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">Rate Type</th>
                            <th className="p-2 whitespace-nowrap">Resume</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dfe7ef] text-slate-700">
                          {attachedConsultantsTable.map((c, i) => (
                            <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-2 font-bold text-slate-900 border-r border-[#dfe7ef] whitespace-nowrap">{c.candidateName}</td>
                              <td className="p-2 border-r border-[#dfe7ef]">{c.skills}</td>
                              <td className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">{c.experienceYears}</td>
                              <td className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">{c.visaStatus}</td>
                              <td className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">{c.currentLocation}</td>
                              <td className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">{c.availability}</td>
                              <td className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">{c.ratePerHour}</td>
                              <td className="p-2 border-r border-[#dfe7ef] whitespace-nowrap">{c.rateType}</td>
                              <td className="p-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openOrDownloadAttachment(c.attachmentFilename, c.resumeUrl)}
                                  className="text-[#009E92] hover:text-[#007A71] underline font-medium text-xs cursor-pointer max-w-[170px] truncate text-left p-0 bg-transparent border-none outline-none block"
                                  title={`Click to download ${c.attachmentFilename}`}
                                >
                                  {c.attachmentFilename}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sign-off / Closing (Editable, placed after the table) */}
                <textarea
                  rows={4}
                  value={signoff}
                  onChange={(e) => setSignoff(e.target.value)}
                  placeholder="Thanks & Regards..."
                  className="w-full text-xs leading-relaxed text-slate-800 outline-none resize-none pt-2 font-normal"
                />

                {/* Attached Files List */}
                {composeAttachments.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      <span>Attachments ({composeAttachments.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                      {composeAttachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-700 font-medium group"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#009E92]" />
                          <button
                            type="button"
                            onClick={() => openOrDownloadAttachment(file.filename)}
                            className="max-w-[140px] truncate text-slate-700 hover:text-[#009E92] hover:underline text-left cursor-pointer font-semibold"
                            title={`Click to open/download ${file.filename}`}
                          >
                            {file.filename}
                          </button>
                          <span className="text-[10px] text-slate-400 font-semibold">{file.sizeText}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="text-slate-400 hover:text-red-500 rounded p-0.5 ml-0.5"
                            title="Remove file"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Compose Footer Toolbar */}
              <div className="h-14 border-t border-slate-100 px-4 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#009E92] hover:bg-[#00897F] text-white font-bold text-xs shadow-sm active:scale-98 transition-all"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{busy ? 'Sending…' : 'Send'}</span>
                  </button>

                  {/* Attachment Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg text-slate-500 hover:text-[#009E92] hover:bg-slate-200/60 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                    title="Attach files (PDF, docs, images, etc.)"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  {/* Save Draft Button */}
                  <button
                    type="button"
                    disabled={savingDraft || busy}
                    onClick={handleSaveDraft}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors text-xs font-semibold"
                    title="Save current message as draft"
                  >
                    {savingDraft ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (draftId) {
                        void api.deleteEmailMessage(draftId, true);
                      }
                      setComposeOpen(false);
                      setDraftId(null);
                      setComposeAttachments([]);
                      setSubject('');
                      setBody('');
                      setTo('');
                      setCc('');
                      setSelectedGroup('');
                      setRecipients([]);
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Discard draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Edit Group Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl border border-[#E4ECF3]">
            <div className="flex justify-between items-center border-b border-[#E4ECF3] pb-3">
              <h2 className="text-lg font-black text-[#071B4A]">
                {editing.id ? 'Edit Mail Group' : 'Create Mail Group'}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-black uppercase text-slate-600">Group name *</span>
                <input
                  className="crm-input font-bold"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Java Consultants"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-black uppercase text-slate-600">Description</span>
                <input
                  className="crm-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes or details"
                />
              </label>
            </div>

            {/* Direct Email Addition */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="mb-1.5 block text-xs font-black uppercase text-slate-600">
                Add Any Email Directly
              </span>
              <div className="flex gap-2">
                <input
                  className="crm-input flex-1 bg-white font-medium"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomEmail();
                    }
                  }}
                  placeholder="Enter email address (or comma-separated emails, e.g. dev@example.com, client@org.com)..."
                />
                <button
                  type="button"
                  onClick={handleAddCustomEmail}
                  className="px-3 py-1.5 bg-[#009E92] hover:bg-[#00867d] text-white text-xs font-semibold rounded-md transition-colors shadow-sm whitespace-nowrap self-center"
                >
                  Add Email
                </button>
              </div>
            </div>

            {/* CRM Contact Search */}
            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
              <select
                className="crm-input font-medium"
                value={entityType}
                onChange={(e) => {
                  const val = e.target.value;
                  setEntityType(val);
                  void lookupRecipients(val, memberSearch);
                }}
              >
                {meta.entities.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
              <input
                className="crm-input"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void lookupRecipients(entityType, memberSearch);
                  }
                }}
                placeholder="Search CRM contacts by name or skill..."
              />
              <button
                type="button"
                onClick={() => void lookupRecipients(entityType, memberSearch)}
                className="crm-secondary-button"
              >
                <Search className="h-4 w-4" /> Search
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {/* Search Results / CRM Contacts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase text-slate-600">
                    CRM Contacts ({results.length})
                  </h3>
                  {results.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setMembers((m) => {
                          const existing = new Set(m.map((x) => `${x.entityType}:${x.entityId}`));
                          const toAdd = results.filter((r) => !existing.has(`${r.entityType}:${r.entityId}`));
                          return [...m, ...toAdd];
                        });
                        setResults([]);
                      }}
                      className="text-xs font-bold text-[#009E92] hover:text-[#00867d] hover:underline"
                    >
                      + Add All ({results.length})
                    </button>
                  )}
                </div>
                <div className="max-h-64 space-y-2 overflow-auto border border-slate-200 rounded-xl p-2 bg-slate-50 min-h-[140px]">
                  {results.map((r) => (
                    <div
                      key={`${r.entityType}:${r.entityId}`}
                      className="w-full flex items-center justify-between rounded-lg bg-white border border-slate-200 p-2.5 hover:border-[#009E92] transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <b className="text-xs text-slate-900 block truncate">{r.name}</b>
                        <div className="text-[11px] text-slate-500 truncate">{r.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMembers((m) => [...m, r]);
                          setResults((x) => x.filter((y) => y !== r));
                        }}
                        className="flex-shrink-0 px-2.5 py-1 bg-teal-50 hover:bg-[#009E92] text-[#009E92] hover:text-white rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add
                      </button>
                    </div>
                  ))}
                  {!results.length && (
                    <div className="py-8 text-center text-xs text-slate-400">
                      {memberSearch
                        ? `No contacts found matching "${memberSearch}".`
                        : 'No contacts found in this list. Try searching or add emails directly above.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Members */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase text-slate-600">
                    Selected Members ({members.length})
                  </h3>
                  {members.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setMembers([]);
                        void lookupRecipients(entityType, memberSearch);
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="max-h-64 space-y-2 overflow-auto border border-slate-200 rounded-xl p-2 bg-slate-50 min-h-[140px]">
                  {members.map((r) => (
                    <div
                      key={`${r.entityType}:${r.entityId}`}
                      className="w-full flex items-center justify-between rounded-lg bg-white border border-slate-200 p-2.5 hover:border-red-200 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <b className="text-xs text-slate-900 truncate">{r.name}</b>
                          {r.entityType === 'custom' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              Direct
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{r.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMembers((x) => x.filter((y) => y !== r));
                          if (r.entityType !== 'custom') {
                            setResults((prev) => [...prev, r]);
                          }
                        }}
                        className="flex-shrink-0 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove member"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {!members.length && (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No members added yet. Click <b>+ Add</b> on any contact or add custom emails above.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#E4ECF3] pt-4">
              <button onClick={() => setEditing(null)} className="crm-secondary-button">
                Cancel
              </button>
              <button disabled={busy} onClick={() => void saveGroup()} className="crm-primary-button">
                Save Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
