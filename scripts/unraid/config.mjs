// Scratch credentials are generated on Unraid, never copied from the desktop.
import fs from 'node:fs';
import {randomBytes,createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
const directory='/run/inkborne', host=JSON.parse(fs.readFileSync(directory+'/host.json','utf8'));
assert(/^[a-f0-9-]{36}$/.test(host.runId));
assert(host.runDirectory==='/mnt/cache/appdata/inkborne-test-runner/runs/'+host.runId);
const password=randomBytes(32).toString('hex'), secret=randomBytes(48).toString('hex');
const jwt=role=>{
 const now=Math.floor(Date.now()/1000), head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({role,iss:'http://127.0.0.1:9999/auth/v1',aud:'authenticated',iat:now,exp:now+7200})).toString('base64url');
 return head+'.'+body+'.'+createHmac('sha256',secret).update(head+'.'+body).digest('base64url');
};
const anonKey=jwt('anon'), serviceRoleKey=jwt('service_role');
const write=(name,value)=>fs.writeFileSync(directory+'/'+name,value,{mode:0o600,flag:'wx'});
write('runtime.env',Object.entries({LOCAL_PG_PASSWORD:password,LOCAL_JWT_SECRET:secret,INKBORNE_TEST_RUN:host.runId,
 INKBORNE_TEST_SOURCE:host.runDirectory+'/source',INKBORNE_TEST_PRIVATE:host.runDirectory+'/private',INKBORNE_TEST_OUTPUT:host.runDirectory+'/output',
 INKBORNE_TEST_IMAGE:host.image,INKBORNE_TEST_MODE:host.mode}).map(([key,value])=>key+'='+value).join('\n')+'\n');
write('pgpass','db:5432:postgres:*:'+password+'\n');
write('server-env.json',JSON.stringify({NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:9999',NEXT_PUBLIC_SUPABASE_ANON_KEY:anonKey,
 SUPABASE_SERVICE_ROLE_KEY:serviceRoleKey,INKBORNE_CLASS_ORIGIN_CREATION_UI:'true'})+'\n');
write('api.json',JSON.stringify({anonKey,serviceRoleKey})+'\n');
console.log(JSON.stringify({credentialsGenerated:true,valuesRecorded:false}));
