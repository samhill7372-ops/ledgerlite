import type { Expense } from '@/types';
import { fmt } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import { useApp } from '@/store/useApp';

const dfmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

export function ExpenseRow({ e }: { e: Expense }) {
  const { startEdit, setView, deleteExpense, session, spaceMembers } = useApp();
  const who = (id: string) => (id === session?.userId ? 'you' : spaceMembers.find((m) => m.userId === id)?.name ?? 'member');
  const extra = e.settlement ? ` · ${who(e.settlement.from)} paid ${who(e.settlement.to)}` : e.split ? ` · ${who(e.split.paidBy)} paid` : '';
  return (
    <li>
      <div className="cat" data-c={e.settlement ? undefined : e.category}>{e.settlement ? '⇄' : e.category}</div>
      <div className="t">
        <b>{e.note || e.category}</b>
        <small>{dfmt.format(new Date(e.date))}{e.date === todayISO() ? ' · today' : ''}{extra}
          <span className={'src ' + (e.source !== 'manual' ? 'receipt' : '')}>{e.source === 'receipt' ? 'scanned' : e.source === 'recurring' ? 'auto' : 'manual'}</span></small>
      </div>
      <div className="a">
        <b className="num">{fmt(e.amount, e.currency)}</b>
        <div className="tools">
          <button onClick={() => { startEdit(e); setView('add'); window.scrollTo({ top: 0 }); }}>Edit</button>
          <button className="del" onClick={() => deleteExpense(e.id)}>Delete</button>
        </div>
      </div>
    </li>
  );
}
