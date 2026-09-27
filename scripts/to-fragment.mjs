// يحوّل ناتج البناء أحادي الملف إلى صفحة قابلة للنشر كصفحة Claude (دون وسوم html/head/body).
// ملاحظة: الشيفرة المضمّنة تحتوي نصوصًا مثل "</head>" لذلك نعتمد على مواقع الوسوم لا على تعابير نمطية جشعة.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('dist-single/index.html', 'utf8');
const title = src.match(/<title>[\s\S]*?<\/title>/i)[0];
const fonts = [...src.slice(0, 2000).matchAll(/<link[^>]+fonts\.g[^>]+>/gi)].map((m) => m[0]).join('\n');
const sStart = src.indexOf('<script type="module"');
const cStart = src.lastIndexOf('<style');
const bodyStart = src.lastIndexOf('<body>');
if (sStart < 0 || cStart < 0 || cStart < sStart) throw new Error('unexpected build layout');
const script = src.slice(sStart, src.lastIndexOf('</script>', cStart) + 9);
const style = src.slice(cStart, src.lastIndexOf('</style>', bodyStart) + 8);
const out = `${title}\n<meta name="theme-color" content="#10243A">\n${fonts}\n${style}\n<div id="root"></div>\n${script}\n`;
writeFileSync('dist-single/ozbati.html', out);
console.log('fragment bytes', out.length, 'script', script.length, 'style', style.length);
