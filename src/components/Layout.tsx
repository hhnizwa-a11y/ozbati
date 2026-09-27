import {
  BarChart3, BrainCircuit, Car, FileText, LayoutDashboard, ListChecks, Menu, MessageSquareText, Moon, Plus, Repeat, Settings,
  Sun, Target, CalendarRange, X, Monitor, HardDriveDownload,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApp } from '../store/AppContext';

export type Route = 'dashboard' | 'transactions' | 'import' | 'analytics' | 'budgets' | 'cars' | 'subscriptions' | 'reports' | 'analyst' | 'periods' | 'settings';

export const NAV: { id: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'transactions', label: 'العمليات', icon: ListChecks },
  { id: 'import', label: 'استيراد واتساب', icon: MessageSquareText },
  { id: 'analytics', label: 'التحليل', icon: BarChart3 },
  { id: 'budgets', label: 'الميزانيات والأهداف', icon: Target },
  { id: 'cars', label: 'مصاريف السيارات', icon: Car },
  { id: 'subscriptions', label: 'الاشتراكات', icon: Repeat },
  { id: 'reports', label: 'التقارير', icon: FileText },
  { id: 'analyst', label: 'المحلل المالي', icon: BrainCircuit },
  { id: 'periods', label: 'العزب الشهرية', icon: CalendarRange },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

const MOBILE: Route[] = ['dashboard', 'transactions', 'import', 'analytics'];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg width="36" height="36" viewBox="0 0 512 512" aria-hidden>
        <rect width="512" height="512" rx="120" fill="#10243A" stroke="#D6AC59" strokeOpacity=".35" strokeWidth="10" />
        <circle cx="256" cy="256" r="150" fill="none" stroke="#D6AC59" strokeWidth="28" />
        <path d="M196 262l44 44 84-96" fill="none" stroke="#10B981" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="font-semibold text-white text-[17px]">عزبتي <span className="text-white/40 font-light text-sm">| Ozbati</span></div>
          <div className="text-[11px] text-gold">كل بيسة محسوبة</div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle({ dark = false }: { dark?: boolean }) {
  const { settings, saveSettings } = useApp();
  const order = ['system', 'light', 'dark'] as const;
  const next = order[(order.indexOf(settings.theme) + 1) % 3];
  const I = settings.theme === 'dark' ? Moon : settings.theme === 'light' ? Sun : Monitor;
  const label = settings.theme === 'dark' ? 'الوضع الليلي' : settings.theme === 'light' ? 'الوضع النهاري' : 'حسب الجهاز';
  return (
    <button onClick={() => saveSettings({ theme: next })} title={`المظهر: ${label}`}
      className={dark ? 'w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm text-white/70 hover:bg-white/5 hover:text-white' : 'icon-btn'}>
      <I size={18} />{dark && <span>{label}</span>}
    </button>
  );
}

export function Layout({ route, go, children }: { route: Route; go: (r: Route) => void; children: ReactNode }) {
  const { openEditor, persistent } = useApp();
  const [more, setMore] = useState(false);
  return (
    <div className="min-h-full lg:flex">
      {/* القائمة الجانبية للكمبيوتر */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-navy text-white sticky top-0 h-screen" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-5 pt-6 pb-5"><Logo /></div>
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 space-y-0.5">
          {NAV.map((n) => {
            const active = route === n.id;
            return (
              <button key={n.id} onClick={() => go(n.id)}
                className={`w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition ${active ? 'bg-white/10 text-white font-medium' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
                <n.icon size={18} className={active ? 'text-gold' : ''} />
                {n.label}
                {active && <span className="ms-auto w-1.5 h-1.5 rounded-full bg-emerald" />}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <ThemeToggle dark />
          <button onClick={() => openEditor()} className="w-full btn bg-emerald text-navy-950 font-semibold hover:brightness-110 h-11"><Plus size={18} /> إضافة مصروف</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* الشريط العلوي للهاتف */}
        <header className="lg:hidden sticky z-30 bg-navy text-white px-4 h-14 flex items-center justify-between" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <Logo />
          <div className="flex items-center gap-1 text-white">
            <ThemeToggle />
          </div>
        </header>
        {!persistent && (
          <div className="bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs px-4 py-2 flex items-center gap-2">
            <HardDriveDownload size={14} className="shrink-0" />
            المتصفح لا يسمح بالتخزين الدائم هنا (ربما نافذة خاصة). البيانات ستُفقد عند الإغلاق؛ صدّر نسخة احتياطية من الإعدادات.
          </div>
        )}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 lg:pt-8 pb-32 lg:pb-12">{children}</main>
      </div>

      {/* الزر العائم */}
      <button onClick={() => openEditor()} aria-label="إضافة مصروف"
        className="lg:hidden fixed z-40 left-4 w-14 h-14 rounded-2xl bg-emerald text-white shadow-pop flex items-center justify-center active:scale-95 transition"
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))' }}>
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {/* شريط التنقل السفلي للهاتف */}
      <nav className="lg:hidden fixed z-30 inset-x-0 bottom-0 bg-surface/95 backdrop-blur border-t border-line grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {MOBILE.map((id) => {
          const n = NAV.find((x) => x.id === id)!;
          const active = route === id;
          return (
            <button key={id} onClick={() => go(id)} className={`flex flex-col items-center justify-center gap-1 h-16 text-[10.5px] ${active ? 'text-ink font-medium' : 'text-muted'}`}>
              <span className={`w-10 h-7 rounded-full flex items-center justify-center transition ${active ? 'bg-emerald/15 text-emerald' : ''}`}><n.icon size={19} /></span>
              {id === 'import' ? 'استيراد' : n.label}
            </button>
          );
        })}
        <button onClick={() => setMore(true)} className={`flex flex-col items-center justify-center gap-1 h-16 text-[10.5px] ${!MOBILE.includes(route) ? 'text-ink font-medium' : 'text-muted'}`}>
          <span className={`w-10 h-7 rounded-full flex items-center justify-center ${!MOBILE.includes(route) ? 'bg-emerald/15 text-emerald' : ''}`}><Menu size={19} /></span>
          المزيد
        </button>
      </nav>

      {more && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-navy-950/50 animate-fade" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-surface rounded-t-3xl p-4 animate-sheet" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="font-semibold">كل الأقسام</span>
              <button className="icon-btn" onClick={() => setMore(false)} aria-label="إغلاق"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.map((n) => (
                <button key={n.id} onClick={() => { go(n.id); setMore(false); }}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-3 text-xs text-center ${route === n.id ? 'bg-emerald/10 text-ink' : 'bg-sunk text-ink/80'}`}>
                  <n.icon size={20} className={route === n.id ? 'text-emerald' : 'text-muted'} />
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
