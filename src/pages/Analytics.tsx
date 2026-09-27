import { useMemo, useState } from 'react';
import { BudgetVsSpent, CategoryDonut, DailyChart, MonthlyBars, RecurringChart, TopTransactions, TwoMonthCompare } from '../components/charts';
import { Card, Money, PageHeader } from '../components/ui';
import { rootCategoryId } from '../lib/classifier';
import { formatDateAr } from '../lib/dates';
import { byCategory, dailySeries, monthlyComparison, recurringSeries, spendingOf, totalOf } from '../lib/metrics';
import { formatOMR, pct } from '../lib/money';
import type { Transaction } from '../lib/types';
import { useApp } from '../store/AppContext';
import { useDashboard, useSortedPeriods } from '../store/hooks';

export function Analytics() {
  const app = useApp();
  const { txs, categories, periods, openEditor } = app;
  const sorted = useSortedPeriods();
  const [pid, setPid] = useState(app.period?.id ?? '');
  const [catF, setCatF] = useState('');
  const [selCat, setSelCat] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const d = useDashboard(pid);
  const [cmpA, setCmpA] = useState(() => sorted[sorted.length - 2]?.id ?? sorted[0]?.id ?? '');
  const [cmpB, setCmpB] = useState(() => sorted[sorted.length - 1]?.id ?? '');

  const filtered = useMemo(() => (d ? (catF ? d.txs.filter((t) => rootCategoryId(t.categoryId, categories) === catF) : d.txs) : []), [d, catF, categories]);
  const daily = useMemo(() => (d ? dailySeries(filtered, d.period) : []), [filtered, d]);
  const monthly = useMemo(() => monthlyComparison(periods, txs, categories, catF || null), [periods, txs, categories, catF]);
  const recurring = useMemo(() => recurringSeries(periods, txs, categories), [periods, txs, categories]);

  const compare = useMemo(() => {
    const a = byCategory(spendingOf(txs, cmpA), categories);
    const b = byCategory(spendingOf(txs, cmpB), categories);
    return categories.filter((c) => !c.parentId).map((c) => ({ name: c.name, a: a.find((x) => x.id === c.id)?.total ?? 0, b: b.find((x) => x.id === c.id)?.total ?? 0 })).filter((r) => r.a || r.b);
  }, [txs, cmpA, cmpB, categories]);
  const pa = periods.find((p) => p.id === cmpA), pb = periods.find((p) => p.id === cmpB);
  const ta = totalOf(spendingOf(txs, cmpA)), tb = totalOf(spendingOf(txs, cmpB));

  if (!d) return null;
  const fTotal = totalOf(filtered);
  const fAvg = d.timing.elapsedDays && filtered.length ? Math.round(fTotal / d.timing.elapsedDays) : null;
  const top10 = [...filtered].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const catName = categories.find((c) => c.id === catF)?.name;
  const hasBudgets = d.categories.some((c) => c.budget !== null);

  return (
    <div className="space-y-4">
      <PageHeader title="التحليل المالي" subtitle={catF ? `تصنيف ${catName}: ${formatOMR(fTotal)} (${pct(fTotal, d.total) ?? 0}% من الإجمالي)` : `${d.period.name}: ${formatOMR(d.total)} في ${d.count} عملية`} />
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <select aria-label="الشهر المالي" className="input h-10 w-auto text-sm" value={pid} onChange={(e) => setPid(e.target.value)}>
          {sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="التصنيف" className="input h-10 w-auto text-sm" value={catF} onChange={(e) => { setCatF(e.target.value); setSelCat(null); }}>
          <option value="">كل التصنيفات</option>
          {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-xs text-muted ms-auto">{formatDateAr(d.period.startDate)} ← {formatDateAr(d.period.endDate)}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="1 · توزيع المصاريف" action={<span className="text-[11px] text-muted">اضغط قسمًا للتفاصيل</span>}>
          <CategoryDonut data={d.categories} total={d.total} selected={selCat ?? (catF || null)} onSelect={(id) => { setSelCat(id); }} height={220} />
          {selCat && (
            <ul className="mt-3 border-t border-line pt-2 max-h-52 overflow-y-auto scroll-thin divide-y divide-line">
              {d.txs.filter((t) => rootCategoryId(t.categoryId, categories) === selCat).sort((a, b) => b.amount - a.amount).map((t) => (
                <li key={t.id}><button className="w-full flex gap-3 py-1.5 text-sm hover:bg-sunk/60 rounded px-1" onClick={() => openEditor(t)}><span className="flex-1 text-start truncate">{t.description}</span><span className="text-[11px] text-muted">{formatDateAr(t.date, false)}</span><Money value={t.amount} unit={false} className="w-16 text-left" /></button></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`2 · المصاريف اليومية${catName ? ` · ${catName}` : ''}`} action={<span className="text-[11px] text-muted">اضغط يومًا لعملياته</span>}>
          <DailyChart data={daily} avg={fAvg} height={260} onPick={(date) => setDay(date)} />
          <DayList date={day} txs={filtered} onClose={() => setDay(null)} />
        </Card>
        <Card title={`3 · مقارنة الأشهر${catName ? ` · ${catName}` : ''}`}>
          <MonthlyBars data={monthly} currentId={pid} onPick={setPid} />
        </Card>
        <Card title="4 · الميزانية مقابل المصروف">
          {!hasBudgets && <p className="text-xs text-muted mb-2">لم تحدد ميزانيات للتصنيفات بعد؛ يظهر المصروف فقط. حددها من صفحة الميزانيات.</p>}
          <BudgetVsSpent data={d.categories} />
        </Card>
        <Card title={`5 · أعلى 10 مصاريف${catName ? ` · ${catName}` : ''}`}>
          <TopTransactions txs={top10} categories={categories} onPick={(t) => openEditor(t)} />
        </Card>
        <Card title="6 · المصاريف المتكررة" action={<span className="text-[11px] text-muted">الفواتير والاشتراكات عبر الأشهر</span>}>
          <RecurringChart data={recurring} />
        </Card>
      </div>

      <Card title="مقارنة شهرين">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select aria-label="الشهر الأول" className="input h-10 w-auto text-sm" value={cmpA} onChange={(e) => setCmpA(e.target.value)}>{sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <span className="text-muted text-sm">مقابل</span>
          <select aria-label="الشهر الثاني" className="input h-10 w-auto text-sm" value={cmpB} onChange={(e) => setCmpB(e.target.value)}>{sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {pa && pb && (
            <span className="text-sm ms-auto">
              <Money value={ta} /> ← <Money value={tb} />{' '}
              {ta > 0 && <span className={`num text-xs font-medium ${tb > ta ? 'text-red-500' : 'text-emerald'}`}>({tb - ta > 0 ? '+' : ''}{pct(tb - ta, ta)}%)</span>}
            </span>
          )}
        </div>
        {sorted.length < 2 ? <p className="text-sm text-muted">أنشئ عزبة ثانية من «العزب الشهرية» لتفعيل المقارنة.</p>
          : compare.length === 0 ? <p className="text-sm text-muted">لا توجد عمليات في الشهرين المحددين.</p>
          : <TwoMonthCompare rows={compare} aLabel={pa?.name ?? ''} bLabel={pb?.name ?? ''} />}
      </Card>
    </div>
  );

}

function DayList({ date, txs, onClose }: { date: string | null; txs: Transaction[]; onClose: () => void }) {
  const { openEditor } = useApp();
  if (!date) return null;
  const list = txs.filter((t) => t.date === date).sort((a, b) => b.amount - a.amount);
  return (
    <div className="mt-3 border-t border-line pt-2 animate-rise">
      <div className="flex justify-between text-xs text-muted mb-1"><span>{formatDateAr(date)} · {list.length} عمليات</span><button onClick={onClose} className="hover:text-ink">إغلاق</button></div>
      <ul className="divide-y divide-line max-h-48 overflow-y-auto scroll-thin">
        {list.map((t) => <li key={t.id}><button className="w-full flex gap-3 py-1.5 text-sm hover:bg-sunk/60 rounded px-1" onClick={() => openEditor(t)}><span className="flex-1 text-start truncate">{t.description}</span><Money value={t.amount} unit={false} className="w-16 text-left" /></button></li>)}
        {!list.length && <li className="py-2 text-xs text-muted">لا عمليات في هذا اليوم.</li>}
      </ul>
    </div>
  );
}
