import { useMemo, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, FileText, Send, Sparkles, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { RecordRow } from '@/types';

export type MatchDimension = { score: number | null; evaluated: boolean; reason: string };
export type MatchResult = {
  percentage: number;
  category: string;
  recommendation: string;
  strengths: string[];
  warnings: string[];
  hardBlockers: string[];
  canSubmit: boolean;
  requiresOverride: boolean;
  dimensions: Record<string, MatchDimension>;
  matched: { skills: string[]; equivalentSkills?: Array<{ required: string; consultant: string }> };
  missing: { skills: string[] };
};
export type MatchEntry = { consultant?: RecordRow; job?: RecordRow; match: MatchResult };

export function MatchResultsDialog({
  open,
  onOpenChange,
  sourceType,
  source,
  entries,
  loading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: 'job' | 'consultant';
  source: RecordRow | null;
  entries: MatchEntry[];
  loading: boolean;
  onSubmit: (entry: MatchEntry, overrideReason: string) => Promise<void>;
}) {
  const [submittingKey, setSubmittingKey] = useState('');
  const title = sourceType === 'job' ? 'Recommended Consultants' : 'Recommended Jobs';
  const sourceName = sourceType === 'job' ? String(source?.jobTitle ?? 'Job') : String(source?.candidateName ?? 'Consultant');
  const sorted = useMemo(() => [...entries].sort((a, b) => b.match.percentage - a.match.percentage), [entries]);

  const submit = async (entry: MatchEntry, key: string) => {
    if (!entry.match.canSubmit) return;
    let reason = '';
    if (entry.match.requiresOverride || entry.match.warnings.length > 0) {
      reason = window.prompt(
        `Recruiter review is required for this ${entry.match.percentage}% match.\n\n${entry.match.warnings.join('\n') || 'The score is below the preferred threshold.'}\n\nEnter the business reason to submit anyway:`,
        ''
      ) ?? '';
      if (entry.match.requiresOverride && !reason.trim()) return;
    }
    setSubmittingKey(key);
    try { await onSubmit(entry, reason.trim()); }
    finally { setSubmittingKey(''); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl border border-[#E4ECF3]">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#071B4A]"><Sparkles className="h-5 w-5 text-[#009E92]" />{title}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">
          Live matches for <span className="font-semibold text-[#071B4A]">{sourceName}</span>. Scores are recommendations; recruiters can review strengths, gaps and submit qualified talent.
        </DialogDescription>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Calculating matches across active records…</div>
        ) : sorted.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="font-semibold text-[#071B4A]">No active matches found</div>
            <div className="mt-1 text-sm text-slate-500">Confirm that active jobs have vacancies and consultants are marked Active or Available.</div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {sorted.map((entry, index) => {
              const item = sourceType === 'job' ? entry.consultant : entry.job;
              const match = entry.match;
              const key = String(item?.id ?? index);
              const name = sourceType === 'job' ? String(item?.candidateName ?? 'Consultant') : String(item?.jobTitle ?? 'Job');
              const subtitle = sourceType === 'job'
                ? `${String(item?.technology ?? item?.primarySkill ?? 'Technology not provided')} · ${String(item?.experienceYears ?? 0)} yrs · ${String(item?.visaStatus ?? 'Visa not provided')}`
                : `${String(item?.endClient ?? item?.company ?? 'Client not provided')} · ${String(item?.location ?? 'Location not provided')} · ${item?.maxRate ? `$${Number(item.maxRate).toFixed(2)}/hr` : 'Rate not provided'}`;
              return (
                <div key={key} className="rounded-xl border border-[#E4ECF3] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {sourceType === 'job' ? <UserRound className="h-5 w-5 text-[#009E92]" /> : <BriefcaseBusiness className="h-5 w-5 text-[#009E92]" />}
                        <div className="text-base font-bold text-[#071B4A]">{name}</div>
                        <Badge>{match.category}</Badge>
                        <div className="rounded-full bg-[#D9F5F1] px-3 py-1 text-sm font-extrabold text-[#008277]">{match.percentage}% Match</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                        {['technical','experience','domain','visa','location','rate','availability','certification'].map((dimension) => {
                          const detail = match.dimensions?.[dimension];
                          return <Score key={dimension} label={dimension} value={detail?.evaluated ? detail.score : null} title={detail?.reason} />;
                        })}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <InfoBox title="Matched Skills" items={match.matched?.skills ?? []} positive />
                        <InfoBox title="Missing / Review" items={match.missing?.skills ?? []} />
                        <InfoBox title="Strengths" items={match.strengths ?? []} positive />
                      </div>

                      {(match.warnings.length > 0 || match.hardBlockers.length > 0) && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          <div className="flex items-center gap-1.5 font-bold"><AlertTriangle className="h-4 w-4" />Recruiter review</div>
                          <div className="mt-1">{[...match.warnings, ...match.hardBlockers].join(' ')}</div>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-600">{match.recommendation}</div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                      {sourceType === 'job' && item?.resumeUrl && (
                        <a className="crm-secondary-button inline-flex h-9 items-center justify-center gap-2 px-3 text-xs" href={String(item.resumeUrl)} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />Resume</a>
                      )}
                      <Button type="button" disabled={!match.canSubmit || submittingKey === key} onClick={() => void submit(entry, key)}>
                        <Send className="h-4 w-4" />{match.requiresOverride ? 'Submit Anyway' : 'Submit Resume'}
                      </Button>
                      {!match.canSubmit && <div className="max-w-44 text-center text-[10px] text-red-600">Resolve hard blockers before submission.</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex justify-end border-t border-[#E4ECF3] pt-4"><Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function Score({ label, value, title }: { label: string; value: number | null | undefined; title?: string }) {
  return <div title={title} className="rounded-lg border border-slate-200 bg-[#F7FAFC] p-2 text-center"><div className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-sm font-extrabold text-[#071B4A]">{value === null || value === undefined ? 'N/E' : `${value}%`}</div></div>;
}
function InfoBox({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return <div className="rounded-lg border border-slate-200 bg-[#F7FAFC] p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{positive && <CheckCircle2 className="h-3.5 w-3.5 text-[#009E92]" />}{title}</div><div className="mt-2 flex flex-wrap gap-1.5">{items.length ? items.slice(0, 12).map((item) => <span key={item} className={`rounded-full px-2 py-1 text-[10px] ${positive ? 'bg-[#D9F5F1] text-[#007C72]' : 'bg-slate-200 text-slate-700'}`}>{item}</span>) : <span className="text-xs text-slate-400">None</span>}</div></div>;
}
