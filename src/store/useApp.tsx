/**
 * Shared app state: session, repos, expenses, budget, toasts.
 * Screens read from here and call the actions; they never touch repos directly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Budget, Expense } from '@/types';
import type { Repos } from '@/data/repo';
import type { AuthApi, Session } from '@/auth/api';
import { createAuth, createRepos, vault } from '@/data';
import { seedExpenses } from '@/data/seed';

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
  resetData(): Promise<void>;
  setBudget(b: Budget): Promise<void>;
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
  const [view, setView] = useState<View>('home');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const a = await createAuth(); setAuth(a);
        const s = await a.restore();
        if (s) { setSession(s); setNeedsUnlock(true); }
      } catch { /* offline or restore failed: fall through to the auth screen */ }
      finally { setReady(true); }
    })();
  }, []);

  const showToast = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 1800);
  }, []);

  const onSignedIn = useCallback(async (s: Session, fresh: boolean) => {
    const r = await createRepos(s.userId);
    setRepos(r); setSession(s); setNeedsUnlock(false);
    setExpenses(await r.expenses.list());
    setBudgetState((await r.budgets.get()) ?? (fresh ? EMPTY_BUDGET : EMPTY_BUDGET));
    setView('home');
  }, []);

  const signOut = useCallback(async () => {
    await auth?.signOut(); vault.lock();
    setSession(null); setRepos(null); setExpenses([]); setBudgetState(EMPTY_BUDGET); setNeedsUnlock(false); setEditing(null);
  }, [auth]);

  const addExpense = useCallback(async (e: Expense) => { if (!repos) return; await repos.expenses.upsert(e); setExpenses((l) => [...l, e]); }, [repos]);
  const updateExpense = useCallback(async (e: Expense) => { if (!repos) return; await repos.expenses.upsert(e); setExpenses((l) => l.map((x) => (x.id === e.id ? e : x))); }, [repos]);
  const deleteExpense = useCallback(async (id: string) => {
    if (!repos) return;
    const victim = expenses.find((x) => x.id === id); if (!victim) return;
    await repos.expenses.remove(id); setExpenses((l) => l.filter((x) => x.id !== id));
    showToast('Deleted', async () => { await repos.expenses.upsert(victim); setExpenses((l) => [...l, victim]); setToast(null); });
  }, [repos, expenses, showToast]);
  const resetData = useCallback(async () => {
    if (!repos || !session) return;
    const list = session.userId === 'demo' ? seedExpenses() : [];
    await repos.expenses.replaceAll(list); setExpenses(list);
  }, [repos, session]);
  const setBudget = useCallback(async (b: Budget) => { if (!repos) return; await repos.budgets.set(b); setBudgetState(b); }, [repos]);

  const value = useMemo<AppState>(() => ({
    ready, auth, session, needsUnlock, expenses, budget, view, editing, toast,
    setView, startEdit: setEditing, onSignedIn, signOut, addExpense, updateExpense, deleteExpense, resetData, setBudget, showToast,
  }), [ready, auth, session, needsUnlock, expenses, budget, view, editing, toast, onSignedIn, signOut, addExpense, updateExpense, deleteExpense, resetData, setBudget, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx); if (!v) throw new Error('useApp outside AppProvider'); return v;
}
