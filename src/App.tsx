import { useEffect, useState } from 'react';
import { Layout, NAV, type Route } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { TxEditor } from './components/TxEditor';
import { ConfirmDialog, Toasts } from './components/ui';
import { Analyst } from './pages/Analyst';
import { Analytics } from './pages/Analytics';
import { Budgets } from './pages/Budgets';
import { Cars } from './pages/Cars';
import { Dashboard } from './pages/Dashboard';
import { ImportPage } from './pages/Import';
import { Periods } from './pages/Periods';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { Subscriptions } from './pages/Subscriptions';
import { Transactions } from './pages/Transactions';
import { AppProvider, useApp } from './store/AppContext';

const readHash = (): Route => {
  const h = (typeof location !== 'undefined' ? location.hash.slice(1) : '') as Route;
  return NAV.some((n) => n.id === h) ? h : 'dashboard';
};

function Shell() {
  const { ready, settings } = useApp();
  const [route, setRoute] = useState<Route>(readHash);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (r: Route) => {
    setRoute(r);
    try { history.replaceState(null, '', `#${r}`); } catch { /* بيئة مقيدة */ }
    window.scrollTo({ top: 0 });
  };
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted text-sm">
          <div className="w-10 h-10 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
          جارٍ فتح عزبتي…
        </div>
      </div>
    );
  }
  const pages: Record<Route, JSX.Element> = {
    dashboard: <Dashboard go={go} />,
    transactions: <Transactions />,
    import: <ImportPage go={go} />,
    analytics: <Analytics />,
    budgets: <Budgets />,
    cars: <Cars />,
    subscriptions: <Subscriptions />,
    reports: <Reports />,
    analyst: <Analyst />,
    periods: <Periods />,
    settings: <SettingsPage />,
  };
  return (
    <Layout route={route} go={go}>
      <div key={route} className="animate-rise">{pages[route]}</div>
      <TxEditor />
      <ConfirmDialog />
      <Toasts />
      {!settings.onboarded && <Onboarding />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
