import { Cpu, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card, PageHeader } from '../components/ui';
import { localProvider, type Insight } from '../lib/insights';
import { useApp } from '../store/AppContext';
import { useDashboard, useSortedPeriods } from '../store/hooks';

const TONE = {
  negative: { cls: 'bg-red-500/10 text-red-500', label: 'يحتاج انتباهًا' },
  warning: { cls: 'bg-amber-500/10 text-amber-600', label: 'تنبيه' },
  positive: { cls: 'bg-emerald/10 text-emerald', label: 'إيجابي' },
  neutral: { cls: 'bg-navy/5 text-navy dark:bg-gold/10 dark:text-gold', label: 'معلومة' },
} as const;

export function Analyst() {
  const app = useApp();
  const sorted = useSortedPeriods();
  const [pid, setPid] = useState(app.period?.id ?? '');
  const d = useDashboard(pid);
  const [insights, setInsights] = useState<Insight[]>([]);
  useEffect(() => {
    if (!d) return;
    let alive = true;
    localProvider.analyze({ dash: d, allTx: app.txs, categories: app.categories, cars: app.cars }).then((r) => alive && setInsights(r));
    return () => { alive = false; };
  }, [d, app.txs, app.categories, app.cars]);
  if (!d) return null;
  const attention = insights.filter((i) => i.tone === 'negative' || i.tone === 'warning');
  const rest = insights.filter((i) => i.tone !== 'negative' && i.tone !== 'warning');

  const Item = ({ i }: { i: Insight }) => (
    <li className="flex gap-3 py-3.5">
      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${TONE[i.tone].cls}`}><Icon name={i.icon} size={18} /></span>
      <div className="min-w-0">
        <p className="font-medium leading-7">{i.title}</p>
        <p className="text-sm text-muted leading-6">{i.detail}</p>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="المحلل المالي" subtitle="قراءة تلقائية لبياناتك الفعلية. كل رقم هنا محسوب من عملياتك المسجلة."
        actions={<select aria-label="الشهر المالي" className="input h-10 w-auto" value={pid} onChange={(e) => setPid(e.target.value)}>{sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {attention.length > 0 && (
            <Card title={`يحتاج انتباهك (${attention.length})`}>
              <ul className="divide-y divide-line -my-3">{attention.map((i) => <Item key={i.id} i={i} />)}</ul>
            </Card>
          )}
          <Card title="قراءة الشهر">
            <ul className="divide-y divide-line -my-3">{rest.map((i) => <Item key={i.id} i={i} />)}</ul>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="مصدر التحليل">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald/10 text-emerald flex items-center justify-center shrink-0"><Cpu size={18} /></span>
              <div className="text-sm leading-6">
                <p className="font-medium">{localProvider.name}</p>
                <p className="text-muted">قواعد وحسابات محلية على جهازك: مقارنات، نسب، ميزانيات، وقيم غير معتادة. لا شيء يُرسل خارج المتصفح.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-sunk p-3.5 text-xs text-muted leading-6 flex gap-2">
              <ShieldCheck size={16} className="shrink-0 text-gold mt-0.5" />
              <span>البنية جاهزة لإضافة Gemini API أو Claude API لاحقًا عبر واجهة موحدة، وتُرسل عندها ملخصات مجمّعة فقط وبعد موافقتك الصريحة.</span>
            </div>
          </Card>
          <Card title="طريقة القراءة">
            <ul className="space-y-2 text-sm">
              {(Object.keys(TONE) as (keyof typeof TONE)[]).map((t) => <li key={t} className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${TONE[t].cls}`} />{TONE[t].label}</li>)}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
