import { ArrowDownUp, Copy, Download, FolderInput, Plus, Search, Tag, Trash2, X, Car as CarIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CategorySelect } from '../components/TxEditor';
import { CategoryChip, CategoryDot, Empty, Modal, Money, PageHeader } from '../components/ui';
import { rootCategoryId } from '../lib/classifier';
import { formatDateAr, formatDateShort } from '../lib/dates';
import { toCSV, toExportRows, toXLSX, saveFile } from '../lib/files';
import { formatOMR } from '../lib/money';
import { countsAsSpending } from '../lib/metrics';
import { normalizeAr } from '../lib/text';
import { useApp } from '../store/AppContext';
import { useLookups, useSortedPeriods } from '../store/hooks';

type SortKey = 'date' | 'amount' | 'description' | 'category';

export function Transactions() {
  const app = useApp();
  const { txs, categories, cars, period, openEditor } = app;
  const lk = useLookups();
  const sortedPeriods = useSortedPeriods();
  const [q, setQ] = useState('');
  const [periodF, setPeriodF] = useState<string>('current');
  const [catF, setCatF] = useState('');
  const [carF, setCarF] = useState('');
  const [kindF, setKindF] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | 'category' | 'period' | 'car'>(null);
  const [bulkVal, setBulkVal] = useState('');

  const pid = periodF === 'current' ? period?.id ?? '' : periodF;
  const list = useMemo(() => {
    const nq = normalizeAr(q);
    let l = txs.filter((t) => (!pid || pid === 'all' || t.periodId === pid));
    if (catF) l = l.filter((t) => t.categoryId === catF || rootCategoryId(t.categoryId, categories) === catF);
    if (carF) l = l.filter((t) => (carF === 'none' ? !t.carId : t.carId === carF));
    if (kindF) l = l.filter((t) => t.kind === kindF);
    if (nq) l = l.filter((t) => normalizeAr(`${t.description} ${t.notes} ${t.groupLabel ?? ''} ${lk.cat.get(t.categoryId)?.name ?? ''}`).includes(nq) || String(t.amount / 1000).includes(nq));
    const cmp: Record<SortKey, (a: typeof l[0], b: typeof l[0]) => number> = {
      date: (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.createdAt - b.createdAt,
      amount: (a, b) => a.amount - b.amount,
      description: (a, b) => a.description.localeCompare(b.description, 'ar'),
      category: (a, b) => (lk.cat.get(a.categoryId)?.name ?? '').localeCompare(lk.cat.get(b.categoryId)?.name ?? '', 'ar'),
    };
    return [...l].sort((a, b) => cmp[sort.key](a, b) * sort.dir);
  }, [txs, pid, catF, carF, kindF, q, sort, categories, lk]);

  const total = list.filter(countsAsSpending).reduce((s, t) => s + t.amount, 0);
  const selected = list.filter((t) => sel.has(t.id));
  const allSel = list.length > 0 && selected.length === list.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'date' || key === 'amount' ? -1 : 1 }));
  const clearSel = () => setSel(new Set());

  const doExport = async (fmt: 'csv' | 'xlsx') => {
    const rows = toExportRows(list, categories, cars, app.periods);
    const name = `عزبتي-العمليات-${new Date().toISOString().slice(0, 10)}`;
    const res = fmt === 'csv'
      ? await saveFile(`${name}.csv`, toCSV(rows), 'text/csv;charset=utf-8')
      : await saveFile(`${name}.xlsx`, await toXLSX([{ name: 'العمليات', rows: rows as any, widths: [12, 7, 28, 22, 12, 22, 12, 18, 22, 24] }]));
    app.toast(res === 'saved' ? 'تم تجهيز الملف للتنزيل' : res === 'declined' ? 'أُلغي التنزيل' : 'تعذر حفظ الملف', res === 'saved' ? 'success' : 'error');
  };

  const applyBulk = async () => {
    const ids = selected.map((t) => t.id);
    if (!ids.length) return;
    if (bulk === 'category' && bulkVal) {
      await app.updateTxs(ids, { categoryId: bulkVal });
      await app.learnRules(selected.map((t) => ({ description: t.description, categoryId: bulkVal, carId: t.carId })));
      app.toast(`تم تغيير تصنيف ${ids.length} عملية`);
    } else if (bulk === 'period' && bulkVal) {
      await app.updateTxs(ids, { periodId: bulkVal });
      app.toast(`نُقلت ${ids.length} عملية إلى ${lk.period.get(bulkVal)?.name}`);
    } else if (bulk === 'car') {
      await app.updateTxs(ids, { carId: bulkVal || null });
      app.toast(`تم تحديث السيارة لـ ${ids.length} عملية`);
    }
    setBulk(null); setBulkVal(''); clearSel();
  };

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button onClick={() => sortBy(k)} className={`inline-flex items-center gap-1 hover:text-ink ${sort.key === k ? 'text-ink font-medium' : ''}`}>
      {children}<ArrowDownUp size={11} className={sort.key === k ? 'text-emerald' : 'opacity-40'} />
    </button>
  );

  return (
    <div>
      <PageHeader title="العمليات" subtitle={<span className="num">{list.length} عملية · الإجمالي المحتسب {formatOMR(total)}</span>}
        actions={<>
          <button className="btn-soft" onClick={() => doExport('csv')}><Download size={16} /> CSV</button>
          <button className="btn-soft" onClick={() => doExport('xlsx')}><Download size={16} /> Excel</button>
          <button className="btn-primary" onClick={() => openEditor()}><Plus size={16} /> إضافة</button>
        </>} />

      <div className="card p-3 mb-3 grid grid-cols-2 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-2">
        <div className="relative col-span-2 md:col-span-1">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted" />
          <input className="input h-10 pr-9" placeholder="ابحث في الوصف أو الملاحظات أو المبلغ" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
        </div>
        <select aria-label="الشهر المالي" className="input h-10 text-xs" value={periodF} onChange={(e) => { setPeriodF(e.target.value); clearSel(); }}>
          <option value="current">العزبة الحالية</option>
          <option value="all">كل الأشهر</option>
          {sortedPeriods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="التصنيف" className="input h-10 text-xs" value={catF} onChange={(e) => setCatF(e.target.value)}>
          <option value="">كل التصنيفات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? '↳ ' : ''}{c.name}</option>)}
        </select>
        <select aria-label="السيارة" className="input h-10 text-xs" value={carF} onChange={(e) => setCarF(e.target.value)}>
          <option value="">كل السيارات والجهات</option>
          {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">بلا سيارة</option>
        </select>
        <select aria-label="النوع" className="input h-10 text-xs" value={kindF} onChange={(e) => setKindF(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="expense">مصروف</option>
          <option value="transfer_own">تحويل بين حساباتي</option>
          <option value="transfer_person">مرسل لشخص</option>
        </select>
      </div>

      {selected.length > 0 && (
        <div className="sticky z-20 mb-3 card p-2.5 flex flex-wrap items-center gap-2 animate-rise border-emerald/40" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}>
          <button className="icon-btn" onClick={clearSel} aria-label="إلغاء التحديد"><X size={16} /></button>
          <span className="text-sm font-medium num">{selected.length} محددة · {formatOMR(selected.reduce((s, t) => s + t.amount, 0))}</span>
          <div className="flex flex-wrap gap-1.5 ms-auto">
            <button className="btn-soft btn-sm" onClick={() => { setBulk('category'); setBulkVal(selected[0].categoryId); }}><Tag size={14} /> تغيير التصنيف</button>
            <button className="btn-soft btn-sm" onClick={() => { setBulk('period'); setBulkVal(selected[0].periodId); }}><FolderInput size={14} /> نقل لشهر آخر</button>
            <button className="btn-soft btn-sm" onClick={() => { setBulk('car'); setBulkVal(selected[0].carId ?? ''); }}><CarIcon size={14} /> السيارة</button>
            <button className="btn-soft btn-sm" onClick={async () => { await app.duplicateTxs(selected.map((t) => t.id)); clearSel(); }}><Copy size={14} /> نسخ</button>
            <button className="btn-sm btn bg-red-500/10 text-red-600 hover:bg-red-500/20" onClick={() => app.askConfirm({
              title: `حذف ${selected.length} عملية؟`, body: `الإجمالي ${formatOMR(selected.reduce((s, t) => s + t.amount, 0))}. يمكنك التراجع خلال ثوانٍ بعد الحذف.`, danger: true, confirmLabel: 'حذف',
              onConfirm: async () => { await app.deleteTxs(selected.map((t) => t.id)); clearSel(); },
            })}><Trash2 size={14} /> حذف</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card"><Empty icon="Search" title="لا توجد عمليات مطابقة" body="غيّر عوامل التصفية أو أضف عملية جديدة." /></div>
      ) : (
        <div className="card overflow-hidden">
          {/* جدول الكمبيوتر */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-muted bg-sunk/50 border-b border-line">
                <tr className="text-start">
                  <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="تحديد الكل" className="accent-emerald w-4 h-4" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((t) => t.id)))} /></th>
                  <th className="text-start font-normal px-2"><SortBtn k="date">التاريخ</SortBtn></th>
                  <th className="text-start font-normal px-2"><SortBtn k="description">الوصف</SortBtn></th>
                  <th className="text-start font-normal px-2"><SortBtn k="category">التصنيف</SortBtn></th>
                  <th className="text-left font-normal px-2"><SortBtn k="amount">المبلغ</SortBtn></th>
                  <th className="text-start font-normal px-2">السيارة / الجهة</th>
                  <th className="text-start font-normal px-2">الشهر المالي</th>
                  <th className="text-start font-normal px-3">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((t) => (
                  <tr key={t.id} className={`hover:bg-sunk/50 cursor-pointer ${sel.has(t.id) ? 'bg-emerald/[.06]' : ''} ${t.kind === 'transfer_own' ? 'text-muted' : ''}`} onClick={() => openEditor(t)}>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="تحديد" className="accent-emerald w-4 h-4" checked={sel.has(t.id)} onChange={() => toggle(t.id)} /></td>
                    <td className="px-2 whitespace-nowrap num text-xs">{formatDateShort(t.date)}<span className="text-muted"> {t.time ?? ''}</span></td>
                    <td className="px-2 max-w-[260px]">
                      <div className="truncate font-medium">{t.description}</div>
                      {(t.groupLabel || t.kind !== 'expense') && <div className="text-[11px] text-muted truncate">{t.kind === 'transfer_own' ? 'تحويل بين حساباتي · غير محتسب' : t.kind === 'transfer_person' ? 'مبلغ مرسل لشخص' : t.groupLabel}</div>}
                    </td>
                    <td className="px-2 max-w-[200px]"><CategoryChip cat={lk.cat.get(t.categoryId)} /></td>
                    <td className="px-2 text-left"><Money value={t.amount} unit={false} className="font-semibold" /></td>
                    <td className="px-2 text-xs text-muted whitespace-nowrap">{t.carId ? lk.car.get(t.carId)?.name : t.subscriptionId ? lk.sub.get(t.subscriptionId)?.name : '—'}</td>
                    <td className="px-2 text-xs text-muted whitespace-nowrap">{lk.period.get(t.periodId)?.name}</td>
                    <td className="px-3 text-xs text-muted max-w-[180px] truncate">{t.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* قائمة الهاتف */}
          <ul className="md:hidden divide-y divide-line">
            <li className="flex items-center gap-3 px-4 py-2 text-[11px] text-muted bg-sunk/50">
              <input type="checkbox" aria-label="تحديد الكل" className="accent-emerald w-4 h-4" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((t) => t.id)))} />
              <span>تحديد الكل</span>
              <span className="ms-auto flex gap-3"><SortBtn k="date">التاريخ</SortBtn><SortBtn k="amount">المبلغ</SortBtn></span>
            </li>
            {list.map((t) => (
              <li key={t.id} className={`flex items-center gap-3 px-4 py-3 ${sel.has(t.id) ? 'bg-emerald/[.06]' : ''}`}>
                <input type="checkbox" aria-label="تحديد" className="accent-emerald w-4 h-4 shrink-0" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
                <button className="flex-1 min-w-0 flex items-center gap-3 text-start" onClick={() => openEditor(t)}>
                  <CategoryDot cat={lk.cat.get(t.categoryId)} size={34} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium truncate ${t.kind === 'transfer_own' ? 'text-muted' : ''}`}>{t.description}</span>
                    <span className="block text-[11px] text-muted truncate">{formatDateAr(t.date, false)}{t.time ? ` ${t.time}` : ''} · {lk.cat.get(t.categoryId)?.name}{t.carId ? ` · ${lk.car.get(t.carId)?.name}` : ''}</span>
                  </span>
                  <Money value={t.amount} unit={false} className="text-sm font-semibold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={bulk !== null} onClose={() => setBulk(null)}
        title={bulk === 'category' ? 'تغيير التصنيف' : bulk === 'period' ? 'نقل إلى شهر مالي آخر' : 'تحديد السيارة'}
        footer={<><button className="btn-soft" onClick={() => setBulk(null)}>إلغاء</button><button className="btn-primary" onClick={applyBulk}>تطبيق على {selected.length}</button></>}>
        {bulk === 'category' && <><label className="label" htmlFor="bulk-cat">التصنيف الجديد</label><CategorySelect id="bulk-cat" value={bulkVal} onChange={setBulkVal} /><p className="text-xs text-muted mt-2">سيتذكر البرنامج هذا التصنيف للأوصاف نفسها في الاستيرادات القادمة.</p></>}
        {bulk === 'period' && <><label className="label" htmlFor="bulk-p">الشهر المالي</label><select id="bulk-p" className="input" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}>{sortedPeriods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="text-xs text-muted mt-2">يبقى تاريخ كل عملية كما هو، ويتغير الشهر المالي فقط.</p></>}
        {bulk === 'car' && <><label className="label" htmlFor="bulk-car">السيارة</label><select id="bulk-car" className="input" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}><option value="">غير محددة</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></>}
      </Modal>
    </div>
  );
}
