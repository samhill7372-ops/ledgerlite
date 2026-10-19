/**
 * Shared app state: session, repos, expenses, budget, toasts.
 * Screens read from here and call the actions; they never touch repos directly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Budget, Expense, RecurringRule, Space, SpaceMember } from '@/types';
import { Vault } from '@/lib/crypto';
import type { Repos } from '@/data/repo';
import type { AuthApi, Session } from '@/auth/api';
import { createAuth, createRepos, vault } from '@/data';
import { seedExpenses } from '@/data/seed';
import { materialize } from '@/lib/recurring';
import { todayISO } from '@/lib/dates';
import { guessCurrency, homeCurrency, setHomeCurrency } from '@/lib/money';

export type View = 'home' | 'expenses' | 'add' | 'insights' | 'split';
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
  /** Shared spaces (v2). currentSpace = the group open in the Split tab (null = its group list). */
  spaces: Space[];
  currentSpace: Space | null;
  spaceMembers: SpaceMember[];
  spaceExpenses: Expense[];
  /** The space a new expense is being added to (null = personal). Separate from currentSpace. */
  addTarget: Space | null;
  startAdd(target: Space | null): void;          // open the Add screen in personal or space mode
  createSpace(name: string): Promise<string>;    // resolves to the invite link
  switchSpace(id: string | null): Promise<void>; // open a group in the Split tab (null = group list)
  reloadSpace(id: string): Promise<void>;        // refresh members + expenses of the open group
  inviteLink(spaceId: string): string | null;
  settleUp(from: string, to: string, amount: number): Promise<void>;
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
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
  const [spaceMembers, setSpaceMembers] = useState<SpaceMember[]>([]);
  const [spaceExpenses, setSpaceExpenses] = useState<Expense[]>([]);
  const [addTarget, setAddTarget] = useState<Space | null>(null);
  // Invite link (#join=<spaceId>.<key>): the fragment never reaches any server.
  const pendingJoin = useRef<{ id: string; raw: string } | null>(null);
  if (pendingJoin.current === null) {
    try {
      const m = window.location.hash.match(/^#join=([0-9a-f-]{36})\.(.+)$/i);
      if (m) { pendingJoin.current = { id: m[1], raw: decodeURIComponent(m[2]) }; window.history.replaceState(null, '', '/'); }
    } catch { /* ignore */ }
  }
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
    // Shared spaces: honor a pending invite link, then load memberships.
    try {
      const pj = pendingJoin.current; pendingJoin.current = null;
      if (pj) {
        try { await r.spaces.join(pj.id, pj.raw, s.name); showToast('Joined the shared space'); }
        catch { showToast('Could not join — ask for a fresh invite link'); }
      }
      const sp = await r.spaces.mine();
      setSpaces(sp);
      const joined = pj ? sp.find((x) => x.id === pj.id) : undefined;
      if (joined) {
        setCurrentSpace(joined);
        setSpaceMembers(await r.spaces.members(joined.id));
        setSpaceExpenses(await r.spaces.listExpenses(joined.id));
        setView('split'); return; // a link-join lands straight in the group
      }
    } catch { /* spaces are best-effort; the personal ledger still loads */ }
    setView('home');
  }, [showToast]); // sharedText routing happens in Shell, so this callback stays stable

  const signOut = useCallback(async () => {
    await auth?.signOut(); vault.lock();
    setSession(null); setRepos(null); setExpenses([]); setBudgetState(EMPTY_BUDGET); setRecurring([]); setNeedsCurrency(false); setNeedsUnlock(false); setEditing(null);
    setSpaces([]); setCurrentSpace(null); setSpaceMembers([]); setSpaceExpenses([]); setAddTarget(null);
  }, [auth]);

  const addExpense = useCallback(async (e: Expense) => {
    if (!repos) return;
    if (e.spaceId) { await repos.spaces.upsertExpense(e); setSpaceExpenses((l) => [...l.filter((x) => x.id !== e.id), e]); return; }
    await repos.expenses.upsert(e); setExpenses((l) => [...l, e]);
  }, [repos]);
  const updateExpense = useCallback(async (e: Expense) => {
    if (!repos) return;
    if (e.spaceId) { await repos.spaces.upsertExpense(e); setSpaceExpenses((l) => l.map((x) => (x.id === e.id ? e : x))); return; }
    await repos.expenses.upsert(e); setExpenses((l) => l.map((x) => (x.id === e.id ? e : x)));
  }, [repos]);
  const deleteExpense = useCallback(async (id: string) => {
    if (!repos) return;
    const shared = spaceExpenses.find((x) => x.id === id);
    if (shared?.spaceId) {
      await repos.spaces.removeExpense(shared.spaceId, id); setSpaceExpenses((l) => l.filter((x) => x.id !== id));
      showToast('Deleted', async () => { await repos.spaces.upsertExpense(shared); setSpaceExpenses((l) => [...l, shared]); setToast(null); });
      return;
    }
    const victim = expenses.find((x) => x.id === id); if (!victim) return;
    await repos.expenses.remove(id); setExpenses((l) => l.filter((x) => x.id !== id));
    showToast('Deleted', async () => { await repos.expenses.upsert(victim); setExpenses((l) => [...l, victim]); setToast(null); });
  }, [repos, expenses, spaceExpenses, showToast]);
  const createSpace = useCallback(async (name: string) => {
    if (!repos || !session) throw new Error('Not signed in');
    const id = crypto.randomUUID();
    const raw = await Vault.generateSpaceKeyRaw();
    await vault.addSpaceKey(id, raw);
    const space: Space = { id, name };
    await repos.spaces.create(space, raw, session.name);
    setSpaces((l) => [...l, space]);
    setCurrentSpace(space); setSpaceMembers([{ userId: session.userId, name: session.name }]); setSpaceExpenses([]);
    return `${window.location.origin}/#join=${id}.${encodeURIComponent(raw)}`;
  }, [repos, session]);
  const switchSpace = useCallback(async (id: string | null) => {
    if (!id) { setCurrentSpace(null); setSpaceMembers([]); setSpaceExpenses([]); return; }
    if (!repos) return;
    const sp = spaces.find((x) => x.id === id); if (!sp) return;
    setCurrentSpace(sp);
    setSpaceMembers(await repos.spaces.members(id));
    setSpaceExpenses(await repos.spaces.listExpenses(id));
  }, [repos, spaces]);
  const reloadSpace = useCallback(async (id: string) => {
    if (!repos) return;
    setSpaceMembers(await repos.spaces.members(id));
    setSpaceExpenses(await repos.spaces.listExpenses(id));
  }, [repos]);
  const startAdd = useCallback((target: Space | null) => {
    setEditing(null); setAddTarget(target); setView('add'); window.scrollTo({ top: 0 });
  }, []);
  const inviteLink = useCallback((spaceId: string) => {
    const raw = vault.rawSpaceKey(spaceId);
    return raw ? `${window.location.origin}/#join=${spaceId}.${encodeURIComponent(raw)}` : null;
  }, []);
  const settleUp = useCallback(async (from: string, to: string, amount: number) => {
    if (!repos || !currentSpace) return;
    const now = new Date().toISOString();
    const e: Expense = {
      id: crypto.randomUUID(), amount, currency: homeCurrency(), category: 'Other', date: todayISO(),
      note: 'Settle up', source: 'manual', spaceId: currentSpace.id, settlement: { from, to }, createdAt: now, updatedAt: now,
    };
    await repos.spaces.upsertExpense(e); setSpaceExpenses((l) => [...l, e]);
    showToast('Marked as settled');
  }, [repos, currentSpace, showToast]);
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
    spaces, currentSpace, spaceMembers, spaceExpenses, addTarget, startAdd, createSpace, switchSpace, reloadSpace, inviteLink, settleUp,
    setView, startEdit: setEditing, onSignedIn, signOut, addExpense, updateExpense, deleteExpense, importExpenses, resetData, setBudget, addRecurring, updateRecurring, showToast,
  }), [ready, auth, session, needsUnlock, expenses, budget, recurring, needsCurrency, sharedText, clearShared, view, editing, toast, spaces, currentSpace, spaceMembers, spaceExpenses, addTarget, startAdd, createSpace, switchSpace, reloadSpace, inviteLink, settleUp, onSignedIn, signOut, addExpense, updateExpense, deleteExpense, importExpenses, resetData, setBudget, addRecurring, updateRecurring, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx); if (!v) throw new Error('useApp outside AppProvider'); return v;
}
