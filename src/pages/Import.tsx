import { AlertTriangle, ArrowLeftRight, Check, ClipboardPaste, Copy, FileText, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Route } from '../components/Layout';
import { CategorySelect } from '../components/TxEditor';
import { CategoryDot, Money, PageHeader, Segmented } from '../components/ui';
import { rootCategoryId } from '../lib/classifier';
import { CAT } from '../lib/defaults';
import { formatDateAr, MONTHS_AR, periodLabel } from '../lib/dates';
import { baisaToString, formatOMR, parseToBaisa } from '../lib/money';
import { blockingIssues, parseWhatsApp, rowToTransaction, type DateOrder, type ParsedRow, type ParseResult } from '../lib/parser';
import type { TxKind } from '../lib/types';
import sampleChat from '../sample/demo-chat.txt?raw';
import { periodId as makePeriodId, useApp } from '../store/AppContext';
import { useSortedPeriods } from '../store/hooks';

type Filter = 'all' | 'review' | 'dup' | 'excluded';
type Row = ParsedRow & { suggested: string; amountText: string };

const STEPS = ['لصق البيانات', 'تحليل الرسائل', 'مراجعة', 'تعديل', 'اعتماد', 'تحديث اللوحة'];

export function ImportPage({ go }: { go: (r: Route) => void }) {
  const app = useApp();
  const sorted = useSortedPeriods();
  const [text, setText] = useState('');
  const [order, setOrder] = useState<DateOrder>('dmy');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [target, setTarget] = useState<{ year: number; month: number }>(() => ({ year: app.period?.year ?? new Date().getFullYear(), month: app.period?.month ?? new Date().getMonth() + 1 }));
  const [extend, setExtend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const step = !result ? 0 : 2;
  const targetId = makePeriodId(target.year, target.month);
  const targetPeriod = app.periods.find((p) => p.id === targetId) ?? null;
  const targetStart = targetPeriod?.startDate ?? `${target.year}-${String(target.month).padStart(2, '0')}-01`;
  const targetEnd = targetPeriod?.endDate ?? `${target.year}-${String(target.month).padStart(2, '0')}-${new Date(Date.UTC(target.year, target.month, 0)).getUTCDate()}`;

  const analyze = () => {
    const r = parseWhatsApp(text, {
      categories: app.categories, cars: app.cars, subscriptions: app.subs, rules: app.rules, existing: app.txs,
      targetYear: target.year, targetMonth: target.month, dateOrder: order, anomalyFactor: app.settings.anomalyFactor,
    });
    setResult(r);
    setRows(r.rows.map((x) => ({ ...x, suggested: x.categoryId, amountText: baisaToString(x.amount) })));
    setFilter(r.rows.some((x) => needsReview(x)) ? 'review' : 'all');
    setShowIssues(false);
  };

  const update = (uid: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...p } : r)));

  const included = rows.filter((r) => r.include);
  const spendTotal = included.filter((r) => r.kind !== 'transfer_own').reduce((s, r) => s + r.amount, 0);
  const issues = blockingIssues(rows);
  const blocked = issues.unconfirmedAnomalies.length + issues.undecidedTransfers.length + issues.invalidAmounts.length;
  const minDate = included.map((r) => r.date).filter(Boolean).sort()[0] as string | undefined;
  const maxDate = included.map((r) => r.date).filter(Boolean).sort().pop() as string | undefined;
  const needsStartShift = !!minDate && minDate < targetStart;
  const needsEndShift = !!maxDate && maxDate > targetEnd;

  const visible = useMemo(() => rows.filter((r) => {
    if (filter === 'review') return r.include && needsReview(r);
    if (filter === 'dup') return !!r.flags.duplicate;
    if (filter === 'excluded') return !r.include;
    return true;
  }), [rows, filter]);

  const catPreview = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of included) if (r.kind !== 'transfer_own') { const id = rootCategoryId(r.categoryId, app.categories); m.set(id, (m.get(id) ?? 0) + r.amount); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [included, app.categories]);

  const approve = async () => {
    if (blocked) { setShowIssues(true); setFilter('review'); return; }
    if (!included.length) return;
    setBusy(true);
    try {
      const opts: Record<string, string> = {};
      if (extend && needsStartShift) opts.startDate = minDate!;
      if (extend && needsEndShift) opts.endDate = maxDate!;
      const p = await app.ensurePeriod(target.year, target.month, opts);
      const list = included.map((r) => rowToTransaction(r, p.id, p.startDate));
      await app.addTxs(list);
      const corrections = included.filter((r) => r.categoryId !== r.suggested).map((r) => ({ description: r.description, categoryId: r.categoryId, carId: r.carId }));
      await app.learnRules(corrections);
      app.setPeriodId(p.id);
      app.toast(`تم اعتماد ${list.length} عملية بقيمة ${formatOMR(spendTotal)} في ${p.name}`);
      setResult(null); setRows([]); setText('');
      go('dashboard');
    } finally { setBusy(false); }
  };

  const yearOpts = Array.from(new Set([...sorted.map((p) => p.year), new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1])).sort();

  return (
    <div>
      <PageHeader title="استيراد مصاريف واتساب" subtitle="الصق المحادثة كما هي، ثم راجع العمليات المستخرجة قبل اعتمادها. لا يُحفظ شيء قبل الاعتماد." />

      <ol className="flex gap-1.5 overflow-x-auto scroll-thin pb-2 mb-4 -mx-1 px-1">
        {STEPS.map((s, i) => {
          const done = i < step || (step === 2 && i === 3 && rows.some((r) => r.categoryId !== r.suggested));
          const current = i === step || (step === 2 && i === 3);
          return (
            <li key={s} className={`flex items-center gap-2 shrink-0 rounded-full ps-1.5 pe-3 h-8 text-xs ${current ? 'bg-navy text-white dark:bg-emerald dark:text-navy-950' : done ? 'bg-emerald/10 text-emerald' : 'bg-sunk text-muted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] num ${current ? 'bg-white/15' : done ? 'bg-emerald text-white' : 'bg-surface'}`}>{done ? <Check size={11} /> : i + 1}</span>
              {s}
            </li>
          );
        })}
      </ol>

      {!result ? (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card p-5 lg:col-span-2">
            <label htmlFor="wa-text" className="label">نص المحادثة</label>
            <textarea id="wa-text" dir="auto" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
              placeholder={'[23/08, 10:58 pm] .: فاتورة الكهرباء ٥٩\n[23/08, 10:58 pm] .: فاتورة الماء ١٤.٦\n[29/08, 7:13 pm] .: اللولو٩٩.٦'}
              className="input h-[340px] py-3 font-mono text-[13px] leading-7 resize-y" />
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button className="btn-emerald" disabled={!text.trim()} onClick={analyze}><Wand2 size={16} /> تحليل الرسائل</button>
              <button className="btn-soft" onClick={() => setText(sampleChat)}><FileText size={16} /> تجربة بمحادثة نموذجية</button>
              {text && <button className="btn-ghost" onClick={() => setText('')}><RotateCcw size={16} /> مسح</button>}
              <span className="text-xs text-muted ms-auto num">{text ? `${text.split('\n').filter((l) => l.trim()).length} سطر` : ''}</span>
            </div>
          </div>
          <div className="card p-5 space-y-5">
            <div>
              <p className="label">إضافة جميع العمليات إلى</p>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="الشهر" className="input" value={target.month} onChange={(e) => setTarget({ ...target, month: Number(e.target.value) })}>
                  {MONTHS_AR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select aria-label="السنة" className="input num" value={target.year} onChange={(e) => setTarget({ ...target, year: Number(e.target.value) })}>
                  {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <p className="text-xs text-muted mt-2 leading-6">
                {targetPeriod ? <>ستُضاف إلى <b className="text-ink">{targetPeriod.name}</b> الموجودة.</> : <>ستُنشأ <b className="text-ink">{periodLabel(target.year, target.month)}</b> تلقائيًا.</>}
                {' '}يبقى تاريخ كل عملية كما ورد في الرسالة.
              </p>
            </div>
            <div>
              <p className="label">صيغة التاريخ في المحادثة</p>
              <Segmented value={order} onChange={setOrder} options={[{ value: 'dmy', label: 'يوم/شهر' }, { value: 'mdy', label: 'شهر/يوم' }]} />
            </div>
            <div className="rounded-2xl bg-sunk p-4 text-xs text-muted leading-6 space-y-1.5">
              <p className="font-medium text-ink flex items-center gap-1.5"><Sparkles size={14} className="text-gold" /> ما يتعامل معه المحرك</p>
              <p>الأرقام العربية والإنجليزية: ١٤.٦ = 14.600</p>
              <p>المبلغ الملتصق بالنص: «اللولو٩٩.٦»</p>
              <p>المبلغ وسط النص: «بترول ١٣ أي أس»</p>
              <p>الرسائل بلا مبلغ تُعامل كعنوان مجموعة، لا كمصروف صفري</p>
              <p>القيم غير المعتادة والتحويلات تحتاج تأكيدك</p>
              <p>العمليات المستوردة سابقًا تُكتشف وتُستبعد</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* الملخص */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4"><p className="text-xs text-muted">عمليات للاعتماد</p><p className="text-2xl font-semibold num mt-1">{included.length}<span className="text-sm text-muted font-normal"> / {rows.length}</span></p></div>
            <div className="card p-4"><p className="text-xs text-muted">الإجمالي المحتسب</p><Money value={spendTotal} className="text-2xl font-semibold mt-1 block" /></div>
            <div className="card p-4"><p className="text-xs text-muted">عناوين وملاحظات (غير محتسبة)</p><p className="text-2xl font-semibold num mt-1">{result.headings.length}</p><p className="text-[11px] text-muted truncate">{result.headings.map((h) => h.text).join('، ')}</p></div>
            <div className={`card p-4 ${blocked ? 'border-amber-500/50' : ''}`}><p className="text-xs text-muted">تحتاج قرارك</p><p className={`text-2xl font-semibold num mt-1 ${blocked ? 'text-amber-600' : 'text-emerald'}`}>{blocked}</p><p className="text-[11px] text-muted">{blocked ? 'قيم غير معتادة أو تحويلات' : 'كل شيء جاهز'}</p></div>
          </div>

          {/* الفترة */}
          <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <span>الشهر المالي: <b>{targetPeriod?.name ?? periodLabel(target.year, target.month)}</b> <span className="text-muted text-xs">({formatDateAr(targetStart)} ← {formatDateAr(targetEnd)})</span></span>
            <span className="text-muted text-xs">تواريخ الرسائل: {minDate ? formatDateAr(minDate) : '—'} ← {maxDate ? formatDateAr(maxDate) : '—'}</span>
            {(needsStartShift || needsEndShift) && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" className="accent-emerald w-4 h-4" checked={extend} onChange={(e) => setExtend(e.target.checked)} />
                تعديل فترة العزبة لتبدأ {needsStartShift ? formatDateAr(minDate!) : formatDateAr(targetStart)} وتنتهي {needsEndShift ? formatDateAr(maxDate!) : formatDateAr(targetEnd)}
              </label>
            )}
          </div>

          {catPreview.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
              {catPreview.map(([id, total]) => {
                const c = app.categories.find((x) => x.id === id);
                return <span key={id} className="chip bg-surface border border-line shrink-0 py-1.5"><CategoryDot cat={c} size={20} /> {c?.name} <Money value={total} unit={false} className="font-semibold" /></span>;
              })}
            </div>
          )}

          {showIssues && blocked > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">لا يمكن الاعتماد قبل حسم هذه الصفوف:</p>
                <ul className="list-disc ps-5 mt-1 text-xs leading-6">
                  {issues.unconfirmedAnomalies.length > 0 && <li>{issues.unconfirmedAnomalies.length} قيمة غير معتادة: أكّدها أو عدّل المبلغ أو استبعدها.</li>}
                  {issues.undecidedTransfers.length > 0 && <li>{issues.undecidedTransfers.length} تحويل: حدد إن كان بين حساباتك أو مصروفًا أو مبلغًا مرسلًا لشخص.</li>}
                  {issues.invalidAmounts.length > 0 && <li>{issues.invalidAmounts.length} مبلغ غير صالح.</li>}
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <Segmented value={filter} onChange={setFilter} options={[
              { value: 'all', label: `الكل ${rows.length}` },
              { value: 'review', label: `للمراجعة ${rows.filter((r) => r.include && needsReview(r)).length}` },
              { value: 'dup', label: `مكررة ${rows.filter((r) => r.flags.duplicate).length}` },
              { value: 'excluded', label: `مستبعدة ${rows.filter((r) => !r.include).length}` },
            ]} />
            <div className="flex gap-2">
              <button className="btn-soft" onClick={() => { setResult(null); setRows([]); }}><ClipboardPaste size={16} /> تعديل النص</button>
              <button className="btn-emerald" disabled={busy || !included.length} onClick={approve}><Check size={16} /> اعتماد {included.length} عملية</button>
            </div>
          </div>

          {/* جدول المراجعة */}
          <div className="card overflow-hidden">
            <div className="hidden lg:grid grid-cols-[36px_110px_minmax(0,1.4fr)_110px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-3 px-4 py-2.5 text-[11px] text-muted border-b border-line bg-sunk/50">
              <span />
              <span>التاريخ والوقت</span><span>الوصف</span><span>المبلغ</span><span>التصنيف</span><span>السيارة / النوع</span><span>ملاحظات المراجعة</span>
            </div>
            {visible.length === 0 && <p className="p-6 text-sm text-muted text-center">لا توجد صفوف في هذا التصنيف.</p>}
            <ul className="divide-y divide-line">
              {visible.map((r) => <ReviewRow key={r.uid} r={r} update={update} />)}
            </ul>
          </div>

          {result.skipped.length > 0 && (
            <details className="card p-4 text-sm">
              <summary className="cursor-pointer text-muted">أسطر لم تُستورد ({result.skipped.length})</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {result.skipped.map((s) => <li key={s.lineNo} className="flex gap-3"><span className="num text-muted w-10">#{s.lineNo}</span><code className="flex-1 truncate" dir="auto">{s.raw}</code><span className="text-muted">{s.reason}</span></li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function needsReview(r: ParsedRow) {
  return (!!r.flags.anomaly && !r.confirmed) || r.kind === null || !!r.flags.duplicate || !!r.flags.carUnknown || r.confidence === 'none' || !!r.flags.multipleNumbers || !!r.flags.noDate;
}

function ReviewRow({ r, update }: { r: Row; update: (uid: string, p: Partial<Row>) => void }) {
  const app = useApp();
  const root = rootCategoryId(r.categoryId, app.categories);
  const cat = app.categories.find((c) => c.id === r.categoryId);
  const setAmount = (v: string) => {
    const b = parseToBaisa(v);
    update(r.uid, { amountText: v, amount: b ?? NaN, ...(r.flags.anomaly && b !== null && b !== r.amount ? { confirmed: true } : {}) });
  };
  return (
    <li className={`px-4 py-3 lg:grid lg:grid-cols-[36px_110px_minmax(0,1.4fr)_110px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-3 lg:items-center flex flex-col gap-2.5 transition ${r.include ? '' : 'opacity-50'} ${r.include && ((r.flags.anomaly && !r.confirmed) || r.kind === null) ? 'bg-amber-500/[.06]' : ''}`}>
      <div className="flex items-center gap-3 lg:contents">
        <input type="checkbox" aria-label="تضمين" className="accent-emerald w-4 h-4" checked={r.include} onChange={(e) => update(r.uid, { include: e.target.checked })} />
        <div className="text-xs leading-5 lg:order-none">
          <input type="date" aria-label="التاريخ" className="bg-transparent text-xs num w-[108px] focus:outline-none" value={r.date ?? ''} onChange={(e) => update(r.uid, { date: e.target.value || null })} />
          <div className="text-muted num">{r.time ?? '—'} <span className="opacity-60">· #{r.lineNo}</span></div>
        </div>
        <span className="lg:hidden ms-auto"><CategoryDot cat={cat} size={28} /></span>
      </div>
      <div className="min-w-0">
        <input aria-label="الوصف" className="input h-9" value={r.description} onChange={(e) => update(r.uid, { description: e.target.value })} />
        {r.groupLabel && <p className="text-[11px] text-gold-dark dark:text-gold mt-1 truncate">مجموعة: {r.groupLabel}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:contents">
        <input aria-label="المبلغ" dir="ltr" inputMode="decimal" className={`input h-9 num text-left ${Number.isNaN(r.amount) ? 'border-red-500' : ''}`} value={r.amountText} onChange={(e) => setAmount(e.target.value)} />
        <CategorySelect className="input h-9 text-xs" value={r.categoryId} onChange={(v) => update(r.uid, { categoryId: v, confidence: 'learned', flags: { ...r.flags, carUnknown: rootCategoryId(v, app.categories) === CAT.cars && !r.carId ? true : undefined } })} />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-1.5">
        {root === CAT.cars || r.carId ? (
          <select aria-label="السيارة" className={`input h-9 text-xs ${r.flags.carUnknown && !r.carId ? 'border-amber-500' : ''}`} value={r.carId ?? ''} onChange={(e) => update(r.uid, { carId: e.target.value || null })}>
            <option value="">السيارة غير محددة</option>
            {app.cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : null}
        {r.flags.transfer || r.kind !== 'expense' ? (
          <select aria-label="نوع التحويل" className={`input h-9 text-xs ${r.kind === null ? 'border-amber-500 ring-2 ring-amber-500/20' : ''}`} value={r.kind ?? ''} onChange={(e) => update(r.uid, { kind: (e.target.value || null) as TxKind | null })}>
            <option value="">حدد نوع التحويل…</option>
            <option value="transfer_own">تحويل بين حساباتي (لا يُحتسب)</option>
            <option value="expense">مصروف</option>
            <option value="transfer_person">مبلغ مرسل لشخص آخر</option>
          </select>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5 items-center text-[11px]">
        {r.flags.anomaly && (
          r.confirmed ? (
            <span className="chip bg-emerald/10 text-emerald"><Check size={12} /> تم التأكيد</span>
          ) : (
            <div className="w-full rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-300 p-2 leading-5">
              <p><AlertTriangle size={12} className="inline -mt-0.5" /> قيمة مرتفعة: {r.flags.anomaly.ratio}× وسيط «{r.flags.anomaly.basis}» ({formatOMR(r.flags.anomaly.median)} في {r.flags.anomaly.samples} عمليات)</p>
              <div className="flex gap-1.5 mt-1.5">
                <button className="btn-sm btn bg-amber-500 text-white" onClick={() => update(r.uid, { confirmed: true })}>تأكيد {formatOMR(r.amount)}</button>
                <button className="btn-sm btn-soft" onClick={() => update(r.uid, { include: false })}>استبعاد</button>
              </div>
            </div>
          )
        )}
        {r.kind === null && <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300"><ArrowLeftRight size={12} /> تحويل: حدد نوعه</span>}
        {r.flags.duplicate === 'saved' && <span className="chip bg-red-500/10 text-red-600 dark:text-red-400"><Copy size={12} /> مستورد سابقًا</span>}
        {r.flags.duplicate === 'similar' && <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300"><Copy size={12} /> مشابهة لعملية محفوظة</span>}
        {r.flags.duplicate === 'batch' && <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300"><Copy size={12} /> مكررة في النص</span>}
        {r.flags.carUnknown && !r.carId && <span className="chip bg-sunk text-muted">اختر السيارة</span>}
        {r.flags.multipleNumbers && <span className="chip bg-sunk text-muted">أكثر من رقم: أُخذ الأخير</span>}
        {r.flags.noDate && <span className="chip bg-sunk text-muted">بلا تاريخ</span>}
        {!r.flags.anomaly && r.kind !== null && (
          <span className="text-muted truncate max-w-full" title={r.raw}>
            {r.categoryId !== r.suggested ? 'صُحح يدويًا · سيتذكره البرنامج' : r.confidence === 'none' ? 'لم يُعرف التصنيف' : r.reason}
          </span>
        )}
      </div>
    </li>
  );
}
