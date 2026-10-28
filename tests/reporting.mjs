import assert from 'node:assert/strict';
import {reportingSnapshot} from '../lib/reporting.mjs';
import {DatabaseSync} from 'node:sqlite';
let queries=[];
const db={prepare(sql){queries.push(sql);return sql},async batch(){return [
 {results:[{id:'c1',company:'客户',market_id:null}]},{results:[{id:'s1',customer_id:'c1'}]},
 {results:[{id:'r1',customer_id:'c1',store_id:'s1',status:'in_review'}]},
 {results:[{id:'w1',request_id:'r1',version:2,updated_at:123,payload:JSON.stringify({id:'w1',stage:'审核',issue:'故障',hash:'secret',token:'secret',attachments:[{data:'data:image/png;base64,AAAA'}],review:{internal:'not needed'}})}]},
 {results:[{id:'STAFF-example',version:3,created_at:100,updated_at:200,payload:JSON.stringify({submitted:true,stage:'审核',customer:'客户',project:'项目',issue:'内部故障',cause:'正常损耗',token:'secret'})}]}
 ]}};
const snapshot=await reportingSnapshot(db);assert.equal(snapshot.items[0].payload.issue,'故障');assert.equal(snapshot.items[0].version,2);assert(!JSON.stringify(snapshot).includes('secret'));assert(!JSON.stringify(snapshot).includes('base64'));assert(queries.every(q=>q.startsWith('SELECT ')&&!q.includes('employees')));
await assert.rejects(()=>reportingSnapshot({...db,async batch(){return [{results:new Array(10001)}]}}),/no partial/);
console.log('Private reporting projection passed: read-only queries, versioned work items, no credentials, no attachment bytes, no silent truncation.');

assert.equal(snapshot.items.length,2);const internal=snapshot.items[1];assert.equal(internal.payload.cause,'正常损耗');assert.equal(internal.version,3);const request=snapshot.requests.find(r=>r.id===internal.request_id);assert.equal(snapshot.stores.find(s=>s.id===request.store_id).customer_id,request.customer_id);assert.equal(snapshot.customers.find(c=>c.id===request.customer_id).market_id,null);assert(queries.some(q=>q.includes("$.submitted")&&q.includes("登记草稿")));
const sqlite=new DatabaseSync(':memory:');sqlite.exec(`CREATE TABLE customer_profiles(id TEXT,market_id TEXT,company TEXT,country TEXT,sales_owner TEXT);
CREATE TABLE customer_stores(id TEXT,customer_id TEXT,market_id TEXT,name TEXT,order_no TEXT);
CREATE TABLE customer_requests(id TEXT,customer_id TEXT,store_id TEXT,status TEXT,submitted_at INTEGER);
CREATE TABLE customer_work_items(id TEXT,request_id TEXT,payload TEXT,version INTEGER,updated_at INTEGER);
CREATE TABLE staff_work_items(id TEXT,payload TEXT,version INTEGER,created_at INTEGER,updated_at INTEGER);`);
for(const [id,submitted,stage] of [['one',true,'审核'],['two',true,'已关闭'],['draft',false,'登记草稿'],['unsubmitted',false,'审核'],['badstage',true,'登记草稿']])sqlite.prepare('INSERT INTO staff_work_items VALUES(?,?,1,100,200)').run(id,JSON.stringify({customer:'同一内部客户',project:'同一项目',order:'A',submitted,stage}));
const real={prepare(sql){return sql},async batch(queries){return queries.map(q=>({results:sqlite.prepare(q).all()}))}};
const first=await reportingSnapshot(real),repeat=await reportingSnapshot(real);
assert.equal(first.items.length,2);assert.equal(first.customers.length,1);assert.equal(first.stores.length,1);assert.deepEqual(first,repeat);assert(first.items.some(i=>i.payload.stage==='已关闭'));
assert(first.customers.every(c=>c.market_id===null));sqlite.close();
