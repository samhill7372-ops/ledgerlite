/**
 * Split & balance maths (pure). Runs on every member's device over the
 * decrypted space ledger — the server never sees amounts or balances.
 */
import type { Expense } from '@/types';
import { round2 } from '@/lib/money';

export interface Transfer { from: string; to: string; amount: number }

/** Split an amount equally to the paisa: remainder goes to the first members. */
export function equalShares(amount: number, memberIds: string[]): Record<string, number> {
  const n = memberIds.length;
  if (!n) return {};
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n; // first `extra` members pay one paisa more
  const out: Record<string, number> = {};
  memberIds.forEach((id, i) => { out[id] = (base + (i < extra ? 1 : 0)) / 100; });
  return out;
}

/**
 * Net position per member: positive = others owe them, negative = they owe.
 * Expenses without split info (personal entries) are ignored.
 */
export function computeNet(expenses: Expense[]): Record<string, number> {
  const net: Record<string, number> = {};
  const add = (id: string, v: number) => { net[id] = (net[id] ?? 0) + v; };
  for (const e of expenses) {
    if (e.settlement) { add(e.settlement.from, e.amount); add(e.settlement.to, -e.amount); }
    else if (e.split) {
      add(e.split.paidBy, e.amount);
      for (const [id, share] of Object.entries(e.split.shares)) add(id, -share);
    }
  }
  for (const id of Object.keys(net)) net[id] = round2(net[id]);
  return net;
}

/** Fewest payments that settle everyone: largest debtor pays largest creditor. */
export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const creditors = Object.entries(net).filter(([, v]) => v > 0.004).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const debtors = Object.entries(net).filter(([, v]) => v < -0.004).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = round2(Math.min(creditors[ci].v, debtors[di].v));
    out.push({ from: debtors[di].id, to: creditors[ci].id, amount: pay });
    creditors[ci].v = round2(creditors[ci].v - pay);
    debtors[di].v = round2(debtors[di].v - pay);
    if (creditors[ci].v <= 0.004) ci++;
    if (debtors[di].v <= 0.004) di++;
  }
  return out;
}
