import * as Icons from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { KpiConfig } from '@/types';

export function KpiCard({ item }: { item: KpiConfig }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[item.icon] ?? Icons.Circle;
  return (
    <div className="crm-card flex h-[108px] items-center gap-4 px-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#D9F5F1] text-[#009E92]">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-slate-700">{item.label}</div>
        <div className="mt-1 text-[24px] font-bold leading-none text-slate-950">{item.value}</div>
        <div className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${item.negative ? 'text-red-500' : 'text-emerald-600'}`}>
          {item.negative ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          {item.trend}
        </div>
      </div>
    </div>
  );
}
