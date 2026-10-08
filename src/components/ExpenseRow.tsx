import type { Expense } from '@/types';
import { fmt } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import { useApp } from '@/store/useApp';

const dfmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

export function ExpenseRow({ e }: { e: Expense }) {
  const { startEdit, setView, deleteExpense } = useApp();
  return (
    <li>
      <div className="cat" data-c={e.category}>{e.category}</div>
      <div className="t">
        <b>{e.note || e.category}</b>
        <small>{dfmt.format(new Date(e.date))}{e.date === todayISO() ? ' · today' : ''}
          <span className={'src ' + (e.source === 'receipt' ? 'receipt' : '')}>{e.source === 'receipt' ? 'scanned' : 'manual'}</span></small>
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
