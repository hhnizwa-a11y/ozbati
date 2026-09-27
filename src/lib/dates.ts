export const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const pad = (n: number) => String(n).padStart(2, '0');

export function iso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function todayISO(now = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseISO(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/** عدد الأيام بين تاريخين (UTC لتجنب مشاكل التوقيت الصيفي) */
export function daysBetween(a: string, b: string): number {
  const A = parseISO(a), B = parseISO(b);
  return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86400000);
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseISO(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function weekdayAr(s: string): string {
  const { y, m, d } = parseISO(s);
  return WEEKDAYS_AR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-08-23" → "23 أغسطس 2026" */
export function formatDateAr(s: string, withYear = true): string {
  if (!s) return '—';
  const { y, m, d } = parseISO(s);
  return `${d} ${MONTHS_AR[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** "2026-08-23" → "23/08" */
export function formatDateShort(s: string): string {
  const { m, d } = parseISO(s);
  return `${pad(d)}/${pad(m)}`;
}

export function periodLabel(year: number, month: number): string {
  return `عزبة ${MONTHS_AR[month - 1]} ${year}`;
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "10:58 pm" → "22:58" */
export function to24h(h: number, min: number, ampm?: string | null): string {
  let hh = h;
  const a = (ampm || '').toLowerCase().replace(/\./g, '');
  if (a === 'pm' || a === 'م' || a === 'مساء' || a === 'مساءً') { if (hh < 12) hh += 12; }
  else if (a === 'am' || a === 'ص' || a === 'صباحا' || a === 'صباحًا') { if (hh === 12) hh = 0; }
  return `${pad(hh)}:${pad(min)}`;
}
