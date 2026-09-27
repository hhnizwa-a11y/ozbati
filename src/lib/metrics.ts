/**
 * الدوال المركزية لحساب المؤشرات.
 * كل البطاقات والرسومات والتقارير والمحلل المالي تعتمد على هذه الدوال فقط،
 * لضمان أن الرقم نفسه يظهر في كل مكان.
 */
import { rootCategoryId } from './classifier';
import { CAT } from './defaults';
import { daysBetween, eachDay, MONTHS_AR } from './dates';
import { pct, sumBaisa } from './money';
import { containsTerm, tokens } from './text';
import type { Baisa, Car, Category, Period, Subscription, Transaction } from './types';

/** هل تدخل العملية في إجمالي المصاريف؟ التحويل بين حساباتي لا يُحتسب. */
export const countsAsSpending = (t: Transaction) => t.kind !== 'transfer_own';

export function spendingOf(txs: Transaction[], periodId: string): Transaction[] {
  return txs.filter((t) => t.periodId === periodId && countsAsSpending(t));
}

export function totalOf(txs: Transaction[]): Baisa {
  return sumBaisa(txs.map((t) => t.amount));
}

export function sortPeriods(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => a.year - b.year || a.month - b.month || a.startDate.localeCompare(b.startDate));
}

export function previousPeriod(period: Period, periods: Period[]): Period | null {
  const sorted = sortPeriods(periods);
  const i = sorted.findIndex((p) => p.id === period.id);
  return i > 0 ? sorted[i - 1] : null;
}

export interface Timing {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  status: 'upcoming' | 'active' | 'closed';
}

export function periodTiming(period: Period, today: string): Timing {
  const totalDays = daysBetween(period.startDate, period.endDate) + 1;
  if (today < period.startDate) return { totalDays, elapsedDays: 0, remainingDays: totalDays, status: 'upcoming' };
  if (today > period.endDate) return { totalDays, elapsedDays: totalDays, remainingDays: 0, status: 'closed' };
  const elapsedDays = daysBetween(period.startDate, today) + 1;
  return { totalDays, elapsedDays, remainingDays: totalDays - elapsedDays, status: 'active' };
}

export interface CategoryTotal {
  id: string;
  name: string;
  color: string;
  icon: string;
  total: Baisa;
  count: number;
  share: number | null;
  budget: Baisa | null;
  used: number | null;
}

export function byCategory(txs: Transaction[], categories: Category[], period?: Period | null): CategoryTotal[] {
  const map = new Map<string, { total: Baisa; count: number }>();
  for (const t of txs) {
    const id = rootCategoryId(t.categoryId, categories);
    const e = map.get(id) ?? { total: 0, count: 0 };
    e.total += t.amount;
    e.count += 1;
    map.set(id, e);
  }
  const grand = totalOf(txs);
  const roots = categories.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
  const out: CategoryTotal[] = roots.map((c) => {
    const e = map.get(c.id) ?? { total: 0, count: 0 };
    const budget = period?.categoryBudgets?.[c.id] ?? null;
    return {
      id: c.id, name: c.name, color: c.color, icon: c.icon,
      total: e.total, count: e.count,
      share: pct(e.total, grand),
      budget: budget && budget > 0 ? budget : null,
      used: budget && budget > 0 ? pct(e.total, budget) : null,
    };
  });
  // عمليات بتصنيف محذوف تظهر ضمن «أخرى»
  const known = new Set(roots.map((r) => r.id));
  let orphan = 0, orphanCount = 0;
  for (const [id, e] of map) if (!known.has(id)) { orphan += e.total; orphanCount += e.count; }
  if (orphan) {
    const other = out.find((o) => o.id === CAT.other);
    if (other) { other.total += orphan; other.count += orphanCount; other.share = pct(other.total, grand); }
  }
  return out.sort((a, b) => b.total - a.total);
}

export function dailySeries(txs: Transaction[], period: Period): { date: string; total: Baisa; count: number }[] {
  const map = new Map<string, { total: Baisa; count: number }>();
  for (const t of txs) {
    const e = map.get(t.date) ?? { total: 0, count: 0 };
    e.total += t.amount; e.count++;
    map.set(t.date, e);
  }
  const dates = txs.map((t) => t.date).sort();
  const start = dates[0] && dates[0] < period.startDate ? dates[0] : period.startDate;
  const end = dates[dates.length - 1] && dates[dates.length - 1] > period.endDate ? dates[dates.length - 1] : period.endDate;
  return eachDay(start, end).map((d) => ({ date: d, total: map.get(d)?.total ?? 0, count: map.get(d)?.count ?? 0 }));
}

export interface Dashboard {
  period: Period;
  timing: Timing;
  txs: Transaction[];
  total: Baisa;
  count: number;
  budget: Baisa | null;
  remaining: Baisa | null;
  usedPct: number | null;
  avgDaily: Baisa | null;
  topDay: { date: string; total: Baisa; count: number } | null;
  largest: Transaction | null;
  prev: { period: Period; total: Baisa; diff: Baisa; diffPct: number | null } | null;
  forecast: Baisa | null;
  categories: CategoryTotal[];
  daily: { date: string; total: Baisa; count: number }[];
  top10: Transaction[];
  transfersOwn: Baisa;
  income: Baisa | null;
  savings: Baisa | null;
}

export function computeDashboard(period: Period, allTx: Transaction[], periods: Period[], categories: Category[], today: string): Dashboard {
  const txs = spendingOf(allTx, period.id);
  const total = totalOf(txs);
  const timing = periodTiming(period, today);
  const budget = period.budget && period.budget > 0 ? period.budget : null;
  const daily = dailySeries(txs, period);
  const topDay = daily.reduce<Dashboard['topDay']>((best, d) => (d.total > 0 && (!best || d.total > best.total) ? d : best), null);
  const largest = txs.reduce<Transaction | null>((b, t) => (!b || t.amount > b.amount ? t : b), null);
  const prevP = previousPeriod(period, periods);
  let prev: Dashboard['prev'] = null;
  if (prevP) {
    const prevTotal = totalOf(spendingOf(allTx, prevP.id));
    if (prevTotal > 0) prev = { period: prevP, total: prevTotal, diff: total - prevTotal, diffPct: pct(total - prevTotal, prevTotal) };
  }
  const avgDaily = timing.elapsedDays > 0 && txs.length ? Math.round(total / timing.elapsedDays) : null;
  let forecast: Baisa | null = null;
  if (timing.status === 'active' && avgDaily !== null) forecast = total + avgDaily * timing.remainingDays;
  else if (timing.status === 'closed') forecast = total;
  const income = period.income && period.income > 0 ? period.income : null;
  return {
    period, timing, txs, total, count: txs.length, budget,
    remaining: budget !== null ? budget - total : null,
    usedPct: budget !== null ? pct(total, budget) : null,
    avgDaily, topDay, largest, prev, forecast,
    categories: byCategory(txs, categories, period),
    daily,
    top10: [...txs].sort((a, b) => b.amount - a.amount).slice(0, 10),
    transfersOwn: totalOf(allTx.filter((t) => t.periodId === period.id && t.kind === 'transfer_own')),
    income,
    savings: income !== null ? income - total : null,
  };
}

export function shortPeriodLabel(p: Period): string {
  return `${MONTHS_AR[p.month - 1]} ${String(p.year).slice(2)}`;
}

export function monthlyComparison(periods: Period[], allTx: Transaction[], categories: Category[], categoryId?: string | null) {
  return sortPeriods(periods).map((p) => {
    let txs = spendingOf(allTx, p.id);
    if (categoryId) txs = txs.filter((t) => rootCategoryId(t.categoryId, categories) === categoryId);
    return { periodId: p.id, label: shortPeriodLabel(p), name: p.name, total: totalOf(txs), count: txs.length, budget: p.budget };
  });
}

/** المصاريف المتكررة: الفواتير والاشتراكات عبر الأشهر */
export function recurringSeries(periods: Period[], allTx: Transaction[], categories: Category[]) {
  return sortPeriods(periods).map((p) => {
    const txs = spendingOf(allTx, p.id);
    const of = (id: string) => totalOf(txs.filter((t) => rootCategoryId(t.categoryId, categories) === id));
    return { periodId: p.id, label: shortPeriodLabel(p), bills: of(CAT.home), subscriptions: of(CAT.subscriptions) };
  });
}

const FUEL_TERMS = ['بترول', 'وقود', 'بنزين', 'ديزل', 'تعبئة'];
export const isFuel = (t: Transaction) => FUEL_TERMS.some((k) => containsTerm(tokens(t.description), k));

export function isCarTx(t: Transaction, categories: Category[]) {
  return rootCategoryId(t.categoryId, categories) === CAT.cars || !!t.carId;
}

export interface CarSummary {
  carId: string | null;
  name: string;
  fuel: Baisa;
  maintenance: Baisa;
  total: Baisa;
  count: number;
}

export function carSummaries(txs: Transaction[], cars: Car[], categories: Category[]): CarSummary[] {
  const carTx = txs.filter((t) => countsAsSpending(t) && isCarTx(t, categories));
  const rows: CarSummary[] = [...cars.map((c) => ({ carId: c.id as string | null, name: c.name })), { carId: null, name: 'غير محددة' }].map(({ carId, name }) => {
    const list = carTx.filter((t) => (t.carId ?? null) === carId);
    const fuel = totalOf(list.filter(isFuel));
    const total = totalOf(list);
    return { carId, name, fuel, maintenance: total - fuel, total, count: list.length };
  });
  return rows.filter((r) => r.carId !== null || r.count > 0);
}

export function carMonthly(periods: Period[], allTx: Transaction[], cars: Car[], categories: Category[]) {
  return sortPeriods(periods).map((p) => {
    const txs = spendingOf(allTx, p.id).filter((t) => isCarTx(t, categories));
    const row: Record<string, string | number> = { label: shortPeriodLabel(p) };
    for (const c of cars) row[c.id] = totalOf(txs.filter((t) => t.carId === c.id));
    row['none'] = totalOf(txs.filter((t) => !t.carId));
    return row;
  });
}

export interface SubscriptionStatus {
  sub: Subscription;
  paidInPeriod: Baisa;
  payments: Transaction[];
  lastPayment: Transaction | null;
  daysToRenewal: number | null;
  dueSoon: boolean;
  monthlyEquivalent: Baisa | null;
}

export function subscriptionStatuses(subs: Subscription[], allTx: Transaction[], periodId: string | null, today: string): SubscriptionStatus[] {
  return subs.map((sub) => {
    const payments = allTx.filter((t) => t.subscriptionId === sub.id && countsAsSpending(t)).sort((a, b) => b.date.localeCompare(a.date));
    const inPeriod = periodId ? payments.filter((t) => t.periodId === periodId) : [];
    const daysToRenewal = sub.nextRenewal ? daysBetween(today, sub.nextRenewal) : null;
    const monthlyEquivalent = sub.amount === null ? null : sub.cycle === 'monthly' ? sub.amount : sub.cycle === 'yearly' ? Math.round(sub.amount / 12) : Math.round((sub.amount * 52) / 12);
    return {
      sub,
      paidInPeriod: totalOf(inPeriod),
      payments,
      lastPayment: payments[0] ?? null,
      daysToRenewal,
      dueSoon: sub.status === 'active' && daysToRenewal !== null && daysToRenewal >= 0 && daysToRenewal <= sub.remindDays,
      monthlyEquivalent: sub.status === 'active' ? monthlyEquivalent : null,
    };
  });
}

export type BudgetState = 'ok' | 'warn' | 'over' | 'none';
export function budgetState(used: number | null): BudgetState {
  if (used === null) return 'none';
  if (used > 100) return 'over';
  if (used >= 80) return 'warn';
  return 'ok';
}
