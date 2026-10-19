import { useMemo } from 'react';
import { useApp } from '@/store/useApp';
import { fmt } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import { computePace, monthExpenses, byCategory, buildAlerts } from '@/lib/budget';
import { ExpenseRow } from '@/components/ExpenseRow';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { HeaderMenu } from '@/components/HeaderMenu';
import { Sparkbars } from '@/components/Sparkbars';
import { EmptyState } from '@/components/EmptyState';

const PILL: Record<string, [string, string]> = { none: ['No budget set', ''], 'on-track': ['On track', 'good'], 'over-pace': ['Over pace', 'warn'], 'over-budget': ['Over budget', 'bad'] };

export function HomeScreen() {
  const { session, expenses, budget, setView } = useApp();
  const now = new Date();
  const pace = useMemo(() => computePace(expenses, budget, now), [expenses, budget]);
  const month = useMemo(() => monthExpenses(expenses, now), [expenses]);
  const cats = useMemo(() => byCategory(month), [month]);
  const alerts = useMemo(() => buildAlerts(expenses, budget, now), [expenses, budget]);
  const topAlert = alerts.find((a) => a.level === 'bad') ?? alerts[0];
  const t = todayISO(now);
  const today = expenses.filter((e) => e.date === t);
  const todaySum = today.reduce((a, e) => a + e.amount, 0);
  const daysWith = new Set(month.map((e) => e.date)).size;
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const last7 = useMemo(() => {
    const out: number[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const k = todayISO(d); out.push(expenses.filter((e) => e.date === k).reduce((a, e) => a + e.amount, 0)); }
    return out;
  }, [expenses]);
  const [pillText, pillCls] = PILL[pace.status];
  const fillCls = pace.ratio >= 1 ? 'over' : pace.ratio >= 0.8 ? 'warn' : '';

  return (
    <section className="view">
      <header>
        <div className="userchip">
          <div className="avatar">{(session?.name || '?').trim().charAt(0).toUpperCase()}</div>
          <div>
            <div className="eyebrow">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</div>
            <h1>Hi, {(session?.name || '').split(' ')[0]}</h1>
          </div>
        </div>
        <HeaderMenu />
      </header>

      <CurrencyPicker />

      <div className="hero-wrap">
        <div className="stat hero">
          <div className="budget-head"><div className="eyebrow">Spent this month</div><span className={'pill ' + pillCls}>{pillText}</span></div>
          <div className="v num">{fmt(pace.spent)}</div>
          <div className="s">{month.length} expense{month.length === 1 ? '' : 's'} · last 7 days</div>
          <Sparkbars values={last7} label="Spending over the last 7 days" />
          {pace.total > 0 && (<>
            <div className="budget-bar"><i className={fillCls} style={{ width: Math.min(100, pace.ratio * 100) + '%' }} /></div>
            <div className="budget-meta">
              <span>{pace.ratio >= 1 ? `Over budget by ${fmt(pace.spent - pace.total)}` : `${fmt(pace.remaining)} left of ${fmt(pace.total)}`}</span>
              <span>On pace for {fmt(pace.projected)}</span>
            </div>
          </>)}
          <button className="hero-link" onClick={() => setView('insights')}>
            {pace.total > 0 ? 'Budget & trends' : 'Set a budget & see trends'} ›
          </button>
        </div>
      </div>

      {topAlert && <div className={'alert inline ' + topAlert.level}>{topAlert.message} <button className="seeall" style={{ padding: '0 0 0 4px' }} onClick={() => setView('insights')}>Details</button></div>}

      <div className="stats" aria-label="At a glance">
        <div className="stat"><div className="eyebrow">Today</div><div className="v num">{fmt(todaySum)}</div><div className="s">{today.length ? `${today.length} entr${today.length === 1 ? 'y' : 'ies'}` : 'nothing yet'}</div></div>
        <div className="stat"><div className="eyebrow">Daily avg</div><div className="v num">{fmt(daysWith ? pace.spent / daysWith : 0)}</div><div className="s">days with spend</div></div>
        <div className="stat"><div className="eyebrow">Top category</div><div className="v">{top ? top[0] : '—'}</div><div className="s">{top ? `${fmt(top[1])} · ${Math.round((top[1] / pace.spent) * 100)}%` : '—'}</div></div>
      </div>

      <div className="chiprow" aria-label="Categories this month">
        {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
          const lim = budget.cats[c as keyof typeof budget.cats]; const r = lim ? v / lim : 0;
          return <div className="cchip" key={c}><span>{c}</span><b className="num">{fmt(v)}</b><i className={r >= 1 ? 'over' : r >= 0.8 ? 'warn' : ''} style={{ width: (lim ? Math.min(100, r * 100) : 100) + '%' }} /></div>;
        })}
        {!Object.keys(cats).length && <div className="cchip"><span>No spending yet this month</span></div>}
      </div>

      <div className="panel recent">
        <div className="panel-head"><h2>Recent</h2><button className="seeall" onClick={() => setView('expenses')}>See all</button></div>
        {recent.length
          ? <ul className="ledger">{recent.map((e) => <ExpenseRow key={e.id} e={e} />)}</ul>
          : <EmptyState title="No expenses yet" hint="Tap + to log your first one, or scan a bill." action={<button className="btn primary" style={{ maxWidth: 220 }} onClick={() => setView('add')}>Add expense</button>} />}
      </div>
    </section>
  );
}
