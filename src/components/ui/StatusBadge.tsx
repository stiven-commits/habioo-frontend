import type { FC, ReactNode } from 'react';

export type BadgeColor =
  | 'green' | 'yellow' | 'amber' | 'red' | 'rose'
  | 'blue' | 'sky' | 'indigo' | 'violet' | 'orange'
  | 'emerald' | 'purple' | 'slate' | 'gray';

type BadgeSize  = 'sm' | 'md' | 'lg';
type BadgeShape = 'pill' | 'badge' | 'tag';

interface StatusBadgeProps {
  color: BadgeColor;
  children: ReactNode;
  size?:    BadgeSize;
  shape?:   BadgeShape;
  border?:  boolean;
  className?: string;
}

const COLOR_MAP: Record<BadgeColor, { base: string; border: string }> = {
  green:   { base: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',         border: 'border border-green-200 dark:border-green-800/50' },
  yellow:  { base: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',     border: 'border border-yellow-200 dark:border-yellow-800/50' },
  amber:   { base: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',         border: 'border border-amber-200 dark:border-amber-800/50' },
  red:     { base: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                 border: 'border border-red-200 dark:border-red-800/50' },
  rose:    { base: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',             border: 'border border-rose-200 dark:border-rose-800/50' },
  blue:    { base: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',             border: 'border border-blue-200 dark:border-blue-800/50' },
  sky:     { base: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',                 border: 'border border-sky-200 dark:border-sky-800/50' },
  indigo:  { base: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',      border: 'border border-indigo-200 dark:border-indigo-800' },
  violet:  { base: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',     border: 'border border-violet-200 dark:border-violet-800/50' },
  orange:  { base: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',     border: 'border border-orange-200 dark:border-orange-800/50' },
  emerald: { base: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', border: 'border border-emerald-200 dark:border-emerald-800/50' },
  purple:  { base: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',     border: 'border border-purple-200 dark:border-purple-800/50' },
  slate:   { base: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',            border: 'border border-slate-200 dark:border-slate-700' },
  gray:    { base: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',                border: 'border border-gray-200 dark:border-gray-700' },
};

const SIZE_MAP: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-[11px] px-2.5 py-1',
  lg: 'text-xs px-3 py-1',
};

const SHAPE_MAP: Record<BadgeShape, string> = {
  pill:  'rounded-full',
  badge: 'rounded-lg',
  tag:   'rounded-md',
};

const StatusBadge: FC<StatusBadgeProps> = ({
  color,
  children,
  size    = 'sm',
  shape   = 'pill',
  border  = false,
  className = '',
}) => {
  const { base, border: borderClass } = COLOR_MAP[color];
  const cls = [
    'inline-flex items-center font-bold uppercase tracking-wider',
    SIZE_MAP[size],
    SHAPE_MAP[shape],
    base,
    border ? borderClass : '',
    className,
  ].filter(Boolean).join(' ');

  return <span className={cls}>{children}</span>;
};

export default StatusBadge;
