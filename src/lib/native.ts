/**
 * تكامل تطبيق أندرويد (Capacitor).
 * في المتصفح لا تُحمَّل هذه الإضافات أبدًا؛ تعمل فقط داخل التطبيق.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/** حفظ ملف داخل التطبيق ثم فتح نافذة المشاركة (حفظ في الملفات، Drive، واتساب…) */
export async function nativeSave(filename: string, data: Blob | string): Promise<'saved' | 'declined' | 'failed'> {
  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data;
    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] ?? '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
    const safe = filename.replace(/[\\/:*?"<>|]/g, '-');
    const written = await Filesystem.writeFile({ path: safe, data: base64, directory: Directory.Cache });
    try {
      await Share.share({ title: safe, url: written.uri, dialogTitle: 'حفظ أو مشاركة الملف' });
      return 'saved';
    } catch (e: any) {
      return /cancel/i.test(String(e?.message ?? e)) ? 'declined' : 'failed';
    }
  } catch {
    return 'failed';
  }
}

/** زر الرجوع في أندرويد: يغلق النوافذ المفتوحة، ثم يعود للرئيسية، ثم يخرج من التطبيق */
export async function setupNative() {
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => {
    const dialog = document.querySelector('[role="dialog"] button[aria-label="إغلاق"]') as HTMLButtonElement | null;
    if (dialog) { dialog.click(); return; }
    const esc = new KeyboardEvent('keydown', { key: 'Escape' });
    if (document.querySelector('[role="dialog"]')) { window.dispatchEvent(esc); return; }
    if (location.hash && location.hash !== '#dashboard') { location.hash = '#dashboard'; return; }
    void App.exitApp();
  });
}
