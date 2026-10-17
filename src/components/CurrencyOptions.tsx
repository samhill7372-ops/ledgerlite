import { CURRENCIES, REGIONS } from '@/lib/money';

/** <option> list grouped by region, shared by every currency <select>. */
export function CurrencyOptions() {
  return (
    <>
      {REGIONS.map((r) => (
        <optgroup key={r} label={r}>
          {CURRENCIES.filter((c) => c.region === r).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </optgroup>
      ))}
    </>
  );
}
