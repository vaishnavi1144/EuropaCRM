import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight, Download, MoreVertical, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function PageHeader({ breadcrumb, title, subtitle, onRefresh, onExport, extraActions }: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  onRefresh: () => void;
  onExport: () => void;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {/* Breadcrumb section */}
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        <span className="text-[#009E92]">{breadcrumb}</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#009E92]" strokeWidth={2.5} />
        <span className="text-slate-500">{title}</span>
      </div>

      {/* Main title and action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[23px] font-black text-[#071B4A] leading-tight">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          {extraActions}
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <Button type="button" aria-label="More page actions" title="More actions" variant="secondary" size="icon" className="h-10 w-10 border border-[#E4ECF3] bg-white text-[#071B4A] hover:bg-slate-50">
                <MoreVertical className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={7} align="end" collisionPadding={12} className="z-50 w-44 rounded-xl border border-[#E4ECF3] bg-white p-1.5 text-[13px] font-semibold text-[#071B4A] shadow-xl">
                <DropdownMenu.Item onSelect={onRefresh} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 outline-none hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4 text-slate-400" />
                  <span>Refresh records</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={onExport} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 outline-none hover:bg-slate-50">
                  <Download className="h-4 w-4 text-slate-400" />
                  <span>Export CSV</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => window.print()} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 outline-none hover:bg-slate-50">
                  <Printer className="h-4 w-4 text-slate-400" />
                  <span>Print page</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
}
