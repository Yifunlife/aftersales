import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleResourceBridge} from '../runtime/resource-bridge.mjs';
const secret='a'.repeat(64),data=new Map();
const DB={prepare(sql){return {bind(...values){return {first:async()=>({sql,values}),all:async()=>({results:[{sql,values}]}),run:async()=>({meta:{changes:1}})}}}},batch:async list=>Promise.all(list.map(s=>s.run()))};
const cloud={ALI_RESOURCE_SECRET:secret,DB,BUCKET:{async put(k,v,options){data.set(k,{v:new Uint8Array(await new Response(v).arrayBuffer()),options})},async get(k){const o=data.get(k);return o?{arrayBuffer:async()=>o.v.buffer,httpMetadata:o.options?.httpMetadata}:null},async delete(k){data.delete(k)}},AI:{run:async(model,input)=>({model,input}),toMarkdown:async f=>({name:f.name,data:await f.blob.text()})}};
assert.equal((await handleResourceBridge(new Request('https://test/__ali-resources',{method:'POST'}),cloud)).status,401);assert.equal((await handleResourceBridge(new Request('https://test/__ali-resources'),{})).status,404);
const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const response=await handleResourceBridge(new Request('https://test/__ali-resources',{method:req.method,headers:req.headers,body:raw||undefined}),cloud);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const dir=mkdtempSync(join(tmpdir(),'yifun-runtime-'));writeFileSync(join(dir,'config.json'),JSON.stringify({resourceSecret:secret,resourceUrl:`http://127.0.0.1:${server.address().port}`}));process.env.YIFUN_RUNTIME_CONFIG=join(dir,'config.json');
try{const {env}=await import('../runtime/node-bindings.mjs');assert.deepEqual(await env.DB.prepare('SELECT ?').bind("引号'与中文").first(),{sql:'SELECT ?',values:["引号'与中文"]});assert.equal((await env.DB.batch([env.DB.prepare('UPDATE test SET x=?').bind(1)]))[0].meta.changes,1);
 const bytes=new Uint8Array([0,255,128,137,80,78,71]);await env.BUCKET.put('test',bytes,{httpMetadata:{contentType:'image/png'}});assert.deepEqual(new Uint8Array(await new Response((await env.BUCKET.get('test')).body).arrayBuffer()),bytes);await env.BUCKET.delete('test');assert.equal(await env.BUCKET.get('test'),null);
 assert.equal((await env.AI.run('test',{question:'问题'})).input.question,'问题');assert.equal((await env.AI.toMarkdown({name:'test.pdf',blob:new Blob(['说明'])})).data,'说明');
 console.log('Aliyun resource bridge passed: unauthorized access denied, bound SQL preserved, atomic batch transport, binary object roundtrip and AI conversion transport.');
}finally{server.close();rmSync(dir,{recursive:true,force:true})}
