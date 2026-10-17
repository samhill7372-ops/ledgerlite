import { useMemo, useState } from 'react';
import { useApp } from '@/store/useApp';
import { allCategories } from '@/types';
import { fmt } from '@/lib/money';
import { inRange, monthLabel, type RangeKey } from '@/lib/dates';
import { monthlyTotals } from '@/lib/budget';
import { ExpenseRow } from '@/components/ExpenseRow';

export function ExpensesScreen({ initialRange }: { initialRange?: RangeKey }) {
  const { expenses, budget, resetData, showToast } = useApp();
  const [range, setRange] = useState<RangeKey>(initialRange ?? 'month');
  const [cat, setCat] = useState<string>('');
  const [q, setQ] = useState('');
  const [armed, setArmed] = useState(false);
  const months = useMemo(() => Object.keys(monthlyTotals(expenses)).sort().reverse(), [expenses]);
  const list = useMemo(() => expenses
    .filter((e) => inRange(e.date, range) && (!cat || e.category === cat) && (!q || (e.note || '').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [expenses, range, cat, q]);
  const total = list.reduce((a, e) => a + e.amount, 0);

  function exportCsv() {
    const rows = [['date', 'amount', 'currency', 'category', 'note', 'source'], ...expenses.map((e) => [e.date, e.amount, e.currency, e.category, '"' + (e.note || '').replace(/"/g, '""') + '"', e.source])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    navigator.clipboard?.writeText(csv).then(() => showToast('CSV copied to clipboard')).catch(() => showToast('Copy failed'));
  }
  function reset() {
    if (armed) { resetData(); setArmed(false); showToast('Data reset'); }
    else { setArmed(true); setTimeout(() => setArmed(false), 3000); }
  }

  return (
    <section className="view">
      <header>
        <div><div className="eyebrow">Ledger</div><h1>Expenses</h1></div>
        <div className="actions" style={{ flex: '0 0 auto' }}>
          <button className="btn sm" onClick={exportCsv}>Copy CSV</button>
          <button className="btn sm" onClick={reset}>{armed ? 'Tap again to confirm' : 'Reset'}</button>
        </div>
      </header>
      <div className="panel">
        <input className="search" type="search" placeholder="Search vendor or note" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search expenses" />
        <div className="filters">
          <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} aria-label="Date range">
            <option value="month">This month</option><option value="30">Last 30 days</option><option value="7">Last 7 days</option><option value="all">All time</option>
            {months.map((m) => <option key={m} value={'m:' + m}>{monthLabel(m)}</option>)}
          </select>
          <button className="chip" aria-pressed={cat === ''} onClick={() => setCat('')}>All</button>
          {allCategories(budget).map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <p className="note" style={{ marginBottom: 10 }}>{list.length ? `${list.length} expense${list.length === 1 ? '' : 's'} · ${fmt(total)} total` : ''}</p>
        <ul className="ledger">
          {list.length ? list.map((e) => <ExpenseRow key={e.id} e={e} />) : <li className="empty" style={{ display: 'block' }}>No expenses in this view. Add one with the + button.</li>}
        </ul>
      </div>
      <footer>Your data is encrypted on this device before it is stored anywhere.</footer>
    </section>
  );
}
