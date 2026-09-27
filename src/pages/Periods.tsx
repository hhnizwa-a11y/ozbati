import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MonthlyBars } from '../components/charts';
import { PeriodModal } from '../components/PeriodControls';
import { Card, Modal, Money, PageHeader } from '../components/ui';
import { formatDateAr } from '../lib/dates';
import { monthlyComparison, periodTiming, spendingOf, totalOf } from '../lib/metrics';
import { formatOMR } from '../lib/money';
import type { Period } from '../lib/types';
import { useApp } from '../store/AppContext';
import { useSortedPeriods } from '../store/hooks';

export function Periods() {
  const app = useApp();
  const sorted = useSortedPeriods();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Period | null>(null);
  const [del, setDel] = useState<Period | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const monthly = monthlyComparison(app.periods, app.txs, app.categories);

  return (
    <div className="space-y-4">
      <PageHeader title="العزب الشهرية" subtitle="لكل شهر عزبة بفترة مالية مستقلة عن تواريخ العمليات." actions={<button className="btn-primary" onClick={() => setCreate(true)}><Plus size={16} /> عزبة جديدة</button>} />
      <Card title="مقارنة الأشهر"><MonthlyBars data={monthly} currentId={app.period?.id} onPick={app.setPeriodId} /></Card>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {[...sorted].reverse().map((p) => {
          const list = spendingOf(app.txs, p.id);
          const total = totalOf(list);
          const t = periodTiming(p, app.today);
          const current = p.id === app.period?.id;
          return (
            <div key={p.id} className={`card p-4 space-y-3 ${current ? 'ring-2 ring-emerald/50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted">{formatDateAr(p.startDate)} ← {formatDateAr(p.endDate)} · {t.totalDays} يومًا</p>
                </div>
                <span className={`chip ${t.status === 'active' ? 'bg-emerald/10 text-emerald' : t.status === 'closed' ? 'bg-sunk text-muted' : 'bg-gold/15 text-gold-dark dark:text-gold'}`}>{t.status === 'active' ? 'جارية' : t.status === 'closed' ? 'منتهية' : 'قادمة'}</span>
              </div>
              <div className="flex items-end justify-between">
                <Money value={total} className="text-xl font-semibold" />
                <span className="text-xs text-muted num">{list.length} عملية{p.budget ? ` · ميزانية ${formatOMR(p.budget)}` : ''}</span>
              </div>
              <div className="flex gap-1.5">
                {!current && <button className="btn-soft btn-sm" onClick={() => app.setPeriodId(p.id)}>فتح</button>}
                {current && <span className="btn-sm btn bg-emerald/10 text-emerald pointer-events-none">العزبة الحالية</span>}
                <button className="icon-btn ms-auto" onClick={() => setEdit(p)} aria-label="تعديل"><Pencil size={16} /></button>
                <button className="icon-btn hover:text-red-600" onClick={() => { setDel(p); setMoveTo(sorted.find((x) => x.id !== p.id)?.id ?? ''); }} aria-label="حذف" disabled={sorted.length < 2}><Trash2 size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <PeriodModal open={create} onClose={() => setCreate(false)} />
      <PeriodModal open={!!edit} onClose={() => setEdit(null)} editing={edit} />
      <Modal open={!!del} onClose={() => setDel(null)} title={`حذف ${del?.name ?? ''}؟`} footer={<>
        <button className="btn-soft" onClick={() => setDel(null)}>إلغاء</button>
        <button className="btn-danger" onClick={async () => { if (!del) return; await app.deletePeriod(del.id, moveTo || null); app.toast(`حُذفت ${del.name}`); setDel(null); }}>حذف العزبة</button>
      </>}>
        {del && (() => {
          const n = app.txs.filter((t) => t.periodId === del.id).length;
          return n ? (
            <div className="space-y-3 text-sm">
              <p>تحتوي هذه العزبة على {n} عملية. اختر ما يحدث لها:</p>
              <select aria-label="نقل العمليات" className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {sorted.filter((x) => x.id !== del.id).map((x) => <option key={x.id} value={x.id}>نقلها إلى {x.name}</option>)}
                <option value="">حذفها نهائيًا</option>
              </select>
              {!moveTo && <p className="text-red-600 text-xs">سيتم حذف {n} عملية نهائيًا دون إمكانية التراجع. صدّر نسخة احتياطية أولًا إن لزم.</p>}
            </div>
          ) : <p className="text-sm text-muted">لا توجد عمليات في هذه العزبة.</p>;
        })()}
      </Modal>
    </div>
  );
}
