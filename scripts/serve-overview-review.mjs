/** Loopback-only overview harness; no production route imports this file. */
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.INKBORNE_REVIEW_SOURCE ?? harnessRoot);
const require = createRequire(path.join(root, 'package.json'));
const { build } = require('esbuild');
const port = Number(process.env.INKBORNE_OVERVIEW_PORT ?? 3198);
const output = path.join(harnessRoot, 'test-results', 'local-overview-bundle');
const staticRoot = path.join(root, '.next', 'static');
const publicRoot = path.join(root, 'public');
await fs.mkdir(output, { recursive: true });
const stubs = {
  'next/link': `import React from 'react'; export default function Link({href,children,prefetch,replace,scroll,...props}) {return <a href={typeof href==='string'?href:href.pathname} {...props}>{children}</a>}`,
  'next/image': `import React from 'react'; export default function Image({src,alt,width,height,fill,priority,quality,sizes,unoptimized,...props}) {return <img src={typeof src==='string'?src:src.src} alt={alt} width={width} height={height} {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname==='/'?'/dashboard':location.pathname; export const useRouter=()=>({refresh(){location.reload()},push(url){location.assign(url)},replace(url){location.replace(url)},back(){history.back()}});export const useSearchParams=()=>new URLSearchParams(location.search);export const redirect=(path)=>{throw new Error('Local redirect '+path)};`,
  '@/lib/supabase/server': `export const createClient=async()=>window.overviewReview.createClient();`,
  '@/lib/supabase/client': `export const createClient=()=>window.overviewReview.createClient();`,
  '@/app/(app)/dashboard/actions': `export const dismissAlphaBanner=()=>window.overviewReview.dismissAlpha();`,
  '@/lib/supabase/feedback': `export const submitFeedback=async()=> 'Feedback is not sent from this fictional local review.';`,
};
await build({ absWorkingDir: root, tsconfig: path.join(root, 'tsconfig.json'), nodePaths: [path.join(root, 'node_modules')], entryPoints: [path.join(harnessRoot, 'e2e/local-overview/review-fixture.tsx')], outfile: path.join(output, 'fixture.js'), bundle: true, platform: 'browser', jsx: 'automatic', sourcemap: true, loader: { '.module.css': 'local-css' }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'overview-review-boundaries', setup(builder) {
  builder.onResolve({ filter: /^(next\/(link|image|navigation)|@\/lib\/supabase\/(server|client|feedback)|@\/app\/\(app\)\/dashboard\/actions)$/ }, args => ({ path: args.path, namespace: 'review-boundary' }));
  builder.onLoad({ filter: /.*/, namespace: 'review-boundary' }, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: root }));
} }] });
async function walk(directory) { const entries = await fs.readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat(); }
const cssFiles = (await walk(staticRoot)).filter(file => file.endsWith('.css'));
if (!cssFiles.length) throw new Error('A production build is required before local review.');
const css = (await Promise.all(cssFiles.map(async file => { const source = await fs.readFile(file, 'utf8'); const cssUrl = 'http://local/_next/static/' + path.relative(staticRoot, file).split(path.sep).join('/'); return source.replace(/url\((["']?)([^"')]+)\1\)/g, (match, quote, url) => /^(?:data:|https?:|\/|#)/.test(url) ? match : `url(${quote}${new URL(url, cssUrl).pathname}${quote})`); }))).join('\n');
const variables = [...css.matchAll(/\.([\w-]+)\s*\{[^{}]*--font-(?:marcellus|eb-garamond)\s*:/g)].map(match => match[1]);
const fontClasses = [...new Set(variables)].join(' ');
const initialTheme = `(function(){var t='dark';try{var s=localStorage.getItem('inkborne-theme');if(['dark','light','system'].includes(s))t=s}catch{}document.documentElement.classList.toggle('dark',t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)})();`;
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inkborne · local overview review</title><script>' + initialTheme + '</script><link rel="stylesheet" href="/production.css"><link rel="stylesheet" href="/fixture.css"></head><body class="' + fontClasses + '"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
const types = { '.js': 'text/javascript; charset=utf-8', '.map': 'application/json', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
async function safeFile(base, relative, response) { const absolute = path.resolve(base, relative); if (absolute !== base && !absolute.startsWith(base + path.sep)) { response.writeHead(403); response.end(); return; } try { const stat = await fs.stat(absolute); if (!stat.isFile()) throw new Error('Not a file'); response.setHeader('Content-Type', types[path.extname(absolute)] ?? 'application/octet-stream'); response.end(await fs.readFile(absolute)); } catch { response.writeHead(404); response.end(); } }
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405); response.end(); return; }
  let pathname; try { pathname = decodeURIComponent(new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname); } catch { response.writeHead(400); response.end(); return; }
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'none'; frame-src 'none'");
  if (pathname === '/production.css') { response.setHeader('Content-Type', 'text/css; charset=utf-8'); response.end(css); }
  else if (['/fixture.js', '/fixture.js.map', '/fixture.css', '/fixture.css.map'].includes(pathname)) await safeFile(output, pathname.slice(1), response);
  else if (pathname.startsWith('/_next/static/')) await safeFile(staticRoot, pathname.slice('/_next/static/'.length), response);
  else if (pathname.startsWith('/brand/')) await safeFile(publicRoot, pathname.slice(1), response);
  else if (['/', '/dashboard', '/characters'].includes(pathname)) { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); }
  else { response.writeHead(404); response.end('This path is outside the fictional local overview review.'); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
const metadata = { pid: process.pid, parentPid: process.ppid, workingDirectory: process.cwd(), sourceDirectory: root, harnessDirectory: harnessRoot, port, host: '127.0.0.1', startedAt: new Date().toISOString(), command: process.argv.join(' '), url: `http://127.0.0.1:${port}/dashboard`, simulatedData: true, simulatedBannerDismissal: true, hostedAccess: false };
await fs.writeFile(path.join(output, 'server-process.json'), JSON.stringify(metadata, null, 2)); console.log(JSON.stringify(metadata, null, 2));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
