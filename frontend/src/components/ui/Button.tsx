import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-[#009E92] text-white shadow-sm hover:brightness-105',
        variant === 'secondary' && 'border border-[#E4ECF3] bg-white text-[#009E92] hover:border-[#009E92]/30 hover:bg-[#D9F5F1]/30',
        variant === 'ghost' && 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'icon' && 'h-9 w-9 p-0',
        className,
      )}
      {...props}
    />
  );
});
