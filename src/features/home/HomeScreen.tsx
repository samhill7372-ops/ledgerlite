import { useMemo } from 'react';
import { useApp } from '@/store/useApp';
import { fmt } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import { computePace, monthExpenses, byCategory, buildAlerts } from '@/lib/budget';
import { ExpenseRow } from '@/components/ExpenseRow';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { SpaceBar } from '@/components/SpaceBar';
import { SpaceHome } from './SpaceHome';

const PILL: Record<string, [string, string]> = { none: ['No budget set', ''], 'on-track': ['On track', 'good'], 'over-pace': ['Over pace', 'warn'], 'over-budget': ['Over budget', 'bad'] };

export function HomeScreen() {
  const { session, expenses, budget, signOut, setView, currentSpace } = useApp();
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
        <div className="actions" style={{ flex: '0 0 auto', alignItems: 'center' }}>
          <span className="badge">Encrypted on device</span>
          <button className="signout" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <SpaceBar />
      {currentSpace ? <SpaceHome /> : <><CurrencyPicker />

      <div className="hero-wrap">
        <div className="stat hero">
          <div className="budget-head"><div className="eyebrow">Spent this month</div><span className={'pill ' + pillCls}>{pillText}</span></div>
          <div className="v num">{fmt(pace.spent)}</div>
          <div className="s">{month.length} expense{month.length === 1 ? '' : 's'}</div>
          {pace.total > 0 && (<>
            <div className="budget-bar"><i className={fillCls} style={{ width: Math.min(100, pace.ratio * 100) + '%' }} /></div>
            <div className="budget-meta">
              <span>{pace.ratio >= 1 ? `Over budget by ${fmt(pace.spent - pace.total)}` : `${fmt(pace.remaining)} left of ${fmt(pace.total)}`}</span>
              <span>On pace for {fmt(pace.projected)}</span>
            </div>
          </>)}
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
        <ul className="ledger">
          {recent.length ? recent.map((e) => <ExpenseRow key={e.id} e={e} />) : <li className="empty" style={{ display: 'block' }}>No expenses yet. Tap Add to log your first one, or scan a bill.</li>}
        </ul>
      </div>

      </>}
    </section>
  );
}
