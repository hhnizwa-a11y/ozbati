/**
 * طبقة التخزين المحلي عبر IndexedDB.
 * الجداول: transactions, periods, categories, cars, subscriptions, goals, rules, settings
 * العلاقات: transaction.periodId → periods.id ، categoryId → categories.id ، carId → cars.id ، subscriptionId → subscriptions.id
 * إذا تعذر فتح IndexedDB (نافذة خاصة أو تخزين محظور) يعمل التطبيق من الذاكرة مع تنبيه واضح.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Car, Category, Goal, LearnedRule, Period, Settings, Subscription, Transaction } from './types';

export interface Tables {
  transactions: Transaction;
  periods: Period;
  categories: Category;
  cars: Car;
  subscriptions: Subscription;
  goals: Goal;
  rules: LearnedRule;
  settings: Settings;
}
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['transactions', 'periods', 'categories', 'cars', 'subscriptions', 'goals', 'rules', 'settings'];

interface OzbatiDB extends DBSchema {
  transactions: { key: string; value: Transaction; indexes: { byPeriod: string; byDate: string; byFingerprint: string; byCategory: string; byCar: string } };
  periods: { key: string; value: Period; indexes: { byYearMonth: [number, number] } };
  categories: { key: string; value: Category };
  cars: { key: string; value: Car };
  subscriptions: { key: string; value: Subscription };
  goals: { key: string; value: Goal };
  rules: { key: string; value: LearnedRule };
  settings: { key: string; value: Settings };
}

const DB_NAME = 'ozbati';
const DB_VERSION = 1;

export interface Store {
  persistent: boolean;
  getAll<T extends TableName>(t: T): Promise<Tables[T][]>;
  put<T extends TableName>(t: T, v: Tables[T]): Promise<void>;
  putMany<T extends TableName>(t: T, v: Tables[T][]): Promise<void>;
  delete(t: TableName, key: string): Promise<void>;
  deleteMany(t: TableName, keys: string[]): Promise<void>;
  clear(t: TableName): Promise<void>;
  /** استبدال كامل لكل الجداول في معاملة واحدة (للاستعادة من نسخة احتياطية) */
  replaceAll(data: { [K in TableName]: Tables[K][] }): Promise<void>;
}

const keyOf = (t: TableName, v: any): string => (t === 'rules' ? v.key : v.id);

async function openIdb(): Promise<IDBPDatabase<OzbatiDB>> {
  return openDB<OzbatiDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const tx = db.createObjectStore('transactions', { keyPath: 'id' });
      tx.createIndex('byPeriod', 'periodId');
      tx.createIndex('byDate', 'date');
      tx.createIndex('byFingerprint', 'fingerprint');
      tx.createIndex('byCategory', 'categoryId');
      tx.createIndex('byCar', 'carId');
      const p = db.createObjectStore('periods', { keyPath: 'id' });
      p.createIndex('byYearMonth', ['year', 'month']);
      db.createObjectStore('categories', { keyPath: 'id' });
      db.createObjectStore('cars', { keyPath: 'id' });
      db.createObjectStore('subscriptions', { keyPath: 'id' });
      db.createObjectStore('goals', { keyPath: 'id' });
      db.createObjectStore('rules', { keyPath: 'key' });
      db.createObjectStore('settings', { keyPath: 'id' });
    },
  });
}

function idbStore(db: IDBPDatabase<OzbatiDB>): Store {
  return {
    persistent: true,
    getAll: (t) => db.getAll(t as any) as any,
    put: async (t, v) => { await db.put(t as any, v as any); },
    putMany: async (t, vs) => {
      const tx = db.transaction(t as any, 'readwrite');
      await Promise.all([...vs.map((v) => tx.store.put(v as any)), tx.done]);
    },
    delete: async (t, k) => { await db.delete(t as any, k); },
    deleteMany: async (t, ks) => {
      const tx = db.transaction(t as any, 'readwrite');
      await Promise.all([...ks.map((k) => tx.store.delete(k)), tx.done]);
    },
    clear: async (t) => { await db.clear(t as any); },
    replaceAll: async (data) => {
      const tx = db.transaction(TABLES as any, 'readwrite');
      const ops: Promise<unknown>[] = [];
      for (const t of TABLES) {
        const s = tx.objectStore(t as any);
        ops.push(s.clear());
        for (const v of data[t] as any[]) ops.push(s.put(v));
      }
      await Promise.all([...ops, tx.done]);
    },
  };
}

export function memoryStore(): Store {
  const mem = new Map<TableName, Map<string, any>>(TABLES.map((t) => [t, new Map()]));
  const clone = <V>(v: V): V => JSON.parse(JSON.stringify(v));
  return {
    persistent: false,
    getAll: async (t) => [...mem.get(t)!.values()].map(clone),
    put: async (t, v) => { mem.get(t)!.set(keyOf(t, v), clone(v)); },
    putMany: async (t, vs) => { for (const v of vs) mem.get(t)!.set(keyOf(t, v), clone(v)); },
    delete: async (t, k) => { mem.get(t)!.delete(k); },
    deleteMany: async (t, ks) => { for (const k of ks) mem.get(t)!.delete(k); },
    clear: async (t) => { mem.get(t)!.clear(); },
    replaceAll: async (data) => {
      for (const t of TABLES) {
        const m = mem.get(t)!;
        m.clear();
        for (const v of data[t] as any[]) m.set(keyOf(t, v), clone(v));
      }
    },
  };
}

export async function openStore(): Promise<Store> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no idb');
    const db = await Promise.race([
      openIdb(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    // طلب تخزين دائم من المتصفح إن أمكن
    try { await navigator.storage?.persist?.(); } catch { /* اختياري */ }
    return idbStore(db);
  } catch {
    return memoryStore();
  }
}
