import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from '../components/ui';
import { rootCategoryId } from '../lib/classifier';
import { CAT } from '../lib/defaults';
import { formatDateAr, formatDateShort, todayISO } from '../lib/dates';
import { elementToPDF, saveFile, toCSV, toExportRows, toXLSX } from '../lib/files';
import { localInsights } from '../lib/insights';
import { carSummaries, subscriptionStatuses } from '../lib/metrics';
import { baisaToString, formatOMR, pct } from '../lib/money';
import { useApp } from '../store/AppContext';
import { useDashboard, useSortedPeriods } from '../store/hooks';

const ROWS_PER_PAGE = 30;

function R({ v, strong = false }: { v: number | null | undefined; strong?: boolean }) {
  if (v === null || v === undefined) return <span>—</span>;
  const [r, b] = baisaToString(v).split('.');
  return <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 600 : 400, whiteSpace: 'nowrap' }}>{Number(r).toLocaleString('en-US')}<span style={{ opacity: 0.55 }}>.{b}</span></span>;
}

function Page({ children, n, of, title }: { children: ReactNode; n: number; of: number; title: string }) {
  return (
    <div data-pdf-page className="a4 relative flex flex-col" style={{ fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #10243A', paddingBottom: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 512 512"><rect width="512" height="512" rx="120" fill="#10243A" /><circle cx="256" cy="256" r="150" fill="none" stroke="#D6AC59" strokeWidth="28" /><path d="M196 262l44 44 84-96" fill="none" stroke="#10B981" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div><div style={{ fontWeight: 600, fontSize: 15 }}>عزبتي | Ozbati</div><div style={{ fontSize: 10, color: '#B08A3E' }}>كل بيسة محسوبة</div></div>
        </div>
        <div style={{ textAlign: 'left', fontSize: 10, color: '#5F7187' }}>{title}</div>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ borderTop: '1px solid #DFE5ED', paddingTop: 8, marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#7A8BA0' }}>
        <span>أُعد في {formatDateAr(todayISO())} · المبالغ بالريال العُماني (ر.ع)</span>
        <span>صفحة {n} من {of}</span>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'right', fontWeight: 500, color: '#5F7187', fontSize: 10.5, padding: '6px 8px', borderBottom: '1px solid #DFE5ED', background: '#F5F7FA' };
const td: React.CSSProperties = { padding: '5px 8px', borderBottom: '1px solid #EEF2F7', verticalAlign: 'top' };
const H = ({ children }: { children: ReactNode }) => <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: '18px 0 8px', color: '#10243A' }}>{children}</h3>;

export function Reports() {
  const app = useApp();
  const sorted = useSortedPeriods();
  const [pid, setPid] = useState(app.period?.id ?? '');
  const d = useDashboard(pid);
  const ref = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 794)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (!pid && app.period) setPid(app.period.id); }, [app.period, pid]);

  const data = useMemo(() => {
    if (!d) return null;
    const { categories, cars, txs, subs, today } = app;
    const cat = new Map(categories.map((c) => [c.id, c]));
    const carSum = carSummaries(d.txs, cars, categories).filter((s) => s.total > 0);
    const bills = d.txs.filter((t) => rootCategoryId(t.categoryId, categories) === CAT.home).sort((a, b) => a.date.localeCompare(b.date));
    const subPays = d.txs.filter((t) => rootCategoryId(t.categoryId, categories) === CAT.subscriptions).sort((a, b) => a.date.localeCompare(b.date));
    const subSt = subscriptionStatuses(subs, txs, d.period.id, today);
    const insights = localInsights({ dash: d, allTx: txs, categories, cars }).filter((i) => i.id !== 'total').slice(0, 9);
    const all = [...d.txs].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
    const chunks: typeof all[] = [];
    for (let i = 0; i < all.length; i += ROWS_PER_PAGE) chunks.push(all.slice(i, i + ROWS_PER_PAGE));
    return { cat, carSum, bills, subPays, subSt, insights, chunks };
  }, [d, app]);

  if (!d || !data) return null;
  const pages = 2 + data.chunks.length;
  const title = `التقرير الشهري · ${d.period.name}`;
  const nonzero = d.categories.filter((c) => c.total > 0);
  const maxCat = nonzero[0]?.total ?? 1;

  const exportPDF = async () => {
    if (!ref.current) return;
    setBusy('pdf');
    try {
      const blob = await elementToPDF(ref.current);
      const r = await saveFile(`تقرير-${d.period.name}.pdf`, blob, 'application/pdf');
      app.toast(r === 'saved' ? 'تم تجهيز ملف PDF' : r === 'declined' ? 'أُلغي التنزيل' : 'تعذر حفظ الملف', r === 'saved' ? 'success' : 'error');
    } catch { app.toast('تعذر إنشاء PDF', 'error'); } finally { setBusy(null); }
  };

  const exportXLSX = async () => {
    setBusy('xlsx');
    try {
      const n = (b: number | null) => (b === null ? '' : Number(baisaToString(b)));
      const summary = [
        { البند: 'الشهر المالي', القيمة: d.period.name },
        { البند: 'الفترة', القيمة: `${d.period.startDate} ← ${d.period.endDate}` },
        { البند: 'إجمالي المصاريف (ر.ع)', القيمة: n(d.total) },
        { البند: 'عدد العمليات', القيمة: d.count },
        { البند: 'الميزانية (ر.ع)', القيمة: d.budget === null ? 'غير محددة' : n(d.budget) },
        { البند: 'المتبقي (ر.ع)', القيمة: d.remaining === null ? '—' : n(d.remaining) },
        { البند: 'نسبة الاستهلاك %', القيمة: d.usedPct ?? '—' },
        { البند: 'متوسط المصروف اليومي (ر.ع)', القيمة: d.avgDaily === null ? '—' : n(d.avgDaily) },
        { البند: 'أعلى يوم إنفاق', القيمة: d.topDay ? `${d.topDay.date} (${baisaToString(d.topDay.total)})` : '—' },
        { البند: 'أكبر عملية', القيمة: d.largest ? `${d.largest.description} (${baisaToString(d.largest.amount)})` : '—' },
        { البند: 'الشهر السابق (ر.ع)', القيمة: d.prev ? n(d.prev.total) : 'لا توجد بيانات' },
        { البند: 'التغير %', القيمة: d.prev?.diffPct ?? '—' },
        { البند: 'المتوقع بنهاية الشهر (تقديري)', القيمة: d.forecast === null ? '—' : n(d.forecast) },
      ];
      const cats = d.categories.map((c) => ({ التصنيف: c.name, 'المبلغ (ر.ع)': n(c.total), 'النسبة %': c.share ?? 0, العمليات: c.count, 'الميزانية (ر.ع)': c.budget === null ? '' : n(c.budget), 'الاستهلاك %': c.used ?? '' }));
      const carsRows = data.carSum.map((s) => ({ السيارة: s.name, 'الوقود (ر.ع)': n(s.fuel), 'الصيانة وغيرها (ر.ع)': n(s.maintenance), 'الإجمالي (ر.ع)': n(s.total), العمليات: s.count }));
      const subsRows = data.subSt.map((s) => ({ الخدمة: s.sub.name, 'المبلغ المجدول': n(s.sub.amount), الدورية: s.sub.cycle, 'التجديد القادم': s.sub.nextRenewal ?? '', 'المدفوع هذا الشهر': n(s.paidInPeriod) }));
      const txRows = toExportRows(d.txs, app.categories, app.cars, app.periods);
      const blob = await toXLSX([
        { name: 'الملخص', rows: summary, widths: [30, 36] },
        { name: 'التصنيفات', rows: cats, widths: [26, 14, 10, 10, 14, 12] },
        { name: 'العمليات', rows: txRows as any, widths: [12, 7, 28, 22, 12, 22, 12, 18, 22, 24] },
        { name: 'السيارات', rows: carsRows, widths: [16, 14, 18, 14, 10] },
        { name: 'الاشتراكات', rows: subsRows, widths: [16, 14, 10, 14, 16] },
      ]);
      const r = await saveFile(`تقرير-${d.period.name}.xlsx`, blob);
      app.toast(r === 'saved' ? 'تم تجهيز ملف Excel' : r === 'declined' ? 'أُلغي التنزيل' : 'تعذر حفظ الملف', r === 'saved' ? 'success' : 'error');
    } finally { setBusy(null); }
  };

  const exportCSV = async () => {
    const r = await saveFile(`عمليات-${d.period.name}.csv`, toCSV(toExportRows(d.txs, app.categories, app.cars, app.periods)), 'text/csv;charset=utf-8');
    app.toast(r === 'saved' ? 'تم تجهيز ملف CSV' : r === 'declined' ? 'أُلغي التنزيل' : 'تعذر حفظ الملف', r === 'saved' ? 'success' : 'error');
  };

  return (
    <div>
      <PageHeader title="التقارير" subtitle="تقرير شهري بمقاس A4 جاهز للطباعة، يُصدَّر PDF بخط عربي متصل، أو Excel وCSV."
        actions={<>
          <select aria-label="الشهر المالي" className="input h-10 w-auto" value={pid} onChange={(e) => setPid(e.target.value)}>{sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button className="btn-primary" disabled={!!busy} onClick={exportPDF}>{busy === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF</button>
          <button className="btn-soft" disabled={!!busy} onClick={exportXLSX}>{busy === 'xlsx' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Excel</button>
          <button className="btn-soft" onClick={exportCSV}><Download size={16} /> CSV</button>
        </>} />

      <div ref={wrap} className="w-full overflow-hidden">
        <div style={{ width: 794 * scale, height: pages * (1123 + 24) * scale, position: 'relative', margin: '0 auto' }}>
          <div ref={ref} data-pdf-root style={{ transform: `scale(${scale})`, transformOrigin: 'top right', position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* الصفحة 1: الملخص */}
            <Page n={1} of={pages} title={title}>
              <div style={{ background: '#10243A', color: '#fff', borderRadius: 16, padding: '18px 22px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{app.settings.userName}</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{d.period.name}</div>
                <div style={{ fontSize: 10.5, opacity: 0.65 }}>{formatDateAr(d.period.startDate)} ← {formatDateAr(d.period.endDate)} · {d.timing.status === 'active' ? `اليوم ${d.timing.elapsedDays} من ${d.timing.totalDays}` : d.timing.status === 'closed' ? 'عزبة منتهية' : 'لم تبدأ'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                  <div><div style={{ fontSize: 10.5, opacity: 0.7 }}>إجمالي المصاريف</div><div style={{ fontSize: 28, fontWeight: 600, color: '#fff' }}><R v={d.total} strong /> <span style={{ fontSize: 13, color: '#D6AC59' }}>ر.ع</span></div></div>
                  <div style={{ textAlign: 'left', fontSize: 11 }}>{d.budget !== null ? <>الميزانية <R v={d.budget} /> · المتبقي <R v={d.remaining} /> · <span style={{ color: (d.usedPct ?? 0) > 100 ? '#FCA5A5' : '#10B981' }}>{d.usedPct}%</span></> : <span style={{ opacity: 0.7 }}>لم تُحدد ميزانية</span>}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  ['عدد العمليات', <span key="c" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.count}</span>],
                  ['متوسط يومي', <R key="a" v={d.avgDaily} />],
                  ['أعلى يوم', d.topDay ? <span key="t"><R v={d.topDay.total} /> <span style={{ fontSize: 9.5, color: '#7A8BA0' }}>{formatDateShort(d.topDay.date)}</span></span> : '—'],
                  ['المقارنة بالسابق', d.prev ? <span key="p" style={{ color: d.prev.diff > 0 ? '#DC2626' : '#059669' }}>{d.prev.diff > 0 ? '+' : ''}{d.prev.diffPct}%</span> : <span key="p" style={{ fontSize: 10, color: '#7A8BA0' }}>لا بيانات سابقة</span>],
                ].map(([l, v], i) => (
                  <div key={i} style={{ border: '1px solid #DFE5ED', borderRadius: 12, padding: '8px 10px' }}><div style={{ fontSize: 10, color: '#5F7187' }}>{l}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div></div>
                ))}
              </div>

              <H>توزيع المصاريف حسب التصنيف</H>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>التصنيف</th><th style={{ ...th, width: '34%' }}></th><th style={th}>العمليات</th><th style={th}>النسبة</th><th style={{ ...th, textAlign: 'left' }}>المبلغ</th></tr></thead>
                <tbody>
                  {nonzero.map((c, i) => (
                    <tr key={c.id}>
                      <td style={td}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c.color, marginLeft: 6 }} />{c.name}{i < 5 && <span style={{ fontSize: 9, color: '#B08A3E', marginRight: 6 }}>#{i + 1}</span>}</td>
                      <td style={td}><div style={{ height: 8, borderRadius: 4, background: '#EEF2F7' }}><div style={{ height: 8, borderRadius: 4, width: `${(c.total / maxCat) * 100}%`, background: c.color }} /></div></td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{c.count}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{c.share}%</td>
                      <td style={{ ...td, textAlign: 'left' }}><R v={c.total} /></td>
                    </tr>
                  ))}
                  <tr><td style={{ ...td, fontWeight: 600 }} colSpan={4}>الإجمالي</td><td style={{ ...td, textAlign: 'left' }}><R v={d.total} strong /></td></tr>
                </tbody>
              </table>

              <H>ملاحظات تحليلية</H>
              <ul style={{ margin: 0, paddingRight: 16 }}>
                {data.insights.map((i) => <li key={i.id} style={{ marginBottom: 4 }}><b style={{ fontWeight: 600 }}>{i.title}.</b> <span style={{ color: '#5F7187' }}>{i.detail}</span></li>)}
              </ul>
            </Page>

            {/* الصفحة 2: التفاصيل */}
            <Page n={2} of={pages} title={title}>
              <H>أكبر عشر عمليات</H>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>#</th><th style={th}>التاريخ</th><th style={th}>الوصف</th><th style={th}>التصنيف</th><th style={{ ...th, textAlign: 'left' }}>المبلغ</th></tr></thead>
                <tbody>{d.top10.map((t, i) => <tr key={t.id}><td style={td}>{i + 1}</td><td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(t.date)}</td><td style={td}>{t.description}</td><td style={td}>{data.cat.get(t.categoryId)?.name ?? 'أخرى'}</td><td style={{ ...td, textAlign: 'left' }}><R v={t.amount} /></td></tr>)}</tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <H>مصاريف السيارات</H>
                  {data.carSum.length ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>السيارة</th><th style={th}>الوقود</th><th style={th}>الصيانة</th><th style={{ ...th, textAlign: 'left' }}>الإجمالي</th></tr></thead>
                      <tbody>{data.carSum.map((s) => <tr key={s.name}><td style={td}>{s.name}</td><td style={td}><R v={s.fuel} /></td><td style={td}><R v={s.maintenance} /></td><td style={{ ...td, textAlign: 'left' }}><R v={s.total} strong /></td></tr>)}</tbody>
                    </table>
                  ) : <p style={{ color: '#7A8BA0' }}>لا توجد مصاريف سيارات.</p>}
                </div>
                <div>
                  <H>الفواتير</H>
                  {data.bills.length ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>{data.bills.map((t) => <tr key={t.id}><td style={td}>{t.description}</td><td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(t.date)}</td><td style={{ ...td, textAlign: 'left' }}><R v={t.amount} /></td></tr>)}
                        <tr><td style={{ ...td, fontWeight: 600 }} colSpan={2}>المجموع</td><td style={{ ...td, textAlign: 'left' }}><R v={data.bills.reduce((s, t) => s + t.amount, 0)} strong /></td></tr></tbody>
                    </table>
                  ) : <p style={{ color: '#7A8BA0' }}>لا توجد فواتير مسجلة.</p>}
                </div>
              </div>

              <H>الاشتراكات (الدفعات الفعلية)</H>
              {data.subPays.length ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>الدفعة</th><th style={th}>الخدمة</th><th style={th}>التاريخ</th><th style={{ ...th, textAlign: 'left' }}>المبلغ</th></tr></thead>
                  <tbody>{data.subPays.map((t) => <tr key={t.id}><td style={td}>{t.description}</td><td style={td}>{t.subscriptionId ? app.subs.find((s) => s.id === t.subscriptionId)?.name : '—'}</td><td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(t.date)}</td><td style={{ ...td, textAlign: 'left' }}><R v={t.amount} /></td></tr>)}
                    <tr><td style={{ ...td, fontWeight: 600 }} colSpan={3}>المجموع</td><td style={{ ...td, textAlign: 'left' }}><R v={data.subPays.reduce((s, t) => s + t.amount, 0)} strong /></td></tr></tbody>
                </table>
              ) : <p style={{ color: '#7A8BA0' }}>لا توجد دفعات اشتراكات.</p>}

              <H>الميزانية والمتبقي</H>
              {d.budget === null && !d.categories.some((c) => c.budget) ? <p style={{ color: '#7A8BA0' }}>لم تُحدد ميزانيات لهذه العزبة.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>البند</th><th style={th}>الميزانية</th><th style={th}>المصروف</th><th style={th}>المتبقي</th><th style={th}>الاستهلاك</th></tr></thead>
                  <tbody>
                    {d.budget !== null && <tr><td style={{ ...td, fontWeight: 600 }}>الميزانية العامة</td><td style={td}><R v={d.budget} /></td><td style={td}><R v={d.total} /></td><td style={{ ...td, color: (d.remaining ?? 0) < 0 ? '#DC2626' : undefined }}><R v={d.remaining} /></td><td style={td}>{d.usedPct}%</td></tr>}
                    {d.categories.filter((c) => c.budget).map((c) => <tr key={c.id}><td style={td}>{c.name}</td><td style={td}><R v={c.budget} /></td><td style={td}><R v={c.total} /></td><td style={{ ...td, color: c.total > (c.budget ?? 0) ? '#DC2626' : undefined }}><R v={(c.budget ?? 0) - c.total} /></td><td style={td}>{c.used}%</td></tr>)}
                  </tbody>
                </table>
              )}
              {d.prev && <p style={{ marginTop: 12 }}>مقارنة بـ {d.prev.period.name}: <R v={d.prev.total} /> ← <R v={d.total} /> ({d.prev.diff > 0 ? '+' : ''}{pct(d.prev.diff, d.prev.total)}%)</p>}
            </Page>

            {/* صفحات العمليات */}
            {data.chunks.map((chunk, ci) => (
              <Page key={ci} n={3 + ci} of={pages} title={title}>
                <H>سجل العمليات {data.chunks.length > 1 ? `(${ci + 1}/${data.chunks.length})` : ''}</H>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr><th style={th}>التاريخ</th><th style={th}>الوصف</th><th style={th}>التصنيف</th><th style={th}>السيارة</th><th style={{ ...th, textAlign: 'left' }}>المبلغ</th></tr></thead>
                  <tbody>{chunk.map((t) => <tr key={t.id}><td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatDateShort(t.date)} {t.time ?? ''}</td><td style={td}>{t.description}{t.kind === 'transfer_person' ? ' (مرسل لشخص)' : ''}</td><td style={td}>{data.cat.get(t.categoryId)?.name ?? 'أخرى'}</td><td style={td}>{t.carId ? app.cars.find((c) => c.id === t.carId)?.name : ''}</td><td style={{ ...td, textAlign: 'left' }}><R v={t.amount} /></td></tr>)}</tbody>
                </table>
                {ci === data.chunks.length - 1 && <p style={{ marginTop: 10, fontWeight: 600 }}>الإجمالي: <R v={d.total} strong /> ر.ع · {d.count} عملية{d.transfersOwn ? ` · استُبعدت تحويلات بين الحسابات ${formatOMR(d.transfersOwn)}` : ''}</p>}
              </Page>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
