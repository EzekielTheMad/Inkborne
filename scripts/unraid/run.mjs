import fs from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {startProxy} from './proxy.mjs';
const privateDir='/run/inkborne', output='/output', mode=process.env.INKBORNE_TEST_MODE;
const nextHeapMiB=6144;
assert(['workflow','focused','builders','csj'].includes(mode));
const runtime=JSON.parse(fs.readFileSync(privateDir+'/runtime.json','utf8'));
const builderStories=JSON.parse(fs.readFileSync(privateDir+'/host.json','utf8')).builderStories??[];
const storyPatterns=Object.fromEntries(['Bard','Cleric','Druid','Sorcerer','Warlock','Wizard','Paladin','Ranger'].map(name=>[name,`complete SRD ${name} `]));
Object.assign(storyPatterns,{A1:'complete martial A1 ',A2:'complete martial A2 ',A3:'complete martial A3 ',A4:'Hill Dwarf Barbarian completes',A5:'A5 full half-pact caster',A6:'A6 owns Tiefling tiers'});
assert(Array.isArray(builderStories)&&new Set(builderStories).size===builderStories.length&&builderStories.every(story=>Object.hasOwn(storyPatterns,story)));
assert(mode==='builders'||builderStories.length===0);
const steps=[], children=new Set(); let proxy, status='running', phase='static-checks';
const report=()=>fs.writeFileSync(output+'/summary.json',JSON.stringify({kind:'inkborne-unraid-verification-v1',sourceHead:runtime.sourceHead,
 runId:runtime.runId,engineId:runtime.engineId,databaseId:runtime.databaseId,mode,builderStories,status,phase,steps,
 configuredNextHeapMiB:nextHeapMiB,nextMemoryRestarts:fs.existsSync(privateDir+'/next.log')
  ? (fs.readFileSync(privateDir+'/next.log','utf8').match(/Server is approaching the used memory threshold, restarting/g)??[]).length : null,
 historicalParentA4F3Acceptance:false},null,2)+'\n');
function child(command,args,env={},name=command){
 const startedUtc=new Date().toISOString(), processChild=spawn(command,args,{cwd:'/workspace',env:{...process.env,...env},stdio:['ignore','pipe','pipe'],detached:true});
 children.add(processChild); const file=fs.createWriteStream(privateDir+'/'+name+'.log',{mode:0o600});processChild.stdout.pipe(file,{end:false});processChild.stderr.pipe(file,{end:false});
 const done=new Promise(resolve=>{processChild.once('close',code=>{children.delete(processChild);file.end();steps.push({name,pid:processChild.pid,args,startedUtc,finishedUtc:new Date().toISOString(),exitCode:code});report();resolve(code);});processChild.once('error',()=>{children.delete(processChild);file.end();resolve(-1);});});
 processChild.done=done;
 return {processChild,done};
}
async function run(args,name){const code=await child('npm',args,{},name).done;assert.equal(code,0,`${name} failed; raw output kept private`);}
async function stopChildren(){
 for(const item of children)if(item.pid)try{process.kill(-item.pid,'SIGTERM');}catch{}
 await new Promise(resolve=>setTimeout(resolve,1000));
 for(const item of children)if(item.pid)try{process.kill(-item.pid,'SIGKILL');}catch{}
 await Promise.all([...children].map(item=>item.done));
}
async function waitFor(url,seconds=120){for(let index=0;index<seconds;index++){try{const result=await fetch(url,{signal:AbortSignal.timeout(3000)});if(result.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}throw Error('local service readiness timeout');}
function journalArtifact(name){
 const root=output+'/journal',found=[],pending=[{dir:root,depth:0}];let visited=0;
 while(pending.length){const {dir,depth}=pending.pop();assert(depth<=3,'bounded Journal output tree required');
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   assert(++visited<=64&&!entry.isSymbolicLink(),'bounded owned Journal artifacts required');const path=dir+'/'+entry.name;
   if(entry.isDirectory())pending.push({dir:path,depth:depth+1});else if(entry.isFile()&&entry.name===name)found.push(path);
  }
 }
 assert.equal(found.length,1,'one exact Journal artifact required');return JSON.parse(fs.readFileSync(found[0],'utf8'));
}
process.once('SIGTERM',()=>{void stopChildren().then(()=>process.exit(1));});
try{
 if(mode==='csj')for(const file of ['e2e/unraid/csj.config.ts','e2e/unraid/csj-flow.spec.ts',
  'e2e/local-journal/real.config.ts','e2e/local-journal/real-journal.spec.ts','scripts/unraid/native-basic-sheet.ts',
  'supabase/staged/character-basic-sheet-commands.sql','supabase/verification/character-basic-sheet-profile.sql'])assert(fs.existsSync(file),'assembled CSJ source is incomplete');
 report();console.log(JSON.stringify({phase}));
 await run(['run','typecheck','--','--tsBuildInfoFile','/tmp/inkborne.tsbuildinfo'],'typecheck');
 await run(['run','lint'],'lint');
 const focused = mode==='csj' ? ['tests/app/basic-sheet-actions.test.ts','tests/lib/character/state-writer.test.ts','tests/sheet/update-state.test.ts',
  'tests/components/character/basic-sheet-draft-retention.test.tsx','tests/app/campaign-actions.test.ts']
 : mode==='builders' ? ['tests/lib/character/ancestry-hit-points.test.ts','tests/lib/character/ancestry-defenses.test.ts',
  'tests/lib/character/earned-racial-spells.test.ts','tests/lib/builder/choice-options.test.ts',
  'tests/components/sheet/content-tabs.test.tsx','tests/app/class-step-client-feat-regressions.test.tsx'] : ['tests/lib/builder/choice-options.test.ts','tests/lib/builder/asi-option-scores.test.ts','tests/components/builder/choice-selector.test.tsx',
  'tests/scripts/character-command-psql.test.ts','tests/scripts/builder-parent-admission-concurrency.test.ts',
  'tests/scripts/parent-admission-acceptance.test.ts'];
 await run(['test','--',...focused,'--maxWorkers=1'],'focused');
 if(mode!=='focused'){
  phase='backend-bootstrap';report();console.log(JSON.stringify({phase}));proxy=await startProxy();
  await waitFor('http://127.0.0.1:9999/auth/v1/health');
  const {bootstrap}=await import('./bootstrap.ts');await bootstrap();
  const server=JSON.parse(fs.readFileSync(privateDir+'/server-env.json','utf8'));
  phase='actual-character-workflow';report();console.log(JSON.stringify({phase}));
  child('npm',['run','dev','--','--webpack','--hostname','127.0.0.1','--port','3001'],
   {...server,NODE_OPTIONS:`--max-old-space-size=${nextHeapMiB}`,ADMIN_USER_IDS:''},'next');
  await waitFor('http://127.0.0.1:3001/login',180);
  if(mode==='csj'){
   phase='actual-csj-creation-and-sheet';report();
   await run(['run','test:e2e','--','--config','e2e/unraid/csj.config.ts'],'csj-flow');
   const receipt=JSON.parse(fs.readFileSync(output+'/csj-flow.json','utf8'));
   assert.equal(receipt.kind,'inkborne-csj-flow-v1');assert.equal(receipt.runId,runtime.runId);assert.equal(receipt.sourceHead,runtime.sourceHead);
   assert.equal(receipt.normalUiCreation,true);assert.equal(receipt.basicSheetPassed,true);
   const flowCleanup=JSON.parse(fs.readFileSync(output+'/csj-flow-cleanup.json','utf8'));
   assert.equal(flowCleanup.runId,runtime.runId);assert.equal(flowCleanup.sourceHead,runtime.sourceHead);
   assert.equal(flowCleanup.complete,true);assert.equal(flowCleanup.browserContextClosed,true);assert.equal(flowCleanup.fixtureBudgetConfirmed,true);
   const journal=JSON.parse(fs.readFileSync(privateDir+'/journal-config.json','utf8'));
   assert.equal(journal.runId,runtime.runId);assert.equal(journal.standaloneCharacterId,receipt.standaloneCharacterId);
   assert.equal(journal.campaignCharacterId,receipt.campaignCharacterId);assert.notEqual(receipt.standaloneCharacterId,receipt.campaignCharacterId);
   phase='actual-csj-journal';report();
   await run(['run','test:e2e','--','--config','e2e/local-journal/real.config.ts'],'csj-journal');
   // The Journal success receipt precedes its finally cleanup. Require zero
   // exit AFTER that cleanup, its actual cleanup record and fresh native facts.
   const real=journalArtifact('journal-real.json'),cleanup=journalArtifact('journal-cleanup.json');
   assert.equal(real.runId,runtime.runId);assert.equal(real.sourceHead,runtime.sourceHead);
   for(const key of ['actualNextApp','actualAuth','actualPostgrest','actualDatabaseIdentity','journalWritesPreserveMechanics',
    'laterHpEditPreservesNarrative','audienceMatrixPassed','nonOwnerWritesDenied','lostResponseDraftRetained',
    'createResponseLostReadbackPassed','staleOwnerTabPassed','removedEntryConflictPassed','noExtraJournalRow'])assert.equal(real[key],true,'complete actual Journal evidence required');
   assert.equal(real.entries.length,3);assert.equal(new Set(real.entries.map(entry=>entry.id)).size,3);
   assert.deepEqual(real.entries.map(entry=>entry.characterId).sort(),[receipt.standaloneCharacterId,receipt.campaignCharacterId,receipt.campaignCharacterId].sort());
   assert.equal(cleanup.contextsClosed,true);assert.equal(cleanup.recordedEntries,3);assert.equal(cleanup.removed.length,3);assert(cleanup.removed.every(value=>value===true));
   const {nativeJson}=await import('./native.ts');
   const final=await nativeJson(`BEGIN READ ONLY; SELECT jsonb_build_object(
    'accounts',(SELECT jsonb_agg(id ORDER BY id) FROM auth.users),
    'characters',(SELECT jsonb_agg(id ORDER BY id) FROM public.characters),
    'campaigns',(SELECT jsonb_agg(id ORDER BY id) FROM public.campaigns),
    'members',(SELECT jsonb_agg(user_id ORDER BY user_id) FROM public.campaign_members),
    'journal',(SELECT count(*) FROM public.character_timeline_events),
    'caps',(SELECT count(*) FROM private.character_builder_capabilities_v1),
    'seals',(SELECT count(*) FROM private.character_parent_admissions_v1)); ROLLBACK;`);
   assert.deepEqual(final,{accounts:Object.values(journal.accounts).map(account=>account.id).sort(),
    characters:[receipt.standaloneCharacterId,receipt.campaignCharacterId].sort(),campaigns:[journal.campaignId],
    members:[journal.accounts.owner.id,journal.accounts.dm.id,journal.accounts.member.id].sort(),journal:0,caps:0,seals:0});
   assert(steps.filter(step=>['csj-flow','csj-journal'].includes(step.name)).length===2&&steps.filter(step=>['csj-flow','csj-journal'].includes(step.name)).every(step=>step.exitCode===0));
   fs.writeFileSync(output+'/csj-cleanup-check.json',JSON.stringify({runId:runtime.runId,sourceHead:runtime.sourceHead,
    bothActualTestProcessesExitedZero:true,flowContextsClosed:true,journalContextsAndExactEntriesCleaned:true,
    finalNativeFixtureBudget:final,runtimeTeardownStillRequired:true,passed:true},null,2)+'\n');
  }else await run(['run','test:e2e','--','--config',mode==='builders'?'e2e/unraid/builders.config.ts':'e2e/unraid/playwright.config.ts',
   ...(builderStories.length?['--grep',builderStories.map(story=>storyPatterns[story]).join('|')]:[])],'browser');
 }
 status='passed';
}catch(error){status='failed';fs.writeFileSync(output+'/failure.json',JSON.stringify({phase,message:error instanceof Error?error.message:'verification failed'})+'\n');}
finally{await stopChildren();if(proxy)await new Promise(resolve=>proxy.close(resolve));report();}
console.log(JSON.stringify({status,phase,output:'summary.json'}));if(status!=='passed')process.exitCode=1;
