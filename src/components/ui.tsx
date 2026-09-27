import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { formatAmount } from '../lib/money';
import type { Baisa, Category } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Icon } from './Icon';

/** عرض المبلغ: الريالات بخط كامل والبيسات الثلاث بوزن أخف */
export function Money({ value, className = '', unit = true, sign = false, baisaClass = 'opacity-60' }: { value: Baisa | null | undefined; className?: string; unit?: boolean; sign?: boolean; baisaClass?: string }) {
  if (value === null || value === undefined) return <span className={`num ${className}`}>—</span>;
  const s = formatAmount(Math.abs(value));
  const [r, b] = s.split('.');
  const prefix = value < 0 ? '−' : sign && value > 0 ? '+' : '';
  return (
    <span className={`num whitespace-nowrap ${className}`} dir="ltr">
      {unit && <span className="text-[.62em] font-normal opacity-70" style={{ marginRight: '.3em' }} dir="rtl">ر.ع</span>}
      {prefix}{r}<span className={baisaClass}>.{b}</span>
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide = false, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-5xl' : 'sm:max-w-lg'} max-h-[92vh] flex flex-col bg-surface rounded-t-3xl sm:rounded-3xl shadow-pop animate-sheet`}>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto scroll-thin px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex flex-wrap gap-2 justify-end" style={{ paddingBottom: 'calc(.75rem + env(safe-area-inset-bottom, 0px))' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const { confirm, closeConfirm } = useApp();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTyped(''); setBusy(false); }, [confirm]);
  if (!confirm) return null;
  const blocked = !!confirm.typeToConfirm && typed.trim() !== confirm.typeToConfirm;
  return (
    <Modal
      open
      onClose={closeConfirm}
      title={confirm.title}
      footer={
        <>
          <button className="btn-soft" onClick={closeConfirm}>إلغاء</button>
          <button
            className={confirm.danger ? 'btn-danger' : 'btn-primary'}
            disabled={blocked || busy}
            onClick={async () => { setBusy(true); try { await confirm.onConfirm(); } finally { closeConfirm(); } }}
          >
            {confirm.confirmLabel ?? 'تأكيد'}
          </button>
        </>
      }
    >
      {confirm.body && <p className="text-sm text-muted leading-7">{confirm.body}</p>}
      {confirm.typeToConfirm && (
        <div className="mt-4">
          <label className="label" htmlFor="confirm-type">اكتب «{confirm.typeToConfirm}» للتأكيد</label>
          <input id="confirm-type" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
      )}
    </Modal>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed z-[60] inset-x-0 bottom-24 lg:bottom-6 flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-sheet flex items-center gap-3 rounded-2xl bg-navy text-white dark:bg-[#1c3552] shadow-pop ps-4 pe-2 py-2.5 max-w-md w-full sm:w-auto">
          {t.tone === 'success' ? <CheckCircle2 size={18} className="text-emerald shrink-0" /> : t.tone === 'error' ? <AlertTriangle size={18} className="text-red-400 shrink-0" /> : <Info size={18} className="text-gold shrink-0" />}
          <span className="text-sm flex-1">{t.text}</span>
          {t.action && (
            <button className="btn-sm btn bg-white/10 hover:bg-white/20 text-gold" onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>
          )}
          <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => dismissToast(t.id)} aria-label="إغلاق"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function CategoryDot({ cat, size = 32 }: { cat: Pick<Category, 'icon' | 'color'> | undefined; size?: number }) {
  const color = cat?.color ?? '#94A3B8';
  return (
    <span className="inline-flex items-center justify-center rounded-xl shrink-0" style={{ width: size, height: size, background: `${color}1f`, color }}>
      <Icon name={cat?.icon ?? 'CircleDashed'} size={Math.round(size * 0.5)} />
    </span>
  );
}

export function CategoryChip({ cat }: { cat: Category | undefined }) {
  const color = cat?.color ?? '#94A3B8';
  return (
    <span className="chip max-w-full" style={{ background: `${color}1a`, color }}>
      <Icon name={cat?.icon ?? 'CircleDashed'} size={13} />
      <span className="truncate text-ink/85">{cat?.name ?? 'أخرى'}</span>
    </span>
  );
}

export function Progress({ value, state }: { value: number | null; state: 'ok' | 'warn' | 'over' | 'none' }) {
  const w = Math.min(100, Math.max(0, value ?? 0));
  const color = state === 'over' ? 'bg-red-500' : state === 'warn' ? 'bg-amber-500' : 'bg-emerald';
  return (
    <div className="h-2 rounded-full bg-sunk overflow-hidden" role="progressbar" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function StatePill({ state, used }: { state: 'ok' | 'warn' | 'over' | 'none'; used: number | null }) {
  if (state === 'none') return <span className="chip bg-sunk text-muted">بلا ميزانية</span>;
  const cls = state === 'over' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : state === 'warn' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald/10 text-emerald-700 dark:text-emerald';
  const label = state === 'over' ? 'تجاوز' : state === 'warn' ? 'تنبيه' : 'ضمن الحد';
  return <span className={`chip ${cls}`}><span className="num">{used}%</span> · {label}</span>;
}

export function Empty({ icon = 'Info', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10 px-4">
      <span className="w-12 h-12 rounded-2xl bg-sunk text-muted flex items-center justify-center"><Icon name={icon} size={22} /></span>
      <div>
        <p className="font-semibold">{title}</p>
        {body && <p className="text-sm text-muted mt-1 max-w-sm leading-6">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={`inline-flex p-1 rounded-xl bg-sunk gap-1 ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`px-3 h-8 rounded-lg text-xs font-medium transition ${value === o.value ? 'bg-surface shadow-card text-ink' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          {title && <h3 className="section-title">{title}</h3>}
          {action}
        </div>
      )}
      <div className={pad ? 'p-5 pt-3' : ''}>{children}</div>
    </section>
  );
}
