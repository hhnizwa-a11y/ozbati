import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` → dist/ (قابل للاستضافة كـ PWA)
// `vite build --mode single` → ملف HTML واحد مستقل (للنشر كصفحة واحدة)
export default defineConfig(({ mode }) => ({
  // مسارات نسبية: تعمل على GitHub Pages وداخل تطبيق أندرويد
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 4000,
  },
  test: { environment: 'node' },
}));
