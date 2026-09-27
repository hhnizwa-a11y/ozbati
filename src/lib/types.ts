/**
 * نماذج البيانات الأساسية.
 * جميع المبالغ مخزنة بالبيسة كأعداد صحيحة (1 ر.ع = 1000 بيسة).
 */

export type Baisa = number;

/** نوع العملية: المصروف الفعلي، أو تحويل بين حساباتي (لا يُحتسب)، أو مبلغ مرسل لشخص آخر (يُحتسب ضمن المنصرف). */
export type TxKind = 'expense' | 'transfer_own' | 'transfer_person';

export interface Transaction {
  id: string;
  /** تاريخ العملية الفعلي YYYY-MM-DD */
  date: string;
  /** وقت العملية HH:mm (اختياري) */
  time: string | null;
  description: string;
  amount: Baisa;
  categoryId: string;
  carId: string | null;
  /** الشهر المالي (العزبة) الذي تنتمي إليه العملية، مستقل عن تاريخها */
  periodId: string;
  kind: TxKind;
  notes: string;
  /** عنوان مجموعة من رسالة بلا مبلغ، مثل «تجهيز الأطفال للمدرسة» */
  groupLabel: string | null;
  subscriptionId: string | null;
  source: 'manual' | 'whatsapp';
  rawText: string | null;
  /** بصمة لاكتشاف التكرار */
  fingerprint: string;
  createdAt: number;
  updatedAt: number;
}

export interface Period {
  id: string;
  name: string;
  year: number;
  /** 1..12 */
  month: number;
  startDate: string;
  endDate: string;
  /** الميزانية العامة للشهر، null = غير محددة */
  budget: Baisa | null;
  /** ميزانية كل تصنيف */
  categoryBudgets: Record<string, Baisa>;
  /** الدخل الاختياري للشهر */
  income: Baisa | null;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  keywords: string[];
  builtin: boolean;
  parentId: string | null;
  order: number;
}

export interface Car {
  id: string;
  name: string;
  /** أسماء بديلة تُكتب في واتساب، مثل «أي أس» */
  aliases: string[];
  plate: string;
  year: string;
  color: string;
  image: string | null;
  notes: string;
  createdAt: number;
}

export type Cycle = 'monthly' | 'yearly' | 'weekly';
export type SubStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: string;
  name: string;
  /** المبلغ المجدول، null = لم يُحدد بعد */
  amount: Baisa | null;
  cycle: Cycle;
  nextRenewal: string | null;
  status: SubStatus;
  categoryId: string;
  keywords: string[];
  remindDays: number;
  createdAt: number;
}

export interface Goal {
  id: string;
  name: string;
  type: 'monthly' | 'yearly';
  target: Baisa;
  saved: Baisa;
  year: number;
  month: number | null;
  createdAt: number;
}

/** قاعدة متعلمة من تصحيحات المستخدم */
export interface LearnedRule {
  key: string;
  categoryId: string;
  carId: string | null;
  count: number;
  updatedAt: number;
}

export interface Settings {
  id: 'app';
  userName: string;
  theme: 'system' | 'light' | 'dark';
  currentPeriodId: string | null;
  /** معامل اكتشاف القيم غير المعتادة */
  anomalyFactor: number;
  seeded: boolean;
  /** اكتملت شاشة الترحيب الأولى */
  onboarded?: boolean;
}

export interface BackupFile {
  app: 'ozbati';
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  periods: Period[];
  categories: Category[];
  cars: Car[];
  subscriptions: Subscription[];
  goals: Goal[];
  rules: LearnedRule[];
  settings: Settings;
}
