import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { FieldConfig } from '@/types';

export function ImportDialog({ open, onOpenChange, title, fields, onImport }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldConfig[];
  onImport: (rows: Record<string, unknown>[]) => Promise<{ inserted: number; errors: { row: number; message: string }[] }>;
}) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<{ inserted: number; errors: { row: number; message: string }[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFileName(''); setRows([]); setParseError(''); setResult(null); setSaving(false);
  }, [open]);

  const requiredKeys = useMemo(() => fields.filter((field) => field.required).map((field) => field.key), [fields]);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name); setParseError(''); setResult(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setRows([]); setParseError('Please select a CSV file. Excel files should be exported as CSV before importing.'); return;
    }
    const text = await file.text();
    try {
      const parsed = parseCsv(text, fields);
      const missing = requiredKeys.filter((key) => !parsed.headers.includes(key));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);
      setRows(parsed.rows);
    } catch (reason) {
      setRows([]); setParseError(reason instanceof Error ? reason.message : 'Unable to parse CSV file.');
    }
  };

  const submit = async () => {
    if (!rows.length) return;
    setSaving(true); setParseError('');
    try { setResult(await onImport(rows)); }
    catch (reason) { setParseError(reason instanceof Error ? reason.message : 'Import failed.'); }
    finally { setSaving(false); }
  };

  const downloadTemplate = () => {
    const header = fields.map((field) => field.key).join(',');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`${header}\n`], { type: 'text/csv' }));
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-template.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-xl font-bold text-slate-950">Import {title}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">Upload a CSV whose headers match the database fields. Download the template for the correct structure.</DialogDescription>
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
            <FileUp className="mx-auto h-8 w-8 text-[#009E92]" />
            <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg bg-[#009E92] px-4 py-2 text-xs font-semibold text-white hover:brightness-105">
              Select CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
            </label>
            <div className="mt-2 text-xs text-slate-500">{fileName || 'No file selected'}</div>
            <button onClick={downloadTemplate} className="mt-2 text-xs font-semibold text-[#009E92] hover:underline">Download CSV template</button>
          </div>
          {rows.length > 0 && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{rows.length} row{rows.length === 1 ? '' : 's'} ready to import.</div>}
          {parseError && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{parseError}</div>}
          {result && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div className="font-semibold">Imported: {result.inserted}</div>
              <div>Failed: {result.errors.length}</div>
              {result.errors.length > 0 && <div className="mt-2 max-h-24 overflow-y-auto text-red-600">{result.errors.slice(0,10).map((error) => <div key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</div>)}</div>}
            </div>
          )}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
            <Button disabled={!rows.length || saving || Boolean(result)} onClick={submit}>{saving ? 'Importing...' : 'Import Records'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function parseCsv(text: string, fields: FieldConfig[]) {
  const lines = splitCsvLines(text).filter((line) => line.some((cell) => cell.trim() !== ''));
  if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
  const keyLookup = new Map<string, string>();
  fields.forEach((field) => {
    keyLookup.set(normalize(field.key), field.key);
    keyLookup.set(normalize(field.label), field.key);
  });
  const headers = lines[0].map((header) => keyLookup.get(normalize(header)) ?? header.trim());
  const rows = lines.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => {
    const field = fields.find((item) => item.key === header);
    const value = cells[index]?.trim() ?? '';
    return [header, field?.type === 'number' ? Number(value || 0) : value];
  })));
  return { headers, rows };
}

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }

function splitCsvLines(text: string) {
  const rows: string[][] = [];
  let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
