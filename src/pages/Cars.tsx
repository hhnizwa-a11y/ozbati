import { Car as CarIcon, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Modal, Money, PageHeader, Segmented } from '../components/ui';
import { formatDateAr } from '../lib/dates';
import { carMonthly, carSummaries, countsAsSpending, isCarTx, isFuel } from '../lib/metrics';
import { formatOMR, formatShort } from '../lib/money';
import type { Car } from '../lib/types';
import { uid, useApp } from '../store/AppContext';

const CAR_COLORS = ['#10B981', '#3B6EA8', '#D6AC59', '#8B5CF6', '#E08A3C', '#0EA5B7'];

export function Cars() {
  const app = useApp();
  const { cars, txs, categories, period } = app;
  const [scope, setScope] = useState<'period' | 'all'>('period');
  const [edit, setEdit] = useState<Car | null | 'new'>(null);
  const scoped = useMemo(() => txs.filter((t) => countsAsSpending(t) && (scope === 'all' || t.periodId === period?.id)), [txs, scope, period]);
  const sums = carSummaries(scoped, cars, categories);
  const monthly = carMonthly(app.periods, txs, cars, categories);
  const unassigned = scoped.filter((t) => isCarTx(t, categories) && !t.carId).sort((a, b) => b.date.localeCompare(a.date));
  const compare = sums.filter((s) => s.carId).map((s) => ({ name: s.name, fuel: s.fuel, maintenance: s.maintenance }));
  const grand = sums.reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="مصاريف السيارات" subtitle={<>إجمالي {scope === 'period' ? period?.name : 'كل الأشهر'}: <Money value={grand} /></>}
        actions={<><Segmented value={scope} onChange={setScope} options={[{ value: 'period', label: 'العزبة الحالية' }, { value: 'all', label: 'كل الأشهر' }]} /><button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> سيارة</button></>} />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cars.map((car, i) => {
          const s = sums.find((x) => x.carId === car.id)!;
          const list = scoped.filter((t) => t.carId === car.id).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={car.id} className="card overflow-hidden flex flex-col">
              <div className="relative h-28 bg-navy flex items-center justify-center overflow-hidden">
                {car.image ? <img src={car.image} alt={car.name} className="absolute inset-0 w-full h-full object-cover opacity-90" /> : <CarIcon size={54} strokeWidth={1.2} style={{ color: CAR_COLORS[i % CAR_COLORS.length] }} />}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent p-3 flex items-end justify-between">
                  <div className="text-white"><p className="font-semibold">{car.name}</p><p className="text-[11px] text-white/60">{[car.year, car.plate, car.color].filter(Boolean).join(' · ') || car.aliases.slice(0, 2).join('، ')}</p></div>
                  <button className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 flex items-center justify-center" onClick={() => setEdit(car)} aria-label="تعديل"><Pencil size={14} /></button>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2 text-center border-b border-line">
                <div><p className="text-[11px] text-muted">الوقود</p><Money value={s?.fuel ?? 0} unit={false} className="font-semibold" /></div>
                <div><p className="text-[11px] text-muted">الصيانة وغيرها</p><Money value={s?.maintenance ?? 0} unit={false} className="font-semibold" /></div>
                <div><p className="text-[11px] text-muted">الإجمالي</p><Money value={s?.total ?? 0} unit={false} className="font-semibold text-emerald" /></div>
              </div>
              <ul className="divide-y divide-line text-sm flex-1 max-h-56 overflow-y-auto scroll-thin">
                {list.map((t) => (
                  <li key={t.id}><button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-sunk/50 text-start" onClick={() => app.openEditor(t)}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isFuel(t) ? 'bg-gold' : 'bg-navy/40 dark:bg-white/40'}`} />
                    <span className="flex-1 truncate">{t.description}</span>
                    <span className="text-[11px] text-muted">{formatDateAr(t.date, false)}</span>
                    <Money value={t.amount} unit={false} className="w-14 text-left" />
                  </button></li>
                ))}
                {!list.length && <li className="px-4 py-4 text-xs text-muted">لا توجد مصاريف لهذه السيارة في الفترة المحددة.</li>}
              </ul>
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <Card title={`مصاريف سيارات دون تحديد السيارة (${unassigned.length})`} action={<Money value={unassigned.reduce((s, t) => s + t.amount, 0)} className="text-sm font-semibold" />}>
          <ul className="divide-y divide-line -my-2">
            {unassigned.map((t) => (
              <li key={t.id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1 min-w-[120px] truncate">{t.description} <span className="text-[11px] text-muted">· {formatDateAr(t.date, false)}</span></span>
                <Money value={t.amount} unit={false} className="font-medium" />
                <select aria-label="اختر السيارة" className="input h-9 w-40 text-xs" value="" onChange={async (e) => { await app.updateTx(t.id, { carId: e.target.value }); await app.learnRules([{ description: t.description, categoryId: t.categoryId, carId: e.target.value }]); app.toast(`نُسبت إلى ${cars.find((c) => c.id === e.target.value)?.name}`); }}>
                  <option value="" disabled>اختر السيارة…</option>
                  {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="المقارنة بين السيارات">
          <div dir="ltr" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compare} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="35%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} reversed />
                <YAxis tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} width={44} orientation="right" />
                <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} formatter={(v: any, n: any) => [formatOMR(Number(v)), n]} contentStyle={{ direction: 'rtl', borderRadius: 12, fontFamily: 'Readex Pro', fontSize: 12, background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))' }} />
                <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted">{v}</span>} />
                <Bar name="الوقود" dataKey="fuel" fill="#D6AC59" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar name="الصيانة وغيرها" dataKey="maintenance" fill="#3B6EA8" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="تطور المصاريف شهريًا">
          <div dir="ltr" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="30%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} reversed />
                <YAxis tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} width={44} orientation="right" />
                <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} formatter={(v: any, n: any) => [formatOMR(Number(v)), n]} contentStyle={{ direction: 'rtl', borderRadius: 12, fontFamily: 'Readex Pro', fontSize: 12, background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))' }} />
                <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted">{v}</span>} />
                {cars.map((c, i) => <Bar key={c.id} name={c.name} dataKey={c.id} fill={CAR_COLORS[i % CAR_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={28} />)}
                <Bar name="غير محددة" dataKey="none" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <CarModal car={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

async function resizeImage(file: File, max = 640): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

function CarModal({ car, onClose }: { car: Car | null | 'new'; onClose: () => void }) {
  const app = useApp();
  const c = car && car !== 'new' ? car : null;
  const [f, setF] = useState({ name: '', aliases: '', plate: '', year: '', color: '', notes: '', image: null as string | null });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!car) return;
    setErr(null);
    setF({ name: c?.name ?? '', aliases: c?.aliases.join('، ') ?? '', plate: c?.plate ?? '', year: c?.year ?? '', color: c?.color ?? '', notes: c?.notes ?? '', image: c?.image ?? null });
  }, [car]);
  const save = async () => {
    if (!f.name.trim()) return setErr('اكتب اسم السيارة');
    await app.saveCar({ id: c?.id ?? uid('car'), name: f.name.trim(), aliases: f.aliases.split(/[،,]/).map((s) => s.trim()).filter(Boolean), plate: f.plate, year: f.year, color: f.color, notes: f.notes, image: f.image, createdAt: c?.createdAt ?? Date.now() });
    app.toast('حُفظت السيارة');
    onClose();
  };
  const used = c ? app.txs.filter((t) => t.carId === c.id).length : 0;
  return (
    <Modal open={!!car} onClose={onClose} title={c ? `تعديل ${c.name}` : 'إضافة سيارة'} footer={<>
      {c && <button className="btn-ghost text-red-600 me-auto" onClick={() => app.askConfirm({ title: `حذف ${c.name}؟`, body: used ? `${used} عملية مرتبطة بها ستصبح «غير محددة السيارة» ولن تُحذف.` : undefined, danger: true, confirmLabel: 'حذف', onConfirm: async () => { await app.deleteCar(c.id); onClose(); } })}><Trash2 size={16} /> حذف</button>}
      <button className="btn-soft" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex items-center gap-4">
          <label className="w-24 h-20 rounded-2xl bg-sunk flex items-center justify-center overflow-hidden cursor-pointer border border-dashed border-line shrink-0" htmlFor="car-img">
            {f.image ? <img src={f.image} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={22} className="text-muted" />}
          </label>
          <input id="car-img" type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, image: await resizeImage(file) }); }} />
          <div className="text-xs text-muted leading-6">صورة اختيارية للسيارة.{f.image && <button className="block text-red-600" onClick={() => setF({ ...f, image: null })}>إزالة الصورة</button>}</div>
        </div>
        <div className="col-span-2"><label className="label" htmlFor="car-name">الاسم</label><input id="car-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Lexus IS" /></div>
        <div className="col-span-2"><label className="label" htmlFor="car-al">الأسماء المختصرة في واتساب (مفصولة بفاصلة)</label><input id="car-al" className="input" value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })} placeholder="أي أس، IS" /><p className="text-[11px] text-muted mt-1">يستخدمها المحرك لنسبة «بترول أي أس» لهذه السيارة تلقائيًا.</p></div>
        <div><label className="label" htmlFor="car-plate">رقم اللوحة</label><input id="car-plate" className="input" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} /></div>
        <div><label className="label" htmlFor="car-year">سنة الصنع</label><input id="car-year" className="input num" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
        <div><label className="label" htmlFor="car-color">اللون</label><input id="car-color" className="input" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
        <div><label className="label" htmlFor="car-notes">ملاحظات</label><input id="car-notes" className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
