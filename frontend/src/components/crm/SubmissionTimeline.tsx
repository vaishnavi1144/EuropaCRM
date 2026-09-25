import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { RecordRow } from '@/types';

type TimelineRow = { id: string; date: string; user: string; action: string; notes?: string };

export function SubmissionTimeline({ submission }: { submission: RecordRow }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const submissionId = submission.id;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const activitiesRes = await api.list<RecordRow>('activities', { limit: 200, sortBy: 'createdOn', sortOrder: 'asc', filters: { relatedEntityType: 'Submission', relatedEntityId: submissionId } });
        const emailsRes = await api.list<RecordRow>('submission-emails', { limit: 100, sortBy: 'sentDate', sortOrder: 'asc', filters: { submissionId } });

        const items: TimelineRow[] = [];

        // Resume created from submission record
        if (submission.createdAt) {
          items.push({ id: `submission-${submissionId}`, date: String(submission.createdAt), user: String(submission.ownerName ?? submission.createdByUserName ?? 'System'), action: 'Resume created', notes: submission.candidateName ? String(submission.candidateName) : undefined });
        }

        // Emails (resume sent)
        for (const em of emailsRes.data ?? []) {
          items.push({ id: `email-${em.id}`, date: String(em.sentDate ?? em.createdAt ?? ''), user: String(em.sentBy ?? em.ownerName ?? em.createdByUserName ?? 'System'), action: 'Resume sent', notes: String(em.subject ?? '') });
        }

        // Activities
        for (const act of activitiesRes.data ?? []) {
          const date = String(act.createdOn ?? act.createdAt ?? '');
          const user = String(act.ownerName ?? act.createdByUserName ?? act.owner ?? 'System');
          const action = String(act.activity ?? act.subject ?? act.type ?? 'Activity');
          const notes = String(act.description ?? JSON.stringify(act.customData ?? {}) ?? '');
          items.push({ id: `act-${act.id}`, date, user, action, notes });
        }

        // Deduplicate and sort by date (ascending)
        const uniq = new Map<string, TimelineRow>();
        items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        for (const it of items) uniq.set(it.id, it);
        if (!mounted) return;
        setRows(Array.from(uniq.values()));
      } catch (error) {
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [submission, submissionId]);

  const rendered = useMemo(() => rows.map((r) => ({ ...r, date: r.date ? (r.date.length > 10 ? r.date : `${r.date}`) : '' })), [rows]);

  return (
    <div className="mt-6">
      <div className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2">Activity Timeline</div>
      <div className="rounded-lg border border-[#E4ECF3] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-4 text-xs text-slate-400">Loading…</td></tr>
            ) : rendered.length ? (
              rendered.map((r) => (
                <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-2 align-top text-xs text-slate-700">{r.date}</td>
                  <td className="px-3 py-2 align-top text-xs text-slate-700">{r.user}</td>
                  <td className="px-3 py-2 align-top text-xs text-slate-700">{r.action}</td>
                  <td className="px-3 py-2 align-top text-xs text-slate-700 break-words whitespace-pre-wrap">{r.notes ?? '—'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-3 py-4 text-xs text-slate-400">No timeline entries found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SubmissionTimeline;
