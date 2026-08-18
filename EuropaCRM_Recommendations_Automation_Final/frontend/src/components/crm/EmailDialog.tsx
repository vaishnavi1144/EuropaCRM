import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

export type EmailAttachment = { filename: string; content: string; contentType?: string };

export type EmailDialogInitial = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  validationMessage?: string;
  requireAttachments?: boolean;
};

export function EmailDialog({ open, onOpenChange, onSend, initial, title = 'Send Email', description = 'Send an email through the SMTP account saved in System Settings.' }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (payload: { to: string; cc?: string | string[]; subject: string; body: string; attachments?: EmailAttachment[] }) => Promise<void>;
  initial?: EmailDialogInitial;
  title?: string;
  description?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [to, setTo] = useState(initial?.to ?? '');
  const [cc, setCc] = useState(initial?.cc ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? 'Europa CRM follow-up');
  const [body, setBody] = useState(initial?.body ?? 'Hello,\n\nFollowing up from Europa CRM.\n\nRegards');
  const [attachments, setAttachments] = useState<EmailAttachment[]>(initial?.attachments ?? []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [validationMessage, setValidationMessage] = useState(initial?.validationMessage ?? '');
  const [requireAttachments, setRequireAttachments] = useState(initial?.requireAttachments ?? false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setValidationMessage(initial?.validationMessage ?? '');
    setRequireAttachments(initial?.requireAttachments ?? false);
    setTo(initial?.to ?? '');
    setCc(initial?.cc ?? '');
    setSubject(initial?.subject ?? 'Europa CRM follow-up');
    setBody(initial?.body ?? 'Hello,\n\nFollowing up from Europa CRM.\n\nRegards');
    setAttachments(initial?.attachments ?? []);
    setReplaceIndex(null);
  }, [open, initial]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const items = await Promise.all(Array.from(files).map((file) => new Promise<EmailAttachment>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] ?? '';
          resolve({ filename: file.name, content: base64, contentType: file.type || undefined });
        };
        reader.onerror = () => reject(new Error(`Unable to read file ${file.name}`));
        reader.readAsDataURL(file);
      })));
      setAttachments((current) => {
        if (replaceIndex === null) return [...current, ...items];
        const next = [...current];
        next.splice(replaceIndex, 1, ...items);
        setReplaceIndex(null);
        return next;
      });
      setValidationMessage('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load attachments.');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (filename: string) => setAttachments((current) => current.filter((item) => item.filename !== filename));

  const normalizeEmailList = (value: string) => value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setError('');
    if (requireAttachments && attachments.length === 0) {
      setError('Please attach the candidate resume before sending.');
      setSending(false);
      return;
    }
    try {
      const ccPayload = cc.trim() ? normalizeEmailList(cc) : undefined;
      await onSend({ to, cc: ccPayload, subject, body, attachments: attachments.length ? attachments : undefined });
      onOpenChange(false);
      setTo('');
      setCc('');
      setSubject('Europa CRM follow-up');
      setBody('Hello,\n\nFollowing up from Europa CRM.\n\nRegards');
      setAttachments([]);
      setValidationMessage('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Email failed.');
    } finally { setSending(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-xl font-bold text-slate-950">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">{description}</DialogDescription>
        {validationMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {validationMessage}
          </div>
        )}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">To *</span><input required type="email" className="crm-input" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">CC</span><input type="text" className="crm-input" value={cc} onChange={(event) => setCc(event.target.value)} placeholder="optional comma-separated addresses" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Subject *</span><input required className="crm-input" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Message *</span><textarea required className="crm-input min-h-40 resize-y py-2" value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(event) => handleFiles(event.target.files)} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Attachments</span>
            <input
              type="file"
              className="crm-input"
              multiple
              onClick={() => setReplaceIndex(null)}
              onChange={(event) => handleFiles(event.target.files)}
            />
          </label>
          {attachments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</div>
              <div className="space-y-2">
                {attachments.map((item, index) => (
                  <div key={item.filename} className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="truncate text-sm text-slate-700">{item.filename}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="crm-secondary-button text-xs"
                        onClick={() => {
                          setReplaceIndex(index);
                          fileInputRef.current?.click();
                        }}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#b91c1c] hover:text-red-600"
                        onClick={() => removeAttachment(item.filename)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="secondary" disabled={sending || uploading} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={sending || uploading}>{sending ? 'Sending...' : uploading ? 'Uploading attachments…' : 'Send Email'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
