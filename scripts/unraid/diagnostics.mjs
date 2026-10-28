// Failure details may include URLs/headers. Redact every generated credential
// before returning a bounded diagnostic; remove the original private files.
import fs from 'node:fs';
const directory='/run/inkborne', secrets=[];
for(const name of ['runtime.env','server-env.json','api.json','test-config.json']){
 try{
  const raw=fs.readFileSync(directory+'/'+name,'utf8');
  if(name.endsWith('.env'))for(const line of raw.split('\n')){const [key,...rest]=line.split('=');if(/PASSWORD|SECRET/.test(key))secrets.push(rest.join('='));}
  else{const visit=value=>{if(typeof value==='string')secrets.push(value);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(JSON.parse(raw));}
 }catch{}
}
let text='';for(const file of fs.readdirSync(directory).filter(name=>name.endsWith('.log'))){
 const bytes=fs.readFileSync(directory+'/'+file);text+='\n--- '+file+' ---\n'+bytes.subarray(Math.max(0,bytes.length-24000)).toString('utf8');
}
for(const value of secrets.filter(value=>value.length>=6).sort((a,b)=>b.length-a.length))text=text.replaceAll(value,'[redacted]');
text=text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted JWT]');
fs.writeFileSync('/output/diagnostic.txt',text,{mode:0o600});
