import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { learn } from '../lib/classifier';
import { openStore, type Store } from '../lib/db';
import { DEFAULT_CARS, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, DEFAULT_SUBSCRIPTIONS } from '../lib/defaults';
import { iso, lastDayOfMonth, periodLabel, todayISO } from '../lib/dates';
import { fingerprint } from '../lib/parser';
import type { BackupFile, Car, Category, Goal, LearnedRule, Period, Settings, Subscription, Transaction } from '../lib/types';

export interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
  action?: { label: string; run: () => void };
}

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** نص يجب كتابته للتأكيد (للعمليات الخطرة جدًا) */
  typeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
}

interface Data {
  txs: Transaction[];
  periods: Period[];
  categories: Category[];
  cars: Car[];
  subs: Subscription[];
  goals: Goal[];
  rules: LearnedRule[];
  settings: Settings;
}

export type TxDraft = Omit<Transaction, 'id' | 'fingerprint' | 'createdAt' | 'updatedAt'>;

interface Ctx extends Data {
  ready: boolean;
  persistent: boolean;
  today: string;
  period: Period | null;
  setPeriodId: (id: string) => void;
  // العمليات
  addTx: (d: TxDraft) => Promise<Transaction>;
  addTxs: (list: Transaction[]) => Promise<void>;
  updateTx: (id: string, patch: Partial<Transaction>) => Promise<void>;
  updateTxs: (ids: string[], patch: Partial<Transaction>) => Promise<void>;
  deleteTxs: (ids: string[]) => Promise<void>;
  duplicateTxs: (ids: string[]) => Promise<void>;
  learnRules: (items: { description: string; categoryId: string; carId: string | null }[]) => Promise<void>;
  forgetRule: (key: string) => Promise<void>;
  completeOnboarding: (o: { name: string; kids: string[]; cars: { name: string; aliases: string[] }[] }) => Promise<void>;
  // الأشهر المالية
  ensurePeriod: (year: number, month: number, opts?: Partial<Period>) => Promise<Period>;
  savePeriod: (p: Period) => Promise<void>;
  deletePeriod: (id: string, moveTo: string | null) => Promise<void>;
  // الجداول المساعدة
  saveCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  saveCar: (c: Car) => Promise<void>;
  deleteCar: (id: string) => Promise<void>;
  saveSub: (s: Subscription) => Promise<void>;
  deleteSub: (id: string) => Promise<void>;
  saveGoal: (g: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  // النسخ الاحتياطي
  makeBackup: () => BackupFile;
  restoreBackup: (b: BackupFile) => Promise<void>;
  clearAll: () => Promise<void>;
  // الواجهة
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
  confirm: ConfirmRequest | null;
  askConfirm: (r: ConfirmRequest) => void;
  closeConfirm: () => void;
  editor: { tx: Transaction | null; open: boolean };
  openEditor: (tx?: Transaction | null) => void;
  closeEditor: () => void;
  darkMode: boolean;
}

const AppCtx = createContext<Ctx | null>(null);

export const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function periodId(year: number, month: number) {
  return `p-${year}-${String(month).padStart(2, '0')}`;
}

export function newPeriod(year: number, month: number, opts: Partial<Period> = {}): Period {
  return {
    id: periodId(year, month),
    name: periodLabel(year, month),
    year, month,
    startDate: iso(year, month, 1),
    endDate: iso(year, month, lastDayOfMonth(year, month)),
    budget: null,
    categoryBudgets: {},
    income: null,
    createdAt: Date.now(),
    ...opts,
  };
}

const EMPTY: Data = { txs: [], periods: [], categories: [], cars: [], subs: [], goals: [], rules: [], settings: DEFAULT_SETTINGS };

export function AppProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<Store | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [editor, setEditor] = useState<{ tx: Transaction | null; open: boolean }>({ tx: null, open: false });
  const [today, setToday] = useState(todayISO());
  const dataRef = useRef(data);
  dataRef.current = data;

  const S = () => storeRef.current!;

  // التحميل الأول
  useEffect(() => {
    (async () => {
      const store = await openStore();
      storeRef.current = store;
      setPersistent(store.persistent);
      let [txs, periods, categories, cars, subs, goals, rules, settingsArr] = await Promise.all([
        store.getAll('transactions'), store.getAll('periods'), store.getAll('categories'), store.getAll('cars'),
        store.getAll('subscriptions'), store.getAll('goals'), store.getAll('rules'), store.getAll('settings'),
      ]);
      let settings = settingsArr[0] ?? { ...DEFAULT_SETTINGS };
      if (!settings.seeded) {
        const now = Date.now();
        categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
        cars = DEFAULT_CARS.map((c) => ({ ...c, createdAt: now }));
        subs = DEFAULT_SUBSCRIPTIONS.map((s) => ({ ...s, createdAt: now }));
        const t = todayISO();
        const [y, m] = t.split('-').map(Number);
        const p = newPeriod(y, m);
        periods = [p];
        settings = { ...DEFAULT_SETTINGS, seeded: true, currentPeriodId: p.id };
        await Promise.all([
          store.putMany('categories', categories), store.putMany('cars', cars), store.putMany('subscriptions', subs),
          store.putMany('periods', periods), store.put('settings', settings),
        ]);
      }
      if (settings.onboarded === undefined) {
        // المستخدمون الحاليون قبل إضافة شاشة الترحيب لا يرونها مرة أخرى
        settings = { ...settings, onboarded: !!settings.userName };
        await store.put('settings', settings);
      }
      if (!settings.currentPeriodId || !periods.some((p) => p.id === settings.currentPeriodId)) {
        settings = { ...settings, currentPeriodId: periods[periods.length - 1]?.id ?? null };
      }
      setData({ txs, periods, categories: categories.sort((a, b) => a.order - b.order), cars, subs, goals, rules, settings });
      setReady(true);
    })();
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'success', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { id, text, tone, action }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), action ? 7000 : 3500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const patch = (fn: (d: Data) => Data) => setData((d) => fn(d));

  const stamp = (t: Omit<Transaction, 'fingerprint'> & { fingerprint?: string }): Transaction => ({
    ...t,
    fingerprint: fingerprint({ date: t.date, time: t.time, description: t.description, amount: t.amount }),
  });

  const addTx = useCallback(async (d: TxDraft) => {
    const now = Date.now();
    const tx = stamp({ ...d, id: uid('tx'), createdAt: now, updatedAt: now });
    await S().put('transactions', tx);
    patch((s) => ({ ...s, txs: [...s.txs, tx] }));
    return tx;
  }, []);

  const addTxs = useCallback(async (list: Transaction[]) => {
    await S().putMany('transactions', list);
    patch((s) => ({ ...s, txs: [...s.txs, ...list] }));
  }, []);

  const updateTxs = useCallback(async (ids: string[], p: Partial<Transaction>) => {
    const set = new Set(ids);
    const now = Date.now();
    const changed = dataRef.current.txs.filter((t) => set.has(t.id)).map((t) => stamp({ ...t, ...p, updatedAt: now }));
    await S().putMany('transactions', changed);
    const map = new Map(changed.map((t) => [t.id, t]));
    patch((s) => ({ ...s, txs: s.txs.map((t) => map.get(t.id) ?? t) }));
  }, []);

  const updateTx = useCallback((id: string, p: Partial<Transaction>) => updateTxs([id], p), [updateTxs]);

  const deleteTxs = useCallback(async (ids: string[]) => {
    const set = new Set(ids);
    const removed = dataRef.current.txs.filter((t) => set.has(t.id));
    await S().deleteMany('transactions', ids);
    patch((s) => ({ ...s, txs: s.txs.filter((t) => !set.has(t.id)) }));
    toast(removed.length === 1 ? `حُذفت «${removed[0].description}»` : `حُذفت ${removed.length} عمليات`, 'info', {
      label: 'تراجع',
      run: async () => {
        await S().putMany('transactions', removed);
        patch((s) => ({ ...s, txs: [...s.txs, ...removed] }));
        toast('تمت استعادة المحذوف');
      },
    });
  }, [toast]);

  const duplicateTxs = useCallback(async (ids: string[]) => {
    const now = Date.now();
    const copies = dataRef.current.txs.filter((t) => ids.includes(t.id)).map((t) => stamp({ ...t, id: uid('tx'), notes: t.notes ? `${t.notes} (نسخة)` : 'نسخة', source: 'manual', createdAt: now, updatedAt: now, time: t.time }));
    // البصمة تختلف بإضافة لاحقة الوقت حتى لا تُعتبر النسخة مكررة عند الاستيراد
    const list = copies.map((c) => ({ ...c, fingerprint: `${c.fingerprint}#${c.id}` }));
    await S().putMany('transactions', list);
    patch((s) => ({ ...s, txs: [...s.txs, ...list] }));
    toast(list.length === 1 ? 'تم نسخ العملية' : `تم نسخ ${list.length} عمليات`);
  }, [toast]);

  const learnRules = useCallback(async (items: { description: string; categoryId: string; carId: string | null }[]) => {
    if (!items.length) return;
    let rules = [...dataRef.current.rules];
    const changed: LearnedRule[] = [];
    for (const it of items) {
      const r = learn(rules, it.description, it.categoryId, it.carId);
      rules = [...rules.filter((x) => x.key !== r.key), r];
      changed.push(r);
    }
    await S().putMany('rules', changed);
    patch((s) => ({ ...s, rules }));
  }, []);

  const forgetRule = useCallback(async (key: string) => {
    await S().delete('rules', key);
    patch((s) => ({ ...s, rules: s.rules.filter((r) => r.key !== key) }));
  }, []);

  const savePeriod = useCallback(async (p: Period) => {
    await S().put('periods', p);
    patch((s) => ({ ...s, periods: s.periods.some((x) => x.id === p.id) ? s.periods.map((x) => (x.id === p.id ? p : x)) : [...s.periods, p] }));
  }, []);

  const saveSettings = useCallback(async (p: Partial<Settings>) => {
    const next = { ...dataRef.current.settings, ...p };
    await S().put('settings', next);
    patch((s) => ({ ...s, settings: next }));
  }, []);

  const ensurePeriod = useCallback(async (year: number, month: number, opts: Partial<Period> = {}) => {
    const id = periodId(year, month);
    const existing = dataRef.current.periods.find((p) => p.id === id);
    if (existing) {
      if (Object.keys(opts).length) {
        const next = { ...existing, ...opts, id };
        await savePeriod(next);
        return next;
      }
      return existing;
    }
    const p = newPeriod(year, month, opts);
    await savePeriod(p);
    return p;
  }, [savePeriod]);

  const deletePeriod = useCallback(async (id: string, moveTo: string | null) => {
    const affected = dataRef.current.txs.filter((t) => t.periodId === id);
    if (affected.length) {
      if (moveTo) await updateTxs(affected.map((t) => t.id), { periodId: moveTo });
      else {
        await S().deleteMany('transactions', affected.map((t) => t.id));
        patch((s) => ({ ...s, txs: s.txs.filter((t) => t.periodId !== id) }));
      }
    }
    await S().delete('periods', id);
    const remaining = dataRef.current.periods.filter((p) => p.id !== id);
    patch((s) => ({ ...s, periods: s.periods.filter((p) => p.id !== id) }));
    if (dataRef.current.settings.currentPeriodId === id) await saveSettings({ currentPeriodId: moveTo ?? remaining[remaining.length - 1]?.id ?? null });
  }, [updateTxs, saveSettings]);

  const upsert = <K extends 'categories' | 'cars' | 'subs' | 'goals'>(key: K, table: 'categories' | 'cars' | 'subscriptions' | 'goals') =>
    async (v: Data[K][number]) => {
      await S().put(table as any, v as any);
      patch((s) => {
        const arr = s[key] as any[];
        const next = arr.some((x) => x.id === (v as any).id) ? arr.map((x) => (x.id === (v as any).id ? v : x)) : [...arr, v];
        return { ...s, [key]: key === 'categories' ? next.sort((a: Category, b: Category) => a.order - b.order) : next };
      });
    };

  const saveCategory = useCallback(upsert('categories', 'categories'), []);
  const saveCar = useCallback(upsert('cars', 'cars'), []);
  const saveSub = useCallback(upsert('subs', 'subscriptions'), []);
  const saveGoal = useCallback(upsert('goals', 'goals'), []);

  const deleteCategory = useCallback(async (id: string) => {
    const d = dataRef.current;
    const children = d.categories.filter((c) => c.parentId === id).map((c) => c.id);
    const ids = [id, ...children];
    const cat = d.categories.find((c) => c.id === id);
    const fallback = cat?.parentId ?? 'other';
    const affected = d.txs.filter((t) => ids.includes(t.categoryId)).map((t) => t.id);
    if (affected.length) await updateTxs(affected, { categoryId: fallback });
    await S().deleteMany('categories', ids);
    const deadRules = d.rules.filter((r) => ids.includes(r.categoryId)).map((r) => r.key);
    await S().deleteMany('rules', deadRules);
    patch((s) => ({ ...s, categories: s.categories.filter((c) => !ids.includes(c.id)), rules: s.rules.filter((r) => !deadRules.includes(r.key)) }));
  }, [updateTxs]);

  const deleteCar = useCallback(async (id: string) => {
    const affected = dataRef.current.txs.filter((t) => t.carId === id).map((t) => t.id);
    if (affected.length) await updateTxs(affected, { carId: null });
    await S().delete('cars', id);
    patch((s) => ({ ...s, cars: s.cars.filter((c) => c.id !== id) }));
  }, [updateTxs]);

  const deleteSub = useCallback(async (id: string) => {
    const affected = dataRef.current.txs.filter((t) => t.subscriptionId === id).map((t) => t.id);
    if (affected.length) await updateTxs(affected, { subscriptionId: null });
    await S().delete('subscriptions', id);
    patch((s) => ({ ...s, subs: s.subs.filter((c) => c.id !== id) }));
  }, [updateTxs]);

  const deleteGoal = useCallback(async (id: string) => {
    await S().delete('goals', id);
    patch((s) => ({ ...s, goals: s.goals.filter((c) => c.id !== id) }));
  }, []);

  const makeBackup = useCallback((): BackupFile => {
    const d = dataRef.current;
    return {
      app: 'ozbati', version: 1, exportedAt: new Date().toISOString(),
      transactions: d.txs, periods: d.periods, categories: d.categories, cars: d.cars,
      subscriptions: d.subs, goals: d.goals, rules: d.rules, settings: d.settings,
    };
  }, []);

  const restoreBackup = useCallback(async (b: BackupFile) => {
    const settings: Settings = { ...DEFAULT_SETTINGS, ...(b.settings ?? {}), id: 'app', seeded: true };
    await S().replaceAll({
      transactions: b.transactions, periods: b.periods, categories: b.categories, cars: b.cars,
      subscriptions: b.subscriptions, goals: b.goals, rules: b.rules, settings: [settings],
    });
    setData({ txs: b.transactions, periods: b.periods, categories: [...b.categories].sort((a, c) => a.order - c.order), cars: b.cars, subs: b.subscriptions, goals: b.goals, rules: b.rules, settings });
  }, []);

  const clearAll = useCallback(async () => {
    const now = Date.now();
    const [y, m] = todayISO().split('-').map(Number);
    const p = newPeriod(y, m);
    const settings: Settings = { ...dataRef.current.settings, seeded: true, currentPeriodId: p.id };
    const fresh = {
      transactions: [], periods: [p], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      cars: DEFAULT_CARS.map((c) => ({ ...c, createdAt: now })), subscriptions: DEFAULT_SUBSCRIPTIONS.map((s) => ({ ...s, createdAt: now })),
      goals: [], rules: [], settings: [settings],
    };
    await S().replaceAll(fresh);
    setData({ txs: [], periods: [p], categories: fresh.categories, cars: fresh.cars, subs: fresh.subscriptions, goals: [], rules: [], settings });
  }, []);

  const completeOnboarding = useCallback(async (o: { name: string; kids: string[]; cars: { name: string; aliases: string[] }[] }) => {
    const d = dataRef.current;
    if (o.kids.length) {
      const edu = d.categories.find((c) => c.id === 'education');
      if (edu) await saveCategory({ ...edu, keywords: Array.from(new Set([...edu.keywords, ...o.kids])) });
    }
    for (const c of o.cars) {
      await saveCar({ id: uid('car'), name: c.name, aliases: c.aliases, plate: '', year: '', color: '', image: null, notes: '', createdAt: Date.now() });
    }
    await saveSettings({ userName: o.name.trim(), onboarded: true });
  }, [saveCategory, saveCar, saveSettings]);

  const setPeriodId = useCallback((id: string) => { void saveSettings({ currentPeriodId: id }); }, [saveSettings]);

  // الوضع الليلي
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const host = document.documentElement.getAttribute('data-theme');
      setSystemDark(host ? host === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    };
    read();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq?.removeEventListener?.('change', read); mo.disconnect(); };
  }, []);
  const darkMode = data.settings.theme === 'dark' || (data.settings.theme === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const period = useMemo(() => data.periods.find((p) => p.id === data.settings.currentPeriodId) ?? null, [data.periods, data.settings.currentPeriodId]);

  const value: Ctx = {
    ...data, ready, persistent, today, period, setPeriodId,
    addTx, addTxs, updateTx, updateTxs, deleteTxs, duplicateTxs, learnRules, forgetRule, completeOnboarding,
    ensurePeriod, savePeriod, deletePeriod,
    saveCategory, deleteCategory, saveCar, deleteCar, saveSub, deleteSub, saveGoal, deleteGoal, saveSettings,
    makeBackup, restoreBackup, clearAll,
    toasts, toast, dismissToast,
    confirm, askConfirm: setConfirm, closeConfirm: () => setConfirm(null),
    editor, openEditor: (tx = null) => setEditor({ tx, open: true }), closeEditor: () => setEditor({ tx: null, open: false }),
    darkMode,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
