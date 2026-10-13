import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
const root=process.cwd(),directory='test-results/save-bonus-local',manifestPath=path.resolve(directory,'production-artifacts.json'),started=Date.now();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const wholeDeadline=started+900000;
let stopped=false,activeChild,stopWake,activeDeadline=wholeDeadline,cleanupDeadline=wholeDeadline;
const stop=()=>{stopped=true;if(activeChild?.connected)activeChild.send({type:'stop'},()=>{});stopWake?.()};
process.on('message',message=>{if(message?.type==='stop')stop()});process.on('disconnect',stop);process.on('SIGINT',stop);process.on('SIGTERM',stop);
const checkpoint=label=>{if(stopped)throw Error(`Owned wrapper stop requested: ${label}`);if(Date.now()>=activeDeadline||Date.now()>=wholeDeadline)throw Error(`Wrapper phase/whole deadline reached: ${label}`)};
const cleanupCheckpoint=label=>{if(Date.now()>=cleanupDeadline||Date.now()>=wholeDeadline)throw Error(`Reserved wrapper cleanup deadline exhausted: ${label}; refuse unproven force`)};
checkpoint('builtin wrapper before manifest');
// Same builtin bootstrap as runner: no executable binder/helper/framework import
// until its exact reviewed source, stage0 and actual checkout bytes are proven.
const manifest=JSON.parse((await readFile(manifestPath,'utf8')).replace(/^\uFEFF/,''));assert.match(manifest.harnessSourceCommit,/^[a-f0-9]{40}$/);
const budget=manifest.budgetReview;assert.equal(budget?.kind,'save-bonus-phase-allocation');assert.equal(budget.outerBudgetMs,900000);assert.equal(budget.harnessSourceCommit,manifest.harnessSourceCommit);
const requiredPhases=['wrapperEntry','runnerEntry','cases','exports','originalQA','bonusQA','runnerFinal','wrapperFinal','forceAndCleanup'];
assert.deepEqual(Object.keys(budget.allowancesMs).sort(),[...requiredPhases].sort());assert.ok(Object.values(budget.allowancesMs).every(value=>Number.isSafeInteger(value)&&value>0));assert.ok(Object.values(budget.allowancesMs).reduce((sum,value)=>sum+value,0)<=900000);
activeDeadline=Math.min(wholeDeadline,started+budget.allowancesMs.wrapperEntry);
for(const checkout of[root,path.resolve(root,'../equipment-verification')]){
 checkpoint('wrapper builtin binder checkout');
 const relative='scripts/save-bonus-inputs.mjs',git=args=>execFileSync('git',['-C',checkout,...args],{windowsHide:true});
 for(const args of[['diff','--cached','HEAD','--',relative],['diff','--',relative],['ls-files','--unmerged','--',relative]])assert.equal(git(args).toString().trim(),'');
 const oid=git(['rev-parse',`${manifest.harnessSourceCommit}:${relative}`]).toString().trim();assert.equal(git(['rev-parse',`HEAD:${relative}`]).toString().trim(),oid);assert.equal(git(['rev-parse',`:${relative}`]).toString().trim(),oid);
 const attrs=git(['check-attr','filter','working-tree-encoding','--',relative]).toString();assert.ok(attrs.includes('filter: unspecified')&&attrs.includes('working-tree-encoding: unspecified'));const info=await lstat(path.join(checkout,relative)),parent=await lstat(path.join(checkout,'scripts'));assert.ok(info.isFile()&&!info.isSymbolicLink()&&parent.isDirectory()&&!parent.isSymbolicLink());assert.equal(sha(await readFile(path.join(checkout,relative))),sha(git(['cat-file','--filters',`--path=${relative}`,oid])));
}
checkpoint('wrapper before binder import');
const{verifySaveBonusInputs,freshSaveBonusProof,saveBonusSha,producerBlobs,bundleLimits,readQaInventory}=await import('../../scripts/save-bonus-inputs.mjs');
const entryProof=await verifySaveBonusInputs(root,manifestPath,checkpoint),entryElapsedMs=Date.now()-started;checkpoint('wrapper after complete entry');
const{test,expect}=await import('@playwright/test');
test('actual save/CON consumers and fresh six original plus two bonus PDFs',async()=>{
 assert.ok(entryElapsedMs<=budget.allowancesMs.wrapperEntry);
 const remaining=wholeDeadline-Date.now();assert.ok(remaining>0);test.setTimeout(remaining);
 activeDeadline=wholeDeadline-budget.allowancesMs.wrapperFinal-budget.allowancesMs.forceAndCleanup;checkpoint('wrapper before runner spawn');
 // verifySaveBonusInputs has already bound inherited helpers before dynamic import.
 const{npcOsIdentity}=await import('../../scripts/npc-process.mjs');
 const workerIdentity={...npcOsIdentity(process.pid,process.ppid),cwd:root,listeningPort:null};
 const script=path.resolve('scripts/verify-save-bonus-local.mjs'),child=spawn(process.execPath,[script,'--outer-deadline',String(wholeDeadline)],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe','ipc']});activeChild=child;
 let output='',identity,rendered,reported,forced=false,finalArtifacts,result,freshInventory,preForceProofMs=0,cleanupFailure;
 const stopRequested=new Promise(resolve=>{stopWake=resolve});const stopTimer=setTimeout(stop,Math.max(1,activeDeadline-Date.now()));stopTimer.unref();
 child.stdout.on('data',chunk=>output+=String(chunk));child.stderr.on('data',chunk=>output+=String(chunk));
 const completion=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
 child.on('message',message=>{if(message.type==='rendered-proof'){assert.equal(rendered,undefined);rendered=message.initialBindings}if(message.type==='resources'){if(reported?.browserProcess)assert.deepEqual(reported.browserProcess,message.browserProcess);reported={taskProcess:message.taskProcess,browserProcess:message.browserProcess}}});
 async function rebind(){
  assert.ok(rendered,'Whole initial IPC rendered proof required');const disk=JSON.parse(await readFile(`${directory}/initial-rendered-proof.json`,'utf8'));assert.deepEqual(disk,rendered);
  const metafile=JSON.parse(await readFile(`${directory}/bundle-metafile.json`,'utf8')),entries=JSON.parse(await readFile(`${directory}/captured-inputs.json`,'utf8'));assert.equal(saveBonusSha(JSON.stringify(entries)),rendered.artifacts.capturedInputsSha256);assert.equal(saveBonusSha(JSON.stringify(metafile)),rendered.artifacts.metafileSha256);
  const fresh=await freshSaveBonusProof(root,manifestPath,metafile,new Map(entries),rendered.artifacts,cleanupCheckpoint);assert.deepEqual(fresh,rendered.artifacts);return fresh;
 }
 try{
  try{identity=npcOsIdentity(child.pid,process.pid);assert.ok(identity.command.includes(script))}catch(error){assert.notEqual(child.exitCode,null,'Refuse unidentified live runner');throw error}
  const code=await Promise.race([completion,stopRequested.then(()=>{throw Error('Owning wrapper stop/deadline: enter bounded cleanup')})]);checkpoint('wrapper after runner exit');await writeFile(`${directory}/runner-output.log`,output);console.log(output);expect(code,output).toBe(0);
  result=JSON.parse(await readFile(`${directory}/evidence.json`,'utf8'));expect(result.wholeDeadline).toBe(wholeDeadline);expect(result.initialBindings).toEqual(rendered);expect(result.initialBindings.artifacts).toEqual(result.artifacts);expect(result.finalBindings.matchedRenderedProof).toBe(true);expect(result.finalBindings.artifacts).toEqual(result.artifacts);
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
  expect(result.artifacts.bundleLimits).toEqual(bundleLimits);expect(result.artifacts.bundles).toHaveLength(bundleLimits.maxFiles);expect(result.artifacts.bundles.reduce((sum,item)=>sum+item.bytes,0)).toBeLessThanOrEqual(bundleLimits.maxTotalBytes);
  for(const bundle of result.artifacts.bundles){expect(bundle.bytes).toBeLessThanOrEqual(bundleLimits.maxFileBytes);expect(bundle.bytes).toBe((await readFile(path.resolve(root,bundle.path))).length)}
  expect(result.pdfs).toHaveLength(8);for(const pdf of result.pdfs){const bytes=await readFile(path.resolve(root,pdf.path));expect(bytes.length).toBe(pdf.bytes);expect(saveBonusSha(bytes)).toBe(pdf.sha256)}
  for(const[input,count]of[['original-print',6],['bonus-print',2]]){const reports=JSON.parse(await readFile(`${directory}/${input}/pdf-verification.json`,'utf8'));expect(reports).toHaveLength(count);expect(reports.every(item=>item.pages>0)).toBe(true)}
  expect(result.qaProcesses).toHaveLength(2);for(const command of result.qaProcesses){expect(command.exitCode).toBe(0);expect(command.remaining).toEqual([]);expect(command.identity.birthUtc).toMatch(/Z$/);expect(command.children.every(item=>item.command&&item.birthUtc)).toBe(true)}
  expect(result.pageErrors).toEqual([]);expect(result.blockedRequests).toEqual([]);expect(result.unexpectedRequests).toEqual([]);expect(result.assetRequests.some(item=>/\.woff2?$/.test(item.path))).toBe(true);expect(result.failure).toBeNull();expect(result.portClosed).toBe(true);expect(result.browserPortClosed).toBe(true);expect(result.browserExited).toBe(true);
  for(const name of ['runnerEntry','cases','exports','originalQA','bonusQA','runnerFinal','forceAndCleanup']){const elapsed=result.phases.filter(item=>item.name===name).reduce((sum,item)=>sum+item.elapsedMs,0);expect(elapsed).toBeLessThanOrEqual(budget.allowancesMs[name])}
 }finally{
  const cleanupStarted=Date.now();cleanupDeadline=Math.min(wholeDeadline,cleanupStarted+budget.allowancesMs.forceAndCleanup+budget.allowancesMs.wrapperFinal);
  clearTimeout(stopTimer);
  try{
  if(child.exitCode===null){if(child.connected)child.send({type:'stop'},()=>{});const ended=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),Math.max(1,Math.min(10000,wholeDeadline-Date.now())));child.once('exit',()=>{clearTimeout(timer);resolve(true)});if(child.exitCode!==null){clearTimeout(timer);resolve(true)}});
   if(!ended&&child.exitCode===null){assert.ok(identity,'Refuse force without original actual birth/PID/parent/command');const proofStarted=Date.now();try{await rebind()}finally{preForceProofMs=Date.now()-proofStarted}if(child.exitCode===null){cleanupCheckpoint('wrapper before fresh exact owned tree force');const fresh=npcOsIdentity(identity.pid,identity.parentPid);assert.equal(fresh.birthUtc,identity.birthUtc);assert.equal(fresh.command,identity.command);assert.ok(fresh.command.includes(script));execFileSync('taskkill',['/pid',String(identity.pid),'/T','/F'],{windowsHide:true});forced=true;await Promise.race([completion,new Promise((_,reject)=>setTimeout(()=>reject(Error('Owned runner exit unconfirmed after force')),Math.max(1,Math.min(10000,wholeDeadline-Date.now()))))])}}
  }
  }catch(error){cleanupFailure=error}
  // A failed case still requires the same complete wrapper-final proof if any
  // rendered state exists; helpers-only cleanup cannot certify rendered bytes.
  const finalStarted=Date.now();cleanupDeadline=Math.min(wholeDeadline,finalStarted+budget.allowancesMs.wrapperFinal-preForceProofMs);
  try{if(rendered){finalArtifacts=await rebind();assert.deepEqual(finalArtifacts.initialSourceProof,entryProof);if(result?.failure===null){const diskInventory=JSON.parse(await readFile(`${directory}/qa-inventory.json`,'utf8'));assert.deepEqual(diskInventory,result.qaInventory);freshInventory=await readQaInventory(root,finalArtifacts,result.pdfs,cleanupCheckpoint);assert.deepEqual(freshInventory,result.qaInventory,'Freshly reopened BOTH-QA output inventory must equal rendered run receipt')}}else{assert.deepEqual(await verifySaveBonusInputs(root,manifestPath,cleanupCheckpoint),entryProof)}}catch(error){cleanupFailure??=error}
  const wrapperFinalMs=Date.now()-finalStarted+preForceProofMs;if(wrapperFinalMs>budget.allowancesMs.wrapperFinal)cleanupFailure??=Error('Wrapper full final proof allocation exceeded: HOLD');
  const wrapperForceMs=finalStarted-cleanupStarted-preForceProofMs;cleanupDeadline=Math.min(wholeDeadline,Date.now()+budget.allowancesMs.forceAndCleanup);
  const closed=port=>!port?Promise.resolve(true):new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.setTimeout(2000,()=>{socket.destroy();resolve(false)});socket.once('connect',()=>{socket.destroy();resolve(false)});socket.once('error',error=>resolve(error.code==='ECONNREFUSED'))});
  const portClosed=await closed(reported?.taskProcess?.listeningPort),browserPortClosed=await closed(reported?.browserProcess?.listeningPort),remaining=[];
  for(const previous of[...new Map([identity,reported?.taskProcess,reported?.browserProcess].filter(Boolean).map(item=>[item.pid,item])).values()]){const text=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${previous.pid}';if($p){@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}else{'null'}`],{encoding:'utf8',windowsHide:true});const current=JSON.parse(text);if(current?.birthUtc===previous.birthUtc&&current.parentPid===previous.parentPid)remaining.push(current)}
  const wrapperCleanupMs=wrapperForceMs+Date.now()-finalStarted-(wrapperFinalMs-preForceProofMs),runnerCleanupMs=result?.phases.filter(item=>item.name==='forceAndCleanup').reduce((sum,item)=>sum+item.elapsedMs+(item.qaCleanupElapsedMs??0),0)??0;
  await writeFile(`${directory}/wrapper-phase-times.json`,JSON.stringify({observed:true,wrapperEntryMs:entryElapsedMs,wrapperFinalMs,preForceProofMs,wrapperCleanupMs,runnerCleanupMs,combinedForceAndCleanupMs:wrapperCleanupMs+runnerCleanupMs,totalElapsedMs:Date.now()-started},null,2));
  await writeFile(`${directory}/runner-output.log`,output);await writeFile(`${directory}/wrapper-cleanup.json`,JSON.stringify({workerIdentity,identity,reported,forced,portClosed,browserPortClosed,remaining,cleanupFailure:cleanupFailure?.message??null,finalBindings:finalArtifacts?{matchedRenderedProof:true,artifacts:finalArtifacts}:null,freshQaInventory:freshInventory??null},null,2));activeChild=undefined;stopWake=undefined;expect(portClosed).toBe(true);expect(browserPortClosed).toBe(true);expect(remaining).toEqual([]);assert.ok(wrapperCleanupMs+runnerCleanupMs<=budget.allowancesMs.forceAndCleanup,'Combined runner/QA/wrapper cleanup exceeds reviewed allocation: HOLD');assert.ok(Date.now()<=wholeDeadline,'Measured whole allocation exceeded provisional outer budget: HOLD');if(cleanupFailure)throw cleanupFailure;
 }
});
