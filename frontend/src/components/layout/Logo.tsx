export function Logo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-md">
        <img src="/europa-mark.png" alt="Europa CRM" className="h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <div className="flex h-18 w-full items-center overflow-hidden rounded-xl bg-white px-3 py-2 shadow-md">
      <img src="/europa-logo.png" alt="Europa CRM" className="h-full w-full object-contain object-left" />
    </div>
  );
}
