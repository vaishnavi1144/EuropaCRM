import { cn } from '@/lib/utils';

const tones = {
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  orange: 'bg-amber-100 text-amber-700',
  purple: 'bg-violet-100 text-violet-700',
  red: 'bg-rose-100 text-rose-700',
  gray: 'bg-slate-100 text-slate-600',
};

export function resolveBadgeTone(value: string): keyof typeof tones {
  const text = value.toLowerCase();
  if (text.includes('lost') || text.includes('high')) return 'red';
  if (text.includes('progress') || text.includes('pending') || text.includes('paused') || text.includes('qualification') || text.includes('medium')) return 'orange';
  if (text.includes('contact') || text.includes('proposal') || text.includes('complete') || text.includes('influencer') || text.includes('scheduled')) return 'blue';
  if (text.includes('negotiation') || text.includes('referral') || text.includes('meeting')) return 'purple';
  if (text.includes('new') || text.includes('active') || text.includes('qualified') || text.includes('converted') || text.includes('won') || text.includes('customer') || text.includes('decision') || text.includes('call') || text.includes('low')) return 'green';
  return 'gray';
}

export function Badge({ children, tone, className }: { children: React.ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={cn('inline-flex rounded-md px-2 py-1 text-[10px] font-semibold', tones[tone ?? 'gray'], className)}>{children}</span>;
}
