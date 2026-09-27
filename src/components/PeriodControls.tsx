import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { iso, lastDayOfMonth, MONTHS_AR, periodLabel } from '../lib/dates';
import { parseToBaisa, baisaToString } from '../lib/money';
import type { Period } from '../lib/types';
import { periodId as makeId, useApp } from '../store/AppContext';
import { useSortedPeriods } from '../store/hooks';
import { Modal } from './ui';

export function PeriodSwitcher({ onNew, tone = 'light' }: { onNew: () => void; tone?: 'light' | 'dark' }) {
  const { period, setPeriodId } = useApp();
  const sorted = useSortedPeriods();
  const i = sorted.findIndex((p) => p.id === period?.id);
  const dark = tone === 'dark';
  const btn = dark ? 'w-9 h-9 rounded-xl inline-flex items-center justify-center text-white/80 hover:bg-white/10 disabled:opacity-30' : 'icon-btn disabled:opacity-30';
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button className={btn} disabled={i <= 0} onClick={() => setPeriodId(sorted[i - 1].id)} aria-label="الشهر السابق"><ChevronRight size={18} /></button>
      <select
        aria-label="الشهر المالي"
        className={dark ? 'h-9 rounded-xl bg-white/10 text-white border border-white/15 px-3 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 appearance-none [&>option]:text-navy' : 'input h-9 w-auto'}
        style={dark ? { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23D6AC59' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'left .7rem center' } : undefined}
        value={period?.id ?? ''}
        onChange={(e) => setPeriodId(e.target.value)}
      >
        {sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button className={btn} disabled={i < 0 || i >= sorted.length - 1} onClick={() => setPeriodId(sorted[i + 1].id)} aria-label="الشهر التالي"><ChevronLeft size={18} /></button>
      <button className={dark ? 'h-9 px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:bg-white/10 whitespace-nowrap' : 'btn-soft btn-sm'} onClick={onNew}>
        <Plus size={14} /> عزبة جديدة
      </button>
    </div>
  );
}

/** إنشاء أو تعديل عزبة شهر */
export function PeriodModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Period | null }) {
  const app = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [budget, setBudget] = useState('');
  const [income, setIncome] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setYear(editing.year); setMonth(editing.month); setStart(editing.startDate); setEnd(editing.endDate);
      setBudget(editing.budget ? baisaToString(editing.budget) : ''); setIncome(editing.income ? baisaToString(editing.income) : '');
    } else {
      // الشهر التالي لآخر عزبة
      const last = [...app.periods].sort((a, b) => a.year - b.year || a.month - b.month).pop();
      const y = last ? (last.month === 12 ? last.year + 1 : last.year) : now.getFullYear();
      const m = last ? (last.month % 12) + 1 : now.getMonth() + 1;
      setYear(y); setMonth(m); setStart(iso(y, m, 1)); setEnd(iso(y, m, lastDayOfMonth(y, m))); setBudget(''); setIncome('');
    }
  }, [open, editing]);

  const onMonth = (y: number, m: number) => {
    setYear(y); setMonth(m);
    if (!editing) { setStart(iso(y, m, 1)); setEnd(iso(y, m, lastDayOfMonth(y, m))); }
  };

  const save = async () => {
    if (!start || !end || start > end) return setError('تاريخ البداية يجب أن يسبق تاريخ النهاية');
    const b = budget.trim() ? parseToBaisa(budget) : null;
    const inc = income.trim() ? parseToBaisa(income) : null;
    if (budget.trim() && b === null) return setError('مبلغ الميزانية غير صالح');
    if (income.trim() && inc === null) return setError('مبلغ الدخل غير صالح');
    const id = makeId(year, month);
    if (!editing && app.periods.some((p) => p.id === id)) return setError(`${periodLabel(year, month)} موجودة مسبقًا`);
    if (editing && editing.id !== id) return setError('لا يمكن تغيير شهر عزبة موجودة؛ أنشئ عزبة جديدة وانقل العمليات إليها');
    const p: Period = editing
      ? { ...editing, startDate: start, endDate: end, budget: b, income: inc }
      : { id, name: periodLabel(year, month), year, month, startDate: start, endDate: end, budget: b, income: inc, categoryBudgets: {}, createdAt: Date.now() };
    await app.savePeriod(p);
    if (!editing) app.setPeriodId(p.id);
    app.toast(editing ? 'تم حفظ العزبة' : `أُنشئت ${p.name}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `تعديل ${editing.name}` : 'عزبة شهر جديد'}
      footer={<><button className="btn-soft" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>{editing ? 'حفظ' : 'إنشاء'}</button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="pm-month">الشهر</label>
          <select id="pm-month" className="input" value={month} disabled={!!editing} onChange={(e) => onMonth(year, Number(e.target.value))}>
            {MONTHS_AR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pm-year">السنة</label>
          <input id="pm-year" type="number" className="input num" value={year} disabled={!!editing} onChange={(e) => onMonth(Number(e.target.value), month)} />
        </div>
        <div>
          <label className="label" htmlFor="pm-start">بداية الفترة</label>
          <input id="pm-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pm-end">نهاية الفترة</label>
          <input id="pm-end" type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <p className="col-span-2 text-xs text-muted -mt-1 leading-6">يمكن أن تبدأ العزبة قبل الشهر نفسه، مثل عزبة سبتمبر من 23 أغسطس. تاريخ كل عملية يبقى كما هو.</p>
        <div>
          <label className="label" htmlFor="pm-budget">الميزانية العامة (اختياري)</label>
          <input id="pm-budget" className="input num" dir="ltr" inputMode="decimal" placeholder="0.000" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pm-income">الدخل (اختياري)</label>
          <input id="pm-income" className="input num" dir="ltr" inputMode="decimal" placeholder="0.000" value={income} onChange={(e) => setIncome(e.target.value)} />
        </div>
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
