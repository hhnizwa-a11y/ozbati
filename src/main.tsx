import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/readex-pro/300.css';
import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/600.css';
import '@fontsource/readex-pro/700.css';
import './index.css';
import { setupNative, isNative } from './lib/native';

document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'ar');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: تسجيل Service Worker عند الاستضافة على خادم (لا يعمل داخل الصفحات المضمّنة)
if (isNative()) {
  void setupNative();
} else if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.MODE !== 'single' && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
