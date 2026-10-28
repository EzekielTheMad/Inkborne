import fs from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {startProxy} from './proxy.mjs';
const privateDir='/run/inkborne', output='/output', mode=process.env.INKBORNE_TEST_MODE;
assert(['workflow','focused'].includes(mode));
const runtime=JSON.parse(fs.readFileSync(privateDir+'/runtime.json','utf8'));
const steps=[], children=new Set(); let proxy, status='running', phase='static-checks';
const report=()=>fs.writeFileSync(output+'/summary.json',JSON.stringify({kind:'inkborne-unraid-verification-v1',sourceHead:runtime.sourceHead,
 runId:runtime.runId,engineId:runtime.engineId,databaseId:runtime.databaseId,mode,status,phase,steps,historicalParentA4F3Acceptance:false},null,2)+'\n');
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
process.once('SIGTERM',()=>{void stopChildren().then(()=>process.exit(1));});
try{
 report();console.log(JSON.stringify({phase}));
 await run(['run','typecheck','--','--tsBuildInfoFile','/tmp/inkborne.tsbuildinfo'],'typecheck');
 await run(['run','lint'],'lint');
 await run(['test','--','tests/lib/builder/choice-options.test.ts','tests/lib/builder/asi-option-scores.test.ts','tests/components/builder/choice-selector.test.tsx',
  'tests/scripts/character-command-psql.test.ts','tests/scripts/builder-parent-admission-concurrency.test.ts','--maxWorkers=1'],'focused');
 if(mode==='workflow'){
  phase='backend-bootstrap';report();console.log(JSON.stringify({phase}));proxy=await startProxy();
  await waitFor('http://127.0.0.1:9999/auth/v1/health');
  const {bootstrap}=await import('./bootstrap.ts');await bootstrap();
  const server=JSON.parse(fs.readFileSync(privateDir+'/server-env.json','utf8'));
  phase='actual-character-workflow';report();console.log(JSON.stringify({phase}));
  child('npm',['run','dev','--','--webpack','--hostname','127.0.0.1','--port','3001'],{...server,ADMIN_USER_IDS:''},'next');
  await waitFor('http://127.0.0.1:3001/login',180);
  await run(['run','test:e2e','--','--config','e2e/unraid/playwright.config.ts'],'browser');
 }
 status='passed';
}catch(error){status='failed';fs.writeFileSync(output+'/failure.json',JSON.stringify({phase,message:error instanceof Error?error.message:'verification failed'})+'\n');}
finally{await stopChildren();if(proxy)await new Promise(resolve=>proxy.close(resolve));report();}
console.log(JSON.stringify({status,phase,output:'summary.json'}));if(status!=='passed')process.exitCode=1;
