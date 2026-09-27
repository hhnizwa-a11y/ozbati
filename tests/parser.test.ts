import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAT, DEFAULT_CATEGORIES, DEFAULT_SUBSCRIPTIONS, SAMPLE_CARS } from '../src/lib/defaults';
import { baisaToString, formatOMR, parseToBaisa } from '../src/lib/money';
import { blockingIssues, extractAmount, parseWhatsApp, rowToTransaction } from '../src/lib/parser';

const chat = readFileSync(new URL('../src/sample/demo-chat.txt', import.meta.url), 'utf8');
const ctx = { categories: DEFAULT_CATEGORIES, cars: [], subscriptions: DEFAULT_SUBSCRIPTIONS, rules: [], existing: [], targetYear: 2026, targetMonth: 9 };

describe('money', () => {
  it('parses Arabic digits to baisa exactly', () => {
    expect(parseToBaisa('٥٩')).toBe(59000);
    expect(parseToBaisa('١٤.٦')).toBe(14600);
    expect(parseToBaisa('٠.٧')).toBe(700);
    expect(parseToBaisa('٣.١٥')).toBe(3150);
    expect(parseToBaisa('abc')).toBeNull();
    expect(baisaToString(700)).toBe('0.700');
    expect(formatOMR(59000)).toBe('59.000 ر.ع');
  });
  it('extracts special cases', () => {
    expect(extractAmount('اللولو٩٩.٦')).toMatchObject({ amount: 99600, description: 'اللولو' });
    expect(extractAmount('بترول ١٣ أي أس')).toMatchObject({ amount: 13000, description: 'بترول أي أس' });
    expect(extractAmount('تجهيز الأطفال للمدرسة').amount).toBeNull();
    expect(extractAmount('شاي ٥٠٠ بيسة').amount).toBe(500);
  });
});

describe('demo chat', () => {
  const res = parseWhatsApp(chat, ctx);
  const one = (d: string) => res.rows.find((r) => r.description === d)!;
  it('extracts every amount and skips headings', () => {
    expect(res.rows).toHaveLength(30);
    expect(res.rows.reduce((s, r) => s + r.amount, 0)).toBe(435400);
    expect(res.headings.map((h) => h.text)).toEqual(['مصاريف الشهر', 'تجهيز الأطفال للمدرسة']);
  });
  it('classifies and groups', () => {
    expect(one('فاتورة الكهرباء').categoryId).toBe(CAT.home);
    expect(one('انترنت').categoryId).toBe(CAT.home);
    expect(one('اللولو').amount).toBe(64800);
    expect(one('حقائب')).toMatchObject({ categoryId: CAT.education, groupLabel: 'تجهيز الأطفال للمدرسة' });
    expect(one('اكل القطط').categoryId).toBe(CAT.pets);
    expect(one('اشتراك ChatGPT').subscriptionId).toBe('sub-chatgpt');
    expect(one('بترول الكامري')).toMatchObject({ categoryId: CAT.cars, amount: 11000, carId: null });
  });
  it('flags the unusual dinner and the transfer', () => {
    expect(res.rows.filter((r) => r.flags.anomaly).map((r) => r.amount)).toEqual([60000]);
    const issues = blockingIssues(res.rows);
    expect(issues.unconfirmedAnomalies).toHaveLength(1);
    expect(issues.undecidedTransfers).toHaveLength(1);
  });
  it('assigns cars when the user defines them', () => {
    const cars = [{ ...SAMPLE_CARS[0], id: 'c1', name: 'Camry', aliases: ['الكامري', 'كامري'] }];
    expect(parseWhatsApp(chat, { ...ctx, cars }).rows.find((r) => r.amount === 11000)!.carId).toBe('c1');
  });
  it('detects re-imports as duplicates', () => {
    const saved = res.rows.map((r) => rowToTransaction({ ...r, kind: r.kind ?? 'expense' }, 'p', '2026-09-01'));
    expect(parseWhatsApp(chat, { ...ctx, existing: saved }).rows.every((r) => r.flags.duplicate === 'saved')).toBe(true);
  });
  it('supports Android format and multi-line messages', () => {
    const r = parseWhatsApp('12/09/2026, 21:05 - سالم: عشاء 3.5\nشاي 0.4', ctx);
    expect(r.rows.map((x) => [x.date, x.time, x.description, x.amount])).toEqual([['2026-09-12', '21:05', 'عشاء', 3500], ['2026-09-12', '21:05', 'شاي', 400]]);
  });
});
