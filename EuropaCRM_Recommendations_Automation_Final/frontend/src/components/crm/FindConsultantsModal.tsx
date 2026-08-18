import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export interface MatchedConsultant {
  consultant: Record<string, unknown>;
  match: {
    percentage: number;
    category: string;
    recommendation: string;
    strengths: string[];
    warnings: string[];
    hardBlockers: string[];
    canSubmit: boolean;
    requiresOverride: boolean;
    matched: { skills: string[] };
    missing: { skills: string[] };
  };
}

interface FindConsultantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  consultants: MatchedConsultant[];
  isLoading: boolean;
  onBulkSend: (consultants: MatchedConsultant[]) => Promise<void>;
}

export function FindConsultantsModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  consultants,
  isLoading,
  onBulkSend,
}: FindConsultantsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSubmissions = async () => {
    if (!jobId) {
      toast.error('Unable to create submissions without a Job reference.');
      return;
    }
    const selected = consultants.filter((c) => selectedIds.has(String(c.consultant.id)));
    if (!selected.length) {
      toast.error('Please select at least one consultant to create submissions.');
      return;
    }

    setIsCreating(true);
    const submissionTarget = window.prompt('Submission target: enter Vendor Company or Hiring / End Client', 'Vendor Company');
    if (!submissionTarget || !['Vendor Company', 'Hiring / End Client'].includes(submissionTarget)) {
      toast.error('Choose Vendor Company or Hiring / End Client before creating the submission.');
      setIsCreating(false);
      return;
    }
    const created: string[] = [];
    const duplicates: string[] = [];
    const failed: string[] = [];

    for (const entry of selected) {
      const consultantId = String(entry.consultant.id);
      const consultantName = String(entry.consultant.candidateName ?? consultantId);
      try {
        await api.workflow<{ message?: string }>(`jobs/${jobId}/submit/${consultantId}`, {
          ratePerHour: Number(entry.consultant.ratePerHour ?? entry.consultant.expectedRate ?? 0),
          submissionTarget,
        });
        created.push(consultantName);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Submission failed.';
        if (message.toLowerCase().includes('active submission already exists') || message.toLowerCase().includes('duplicate')) {
          duplicates.push(consultantName);
        } else {
          failed.push(`${consultantName}: ${message}`);
        }
      }
    }

    setIsCreating(false);
    if (created.length) {
      toast.success(`Created ${created.length} submission(s).`);
      setSelectedIds(new Set());
    }
    if (duplicates.length) {
      toast.warning(`Skipped ${duplicates.length} duplicate submission(s): ${duplicates.join(', ')}.`);
    }
    if (failed.length) {
      toast.error(`Failed to create ${failed.length} submission(s). Check console for details.`);
      console.error('Submission creation failures:', failed);
    }
  };

  const handleBulkSend = async () => {
    const selected = consultants.filter((entry) => selectedIds.has(String(entry.consultant.id)));
    if (!selected.length) {
      toast.error('Please select at least one consultant.');
      return;
    }
    setIsCreating(true);
    try {
      await onBulkSend(selected);
      setSelectedIds(new Set());
    } finally {
      setIsCreating(false);
    }
  };

  const toggleConsultant = (consultantId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(consultantId)) {
      newSelected.delete(consultantId);
    } else {
      newSelected.add(consultantId);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === consultants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(consultants.map((c) => String(c.consultant.id))));
    }
  };

  const handleExport = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one consultant.');
      return;
    }

    const selected = consultants.filter((c) => selectedIds.has(String(c.consultant.id)));
    const csv = [
      'Consultant Name,Technology,Experience (Years),Visa Status,Availability,Rate ($/hr),Match %,Matched Skills,Missing Skills,Concerns',
      ...selected.map((entry) => {
        const c = entry.consultant;
        const m = entry.match;
        return [
          String(c.candidateName ?? ''),
          String(c.primarySkill ?? c.technology ?? ''),
          String(c.experienceYears ?? 0),
          String(c.visaStatus ?? ''),
          String(c.availableFrom ?? c.marketingStatus ?? ''),
          String(c.ratePerHour ?? c.expectedRate ?? 0),
          `${m.percentage}%`,
          m.matched.skills.join(';'),
          m.missing.skills.join(';'),
          [...m.warnings, ...m.hardBlockers].join('; '),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultants-${jobTitle.replace(/\s+/g, '-')}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success(`Exported ${selectedIds.size} consultant(s).`);
  };

  const getMatchColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-100 text-green-800';
    if (percentage >= 60) return 'bg-blue-100 text-blue-800';
    if (percentage >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Find Matching Consultants</h2>
            <p className="text-sm text-slate-600">Job: {jobTitle}</p>
          </div>
        </DialogTitle>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700"></div>
              <p className="text-slate-600">Finding matching consultants...</p>
            </div>
          </div>
        ) : consultants.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-600">No active consultants found matching the job requirements.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Header with select all */}
              <div className="flex items-center justify-between border-b pb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === consultants.length && consultants.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300"
                  />
                  <span className="text-sm font-medium">
                    Select All ({selectedIds.size} of {consultants.length})
                  </span>
                </label>
              </div>

              {/* Consultants list */}
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {consultants.map((entry, index) => {
                  const c = entry.consultant;
                  const m = entry.match;
                  const id = String(c.id);
                  const isSelected = selectedIds.has(id);

                  return (
                    <div
                      key={id}
                      className={`rounded-lg border-2 p-4 transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleConsultant(id)}
                          className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300"
                        />

                        {/* Main info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900">{String(c.candidateName ?? 'Consultant')}</h3>
                              <div className="mt-2 grid gap-2 text-sm text-slate-700">
                                <div>
                                  <span className="font-medium">Technology:</span> {String(c.primarySkill ?? c.technology ?? '—')}
                                </div>
                                <div>
                                  <span className="font-medium">Experience:</span> {String(c.experienceYears ?? 0)} years
                                </div>
                                <div>
                                  <span className="font-medium">Visa:</span> {String(c.visaStatus ?? '—')}
                                </div>
                                <div>
                                  <span className="font-medium">Available:</span>{' '}
                                  {String(c.availableFrom ?? c.marketingStatus ?? '—')}
                                </div>
                                <div>
                                  <span className="font-medium">Rate:</span> ${String(c.ratePerHour ?? c.expectedRate ?? '0')}/hr
                                </div>
                              </div>
                            </div>

                            {/* Match percentage */}
                            <div className="flex flex-col items-center gap-2">
                              <Badge className={`text-center text-lg font-bold px-3 py-1 ${getMatchColor(m.percentage)}`}>
                                {m.percentage}%
                              </Badge>
                              <span className="text-xs text-slate-600">{m.category}</span>
                            </div>
                          </div>

                          {/* Match details */}
                          <div className="mt-3 space-y-2 text-sm">
                            {m.matched.skills.length > 0 && (
                              <div>
                                <span className="font-medium text-green-700">✓ Matched:</span>{' '}
                                <span className="text-green-700">{m.matched.skills.join(', ')}</span>
                              </div>
                            )}
                            {m.missing.skills.length > 0 && (
                              <div>
                                <span className="font-medium text-slate-600">✗ Missing:</span>{' '}
                                <span className="text-slate-600">{m.missing.skills.join(', ')}</span>
                              </div>
                            )}
                            {m.strengths.length > 0 && (
                              <div>
                                <span className="font-medium text-slate-700">Strengths:</span>{' '}
                                <span className="text-slate-700">{m.strengths.join('; ')}</span>
                              </div>
                            )}
                            {[...m.warnings, ...m.hardBlockers].length > 0 && (
                              <div>
                                <span className="font-medium text-amber-700">⚠ Review:</span>{' '}
                                <span className="text-amber-700">
                                  {[...m.warnings, ...m.hardBlockers].join('; ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer with actions */}
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {selectedIds.size > 0 && `${selectedIds.size} consultant(s) selected`}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Export Selected ({selectedIds.size})
                </Button>
                <Button
                  onClick={handleBulkSend}
                  disabled={selectedIds.size === 0 || isCreating}
                  className="gap-2"
                >
                  {isCreating ? 'Preparing...' : `Bulk Send Resumes (${selectedIds.size})`}
                </Button>
                <Button
                  onClick={handleCreateSubmissions}
                  disabled={selectedIds.size === 0 || isCreating}
                  className="gap-2"
                >
                  {isCreating ? 'Creating...' : 'Create Submission'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
