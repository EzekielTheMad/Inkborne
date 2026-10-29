// Export committed source and public SRD inputs only. SSH uses the existing local
// `unraid` alias; no production environment or credentials leave this checkout.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'), mode=process.argv[2]??'workflow';
assert(['plan','workflow','focused','builders','csj'].includes(mode),'Use plan, workflow, focused, builders, or csj');
const builderStories=process.argv[3]?.split(',')??[];
assert(builderStories.length===0||mode==='builders','Story selection requires builders mode');
assert(new Set(builderStories).size===builderStories.length&&builderStories.every(story=>['Bard','Cleric','Druid','Sorcerer','Warlock','Wizard','Paladin','Ranger','A1','A2','A3','A4','A5','A6'].includes(story)),'Use existing builder story names or A1-A6');
const invoke=(program,args,options={})=>execFileSync(program,args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,...options});
const git=(...args)=>invoke('git',args).trim();
const head=git('rev-parse','HEAD'), sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const runId=randomUUID(), runDirectory='/mnt/cache/appdata/inkborne-test-runner/runs/'+runId;
const project='inkborne-test-'+runId.slice(0,8), image='inkborne-test-runner:'+head.slice(0,12);
const host={runId,runDirectory,project,image,sourceHead:head,mode:mode==='plan'?'workflow':mode,builderStories};
const targetEngine='6c7435b9-f7a8-46fc-98f2-32bd15ba5f83';
const sshArgs=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8'];
const ssh=command=>invoke('ssh',[...sshArgs,'unraid',command]);
assert.equal(ssh("docker info --format '{{.ID}}'").trim(),targetEngine,'Unexpected Unraid Docker engine');
const dockerAvailableKiB=Number(ssh("df -Pk /var/lib/docker | awk 'NR==2{print $4}'").trim());
assert(Number.isSafeInteger(dockerAvailableKiB)&&dockerAvailableKiB>0);
console.log(JSON.stringify({...host,target:'unraid',publishedPorts:0,runnerMemoryGiB:10,runnerCpus:3,ephemeral:true,dockerAvailableKiB,dockerStorageReady:dockerAvailableKiB>=15728640}));
if(mode==='plan')process.exit(0);
assert(dockerAvailableKiB>=15728640,'Unraid Docker image disk needs 15 GiB free; no image pull or runtime started');
assert.equal(git('status','--porcelain','--untracked-files=normal'),'','Commit source before exporting a test candidate');
const tracked=git('ls-files').split('\n');
if(mode==='csj')for(const file of ['e2e/unraid/csj.config.ts','e2e/unraid/csj-flow.spec.ts',
 'e2e/local-journal/real.config.ts','e2e/local-journal/real-journal.spec.ts','scripts/unraid/native-basic-sheet.ts',
 'supabase/staged/character-basic-sheet-commands.sql','supabase/verification/character-basic-sheet-profile.sql']){
 assert(tracked.includes(file),'CSJ requires the committed assembled Flow/Journal consumer before export');
}
const templates=new Set(['.env.local.example','infra/backup/.env.example']);
assert(!tracked.some(file=>!templates.has(file)&&/(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519)$/.test(file)),'Secret-like tracked file blocks export');
const cache=path.resolve(root,'../equipment-runtime/catalog-data');
const manifest=fs.readFileSync(path.join(cache,'source-manifest.json'));
assert.equal(sha(manifest),'60e35087457442e13b2ca8404b129baa934684a02937720a22770894c207e40e');
const inputs=JSON.parse(manifest).sources;
assert.equal(inputs.length,1572);assert.equal(new Set(inputs.map(item=>item.file)).size,1572);
for(const item of inputs){assert(/^responses\/[a-z0-9/-]+\.json$/.test(item.file)&&!item.file.includes('..'));assert.equal(sha(fs.readFileSync(path.join(cache,item.file))),item.sha256);}
const base=[
 ['supabase_admin','hit-die-transaction'],['supabase_admin','hit-die-authority-and-writers'],['supabase_admin','class-origin-producer'],
 ['supabase_admin','class-origin-joint-revision'],['supabase_admin','class-origin-confirmation-producer'],['supabase_admin','class-origin-fresh-bootstrap'],
 ['postgres','character-command-row-locks'],['postgres','character-command-actor-rows'],['supabase_admin','character-creation-server-bridge'],
 ['supabase_admin','character-creation-native-admission'],['supabase_admin','class-origin-first-acquisition-prerequisites'],
 ['postgres','class-first-acquisition-dependencies'],['postgres','class-first-acquisition-allocation'],['postgres','class-first-acquisition-calculations'],
 ['supabase_admin','class-first-acquisition-protected-plan'],['supabase_admin','class-first-acquisition-materializers'],['supabase_admin','class-first-acquisition-writer']];
const companions=['steps','catalog','progression','race-score-repair','expertise','multiclass','class-feature-choices','favored-enemy','multiclass-integration-repair',
 'bonus-spells','expanded-spells','class-removal','subclass-update','hp-bonus','parent-admission','ancestry-hp-bonus','earned-racial-spells'];
const entry=(file,role)=>({file,role,sha256:sha(invoke('git',['show',head+':'+file],{encoding:null}))});
const source={sourceHead:head,migrations:tracked.filter(file=>/^supabase\/migrations\/[^/]+\.sql$/.test(file)).sort().map(file=>entry(file,'postgres')),
 stages:[...base.map(([role,name])=>entry('supabase/staged/'+name+'.sql',role)),...companions.map(name=>entry('supabase/staged/character-builder-'+name+'.sql','supabase_admin'))],
 ...(mode==='csj'?{basicSheetStage:entry('supabase/staged/character-basic-sheet-commands.sql','supabase_admin')}:{})};
assert.equal(source.migrations.length,83);assert.equal(source.stages.length,34);
const local=path.resolve(root,'../equipment-runtime/unraid',runId);fs.mkdirSync(local,{recursive:true});
fs.writeFileSync(path.join(local,'host.json'),JSON.stringify(host));fs.writeFileSync(path.join(local,'source.json'),JSON.stringify(source));
fs.writeFileSync(path.join(local,'catalog-files.txt'),['source-manifest.json',...inputs.map(item=>item.file)].join('\n')+'\n');
// Git for Windows otherwise converts archive entries using core.autocrlf.
// Freeze canonical repository bytes for Linux shell execution and SQL hashes.
invoke('git',['-c','core.autocrlf=false','archive','--format=tar','--output='+path.join(local,'source.tar'),head]);
invoke('tar',['-cf',path.join(local,'catalog.tar'),'-C',cache,'-T',path.join(local,'catalog-files.txt')]);
// All interpolated remote paths/identities above are generated finite values.
ssh(`set -eu; umask 077; for p in /mnt/cache /mnt/cache/appdata /mnt/cache/appdata/inkborne-test-runner /mnt/cache/appdata/inkborne-test-runner/runs; do test ! -L "$p"; done; test ! -e ${runDirectory}; mkdir -p ${runDirectory}; chmod 700 ${runDirectory}`);
invoke('scp',[...sshArgs,...['source.tar','catalog.tar','host.json','source.json'].map(file=>path.join(local,file)),'unraid:'+runDirectory+'/']);
const archiveSha=sha(fs.readFileSync(path.join(local,'source.tar'))), catalogSha=sha(fs.readFileSync(path.join(local,'catalog.tar')));
const command=`set -eu; cd ${runDirectory}; test "$(sha256sum source.tar | cut -d' ' -f1)" = ${archiveSha}; test "$(sha256sum catalog.tar | cut -d' ' -f1)" = ${catalogSha}; mkdir source; tar -xf source.tar -C source; exec bash source/scripts/unraid/host.sh ${runId} ${targetEngine}`;
const startedUtc=new Date().toISOString();const child=spawn('ssh',[...sshArgs,'unraid',command],{cwd:root,stdio:'inherit'});
fs.writeFileSync(path.join(local,'transport.json'),JSON.stringify({pid:child.pid,cwd:root,startedUtc,runId,sourceHead:head}));
const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('close',value=>resolve(value??1));});
try{invoke('scp',[...sshArgs,'-r','unraid:'+runDirectory+'/output',local]);}catch{console.error('Evidence download failed; retained at '+runDirectory+'/output');}
console.log(JSON.stringify({exitCode:code,evidence:path.join(local,'output'),runId,sourceHead:head}));process.exitCode=code;
