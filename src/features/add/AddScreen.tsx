import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '@/store/useApp';
import { allCategories, type Category, type Currency, type Expense, type RecurringRule } from '@/types';
import { equalShares } from '@/lib/split';
import { SYMBOL, homeCurrency, round2 } from '@/lib/money';
import { CurrencyOptions } from '@/components/CurrencyOptions';
import { todayISO } from '@/lib/dates';
import { afterAddMessage } from '@/lib/budget';
import { parseSms } from '@/lib/sms';
import { guessCategory } from '@/lib/ocr';
import { BillScanner, type ScanResult } from './BillScanner';

export function AddScreen() {
  const { editing, startEdit, addExpense, updateExpense, expenses, budget, setBudget, addRecurring, sharedText, clearShared, showToast, setView, session, currentSpace, spaceMembers } = useApp();
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayISO()); const [category, setCategory] = useState<Category>('Food');
  const [currency, setCurrency] = useState<Currency>(homeCurrency()); const [note, setNote] = useState(''); const [scan, setScan] = useState<ScanResult | null>(null);
  const [newCat, setNewCat] = useState<string | null>(null); // non-null = the "new category" input is open
  const [repeat, setRepeat] = useState(false);
  const [sms, setSms] = useState<string | null>(null); // non-null = the paste-SMS box is open
  const inSpace = !editing ? currentSpace : editing.spaceId ? currentSpace : null; // split UI applies in a space
  const [paidBy, setPaidBy] = useState('');
  const [splitIds, setSplitIds] = useState<string[]>([]);
  useEffect(() => { // (re)default the split whenever the space/members/editing change
    if (editing?.split) { setPaidBy(editing.split.paidBy); setSplitIds(Object.keys(editing.split.shares)); }
    else { setPaidBy(session?.userId ?? ''); setSplitIds(spaceMembers.map((m) => m.userId)); }
  }, [editing, session, spaceMembers]);
  const cats = allCategories(budget);
  const isCustom = (budget.customCats ?? []).includes(category);

  useEffect(() => {
    if (editing) { setAmount(String(editing.amount)); setDate(editing.date); setCategory(editing.category); setCurrency(editing.currency); setNote(editing.note); }
    else { setAmount(''); setDate(todayISO()); setCategory('Food'); setCurrency(homeCurrency()); setNote(''); setScan(null); setRepeat(false); }
  }, [editing]);

  // Parse a bank SMS (shared or pasted) ON DEVICE and prefill the form; the raw text is discarded.
  function prefillFromText(text: string) {
    const p = parseSms(text);
    if (p.amount == null && !p.vendor && !p.date) { showToast("Couldn't find an amount in that message"); return; }
    if (p.amount != null) setAmount(String(p.amount));
    if (p.vendor) setNote(p.vendor);
    if (p.date) setDate(p.date);
    setCategory(guessCategory(text));
    showToast(p.debit ? 'Read from the message — check and save' : 'Looks like money received, not spent — check before saving');
  }

  useEffect(() => {
    if (!sharedText || editing) return;
    prefillFromText(sharedText);
    clearShared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedText, editing]);

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
    if (inSpace && !editing && !splitIds.length) { showToast('Pick at least one member to split between'); return; }
    const now = new Date().toISOString();
    if (editing) {
      const split = editing.split ? { paidBy, shares: equalShares(round2(amt), Object.keys(editing.split.shares)) } : undefined;
      await updateExpense({ ...editing, amount: round2(amt), currency, category, date, note: note.trim(), ...(split ? { split } : {}), updatedAt: now });
      showToast('Updated'); startEdit(null); setView('expenses');
    } else if (inSpace) {
      const e: Expense = {
        id: crypto.randomUUID(), amount: round2(amt), currency, category, date, note: note.trim(),
        source: scan ? 'receipt' : 'manual', ocrRawText: scan?.rawText,
        spaceId: inSpace.id, split: { paidBy: paidBy || session!.userId, shares: equalShares(round2(amt), splitIds) },
        createdAt: now, updatedAt: now,
      };
      await addExpense(e);
      showToast(`Added to ${inSpace.name} — split ${splitIds.length} way${splitIds.length === 1 ? '' : 's'}`);
      setView('home');
    } else {
      const e: Expense = { id: crypto.randomUUID(), amount: round2(amt), currency, category, date, note: note.trim(), source: scan ? 'receipt' : 'manual', ocrRawText: scan?.rawText, createdAt: now, updatedAt: now };
      await addExpense(e);
      if (repeat) {
        const rule: RecurringRule = {
          id: crypto.randomUUID(), amount: round2(amt), currency, category, note: note.trim() || category,
          dayOfMonth: Number(date.slice(8, 10)), startDate: date, lastRun: date, createdAt: now, updatedAt: now,
        };
        await addRecurring(rule);
        showToast(`Added. Will repeat monthly on day ${rule.dayOfMonth}`);
      } else showToast(afterAddMessage([...expenses, e], budget, e));
      setView('home');
    }
  }

  return (
    <section className="view">
      <header><div><div className="eyebrow">{editing ? 'Edit' : inSpace ? `New in ${inSpace.name}` : 'New expense'}</div><h1>{editing ? 'Edit expense' : 'Add expense'}</h1></div></header>
      <div className="panel">
        {!editing && <BillScanner onResult={applyScan} onClear={() => setScan(null)} />}
        {!editing && (sms === null
          ? <p className="note" style={{ marginBottom: 10 }}>Got a bank SMS? <button type="button" className="seeall" onClick={async () => {
              try { const t = await navigator.clipboard.readText(); if (t?.trim()) { prefillFromText(t); return; } } catch { /* no permission: show the box */ }
              setSms('');
            }}>Paste it</button> — read on your phone, never stored.</p>
          : <div style={{ marginBottom: 12 }}>
              <label>Paste the message
                <textarea value={sms} onChange={(e) => setSms(e.target.value)} rows={3} placeholder="e.g. Sent Rs.2500.00 From HDFC Bank A/C *8019 To OXYGEN FUELS On 10/10/26"
                  style={{ width: '100%', resize: 'vertical' }} autoFocus />
              </label>
              <div className="actions">
                <button type="button" className="btn sm primary" onClick={() => { if (sms.trim()) prefillFromText(sms); setSms(null); }}>Read message</button>
                <button type="button" className="btn sm" onClick={() => setSms(null)}>Cancel</button>
              </div>
            </div>)}
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
          {inSpace && !editing?.settlement && (
            <>
              <label>Paid by
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  {spaceMembers.map((m) => <option key={m.userId} value={m.userId}>{m.userId === session?.userId ? 'You' : m.name}</option>)}
                </select>
              </label>
              {!editing && (
                <div style={{ marginBottom: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Split equally between</div>
                  <div className="filters" style={{ marginBottom: 0 }}>
                    {spaceMembers.map((m) => (
                      <button key={m.userId} type="button" className="chip" aria-pressed={splitIds.includes(m.userId)}
                        onClick={() => setSplitIds((l) => (l.includes(m.userId) ? l.filter((x) => x !== m.userId) : [...l, m.userId]))}>
                        {m.userId === session?.userId ? 'You' : m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <label>Currency
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <CurrencyOptions />
            </select>
          </label>
          {!editing && !inSpace && (
            <label className="check">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              <span>Repeat monthly (rent, EMI, subscription) — logged automatically on day {Number(date.slice(8, 10)) || '…'}</span>
            </label>
          )}
          <div className="actions">
            <button type="submit" className="btn primary" id="saveBtn">{editing ? 'Save changes' : 'Add expense'}</button>
            {editing && <button type="button" className="btn" style={{ flex: '0 0 auto' }} onClick={() => { startEdit(null); setView('expenses'); }}>Cancel</button>}
          </div>
        </form>
      </div>
    </section>
  );
}
