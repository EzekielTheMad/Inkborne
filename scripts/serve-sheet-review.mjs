/** Explicit loopback-only synthetic review server. Never imported by Next.
 * Run after npm run build so the exact production CSS/fonts are available. */
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3196;
const output = path.join(root, "test-results", "local-sheet-bundle");
const staticRoot = path.join(root, ".next", "static");
const publicRoot = path.join(root, "public");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "next/link": `import React from 'react'; export default function Link({href,children,prefetch,replace,scroll,...props}) {return <a href={href} {...props}>{children}</a>}`,
  "next/image": `import React from 'react'; export default function Image({src,alt,width,height,fill,priority,quality,sizes,unoptimized,...props}) {return <img src={typeof src==='string'?src:src.src} alt={alt} width={width} height={height} {...props}/>}`,
  "next/navigation": `export const usePathname=()=>'/characters/'+window.sheetReview.currentId;export const useRouter=()=>({refresh(){},push(url){location.assign(url)},replace(url){location.replace(url)},back(){history.back()}});export const useSearchParams=()=>new URLSearchParams(location.search);`,
  "@/lib/supabase/client": `export const createClient=()=>({rpc:(...args)=>window.sheetReview.call('rpc',...args),auth:{getUser:async()=>({data:{user:null},error:null})},from(name){throw new Error('Unexpected local database operation: '+name)}});`,
  "@/lib/supabase/inventory": exports(["addInventoryItem","updateInventoryItem","removeInventoryItem","unequipAllArmor","searchItems"]),
  "@/lib/supabase/spells": exports(["addCharacterSpell","updateCharacterSpell","removeCharacterSpell","searchSpells"]),
  "@/lib/supabase/rolls": exports(["insertRoll"]),
  "@/lib/supabase/character-client": exports(["updateCharacterColor"]),
  "@/lib/supabase/feedback": exports(["submitFeedback"]),
  "@/app/(app)/characters/[id]/narrative-actions": exports(["saveNarrative","saveNarrativeRich","savePersonalityChoices","uploadPortrait","uploadToken","deletePortrait","deleteToken"]),
  "@/app/(app)/characters/[id]/story-actions": exports(["createTimelineEvent","updateTimelineEvent","deleteTimelineEvent","createRelationship","updateRelationship","deleteRelationship"]),
};
function exports(names) { return names.map(name=>`export const ${name}=(...args)=>window.sheetReview.call('${name}',...args);`).join('\n'); }
await build({ absWorkingDir: root, entryPoints: ["e2e/local-sheet/review-fixture.tsx"], outfile: path.join(output,"fixture.js"), bundle:true, platform:"browser", jsx:"automatic", sourcemap:true, loader:{".module.css":"local-css"}, define:{"process.env.NODE_ENV":'"production"'}, plugins:[{name:"review-external-boundaries",setup(builder){
  builder.onResolve({filter:/^(next\/(link|image|navigation)|@\/lib\/supabase\/(client|inventory|spells|rolls|character-client|feedback)|@\/app\/\(app\)\/characters\/\[id\]\/(narrative-actions|story-actions))$/},args=>({path:args.path,namespace:"review-boundary"}));
  builder.onLoad({filter:/.*/,namespace:"review-boundary"},args=>({contents:stubs[args.path],loader:"jsx",resolveDir:root}));
}}] });
async function walk(directory) { const entries=await fs.readdir(directory,{withFileTypes:true});const nested=await Promise.all(entries.map(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]));return nested.flat(); }
const cssFiles=(await walk(staticRoot)).filter(file=>file.endsWith(".css"));
if(!cssFiles.length) throw new Error("Run npm run build before starting local review; production CSS is missing.");
const css=(await Promise.all(cssFiles.map(async file=>{
  const source=await fs.readFile(file,"utf8");
  const cssUrl="http://local/_next/static/"+path.relative(staticRoot,file).split(path.sep).join("/");
  // Concatenating chunks changes relative URL bases. Keep every built font or
  // image pointing at the same original static asset after concatenation.
  return source.replace(/url\((["']?)([^"')]+)\1\)/g,(match,quote,url)=>{
    if(/^(?:data:|https?:|\/|#)/.test(url))return match;
    return `url(${quote}${new URL(url,cssUrl).pathname}${quote})`;
  });
}))).join("\n");
// Match the exact generated next/font variable declarations instead of guessing
// per-build class hashes. Font URLs continue to use the built static assets.
const variables=[...css.matchAll(/\.([\w-]+)\s*\{[^{}]*--font-(?:marcellus|eb-garamond)\s*:/g)].map(match=>match[1]);
const fontClasses=[...new Set(variables)].join(" ");
const initialTheme=`(function(){var t='dark';try{var s=localStorage.getItem('inkborne-theme');if(['dark','light','system'].includes(s))t=s}catch{}document.documentElement.classList.toggle('dark',t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)})();`;
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inkborne · local character review</title><script>'+initialTheme+'</script><link rel="stylesheet" href="/production.css"><link rel="stylesheet" href="/fixture.css"></head><body class="'+fontClasses+'"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
const types={".js":"text/javascript; charset=utf-8",".map":"application/json",".css":"text/css; charset=utf-8",".woff2":"font/woff2",".woff":"font/woff",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg",".jpeg":"image/jpeg"};
async function safeFile(base, relative, response) { const absolute=path.resolve(base,relative);if(absolute!==base&&!absolute.startsWith(base+path.sep)){response.writeHead(403);response.end();return;}try{const stat=await fs.stat(absolute);if(!stat.isFile()){response.writeHead(404);response.end();return;}response.setHeader("Content-Type",types[path.extname(absolute)]??"application/octet-stream");response.end(await fs.readFile(absolute));}catch{response.writeHead(404);response.end();} }
const server=http.createServer(async(request,response)=>{
  if(!["GET","HEAD"].includes(request.method??"")){response.writeHead(405);response.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(request.url??"/",`http://127.0.0.1:${port}`).pathname);}catch{response.writeHead(400);response.end();return;}
  response.setHeader("Cache-Control","no-store");response.setHeader("X-Content-Type-Options","nosniff");
  if(pathname==="/production.css"){response.setHeader("Content-Type","text/css; charset=utf-8");response.end(css);}
  else if(["/fixture.js","/fixture.js.map","/fixture.css","/fixture.css.map"].includes(pathname))await safeFile(output,pathname.slice(1),response);
  else if(pathname.startsWith("/_next/static/"))await safeFile(staticRoot,pathname.slice("/_next/static/".length),response);
  else if(pathname.startsWith("/brand/"))await safeFile(publicRoot,pathname.slice(1),response);
  else if(pathname==="/"||pathname==="/sheet"){response.setHeader("Content-Type","text/html; charset=utf-8");response.end(html);}
  else {response.writeHead(404);response.end("This path is outside the local character review.");}
});
server.on("error",error=>{console.error(error.message);process.exitCode=1;});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});
const metadata={pid:process.pid,parentPid:process.ppid,workingDirectory:root,port,host:"127.0.0.1",startedAt:new Date().toISOString(),command:process.argv.join(" "),url:`http://127.0.0.1:${port}/`,simulatedPersistence:true};
await fs.writeFile(path.join(output,"server-process.json"),JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata,null,2));
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>server.close(()=>process.exit(0)));
