import http from 'node:http';
// A private loopback gateway inside the runner. Nothing is published on Unraid.
const hop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
export function startProxy(){
 const server=http.createServer((request,response)=>{
  if(request.headers.origin&&request.headers.origin!=='http://127.0.0.1:3001'){response.writeHead(403).end();return;}
  response.setHeader('Cache-Control','no-store');
  if(request.url==='/healthz'){response.writeHead(200,{'Content-Type':'application/json'}).end('{"ready":true}');return;}
  const raw=request.url??'', auth=raw.startsWith('/auth/v1/'), rest=raw.startsWith('/rest/v1/');
  if((!auth&&!rest)||/[\\]|%2f|%5c|%00/i.test(raw.split('?')[0])){response.writeHead(404).end();return;}
  if(request.headers.origin){response.setHeader('Access-Control-Allow-Origin',request.headers.origin);response.setHeader('Access-Control-Allow-Credentials','true');response.setHeader('Vary','Origin');}
  if(request.method==='OPTIONS'){response.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version,accept-profile,content-profile'}).end();return;}
  const headers=Object.fromEntries(Object.entries(request.headers).filter(([key])=>!hop.has(key)&&!['host','origin'].includes(key)));
  const upstream=http.request({hostname:auth?'auth':'rest',port:auth?9999:3000,method:request.method,path:raw.slice(8),headers},reply=>{
   for(const [key,value]of Object.entries(reply.headers))if(value!==undefined&&!hop.has(key)&&!key.startsWith('access-control-')&&key!=='cache-control')response.setHeader(key,value);
   response.writeHead(reply.statusCode??502);reply.pipe(response);reply.on('error',()=>response.destroy());
  });
  upstream.setTimeout(20000,()=>upstream.destroy());upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end();});
  let bytes=0;request.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){upstream.destroy();if(!response.headersSent)response.writeHead(413);response.end();}});
  request.pipe(upstream);request.on('aborted',()=>upstream.destroy());
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(9999,'127.0.0.1',()=>resolve(server));});
}
