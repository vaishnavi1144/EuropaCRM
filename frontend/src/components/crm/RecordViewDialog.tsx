import { useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  GraduationCap,
  Laptop,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Badge, resolveBadgeTone } from '@/components/ui/Badge';
import type { FieldConfig, RecordRow } from '@/types';
import SubmissionTimeline from '@/components/crm/SubmissionTimeline';

function formatDisplayDate(val: string): string {
  if (!val) return '—';
  const isoMatch = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[parseInt(isoMatch[2], 10) - 1] ?? isoMatch[2];
    const day = parseInt(isoMatch[3], 10);
    const year = isoMatch[1];
    return `${month} ${day}, ${year}`;
  }
  const slashMatch = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[parseInt(slashMatch[1], 10) - 1] ?? slashMatch[1];
    const day = parseInt(slashMatch[2], 10);
    const year = slashMatch[3];
    return `${month} ${day}, ${year}`;
  }
  return String(val);
}

function getFieldIcon(field: FieldConfig) {
  const k = field.key.toLowerCase();
  if (k.includes('email')) return <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('phone') || k.includes('contact')) return <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('location')) return <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('mode') || k.includes('preference')) return <Laptop className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('visa') || k.includes('compliance')) return <ShieldCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('rate') || k.includes('currency') || k.includes('amount') || k.includes('salary')) return <DollarSign className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('experience')) return <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('date') || k.includes('expiry') || k.includes('availablefrom')) return <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('skill') || k.includes('technology')) return <Sparkles className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('qualification') || k.includes('cgpa') || k.includes('education')) return <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('owner') || k.includes('candidate') || k.includes('user') || k.includes('recruiter') || k.includes('interviewer')) return <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('company') || k.includes('client') || k.includes('vendor') || k.includes('employer')) return <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k.includes('title') || k.includes('job')) return <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  if (k === 'status' || k === 'result') return <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  return <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
}

export function RecordViewDialog({
  open,
  onOpenChange,
  title,
  fields,
  record,
  actions = [],
  resource,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldConfig[];
  record?: RecordRow | null;
  actions?: { label: string; onClick: () => void | Promise<void>; disabled?: boolean }[];
  resource?: string;
  onEdit?: (record: RecordRow) => void;
}) {
  const sections = useMemo(() => {
    if (!record) return [];
    const grouped = new Map<string, FieldConfig[]>();
    for (const field of fields) {
      if (field.visibleWhen && record[field.visibleWhen.key] !== field.visibleWhen.equals) continue;
      const section = field.section || 'Record Details';
      grouped.set(section, [...(grouped.get(section) ?? []), field]);
    }
    return [...grouped.entries()];
  }, [fields, record]);

  if (!record) return null;

  const titleValue = String(
    record.jobTitle ??
    record.candidateName ??
    record.title ??
    record.name ??
    record.company ??
    `${title} Details`
  );
  const statusValue = String(record.status ?? record.stage ?? record.marketingStatus ?? '');
  const refId = String(
    record.jobReference ??
    record.consultantCode ??
    record.candidateCode ??
    record.requirementReference ??
    (record.id ? `ID: ${String(record.id).slice(0, 16)}` : '')
  );

  const handleDownload = () => {
    if (!record) return;

    const sectionsHtml = sections.map(([sectionName, sectionFields]) => {
      const fieldsHtml = sectionFields.map((field) => {
        const raw =
          record[field.key] ??
          (record.customData && typeof record.customData === 'object'
            ? (record.customData as Record<string, unknown>)[field.key]
            : undefined);

        const isNullOrEmpty = raw === null || raw === undefined || raw === '';
        let displayVal = isNullOrEmpty ? '—' : String(raw);

        if (!isNullOrEmpty) {
          if (field.type === 'date') displayVal = formatDisplayDate(String(raw));
          else if (['maxRate', 'ratePerHour', 'expectedRate', 'billRate', 'payRate'].includes(field.key) && typeof raw === 'number') {
            displayVal = `$${Number(raw).toLocaleString()} / hr`;
          } else if (['minExperience', 'experienceYears', 'usExperienceYears'].includes(field.key) && !isNaN(Number(raw))) {
            displayVal = `${Number(raw)} Year${Number(raw) === 1 ? '' : 's'}`;
          }
        }

        const isLongText =
          field.type === 'textarea' ||
          ['jobDescription', 'skillsRequired', 'preferredSkills', 'feedback', 'technicalFeedback'].includes(field.key);

        if (isLongText) {
          return `
            <div class="field-item full-width">
              <div class="field-label">${field.label}</div>
              <div class="textarea-box">${displayVal}</div>
            </div>
          `;
        }

        return `
          <div class="field-item">
            <div class="field-label">${field.label}</div>
            <div class="field-value">${displayVal}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="section">
          <div class="section-title">${sectionName}</div>
          <div class="grid">
            ${fieldsHtml}
          </div>
        </div>
      `;
    }).join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} Details - ${titleValue}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 32px 16px;
      color: #071B4A;
      background: #F8FAFC;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #E4ECF3;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .top-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .print-btn {
      background: #009E92;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #007C72;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #E4ECF3;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #009E92;
      margin-bottom: 6px;
    }
    .main-title {
      font-size: 24px;
      font-weight: 800;
      color: #071B4A;
      margin: 0 0 6px 0;
    }
    .ref-id {
      font-size: 12px;
      color: #64748B;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      background: #E6F8F4;
      color: #007C72;
      border: 1px solid #009E92;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #009E92;
      border-bottom: 1px solid #E4ECF3;
      padding-bottom: 6px;
      margin-bottom: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .field-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .full-width {
      grid-column: span 2;
    }
    .field-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
    }
    .field-value {
      font-size: 13px;
      font-weight: 600;
      color: #071B4A;
      word-break: break-word;
    }
    .textarea-box {
      background: #F8FAFC;
      border: 1px solid #E4ECF3;
      border-radius: 6px;
      padding: 12px;
      font-size: 12px;
      line-height: 1.5;
      color: #071B4A;
      white-space: pre-wrap;
    }
    .footer {
      border-top: 1px solid #E4ECF3;
      padding-top: 16px;
      margin-top: 32px;
      font-size: 11px;
      color: #94A3B8;
      text-align: center;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .top-actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-actions">
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <div class="header">
      <div>
        <div class="brand-title">EuropaCRM • ${title} Record</div>
        <h1 class="main-title">${titleValue}</h1>
        ${refId ? `<div class="ref-id">Ref ID: ${refId}</div>` : ''}
      </div>
      ${statusValue ? `<div class="badge">${statusValue}</div>` : ''}
    </div>
    ${sectionsHtml}
    <div class="footer">
      Generated from EuropaCRM on ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (titleValue || title).replace(/[^a-z0-9]/gi, '_');
    link.href = url;
    link.download = `${safeName}_Details.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${title} form downloaded successfully`);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-[#E4ECF3] bg-white shadow-2xl outline-none duration-300 animate-in slide-in-from-right sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        >
          {/* Top Header */}
          <div className="flex h-16 items-center justify-between border-b border-[#E4ECF3] px-6">
            <DialogPrimitive.Title className="text-base font-bold text-[#071B4A]">
              {title} Details
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Hero Banner with Title, Status & Actions */}
          <div className="flex items-start justify-between gap-4 border-b border-[#E4ECF3] bg-[#F8FAFC] px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold text-[#071B4A] leading-tight break-words">{titleValue}</h2>
                {statusValue && (
                  <Badge tone={resolveBadgeTone(statusValue)} className="text-[11px] font-bold px-2.5 py-0.5">
                    {statusValue}
                  </Badge>
                )}
              </div>
              {refId && (
                <div className="mt-1 text-xs font-medium text-slate-500">
                  Ref ID: <span className="font-semibold text-slate-700">{refId}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDownload}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#009E92] bg-[#E6F8F4] px-3 text-xs font-semibold text-[#007C72] hover:bg-[#D5F3ED] hover:text-[#005B54] transition shadow-xs"
                title="Download form details"
              >
                <Download className="h-3.5 w-3.5 text-[#007C72]" />
                <span>Download</span>
              </Button>
              {onEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onEdit(record)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#009E92] bg-white px-3 text-xs font-semibold text-[#009E92] hover:bg-[#E6F8F4] transition shadow-xs"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>
              )}
            </div>
          </div>

          {/* Scrollable Body organized by Form Sections */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {sections.map(([sectionName, sectionFields]) => (
              <div key={sectionName} className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E4ECF3] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#009E92]">{sectionName}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                  {sectionFields.map((field) => {
                    const raw =
                      record[field.key] ??
                      (record.customData && typeof record.customData === 'object'
                        ? (record.customData as Record<string, unknown>)[field.key]
                        : undefined);

                    const isNullOrEmpty = raw === null || raw === undefined || raw === '';
                    const isLongText =
                      field.type === 'textarea' ||
                      ['jobDescription', 'skillsRequired', 'preferredSkills', 'feedback', 'technicalFeedback', 'communicationFeedback', 'instructions'].includes(field.key);

                    const isUrl =
                      typeof raw === 'string' &&
                      (raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('/uploads/'));

                    const isEmail = field.type === 'email' || field.key.toLowerCase().includes('email');
                    const isPhone = field.key.toLowerCase().includes('phone') || field.key.toLowerCase().includes('contact');

                    let formattedValue: React.ReactNode;
                    if (isNullOrEmpty) {
                      formattedValue = <span className="text-slate-400 font-normal italic">—</span>;
                    } else if (isUrl) {
                      formattedValue = (
                        <a
                          href={String(raw)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#009E92] hover:underline hover:text-[#008277]"
                        >
                          <span>View document</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      );
                    } else if (isEmail) {
                      formattedValue = (
                        <a href={`mailto:${String(raw)}`} className="text-xs font-semibold text-[#009E92] hover:underline break-all">
                          {String(raw)}
                        </a>
                      );
                    } else if (isPhone) {
                      formattedValue = (
                        <a href={`tel:${String(raw)}`} className="text-xs font-semibold text-[#009E92] hover:underline">
                          {String(raw)}
                        </a>
                      );
                    } else if (field.type === 'date') {
                      formattedValue = <span className="text-xs font-semibold text-[#071B4A]">{formatDisplayDate(String(raw))}</span>;
                    } else if (field.key === 'status') {
                      formattedValue = (
                        <Badge tone={resolveBadgeTone(String(raw))} className="text-[10px] font-bold">
                          {String(raw)}
                        </Badge>
                      );
                    } else if (['maxRate', 'ratePerHour', 'expectedRate', 'billRate', 'payRate'].includes(field.key) && typeof raw === 'number') {
                      formattedValue = (
                        <span className="text-xs font-semibold text-[#071B4A]">
                          ${Number(raw).toLocaleString()} / hr
                        </span>
                      );
                    } else if (['minExperience', 'experienceYears', 'usExperienceYears'].includes(field.key) && !isNaN(Number(raw))) {
                      formattedValue = (
                        <span className="text-xs font-semibold text-[#071B4A]">
                          {Number(raw)} Year{Number(raw) === 1 ? '' : 's'}
                        </span>
                      );
                    } else {
                      formattedValue = <span className="text-xs font-semibold text-[#071B4A] break-words">{String(raw)}</span>;
                    }

                    if (isLongText) {
                      return (
                        <div key={field.key} className="sm:col-span-2 space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            {getFieldIcon(field)}
                            <span>{field.label}</span>
                          </div>
                          <div className="rounded-lg border border-[#E4ECF3] bg-[#F8FAFC] p-3 text-xs text-[#071B4A] leading-relaxed whitespace-pre-wrap">
                            {isNullOrEmpty ? <span className="text-slate-400 italic">No details provided</span> : String(raw)}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={field.key} className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          {getFieldIcon(field)}
                          <span>{field.label}</span>
                        </div>
                        <div className="pl-5">{formattedValue}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {resource === 'submissions' && (
              <div className="pt-2">
                <SubmissionTimeline submission={record} />
              </div>
            )}
          </div>

          {/* Bottom Footer Actions if any */}
          {actions.length > 0 && (
            <div className="flex flex-wrap items-center justify-start gap-2 border-t border-[#E4ECF3] bg-slate-50/60 px-6 py-3">
              {actions.map((action) => (
                <Button key={action.label} type="button" disabled={action.disabled} onClick={() => void action.onClick()} className="h-8 text-xs font-semibold">
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
