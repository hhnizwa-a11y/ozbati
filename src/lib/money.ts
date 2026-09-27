import type { Baisa } from './types';

/** تحويل الأرقام العربية والفارسية إلى إنجليزية، وتوحيد الفاصلة العشرية العربية */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.') // ٫ الفاصلة العشرية العربية
    .replace(/٬/g, ''); // ٬ فاصل الآلاف العربي
}

/**
 * تحويل نص رقمي إلى بيسة بدقة كاملة دون فاصلة عائمة.
 * "14.6" → 14600 ، "0.7" → 700 ، "59" → 59000 ، "3.15" → 3150
 * يعيد null إذا لم يكن النص رقمًا صالحًا.
 */
export function parseToBaisa(input: string | number | null | undefined): Baisa | null {
  if (input === null || input === undefined) return null;
  let s = normalizeDigits(String(input)).trim().replace(/\s+/g, '').replace(/,/g, '.');
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return null;
  const [intPart = '0', fracRaw = ''] = s.split('.');
  let frac = fracRaw.padEnd(3, '0');
  let extra = 0;
  if (frac.length > 3) {
    // تقريب إلى أقرب بيسة
    extra = Number(frac[3]) >= 5 ? 1 : 0;
    frac = frac.slice(0, 3);
  }
  const n = Number(intPart || '0') * 1000 + Number(frac) + extra;
  return Number.isSafeInteger(n) ? n : null;
}

/** 59000 → "59.000" */
export function baisaToString(b: Baisa): string {
  const neg = b < 0;
  const abs = Math.abs(Math.round(b));
  const r = Math.floor(abs / 1000);
  const f = String(abs % 1000).padStart(3, '0');
  return `${neg ? '-' : ''}${r}.${f}`;
}

/** تنسيق للعرض مع فاصل الآلاف: 1250500 → "1,250.500" */
export function formatAmount(b: Baisa): string {
  const neg = b < 0;
  const abs = Math.abs(Math.round(b));
  const r = Math.floor(abs / 1000).toLocaleString('en-US');
  const f = String(abs % 1000).padStart(3, '0');
  return `${neg ? '-' : ''}${r}.${f}`;
}

/** "59.000 ر.ع" */
export function formatOMR(b: Baisa | null | undefined): string {
  if (b === null || b === undefined || Number.isNaN(b)) return '—';
  return `${formatAmount(b)} ر.ع`;
}

/** تنسيق مختصر للمحاور: 1250500 → "1.3K" */
export function formatShort(b: Baisa): string {
  const r = b / 1000;
  if (Math.abs(r) >= 1000) return `${(r / 1000).toFixed(1)}K`;
  if (Math.abs(r) >= 100) return r.toFixed(0);
  return r.toFixed(r % 1 === 0 ? 0 : 1);
}

export function toRial(b: Baisa): number {
  return b / 1000;
}

export function sumBaisa(values: Baisa[]): Baisa {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** نسبة مئوية بمنزلة عشرية واحدة */
export function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}
