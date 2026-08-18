import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, UploadCloud, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import type { FieldConfig, RecordRow } from '@/types';

type RelationOption = Record<string, unknown>;

export function RecordDialog({ open, onOpenChange, title, fields, initial, onSave, resource, onSaveAndNew, allowSaveAndNew = true }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldConfig[];
  initial?: RecordRow | null;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  resource: string;
  onSaveAndNew?: () => void;
  allowSaveAndNew?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [relationOptions, setRelationOptions] = useState<Record<string, RelationOption[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setError('');
  };

  useEffect(() => {
    if (!open) return;
    const draftKey = `europa_draft_${resource}_${initial ? 'edit_' + initial.id : 'new'}`;
    const savedDraft = sessionStorage.getItem(draftKey);
    let draftValues: Record<string, string> = {};
    if (savedDraft) {
      try {
        draftValues = JSON.parse(savedDraft);
      } catch (e) {
        console.error('Error parsing draft values:', e);
      }
    }

    const next: Record<string, string> = {};
    for (const field of fields) {
      if (draftValues[field.key] !== undefined) {
        next[field.key] = draftValues[field.key];
      } else {
        const raw = initial?.[field.key];
        let value = raw?.toString() ?? '';
        if (field.type === 'date' && value) value = normalizeDate(value);
        // Jobs require a rate type on the API. Default new/legacy blank records to C2C
        // while still letting the user explicitly choose W2 or 1099.
        if (resource === 'jobs' && field.key === 'rateType' && !value) value = 'C2C';
        if (resource === 'submissions' && field.key === 'submissionTarget' && !value) value = 'Vendor Company';
        if (resource === 'submissions' && field.key === 'status' && !value) value = 'Draft';
        next[field.key] = value;
      }
    }
    setValues(next);
    setError('');
  }, [initial, fields, open, resource]);

  useEffect(() => {
    if (!open) return;
    const draftKey = `europa_draft_${resource}_${initial ? 'edit_' + initial.id : 'new'}`;
    if (Object.keys(values).length > 0) {
      sessionStorage.setItem(draftKey, JSON.stringify(values));
    }
  }, [values, open, resource, initial]);

  useEffect(() => {
    if (!open) return;
    const relationFields = fields.filter((field) => field.type === 'relation' && field.relationResource);
    Promise.all(relationFields.map(async (field) => {
      const response = await api.list<RelationOption>(field.relationResource!, { limit: 5000, sortBy: 'createdAt', sortOrder: 'desc' });
      const options = field.relationAllowedStatuses?.length
        ? response.data.filter((item) => field.relationAllowedStatuses!.includes(String(item[field.relationStatusKey ?? 'status'] ?? '')))
        : response.data;
      return [field.key, options] as const;
    })).then((entries) => setRelationOptions(Object.fromEntries(entries))).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load linked CRM records.'));
  }, [fields, open]);

  const sections = useMemo(() => {
    const grouped = new Map<string, FieldConfig[]>();
    for (const field of fields) {
      if (field.visibleWhen && values[field.visibleWhen.key] !== field.visibleWhen.equals) continue;
      const section = field.section || 'Record Details';
      grouped.set(section, [...(grouped.get(section) ?? []), field]);
    }
    return [...grouped.entries()];
  }, [fields, values]);

  const [submitType, setSubmitType] = useState<'save' | 'saveAndNew'>('save');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const missing = fields.filter((field) => field.required && (!field.visibleWhen || values[field.visibleWhen.key] === field.visibleWhen.equals) && !String(values[field.key] ?? '').trim());
      if (missing.length) throw new Error(`Complete the following required fields: ${missing.map((field) => field.label).join(', ')}.`);
      // Custom validation for bench-interviews (field-level errors)
      if (resource === 'bench-interviews') {
        const errors: Record<string,string> = {};
        const v = (key: string) => String(values[key] ?? '').trim();
        const requiredKeys = ['interviewRound','interviewDate','interviewTime','timeZone','interviewMode'];
        for (const key of requiredKeys) if (!v(key)) errors[key] = 'Required';
        if (!v('vendorEmail') && !v('interviewerEmail') && !v('interviewerPhone')) {
          errors['vendorEmail'] = 'Provide vendor email or interviewer contact';
        }
        const mode = v('interviewMode').toLowerCase();
        const requiresLink = /teams|zoom|google|video/.test(mode);
        if (requiresLink && !v('meetingLink')) errors['meetingLink'] = 'Meeting link required for online interviews';
        if (v('result') === 'On Hold') {
          if (!v('holdReason')) errors['holdReason'] = 'Hold reason is required when interview is On Hold';
          if (!v('followUpDate')) errors['followUpDate'] = 'Next follow-up date is required when interview is On Hold';
        }
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          setError('Complete the highlighted fields');
          throw new Error('Validation failed');
        }
      }
      if (resource === 'submissions' && String(values.status) === 'On Hold') {
        const errors: Record<string,string> = {};
        const v = (key: string) => String(values[key] ?? '').trim();
        if (!v('holdReason')) errors['holdReason'] = 'Hold reason is required when submission is On Hold';
        if (!v('nextFollowUpDate')) errors['nextFollowUpDate'] = 'Next follow-up date is required when submission is On Hold';
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          setError('Complete the highlighted fields');
          throw new Error('Validation failed');
        }
      }
      const payload: Record<string, unknown> = {};
      for (const key of ['resumeOriginalName','resumeExtractedText','resumeParsedJson','resumeParseSucceeded']) {
        if (values[key] !== undefined && values[key] !== '') payload[key] = key === 'resumeParsedJson' ? JSON.parse(values[key]) : values[key];
      }
      for (const field of fields) {
        const raw = values[field.key] ?? '';
        // New records must not receive accidental empty-string or numeric-zero defaults.
        // Editing still allows an optional field to be cleared explicitly.
        if (!initial && raw === '') continue;
        if (field.type === 'number') payload[field.key] = raw === '' ? null : Number(raw);
        else if (field.type === 'checkbox') payload[field.key] = String(raw) === 'true';
        else payload[field.key] = raw;
      }
      await onSave(payload);
      
      const draftKey = `europa_draft_${resource}_${initial ? 'edit_' + initial.id : 'new'}`;
      sessionStorage.removeItem(draftKey);
      
      if (submitType === 'saveAndNew') {
        const next: Record<string, string> = {};
        for (const field of fields) next[field.key] = '';
        setValues(next);
        sessionStorage.setItem(`europa_dialog_open_${resource}`, 'new');
        if (onSaveAndNew) {
          onSaveAndNew();
        }
      } else {
        sessionStorage.removeItem(`europa_dialog_open_${resource}`);
        onOpenChange(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this record.');
    } finally {
      setSaving(false);
    }
  };

  const optionsForField = (field: FieldConfig) => {
    const options = relationOptions[field.key] ?? [];
    if (!field.relationFilterSourceKey || !field.relationFilterTargetKey) return options;
    const sourceValue = values[field.relationFilterSourceKey] ?? '';
    if (!sourceValue) return [];
    return options.filter((option) => String(option[field.relationFilterTargetKey!] ?? '') === sourceValue);
  };

  const setRelation = (field: FieldConfig, selectedValue: string) => {
    const options = optionsForField(field);
    const valueKey = field.relationValueKey ?? 'id';
    const selected = options.find((option) => String(option[valueKey] ?? '') === selectedValue);
    setValues((previous) => {
      const next = { ...previous, [field.key]: selectedValue };
      for (const dependent of fields) {
        if (dependent.relationFilterSourceKey === field.key && dependent.key !== field.key) next[dependent.key] = '';
      }
      if (selected && field.autofill) {
        for (const [targetKey, sourceKey] of Object.entries(field.autofill)) next[targetKey] = String(selected[sourceKey] ?? '');
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl border border-[#E4ECF3]">
        <DialogTitle className="text-xl font-bold text-[#071B4A]">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">Enter the record details. Required fields are marked with an asterisk. Calendar dates use MM/DD/YYYY.</DialogDescription>
        <form onSubmit={submit} autoComplete="off" className="mt-5 space-y-6">
          {sections.map(([section, sectionFields]) => (
            <div key={section} className="grid grid-cols-1 gap-4 border-t border-[#E4ECF3] pt-4 first:border-0 first:pt-0 sm:grid-cols-2">
              <h3 className="sm:col-span-2 mb-1 text-sm font-bold text-[#071B4A]">{section}</h3>
              {sectionFields.map((field) => (
                <label key={field.key} className={field.type === 'textarea' || field.type === 'file' ? 'sm:col-span-2' : 'sm:col-span-1'}>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">{field.label}{field.required ? ' *' : ''}</span>
                  {field.type === 'select' ? (
                    <select required={field.required} disabled={field.readOnly} className="crm-input disabled:cursor-not-allowed disabled:bg-[#F7FAFC] disabled:text-slate-400 disabled:pointer-events-none select-none" value={values[field.key] ?? ''} onChange={(event) => setValues((prev) => { const next = { ...prev, [field.key]: event.target.value }; if (field.key === 'highestQualification' && event.target.value !== 'Other') next.otherQualification = ''; return next; })}>
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.type === 'relation' ? (
                    <select required={field.required} disabled={field.readOnly} className="crm-input disabled:cursor-not-allowed disabled:bg-[#F7FAFC] disabled:text-slate-400 disabled:pointer-events-none select-none" value={values[field.key] ?? ''} onChange={(event) => setRelation(field, event.target.value)}>
                      <option value="">Select {field.label}</option>
                      {optionsForField(field).map((option) => {
                        const value = String(option[field.relationValueKey ?? 'id'] ?? '');
                        const label = String(option[field.relationLabelKey ?? 'name'] ?? value);
                        const subtitle = field.relationSubtitleKey ? String(option[field.relationSubtitleKey] ?? '') : '';
                        return <option key={value} value={value}>{label}{subtitle ? ` — ${subtitle}` : ''}</option>;
                      })}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea required={field.required} disabled={field.readOnly} className="crm-input disabled:cursor-not-allowed disabled:bg-[#F7FAFC] disabled:text-slate-400 min-h-24 resize-y py-2 disabled:pointer-events-none select-none" placeholder={field.placeholder} value={values[field.key] ?? ''} onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))} />
                  ) : field.type === 'date' ? (
                    <CalendarDateInput required={field.required} readOnly={field.readOnly} value={values[field.key] ?? ''} onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))} />
                  ) : field.type === 'file' ? (
                    <FileInput
                      required={field.required}
                      disabled={field.readOnly}
                      value={values[field.key] ?? ''}
                      onChange={(value) => updateValue(field.key, value)}
                      label={field.label}
                      parseResume={['bench','candidates'].includes(resource) && field.key === 'resumeUrl'}
                      onParsed={async (result) => {
                        const extracted = resumeValues(result);
                        setValues((previous) => {
                          const next = { ...previous };
                          for (const [key, extractedValue] of Object.entries(extracted)) {
                            if (!extractedValue) continue;
                            const existingValue = String(previous[key] ?? '').trim();
                            if (!existingValue) next[key] = extractedValue;
                          }
                          return next;
                        });

                        // If editing an existing bench record, run immediate recommended-jobs workflow
                        try {
                          if (resource === 'bench' && initial && initial.id) {
                            const result = await api.workflow<{ matches: Array<any> }>(`bench/${initial.id}/recommended-jobs`, { limit: 5 });
                            const matches = result.matches ?? [];
                            if (matches.length) {
                              const top = matches.slice(0, 3).map((m: any) => `${String(m.job?.jobTitle ?? m.job?.jobReference ?? 'Job')} (${m.match.percentage}%)`).join(', ');
                              toast.success(`Top matches: ${top}`);
                            } else {
                              toast('No matching jobs found for this consultant');
                            }
                          }
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Unable to calculate matches');
                        }
                      }}
                    />
                  ) : field.type === 'checkbox' ? (
                    <div className="flex items-center">
                      <input type="checkbox" disabled={field.readOnly} checked={String(values[field.key] ?? '') === 'true'} onChange={(e) => updateValue(field.key, e.target.checked ? 'true' : 'false')} className="mr-2" />
                      <span className="text-sm text-slate-700">{field.label}</span>
                    </div>
                  ) : field.key === 'checklistProgress' ? (
                    (() => {
                      const checklistKeys = ['consultantInformed','jobDescriptionShared','clientDetailsShared','meetingLinkTested','resumeVersionConfirmed','rateReconfirmed','preparationCompleted'];
                      const total = checklistKeys.length;
                      const done = checklistKeys.reduce((acc, k) => acc + ((String(values[k] ?? '') === 'true') ? 1 : 0), 0);
                      return <div className="text-sm font-semibold text-slate-700">{`${done} / ${total}`}</div>;
                    })()
                  ) : (
                    <input
                      required={field.required}
                      disabled={field.readOnly}
                      tabIndex={field.readOnly ? -1 : undefined}
                      autoComplete="off"
                      type={field.type ?? 'text'}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      className="crm-input disabled:cursor-not-allowed disabled:bg-[#F7FAFC] disabled:text-slate-400 disabled:pointer-events-none select-none"
                      placeholder={field.placeholder}
                      value={values[field.key] ?? ''}
                      onChange={(event) => updateValue(field.key, event.target.value)}
                      onWheel={(e) => field.type === 'number' && e.currentTarget.blur()}
                    />
                  )}
                  {fieldErrors[field.key] && <div className="mt-1 text-xs text-red-700">{fieldErrors[field.key]}</div>}
                </label>
              ))}
            </div>
          ))}

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 border-t border-[#E4ECF3] pt-4">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            {allowSaveAndNew && <Button type="submit" variant="secondary" disabled={saving} onClick={() => setSubmitType('saveAndNew')}>{saving && submitType === 'saveAndNew' ? 'Saving...' : 'Save & New'}</Button>}
            <Button type="submit" disabled={saving} onClick={() => setSubmitType('save')}>{saving && submitType === 'save' ? 'Saving...' : 'Save Record'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


type ResumeParseResult = {
  publicUrl: string;
  originalFilename: string;
  extractedText: string;
  parsed: Record<string, unknown> | null;
  parseSucceeded: boolean;
  warning?: string;
};

function qualificationValue(raw: string) {
  const value = raw.toLowerCase().replace(/\./g, '').trim();
  if (/phd|doctor/.test(value)) return 'PhD';
  if (/mtech/.test(value)) return 'M.Tech';
  if (/\bme\b/.test(value)) return 'M.E.';
  if (/mba/.test(value)) return 'MBA';
  if (/mca/.test(value)) return 'MCA';
  if (/msc|master of science/.test(value)) return 'M.Sc';
  if (/btech/.test(value)) return 'B.Tech';
  if (/\bbe\b|bachelor of engineering/.test(value)) return 'B.E.';
  if (/bba/.test(value)) return 'BBA';
  if (/bca/.test(value)) return 'BCA';
  if (/bsc|bachelor of science/.test(value)) return 'B.Sc';
  if (/bcom/.test(value)) return 'B.Com';
  if (/mcom/.test(value)) return 'M.Com';
  if (/diploma/.test(value)) return 'Diploma';
  return raw ? 'Other' : '';
}

function resumeValues(result: ResumeParseResult): Record<string, string> {
  const parsed = result.parsed ?? {};
  const education = Array.isArray(parsed.education) && parsed.education.length ? parsed.education[0] as Record<string, unknown> : {};
  const qualificationRaw = String(education.qualification ?? '');
  const qualification = qualificationValue(qualificationRaw);
  const availability = String(parsed.availability ?? '');
  const availableDate = /^\d{4}-\d{2}-\d{2}$/.test(availability) ? availability : '';
  return {
    candidateName: String(parsed.name ?? ''),
    email: String(parsed.email ?? ''),
    phone: String(parsed.phone ?? ''),
    primarySkill: String(parsed.primarySkill ?? parsed.technology ?? ''),
    skills: String(parsed.skills ?? ''),
    experienceYears: parsed.experienceYears === null || parsed.experienceYears === undefined ? '' : String(parsed.experienceYears),
    currentJobTitle: String(parsed.role ?? ''),
    currentLocation: String(parsed.location ?? ''),
    visaStatus: String(parsed.visa ?? ''),
    availableFrom: availableDate,
    highestQualification: qualification,
    otherQualification: qualification === 'Other' ? qualificationRaw : '',
    instituteName: String(education.institute ?? ''),
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications.join(', ') : '',
    projects: Array.isArray(parsed.projects) ? parsed.projects.join(' | ') : '',
    resumeOriginalName: result.originalFilename,
    resumeExtractedText: result.extractedText,
    resumeParsedJson: result.parsed ? JSON.stringify(result.parsed) : '',
    resumeParseSucceeded: String(result.parseSucceeded),
  };
}

function CalendarDateInput({ value, onChange, required, readOnly }: { value: string; onChange: (value: string) => void; required?: boolean; readOnly?: boolean }) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const isoValue = normalizeDate(value);
  return (
    <div className="relative">
      <input
        required={required}
        readOnly={readOnly}
        className="crm-input pr-12 read-only:bg-slate-100 read-only:text-slate-500 read-only:pointer-events-none select-none"
        inputMode="numeric"
        placeholder="MM/DD/YYYY"
        value={isoToUs(isoValue)}
        onChange={(event) => onChange(usToIso(event.target.value))}
      />
      {!readOnly && <button type="button" aria-label="Open calendar" className="absolute right-1 top-1 flex h-[calc(100%-8px)] w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100" onClick={() => pickerRef.current?.showPicker?.()}>
        <CalendarDays className="h-5 w-5" />
      </button>}
      <input ref={pickerRef} type="date" tabIndex={-1} className="pointer-events-none absolute h-0 w-0 opacity-0" value={isoValue} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function normalizeDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return usToIso(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function isoToUs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
}

function usToIso(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const formatted = digits.length <= 2 ? digits : digits.length <= 4 ? `${digits.slice(0,2)}/${digits.slice(2)}` : `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(formatted);
  if (!match) return formatted;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function FileInput({ value, onChange, required, disabled, label, parseResume = false, onParsed }: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  label: string;
  parseResume?: boolean;
  onParsed?: (result: ResumeParseResult) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError('');
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const resultString = reader.result as string;
          const base64Data = resultString.substring(resultString.indexOf(',') + 1);
          if (parseResume) {
            const res = await api.parseResume(file.name, base64Data);
            onChange(res.publicUrl);
            onParsed?.(res);
            if (!res.parseSucceeded && res.warning) setError(`${res.warning} The resume was still uploaded; complete the form manually.`);
          } else {
            const res = await api.uploadLocal(file.name, base64Data);
            onChange(res.publicUrl);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setError('Error reading file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  const clearFile = () => {
    onChange('');
    setError('');
  };

  const getFileName = (url: string) => {
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1];
      return last.replace(/^\d+-/, '');
    } catch {
      return 'resume.pdf';
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">{getFileName(value)}</p>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-teal-600 hover:text-teal-700 hover:underline"
          >
            View uploaded file ↗
          </a>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={clearFile}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors"
            title="Remove file"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center transition-all hover:bg-slate-50 hover:border-teal-500 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
        <input
          type="file"
          className="sr-only"
          accept={parseResume ? ".pdf,.doc,.docx" : ".pdf,.doc,.docx,.txt"}
          onChange={handleFileChange}
          disabled={disabled || uploading}
          required={required && !value}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span className="text-xs font-medium text-slate-500">{parseResume ? 'Uploading and parsing resume...' : 'Uploading file...'}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <UploadCloud className="mb-2 h-7 w-7 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">Click to upload resume</span>
            <span className="mt-1 text-[10px] text-slate-400">{parseResume ? 'PDF, DOC or DOCX (Max 12 MB) — form fills automatically' : 'PDF, Word, or Text (Max 12 MB)'}</span>
          </div>
        )}
      </label>
      {error && <p className="text-[10px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}
