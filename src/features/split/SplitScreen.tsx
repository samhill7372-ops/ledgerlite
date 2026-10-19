import { useMemo, useState } from 'react';
import { useApp } from '@/store/useApp';
import { fmt } from '@/lib/money';
import { monthExpenses } from '@/lib/budget';
import { computeNet, simplifyDebts } from '@/lib/split';
import { ExpenseRow } from '@/components/ExpenseRow';

/** The Split tab: a list of shared groups, or one open group with balances. */
export function SplitScreen() {
  const { currentSpace } = useApp();
  return <section className="view">{currentSpace ? <GroupDetail /> : <GroupList />}</section>;
}

function GroupList() {
  const { spaces, switchSpace, createSpace, showToast } = useApp();
  const [creating, setCreating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doCreate() {
    const name = (creating ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!name) { setCreating(null); return; }
    setBusy(true);
    try {
      const link = await createSpace(name);
      setCreating(null);
      try { await navigator.clipboard.writeText(link); showToast('Group created — invite link copied'); }
      catch { showToast('Group created — open it and tap Invite'); }
    } catch { showToast('Could not create the group'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <header><div><div className="eyebrow">Shared</div><h1>Split groups</h1></div></header>
      <p className="note" style={{ marginBottom: 14 }}>Shared ledgers for a family or a trip — split expenses, see who owes whom. Encrypted like everything else.</p>

      {spaces.length > 0 && (
        <div className="panel" style={{ padding: 6 }}>
          <ul className="ledger">
            {spaces.map((s) => (
              <li key={s.id} style={{ cursor: 'pointer' }} onClick={() => { void switchSpace(s.id); window.scrollTo({ top: 0 }); }}>
                <div className="cat">👥</div>
                <div className="t"><b>{s.name}</b><small>tap to open</small></div>
                <div className="a"><b className="num" aria-hidden>›</b></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating === null ? (
        <button className="btn primary" style={{ width: '100%', marginTop: 14 }} onClick={() => setCreating('')}>＋ New group</button>
      ) : (
        <div className="panel" style={{ marginTop: 14 }}>
          <label>Group name
            <input type="text" value={creating} maxLength={30} placeholder="e.g. Family, Goa Trip" autoFocus
              onChange={(e) => setCreating(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doCreate(); } }} />
          </label>
          <div className="actions">
            <button className="btn primary" disabled={busy} onClick={doCreate}>{busy ? 'Creating…' : 'Create group'}</button>
            <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setCreating(null)}>Cancel</button>
          </div>
        </div>
      )}
      <p className="note" style={{ marginTop: 14 }}>Joining one? Open the invite link a friend sent you — you'll land here automatically.</p>
    </>
  );
}

function GroupDetail() {
  const { currentSpace, spaceMembers, spaceExpenses, session, switchSpace, startAdd, settleUp, inviteLink, showToast } = useApp();
  const now = new Date();
  const real = useMemo(() => spaceExpenses.filter((e) => !e.settlement), [spaceExpenses]);
  const month = useMemo(() => monthExpenses(real, now), [real]);
  const net = useMemo(() => computeNet(spaceExpenses), [spaceExpenses]);
  const transfers = useMemo(() => simplifyDebts(net), [net]);
  const me = session?.userId;
  const nameOf = (id: string) => (id === me ? 'You' : spaceMembers.find((m) => m.userId === id)?.name ?? 'Member');
  const myNet = net[me ?? ''] ?? 0;
  const recent = [...spaceExpenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  async function invite() {
    if (!currentSpace) return;
    const link = inviteLink(currentSpace.id);
    if (!link) { showToast('Sign in again to rebuild the invite link'); return; }
    const msg = `Join "${currentSpace.name}" on LedgerLite: ${link}`;
    if (navigator.share) { try { await navigator.share({ text: msg }); return; } catch { /* closed */ } }
    try { await navigator.clipboard.writeText(link); showToast('Invite link copied'); } catch { showToast('Could not copy the link'); }
  }

  return (
    <>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button className="backbtn" aria-label="Back to groups" onClick={() => { void switchSpace(null); window.scrollTo({ top: 0 }); }}>‹</button>
          <div style={{ minWidth: 0 }}><div className="eyebrow">Group</div><h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSpace?.name}</h1></div>
        </div>
        <button className="btn sm" style={{ flex: '0 0 auto' }} onClick={invite}>Invite</button>
      </header>

      <div className="hero-wrap">
        <div className="stat hero">
          <div className="budget-head">
            <div className="eyebrow">Spent this month</div>
            <span className={'pill ' + (myNet > 0.004 ? 'good' : myNet < -0.004 ? 'warn' : '')}>
              {myNet > 0.004 ? `You are owed ${fmt(myNet)}` : myNet < -0.004 ? `You owe ${fmt(-myNet)}` : 'All square'}
            </span>
          </div>
          <div className="v num">{fmt(month.reduce((a, e) => a + e.amount, 0))}</div>
          <div className="s">{month.length} expense{month.length === 1 ? '' : 's'} · {spaceMembers.length} member{spaceMembers.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <button className="btn primary" style={{ width: '100%' }} onClick={() => currentSpace && startAdd(currentSpace)}>＋ Add shared expense</button>

      <div className="panel">
        <div className="panel-head"><h2>Balances</h2><span className="eyebrow">who owes whom</span></div>
        {transfers.length ? (
          <ul className="ledger">
            {transfers.map((t, i) => (
              <li key={i}>
                <div className="cat">⇄</div>
                <div className="t"><b>{nameOf(t.from)} → {nameOf(t.to)}</b><small>suggested settlement</small></div>
                <div className="a">
                  <b className="num">{fmt(t.amount)}</b>
                  <div className="tools"><button onClick={() => settleUp(t.from, t.to, t.amount)}>Settle</button></div>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="note">Everyone is settled up. 🎉</p>}
        <p className="note" style={{ marginTop: 8 }}>
          {spaceMembers.map((m) => `${nameOf(m.userId)}: ${net[m.userId] != null && Math.abs(net[m.userId]) > 0.004 ? (net[m.userId] > 0 ? '+' : '−') + fmt(Math.abs(net[m.userId])) : 'even'}`).join(' · ')}
        </p>
      </div>

      <div className="panel recent">
        <div className="panel-head"><h2>Recent</h2></div>
        <ul className="ledger">
          {recent.length ? recent.map((e) => <ExpenseRow key={e.id} e={e} />)
            : <li className="empty" style={{ display: 'block' }}>No shared expenses yet. Tap “Add shared expense”.</li>}
        </ul>
      </div>
    </>
  );
}
