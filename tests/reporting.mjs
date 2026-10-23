import assert from 'node:assert/strict';
import {reportingSnapshot} from '../lib/reporting.mjs';
let queries=[];
const db={prepare(sql){queries.push(sql);return sql},async batch(){return [
 {results:[{id:'c1',company:'客户',market_id:null}]},{results:[{id:'s1',customer_id:'c1'}]},
 {results:[{id:'r1',customer_id:'c1',store_id:'s1',status:'in_review'}]},
 {results:[{id:'w1',request_id:'r1',version:2,updated_at:123,payload:JSON.stringify({id:'w1',stage:'审核',issue:'故障',hash:'secret',token:'secret',attachments:[{data:'data:image/png;base64,AAAA'}],review:{internal:'not needed'}})}]}
 ]}};
const snapshot=await reportingSnapshot(db);assert.equal(snapshot.items[0].payload.issue,'故障');assert.equal(snapshot.items[0].version,2);assert(!JSON.stringify(snapshot).includes('secret'));assert(!JSON.stringify(snapshot).includes('base64'));assert(queries.every(q=>q.startsWith('SELECT ')&&!q.includes('employees')));
await assert.rejects(()=>reportingSnapshot({...db,async batch(){return [{results:new Array(10001)}]}}),/no partial/);
console.log('Private reporting projection passed: read-only queries, versioned work items, no credentials, no attachment bytes, no silent truncation.');
