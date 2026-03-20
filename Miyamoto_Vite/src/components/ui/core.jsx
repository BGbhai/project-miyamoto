import React from 'react';
import { cx, toTitleCase } from '../../utils/helpers';
export { cx };

// ----------------------------------------------------
// Icons
// ----------------------------------------------------

export function Activity({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );
}

export function TrendingUp({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  );
}

export function Calendar({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}

export function Dumbbell({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.4 14.4l3.6-3.6"></path>
      <path d="M22 14v4h-4l-8.5-8.5"></path>
      <path d="M8.5 8.5L4 12V8h4l8.5 8.5"></path>
      <path d="M12 2v4h4l3.6 3.6"></path>
      <path d="M14 22v-4h-4l-3.6-3.6"></path>
      <path d="M2.5 2.5l19 19"></path>
    </svg>
  );
}

export function Home({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );
}

export function List({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );
}

export function Check({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

export function Info({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );
}

export function Settings({ size = 24, className }) {
  return (
     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
       <circle cx="12" cy="12" r="3"></circle>
       <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
     </svg>
  );
}

export function MessageSquare({ size = 24, className }) {
   return (
     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
       <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
     </svg>
   );
}


// ----------------------------------------------------
// Core Primitives
// ----------------------------------------------------

export function InlineBadge({ children, tone = 'soft', className = '' }) {
  const tones = {
    soft: 'bg-neutral-800 text-neutral-400',
    accent: 'bg-red-500/10 text-red-500',
    warn: 'bg-yellow-500/10 text-yellow-500',
    good: 'bg-green-500/10 text-green-500',
  };
  return (
    <span className={cx('whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]', tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatPill({ label, value, tone = 'soft' }) {
  return (
    <div className={cx('card-sharp p-3 space-y-1', tone === 'accent' && 'accent-border bg-neutral-900 border-red-500/20')}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</div>
      <div className={cx('text-lg font-semibold', tone === 'accent' ? 'text-red-500' : 'text-neutral-100')}>{value}</div>
    </div>
  );
}

export function CoachInput({ type = 'text', value, onChange, placeholder, className, ...props }) {
  return (
    <input
      type={type}
      className={cx('form-input', className)}
      value={value === undefined || value === null ? '' : value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  );
}

export function CoachTextarea({ value, onChange, placeholder, className, rows = 3, ...props }) {
  return (
    <textarea
      className={cx('form-textarea', className)}
      rows={rows}
      value={value === undefined || value === null ? '' : value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  );
}

export function CoachSelect({ value, onChange, children, className, ...props }) {
  return (
    <div className="relative">
      <select
        className={cx('form-select', className)}
        value={value === undefined || value === null ? '' : value}
        onChange={onChange}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function SurfaceCard({ children, padding = 'p-6', className, tone = 'base' }) {
  const tones = {
    base: '',
    accent: 'border-red-500/10 bg-gradient-to-br from-neutral-950 to-neutral-900',
    dimmed: 'border-neutral-800/50 bg-neutral-950/50',
    warn: 'border-yellow-500/10 bg-gradient-to-br from-neutral-950 to-neutral-900',
    soft: 'border-neutral-800/80 bg-neutral-900/50'
  };
  return (
    <div className={cx('card-layered', padding, tones[tone], className)}>
      {children}
    </div>
  );
}

export function CoachField({ label, children, className }) {
  return (
    <label className={cx('block space-y-1.5', className)}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</div>
      {children}
    </label>
  );
}

export function EmptyState({ title, body, actionLabel, onAction, icon: Icon = Info }) {
  return (
    <div className="border border-dashed border-neutral-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
      <div className="h-12 w-12 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-500">
        <Icon size={24} />
      </div>
      <div className="space-y-1 max-w-[240px]">
        <div className="text-sm font-semibold text-neutral-100">{title}</div>
        <div className="text-sm text-neutral-400">{body}</div>
      </div>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-ghost px-4 py-2 text-xs font-semibold uppercase">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function SegmentedTabs({ tabs, value, onChange }) {
  return (
    <div className="flex bg-neutral-900 rounded-xl p-1 gap-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cx(
            'flex-1 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-lg transition-colors',
            value === tab.id ? 'bg-neutral-800 text-neutral-100 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ViewHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-2">
      <div className="space-y-1">
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-400 max-w-[280px] leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
