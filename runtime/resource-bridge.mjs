// Server-to-server capability; no credentials or SQL are exposed to browsers.
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function handleResourceBridge(request,env){
 if(!env.ALI_RESOURCE_SECRET)return json({error:'Unavailable'},404);
 const supplied=request.headers.get('Authorization')||'',expected='Bearer '+env.ALI_RESOURCE_SECRET;
 const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(supplied))),b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(expected)));let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)return json({error:'Unauthorized'},401);
 if(request.method!=='POST')return json({error:'Method'},405);
 try{const raw=await request.text();if(raw.length>30000000)return json({error:'Too large'},413);const p=JSON.parse(raw);
  if(p.op==='db'){const statement=env.DB.prepare(p.sql).bind(...(p.values||[]));if(!['first','all','run'].includes(p.method))throw Error('Method');return json(await statement[p.method]())}
  if(p.op==='batch'){if(!Array.isArray(p.statements)||p.statements.length>500)throw Error('Batch');return json(await env.DB.batch(p.statements.map(s=>env.DB.prepare(s.sql).bind(...(s.values||[])))))}
  if(p.op==='get'){const o=await env.BUCKET.get(p.key);return json(o?{data:bytesToBase64(new Uint8Array(await o.arrayBuffer())),httpMetadata:o.httpMetadata}:null)}
  if(p.op==='put'){await env.BUCKET.put(p.key,base64ToBytes(p.data),p.options);return json({ok:true})}
  if(p.op==='delete'){await env.BUCKET.delete(p.key);return json({ok:true})}
  if(p.op==='ai')return json(await env.AI.run(p.model,p.input));
  if(p.op==='markdown')return json(await env.AI.toMarkdown({name:p.name,blob:new Blob([base64ToBytes(p.data)],{type:p.type})},p.options));
  return json({error:'Unknown operation'},400);
 }catch{return json({error:'Resource operation failed'},502)}
}
function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
function base64ToBytes(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
