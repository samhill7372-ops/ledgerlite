import { useMemo, useRef, useState } from 'react';
import { useApp } from '@/store/useApp';
import { allCategories, type Expense } from '@/types';
import { fmt, homeCurrency } from '@/lib/money';
import { inRange, monthLabel, todayISO, type RangeKey } from '@/lib/dates';
import { monthlyTotals } from '@/lib/budget';
import { toCsv, importCsv, type ImportResult } from '@/lib/csv';
import { ExpenseRow } from '@/components/ExpenseRow';

export function ExpensesScreen({ initialRange }: { initialRange?: RangeKey }) {
  const { expenses, budget, importExpenses, resetData, showToast } = useApp();
  const source = expenses;
  const [range, setRange] = useState<RangeKey>(initialRange ?? 'month');
  const [cat, setCat] = useState<string>('');
  const [q, setQ] = useState('');
  const [armed, setArmed] = useState(false);
  const months = useMemo(() => Object.keys(monthlyTotals(source)).sort().reverse(), [source]);
  const list = useMemo(() => source
    .filter((e) => inRange(e.date, range) && (!cat || e.category === cat) && (!q || (e.note || '').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [source, range, cat, q]);
  const total = list.reduce((a, e) => a + e.amount, 0);

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  function exportCsv() {
    const blob = new Blob([toCsv(source)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `ledgerlite-${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSV downloaded');
  }

  async function pickFile(f: File | undefined) {
    if (!f) return;
    const res = importCsv(await f.text(), allCategories(budget), homeCurrency());
    if (res.error) showToast(res.error);
    else if (!res.rows.length) showToast('No usable rows found in that file');
    else setPreview(res);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function confirmImport() {
    if (!preview || importing) return;
    setImporting(true);
    try {
      const seen = new Set(expenses.map((e) => `${e.date}|${e.amount}|${e.note}`));
      const now = new Date().toISOString();
      const fresh: Expense[] = preview.rows
        .filter((r) => !seen.has(`${r.date}|${r.amount}|${r.note}`))
        .map((r) => ({ id: crypto.randomUUID(), ...r, source: 'manual' as const, createdAt: now, updatedAt: now }));
      await importExpenses(fresh);
      const dup = preview.rows.length - fresh.length;
      showToast(`Imported ${fresh.length} expense${fresh.length === 1 ? '' : 's'}${dup ? ` (${dup} duplicate${dup === 1 ? '' : 's'} skipped)` : ''}`);
      setPreview(null);
    } finally { setImporting(false); }
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
          <button className="btn sm" onClick={exportCsv}>Export CSV</button>
          <button className="btn sm" onClick={() => fileRef.current?.click()}>Import</button>
          <button className="btn sm" onClick={reset}>{armed ? 'Tap again to confirm' : 'Reset'}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      </header>
      {preview && (
        <div className="panel" role="region" aria-label="Import preview">
          <div className="panel-head"><h2>Import preview</h2></div>
          <p className="note">
            Found <b>{preview.rows.length}</b> expense{preview.rows.length === 1 ? '' : 's'} totalling <b className="num">{fmt(preview.rows.reduce((a, r) => a + r.amount, 0))}</b>
            {' '}from {preview.rows.reduce((a, r) => (r.date < a ? r.date : a), preview.rows[0].date)} to {preview.rows.reduce((a, r) => (r.date > a ? r.date : a), preview.rows[0].date)}.
            {preview.skipped ? ` ${preview.skipped} unreadable row${preview.skipped === 1 ? '' : 's'} skipped.` : ''} Duplicates of existing expenses will be skipped.
          </p>
          <div className="actions">
            <button className="btn primary" disabled={importing} onClick={confirmImport}>{importing ? 'Importing…' : 'Import all'}</button>
            <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
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
