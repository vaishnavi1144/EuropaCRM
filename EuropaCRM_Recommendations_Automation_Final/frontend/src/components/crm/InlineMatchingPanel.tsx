import { AlertTriangle, BriefcaseBusiness, CheckCircle2, ExternalLink, FileText, Send, Sparkles, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { RecordRow } from '@/types';
import type { MatchEntry } from '@/components/crm/MatchResultsDialog';

export function InlineMatchingPanel({
  sourceType,
  source,
  entries,
  loading,
  onClose,
  onSubmit,
}: {
  sourceType: 'job' | 'consultant';
  source: RecordRow;
  entries: MatchEntry[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (entry: MatchEntry, overrideReason: string) => Promise<void>;
}) {
  const sorted = [...entries].sort((a, b) => b.match.percentage - a.match.percentage);
  const sourceName = sourceType === 'job'
    ? String(source.jobTitle ?? source.jobReference ?? 'Selected Job')
    : String(source.candidateName ?? source.consultantCode ?? 'Selected Consultant');

  const submit = async (entry: MatchEntry) => {
    let overrideReason = '';
    if (entry.match.requiresOverride || entry.match.warnings.length > 0) {
      overrideReason = window.prompt(
        `This is a ${entry.match.percentage}% ${entry.match.category}. Enter a recruiter justification to submit anyway:`,
        entry.match.strengths[0] ?? ''
      )?.trim() ?? '';
      if (entry.match.requiresOverride && !overrideReason) return;
    }
    await onSubmit(entry, overrideReason);
  };

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[#CFEAE7] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[#E4ECF3] bg-gradient-to-r from-[#F0FCFA] to-white px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[#071B4A]">
            <Sparkles className="h-4 w-4 text-[#009E92]" />
            {sourceType === 'job' ? 'Recommended Consultants' : 'Recommended Jobs'} for {sourceName}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Live matches calculated from active Jobs and active Bench Consultants. Use Submit Resume to create the linked Submission automatically.</p>
        </div>
        <button aria-label="Close recommendations" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Calculating live matches…</div>
      ) : sorted.length === 0 ? (
        <div className="py-12 text-center"><div className="font-semibold text-[#071B4A]">No active matches found</div><div className="mt-1 text-xs text-slate-500">Add an open Job and an active Bench Consultant with skills, experience, visa, location and rate.</div></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] border-collapse text-[11px]">
            <thead className="bg-[#FCFDFD] text-[#071B4A]">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-3 text-left font-bold">{sourceType === 'job' ? 'Consultant' : 'Job Title'}</th>
                <th className="px-3 py-3 text-left font-bold">Client / Vendor</th>
                <th className="px-3 py-3 text-left font-bold">Location</th>
                <th className="px-3 py-3 text-left font-bold">Experience</th>
                <th className="px-3 py-3 text-left font-bold">Rate / Hour</th>
                <th className="px-3 py-3 text-center font-bold">Match</th>
                <th className="px-3 py-3 text-left font-bold">Missing / Review</th>
                <th className="w-36 min-w-36 px-3 py-3 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, index) => {
                const item = sourceType === 'job' ? entry.consultant : entry.job;
                const match = entry.match;
                const key = String(item?.id ?? index);
                const consultant = sourceType === 'job' ? item : source;
                const job = sourceType === 'job' ? source : item;
                const scoreTone = match.percentage >= 85 ? 'border-emerald-500 text-emerald-700' : match.percentage >= 70 ? 'border-lime-500 text-lime-700' : match.percentage >= 55 ? 'border-amber-500 text-amber-700' : 'border-rose-400 text-rose-600';
                return (
                  <tr key={key} className="border-b border-slate-100 align-top hover:bg-[#FBFEFD] last:border-0">
                    <td className="px-3 py-3 text-[#071B4A]">
                      <div className="font-semibold">{sourceType === 'job' ? String(consultant?.candidateName ?? 'Consultant') : String(job?.jobTitle ?? '—')}</div>
                      <div className="mt-1 text-[10px] text-slate-500">{sourceType === 'job' ? String(consultant?.primarySkill ?? consultant?.technology ?? consultant?.currentJobTitle ?? '') : String(job?.workMode ?? '')}</div>
                    </td>
                    <td className="px-3 py-3"><div>{String(job?.endClient ?? job?.company ?? '—')}</div><div className="mt-1 text-[10px] text-slate-500">{String(job?.vendorCompany ?? 'Vendor not provided')}</div></td>
                    <td className="px-3 py-3">{String(job?.location ?? consultant?.currentLocation ?? '—')}</td>
                    <td className="px-3 py-3">{sourceType === 'job' ? `${String(consultant?.experienceYears ?? 0)} Y` : `${String(job?.minExperience ?? 0)} Y required`}</td>
                    <td className="px-3 py-3">{sourceType === 'job' ? `$${Number(consultant?.ratePerHour ?? consultant?.expectedRate ?? 0).toFixed(2)}` : job?.maxRate != null ? `$${Number(job.maxRate).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-3 text-center"><span className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-[3px] bg-white font-extrabold ${scoreTone}`}>{match.percentage}%</span></td>
                    <td className="px-3 py-3"><SkillList items={match.missing?.skills ?? []} />{match.warnings.length > 0 && <div title={match.warnings.join(' ')} className="mt-2 flex items-center gap-1 text-[10px] text-amber-700"><AlertTriangle className="h-3 w-3" />Review needed</div>}</td>
                    <td className="w-36 min-w-36 px-3 py-3">
                      <div className="flex flex-col gap-2 whitespace-nowrap">
                        <Button type="button" disabled={!match.canSubmit} onClick={() => void submit(entry)} className={match.requiresOverride ? '!bg-orange-500 hover:!bg-orange-600' : ''}><Send className="h-3.5 w-3.5" />{match.requiresOverride ? 'Submit Anyway' : 'Submit Resume'}</Button>
                        {sourceType === 'job' && consultant?.resumeUrl && <a className="crm-secondary-button inline-flex h-8 items-center justify-center gap-1.5 px-2 text-[10px]" href={String(consultant.resumeUrl)} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" />Resume</a>}
                        <button type="button" onClick={() => window.alert(`${match.recommendation}\n\nStrengths: ${match.strengths.join('; ') || 'None'}\nWarnings: ${match.warnings.join('; ') || 'None'}`)} className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold text-[#007C72] hover:underline"><ExternalLink className="h-3 w-3" />View Details</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && sorted.length > 0 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px]"><span className="flex items-center gap-1.5 text-slate-500"><CheckCircle2 className="h-4 w-4 text-[#009E92]" />{sorted.length} live recommendation{sorted.length === 1 ? '' : 's'} calculated</span><span className="font-semibold text-[#007C72]">Strong · Good · Review · Possible · Low</span></div>}
    </section>
  );
}

function SkillList({ items, positive = false }: { items: string[]; positive?: boolean }) {
  if (!items.length) return <span className="text-slate-400">None</span>;
  return <div className="flex max-w-52 flex-wrap gap-1">{items.slice(0, 6).map((item) => <span key={item} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${positive ? 'bg-[#E5F8F5] text-[#007C72]' : 'bg-rose-50 text-rose-600'}`}>{item}</span>)}</div>;
}
