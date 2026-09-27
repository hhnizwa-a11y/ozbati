import { AlertTriangle, Copy, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CategoryDot, Empty, Modal, Money, PageHeader, Progress, StatePill } from '../components/ui';
import { MONTHS_AR } from '../lib/dates';
import { budgetState, previousPeriod } from '../lib/metrics';
import { baisaToString, formatOMR, parseToBaisa, pct } from '../lib/money';
import type { Goal } from '../lib/types';
import { uid, useApp } from '../store/AppContext';
import { useDashboard } from '../store/hooks';

function AmountInput({ id, value, onCommit, placeholder = 'بلا ميزانية' }: { id: string; value: number | null; onCommit: (v: number | null) => void; placeholder?: string }) {
  const [text, setText] = useState(value ? baisaToString(value) : '');
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value ? baisaToString(value) : ''); }, [value]);
  const commit = () => {
    if (!text.trim()) { setBad(false); if (value !== null) onCommit(null); return; }
    const b = parseToBaisa(text);
    if (b === null) { setBad(true); return; }
    setBad(false);
    if (b !== value) onCommit(b || null);
  };
  return <input id={id} aria-label="المبلغ" className={`input h-9 num text-left w-28 ${bad ? 'border-red-500' : ''}`} dir="ltr" inputMode="decimal" placeholder={placeholder} value={text}
    onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

export function Budgets() {
  const app = useApp();
  const d = useDashboard();
  const [goalEdit, setGoalEdit] = useState<Goal | null | 'new'>(null);
  if (!d) return null;
  const p = d.period;
  const prev = previousPeriod(p, app.periods);
  const st = budgetState(d.usedPct);
  const alerts = d.categories.filter((c) => budgetState(c.used) === 'warn' || budgetState(c.used) === 'over');
  const catBudgetSum = Object.values(p.categoryBudgets ?? {}).reduce((s, v) => s + (v || 0), 0);

  const setCatBudget = async (id: string, v: number | null) => {
    const cb = { ...(p.categoryBudgets ?? {}) };
    if (v) cb[id] = v; else delete cb[id];
    await app.savePeriod({ ...p, categoryBudgets: cb });
    app.toast('حُفظت الميزانية');
  };

  const goals = [...app.goals].sort((a, b) => (a.type === b.type ? a.createdAt - b.createdAt : a.type === 'monthly' ? -1 : 1));

  return (
    <div className="space-y-4">
      <PageHeader title="الميزانيات والأهداف" subtitle={p.name} actions={prev && Object.keys(prev.categoryBudgets ?? {}).length > 0 ? (
        <button className="btn-soft" onClick={async () => { await app.savePeriod({ ...p, budget: p.budget ?? prev.budget, categoryBudgets: { ...prev.categoryBudgets } }); app.toast(`نُسخت ميزانيات ${prev.name}`); }}><Copy size={16} /> نسخ ميزانيات {prev.name}</button>
      ) : undefined} />

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((c) => {
            const over = budgetState(c.used) === 'over';
            return (
              <div key={c.id} className={`rounded-2xl p-3.5 flex items-center gap-3 text-sm ${over ? 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30'}`}>
                <AlertTriangle size={18} className="shrink-0" />
                <span className="flex-1">{over ? <>تحذير: تجاوزت ميزانية <b>{c.name}</b> بمقدار {formatOMR(c.total - (c.budget ?? 0))}</> : <>تنبيه: وصلت ميزانية <b>{c.name}</b> إلى {c.used}%</>}</span>
                <span className="num text-xs">{formatOMR(c.total)} / {formatOMR(c.budget)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="الميزانية العامة للشهر" className="lg:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="b-total" className="text-sm text-muted">الميزانية</label>
              <AmountInput id="b-total" value={p.budget} onCommit={async (v) => { await app.savePeriod({ ...p, budget: v }); app.toast('حُفظت الميزانية العامة'); }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="b-income" className="text-sm text-muted">الدخل (اختياري)</label>
              <AmountInput id="b-income" value={p.income} placeholder="غير محدد" onCommit={async (v) => { await app.savePeriod({ ...p, income: v }); app.toast('حُفظ الدخل'); }} />
            </div>
            {d.budget !== null ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>المصروف <Money value={d.total} /></span><StatePill state={st} used={d.usedPct} /></div>
                <Progress value={d.usedPct} state={st} />
                <p className="text-xs text-muted">المتبقي <Money value={d.remaining} className={d.remaining! < 0 ? 'text-red-500' : 'text-ink'} />{d.forecast !== null && d.timing.status === 'active' ? <> · المتوقع تقديريًا بنهاية الشهر <Money value={d.forecast} /></> : null}</p>
              </div>
            ) : <p className="text-xs text-muted leading-6">أدخل الميزانية العامة لتظهر نسبة الاستهلاك والمتبقي في لوحة التحكم.</p>}
            {catBudgetSum > 0 && <p className="text-xs text-muted border-t border-line pt-3">مجموع ميزانيات التصنيفات: <Money value={catBudgetSum} />{d.budget !== null && catBudgetSum > d.budget ? <span className="text-amber-600"> · يتجاوز الميزانية العامة</span> : null}</p>}
            {d.savings !== null && <p className="text-xs border-t border-line pt-3">{d.savings >= 0 ? 'الفائض من الدخل' : 'العجز عن الدخل'}: <Money value={d.savings} className={d.savings >= 0 ? 'text-emerald' : 'text-red-500'} /></p>}
          </div>
        </Card>

        <Card title="ميزانية كل تصنيف" className="lg:col-span-2" action={<span className="text-[11px] text-muted">تنبيه عند 80% · تحذير بعد 100%</span>}>
          <ul className="divide-y divide-line -my-2">
            {app.categories.filter((c) => !c.parentId).map((c) => {
              const ct = d.categories.find((x) => x.id === c.id)!;
              const s = budgetState(ct?.used ?? null);
              return (
                <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                  <CategoryDot cat={c} size={34} />
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="text-xs text-muted num"><Money value={ct?.total ?? 0} unit={false} className="text-ink font-medium" />{ct?.budget ? <> / {baisaToString(ct.budget)}</> : null}</span>
                    </div>
                    {ct?.budget ? <Progress value={ct.used} state={s} /> : <div className="h-2 rounded-full bg-sunk" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {ct?.budget ? <StatePill state={s} used={ct.used} /> : null}
                    <AmountInput id={`b-${c.id}`} value={p.categoryBudgets?.[c.id] ?? null} onCommit={(v) => setCatBudget(c.id, v)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card title="أهداف الادخار" action={<button className="btn-soft btn-sm" onClick={() => setGoalEdit('new')}><Plus size={14} /> هدف جديد</button>}>
        {goals.length === 0 ? (
          <Empty icon="PiggyBank" title="لا توجد أهداف ادخار" body="أضف هدفًا شهريًا أو سنويًا وتابع تقدمك نحوه." />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {goals.map((g) => {
              const used = pct(g.saved, g.target) ?? 0;
              return (
                <div key={g.id} className="rounded-2xl border border-line p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-[11px] text-muted">{g.type === 'monthly' ? `هدف شهري · ${g.month ? MONTHS_AR[g.month - 1] : ''} ${g.year}` : `هدف سنوي · ${g.year}`}</p>
                    </div>
                    <span className="w-9 h-9 rounded-xl bg-gold/15 text-gold-dark dark:text-gold flex items-center justify-center"><PiggyBank size={18} /></span>
                  </div>
                  <div className="flex items-end justify-between"><Money value={g.saved} className="text-lg font-semibold" /><span className="text-xs text-muted">من <Money value={g.target} /></span></div>
                  <Progress value={used} state={used >= 100 ? 'ok' : 'ok'} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="num text-muted">{used}%{used >= 100 ? ' · تحقق الهدف' : ` · متبقٍ ${formatOMR(Math.max(0, g.target - g.saved))}`}</span>
                    <button className="text-emerald hover:underline" onClick={() => setGoalEdit(g)}>تحديث</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <GoalModal goal={goalEdit} onClose={() => setGoalEdit(null)} />
    </div>
  );
}

function GoalModal({ goal, onClose }: { goal: Goal | null | 'new'; onClose: () => void }) {
  const app = useApp();
  const g = goal && goal !== 'new' ? goal : null;
  const now = new Date();
  const [name, setName] = useState('');
  const [type, setType] = useState<'monthly' | 'yearly'>('monthly');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!goal) return;
    setErr(null);
    setName(g?.name ?? ''); setType(g?.type ?? 'monthly'); setTarget(g ? baisaToString(g.target) : ''); setSaved(g ? baisaToString(g.saved) : '');
    setYear(g?.year ?? app.period?.year ?? now.getFullYear()); setMonth(g?.month ?? app.period?.month ?? now.getMonth() + 1);
  }, [goal]);
  const save = async () => {
    const t = parseToBaisa(target), s = saved.trim() ? parseToBaisa(saved) : 0;
    if (!name.trim()) return setErr('اكتب اسم الهدف');
    if (!t) return setErr('أدخل مبلغ الهدف');
    if (s === null) return setErr('المبلغ المدخر غير صالح');
    await app.saveGoal({ id: g?.id ?? uid('goal'), name: name.trim(), type, target: t, saved: s, year, month: type === 'monthly' ? month : null, createdAt: g?.createdAt ?? Date.now() });
    app.toast('حُفظ الهدف');
    onClose();
  };
  return (
    <Modal open={!!goal} onClose={onClose} title={g ? 'تحديث الهدف' : 'هدف ادخار جديد'} footer={<>
      {g && <button className="btn-ghost text-red-600 me-auto" onClick={() => app.askConfirm({ title: 'حذف الهدف؟', body: g.name, danger: true, confirmLabel: 'حذف', onConfirm: async () => { await app.deleteGoal(g.id); onClose(); } })}><Trash2 size={16} /> حذف</button>}
      <button className="btn-soft" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="label" htmlFor="g-name">اسم الهدف</label><input id="g-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: صندوق الطوارئ" /></div>
        <div><label className="label" htmlFor="g-type">النوع</label><select id="g-type" className="input" value={type} onChange={(e) => setType(e.target.value as any)}><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></div>
        <div className="grid grid-cols-2 gap-2">
          {type === 'monthly' && <div><label className="label" htmlFor="g-month">الشهر</label><select id="g-month" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS_AR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>}
          <div className={type === 'yearly' ? 'col-span-2' : ''}><label className="label" htmlFor="g-year">السنة</label><input id="g-year" type="number" className="input num" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
        </div>
        <div><label className="label" htmlFor="g-target">المبلغ المستهدف</label><input id="g-target" className="input num" dir="ltr" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0.000" /></div>
        <div><label className="label" htmlFor="g-saved">المدخر حتى الآن</label><input id="g-saved" className="input num" dir="ltr" inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0.000" /></div>
        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
