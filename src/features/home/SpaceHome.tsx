import { useMemo } from 'react';
import { useApp } from '@/store/useApp';
import { fmt } from '@/lib/money';
import { monthExpenses } from '@/lib/budget';
import { computeNet, simplifyDebts } from '@/lib/split';
import { ExpenseRow } from '@/components/ExpenseRow';

/** Home for a shared space: month total, who-owes-whom, settle up, recent. */
export function SpaceHome() {
  const { currentSpace, spaceMembers, spaceExpenses, session, settleUp, setView } = useApp();
  const now = new Date();
  const real = useMemo(() => spaceExpenses.filter((e) => !e.settlement), [spaceExpenses]);
  const month = useMemo(() => monthExpenses(real, now), [real]);
  const net = useMemo(() => computeNet(spaceExpenses), [spaceExpenses]);
  const transfers = useMemo(() => simplifyDebts(net), [net]);
  const me = session?.userId;
  const name = (id: string) => (id === me ? 'You' : spaceMembers.find((m) => m.userId === id)?.name ?? 'Member');
  const myNet = net[me ?? ''] ?? 0;

  return (
    <>
      <div className="hero-wrap">
        <div className="stat hero">
          <div className="budget-head">
            <div className="eyebrow">Spent this month · {currentSpace?.name}</div>
            <span className={'pill ' + (myNet > 0.004 ? 'good' : myNet < -0.004 ? 'warn' : '')}>
              {myNet > 0.004 ? `You are owed ${fmt(myNet)}` : myNet < -0.004 ? `You owe ${fmt(-myNet)}` : 'All square'}
            </span>
          </div>
          <div className="v num">{fmt(month.reduce((a, e) => a + e.amount, 0))}</div>
          <div className="s">{month.length} expense{month.length === 1 ? '' : 's'} · {spaceMembers.length} member{spaceMembers.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Balances</h2><span className="eyebrow">who owes whom</span></div>
        {transfers.length ? (
          <ul className="ledger">
            {transfers.map((t, i) => (
              <li key={i}>
                <div className="cat">⇄</div>
                <div className="t"><b>{name(t.from)} → {name(t.to)}</b><small>suggested settlement</small></div>
                <div className="a">
                  <b className="num">{fmt(t.amount)}</b>
                  <div className="tools"><button onClick={() => settleUp(t.from, t.to, t.amount)}>Settle</button></div>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="note">Everyone is settled up. 🎉</p>}
        <p className="note" style={{ marginTop: 8 }}>
          {spaceMembers.map((m) => `${name(m.userId)}: ${net[m.userId] != null && Math.abs(net[m.userId]) > 0.004 ? (net[m.userId] > 0 ? '+' : '−') + fmt(Math.abs(net[m.userId])) : 'even'}`).join(' · ')}
        </p>
      </div>

      <div className="panel recent">
        <div className="panel-head"><h2>Recent</h2><button className="seeall" onClick={() => setView('expenses')}>See all</button></div>
        <ul className="ledger">
          {spaceExpenses.length
            ? [...spaceExpenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((e) => <ExpenseRow key={e.id} e={e} />)
            : <li className="empty" style={{ display: 'block' }}>No shared expenses yet. Tap Add — it will be split between members.</li>}
        </ul>
      </div>
    </>
  );
}
