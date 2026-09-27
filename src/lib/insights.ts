/**
 * المحلل المالي.
 * المحرك الحالي محلي بالكامل ويعتمد على قواعد وحسابات فعلية من metrics.ts.
 * البنية تسمح بإضافة مزود خارجي (Gemini API أو Claude API) يطبّق الواجهة AnalysisProvider،
 * ويتلقى ملخصًا مجمّعًا فقط (buildAISummary) وبعد موافقة صريحة من المستخدم.
 */
import { rootCategoryId } from './classifier';
import { CAT } from './defaults';
import { formatDateAr, weekdayAr } from './dates';
import { formatOMR, pct } from './money';
import { anomalyKey } from './parser';
import { byCategory, budgetState, carSummaries, spendingOf, type Dashboard } from './metrics';
import type { Car, Category, Transaction } from './types';

export type Tone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface Insight {
  id: string;
  tone: Tone;
  icon: string;
  title: string;
  detail: string;
  /** للترتيب: الأعلى أولًا */
  weight: number;
}

export interface AnalysisInput {
  dash: Dashboard;
  allTx: Transaction[];
  categories: Category[];
  cars: Car[];
}

export interface AnalysisProvider {
  id: string;
  name: string;
  /** هل يرسل بيانات خارج الجهاز؟ يتطلب موافقة المستخدم */
  external: boolean;
  analyze(input: AnalysisInput): Promise<Insight[]>;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
};

export function localInsights({ dash, allTx, categories, cars }: AnalysisInput): Insight[] {
  const out: Insight[] = [];
  const { total, count, period } = dash;
  if (!count) {
    return [{ id: 'empty', tone: 'neutral', icon: 'Info', title: 'لا توجد عمليات في هذه العزبة بعد', detail: 'أضف مصروفًا أو استورد محادثة واتساب ليبدأ التحليل.', weight: 100 }];
  }
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? 'أخرى';

  out.push({
    id: 'total', tone: 'neutral', icon: 'Wallet', weight: 100,
    title: `بلغ إجمالي مصاريف ${period.name} ${formatOMR(total)}`,
    detail: `عبر ${count} عملية، بمتوسط ${formatOMR(Math.round(total / count))} للعملية${dash.avgDaily !== null ? ` و${formatOMR(dash.avgDaily)} يوميًا خلال ${dash.timing.elapsedDays} يومًا منقضيًا` : ''}.`,
  });

  // المقارنة بالشهر السابق
  if (dash.prev) {
    const up = dash.prev.diff > 0;
    out.push({
      id: 'prev', tone: up ? 'negative' : 'positive', icon: up ? 'TrendingUp' : 'TrendingDown', weight: 95,
      title: `${up ? 'ارتفع' : 'انخفض'} إنفاقك ${dash.prev.diffPct !== null ? `بنسبة ${Math.abs(dash.prev.diffPct)}% ` : ''}عن ${dash.prev.period.name}`,
      detail: `الفرق ${formatOMR(Math.abs(dash.prev.diff))} (${formatOMR(dash.prev.total)} ← ${formatOMR(total)}).`,
    });
    const prevCats = byCategory(spendingOf(allTx, dash.prev.period.id), categories);
    for (const c of dash.categories) {
      const p = prevCats.find((x) => x.id === c.id);
      if (!p || !p.total) continue;
      const diff = c.total - p.total;
      const change = pct(diff, p.total) ?? 0;
      if (Math.abs(change) >= 20 && Math.abs(diff) >= 5000) {
        out.push({
          id: `cat-change-${c.id}`, tone: diff > 0 ? 'negative' : 'positive', icon: diff > 0 ? 'ArrowUpRight' : 'ArrowDownLeft', weight: 70 + Math.min(20, Math.abs(diff) / 5000),
          title: `${diff > 0 ? 'ارتفعت' : 'انخفضت'} مصاريف ${c.name} مقارنة بالشهر السابق`,
          detail: `${formatOMR(p.total)} ← ${formatOMR(c.total)} (${diff > 0 ? '+' : ''}${change}%).`,
        });
      }
    }
  } else {
    out.push({ id: 'noprev', tone: 'neutral', icon: 'CalendarRange', weight: 20, title: 'لا توجد بيانات لشهر سابق للمقارنة', detail: 'أنشئ عزبة الشهر السابق أو استورد بياناته لتظهر المقارنات الشهرية.' });
  }

  // أكبر تصنيف
  const top = dash.categories.filter((c) => c.total > 0);
  if (top[0]) {
    out.push({
      id: 'topcat', tone: 'neutral', icon: 'PieChart', weight: 90,
      title: `${top[0].name} هو أكبر بند إنفاق بنسبة ${top[0].share}%`,
      detail: `${formatOMR(top[0].total)} في ${top[0].count} عملية${top[1] ? `، يليه ${top[1].name} بـ ${formatOMR(top[1].total)} (${top[1].share}%)` : ''}.`,
    });
  }

  // السيارات
  const carsCat = dash.categories.find((c) => c.id === CAT.cars);
  if (carsCat && carsCat.total > 0) {
    const sums = carSummaries(dash.txs, cars, categories).filter((s) => s.total > 0);
    const unknown = sums.find((s) => s.carId === null);
    out.push({
      id: 'cars', tone: 'neutral', icon: 'Car', weight: 80,
      title: `شكّلت مصاريف السيارات ${carsCat.share}% من إجمالي الإنفاق`,
      detail: `${formatOMR(carsCat.total)}، منها وقود ${formatOMR(sums.reduce((s, x) => s + x.fuel, 0))}. ${sums.filter((s) => s.carId).map((s) => `${s.name}: ${formatOMR(s.total)}`).join('، ')}${unknown ? `. ${unknown.count} عملية بقيمة ${formatOMR(unknown.total)} دون تحديد السيارة` : ''}.`,
    });
  }

  // الاشتراكات
  const subsCat = dash.categories.find((c) => c.id === CAT.subscriptions);
  if (subsCat && subsCat.total > 0) {
    out.push({
      id: 'subs', tone: 'neutral', icon: 'Repeat', weight: 78,
      title: `بلغ إجمالي اشتراكاتك الرقمية هذا الشهر ${formatOMR(subsCat.total)}`,
      detail: `${subsCat.count} دفعات فعلية، تمثل ${subsCat.share}% من الإنفاق.`,
    });
  }

  // أعلى يوم
  if (dash.topDay) {
    out.push({
      id: 'topday', tone: 'neutral', icon: 'CalendarDays', weight: 75,
      title: `أعلى يوم إنفاق كان ${weekdayAr(dash.topDay.date)} ${formatDateAr(dash.topDay.date)}`,
      detail: `${formatOMR(dash.topDay.total)} في ${dash.topDay.count} عملية، أي ${pct(dash.topDay.total, total)}% من إجمالي العزبة.`,
    });
  }

  // أكبر عملية
  if (dash.largest) {
    out.push({
      id: 'largest', tone: 'neutral', icon: 'Receipt', weight: 72,
      title: `أكبر عملية: «${dash.largest.description}» بقيمة ${formatOMR(dash.largest.amount)}`,
      detail: `بتاريخ ${formatDateAr(dash.largest.date)}، ضمن ${name(rootCategoryId(dash.largest.categoryId, categories))}.`,
    });
  }

  // الميزانيات
  if (dash.budget !== null) {
    const st = budgetState(dash.usedPct);
    out.push({
      id: 'budget', tone: st === 'over' ? 'negative' : st === 'warn' ? 'warning' : 'positive', icon: 'Target', weight: st === 'ok' ? 60 : 98,
      title: st === 'over' ? `تجاوزت الميزانية العامة بمقدار ${formatOMR(-(dash.remaining ?? 0))}` : `استهلكت ${dash.usedPct}% من الميزانية العامة`,
      detail: `الميزانية ${formatOMR(dash.budget)}، المتبقي ${formatOMR(dash.remaining)}.`,
    });
    if (dash.forecast !== null && dash.timing.status === 'active' && dash.forecast > dash.budget && st !== 'over') {
      out.push({
        id: 'forecast', tone: 'warning', icon: 'Gauge', weight: 90,
        title: 'بالمعدل الحالي قد تتجاوز الميزانية قبل نهاية العزبة',
        detail: `المصروف المتوقع تقديريًا ${formatOMR(dash.forecast)} مقابل ميزانية ${formatOMR(dash.budget)}.`,
      });
    }
  } else {
    out.push({ id: 'nobudget', tone: 'neutral', icon: 'Target', weight: 30, title: 'لم تحدد ميزانية لهذه العزبة', detail: 'حدد ميزانية عامة وميزانيات للتصنيفات لتظهر نسب الاستهلاك والتنبيهات.' });
  }
  for (const c of dash.categories) {
    const st = budgetState(c.used);
    if (st === 'over') out.push({ id: `over-${c.id}`, tone: 'negative', icon: 'AlertTriangle', weight: 97, title: `تجاوزت ميزانية ${c.name} المحددة`, detail: `صرفت ${formatOMR(c.total)} من ${formatOMR(c.budget)} (${c.used}%).` });
    else if (st === 'warn') out.push({ id: `warn-${c.id}`, tone: 'warning', icon: 'AlertCircle', weight: 85, title: `اقتربت من حد ميزانية ${c.name}`, detail: `استهلكت ${c.used}%: ${formatOMR(c.total)} من ${formatOMR(c.budget)}.` });
  }

  // المطاعم
  const rest = dash.categories.find((c) => c.id === CAT.restaurants);
  if (rest && rest.count >= 5) {
    out.push({
      id: 'rest', tone: 'neutral', icon: 'UtensilsCrossed', weight: 55,
      title: `سجلت ${rest.count} عملية في المطاعم والمقاهي`,
      detail: `بمتوسط ${formatOMR(Math.round(rest.total / rest.count))} للعملية، وإجمالي ${formatOMR(rest.total)}.`,
    });
  }

  // قيم غير معتادة ضمن المحفوظ
  const pool = allTx.filter((t) => t.kind === 'expense');
  for (const t of dash.txs) {
    const k = anomalyKey(t.description);
    const others = pool.filter((x) => x.id !== t.id && anomalyKey(x.description) === k).map((x) => x.amount);
    if (others.length < 3) continue;
    const m = median(others);
    if (m > 0 && t.amount >= m * 10 && t.amount - m >= 20000) {
      out.push({
        id: `anom-${t.id}`, tone: 'warning', icon: 'Zap', weight: 88,
        title: `عملية «${t.description}» بقيمة ${formatOMR(t.amount)} أعلى بكثير من المعتاد`,
        detail: `الوسيط المعتاد لهذا البند ${formatOMR(Math.round(m))} في ${others.length} عمليات مشابهة (≈ ${Math.round(t.amount / m)} ضعفًا). تحقق منها إن لم تكن مقصودة.`,
      });
    }
  }

  // غير مصنف
  const other = dash.categories.find((c) => c.id === CAT.other);
  if (other && other.total > 0 && (other.share ?? 0) >= 5) {
    out.push({ id: 'other', tone: 'warning', icon: 'Tags', weight: 50, title: `${other.count} عمليات في «أخرى» بقيمة ${formatOMR(other.total)}`, detail: `تمثل ${other.share}% من الإنفاق. تصنيفها يحسّن دقة التحليل، وسيتذكر البرنامج اختيارك.` });
  }

  if (dash.transfersOwn > 0) {
    out.push({ id: 'transfers', tone: 'neutral', icon: 'ArrowLeftRight', weight: 40, title: `استُبعدت تحويلات بين حساباتك بقيمة ${formatOMR(dash.transfersOwn)}`, detail: 'التحويل بين حساباتك لا يُحتسب ضمن المصاريف.' });
  }

  if (dash.savings !== null) {
    out.push({ id: 'savings', tone: dash.savings >= 0 ? 'positive' : 'negative', icon: 'PiggyBank', weight: 92, title: dash.savings >= 0 ? `الفائض من الدخل ${formatOMR(dash.savings)}` : `تجاوز الإنفاق الدخل بـ ${formatOMR(-dash.savings)}`, detail: `الدخل المسجل ${formatOMR(dash.income)} مقابل مصاريف ${formatOMR(total)}.` });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

export const localProvider: AnalysisProvider = {
  id: 'local',
  name: 'المحرك المحلي',
  external: false,
  analyze: async (input) => localInsights(input),
};

/** ملخص مجمّع (دون أوصاف العمليات الفردية) لإرساله لمزود ذكاء اصطناعي مستقبلًا بعد موافقة المستخدم */
export function buildAISummary(dash: Dashboard) {
  return {
    period: dash.period.name,
    currency: 'OMR',
    total: dash.total / 1000,
    count: dash.count,
    budget: dash.budget !== null ? dash.budget / 1000 : null,
    daysElapsed: dash.timing.elapsedDays,
    categories: dash.categories.filter((c) => c.total > 0).map((c) => ({ name: c.name, total: c.total / 1000, count: c.count, budget: c.budget !== null ? c.budget / 1000 : null })),
    previousTotal: dash.prev ? dash.prev.total / 1000 : null,
  };
}
