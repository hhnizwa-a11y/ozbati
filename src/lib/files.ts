/**
 * حفظ الملفات والتصدير: CSV وXLSX وPDF والنسخة الاحتياطية JSON.
 * داخل صفحة Claude المنشورة يُستخدم إذن التنزيل الخاص بها؛ وفي المتصفح العادي رابط تنزيل مباشر.
 */
import { baisaToString } from './money';
import { isNative, nativeSave } from './native';
import type { BackupFile, Category, Car, Period, Transaction } from './types';

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<any> };
  }
}

let downloadsCap: Promise<any> | null = null;
function getDownloads(): Promise<any> {
  if (!downloadsCap) {
    downloadsCap = (async () => {
      try {
        if (!window.claude?.use) return null;
        return await window.claude.use('downloads');
      } catch {
        return null;
      }
    })();
  }
  return downloadsCap;
}

export type SaveOutcome = 'saved' | 'declined' | 'failed';

export async function saveFile(filename: string, data: Blob | string, mime = 'application/octet-stream'): Promise<SaveOutcome> {
  if (isNative()) return nativeSave(filename, data);
  const downloads = await getDownloads();
  if (downloads) {
    try {
      await downloads.save({ filename, data });
      return 'saved';
    } catch (e: any) {
      return e?.code === 'declined' ? 'declined' : 'failed';
    }
  }
  try {
    const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

export interface ExportRow {
  التاريخ: string;
  الوقت: string;
  الوصف: string;
  التصنيف: string;
  'المبلغ (ر.ع)': number;
  النوع: string;
  السيارة: string;
  'الشهر المالي': string;
  المجموعة: string;
  الملاحظات: string;
}

const KIND_AR = { expense: 'مصروف', transfer_own: 'تحويل بين حساباتي', transfer_person: 'مبلغ مرسل لشخص' } as const;

export function toExportRows(txs: Transaction[], categories: Category[], cars: Car[], periods: Period[]): ExportRow[] {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const car = new Map(cars.map((c) => [c.id, c.name]));
  const per = new Map(periods.map((p) => [p.id, p.name]));
  return [...txs]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .map((t) => ({
      التاريخ: t.date,
      الوقت: t.time ?? '',
      الوصف: t.description,
      التصنيف: cat.get(t.categoryId) ?? 'أخرى',
      'المبلغ (ر.ع)': Number(baisaToString(t.amount)),
      النوع: KIND_AR[t.kind],
      السيارة: t.carId ? car.get(t.carId) ?? '' : '',
      'الشهر المالي': per.get(t.periodId) ?? '',
      المجموعة: t.groupLabel ?? '',
      الملاحظات: t.notes,
    }));
}

function csvCell(v: unknown): string {
  const s = typeof v === 'number' ? v.toFixed(3) : String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: ExportRow[]): string {
  if (!rows.length) return '﻿';
  const head = Object.keys(rows[0]);
  // BOM لضمان ظهور العربية بشكل صحيح في Excel
  return '﻿' + [head.join(','), ...rows.map((r) => head.map((h) => csvCell((r as any)[h])).join(','))].join('\r\n');
}

export async function toXLSX(sheets: { name: string; rows: Record<string, unknown>[]; widths?: number[] }[]): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] } as any;
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': 'لا توجد بيانات' }]);
    if (s.widths) ws['!cols'] = s.widths.map((w) => ({ wch: w }));
    // تنسيق أعمدة المبالغ بثلاث منازل عشرية
    const ref = ws['!ref'];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let R = 1; R <= range.e.r; R++) for (let C = 0; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.t === 'n') cell.z = '0.000';
      }
    }
    (ws as any)['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * تحويل عنصر التقرير إلى PDF بمقاس A4.
 * تُرسم الصفحة بمحرك المتصفح نفسه، فتظهر الحروف العربية متصلة وبالاتجاه الصحيح.
 * كل عنصر يحمل data-pdf-page يصبح صفحة مستقلة.
 */
export async function elementToPDF(root: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  const W = 210, H = 297;
  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      // المعاينة مصغرة على الشاشة؛ نلغي التصغير في النسخة المرسومة
      onclone: (doc: Document) => { const r = doc.querySelector<HTMLElement>('[data-pdf-root]'); if (r) r.style.transform = 'none'; },
    });
    const img = canvas.toDataURL('image/jpeg', 0.92);
    const ratio = canvas.height / canvas.width;
    const h = Math.min(H, W * ratio);
    if (i > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, 0, W, h);
  }
  return pdf.output('blob');
}

export function validateBackup(obj: any): { ok: true; data: BackupFile } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['الملف ليس JSON صالحًا'] };
  if (obj.app !== 'ozbati') errors.push('الملف ليس نسخة احتياطية من «عزبتي»');
  for (const k of ['transactions', 'periods', 'categories', 'cars', 'subscriptions', 'goals', 'rules'] as const) {
    if (!Array.isArray(obj[k])) errors.push(`الجدول ${k} مفقود أو تالف`);
  }
  if (errors.length) return { ok: false, errors };
  const periodIds = new Set(obj.periods.map((p: any) => p.id));
  obj.transactions.forEach((t: any, i: number) => {
    if (typeof t.id !== 'string') errors.push(`العملية ${i + 1}: معرّف مفقود`);
    if (!Number.isSafeInteger(t.amount) || t.amount < 0) errors.push(`العملية ${i + 1}: مبلغ غير صالح`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) errors.push(`العملية ${i + 1}: تاريخ غير صالح`);
    if (!periodIds.has(t.periodId)) errors.push(`العملية ${i + 1}: شهر مالي غير موجود`);
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 8).concat(errors.length > 8 ? [`و${errors.length - 8} أخطاء أخرى`] : []) };
  return { ok: true, data: obj as BackupFile };
}
