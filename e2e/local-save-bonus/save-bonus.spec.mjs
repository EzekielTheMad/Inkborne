import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
const root=process.cwd(),directory='test-results/save-bonus-local',manifestPath=path.resolve(directory,'production-artifacts.json'),started=Date.now();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Same builtin bootstrap as runner: no executable binder/helper/framework import
// until its exact reviewed source, stage0 and actual checkout bytes are proven.
const manifest=JSON.parse((await readFile(manifestPath,'utf8')).replace(/^\uFEFF/,''));assert.match(manifest.harnessSourceCommit,/^[a-f0-9]{40}$/);
for(const checkout of[root,path.resolve(root,'../equipment-verification')]){
 const relative='scripts/save-bonus-inputs.mjs',git=args=>execFileSync('git',['-C',checkout,...args],{windowsHide:true});
 for(const args of[['diff','--cached','HEAD','--',relative],['diff','--',relative],['ls-files','--unmerged','--',relative]])assert.equal(git(args).toString().trim(),'');
 const oid=git(['rev-parse',`${manifest.harnessSourceCommit}:${relative}`]).toString().trim();assert.equal(git(['rev-parse',`HEAD:${relative}`]).toString().trim(),oid);assert.equal(git(['rev-parse',`:${relative}`]).toString().trim(),oid);
 const attrs=git(['check-attr','filter','working-tree-encoding','--',relative]).toString();assert.ok(attrs.includes('filter: unspecified')&&attrs.includes('working-tree-encoding: unspecified'));const info=await lstat(path.join(checkout,relative)),parent=await lstat(path.join(checkout,'scripts'));assert.ok(info.isFile()&&!info.isSymbolicLink()&&parent.isDirectory()&&!parent.isSymbolicLink());assert.equal(sha(await readFile(path.join(checkout,relative))),sha(git(['cat-file','--filters',`--path=${relative}`,oid])));
}
const{verifySaveBonusInputs,freshSaveBonusProof,saveBonusSha,producerBlobs}=await import('../../scripts/save-bonus-inputs.mjs');
const entryProof=await verifySaveBonusInputs(root,manifestPath),entryElapsedMs=Date.now()-started;
const{test,expect}=await import('@playwright/test');
test('actual save/CON consumers and fresh six original plus two bonus PDFs',async()=>{
 const budget=manifest.budgetReview;assert.equal(budget?.kind,'save-bonus-phase-allocation');assert.equal(budget.outerBudgetMs,900000);assert.equal(budget.harnessSourceCommit,manifest.harnessSourceCommit);assert.ok(entryElapsedMs<=budget.allowancesMs.wrapperEntry);
 const remaining=900000-(Date.now()-started);assert.ok(remaining>0);test.setTimeout(remaining);
 // verifySaveBonusInputs has already bound inherited helpers before dynamic import.
 const{npcOsIdentity}=await import('../../scripts/npc-process.mjs');
 const workerIdentity={...npcOsIdentity(process.pid,process.ppid),cwd:root,listeningPort:null};
 const script=path.resolve('scripts/verify-save-bonus-local.mjs'),child=spawn(process.execPath,[script],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe','ipc']});
 let output='',identity,rendered,reported,forced=false,finalArtifacts;
 child.stdout.on('data',chunk=>output+=String(chunk));child.stderr.on('data',chunk=>output+=String(chunk));
 const completion=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
 child.on('message',message=>{if(message.type==='rendered-proof'){assert.equal(rendered,undefined);rendered=message.initialBindings}if(message.type==='resources'){if(reported?.browserProcess)assert.deepEqual(reported.browserProcess,message.browserProcess);reported={taskProcess:message.taskProcess,browserProcess:message.browserProcess}}});
 async function rebind(){
  assert.ok(rendered,'Whole initial IPC rendered proof required');const disk=JSON.parse(await readFile(`${directory}/initial-rendered-proof.json`,'utf8'));assert.deepEqual(disk,rendered);
  const metafile=JSON.parse(await readFile(`${directory}/bundle-metafile.json`,'utf8')),entries=JSON.parse(await readFile(`${directory}/captured-inputs.json`,'utf8'));assert.equal(saveBonusSha(JSON.stringify(entries)),rendered.artifacts.capturedInputsSha256);assert.equal(saveBonusSha(JSON.stringify(metafile)),rendered.artifacts.metafileSha256);
  const fresh=await freshSaveBonusProof(root,manifestPath,metafile,new Map(entries),rendered.artifacts);assert.deepEqual(fresh,rendered.artifacts);return fresh;
 }
 try{
  try{identity=npcOsIdentity(child.pid,process.pid);assert.ok(identity.command.includes(script))}catch(error){assert.notEqual(child.exitCode,null,'Refuse unidentified live runner');throw error}
  const code=await completion;await writeFile(`${directory}/runner-output.log`,output);console.log(output);expect(code,output).toBe(0);
  const result=JSON.parse(await readFile(`${directory}/evidence.json`,'utf8'));expect(result.initialBindings).toEqual(rendered);expect(result.initialBindings.artifacts).toEqual(result.artifacts);expect(result.finalBindings.matchedRenderedProof).toBe(true);expect(result.finalBindings.artifacts).toEqual(result.artifacts);
  expect(result.artifacts.sourceCheckpoint).toBe('548e62b50889aa653b7be7e6c9dd24f118f5dbf0');expect(result.artifacts.harnessSourceCommit).toBe(manifest.harnessSourceCommit);expect(result.artifacts.sourceCommit).toBe(result.artifacts.currentRootHead);
  for(const[relative,oid]of Object.entries(producerBlobs))expect(result.artifacts.initialSourceProof.files.find(item=>item.relativePath===relative).expected).toBe(oid);
  expect(result.artifacts.initialSourceProof.files.filter(item=>item.relativePath.startsWith('e2e/local-save-bonus/')||item.relativePath.startsWith('scripts/save-bonus-')||item.relativePath==='scripts/verify-save-bonus-local.mjs')).toHaveLength(7);
  const runtime=result.artifacts.initialSourceProof.installedRuntime,installed=runtime.packages.map(item=>item.relativePath);for(const name of runtime.roots)expect(installed).toContain(`node_modules/${name}`);
  expect(runtime.roots).toEqual(['esbuild','playwright','playwright-core','@playwright/test','next','react','react-dom','zod']);expect(new Set(installed).size).toBe(runtime.packages.length);expect(runtime.counts.packages).toBe(runtime.packages.length);expect(runtime.counts.edges).toBe(runtime.edges.length);
  expect(runtime.counts.files).toBe(runtime.packages.reduce((sum,item)=>sum+item.inputs.length,0));expect(runtime.counts.entries).toBe(runtime.packages.reduce((sum,item)=>sum+item.inputs.length+item.directories.length,0));expect(runtime.counts.bytes).toBe(runtime.packages.reduce((sum,item)=>sum+item.inputs.reduce((bytes,file)=>bytes+file.bytes,0),0));
  for(const[count,limit]of[['packages','maxPackages'],['edges','maxEdges'],['files','maxFiles'],['entries','maxEntries'],['bytes','maxBytes']])expect(runtime.counts[count]).toBeLessThanOrEqual(runtime.limits[limit]);
  expect(runtime.edges.every(edge=>installed.includes(edge.from)&&(edge.status==='installed'?installed.includes(edge.resolved):edge.optional&&edge.resolved===null&&['platform-omitted','optional-not-installed'].includes(edge.status)))).toBe(true);
  const{closureSha256,...rest}=runtime;expect(closureSha256).toBe(saveBonusSha(JSON.stringify(rest)));expect(runtime.packages.find(item=>item.relativePath==='node_modules/next').inputs.some(item=>item.relativePath.endsWith('/unstable-rethrow.browser.js'))).toBe(true);expect(runtime.nodeExecutable.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.evidence).toHaveLength(30);expect(result.evidence.every(item=>item.passed&&item.checks.length&&item.journal.unexpected.length===0)).toBe(true);
  expect(result.screenshots).toHaveLength(43);expect(new Set(result.screenshots).size).toBe(43);expect(result.fonts).toHaveLength(43);expect(result.fonts.every(sample=>sample.fonts.length===3&&sample.fonts.every(font=>font.family&&font.statuses.every(status=>status==='loaded')))).toBe(true);expect(result.artifacts.cssModuleMaps).toHaveLength(1);
  expect(result.pdfs).toHaveLength(8);for(const pdf of result.pdfs)expect(saveBonusSha(await readFile(path.resolve(root,pdf.path)))).toBe(pdf.sha256);
  for(const[input,count]of[['original-print',6],['bonus-print',2]]){const reports=JSON.parse(await readFile(`${directory}/${input}/pdf-verification.json`,'utf8'));expect(reports).toHaveLength(count);expect(reports.every(item=>item.pages>0)).toBe(true)}
  expect(result.qaProcesses).toHaveLength(2);for(const command of result.qaProcesses){expect(command.exitCode).toBe(0);expect(command.remaining).toEqual([]);expect(command.identity.birthUtc).toMatch(/Z$/);expect(command.children.every(item=>item.command&&item.birthUtc)).toBe(true)}
  expect(result.pageErrors).toEqual([]);expect(result.blockedRequests).toEqual([]);expect(result.unexpectedRequests).toEqual([]);expect(result.assetRequests.some(item=>/\.woff2?$/.test(item.path))).toBe(true);expect(result.failure).toBeNull();expect(result.portClosed).toBe(true);expect(result.browserPortClosed).toBe(true);expect(result.browserExited).toBe(true);
  for(const name of ['runnerEntry','cases','exports','originalQA','bonusQA','runnerFinal','forceAndCleanup']){const elapsed=result.phases.filter(item=>item.name===name).reduce((sum,item)=>sum+item.elapsedMs,0);expect(elapsed).toBeLessThanOrEqual(budget.allowancesMs[name])}
 }finally{
  if(child.exitCode===null){if(child.connected)child.send({type:'stop'},()=>{});const ended=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),10000);child.once('exit',()=>{clearTimeout(timer);resolve(true)});if(child.exitCode!==null){clearTimeout(timer);resolve(true)}});
   if(!ended&&child.exitCode===null){assert.ok(identity,'Refuse force without original actual birth/PID/parent/command');await rebind();if(child.exitCode===null){const fresh=npcOsIdentity(identity.pid,identity.parentPid);assert.equal(fresh.birthUtc,identity.birthUtc);assert.equal(fresh.command,identity.command);assert.ok(fresh.command.includes(script));execFileSync('taskkill',['/pid',String(identity.pid),'/T','/F'],{windowsHide:true});forced=true}}
  }
  // A failed case still requires the same complete wrapper-final proof if any
  // rendered state exists; helpers-only cleanup cannot certify rendered bytes.
  const finalStarted=Date.now();if(rendered){finalArtifacts=await rebind();assert.deepEqual(finalArtifacts.initialSourceProof,entryProof)}else{assert.deepEqual(await verifySaveBonusInputs(root,manifestPath),entryProof)}
  const wrapperFinalMs=Date.now()-finalStarted;assert.ok(wrapperFinalMs<=budget.allowancesMs.wrapperFinal);await writeFile(`${directory}/wrapper-phase-times.json`,JSON.stringify({observed:true,wrapperEntryMs:entryElapsedMs,wrapperFinalMs,totalElapsedMs:Date.now()-started},null,2));
  const closed=port=>!port?Promise.resolve(true):new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.setTimeout(2000,()=>{socket.destroy();resolve(false)});socket.once('connect',()=>{socket.destroy();resolve(false)});socket.once('error',error=>resolve(error.code==='ECONNREFUSED'))});
  const portClosed=await closed(reported?.taskProcess?.listeningPort),browserPortClosed=await closed(reported?.browserProcess?.listeningPort),remaining=[];
  for(const previous of[reported?.taskProcess,reported?.browserProcess].filter(Boolean)){const text=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${previous.pid}';if($p){@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}else{'null'}`],{encoding:'utf8',windowsHide:true});const current=JSON.parse(text);if(current?.birthUtc===previous.birthUtc&&current.parentPid===previous.parentPid)remaining.push(current)}
  await writeFile(`${directory}/wrapper-cleanup.json`,JSON.stringify({workerIdentity,identity,reported,forced,portClosed,browserPortClosed,remaining,finalBindings:finalArtifacts?{matchedRenderedProof:true,artifacts:finalArtifacts}:null},null,2));expect(portClosed).toBe(true);expect(browserPortClosed).toBe(true);expect(remaining).toEqual([]);assert.ok(Date.now()-started<=900000,'Measured whole allocation exceeded provisional outer budget: HOLD');
 }
});
