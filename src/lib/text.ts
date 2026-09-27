import { normalizeDigits } from './money';

/**
 * توحيد النص العربي للمطابقة: إزالة التشكيل والتطويل، توحيد الألف والتاء المربوطة والياء.
 * يُستخدم للمقارنة فقط، ولا يغيّر النص المعروض.
 */
export function normalizeAr(s: string): string {
  return normalizeDigits(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // تشكيل + تطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(s: string): string[] {
  const n = normalizeAr(s);
  return n ? n.split(' ') : [];
}

/** مطابقة كلمة من النص مع كلمة من الكلمة المفتاحية، مع مراعاة «ال» و«لل» و«ل» و«و» الملتصقة */
function tokenMatch(term: string, word: string): boolean {
  if (word === term) return true;
  const bare = term.startsWith('ال') ? term.slice(2) : term;
  if (bare.length >= 2) {
    for (const p of ['ال', 'لل', 'ل', 'و', 'وال', 'بال', 'ب']) if (word === p + bare) return true;
  }
  // الكلمات الطويلة: تسمح بالأخطاء الإملائية الشائعة والإلحاق (مثل «الولو» ← «لولو»، «حلاقه» ← «حلاق»)
  if (bare.length >= 4 && word.includes(bare)) return true;
  return false;
}

/** هل يحتوي النص (بعد التوحيد) على العبارة كاملة ككلمات متتالية؟ */
export function containsTerm(textTokens: string[], term: string): boolean {
  const tt = tokens(term);
  if (!tt.length || tt.length > textTokens.length) return false;
  for (let i = 0; i + tt.length <= textTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < tt.length; j++) if (!tokenMatch(tt[j], textTokens[i + j])) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

/** مفتاح ثابت للوصف يُستخدم للتعلم واكتشاف التكرار والقيم الشاذة */
export function descKey(desc: string): string {
  return normalizeAr(desc);
}
