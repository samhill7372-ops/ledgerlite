import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '@/store/useApp';
import { allCategories, type Budget, type Category } from '@/types';
import { SYMBOL, fmt, homeCurrency } from '@/lib/money';
import { CurrencyOptions } from '@/components/CurrencyOptions';
import type { Currency } from '@/types';
import { daysInMonth, lastNMonthKeys, monthLabel } from '@/lib/dates';
import { computePace, monthExpenses, byCategory, monthlyTotals, buildAlerts } from '@/lib/budget';

export function InsightsScreen({ onPickMonth }: { onPickMonth: (key: string) => void }) {
  const { expenses, budget, setBudget, showToast } = useApp();
  const now = new Date();
  const pace = useMemo(() => computePace(expenses, budget, now), [expenses, budget]);
  const month = useMemo(() => monthExpenses(expenses, now), [expenses]);
  const cats = useMemo(() => byCategory(month), [month]);
  const alerts = useMemo(() => buildAlerts(expenses, budget, now), [expenses, budget]);
  const totals = useMemo(() => monthlyTotals(expenses), [expenses]);
  const keys = lastNMonthKeys(6, now);
  const maxMonth = Math.max(1, ...keys.map((k) => totals[k]?.total ?? 0));
  const dim = daysInMonth(now);
  const perDay = useMemo(() => { const a = new Array(dim).fill(0); month.forEach((e) => { a[Number(e.date.slice(8, 10)) - 1] += e.amount; }); return a; }, [month, dim]);
  const dmax = Math.max(1, ...perDay);

  return (
    <section className="view">
      <header><div><div className="eyebrow">Insights</div><h1>Budget & trends</h1></div></header>

      <BudgetPanel budget={budget} pace={pace} alerts={alerts} onSave={async (b) => { await setBudget(b); showToast('Budget saved'); }} />

      <RecurringPanel />

      <div className="panel">
        <div className="panel-head"><h2>By category</h2><span className="eyebrow">this month</span></div>
        <div className="cats">
          {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
            const lim = budget.cats[c as Category]; const r = lim ? v / lim : 0; const max = Math.max(...Object.values(cats));
            return (
              <div className="r" key={c}>
                <span>{c}</span>
                <div className="pct"><i className={r >= 1 ? 'over' : r >= 0.8 ? 'warn' : ''} style={{ width: (lim ? Math.min(100, r * 100) : (v / max) * 100) + '%' }} /></div>
                <span className="amt num">{fmt(v)}</span>
                {lim ? <span className="sub">{r >= 1 ? `Over by ${fmt(v - lim)}` : `${fmt(lim - v)} left`} of {fmt(lim)} budget</span> : null}
              </div>
            );
          })}
          {!Object.keys(cats).length && <p className="note">No spending this month yet.</p>}
        </div>
        <div className="days" aria-label="Spending per day, this month">
          {perDay.map((v, i) => <i key={i} className={i + 1 === now.getDate() ? 'today' : ''} style={{ height: (v / dmax) * 100 + '%' }} title={`${i + 1}: ${fmt(v)}`} />)}
        </div>
        <div className="days-lbl"><span>1</span><span>{dim}</span></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Month by month</h2><span className="eyebrow">last 6 months</span></div>
        <div className="months">
          {keys.map((k, i) => {
            const v = totals[k]?.total ?? 0; const n = totals[k]?.count ?? 0; const prev = totals[keys[i + 1]]?.total ?? 0;
            const pc = i < 5 && prev > 0 && v > 0 ? Math.round(((v - prev) / prev) * 100) : null;
            return (
              <button type="button" key={k} className={'month' + (i === 0 ? ' cur' : '')} onClick={() => onPickMonth(k)}>
                <div className="m">{monthLabel(k)}<small>{n} item{n === 1 ? '' : 's'}</small></div>
                <div className="pct"><i style={{ width: (v / maxMonth) * 100 + '%' }} /></div>
                <div className="amt"><b className="num">{fmt(v)}</b>
                  {pc !== null ? <small className={pc > 0 ? 'up' : pc < 0 ? 'down' : ''}>{pc > 0 ? '▲ ' : pc < 0 ? '▼ ' : ''}{Math.abs(pc)}% vs prev</small> : i < 5 && v > 0 ? <small>no prior data</small> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RecurringPanel() {
  const { recurring, updateRecurring, showToast } = useApp();
  if (!recurring.length) return null;
  const toggle = (id: string) => updateRecurring(recurring.map((r) => (r.id === id ? { ...r, paused: !r.paused, updatedAt: new Date().toISOString() } : r)));
  const del = async (id: string) => { await updateRecurring(recurring.filter((r) => r.id !== id)); showToast('Recurring expense removed'); };
  return (
    <div className="panel">
      <div className="panel-head"><h2>Recurring</h2><span className="eyebrow">every month</span></div>
      <ul className="ledger">
        {recurring.map((r) => (
          <li key={r.id}>
            <div className="cat" data-c={r.category}>{r.category}</div>
            <div className="t"><b>{r.note}</b><small>day {r.dayOfMonth}{r.paused ? ' · paused' : ''}</small></div>
            <div className="a">
              <b className="num">{fmt(r.amount, r.currency)}</b>
              <div className="tools">
                <button onClick={() => toggle(r.id)}>{r.paused ? 'Resume' : 'Pause'}</button>
                <button className="del" onClick={() => del(r.id)}>Delete</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="note" style={{ marginTop: 8 }}>Logged automatically when you open the app each month. Deleting a rule keeps past expenses.</p>
    </div>
  );
}

function BudgetPanel({ budget, pace, alerts, onSave }: { budget: Budget; pace: ReturnType<typeof computePace>; alerts: ReturnType<typeof buildAlerts>; onSave: (b: Budget) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(''); const [cats, setCats] = useState<Record<string, string>>({});
  const [cur, setCur] = useState<Currency>(budget.currency ?? homeCurrency());
  const names = allCategories(budget);
  function edit() { setTotal(budget.total ? String(budget.total) : ''); setCur(budget.currency ?? homeCurrency()); setCats(Object.fromEntries(names.map((c) => [c, budget.cats[c] ? String(budget.cats[c]) : '']))); setOpen(true); }
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const c: Budget['cats'] = {}; for (const k of names) { const v = parseFloat(cats[k]); if (v > 0) c[k] = v; }
    await onSave({ total: parseFloat(total) || 0, cats: c, customCats: budget.customCats, currency: cur }); setOpen(false);
  }
  return (
    <div className="panel">
      <div className="panel-head"><h2>Monthly budget</h2><button className="btn sm" onClick={open ? () => setOpen(false) : edit}>{open ? 'Close' : pace.total > 0 ? 'Edit budget' : 'Set budget'}</button></div>
      <p className="note">{pace.total > 0 ? `${Math.round(pace.ratio * 100)}% used · ${fmt(pace.spent)} of ${fmt(pace.total)} · ${pace.daysLeft} days left` : "Set a monthly limit and the app will track how you're pacing against it."}</p>
      <div>{alerts.map((a, i) => <div key={i} className={'alert ' + a.level}>{a.message}</div>)}</div>
      {open && (
        <form className="bform" onSubmit={submit}>
          <label>Total monthly budget ({SYMBOL[cur]})<input type="number" min="0" step="1" inputMode="numeric" placeholder="e.g. 20000" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
          <label>Currency
            <select value={cur} onChange={(e) => setCur(e.target.value as Currency)}>
              <CurrencyOptions />
            </select>
          </label>
          <div className="eyebrow">Per category (optional)</div>
          <div className="grid">
            {names.map((c) => <label key={c}>{c}<input type="number" min="0" inputMode="numeric" placeholder="—" value={cats[c] ?? ''} onChange={(e) => setCats((s) => ({ ...s, [c]: e.target.value }))} /></label>)}
          </div>
          <div className="actions"><button type="submit" className="btn primary">Save budget</button><button type="button" className="btn" style={{ flex: '0 0 auto' }} onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
