import { useState } from 'react';
import { useApp } from '@/store/useApp';
import { guessCurrency } from '@/lib/money';
import { CurrencyOptions } from '@/components/CurrencyOptions';
import type { Currency } from '@/types';

/** One-time home-currency choice for new accounts; stored in the encrypted budget blob. */
export function CurrencyPicker() {
  const { needsCurrency, budget, setBudget, showToast } = useApp();
  const [cur, setCur] = useState<Currency>(guessCurrency());
  const [busy, setBusy] = useState(false);
  if (!needsCurrency || budget.currency) return null;

  async function save() {
    setBusy(true);
    try { await setBudget({ ...budget, currency: cur }); showToast('Currency saved'); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel" role="region" aria-label="Choose your currency">
      <div className="panel-head"><h2>Your currency</h2></div>
      <p className="note">Budgets, totals and new expenses will use it. You can change it later when editing your budget.</p>
      <div className="actions" style={{ alignItems: 'stretch' }}>
        <select value={cur} onChange={(e) => setCur(e.target.value as Currency)} aria-label="Currency">
          <CurrencyOptions />
        </select>
        <button className="btn primary" style={{ flex: '0 0 auto' }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}
