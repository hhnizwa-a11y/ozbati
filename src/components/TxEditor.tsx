import { useEffect, useMemo, useState } from 'react';
import { classify, detectCar, detectSubscription, rootCategoryId } from '../lib/classifier';
import { CAT } from '../lib/defaults';
import { todayISO } from '../lib/dates';
import { baisaToString, formatOMR, parseToBaisa } from '../lib/money';
import { sortPeriods } from '../lib/metrics';
import type { TxKind } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Modal } from './ui';

export function CategorySelect({ id, value, onChange, className = 'input' }: { id?: string; value: string; onChange: (v: string) => void; className?: string }) {
  const { categories } = useApp();
  const roots = categories.filter((c) => !c.parentId);
  return (
    <select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {roots.map((r) => {
        const kids = categories.filter((c) => c.parentId === r.id);
        return kids.length ? (
          <optgroup key={r.id} label={r.name}>
            <option value={r.id}>{r.name}</option>
            {kids.map((k) => <option key={k.id} value={k.id}>↳ {k.name}</option>)}
          </optgroup>
        ) : <option key={r.id} value={r.id}>{r.name}</option>;
      })}
    </select>
  );
}

export const KIND_LABEL: Record<TxKind, string> = {
  expense: 'مصروف',
  transfer_own: 'تحويل بين حساباتي (لا يُحتسب)',
  transfer_person: 'مبلغ مرسل لشخص آخر',
};

export function TxEditor() {
  const app = useApp();
  const { editor, closeEditor, categories, cars, subs, rules, periods, period } = app;
  const tx = editor.tx;
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('');
  const [categoryId, setCategoryId] = useState<string>(CAT.other);
  const [catTouched, setCatTouched] = useState(false);
  const [carId, setCarId] = useState<string>('');
  const [subId, setSubId] = useState<string>('');
  const [periodId, setPeriodId] = useState<string>('');
  const [kind, setKind] = useState<TxKind>('expense');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor.open) return;
    setError(null);
    if (tx) {
      setDesc(tx.description); setAmount(baisaToString(tx.amount)); setDate(tx.date); setTime(tx.time ?? '');
      setCategoryId(tx.categoryId); setCatTouched(true); setCarId(tx.carId ?? ''); setSubId(tx.subscriptionId ?? '');
      setPeriodId(tx.periodId); setKind(tx.kind); setNotes(tx.notes);
    } else {
      setDesc(''); setAmount(''); setDate(todayISO()); setTime('');
      setCategoryId(CAT.other); setCatTouched(false); setCarId(''); setSubId('');
      setPeriodId(period?.id ?? ''); setKind('expense'); setNotes('');
    }
  }, [editor.open, tx, period?.id]);

  // اقتراح التصنيف والسيارة أثناء الكتابة
  const suggestion = useMemo(() => (desc.trim() ? classify(desc, categories, rules) : null), [desc, categories, rules]);
  useEffect(() => {
    if (!editor.open || catTouched || !suggestion) return;
    setCategoryId(suggestion.categoryId);
    const car = detectCar(desc, cars);
    if (car) { setCarId(car.id); if (suggestion.categoryId === CAT.other) setCategoryId(CAT.cars); }
    const sub = detectSubscription(desc, subs);
    if (sub && rootCategoryId(suggestion.categoryId, categories) === CAT.subscriptions) setSubId(sub.id);
  }, [suggestion, catTouched, editor.open]);

  const parsed = parseToBaisa(amount);
  const root = rootCategoryId(categoryId, categories);
  const sortedPeriods = sortPeriods(periods);

  const save = async () => {
    if (!desc.trim()) return setError('اكتب وصف المصروف');
    if (parsed === null || parsed <= 0) return setError('أدخل مبلغًا صحيحًا أكبر من صفر، مثل 14.6 أو ١٤.٦');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('التاريخ غير صالح');
    if (!periodId) return setError('اختر الشهر المالي');
    const data = {
      description: desc.trim(), amount: parsed, date, time: time || null, categoryId,
      carId: carId || null, subscriptionId: subId || null, periodId, kind, notes: notes.trim(),
    };
    // التعلم من التصحيح: عند اختيار تصنيف يختلف عن المقترح
    const suggested = classify(data.description, categories, []).categoryId;
    const changedCat = tx ? tx.categoryId !== categoryId : suggested !== categoryId;
    if (changedCat) await app.learnRules([{ description: data.description, categoryId, carId: data.carId }]);
    if (tx) {
      await app.updateTx(tx.id, data);
      app.toast('تم حفظ التعديل');
    } else {
      await app.addTx({ ...data, groupLabel: null, source: 'manual', rawText: null });
      app.toast(`أضيف ${data.description} بقيمة ${formatOMR(parsed)}`);
    }
    closeEditor();
  };

  return (
    <Modal
      open={editor.open}
      onClose={closeEditor}
      title={tx ? 'تعديل عملية' : 'إضافة مصروف'}
      footer={
        <>
          {tx && (
            <button className="btn-ghost text-red-600 me-auto" onClick={() => app.askConfirm({ title: 'حذف العملية؟', body: `سيتم حذف «${tx.description}» بقيمة ${formatOMR(tx.amount)}. يمكنك التراجع خلال ثوانٍ بعد الحذف.`, danger: true, confirmLabel: 'حذف', onConfirm: async () => { await app.deleteTxs([tx.id]); closeEditor(); } })}>حذف</button>
          )}
          <button className="btn-soft" onClick={closeEditor}>إلغاء</button>
          <button className="btn-primary" onClick={save}>{tx ? 'حفظ' : 'إضافة'}</button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="col-span-2">
          <label className="label" htmlFor="tx-desc">الوصف</label>
          <input id="tx-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: بترول أي أس" autoFocus />
          {suggestion && !tx && suggestion.confidence !== 'none' && (
            <p className="text-[11px] text-muted mt-1.5">اقتراح التصنيف: {suggestion.reason}</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="tx-amount">المبلغ (ر.ع)</label>
          <input id="tx-amount" className="input num text-left" dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.000" />
          {parsed !== null && parsed > 0 && <p className="text-[11px] text-muted mt-1.5 num">{formatOMR(parsed)}</p>}
        </div>
        <div>
          <label className="label" htmlFor="tx-kind">النوع</label>
          <select id="tx-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as TxKind)}>
            {(Object.keys(KIND_LABEL) as TxKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tx-date">تاريخ العملية</label>
          <input id="tx-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="tx-time">الوقت (اختياري)</label>
          <input id="tx-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="tx-cat">التصنيف</label>
          <CategorySelect id="tx-cat" value={categoryId} onChange={(v) => { setCategoryId(v); setCatTouched(true); }} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="tx-period">الشهر المالي (العزبة)</label>
          <select id="tx-period" className="input" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {sortedPeriods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {(root === CAT.cars || carId) && (
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="tx-car">السيارة</label>
            <select id="tx-car" className="input" value={carId} onChange={(e) => setCarId(e.target.value)}>
              <option value="">غير محددة</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {root === CAT.subscriptions && (
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="tx-sub">الاشتراك المرتبط</label>
            <select id="tx-sub" className="input" value={subId} onChange={(e) => setSubId(e.target.value)}>
              <option value="">بلا ربط</option>
              {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="label" htmlFor="tx-notes">ملاحظات</label>
          <textarea id="tx-notes" className="input h-20 py-2 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {tx?.rawText && <p className="col-span-2 text-[11px] text-muted">النص الأصلي: <span className="font-mono" dir="auto">{tx.rawText}</span></p>}
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
