import { BellRing, CheckCircle2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CategorySelect } from '../components/TxEditor';
import { Card, Empty, Modal, Money, PageHeader } from '../components/ui';
import { rootCategoryId } from '../lib/classifier';
import { CAT } from '../lib/defaults';
import { addDays, formatDateAr, parseISO, iso, lastDayOfMonth } from '../lib/dates';
import { subscriptionStatuses } from '../lib/metrics';
import { baisaToString, formatOMR, parseToBaisa } from '../lib/money';
import type { Cycle, Subscription, SubStatus } from '../lib/types';
import { uid, useApp } from '../store/AppContext';

const CYCLE: Record<Cycle, string> = { monthly: 'شهري', yearly: 'سنوي', weekly: 'أسبوعي' };
const STATUS: Record<SubStatus, { label: string; cls: string }> = {
  active: { label: 'نشط', cls: 'bg-emerald/10 text-emerald' },
  paused: { label: 'موقوف مؤقتًا', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  cancelled: { label: 'ملغى', cls: 'bg-sunk text-muted' },
};

export function nextCycleDate(date: string, cycle: Cycle): string {
  if (cycle === 'weekly') return addDays(date, 7);
  const { y, m, d } = parseISO(date);
  if (cycle === 'yearly') return iso(y + 1, m, Math.min(d, lastDayOfMonth(y + 1, m)));
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return iso(ny, nm, Math.min(d, lastDayOfMonth(ny, nm)));
}

export function Subscriptions() {
  const app = useApp();
  const { subs, txs, period, today } = app;
  const [edit, setEdit] = useState<Subscription | null | 'new'>(null);
  const statuses = subscriptionStatuses(subs, txs, period?.id ?? null, today);
  const scheduledMonthly = statuses.reduce((s, x) => s + (x.monthlyEquivalent ?? 0), 0);
  const missingAmount = statuses.filter((x) => x.sub.status === 'active' && x.sub.amount === null).length;
  const paidThisPeriod = txs.filter((t) => t.periodId === period?.id && rootCategoryId(t.categoryId, app.categories) === CAT.subscriptions && t.kind !== 'transfer_own');
  const paidTotal = paidThisPeriod.reduce((s, t) => s + t.amount, 0);
  const unlinked = paidThisPeriod.filter((t) => !t.subscriptionId);
  const due = statuses.filter((x) => x.dueSoon);

  const recordPayment = async (s: Subscription) => {
    if (!period || s.amount === null) return;
    await app.addTx({ description: `اشتراك ${s.name}`, amount: s.amount, date: today, time: null, categoryId: s.categoryId, carId: null, periodId: period.id, kind: 'expense', notes: 'دفعة اشتراك', groupLabel: null, subscriptionId: s.id, source: 'manual', rawText: null });
    await app.saveSub({ ...s, nextRenewal: nextCycleDate(s.nextRenewal && s.nextRenewal >= today ? s.nextRenewal : today, s.cycle) });
    app.toast(`سُجلت دفعة ${s.name} بقيمة ${formatOMR(s.amount)}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="الاشتراكات" subtitle="الاشتراك المجدول لا يدخل في المصاريف إلا عند تسجيل دفعة فعلية." actions={<button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> اشتراك</button>} />

      {due.map((x) => (
        <div key={x.sub.id} className="rounded-2xl p-3.5 flex flex-wrap items-center gap-3 text-sm bg-gold/15 border border-gold/40">
          <BellRing size={18} className="text-gold-dark dark:text-gold shrink-0" />
          <span className="flex-1">يتجدد <b>{x.sub.name}</b> {x.daysToRenewal === 0 ? 'اليوم' : `خلال ${x.daysToRenewal} يوم`} ({formatDateAr(x.sub.nextRenewal!)}) بقيمة {formatOMR(x.sub.amount)}</span>
          {x.sub.amount !== null && <button className="btn-sm btn bg-navy text-white dark:bg-gold dark:text-navy-950" onClick={() => recordPayment(x.sub)}>تسجيل الدفعة</button>}
        </div>
      ))}

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-xs text-muted">المدفوع فعليًا في {period?.name}</p><Money value={paidTotal} className="text-2xl font-semibold block mt-1" /><p className="text-[11px] text-muted mt-1">{paidThisPeriod.length} دفعات · محتسبة ضمن المصاريف</p></div>
        <div className="card p-4"><p className="text-xs text-muted">التكلفة الشهرية المجدولة</p><Money value={scheduledMonthly} className="text-2xl font-semibold block mt-1" /><p className="text-[11px] text-muted mt-1">{missingAmount ? `${missingAmount} اشتراكات بلا مبلغ محدد` : 'تقدير للاشتراكات النشطة · غير محتسب'}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">اشتراكات نشطة</p><p className="text-2xl font-semibold num mt-1">{subs.filter((s) => s.status === 'active').length}</p><p className="text-[11px] text-muted mt-1">من {subs.length} مسجلة</p></div>
      </div>

      <Card title="قائمة الاشتراكات" pad={false}>
        {subs.length === 0 ? <Empty title="لا توجد اشتراكات" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-[11px] text-muted border-b border-line"><tr>
                {['الخدمة', 'المبلغ المجدول', 'الدورية', 'تاريخ التجديد', 'الحالة', 'المدفوع هذا الشهر', 'آخر دفعة', ''].map((h) => <th key={h} className="text-start font-normal px-4 py-2.5">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {statuses.map(({ sub: s, paidInPeriod, lastPayment, daysToRenewal, payments }) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3"><p className="font-medium">{s.name}</p><p className="text-[11px] text-muted">{app.categories.find((c) => c.id === s.categoryId)?.name}</p></td>
                    <td className="px-4">{s.amount === null ? <button className="text-xs text-emerald hover:underline" onClick={() => setEdit(s)}>حدد المبلغ</button> : <Money value={s.amount} unit={false} />}</td>
                    <td className="px-4 text-xs">{CYCLE[s.cycle]}</td>
                    <td className="px-4 text-xs">{s.nextRenewal ? <>{formatDateAr(s.nextRenewal)}{daysToRenewal !== null && daysToRenewal >= 0 && <span className="text-muted"> · بعد {daysToRenewal} يوم</span>}{daysToRenewal !== null && daysToRenewal < 0 && <span className="text-red-500"> · فات موعده</span>}</> : <span className="text-muted">غير محدد</span>}</td>
                    <td className="px-4"><span className={`chip ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span></td>
                    <td className="px-4">{paidInPeriod ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald" /><Money value={paidInPeriod} unit={false} /></span> : <span className="text-xs text-muted">لم تُدفع</span>}</td>
                    <td className="px-4 text-xs text-muted">{lastPayment ? `${formatDateAr(lastPayment.date)} · ${baisaToString(lastPayment.amount)}` : '—'}{payments.length > 1 && <span> ({payments.length} دفعات)</span>}</td>
                    <td className="px-4">
                      <div className="flex gap-1 justify-end">
                        {s.amount !== null && s.status === 'active' && <button className="icon-btn" title="تسجيل دفعة فعلية" onClick={() => recordPayment(s)}><Receipt size={16} /></button>}
                        <button className="icon-btn" title="تعديل" onClick={() => setEdit(s)}><Pencil size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {unlinked.length > 0 && (
        <Card title="دفعات اشتراكات غير مربوطة بخدمة">
          <ul className="divide-y divide-line -my-2">
            {unlinked.map((t) => (
              <li key={t.id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1 truncate">{t.description} <span className="text-[11px] text-muted">· {formatDateAr(t.date, false)}</span></span>
                <Money value={t.amount} unit={false} />
                <select aria-label="ربط بخدمة" className="input h-9 w-40 text-xs" value="" onChange={async (e) => { await app.updateTx(t.id, { subscriptionId: e.target.value }); app.toast('رُبطت الدفعة'); }}>
                  <option value="" disabled>ربط بـ…</option>
                  {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <SubModal sub={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function SubModal({ sub, onClose }: { sub: Subscription | null | 'new'; onClose: () => void }) {
  const app = useApp();
  const s = sub && sub !== 'new' ? sub : null;
  const [f, setF] = useState({ name: '', amount: '', cycle: 'monthly' as Cycle, nextRenewal: '', status: 'active' as SubStatus, categoryId: CAT.subscriptions as string, keywords: '', remindDays: '3' });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!sub) return;
    setErr(null);
    setF({ name: s?.name ?? '', amount: s?.amount ? baisaToString(s.amount) : '', cycle: s?.cycle ?? 'monthly', nextRenewal: s?.nextRenewal ?? '', status: s?.status ?? 'active', categoryId: s?.categoryId ?? CAT.subscriptions, keywords: s?.keywords.join('، ') ?? '', remindDays: String(s?.remindDays ?? 3) });
  }, [sub]);
  const save = async () => {
    if (!f.name.trim()) return setErr('اكتب اسم الخدمة');
    const amount = f.amount.trim() ? parseToBaisa(f.amount) : null;
    if (f.amount.trim() && amount === null) return setErr('المبلغ غير صالح');
    await app.saveSub({ id: s?.id ?? uid('sub'), name: f.name.trim(), amount, cycle: f.cycle, nextRenewal: f.nextRenewal || null, status: f.status, categoryId: f.categoryId, keywords: f.keywords.split(/[،,]/).map((x) => x.trim()).filter(Boolean), remindDays: Math.max(0, Number(f.remindDays) || 0), createdAt: s?.createdAt ?? Date.now() });
    app.toast('حُفظ الاشتراك');
    onClose();
  };
  return (
    <Modal open={!!sub} onClose={onClose} title={s ? `تعديل ${s.name}` : 'اشتراك جديد'} footer={<>
      {s && <button className="btn-ghost text-red-600 me-auto" onClick={() => app.askConfirm({ title: `حذف ${s.name}؟`, body: 'الدفعات المسجلة سابقًا تبقى ضمن المصاريف وتُفصل عن هذا الاشتراك.', danger: true, confirmLabel: 'حذف', onConfirm: async () => { await app.deleteSub(s.id); onClose(); } })}><Trash2 size={16} /> حذف</button>}
      <button className="btn-soft" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="label" htmlFor="s-name">اسم الخدمة</label><input id="s-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="s-amount">المبلغ</label><input id="s-amount" className="input num" dir="ltr" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0.000" /></div>
        <div><label className="label" htmlFor="s-cycle">دورية الدفع</label><select id="s-cycle" className="input" value={f.cycle} onChange={(e) => setF({ ...f, cycle: e.target.value as Cycle })}>{(Object.keys(CYCLE) as Cycle[]).map((c) => <option key={c} value={c}>{CYCLE[c]}</option>)}</select></div>
        <div><label className="label" htmlFor="s-next">تاريخ التجديد القادم</label><input id="s-next" type="date" className="input" value={f.nextRenewal} onChange={(e) => setF({ ...f, nextRenewal: e.target.value })} /></div>
        <div><label className="label" htmlFor="s-status">الحالة</label><select id="s-status" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as SubStatus })}>{(Object.keys(STATUS) as SubStatus[]).map((c) => <option key={c} value={c}>{STATUS[c].label}</option>)}</select></div>
        <div><label className="label" htmlFor="s-cat">التصنيف</label><CategorySelect id="s-cat" value={f.categoryId} onChange={(v) => setF({ ...f, categoryId: v })} /></div>
        <div><label className="label" htmlFor="s-remind">التنبيه قبل التجديد (أيام)</label><input id="s-remind" type="number" min={0} className="input num" value={f.remindDays} onChange={(e) => setF({ ...f, remindDays: e.target.value })} /></div>
        <div className="col-span-2"><label className="label" htmlFor="s-kw">كلمات التعرف في واتساب (مفصولة بفاصلة)</label><input id="s-kw" className="input" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="كلود، انثروبيك" /></div>
        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
