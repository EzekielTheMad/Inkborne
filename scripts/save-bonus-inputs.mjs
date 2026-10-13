import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const sourceCheckpoint='548e62b50889aa653b7be7e6c9dd24f118f5dbf0';
export const saveBonusSha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const bundleLimits={maxFiles:2,maxFileBytes:16_777_216,maxTotalBytes:33_554_432,maxMetafileBytes:8_388_608,maxInputs:8192};
const git=(root,args)=>execFileSync('git',['-C',root,...args],{windowsHide:true});
export const ownPaths=['e2e/local-save-bonus/fixture.tsx','e2e/local-save-bonus/playwright.config.ts','e2e/local-save-bonus/save-bonus.spec.mjs','scripts/save-bonus-inputs.mjs','scripts/save-bonus-scenarios.mjs','scripts/verify-save-bonus-local.mjs','e2e/local-save-bonus/verify-bonus-pdfs.py'];
export const producerBlobs={
 'lib/sheet/helpers.ts':'87a7c022dd8ddb28a7018dd33b654124a8ade072',
 'lib/character/ability-mechanics.ts':'dfec90245e8800cfd20e49ed7172cdc271ce7eb1',
 'lib/character/character-context.tsx':'1cda5db839ea29f4efecbd996af5a299a6d9b37c',
 'components/sheet/saving-throws.tsx':'8227558d966e428fe51f4462de03fe3b3883b221',
 'components/sheet/concentration-prompt.tsx':'9100705d9e58837232c184149e971bfef2564655',
 'lib/character/print-model.ts':'461adb8abeab8a1bc01331863120692cb17ecf20',
 'components/sheet/character-print-action.tsx':'ac594ecf35de1c894ed8419096553dc9d1f989ac',
 'e2e/print/fixtures.ts':'c1c794833b0c2afa30312516b0ec71a42e261326',
};
const inherited={'scripts/npc-process.mjs':'0841bda7b9e785280e684030bf4fe900d81465e5','scripts/passive-feature-production-assets.mjs':'e4058f8a31cd911583a312e59fedcf4c3fd4adae'};
export async function boundFile(root,relative,expected){
 assert.ok(relative&&!relative.split('/').includes('..')&&!path.isAbsolute(relative));
 for(const args of [['diff','--cached','HEAD','--',relative],['diff','--',relative],['ls-files','--unmerged','--',relative]])assert.equal(git(root,args).toString().trim(),'');
 assert.equal(git(root,['ls-files','--error-unmatch','--',relative]).toString().trim(),relative);
 const head=git(root,['rev-parse',`HEAD:${relative}`]).toString().trim(),index=git(root,['rev-parse',`:${relative}`]).toString().trim();
 assert.equal(head,index);if(expected)assert.equal(head,expected,`Unreviewed source ${relative}`);
 const attrs=git(root,['check-attr','filter','working-tree-encoding','text','eol','ident','--',relative]).toString().trim();
 assert.ok(attrs.includes(`${relative}: filter: unspecified`)&&attrs.includes(`${relative}: working-tree-encoding: unspecified`));
 const config={};for(const key of ['core.autocrlf','core.eol','core.safecrlf','core.attributesfile']){try{config[key]=git(root,['config','--show-origin','--get',key]).toString().trim()}catch(error){if(error.status!==1)throw error;config[key]=null}}
 const info=await fs.lstat(path.join(root,relative));assert.ok(info.isFile()&&!info.isSymbolicLink());
 const parts=relative.split('/');for(let length=1;length<parts.length;length++){const parent=await fs.lstat(path.join(root,...parts.slice(0,length)));assert.ok(parent.isDirectory()&&!parent.isSymbolicLink(),'Project source ancestor symlink refused')}
 const bytes=await fs.readFile(path.join(root,relative));assert.equal(saveBonusSha(bytes),saveBonusSha(git(root,['cat-file','--filters',`--path=${relative}`,head])));
 return{relativePath:relative,headOid:head,indexOid:index,attrs,config,executedSha256:saveBonusSha(bytes),gitBlobSha256:saveBonusSha(git(root,['show',`HEAD:${relative}`]))};
}
export async function verifySaveBonusInputs(root,manifestPath,checkpoint){
 assert.equal(typeof checkpoint,'function');checkpoint('before complete source/runtime proof');
 const manifestBytes=await fs.readFile(manifestPath),manifest=JSON.parse(manifestBytes.toString('utf8').replace(/^\uFEFF/,''));
 assert.match(manifest.harnessSourceCommit,/^[a-f0-9]{40}$/,'Root must supply the independently reviewed harness freeze');
 const rootCheckout=path.resolve(root,'../equipment-verification'),files=[],helpers=[];
 for(const checkout of [root,rootCheckout])assert.equal(git(checkout,['status','--porcelain','--untracked-files=no']).toString().trim(),'');
 for(const relative of [...ownPaths,...Object.keys(producerBlobs),'package.json','package-lock.json','tsconfig.json','supabase/seed.sql','e2e/print/verify-pdfs.py']){
  checkpoint(`source proof ${relative}`);
  const sourceRef=ownPaths.includes(relative)?manifest.harnessSourceCommit:sourceCheckpoint;
  const expected=producerBlobs[relative]??git(root,['rev-parse',`${sourceRef}:${relative}`]).toString().trim();
  const worker=await boundFile(root,relative,expected),built=await boundFile(rootCheckout,relative,expected);assert.equal(worker.executedSha256,built.executedSha256);files.push({relativePath:relative,expected,worker,root:built});
 }
 for(const [relative,expected]of Object.entries(inherited)){checkpoint(`inherited source ${relative}`);const worker=await boundFile(root,relative,expected),built=await boundFile(rootCheckout,relative,expected);assert.equal(worker.executedSha256,built.executedSha256);helpers.push({relativePath:relative,expected,worker,root:built})}
 return{rootHead:git(rootCheckout,['rev-parse','HEAD']).toString().trim(),workerHead:git(root,['rev-parse','HEAD']).toString().trim(),manifestSha256:saveBonusSha(manifestBytes),files,helpers,installedRuntime:await runtimeProof(root,rootCheckout,checkpoint)};
}
async function runtimeProof(root, rootCheckout, checkpoint) {
  checkpoint('before expensive installed closure');
  // Installed Node resolution + full file-set/raw-byte binding, following the
  // reviewed R13 walker. All work stays within finite lock-described packages.
  const limits = { maxPackages: 256, maxEdges: 4096, maxFiles: 60_000, maxEntries: 120_000, maxBytes: 1_073_741_824,
    maxFileBytes: 268_435_456, maxDepth: 32, maxMetadataBytes: 1_048_576, maxLockBytes: 8_388_608, maxLockPackages: 4096, maxNodeBytes: 268_435_456 };
  const roots = ["esbuild", "playwright", "playwright-core", "@playwright/test", "next", "react", "react-dom", "zod"];
  assert.equal(process.platform, "win32", "This private process harness supports Windows only");
  const platform = { os: process.platform, cpu: process.arch, libc: null };
  const counts = { packages: 0, edges: 0, files: 0, entries: 0, bytes: 0 }, packages = [], edges = [], visited = new Set();
  const stat = async absolute => { try { return await fs.lstat(absolute); } catch (error) { if (error.code === "ENOENT") return null; throw error; } };
  async function pair(relative) {
    assert.ok(relative.startsWith("node_modules/") || relative === "node_modules");
    assert.ok(relative.split("/").every(part => part && part !== "." && part !== ".."));
    const worker = await stat(path.join(root, relative)), built = await stat(path.join(rootCheckout, relative));
    assert.equal(Boolean(worker), Boolean(built), `Installed runtime existence differs: ${relative}`);
    if (!worker) return null;
    assert.equal(worker.isSymbolicLink(), false, `Worker runtime symlink refused: ${relative}`);
    assert.equal(built.isSymbolicLink(), false, `Root runtime symlink refused: ${relative}`);
    assert.equal(worker.isDirectory(), built.isDirectory()); assert.equal(worker.isFile(), built.isFile());
    return { worker, built };
  }
  async function candidate(relative) {
    const parts = relative.split("/"); assert.ok(parts.length <= limits.maxDepth);
    for (let length = 1; length <= parts.length; length++) {
      const entry = await pair(parts.slice(0, length).join("/")); if (!entry) return false;
      assert.ok(entry.worker.isDirectory(), `Package ancestor is not a directory: ${relative}`);
    }
    // An existing closer package directory without metadata could shadow an
    // ancestor through Node's index.js fallback; never silently skip it.
    const metadata = await pair(`${relative}/package.json`); assert.ok(metadata, `Installed candidate lacks package.json: ${relative}`);
    assert.ok(metadata.worker.isFile()); return true;
  }
  async function bytes(relative, budget) {
    checkpoint(`installed bytes ${relative}`);
    const info = await pair(relative); assert.ok(info && info.worker.isFile());
    assert.ok(info.worker.size <= budget && info.built.size <= budget, `Runtime file size exceeds bound: ${relative}`);
    assert.equal(info.worker.size, info.built.size);
    const worker = await fs.readFile(path.join(root, relative)), built = await fs.readFile(path.join(rootCheckout, relative));
    assert.equal(worker.length, info.worker.size); assert.equal(built.length, info.built.size); assert.equal(saveBonusSha(worker), saveBonusSha(built), `Installed raw bytes differ: ${relative}`);
    return worker;
  }
  const lockPath = path.join(root, "package-lock.json"), rootLockPath = path.join(rootCheckout, "package-lock.json");
  const lockInfo = await fs.lstat(lockPath), rootLockInfo = await fs.lstat(rootLockPath);
  assert.ok(lockInfo.isFile() && rootLockInfo.isFile() && !lockInfo.isSymbolicLink() && !rootLockInfo.isSymbolicLink());
  assert.ok(lockInfo.size <= limits.maxLockBytes && rootLockInfo.size <= limits.maxLockBytes);
  const lockBytes = await fs.readFile(lockPath); assert.equal(saveBonusSha(lockBytes), saveBonusSha(await fs.readFile(rootLockPath)));
  const lock = JSON.parse(lockBytes.toString("utf8")); assert.ok(lock.packages && Object.keys(lock.packages).length <= limits.maxLockPackages);
  const nodeInfo = await fs.lstat(process.execPath); assert.ok(nodeInfo.isFile() && !nodeInfo.isSymbolicLink() && nodeInfo.size <= limits.maxNodeBytes);
  const nodeExecutable = { path: process.execPath, version: process.version, bytes: nodeInfo.size, sha256: saveBonusSha(await fs.readFile(process.execPath)) };
  function constraints(entry) { return { os: entry?.os ?? [], cpu: entry?.cpu ?? [], libc: entry?.libc ?? [] }; }
  function compatible(entry) {
    return Object.entries(constraints(entry)).every(([field, values]) => {
      assert.ok(Array.isArray(values) && values.every(value => typeof value === "string"));
      const actual = platform[field], positive = values.filter(value => !value.startsWith("!"));
      return !values.includes(`!${actual}`) && (!positive.length || positive.includes("any") || positive.includes(actual));
    });
  }
  function packageName(name) { assert.match(name, /^(?:@[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)?[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/); }
  async function resolve(from, name) {
    packageName(name); let directory = path.join(root, from); const attempted = [];
    while (directory === root || directory.startsWith(root + path.sep)) {
      if (path.basename(directory) !== "node_modules") {
        const relative = path.relative(root, path.join(directory, "node_modules", name)).replaceAll(path.sep, "/"); attempted.push(relative);
        assert.ok(attempted.length <= limits.maxDepth);
        if (await candidate(relative)) return { resolved: relative, attempted };
      }
      if (directory === root) break; directory = path.dirname(directory);
    }
    return { resolved: null, attempted };
  }
  async function packageClosure(relative, depth = 0) {
    checkpoint(`installed package ${relative}`);
    if (visited.has(relative)) return; assert.ok(depth <= limits.maxDepth); visited.add(relative);
    counts.packages++; assert.ok(counts.packages <= limits.maxPackages); assert.ok(await candidate(relative), `Required runtime package absent: ${relative}`);
    const locked = lock.packages[relative]; assert.ok(locked && typeof locked.version === "string", `Package not described by lock: ${relative}`);
    const metadataBytes = await bytes(`${relative}/package.json`, limits.maxMetadataBytes), metadata = JSON.parse(metadataBytes.toString("utf8"));
    assert.equal(metadata.version, locked.version); assert.equal(typeof metadata.name, "string"); if (locked.name) assert.equal(metadata.name, locked.name);
    for (const key of ["dependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta"]) assert.deepEqual(metadata[key] ?? {}, locked[key] ?? {}, `Installed declarations differ from lock: ${relative}/${key}`);
    assert.deepEqual(constraints(metadata), constraints(locked)); assert.equal(compatible(locked), true, `Installed package contradicts current platform: ${relative}`);
    const inputs = [], directories = [];
    async function walk(current, level) {
      checkpoint(`installed entry ${current}`);
      assert.ok(level <= limits.maxDepth); const info = await pair(current); assert.ok(info);
      counts.entries++; assert.ok(counts.entries <= limits.maxEntries);
      if (info.worker.isDirectory()) {
        const entries = async checkout => {
          const names = [], directory = await fs.opendir(path.join(checkout, current));
          for await (const entry of directory) { assert.ok(names.length < limits.maxEntries - counts.entries, `Directory entry bound exceeded: ${current}`); names.push(entry.name); }
          return names.sort();
        };
        const workerEntries = await entries(root), rootEntries = await entries(rootCheckout);
        assert.deepEqual(workerEntries, rootEntries, `Installed directory/file set differs: ${current}`); assert.ok(workerEntries.length <= limits.maxEntries - counts.entries);
        directories.push({ relativePath: current, entries: workerEntries });
        for (const entry of workerEntries) await walk(`${current}/${entry}`, level + 1);
      } else {
        assert.ok(info.worker.isFile()); assert.ok(info.worker.size <= limits.maxFileBytes && counts.bytes + info.worker.size <= limits.maxBytes);
        counts.files++; assert.ok(counts.files <= limits.maxFiles); const actual = await bytes(current, limits.maxFileBytes); counts.bytes += actual.length;
        inputs.push({ relativePath: current, bytes: actual.length, sha256: saveBonusSha(actual) });
      }
    }
    await walk(relative, 0);
    packages.push({ name: metadata.name, relativePath: relative, version: metadata.version, platformConstraints: constraints(locked), packageJsonSha256: saveBonusSha(metadataBytes), directories, inputs });
    const declarations = [];
    for (const [name, spec] of Object.entries(metadata.dependencies ?? {})) if (!Object.hasOwn(metadata.optionalDependencies ?? {}, name)) declarations.push({ name, spec, kind: "dependency", optional: false });
    for (const [name, spec] of Object.entries(metadata.optionalDependencies ?? {})) declarations.push({ name, spec, kind: "optionalDependency", optional: true });
    for (const [name, spec] of Object.entries(metadata.peerDependencies ?? {})) declarations.push({ name, spec, kind: "peer", optional: metadata.peerDependenciesMeta?.[name]?.optional === true });
    declarations.sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`));
    for (const declaration of declarations) {
      assert.equal(typeof declaration.spec, "string"); counts.edges++; assert.ok(counts.edges <= limits.maxEdges);
      const resolution = await resolve(relative, declaration.name), omittedCandidates = resolution.attempted.filter(candidate => Object.hasOwn(lock.packages, candidate)).map(candidate => ({ relativePath: candidate, version: lock.packages[candidate].version, platformConstraints: constraints(lock.packages[candidate]), compatible: compatible(lock.packages[candidate]) }));
      if (!resolution.resolved) {
        assert.equal(declaration.optional, true, `Required declared dependency missing: ${relative}/${declaration.name}`);
        edges.push({ from: relative, ...declaration, ...resolution, status: omittedCandidates.length && omittedCandidates.every(entry => !entry.compatible) ? "platform-omitted" : "optional-not-installed", omittedCandidates });
      } else {
        assert.ok(lock.packages[resolution.resolved], `Resolved installed dependency unbound to lock: ${resolution.resolved}`);
        edges.push({ from: relative, ...declaration, ...resolution, status: "installed", omittedCandidates: [] }); await packageClosure(resolution.resolved, depth + 1);
      }
    }
  }
  for (const name of roots) await packageClosure(`node_modules/${name}`);
  packages.sort((a, b) => a.relativePath.localeCompare(b.relativePath)); edges.sort((a, b) => `${a.from}:${a.kind}:${a.name}`.localeCompare(`${b.from}:${b.kind}:${b.name}`));
  const closure = { nodeExecutable, roots, platform, limits, counts, packages, edges };
  return { ...closure, closureSha256: saveBonusSha(JSON.stringify(closure)) };
}
export async function loadSaveBonusAssets(root,manifestPath,checkpoint){
 checkpoint('before build/assets proof');
 const proof=await verifySaveBonusInputs(root,manifestPath,checkpoint); // BEFORE inherited executable import.
 const helper=await import('./passive-feature-production-assets.mjs');
 const loaded=await helper.loadPassiveFeatureProductionAssets(root,manifestPath);
 checkpoint('after inherited complete build/assets proof');
 assert.equal(loaded.artifacts.currentRootHead,proof.rootHead);
 const fontClassProof=[];
 for(const className of loaded.htmlClassName.split(' ').slice(3)){
  const regex=new RegExp(`\\.${className.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=[\\s{.:#>+~\\[])`);
  const css=loaded.cssUrls.filter(url=>regex.test(loaded.assets.get(url).bytes.toString('utf8')));assert.ok(css.length);
  fontClassProof.push({className,css:css.map(url=>({url,sha256:loaded.assets.get(url).sha256}))});
 }
 assert.equal(fontClassProof.length,2);
 const seed=await fs.readFile(path.join(root,'supabase/seed.sql')),text=seed.toString('utf8');
 const json=text.slice(text.indexOf("'dnd-5e-2014'")).match(/'(\{[\s\S]*?\})'::jsonb/)?.[1];assert.ok(json);
 const auxiliaryInputs=[];
 for(const input of [...(loaded.artifacts.budgetReview?.measuredReceipts??[]),...(loaded.artifacts.qaRuntime?[loaded.artifacts.qaRuntime.python,loaded.artifacts.qaRuntime.renderer]:[])]){
  assert.ok(input&&path.isAbsolute(input.path));assert.match(input.sha256,/^[a-f0-9]{64}$/);const info=await fs.lstat(input.path);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=268435456);const bytes=await fs.readFile(input.path);assert.equal(saveBonusSha(bytes),input.sha256);auxiliaryInputs.push({path:input.path,sha256:input.sha256,bytes:bytes.length});
 }
 Object.assign(loaded.artifacts,{sourceCheckpoint,initialSourceProof:proof,fontClassProof,auxiliaryInputs,seedSchemaInput:{relativePath:'supabase/seed.sql',sha256:saveBonusSha(seed)}});
 return{...loaded,seedSchema:JSON.parse(json.replace(/''/g,"'"))};
}
export function saveBonusInputPlugin(root,captured,assets,cssMaps,checkpoint){return{name:'save-bonus-all-mounted-inputs',setup(builder){
 builder.onLoad({filter:/\.(tsx?|jsx?|mjs|cjs|json|css)$/,namespace:'file'},async args=>{
  checkpoint(`before compiled file ${args.path}`);
  const absolute=await fs.realpath(args.path),relativePath=path.relative(root,absolute).replaceAll(path.sep,'/');assert.ok(relativePath&&!relativePath.startsWith('../'));
  const bytes=await fs.readFile(absolute);captured.set(absolute,{relativePath,bytes:bytes.length,sha256:saveBonusSha(bytes)});
  if(relativePath.endsWith('.module.css')){
   assert.equal(relativePath,'components/sheet/character-print.module.css');
   const keys=[...new Set([...bytes.toString('utf8').matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)\s*\{/g)].map(match=>match[1]))],mapping={};
   assert.deepEqual(keys.sort(),['brand','description','details','document','preview','source','toolbar']);
   const css=[...assets.values()].filter(item=>item.relativePath.endsWith('.css')).map(item=>item.bytes.toString('utf8')).join('\n');
   for(const key of keys){const matches=[...new Set([...css.matchAll(new RegExp(`character-print-module__[a-zA-Z0-9_-]+__${key}(?![a-zA-Z0-9_-])`,'g'))].map(match=>match[0]))];assert.equal(matches.length,1);mapping[key]=matches[0]}
   cssMaps.push({relativePath,sha256:saveBonusSha(bytes),mapping});return{contents:`export default ${JSON.stringify(mapping)}`,loader:'js',resolveDir:path.dirname(absolute)};
  }
  assert.ok(!relativePath.endsWith('.css'),'No fixture/fallback stylesheet');
  const ext=path.extname(absolute).slice(1);return{contents:bytes.toString('utf8'),loader:ext==='mjs'||ext==='cjs'?'js':ext,resolveDir:path.dirname(absolute)};
 });
}}}
export function saveBonusOfflinePlugin(root,captured,originalPrint=false){
 const journal=`const h=()=>window.saveBonus;const deny=(name,args)=>{h().journal.unexpected.push({name,args});throw Error('Unexpected modeled boundary: '+name)};`;
 const stubs={
  'next/link':`import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href,onClick:event=>{event.preventDefault();window.saveBonus.journal.navigation.push({href})}},children)}`,
  'next/navigation':`export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser.js';export const useRouter=()=>({push:href=>window.saveBonus.journal.navigation.push({href}),refresh:()=>window.saveBonus.journal.navigation.push({kind:'refresh'})});`,
  '@/lib/sheet/update-state':`export async function updateCharacterState(characterId,patch,expected){window.saveBonus.journal.writes.push({characterId,patch:structuredClone(patch),expected:structuredClone(expected)});return{...expected,...patch}}`,
  '@/lib/supabase/rolls':`export async function insertRoll(characterId,result){window.saveBonus.journal.logs.push({characterId,result:structuredClone(result)});return{id:crypto.randomUUID(),character_id:characterId}}`,
  '@/lib/supabase/client':`${journal}export function createClient(){return{auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:(...a)=>deny('from',a),rpc:(...a)=>deny('rpc',a)}}`,
  '@/lib/supabase/inventory':`${journal}export const addInventoryItem=(...a)=>deny('addInventoryItem',a);export const updateInventoryItem=(...a)=>deny('updateInventoryItem',a);export const removeInventoryItem=(...a)=>deny('removeInventoryItem',a);export const unequipAllArmor=(...a)=>deny('unequipAllArmor',a);export const searchItems=(...a)=>deny('searchItems',a);`,
  '@/lib/supabase/spells':`${journal}export const addCharacterSpell=(...a)=>deny('addCharacterSpell',a);export const updateCharacterSpell=(...a)=>deny('updateCharacterSpell',a);export const removeCharacterSpell=(...a)=>deny('removeCharacterSpell',a);export const searchSpells=(...a)=>deny('searchSpells',a);`,
  '@/lib/dice/roller':`import{executeRoll as original}from ${JSON.stringify(path.join(root,'lib/dice/roller.ts'))};export function executeRoll(request,...args){window.saveBonus.journal.rng.push(structuredClone(request));const result=original(request,...args);window.saveBonus.journal.results.push(structuredClone(result));return result}`,
 };
 return{name:'save-bonus-explicit-offline-boundaries',setup(builder){
  builder.onResolve({filter:/^(next\/|@\/lib\/supabase\/|@\/lib\/sheet\/update-state|@\/lib\/dice\/roller|@\/lib\/character\/character-context|server-only)/},args=>{
   if(args.path==='next/dist/client/components/unstable-rethrow.browser.js'||args.path==='@/lib/supabase/content-definitions-parser'||(args.path==='@/lib/character/character-context'&&!originalPrint))return;
   if(args.path==='@/lib/character/character-context'&&originalPrint)return{path:path.join(root,'e2e/print/context-shim.ts')};
   assert.ok(Object.hasOwn(stubs,args.path),`Unapproved live edge ${args.path}`);return{path:args.path,namespace:'save-bonus-offline'};
  });
  builder.onLoad({filter:/.*/,namespace:'save-bonus-offline'},args=>{const contents=stubs[args.path];captured.set(`save-bonus-offline:${args.path}`,{input:args.path,sha256:saveBonusSha(contents),bytes:Buffer.byteLength(contents)});return{contents,loader:'js',resolveDir:root}});
 }};
}
export const capturedEntries=captured=>[...captured.entries()].sort(([a],[b])=>a.localeCompare(b));
export async function bindSaveBonusInputs(root,metafile,captured,artifacts,checkpoint){
 checkpoint('before transitive bundle proof');assert.ok(Buffer.byteLength(JSON.stringify(metafile))<=bundleLimits.maxMetafileBytes&&Object.keys(metafile.inputs).length<=bundleLimits.maxInputs);
 assert.deepEqual(await verifySaveBonusInputs(root,artifacts.manifestPath,checkpoint),artifacts.initialSourceProof);
 const rootCheckout=path.resolve(root,'../equipment-verification'),project=[],runtime=[],synthetic=[];
 for(const input of Object.keys(metafile.inputs)){
  checkpoint(`transitive input ${input}`);
  if(input.startsWith('save-bonus-offline:')){const entry=captured.get(input);assert.ok(entry);synthetic.push({input,...entry,boundary:'Explicit Auth/DAL/navigation model; native RNG wrapper journals original result'});continue}
  const absolute=await fs.realpath(path.resolve(root,input)),relative=path.relative(root,absolute).replaceAll(path.sep,'/'),entry=captured.get(absolute);assert.ok(entry);
  assert.equal(saveBonusSha(await fs.readFile(absolute)),entry.sha256);assert.equal(saveBonusSha(await fs.readFile(path.join(rootCheckout,relative))),entry.sha256);
  if(relative.startsWith('node_modules/')){runtime.push(entry);continue}
  const expected=ownPaths.includes(relative)?git(root,['rev-parse',`${artifacts.harnessSourceCommit}:${relative}`]).toString().trim():producerBlobs[relative]??git(root,['rev-parse',`${sourceCheckpoint}:${relative}`]).toString().trim();
  const worker=await boundFile(root,relative,expected),built=await boundFile(rootCheckout,relative,expected);assert.equal(worker.executedSha256,built.executedSha256);project.push({...entry,expectedBlob:expected});
 }
 for(const required of Object.keys(producerBlobs).filter(item=>item!=='e2e/print/fixtures.ts'))assert.ok(project.some(entry=>entry.relativePath===required));
 for(const required of ['lib/engine/evaluator.ts','lib/character/structured-sources.ts','lib/character/asi-contributions.ts','lib/character/state-writer.ts','lib/supabase/content-definitions-parser.ts','lib/schemas/system.ts','lib/schemas/effects.ts','lib/active-effects/helpers.ts','lib/dice/roller.ts','components/character/sheet-panel.tsx','components/sheet/character-print.module.css','e2e/print/fixtures.ts','e2e/print/context-shim.ts','e2e/print/harness.tsx'])assert.ok(project.some(entry=>entry.relativePath===required),`Missing actual input ${required}`);
 assert.ok(runtime.some(entry=>entry.relativePath.endsWith('/unstable-rethrow.browser.js')));
 return{bundledProjectInputs:project,bundledRuntimeInputs:runtime,syntheticInputs:synthetic,metafileSha256:saveBonusSha(JSON.stringify(metafile)),capturedInputsSha256:saveBonusSha(JSON.stringify(capturedEntries(captured)))};
}
export async function freshSaveBonusProof(root,manifestPath,metafile,captured,rendered,checkpoint){
 const loaded=await loadSaveBonusAssets(root,manifestPath,checkpoint);
 Object.assign(loaded.artifacts,await bindSaveBonusInputs(root,metafile,captured,loaded.artifacts,checkpoint),{bundles:rendered.bundles,bundleLimits,cssModuleMaps:rendered.cssModuleMaps,runBinding:rendered.runBinding});
 assert.deepEqual(rendered.bundleLimits,bundleLimits);assert.equal(rendered.bundles.length,bundleLimits.maxFiles);assert.equal(new Set(rendered.bundles.map(item=>item.path)).size,bundleLimits.maxFiles);let totalBytes=0;
 for(const bundle of loaded.artifacts.bundles){checkpoint(`fresh output ${bundle.path}`);assert.ok(['test-results/save-bonus-local/fixture.js','test-results/save-bonus-local/original-print.js'].includes(bundle.path));const info=await fs.lstat(path.join(root,bundle.path));assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size===bundle.bytes&&info.size<=bundleLimits.maxFileBytes);const bytes=await fs.readFile(path.join(root,bundle.path));assert.equal(bytes.length,bundle.bytes);assert.equal(saveBonusSha(bytes),bundle.sha256);totalBytes+=bytes.length}assert.ok(totalBytes<=bundleLimits.maxTotalBytes);
 assert.match(rendered.runBinding.runId,/^[a-f0-9-]{36}$/);assert.equal(rendered.runBinding.rootSource,loaded.artifacts.sourceCommit);assert.equal(rendered.runBinding.harnessSourceCommit,loaded.artifacts.harnessSourceCommit);assert.equal(rendered.runBinding.buildIdSha256,loaded.artifacts.buildIdSha256);assert.equal(rendered.runBinding.sourceProofSha256,saveBonusSha(JSON.stringify(loaded.artifacts.initialSourceProof)));
 // CSS maps are deterministic from captured source and freshly bound production CSS.
 for(const map of rendered.cssModuleMaps){const bytes=await fs.readFile(path.join(root,map.relativePath));assert.equal(saveBonusSha(bytes),map.sha256);const css=[...loaded.assets.values()].filter(entry=>entry.relativePath.endsWith('.css')).map(entry=>entry.bytes.toString('utf8')).join('\n');for(const[key,value]of Object.entries(map.mapping)){const matches=[...new Set([...css.matchAll(new RegExp(`character-print-module__[a-zA-Z0-9_-]+__${key}(?![a-zA-Z0-9_-])`,'g'))].map(match=>match[0]))];assert.deepEqual(matches,[value])}}
 assert.deepEqual(loaded.artifacts,rendered,'Fresh WHOLE envelope must match initial rendered proof');return loaded.artifacts;
}
export const qaInventoryLimits={maxFiles:256,maxDirectories:32,maxDepth:4,maxFileBytes:134_217_728,maxTotalBytes:536_870_912,maxReportBytes:8_388_608,maxPagesPerPdf:64,maxPages:128};
/** Exact, bounded output set from BOTH QA roots; run tag is an annotation, not authority. */
export async function readQaInventory(root,rendered,pdfs,checkpoint){
 checkpoint('before fresh BOTH-QA inventory');assert.equal(pdfs.length,8);
 const base=path.join(root,'test-results/save-bonus-local'),expected=new Set(),expectedDirectories=new Set(['original-print','bonus-print']),counts={files:0,directories:0,bytes:0,pages:0},files=[],directories=[];
 const baseInfo=await fs.lstat(base);assert.ok(baseInfo.isDirectory()&&!baseInfo.isSymbolicLink());for(const directory of expectedDirectories){const info=await fs.lstat(path.join(base,directory));assert.ok(info.isDirectory()&&!info.isSymbolicLink())}
 async function json(relative){const file=path.join(base,relative),info=await fs.lstat(file);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=qaInventoryLimits.maxReportBytes);const bytes=await fs.readFile(file);return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''))}
 const provider=await json('bonus-pdf-provider-proof.json');assert.deepEqual(provider.before,provider.after);assert.equal(provider.before.snapshot.mechanics.status,'available');assert.equal(provider.before.snapshot.stats.constitution,14);assert.equal(provider.before.snapshot.computed.proficiency_bonus,2);assert.deepEqual(provider.before.snapshot.bonus,{status:'available',bonus:1});assert.deepEqual(provider.before.snapshot.refPins.map(item=>item.version),[2,3]);
 const originalNames=['martial','caster','long'].flatMap(kind=>['Letter','A4'].map(format=>`${kind}-${format}`));
 const reportProof=[],reportedHashes=new Map();
 for(const[directory,names]of[['original-print',originalNames],['bonus-print',['bonus-Letter','bonus-A4']]]){
  expected.add(`${directory}/pdf-verification.json`);expected.add(`${directory}/render-processes.json`);
  const reports=await json(`${directory}/pdf-verification.json`);assert.equal(reports.length,names.length);
  const reportNames=[];
  for(const report of reports){
   checkpoint(`QA report ${report.file}`);assert.ok(Number.isSafeInteger(report.pages)&&report.pages>0&&report.pages<=qaInventoryLimits.maxPagesPerPdf);counts.pages+=report.pages;assert.ok(counts.pages<=qaInventoryLimits.maxPages);
   const stem=path.basename(report.file,'.pdf');assert.ok(names.includes(stem));assert.ok(!reportNames.includes(stem));reportNames.push(stem);
   const prefix=directory==='original-print'?`${directory}/${stem}`:directory;
   if(directory==='original-print')expectedDirectories.add(prefix);
   const pdfRelative=`${prefix}/${stem}.pdf`,absolute=path.join(base,pdfRelative);
   if(directory==='original-print'){assert.equal(path.resolve(report.file),absolute);assert.equal(report.privacy_sentinels_absent,true);assert.equal(report.printable_margins,true);assert.equal(report.all_expected_markers_present,true)}else{assert.equal(report.file,`${stem}.pdf`);assert.equal(report.privacy,true);assert.equal(report.geometry,true);assert.deepEqual(report.expectedRows,{Strength:[10,'+0','+1'],Dexterity:[12,'+1','+2'],Constitution:[14,'+2','+5'],Intelligence:[10,'+0','+1'],Wisdom:[12,'+1','+2'],Charisma:[8,'-1','+0']})}
   expected.add(pdfRelative);expected.add(directory==='original-print'?`${prefix}/all-pages.png`:`${directory}/${stem}-all-pages.png`);
   const pageFolder=directory==='original-print'?`${prefix}/pages`:`${directory}/${stem}-pages`,pageNames=[];
   expectedDirectories.add(pageFolder);
   const folderInfo=await fs.lstat(path.join(base,pageFolder));assert.ok(folderInfo.isDirectory()&&!folderInfo.isSymbolicLink());const handle=await fs.opendir(path.join(base,pageFolder));for await(const entry of handle){checkpoint('QA page inventory');assert.ok(entry.isFile()&&!entry.isSymbolicLink());assert.ok(pageNames.length<qaInventoryLimits.maxPagesPerPdf);pageNames.push(entry.name)}
   assert.equal(pageNames.length,report.pages);const indexes=[];for(const file of pageNames){const match=file.match(directory==='original-print'?new RegExp(`^${stem}-(\\d+)\\.png$`):/^page-(\d+)\.png$/);assert.ok(match);indexes.push(Number(match[1]));expected.add(`${pageFolder}/${file}`)}assert.deepEqual(indexes.sort((a,b)=>a-b),Array.from({length:report.pages},(_,index)=>index+1));
   const exported=pdfs.find(item=>path.resolve(root,item.path)===absolute);assert.ok(exported);const pdfInfo=await fs.lstat(absolute);assert.ok(pdfInfo.isFile()&&!pdfInfo.isSymbolicLink()&&pdfInfo.size===exported.bytes&&pdfInfo.size<=qaInventoryLimits.maxFileBytes);const bytes=await fs.readFile(absolute);assert.equal(bytes.length,exported.bytes);assert.equal(saveBonusSha(bytes),exported.sha256);if(directory==='bonus-print'){assert.equal(report.pdfSHA256,exported.sha256);assert.equal(report.images.length,report.pages);const imagePaths=new Set();for(const image of report.images){const relative=path.relative(base,path.resolve(image.path)).replaceAll(path.sep,'/');assert.ok(expected.has(relative)&&relative.startsWith(`${pageFolder}/`));assert.ok(!imagePaths.has(relative));imagePaths.add(relative);assert.match(image.sha256,/^[a-f0-9]{64}$/);reportedHashes.set(relative,image.sha256)}assert.match(report.contactSheetSHA256,/^[a-f0-9]{64}$/);reportedHashes.set(`${directory}/${stem}-all-pages.png`,report.contactSheetSHA256)}
   reportProof.push({directory,stem,pages:report.pages,pdfSHA256:exported.sha256});
  }
  assert.deepEqual(reportNames.sort(),[...names].sort());
 }
 async function walk(relative,depth){checkpoint(`QA inventory ${relative}`);assert.ok(depth<=qaInventoryLimits.maxDepth);const info=await fs.lstat(path.join(base,relative));assert.equal(info.isSymbolicLink(),false);
  if(info.isDirectory()){assert.ok(expectedDirectories.has(relative),`Unexpected QA directory ${relative}`);directories.push(relative);counts.directories++;assert.ok(counts.directories<=qaInventoryLimits.maxDirectories);const names=[],handle=await fs.opendir(path.join(base,relative));for await(const entry of handle){assert.ok(names.length<qaInventoryLimits.maxFiles+qaInventoryLimits.maxDirectories);names.push(entry.name)}for(const name of names.sort())await walk(`${relative}/${name}`,depth+1)}
  else{assert.ok(info.isFile()&&expected.has(relative),`Unexpected QA file ${relative}`);assert.ok(info.size<=qaInventoryLimits.maxFileBytes&&counts.bytes+info.size<=qaInventoryLimits.maxTotalBytes);counts.files++;assert.ok(counts.files<=qaInventoryLimits.maxFiles);const bytes=await fs.readFile(path.join(base,relative));assert.equal(bytes.length,info.size);counts.bytes+=bytes.length;const sha256=saveBonusSha(bytes);if(reportedHashes.has(relative))assert.equal(sha256,reportedHashes.get(relative));files.push({relativePath:relative,bytes:bytes.length,sha256})}
 }
 await walk('original-print',0);await walk('bonus-print',0);assert.deepEqual(files.map(item=>item.relativePath).sort(),[...expected].sort());assert.deepEqual(directories.sort(),[...expectedDirectories].sort());
 const providerBytes=await fs.readFile(path.join(base,'bonus-pdf-provider-proof.json'));
 const inventory={runBinding:rendered.runBinding,initialRenderedProofSha256:saveBonusSha(JSON.stringify({artifacts:rendered})),sourceCommit:rendered.sourceCommit,buildIdSha256:rendered.buildIdSha256,harnessSourceCommit:rendered.harnessSourceCommit,providerSnapshotSha256:saveBonusSha(providerBytes),limits:qaInventoryLimits,counts,reportProof,directories,files};
 return{...inventory,inventorySha256:saveBonusSha(JSON.stringify(inventory))};
}
