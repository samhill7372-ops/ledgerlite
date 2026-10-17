import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '@/store/useApp';
import { allCategories, type Category, type Currency, type Expense } from '@/types';
import { SYMBOL, round2 } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import { afterAddMessage } from '@/lib/budget';
import { BillScanner, type ScanResult } from './BillScanner';

export function AddScreen() {
  const { editing, startEdit, addExpense, updateExpense, expenses, budget, setBudget, showToast, setView } = useApp();
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayISO()); const [category, setCategory] = useState<Category>('Food');
  const [currency, setCurrency] = useState<Currency>('INR'); const [note, setNote] = useState(''); const [scan, setScan] = useState<ScanResult | null>(null);
  const [newCat, setNewCat] = useState<string | null>(null); // non-null = the "new category" input is open
  const cats = allCategories(budget);
  const isCustom = (budget.customCats ?? []).includes(category);

  useEffect(() => {
    if (editing) { setAmount(String(editing.amount)); setDate(editing.date); setCategory(editing.category); setCurrency(editing.currency); setNote(editing.note); }
    else { setAmount(''); setDate(todayISO()); setCategory('Food'); setCurrency('INR'); setNote(''); setScan(null); }
  }, [editing]);

  function applyScan(r: ScanResult) {
    setScan(r); if (r.total != null) setAmount(String(r.total)); if (r.date) setDate(r.date); if (r.vendor) setNote(r.vendor); setCategory(r.category);
  }

  async function createCategory() {
    const name = (newCat ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) { setNewCat(null); return; }
    if (cats.some((c) => c.toLowerCase() === name.toLowerCase())) { showToast('That category already exists'); return; }
    await setBudget({ ...budget, customCats: [...(budget.customCats ?? []), name] });
    setCategory(name); setNewCat(null); showToast(`Category "${name}" added`);
  }

  async function removeCategory() {
    const used = expenses.filter((e) => e.category === category).length;
    if (used) { showToast(`Can't remove — ${used} expense${used === 1 ? ' uses' : 's use'} it`); return; }
    const { [category]: _gone, ...rest } = budget.cats;
    await setBudget({ ...budget, cats: rest, customCats: (budget.customCats ?? []).filter((c) => c !== category) });
    setCategory('Food'); showToast('Category removed');
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const amt = parseFloat(amount); if (!(amt > 0)) { showToast('Enter an amount greater than 0'); return; }
    const now = new Date().toISOString();
    if (editing) {
      await updateExpense({ ...editing, amount: round2(amt), currency, category, date, note: note.trim(), updatedAt: now });
      showToast('Updated'); startEdit(null); setView('expenses');
    } else {
      const e: Expense = { id: crypto.randomUUID(), amount: round2(amt), currency, category, date, note: note.trim(), source: scan ? 'receipt' : 'manual', ocrRawText: scan?.rawText, createdAt: now, updatedAt: now };
      await addExpense(e); showToast(afterAddMessage([...expenses, e], budget, e)); setView('home');
    }
  }

  return (
    <section className="view">
      <header><div><div className="eyebrow">{editing ? 'Edit' : 'New expense'}</div><h1>{editing ? 'Edit expense' : 'Add expense'}</h1></div></header>
      <div className="panel">
        {!editing && <BillScanner onResult={applyScan} onClear={() => setScan(null)} />}
        <form onSubmit={submit} autoComplete="off">
          <label>Amount
            <span className="amount-wrap"><span>{SYMBOL[currency]}</span>
              <input type="number" id="amount" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required /></span>
          </label>
          <div className="row">
            <label>Date <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
            <label>Category
              <select id="category" value={newCat !== null ? '__new__' : category}
                onChange={(e) => { if (e.target.value === '__new__') setNewCat(''); else { setNewCat(null); setCategory(e.target.value as Category); } }}>
                {cats.map((c) => <option key={c}>{c}</option>)}
                <option value="__new__">＋ New category…</option>
              </select>
            </label>
          </div>
          {newCat !== null && (
            <div className="row" style={{ alignItems: 'end' }}>
              <label>New category name
                <input type="text" value={newCat} maxLength={24} placeholder="e.g. Pets, Rent, Education" autoFocus
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } }} />
              </label>
              <div className="actions" style={{ flex: '0 0 auto' }}>
                <button type="button" className="btn sm" onClick={createCategory}>Add</button>
                <button type="button" className="btn sm" onClick={() => setNewCat(null)}>Cancel</button>
              </div>
            </div>
          )}
          {isCustom && newCat === null && (
            <p className="note" style={{ marginTop: -4 }}>Custom category · <button type="button" className="seeall" onClick={removeCategory}>remove it</button> (only when no expense uses it)</p>
          )}
          <label>Vendor / note <input type="text" id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Metro ticket, Big Bazaar" maxLength={80} /></label>
          <label>Currency
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="INR">INR ₹</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="CAD">CAD $</option>
            </select>
          </label>
          <div className="actions">
            <button type="submit" className="btn primary" id="saveBtn">{editing ? 'Save changes' : 'Add expense'}</button>
            {editing && <button type="button" className="btn" style={{ flex: '0 0 auto' }} onClick={() => { startEdit(null); setView('expenses'); }}>Cancel</button>}
          </div>
        </form>
      </div>
    </section>
  );
}
