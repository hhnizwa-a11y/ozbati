import { ArrowLeft, MessageSquareText, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CategoryDonut, DailyChart, MonthlyBars, TopTransactions } from '../components/charts';
import { Icon } from '../components/Icon';
import type { Route } from '../components/Layout';
import { PeriodModal, PeriodSwitcher } from '../components/PeriodControls';
import { Card, CategoryDot, Empty, Money, Progress } from '../components/ui';
import { formatDateAr, weekdayAr } from '../lib/dates';
import { localInsights } from '../lib/insights';
import { budgetState, monthlyComparison } from '../lib/metrics';
import { useApp } from '../store/AppContext';
import { useDashboard, useLookups } from '../store/hooks';

function Kpi({ label, icon, children, sub, tone = 'neutral', onClick }: { label: string; icon: string; children: ReactNode; sub?: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'empty'; onClick?: () => void }) {
  const toneCls = { neutral: 'text-navy dark:text-gold bg-navy/5 dark:bg-gold/10', good: 'text-emerald bg-emerald/10', bad: 'text-red-500 bg-red-500/10', warn: 'text-amber-600 bg-amber-500/10', empty: 'text-muted bg-sunk' }[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`card p-4 flex flex-col gap-2 text-start min-w-0 animate-rise ${onClick ? 'hover:border-emerald/40 transition' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${toneCls}`}><Icon name={icon} size={15} /></span>
      </div>
      <div className="text-lg sm:text-xl font-semibold leading-tight min-w-0 break-words">{children}</div>
      {sub && <div className="text-[11px] text-muted leading-5">{sub}</div>}
    </Tag>
  );
}

export function Dashboard({ go }: { go: (r: Route) => void }) {
  const app = useApp();
  const { settings, periods, txs, categories, openEditor } = app;
  const d = useDashboard();
  const lk = useLookups();
  const [newPeriod, setNewPeriod] = useState(false);
  const [editPeriod, setEditPeriod] = useState(false);
  const [selCat, setSelCat] = useState<string | null>(null);
  if (!d) return null;
  const st = budgetState(d.usedPct);
  const monthly = monthlyComparison(periods, txs, categories);
  const insights = localInsights({ dash: d, allTx: txs, categories, cars: app.cars }).filter((i) => !['total', 'noprev', 'nobudget'].includes(i.id)).slice(0, 3);
  const recent = [...d.txs].sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.createdAt - a.createdAt).slice(0, 6);
  const selTxs = selCat ? d.txs.filter((t) => (lk.cat.get(t.categoryId)?.parentId ?? t.categoryId) === selCat).sort((a, b) => b.amount - a.amount) : [];
  const noBudget = <button className="text-emerald hover:underline" onClick={() => setEditPeriod(true)}>حدد ميزانية العزبة</button>;

  return (
    <div className="space-y-5">
      {/* الترحيب والشهر المالي */}
      <section className="relative overflow-hidden rounded-3xl bg-navy text-white p-5 sm:p-7 shadow-pop">
        <svg className="absolute -left-16 -top-20 opacity-[.07] pointer-events-none" width="320" height="320" viewBox="0 0 200 200" aria-hidden>
          {[90, 70, 50, 30].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#D6AC59" strokeWidth="1.5" />)}
        </svg>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm">{settings.userName ? `مرحبًا ${settings.userName}` : 'مرحبًا بك'}</p>
            <h1 className="text-2xl sm:text-3xl font-semibold mt-1">{d.period.name}</h1>
            <p className="text-xs text-white/55 mt-1.5 num">
              {formatDateAr(d.period.startDate)} ← {formatDateAr(d.period.endDate)}
              {' · '}
              {d.timing.status === 'active' ? `اليوم ${d.timing.elapsedDays} من ${d.timing.totalDays}، متبقٍ ${d.timing.remainingDays} يومًا` : d.timing.status === 'closed' ? 'عزبة منتهية' : 'لم تبدأ بعد'}
            </p>
          </div>
          <PeriodSwitcher tone="dark" onNew={() => setNewPeriod(true)} />
        </div>
        <div className="relative mt-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs text-white/60 mb-1">إجمالي المصاريف</p>
            <Money value={d.total} className="text-4xl sm:text-5xl font-semibold tracking-tight" baisaClass="text-gold/80" />
          </div>
          <div className="w-full sm:w-80">
            {d.budget !== null ? (
              <>
                <div className="flex justify-between text-xs text-white/70 mb-2">
                  <span>من ميزانية <Money value={d.budget} className="text-white" /></span>
                  <span className={`num font-medium ${st === 'over' ? 'text-red-300' : st === 'warn' ? 'text-amber-300' : 'text-emerald'}`}>{d.usedPct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${st === 'over' ? 'bg-red-400' : st === 'warn' ? 'bg-amber-400' : 'bg-emerald'}`} style={{ width: `${Math.min(100, d.usedPct ?? 0)}%` }} />
                </div>
              </>
            ) : (
              <button onClick={() => setEditPeriod(true)} className="w-full text-start rounded-2xl border border-dashed border-white/25 px-4 py-3 text-xs text-white/70 hover:bg-white/5">
                لم تحدد ميزانية لهذه العزبة بعد. <span className="text-gold">اضغط لتحديدها</span> لتظهر نسبة الاستهلاك والمتبقي.
              </button>
            )}
          </div>
        </div>
      </section>

      {d.count === 0 ? (
        <div className="card">
          <Empty icon="MessageSquareText" title="لا توجد عمليات في هذه العزبة"
            body="الصق محادثة واتساب كاملة ليحللها البرنامج وتراجعها قبل الحفظ، أو أضف مصروفًا يدويًا."
            action={<div className="flex flex-wrap gap-2 justify-center"><button className="btn-emerald" onClick={() => go('import')}><MessageSquareText size={16} /> استيراد من واتساب</button><button className="btn-soft" onClick={() => openEditor()}><Plus size={16} /> إضافة يدوية</button></div>} />
        </div>
      ) : (
        <>
          {/* بطاقات المؤشرات */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Kpi label="الميزانية المحددة" icon="Target" tone={d.budget === null ? 'empty' : 'neutral'} sub={d.budget === null ? noBudget : 'للعزبة كاملة'}>
              {d.budget === null ? <span className="text-sm text-muted font-normal">غير محددة</span> : <Money value={d.budget} />}
            </Kpi>
            <Kpi label="المبلغ المتبقي" icon="Wallet" tone={d.remaining === null ? 'empty' : d.remaining < 0 ? 'bad' : 'good'} sub={d.remaining === null ? 'يحتاج تحديد ميزانية' : d.remaining < 0 ? 'تجاوز للميزانية' : 'الميزانية ناقص المصاريف'}>
              {d.remaining === null ? <span className="text-sm text-muted font-normal">—</span> : <Money value={d.remaining} className={d.remaining < 0 ? 'text-red-500' : ''} />}
            </Kpi>
            <Kpi label="نسبة الاستهلاك" icon="Gauge" tone={st === 'none' ? 'empty' : st === 'over' ? 'bad' : st === 'warn' ? 'warn' : 'good'} sub={st === 'none' ? 'يحتاج تحديد ميزانية' : <Progress value={d.usedPct} state={st} />}>
              {d.usedPct === null ? <span className="text-sm text-muted font-normal">—</span> : <span className="num">{d.usedPct}%</span>}
            </Kpi>
            <Kpi label="متوسط المصروف اليومي" icon="CalendarDays" sub={`على ${d.timing.elapsedDays} يومًا منقضيًا`}>
              <Money value={d.avgDaily} />
            </Kpi>
            <Kpi label="أعلى يوم إنفاق" icon="TrendingUp" sub={d.topDay ? `${weekdayAr(d.topDay.date)} ${formatDateAr(d.topDay.date)} · ${d.topDay.count} عمليات` : undefined}>
              <Money value={d.topDay?.total} />
            </Kpi>
            <Kpi label="أكبر عملية مالية" icon="Receipt" sub={d.largest ? `${d.largest.description} · ${formatDateAr(d.largest.date, false)}` : undefined} onClick={d.largest ? () => openEditor(d.largest) : undefined}>
              <Money value={d.largest?.amount} />
            </Kpi>
            <Kpi label="عدد العمليات" icon="ListChecks" sub={`متوسط العملية ${d.count ? (d.total / d.count / 1000).toFixed(3) : '0.000'} ر.ع`} onClick={() => go('transactions')}>
              <span className="num">{d.count}</span>
            </Kpi>
            <Kpi label="التغير عن الشهر السابق" icon={d.prev && d.prev.diff > 0 ? 'TrendingUp' : 'TrendingDown'} tone={!d.prev ? 'empty' : d.prev.diff > 0 ? 'bad' : 'good'}
              sub={d.prev ? `${d.prev.period.name}: ${(d.prev.total / 1000).toFixed(3)} ر.ع` : 'لا توجد بيانات لشهر سابق'}>
              {d.prev ? <span className={d.prev.diff > 0 ? 'text-red-500' : 'text-emerald'}><Money value={d.prev.diff} sign /> <span className="text-xs num">({d.prev.diffPct}%)</span></span> : <span className="text-sm text-muted font-normal">—</span>}
            </Kpi>
            <Kpi label="المتوقع بنهاية الشهر" icon="Sparkles" tone={d.forecast !== null && d.budget !== null && d.forecast > d.budget ? 'warn' : 'neutral'}
              sub={d.timing.status === 'active' ? `تقدير وليس مبلغًا مؤكدًا: الإجمالي + المتوسط اليومي × ${d.timing.remainingDays} يومًا متبقيًا` : d.timing.status === 'closed' ? 'العزبة منتهية: هذا هو الإجمالي الفعلي' : 'العزبة لم تبدأ'}>
              {d.forecast === null ? <span className="text-sm text-muted font-normal">—</span> : <span>≈ <Money value={d.forecast} /></span>}
            </Kpi>
            <Kpi label="التحويلات المستبعدة" icon="ArrowLeftRight" tone="empty" sub="تحويلات بين حساباتك لا تُحتسب">
              <Money value={d.transfersOwn} />
            </Kpi>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3" title="توزيع المصاريف" action={<span className="text-[11px] text-muted">اضغط أي تصنيف لتفاصيله</span>}>
              <CategoryDonut data={d.categories} total={d.total} selected={selCat} onSelect={setSelCat} />
              {selCat && (
                <div className="mt-4 border-t border-line pt-3 animate-rise">
                  <p className="text-xs text-muted mb-2">عمليات {lk.cat.get(selCat)?.name} ({selTxs.length})</p>
                  <ul className="divide-y divide-line max-h-64 overflow-y-auto scroll-thin">
                    {selTxs.map((t) => (
                      <li key={t.id}><button onClick={() => openEditor(t)} className="w-full flex items-center gap-3 py-2 text-sm hover:bg-sunk/60 rounded-lg px-1">
                        <span className="flex-1 text-start truncate">{t.description}</span>
                        <span className="text-[11px] text-muted num">{formatDateAr(t.date, false)}</span>
                        <Money value={t.amount} unit={false} className="font-medium w-16 text-left" />
                      </button></li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            <Card className="lg:col-span-2" title="تحليلات سريعة" action={<button className="text-xs text-emerald inline-flex items-center gap-1" onClick={() => go('analyst')}>المحلل المالي <ArrowLeft size={14} /></button>}>
              <ul className="space-y-3">
                {insights.map((i) => (
                  <li key={i.id} className="flex gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${i.tone === 'negative' ? 'bg-red-500/10 text-red-500' : i.tone === 'warning' ? 'bg-amber-500/10 text-amber-600' : i.tone === 'positive' ? 'bg-emerald/10 text-emerald' : 'bg-sunk text-muted'}`}><Icon name={i.icon} size={16} /></span>
                    <div className="min-w-0"><p className="text-sm font-medium leading-6">{i.title}</p><p className="text-xs text-muted leading-5">{i.detail}</p></div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="المصاريف اليومية" action={<span className="text-[11px] text-muted">النقطة الذهبية: أعلى يوم · الخط المتقطع: المتوسط</span>}>
            <DailyChart data={d.daily} avg={d.avgDaily} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="أعلى 10 مصاريف">
              <TopTransactions txs={d.top10} categories={categories} onPick={(t) => openEditor(t)} />
            </Card>
            <Card title="مقارنة الأشهر" action={<button className="text-xs text-emerald inline-flex items-center gap-1" onClick={() => go('analytics')}>المزيد <ArrowLeft size={14} /></button>}>
              {monthly.filter((m) => m.total > 0).length < 2 && <p className="text-xs text-muted mb-2">تظهر المقارنة بوضوح عند وجود أكثر من عزبة بعمليات.</p>}
              <MonthlyBars data={monthly} currentId={d.period.id} onPick={app.setPeriodId} />
            </Card>
          </div>

          <Card title="آخر العمليات" action={<button className="text-xs text-emerald inline-flex items-center gap-1" onClick={() => go('transactions')}>كل العمليات <ArrowLeft size={14} /></button>}>
            <ul className="divide-y divide-line -my-2">
              {recent.map((t) => {
                const c = lk.cat.get(t.categoryId);
                return (
                  <li key={t.id}>
                    <button onClick={() => openEditor(t)} className="w-full flex items-center gap-3 py-3 text-start hover:bg-sunk/50 rounded-xl px-1 transition">
                      <CategoryDot cat={c} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-[11px] text-muted truncate">{c?.name ?? 'أخرى'}{t.carId ? ` · ${lk.car.get(t.carId)?.name}` : ''} · {formatDateAr(t.date, false)}{t.time ? ` ${t.time}` : ''}</p>
                      </div>
                      <Money value={t.amount} className="text-sm font-semibold" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
      <PeriodModal open={newPeriod} onClose={() => setNewPeriod(false)} />
      <PeriodModal open={editPeriod} onClose={() => setEditPeriod(false)} editing={d.period} />
    </div>
  );
}
