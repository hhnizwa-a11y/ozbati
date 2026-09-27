/**
 * محرك استيراد محادثات واتساب.
 * يحوّل النص الملصوق إلى صفوف مراجعة، ولا يحفظ شيئًا بنفسه.
 */
import { classify, detectCar, detectSubscription, looksLikeTransfer, type Confidence } from './classifier';
import { CAT } from './defaults';
import { daysBetween, iso, lastDayOfMonth, to24h } from './dates';
import { normalizeDigits, parseToBaisa } from './money';
import { containsTerm, descKey, tokens } from './text';
import type { Baisa, Car, Category, LearnedRule, Subscription, Transaction, TxKind } from './types';

export type DateOrder = 'dmy' | 'mdy';

export interface ImportContext {
  categories: Category[];
  cars: Car[];
  subscriptions: Subscription[];
  rules: LearnedRule[];
  /** العمليات المحفوظة مسبقًا، لاكتشاف التكرار والقيم غير المعتادة */
  existing: Transaction[];
  /** سنة ونطاق الشهر المالي المستهدف، لاستنتاج السنة عند غيابها */
  targetYear: number;
  targetMonth: number;
  dateOrder?: DateOrder;
  anomalyFactor?: number;
}

export interface AnomalyInfo {
  basis: string;
  median: Baisa;
  samples: number;
  ratio: number;
}

export interface ParsedRow {
  uid: string;
  lineNo: number;
  raw: string;
  date: string | null;
  time: string | null;
  description: string;
  amount: Baisa;
  categoryId: string;
  confidence: Confidence;
  reason: string;
  carId: string | null;
  subscriptionId: string | null;
  groupLabel: string | null;
  /** null = تحويل ينتظر قرار المستخدم */
  kind: TxKind | null;
  notes: string;
  include: boolean;
  /** تأكيد المستخدم للقيم غير المعتادة */
  confirmed: boolean;
  flags: {
    anomaly?: AnomalyInfo;
    transfer?: boolean;
    multipleNumbers?: boolean;
    duplicate?: 'saved' | 'batch' | 'similar';
    noDate?: boolean;
    carUnknown?: boolean;
  };
}

export interface HeadingRow {
  lineNo: number;
  raw: string;
  text: string;
  date: string | null;
  time: string | null;
}

export interface SkippedLine {
  lineNo: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  headings: HeadingRow[];
  skipped: SkippedLine[];
  title: string | null;
  minDate: string | null;
  maxDate: string | null;
}

const AMPM = '([AaPp]\\.?\\s?[Mm]\\.?|ص|م)';
const IOS_RE = new RegExp(`^\\[(\\d{1,2})[\\/.-](\\d{1,2})(?:[\\/.-](\\d{2,4}))?,?\\s+(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*${AMPM}?\\]\\s*(.*)$`);
const ANDROID_RE = new RegExp(`^(\\d{1,2})[\\/.-](\\d{1,2})(?:[\\/.-](\\d{2,4}))?,?\\s+(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*${AMPM}?\\s*[-–]\\s*(.*)$`);
const PARTIAL_RE = /^\[?\d{1,2}[\/.-]\d{0,2}/;

/** مرادفات لتجميع العمليات المتشابهة عند اكتشاف القيم غير المعتادة */
const GROUPS: Record<string, string[]> = {
  'عشاء': ['عشاء', 'عشا', 'عشى'],
  'غداء': ['غداء', 'غدا', 'غدى'],
  'ريوق': ['ريوق', 'فطور'],
  'اللولو': ['لولو'],
  'بترول': ['بترول', 'وقود', 'بنزين'],
  'شاي': ['شاي', 'كرك'],
};

export function anomalyKey(description: string): string {
  const tk = tokens(description);
  for (const [k, terms] of Object.entries(GROUPS)) if (terms.some((t) => containsTerm(tk, t))) return k;
  return descKey(description);
}

export function fingerprint(t: { date: string | null; time: string | null; description: string; amount: Baisa }): string {
  return `${t.date ?? '?'}|${t.time ?? ''}|${descKey(t.description)}|${t.amount}`;
}

function inferYear(day: number, month: number, targetYear: number, targetMonth: number): number {
  const mid = iso(targetYear, targetMonth, 15);
  let best = targetYear, bestDist = Infinity;
  for (const y of [targetYear - 1, targetYear, targetYear + 1]) {
    const d = Math.abs(daysBetween(mid, iso(y, month, Math.min(day, lastDayOfMonth(y, month)))));
    if (d < bestDist) { bestDist = d; best = y; }
  }
  return best;
}

interface Extracted {
  amount: Baisa | null;
  description: string;
  multiple: boolean;
}

/** استخراج المبلغ والوصف من نص الرسالة */
export function extractAmount(text: string): Extracted {
  const t = normalizeDigits(text).replace(/[‎‏‪-‮⁦-⁩]/g, '');
  const re = /(\d+(?:[.,]\d+)?|[.,]\d+)(\s*(?:بيسة|بيسه|بيسات|ريال|ر\.?\s?ع\.?|omr|OMR|RO))?/g;
  const matches = [...t.matchAll(re)];
  if (!matches.length) return { amount: null, description: cleanDesc(t), multiple: false };
  const m = matches[matches.length - 1];
  const unit = (m[2] || '').trim();
  let amount: Baisa | null;
  if (/^بيس/.test(unit)) amount = /^\d+$/.test(m[1]) ? Number(m[1]) : null;
  else amount = parseToBaisa(m[1]);
  const idx = m.index ?? 0;
  const description = cleanDesc(t.slice(0, idx) + ' ' + t.slice(idx + m[0].length));
  return { amount, description, multiple: matches.length > 1 };
}

function cleanDesc(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–:،,.=]+|[\s\-–:،,.=]+$/g, '')
    .trim();
}

interface RawMessage {
  lineNo: number;
  raw: string;
  date: string | null;
  time: string | null;
  text: string;
  /** وقت الرسالة بالدقائق منذ بداية اليوم، لتحديد نطاق عنوان المجموعة */
  minutes: number | null;
}

/** تقسيم النص إلى رسائل، مع دعم صيغ iOS وأندرويد والرسائل متعددة الأسطر */
export function splitMessages(input: string, ctx: Pick<ImportContext, 'targetYear' | 'targetMonth' | 'dateOrder'>) {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const messages: RawMessage[] = [];
  const skipped: SkippedLine[] = [];
  const preamble: { lineNo: number; raw: string }[] = [];
  let last: RawMessage | null = null;
  let order: DateOrder | undefined = ctx.dateOrder;

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = normalizeDigits(rawLine)
      .replace(/[‎‏‪-‮⁦-⁩﻿]/g, '')
      .replace(/[  ]/g, ' ')
      .trim();
    if (!line) return;
    const m = line.match(IOS_RE) || line.match(ANDROID_RE);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      if (!order) order = a > 12 ? 'dmy' : b > 12 ? 'mdy' : 'dmy';
      const [day, month] = order === 'dmy' ? [a, b] : [b, a];
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        skipped.push({ lineNo, raw: rawLine, reason: 'تاريخ غير صالح' });
        return;
      }
      let year: number;
      if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      else year = inferYear(day, month, ctx.targetYear, ctx.targetMonth);
      const time = to24h(Number(m[4]), Number(m[5]), m[6]?.replace(/\s/g, ''));
      let rest = m[7] ?? '';
      const colon = rest.indexOf(': ');
      if (colon === -1) {
        const c2 = rest.indexOf(':');
        if (c2 === -1) {
          skipped.push({ lineNo, raw: rawLine, reason: 'رسالة نظام أو دون مُرسِل' });
          last = null;
          return;
        }
        rest = rest.slice(c2 + 1);
      } else rest = rest.slice(colon + 2);
      const [hh, mm] = time.split(':').map(Number);
      const msg: RawMessage = { lineNo, raw: rawLine, date: iso(year, month, Math.min(day, lastDayOfMonth(year, month))), time, text: rest.trim(), minutes: hh * 60 + mm };
      if (!msg.text || /^<.*(محذوف|omitted|deleted|حذف).*>$/i.test(msg.text) || /تم حذف هذه الرسالة|This message was deleted/i.test(msg.text)) {
        skipped.push({ lineNo, raw: rawLine, reason: 'رسالة فارغة أو محذوفة' });
        return;
      }
      messages.push(msg);
      last = msg;
      return;
    }
    if (PARTIAL_RE.test(line) && /^\[/.test(line)) {
      skipped.push({ lineNo, raw: rawLine, reason: 'سطر غير مكتمل (مقطوع عند النسخ)' });
      return;
    }
    if (last) {
      // سطر إضافي داخل الرسالة نفسها: يُعامل كبند مستقل بنفس التاريخ والوقت
      messages.push({ ...(last as RawMessage), lineNo, raw: rawLine, text: line });
    } else {
      preamble.push({ lineNo, raw: rawLine });
    }
  });
  return { messages, skipped, preamble };
}

const GROUP_GAP_MIN = 5;

export function parseWhatsApp(input: string, ctx: ImportContext): ParseResult {
  const { messages, skipped, preamble } = splitMessages(input, ctx);
  const rows: ParsedRow[] = [];
  const headings: HeadingRow[] = [];
  let title: string | null = null;

  // العنوان الافتتاحي قبل أول رسالة
  for (const p of preamble) {
    const ex = extractAmount(p.raw);
    if (ex.amount === null || ex.amount === 0) {
      if (!title) title = p.raw.trim();
      headings.push({ lineNo: p.lineNo, raw: p.raw, text: p.raw.trim(), date: null, time: null });
    } else {
      messages.unshift({ lineNo: p.lineNo, raw: p.raw, date: null, time: null, text: p.raw.trim(), minutes: null });
    }
  }
  messages.sort((a, b) => a.lineNo - b.lineNo);

  let group: { label: string; date: string | null; lastMin: number | null; kids: boolean } | null = null;
  let uidSeq = 0;

  for (const msg of messages) {
    const ex = extractAmount(msg.text);
    // انتهاء نطاق المجموعة إذا تغير اليوم أو طال الفاصل الزمني
    if (group && (msg.date !== group.date || msg.minutes === null || group.lastMin === null || msg.minutes - group.lastMin > GROUP_GAP_MIN)) group = null;

    if (ex.amount === null || ex.amount === 0) {
      headings.push({ lineNo: msg.lineNo, raw: msg.raw, text: msg.text, date: msg.date, time: msg.time });
      const tk = tokens(msg.text);
      const kids = ctx.categories.filter((c) => (c.parentId ?? c.id) === CAT.education).some((c) => c.keywords.some((k) => containsTerm(tk, k)));
      group = { label: msg.text, date: msg.date, lastMin: msg.minutes, kids };
      continue;
    }
    if (group) group.lastMin = msg.minutes;

    const description = ex.description || msg.text;
    const cls = classify(description, ctx.categories, ctx.rules);
    let categoryId = cls.categoryId;
    let confidence = cls.confidence;
    let reason = cls.reason;

    // عناصر مجموعة مثل «تجهيز الأطفال للمدرسة» تُنسب للتعليم والأطفال ما لم تكن وجبة أو فاتورة واضحة
    if (group?.kids && confidence !== 'learned' && [CAT.personal, CAT.other, CAT.groceries].includes(categoryId as never)) {
      categoryId = CAT.education;
      confidence = 'group';
      reason = `ضمن مجموعة «${group.label}»`;
    }

    const car = detectCar(description, ctx.cars);
    const learnedCar = cls.confidence === 'learned' ? ctx.rules.find((r) => r.key === descKey(description))?.carId ?? null : null;
    if (car && categoryId === CAT.other) { categoryId = CAT.cars; reason = `السيارة ${car.name}`; confidence = 'keyword'; }
    const isCarCat = (ctx.categories.find((c) => c.id === categoryId)?.parentId ?? categoryId) === CAT.cars;
    const sub = (ctx.categories.find((c) => c.id === categoryId)?.parentId ?? categoryId) === CAT.subscriptions ? detectSubscription(description, ctx.subscriptions) : null;
    const transfer = looksLikeTransfer(description);

    rows.push({
      uid: `r${++uidSeq}`,
      lineNo: msg.lineNo,
      raw: msg.raw,
      date: msg.date,
      time: msg.time,
      description,
      amount: ex.amount,
      categoryId,
      confidence,
      reason,
      carId: car?.id ?? learnedCar ?? null,
      subscriptionId: sub?.id ?? null,
      groupLabel: group?.label ?? null,
      kind: transfer ? null : 'expense',
      notes: '',
      include: true,
      confirmed: true,
      flags: {
        transfer: transfer || undefined,
        multipleNumbers: ex.multiple || undefined,
        noDate: msg.date ? undefined : true,
        carUnknown: isCarCat && !car && !learnedCar ? true : undefined,
      },
    });
  }

  markDuplicates(rows, ctx.existing);
  markAnomalies(rows, ctx.existing, ctx.anomalyFactor ?? 10);

  const dates = rows.map((r) => r.date).filter(Boolean) as string[];
  dates.sort();
  return { rows, headings, skipped, title, minDate: dates[0] ?? null, maxDate: dates[dates.length - 1] ?? null };
}

/** اكتشاف العمليات المكررة: مع المحفوظ مسبقًا، أو داخل النص نفسه */
export function markDuplicates(rows: ParsedRow[], existing: Transaction[]) {
  const saved = new Set(existing.map((t) => t.fingerprint));
  const similar = new Set(existing.map((t) => `${t.date}|${descKey(t.description)}|${t.amount}`));
  const seen = new Map<string, number>();
  for (const r of rows) {
    const fp = fingerprint(r);
    if (saved.has(fp)) {
      r.flags.duplicate = 'saved';
      r.include = false;
    } else if (similar.has(`${r.date}|${descKey(r.description)}|${r.amount}`)) {
      r.flags.duplicate = 'similar';
    } else if (seen.has(fp)) {
      r.flags.duplicate = 'batch';
    }
    seen.set(fp, (seen.get(fp) ?? 0) + 1);
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return 0;
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2);
}

/** الحد الأدنى للفرق حتى تُعتبر القيمة غير معتادة (20 ر.ع) */
const MIN_ANOMALY_DIFF: Baisa = 20000;

/**
 * القيم غير المعتادة: مقارنة كل عملية بوسيط العمليات المشابهة (بنفس الاسم أو مرادفه)
 * في السجل والنص المستورد، مع استبعاد العملية نفسها.
 */
export function markAnomalies(rows: ParsedRow[], existing: Transaction[], factor: number) {
  const pool: { key: string; amount: Baisa; uid?: string }[] = [
    ...existing.filter((t) => t.kind === 'expense').map((t) => ({ key: anomalyKey(t.description), amount: t.amount })),
    ...rows.map((r) => ({ key: anomalyKey(r.description), amount: r.amount, uid: r.uid })),
  ];
  for (const r of rows) {
    const key = anomalyKey(r.description);
    const others = pool.filter((p) => p.key === key && p.uid !== r.uid).map((p) => p.amount);
    if (others.length < 3) continue;
    const med = median(others);
    if (med > 0 && r.amount >= med * factor && r.amount - med >= MIN_ANOMALY_DIFF) {
      r.flags.anomaly = { basis: key, median: med, samples: others.length, ratio: Math.round((r.amount / med) * 10) / 10 };
      r.confirmed = false;
    }
  }
}

/** تحويل صف مراجعة إلى عملية محفوظة */
export function rowToTransaction(r: ParsedRow, periodId: string, fallbackDate: string): Transaction {
  const now = Date.now();
  const date = r.date ?? fallbackDate;
  return {
    id: `tx_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    time: r.time,
    description: r.description.trim(),
    amount: r.amount,
    categoryId: r.categoryId,
    carId: r.carId,
    periodId,
    kind: r.kind ?? 'expense',
    notes: r.notes,
    groupLabel: r.groupLabel,
    subscriptionId: r.subscriptionId,
    source: 'whatsapp',
    rawText: r.raw,
    fingerprint: fingerprint({ date, time: r.time, description: r.description, amount: r.amount }),
    createdAt: now,
    updatedAt: now,
  };
}

/** أي صفوف تمنع اعتماد الاستيراد؟ */
export function blockingIssues(rows: ParsedRow[]) {
  const inc = rows.filter((r) => r.include);
  return {
    unconfirmedAnomalies: inc.filter((r) => r.flags.anomaly && !r.confirmed),
    undecidedTransfers: inc.filter((r) => r.kind === null),
    invalidAmounts: inc.filter((r) => !Number.isSafeInteger(r.amount) || r.amount <= 0),
  };
}

