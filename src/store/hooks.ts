import { useMemo } from 'react';
import { computeDashboard, sortPeriods, type Dashboard } from '../lib/metrics';
import { useApp } from './AppContext';

/** لوحة مؤشرات شهر مالي محدد (أو الشهر الحالي) */
export function useDashboard(periodId?: string | null): Dashboard | null {
  const { periods, txs, categories, today, period } = useApp();
  const p = periodId ? periods.find((x) => x.id === periodId) ?? null : period;
  return useMemo(() => (p ? computeDashboard(p, txs, periods, categories, today) : null), [p, txs, periods, categories, today]);
}

export function useSortedPeriods() {
  const { periods } = useApp();
  return useMemo(() => sortPeriods(periods), [periods]);
}

export function useLookups() {
  const { categories, cars, periods, subs } = useApp();
  return useMemo(() => ({
    cat: new Map(categories.map((c) => [c.id, c])),
    car: new Map(cars.map((c) => [c.id, c])),
    period: new Map(periods.map((p) => [p.id, p])),
    sub: new Map(subs.map((s) => [s.id, s])),
  }), [categories, cars, periods, subs]);
}
