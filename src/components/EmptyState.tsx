import type { ReactNode } from 'react';

const ICONS: Record<string, JSX.Element> = {
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /></>,
  group: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.2" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15.5 16c2.3.2 4 1.6 4 3.5" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>,
};

/** Friendly empty-state block: icon + message + optional action. */
export function EmptyState({ icon = 'receipt', title, hint, action }: { icon?: keyof typeof ICONS; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-ic"><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[icon]}</svg></div>
      <b>{title}</b>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}
