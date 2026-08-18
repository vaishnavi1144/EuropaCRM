import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export function CustomFieldDialog({ open, onOpenChange, resourceName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string;
}) {
  const { addCustomField } = useApp();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'text' | 'number' | 'date' | 'select' | 'textarea'>('text');
  const [optionsStr, setOptionsStr] = useState('');
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!label.trim()) {
      toast.error('Label is required');
      return;
    }
    setSaving(true);
    try {
      const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const options = type === 'select' ? optionsStr.split(',').map((o) => o.trim()).filter(Boolean) : undefined;
      addCustomField(resourceName, {
        key,
        label,
        type,
        options,
        required,
      });
      toast.success(`Custom field "${label}" added to this module`);
      setLabel('');
      setType('text');
      setOptionsStr('');
      setRequired(false);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-xl font-bold text-slate-950">Add Custom Field</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">
          Create a dynamic field for this module. It will be appended to the form and the data table.
        </DialogDescription>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Field Label *</span>
            <input
              required
              type="text"
              className="crm-input"
              placeholder="e.g. Visa Expiry Date"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Field Type</span>
            <select
              className="crm-input"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="text">Text (Single Line)</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Dropdown (Select)</option>
              <option value="textarea">Textarea (Multi-line)</option>
            </select>
          </label>
          {type === 'select' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Dropdown Options (Comma separated) *</span>
              <input
                required
                type="text"
                className="crm-input"
                placeholder="e.g. H1B, GC, US Citizen"
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
              />
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <span className="text-xs font-semibold text-slate-700">Is this field required?</span>
          </label>
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Field'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
