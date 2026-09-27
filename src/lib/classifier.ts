import { CAT } from './defaults';
import { containsTerm, descKey, tokens } from './text';
import type { Car, Category, LearnedRule, Subscription } from './types';

export type Confidence = 'learned' | 'keyword' | 'group' | 'none';

export interface Classification {
  categoryId: string;
  confidence: Confidence;
  matched: string | null;
  reason: string;
}

/** أولوية التصنيفات عند تعارض الكلمات: مصاريف الأطفال تُنسب للتعليم والأطفال حتى لو احتوت على «حلاقة» أو «تسوق» */
const PRIORITY: Record<string, number> = {
  [CAT.education]: 20,
  [CAT.subscriptions]: 15,
  [CAT.health]: 8,
  [CAT.pets]: 8,
  [CAT.charity]: 8,
};

export function classify(
  description: string,
  categories: Category[],
  rules: LearnedRule[],
): Classification {
  const key = descKey(description);
  // 1) ما تعلّمه البرنامج من تصحيحات المستخدم له الأسبقية
  const rule = rules.find((r) => r.key === key);
  if (rule && categories.some((c) => c.id === rule.categoryId)) {
    return { categoryId: rule.categoryId, confidence: 'learned', matched: key, reason: 'تعلّمه البرنامج من تصحيحك السابق' };
  }
  const tk = tokens(description);
  let best: { id: string; score: number; term: string } | null = null;
  for (const c of categories) {
    for (const term of c.keywords) {
      if (!containsTerm(tk, term)) continue;
      const tt = tokens(term);
      const score = tt.length * 6 + tt.join('').length + (PRIORITY[c.parentId ?? c.id] ?? 0) + (c.parentId ? 3 : 0);
      if (!best || score > best.score) best = { id: c.id, score, term };
    }
  }
  if (best) {
    return { categoryId: best.id, confidence: 'keyword', matched: best.term, reason: `الكلمة «${best.term}»` };
  }
  return { categoryId: CAT.other, confidence: 'none', matched: null, reason: 'لم يُعثر على كلمة دالة' };
}

/** اكتشاف السيارة من الوصف عبر أسمائها البديلة */
export function detectCar(description: string, cars: Car[]): Car | null {
  const tk = tokens(description);
  let best: { car: Car; len: number } | null = null;
  for (const car of cars) {
    for (const alias of [car.name, ...car.aliases]) {
      if (!alias.trim()) continue;
      if (containsTerm(tk, alias)) {
        const len = tokens(alias).join('').length;
        if (!best || len > best.len) best = { car, len };
      }
    }
  }
  return best?.car ?? null;
}

export function detectSubscription(description: string, subs: Subscription[]): Subscription | null {
  const tk = tokens(description);
  let best: { sub: Subscription; len: number } | null = null;
  for (const s of subs) {
    for (const k of [s.name, ...s.keywords]) {
      if (!k.trim()) continue;
      if (containsTerm(tk, k)) {
        const len = tokens(k).join('').length;
        if (!best || len > best.len) best = { sub: s, len };
      }
    }
  }
  return best?.sub ?? null;
}

/** هل النص يشير إلى تحويل مالي يحتاج قرار المستخدم؟ */
export function looksLikeTransfer(description: string): boolean {
  const tk = tokens(description);
  return ['تحويل', 'حوالة', 'حواله', 'ارسال', 'تحويل بنكي', 'ايداع'].some((t) => containsTerm(tk, t));
}

export function rootCategoryId(categoryId: string, categories: Category[]): string {
  const c = categories.find((x) => x.id === categoryId);
  return c?.parentId ?? categoryId;
}

/** تحديث قاعدة متعلمة بعد تصحيح المستخدم */
export function learn(rules: LearnedRule[], description: string, categoryId: string, carId: string | null): LearnedRule {
  const key = descKey(description);
  const existing = rules.find((r) => r.key === key);
  return {
    key,
    categoryId,
    carId,
    count: existing && existing.categoryId === categoryId ? existing.count + 1 : 1,
    updatedAt: Date.now(),
  };
}
