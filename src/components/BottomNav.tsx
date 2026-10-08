import { useApp, type View } from '@/store/useApp';
const ITEMS: { v: View; label: string; icon: JSX.Element }[] = [
  { v: 'home', label: 'Home', icon: <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg> },
  { v: 'expenses', label: 'Expenses', icon: <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg> },
  { v: 'add', label: 'Add', icon: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg> },
  { v: 'insights', label: 'Insights', icon: <svg viewBox="0 0 24 24"><path d="M4 19h16M6 16V9M11 16V5M16 16v-6" /><circle cx="20" cy="6" r="1.5" /></svg> },
];
export function BottomNav() {
  const { view, setView, startEdit } = useApp();
  return (
    <div className="bottombar"><nav aria-label="Main">
      {ITEMS.map((it) => (
        <button key={it.v} className={it.v === 'add' ? 'add' : ''} aria-current={view === it.v ? 'page' : undefined}
          onClick={() => { if (it.v === 'add') startEdit(null); setView(it.v); window.scrollTo({ top: 0 }); }}>
          {it.icon}{it.label}
        </button>
      ))}
    </nav></div>
  );
}
