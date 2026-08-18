import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { MatchEntry } from '@/components/crm/MatchResultsDialog';

interface FindJobsModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultantId: string;
  consultantName: string;
  consultantRate: number;
  entries: MatchEntry[];
  isLoading: boolean;
}

export function FindJobsModal({
  isOpen,
  onClose,
  consultantId,
  consultantName,
  consultantRate,
  entries,
  isLoading,
}: FindJobsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState('Vendor Company');

  const toggleJob = (jobId: string) => {
    const next = new Set(selectedIds);
    if (next.has(jobId)) next.delete(jobId);
    else next.add(jobId);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(entries.map((entry) => String(entry.job?.id ?? ''))));
  };

  const handleCreateSubmissions = async () => {
    const selectedJobs = entries.filter((entry) => entry.job && selectedIds.has(String(entry.job.id)));
    if (!selectedJobs.length) {
      toast.error('Select one or more jobs to submit this consultant.');
      return;
    }

    setIsSubmitting(true);
    const created: string[] = [];
    const duplicates: string[] = [];
    const failed: string[] = [];

    for (const entry of selectedJobs) {
      const job = entry.job!;
      const jobTitle = String(job.jobTitle ?? `Job ${job.id}`);
      try {
        await api.workflow<{ message?: string }>(`jobs/${job.id}/submit/${consultantId}`, {
          ratePerHour: Number(consultantRate ?? job.maxRate ?? 0),
          submissionTarget,
          overrideReason: 'Recruiter verified and approved match override.',
        });
        created.push(jobTitle);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Submission failed.';
        if (message.toLowerCase().includes('active submission already exists') || message.toLowerCase().includes('duplicate')) {
          duplicates.push(jobTitle);
        } else {
          failed.push(`${jobTitle}: ${message}`);
        }
      }
    }

    setIsSubmitting(false);
    if (created.length) {
      toast.success(`Created ${created.length} submission(s) for ${consultantName}.`);
      setSelectedIds(new Set());
    }
    if (duplicates.length) {
      toast.warning(`Skipped ${duplicates.length} duplicate submission(s): ${duplicates.join(', ')}.`);
    }
    if (failed.length) {
      toast.error(`Failed to submit ${failed.length} job(s). Check browser console for details.`);
      console.error('Submission failures:', failed);
    }
  };

  const getSkills = (job: Record<string, unknown>) => String(job.skillsRequired ?? job.requiredSkills ?? job.skills ?? '—');
  const getRate = (job: Record<string, unknown>) => (job.maxRate != null ? `$${Number(job.maxRate).toFixed(2)}` : '—');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogTitle className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Find Jobs for Consultant</h2>
            <p className="text-sm text-slate-600">Consultant: {consultantName}</p>
          </div>
        </DialogTitle>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700"></div>
              <p className="text-slate-600">Finding matching jobs...</p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-600">No open jobs were found for this consultant.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedIds.size === entries.length && entries.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Select All ({selectedIds.size}/{entries.length})
              </label>
              <div className="text-sm text-slate-500">Showing matching open jobs with active vacancies.</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-900">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Select</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Job Title</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Client</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Vendor</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Location</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Required Skills</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Match %</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const job = entry.job;
                    if (!job) return null;
                    const id = String(job.id);
                    return (
                      <tr key={id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(id)}
                            onChange={() => toggleJob(id)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{String(job.jobTitle ?? '—')}</td>
                        <td className="px-3 py-3">{String(job.endClient ?? job.company ?? '—')}</td>
                        <td className="px-3 py-3">{String(job.vendorCompany ?? '—')}</td>
                        <td className="px-3 py-3">{String(job.location ?? '—')}</td>
                        <td className="px-3 py-3 max-w-[260px] break-words">{getSkills(job)}</td>
                        <td className="px-3 py-3"><Badge className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{entry.match.percentage}%</Badge></td>
                        <td className="px-3 py-3">{getRate(job)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-slate-600">{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select jobs and submit this consultant.'}</p>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-700">Submission Target:</span>
                    <select
                      className="crm-input h-8 py-0 px-2 text-xs w-44"
                      value={submissionTarget}
                      onChange={(e) => setSubmissionTarget(e.target.value)}
                    >
                      <option value="Vendor Company">Vendor Company</option>
                      <option value="Hiring / End Client">Hiring / End Client</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={onClose}>Close</Button>
                <Button onClick={handleCreateSubmissions} disabled={selectedIds.size === 0 || isSubmitting} className="gap-2">
                  <Check className="h-4 w-4" />
                  {isSubmitting ? 'Submitting...' : 'Create Submissions'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
