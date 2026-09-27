import { Brain, Database, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card, CategoryDot, Modal, PageHeader, Segmented } from '../components/ui';
import { CATEGORY_ICONS, CATEGORY_PALETTE } from '../lib/defaults';
import { saveFile, validateBackup } from '../lib/files';
import type { BackupFile, Category } from '../lib/types';
import { uid, useApp } from '../store/AppContext';

export function SettingsPage() {
  const app = useApp();
  const { settings } = app;
  const [name, setName] = useState(settings.userName);
  const [catEdit, setCatEdit] = useState<Category | null | { parentId: string | null }>(null);
  const [restore, setRestore] = useState<{ file: string; data: BackupFile } | null>(null);
  const [restoreErr, setRestoreErr] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setName(settings.userName), [settings.userName]);

  const exportBackup = async () => {
    const b = app.makeBackup();
    const r = await saveFile(`عزبتي-نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 1), 'application/json');
    app.toast(r === 'saved' ? `تم تجهيز النسخة الاحتياطية (${b.transactions.length} عملية)` : r === 'declined' ? 'أُلغي التنزيل' : 'تعذر حفظ الملف', r === 'saved' ? 'success' : 'error');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setRestoreErr(null);
    try {
      const json = JSON.parse(await f.text());
      const v = validateBackup(json);
      if (v.ok) setRestore({ file: f.name, data: v.data });
      else setRestoreErr(v.errors);
    } catch { setRestoreErr(['تعذرت قراءة الملف: ليس JSON صالحًا']); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const roots = app.categories.filter((c) => !c.parentId);

  return (
    <div className="space-y-4">
      <PageHeader title="الإعدادات" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="الملف الشخصي والمظهر">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="set-name">الاسم في الترحيب</label>
              <div className="flex gap-2"><input id="set-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-soft" disabled={!name.trim() || name === settings.userName} onClick={async () => { await app.saveSettings({ userName: name.trim() }); app.toast('حُفظ الاسم'); }}>حفظ</button></div>
            </div>
            <div>
              <p className="label">المظهر</p>
              <Segmented value={settings.theme} onChange={(v) => app.saveSettings({ theme: v })} options={[{ value: 'system', label: 'حسب الجهاز' }, { value: 'light', label: 'نهاري' }, { value: 'dark', label: 'ليلي' }]} />
            </div>
            <div>
              <label className="label" htmlFor="set-anom">حساسية اكتشاف القيم غير المعتادة</label>
              <select id="set-anom" className="input" value={settings.anomalyFactor} onChange={(e) => app.saveSettings({ anomalyFactor: Number(e.target.value) })}>
                <option value={5}>عالية: 5 أضعاف المعتاد</option>
                <option value={10}>متوسطة: 10 أضعاف المعتاد</option>
                <option value={20}>منخفضة: 20 ضعف المعتاد</option>
              </select>
              <p className="text-[11px] text-muted mt-1">تُقارن كل عملية مستوردة بوسيط العمليات المشابهة، ولا تُنبه إلا إذا زاد الفرق عن 20 ر.ع.</p>
            </div>
          </div>
        </Card>

        <Card title="النسخ الاحتياطي ونقل البيانات">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-2xl bg-sunk p-3.5">
              <Database size={18} className="text-emerald shrink-0 mt-0.5" />
              <p className="text-xs text-muted leading-6">{app.persistent ? 'بياناتك محفوظة محليًا في هذا المتصفح (IndexedDB) وتبقى بعد الإغلاق. لا تُرسل لأي خدمة خارجية.' : 'التخزين الدائم غير متاح في هذا المتصفح الآن؛ البيانات مؤقتة حتى تصدّرها.'} للنقل إلى جهاز آخر: صدّر النسخة هنا، ثم استعدها هناك.</p>
            </div>
            <p className="text-xs text-muted num">{app.txs.length} عملية · {app.periods.length} عزبة · {app.categories.length} تصنيف · {app.cars.length} سيارة · {app.subs.length} اشتراك · {app.rules.length} قاعدة متعلمة</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={exportBackup}><Download size={16} /> تصدير نسخة JSON</button>
              <label className="btn-soft cursor-pointer" htmlFor="restore-file"><Upload size={16} /> استعادة نسخة</label>
              <input id="restore-file" ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            {restoreErr && <div className="rounded-xl bg-red-500/10 text-red-700 dark:text-red-300 p-3 text-xs space-y-1">{restoreErr.map((e) => <p key={e}>{e}</p>)}</div>}
            <div className="border-t border-line pt-3">
              <button className="btn-ghost text-red-600 px-0 hover:bg-transparent hover:underline" onClick={() => app.askConfirm({
                title: 'مسح جميع البيانات؟', danger: true, confirmLabel: 'مسح نهائي', typeToConfirm: 'مسح',
                body: `سيتم حذف ${app.txs.length} عملية وكل العزب والتصنيفات المخصصة والقواعد المتعلمة، وإعادة التطبيق لحالته الأولى. لا يمكن التراجع. صدّر نسخة احتياطية أولًا.`,
                onConfirm: async () => { await app.clearAll(); app.toast('مُسحت البيانات'); },
              })}><Trash2 size={16} /> مسح جميع البيانات</button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="التصنيفات" action={<button className="btn-soft btn-sm" onClick={() => setCatEdit({ parentId: null })}><Plus size={14} /> تصنيف</button>}>
        <ul className="divide-y divide-line -my-2">
          {roots.map((c) => {
            const kids = app.categories.filter((k) => k.parentId === c.id);
            const count = app.txs.filter((t) => t.categoryId === c.id || kids.some((k) => k.id === t.categoryId)).length;
            return (
              <li key={c.id} className="py-3">
                <div className="flex items-center gap-3">
                  <CategoryDot cat={c} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name} <span className="text-[11px] text-muted num">· {count} عملية</span></p>
                    <p className="text-[11px] text-muted truncate">{c.keywords.length ? c.keywords.join('، ') : 'بلا كلمات دالة'}</p>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => setCatEdit({ parentId: c.id })}><Plus size={14} /> فرعي</button>
                  <button className="icon-btn" onClick={() => setCatEdit(c)} aria-label="تعديل"><Pencil size={16} /></button>
                </div>
                {kids.length > 0 && (
                  <ul className="mt-2 ms-12 space-y-1">
                    {kids.map((k) => (
                      <li key={k.id} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full" style={{ background: k.color }} />
                        <span className="flex-1 truncate">{k.name} <span className="text-[11px] text-muted">{k.keywords.join('، ')}</span></span>
                        <button className="icon-btn w-8 h-8" onClick={() => setCatEdit(k)} aria-label="تعديل"><Pencil size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="ما تعلّمه البرنامج من تصحيحاتك" action={<Brain size={18} className="text-gold" />}>
        {app.rules.length === 0 ? <p className="text-sm text-muted">عندما تغيّر تصنيف عملية، يتذكر البرنامج اختيارك ويقترحه تلقائيًا في المرات القادمة.</p> : (
          <ul className="flex flex-wrap gap-2">
            {[...app.rules].sort((a, b) => b.updatedAt - a.updatedAt).map((r) => {
              const c = app.categories.find((x) => x.id === r.categoryId);
              return (
                <li key={r.key} className="chip bg-sunk text-ink py-1.5 ps-3 pe-1.5">
                  «{r.key}» ← <span style={{ color: c?.color }}>{c?.name}</span>{r.carId && <span className="text-muted">· {app.cars.find((x) => x.id === r.carId)?.name}</span>}
                  <button className="w-6 h-6 rounded-full hover:bg-line flex items-center justify-center" aria-label="نسيان القاعدة" onClick={async () => { await app.forgetRule(r.key); app.toast('حُذفت القاعدة'); }}>×</button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <CategoryModal state={catEdit} onClose={() => setCatEdit(null)} />
      <Modal open={!!restore} onClose={() => setRestore(null)} title="استعادة نسخة احتياطية" footer={<>
        <button className="btn-soft" onClick={() => setRestore(null)}>إلغاء</button>
        <button className="btn-danger" onClick={async () => { if (!restore) return; await app.restoreBackup(restore.data); app.toast(`استُعيدت ${restore.data.transactions.length} عملية`); setRestore(null); }}>استبدال البيانات الحالية</button>
      </>}>
        {restore && (
          <div className="text-sm space-y-2 leading-7">
            <p>الملف: <b>{restore.file}</b></p>
            <p className="text-muted">صُدّر في {new Date(restore.data.exportedAt).toLocaleString('ar-OM')}</p>
            <p>يحتوي على {restore.data.transactions.length} عملية و{restore.data.periods.length} عزبة.</p>
            <p className="text-red-600 text-xs">ستُستبدل بيانات هذا الجهاز الحالية ({app.txs.length} عملية) بمحتوى الملف.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CategoryModal({ state, onClose }: { state: Category | null | { parentId: string | null }; onClose: () => void }) {
  const app = useApp();
  const existing = state && 'id' in state ? state : null;
  const parentId = existing ? existing.parentId : state && 'parentId' in state ? state.parentId : null;
  const parent = app.categories.find((c) => c.id === parentId);
  const [f, setF] = useState({ name: '', icon: 'CircleDashed', color: CATEGORY_PALETTE[0], keywords: '' });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!state) return;
    setErr(null);
    setF({ name: existing?.name ?? '', icon: existing?.icon ?? parent?.icon ?? 'CircleDashed', color: existing?.color ?? parent?.color ?? CATEGORY_PALETTE[app.categories.length % CATEGORY_PALETTE.length], keywords: existing?.keywords.join('، ') ?? '' });
  }, [state]);
  const save = async () => {
    if (!f.name.trim()) return setErr('اكتب اسم التصنيف');
    await app.saveCategory({
      id: existing?.id ?? uid('cat'), name: f.name.trim(), icon: f.icon, color: f.color,
      keywords: f.keywords.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      builtin: existing?.builtin ?? false, parentId, order: existing?.order ?? (parent ? parent.order + 0.5 : Math.max(...app.categories.map((c) => c.order)) + 1),
    });
    app.toast('حُفظ التصنيف');
    onClose();
  };
  const count = existing ? app.txs.filter((t) => t.categoryId === existing.id).length : 0;
  return (
    <Modal open={!!state} onClose={onClose} title={existing ? `تعديل ${existing.name}` : parent ? `تصنيف فرعي ضمن ${parent.name}` : 'تصنيف جديد'} footer={<>
      {existing && !existing.builtin && existing.id !== 'other' && <button className="btn-ghost text-red-600 me-auto" onClick={() => app.askConfirm({ title: `حذف ${existing.name}؟`, body: count ? `${count} عملية ستنتقل إلى ${parent?.name ?? 'أخرى'}.` : undefined, danger: true, confirmLabel: 'حذف', onConfirm: async () => { await app.deleteCategory(existing.id); onClose(); } })}><Trash2 size={16} /> حذف</button>}
      <button className="btn-soft" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></>}>
      <div className="space-y-4">
        <div><label className="label" htmlFor="c-name">الاسم</label><input id="c-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="c-kw">الكلمات الدالة للتصنيف التلقائي (مفصولة بفاصلة)</label><textarea id="c-kw" className="input h-20 py-2" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></div>
        <div>
          <p className="label">الأيقونة</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_ICONS.map((i) => <button key={i} onClick={() => setF({ ...f, icon: i })} className={`w-9 h-9 rounded-xl flex items-center justify-center ${f.icon === i ? 'bg-navy text-white dark:bg-emerald dark:text-navy-950' : 'bg-sunk text-muted hover:text-ink'}`} aria-label={i}><Icon name={i} size={16} /></button>)}
          </div>
        </div>
        <div>
          <p className="label">اللون</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_PALETTE.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} className={`w-8 h-8 rounded-full ${f.color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-ink' : ''}`} style={{ background: c }} aria-label={c} />)}
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
