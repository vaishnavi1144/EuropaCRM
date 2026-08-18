import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { FieldConfig, RecordRow } from '@/types';
import SubmissionTimeline from '@/components/crm/SubmissionTimeline';

export function RecordViewDialog({ open, onOpenChange, title, fields, record, actions = [], resource }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldConfig[];
  record?: RecordRow | null;
  actions?: { label: string; onClick: () => void | Promise<void>; disabled?: boolean }[];
  resource?: string;
}) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl border border-[#E4ECF3]">
        <DialogTitle className="text-xl font-bold text-[#071B4A]">{title} Details</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">
          Viewing details of the record. Read-only view.
        </DialogDescription>
        <div className="mt-5 space-y-4 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((field) => {
              const value = record[field.key];
              const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);
              const isUrl = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://') || value.includes('/uploads/'));

              return (
                <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : 'sm:col-span-1'}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</div>
                  <div className="mt-1 text-sm text-[#071B4A] bg-[#F7FAFC] border border-[#E4ECF3] rounded-lg p-2.5 min-h-[38px] whitespace-pre-wrap break-words">
                    {isUrl ? (
                      <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#009E92] hover:text-[#008277] hover:underline font-semibold inline-flex items-center gap-1">
                        View document ↗
                      </a>
                    ) : (
                      displayValue
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {resource === 'submissions' && (
            <SubmissionTimeline submission={record} />
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#E4ECF3] pt-4 mt-6">
            {actions.map((action) => <Button key={action.label} type="button" disabled={action.disabled} onClick={() => void action.onClick()}>{action.label}</Button>)}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close Details</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
