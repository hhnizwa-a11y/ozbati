import { Car, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../store/AppContext';

/** شاشة الترحيب الأولى: الاسم، وأسماء الأطفال، والسيارات. كلها قابلة للتعديل لاحقًا من الإعدادات. */
export function Onboarding() {
  const app = useApp();
  const [name, setName] = useState('');
  const [kids, setKids] = useState('');
  const [cars, setCars] = useState<{ name: string; aliases: string }[]>([{ name: '', aliases: '' }]);
  const [busy, setBusy] = useState(false);

  const finish = async (skip = false) => {
    setBusy(true);
    try {
      await app.completeOnboarding(skip ? { name: '', kids: [], cars: [] } : {
        name,
        kids: kids.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
        cars: cars.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), aliases: c.aliases.split(/[،,]/).map((s) => s.trim()).filter(Boolean) })),
      });
      app.toast(skip ? 'يمكنك تعديل بياناتك لاحقًا من الإعدادات' : `أهلًا ${name.trim() || 'بك'}، عزبتك جاهزة`);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-ground overflow-y-auto" role="dialog" aria-modal aria-labelledby="ob-title">
      <div className="min-h-full flex items-center justify-center px-4 py-8" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="w-full max-w-lg animate-sheet">
          <div className="rounded-3xl bg-navy text-white p-6 sm:p-7 relative overflow-hidden">
            <svg className="absolute -left-16 -top-16 opacity-[.08]" width="260" height="260" viewBox="0 0 200 200" aria-hidden>
              {[90, 70, 50, 30].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#D6AC59" strokeWidth="1.5" />)}
            </svg>
            <div className="relative flex items-center gap-3">
              <svg width="44" height="44" viewBox="0 0 512 512" aria-hidden><rect width="512" height="512" rx="120" fill="#0A1726" /><circle cx="256" cy="256" r="150" fill="none" stroke="#D6AC59" strokeWidth="28" /><path d="M196 262l44 44 84-96" fill="none" stroke="#10B981" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div>
                <h1 id="ob-title" className="text-2xl font-semibold">أهلًا بك في عزبتي</h1>
                <p className="text-gold text-sm">كل بيسة محسوبة</p>
              </div>
            </div>
            <p className="relative text-sm text-white/70 mt-4 leading-7">سجّل مصاريفك في واتساب كعادتك، والصقها هنا لتتحول إلى أرقام وتقارير. بياناتك تبقى على جهازك فقط.</p>
          </div>

          <form className="card p-5 sm:p-6 mt-4 space-y-5" onSubmit={(e) => { e.preventDefault(); void finish(); }}>
            <div>
              <label className="label" htmlFor="ob-name">اسمك كما تحب أن يظهر في الترحيب</label>
              <input id="ob-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أبو محمد" autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="ob-kids">أسماء أطفالك (اختياري)</label>
              <input id="ob-kids" className="input" value={kids} onChange={(e) => setKids(e.target.value)} placeholder="مثال: محمد، سارة" />
              <p className="text-[11px] text-muted mt-1.5">أي مصروف يُذكر فيه اسم أحدهم يُصنَّف تلقائيًا ضمن «التعليم والأطفال».</p>
            </div>
            <div>
              <p className="label">سياراتك (اختياري)</p>
              <div className="space-y-2">
                {cars.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-9 h-11 flex items-center justify-center text-muted shrink-0"><Car size={18} /></span>
                    <div className="grid sm:grid-cols-2 gap-2 flex-1">
                    <input aria-label="اسم السيارة" className="input" value={c.name} onChange={(e) => setCars(cars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="الاسم: Toyota Camry" />
                    <input aria-label="الاسم المختصر في واتساب" className="input" value={c.aliases} onChange={(e) => setCars(cars.map((x, j) => (j === i ? { ...x, aliases: e.target.value } : x)))} placeholder="في واتساب: الكامري" />
                    </div>
                    {cars.length > 1 && <button type="button" className="icon-btn shrink-0" onClick={() => setCars(cars.filter((_, j) => j !== i))} aria-label="إزالة"><X size={16} /></button>}
                  </div>
                ))}
              </div>
              {cars.length < 5 && <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => setCars([...cars, { name: '', aliases: '' }])}><Plus size={14} /> سيارة أخرى</button>}
              <p className="text-[11px] text-muted mt-1">إذا كتبت «بترول الكامري ١٢» تُنسب العملية لهذه السيارة تلقائيًا.</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className="btn-emerald flex-1 h-11" disabled={busy}><Sparkles size={16} /> ابدأ</button>
              <button type="button" className="btn-ghost h-11" disabled={busy} onClick={() => finish(true)}>تخطي</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
