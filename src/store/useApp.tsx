/**
 * Shared app state: session, repos, expenses, budget, toasts.
 * Screens read from here and call the actions; they never touch repos directly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Budget, Expense, RecurringRule } from '@/types';
import type { Repos } from '@/data/repo';
import type { AuthApi, Session } from '@/auth/api';
import { createAuth, createRepos, vault } from '@/data';
import { seedExpenses } from '@/data/seed';
import { materialize } from '@/lib/recurring';
import { todayISO } from '@/lib/dates';
import { guessCurrency, setHomeCurrency } from '@/lib/money';

export type View = 'home' | 'expenses' | 'add' | 'insights';
export interface Toast { id: number; text: string; undo?: () => void }

interface AppState {
  ready: boolean;
  auth: AuthApi | null;
  session: Session | null;
  /** true when a remembered session exists but the vault is locked (needs password). */
  needsUnlock: boolean;
  expenses: Expense[];
  budget: Budget;
  recurring: RecurringRule[];
  /** true until the user has picked their home currency (new accounts). */
  needsCurrency: boolean;
  /** Text shared into the app via the Android share sheet (consumed by Add, never stored). */
  sharedText: string | null;
  clearShared(): void;
  view: View;
  editing: Expense | null;
  toast: Toast | null;
  setView(v: View): void;
  startEdit(e: Expense | null): void;
  onSignedIn(s: Session, fresh: boolean): Promise<void>;
  signOut(): Promise<void>;
  addExpense(e: Expense): Promise<void>;
  updateExpense(e: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  importExpenses(list: Expense[]): Promise<void>;
  resetData(): Promise<void>;
  setBudget(b: Budget): Promise<void>;
  addRecurring(rule: RecurringRule): Promise<void>;
  updateRecurring(rules: RecurringRule[]): Promise<void>;
  showToast(text: string, undo?: () => void): void;
}

const Ctx = createContext<AppState | null>(null);
const EMPTY_BUDGET: Budget = { total: 0, cats: {} };

export function AppProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthApi | null>(null);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [repos, setRepos] = useState<Repos | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudgetState] = useState<Budget>(EMPTY_BUDGET);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [needsCurrency, setNeedsCurrency] = useState(false);
  // Grab share-sheet text synchronously on first render, then scrub the URL.
  const [sharedText, setSharedText] = useState<string | null>(() => {
    try {
      const u = new URL(window.location.href);
      const t = [u.searchParams.get('text'), u.searchParams.get('title'), u.searchParams.get('url')].filter(Boolean).join(' ').trim();
      if (u.pathname === '/share' || t) window.history.replaceState(null, '', '/');
      return t || null;
    } catch { return null; }
  });
  const clearShared = useCallback(() => setSharedText(null), []);
  const [view, setView] = useState<View>('home');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const a = await createAuth(); setAuth(a);
        const s = await a.restore();
        if (s && !vault.locked) await onSignedIn(s, false); // device key store unlocked us
        else if (s) { setSession(s); setNeedsUnlock(true); }
      } catch { /* offline or restore failed: fall through to the auth screen */ }
      finally { setReady(true); }
    })();
  }, []);

  const showToast = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 1800);
  }, []);

  const onSignedIn = useCallback(async (s: Session, _fresh: boolean) => {
    const r = await createRepos(s.userId);
    setRepos(r); setSession(s); setNeedsUnlock(false);
    // Materialize any recurring occurrences that came due since the last open.
    let rules: RecurringRule[] = [];
    try {
      rules = await r.recurring.list();
      const mat = materialize(rules, todayISO());
      if (mat.changed) {
        for (const e of mat.expenses) await r.expenses.upsert(e);
        await r.recurring.saveAll(mat.rules);
        rules = mat.rules;
        if (mat.expenses.length) showToast(`Added ${mat.expenses.length} recurring expense${mat.expenses.length === 1 ? '' : 's'}`);
      }
    } catch { /* recurring is best-effort; the ledger still loads */ }
    setRecurring(rules);
    setExpenses(await r.expenses.list());
    const b = (await r.budgets.get()) ?? EMPTY_BUDGET;
    setHomeCurrency(b.currency ?? guessCurrency());
    setNeedsCurrency(!b.currency);
    setBudgetState(b);
    setView('home');
  }, [showToast]); // sharedText routing happens in Shell, so this callback stays stable

  const signOut = useCallback(async () => {
    await auth?.signOut(); vault.lock();
    setSession(null); setRepos(null); setExpenses([]); setBudgetState(EMPTY_BUDGET); setRecurring([]); setNeedsCurrency(false); setNeedsUnlock(false); setEditing(null);
  }, [auth]);

  const addExpense = useCallback(async (e: Expense) => { if (!repos) return; await repos.expenses.upsert(e); setExpenses((l) => [...l, e]); }, [repos]);
  const updateExpense = useCallback(async (e: Expense) => { if (!repos) return; await repos.expenses.upsert(e); setExpenses((l) => l.map((x) => (x.id === e.id ? e : x))); }, [repos]);
  const deleteExpense = useCallback(async (id: string) => {
    if (!repos) return;
    const victim = expenses.find((x) => x.id === id); if (!victim) return;
    await repos.expenses.remove(id); setExpenses((l) => l.filter((x) => x.id !== id));
    showToast('Deleted', async () => { await repos.expenses.upsert(victim); setExpenses((l) => [...l, victim]); setToast(null); });
  }, [repos, expenses, showToast]);
  const importExpenses = useCallback(async (list: Expense[]) => {
    if (!repos || !list.length) return;
    const merged = [...expenses, ...list];
    await repos.expenses.replaceAll(merged); setExpenses(merged);
  }, [repos, expenses]);
  const resetData = useCallback(async () => {
    if (!repos || !session) return;
    const list = session.userId === 'demo' ? seedExpenses() : [];
    await repos.expenses.replaceAll(list); setExpenses(list);
  }, [repos, session]);
  const setBudget = useCallback(async (b: Budget) => {
    if (!repos) return;
    await repos.budgets.set(b); setBudgetState(b);
    if (b.currency) { setHomeCurrency(b.currency); setNeedsCurrency(false); }
  }, [repos]);
  const addRecurring = useCallback(async (rule: RecurringRule) => { if (!repos) return; const next = [...recurring, rule]; await repos.recurring.saveAll(next); setRecurring(next); }, [repos, recurring]);
  const updateRecurring = useCallback(async (rules: RecurringRule[]) => { if (!repos) return; await repos.recurring.saveAll(rules); setRecurring(rules); }, [repos]);

  const value = useMemo<AppState>(() => ({
    ready, auth, session, needsUnlock, expenses, budget, recurring, needsCurrency, sharedText, clearShared, view, editing, toast,
    setView, startEdit: setEditing, onSignedIn, signOut, addExpense, updateExpense, deleteExpense, importExpenses, resetData, setBudget, addRecurring, updateRecurring, showToast,
  }), [ready, auth, session, needsUnlock, expenses, budget, recurring, needsCurrency, sharedText, clearShared, view, editing, toast, onSignedIn, signOut, addExpense, updateExpense, deleteExpense, importExpenses, resetData, setBudget, addRecurring, updateRecurring, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx); if (!v) throw new Error('useApp outside AppProvider'); return v;
}
