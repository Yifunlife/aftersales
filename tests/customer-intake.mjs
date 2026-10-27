import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import assert from 'node:assert/strict';
import {digest} from '../lib/accounts.mjs';import {handleCustomerIntake} from '../lib/customer-intake.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
class Statement{constructor(sql,values=[]){this.sql=sql;this.values=values}bind(...v){return new Statement(this.sql,v)}async first(){return sqlite.prepare(this.sql).get(...this.values)||null}async all(){return {results:sqlite.prepare(this.sql).all(...this.values)}}async run(){return {meta:{changes:Number(sqlite.prepare(this.sql).run(...this.values).changes)}}}}
const db={prepare:s=>new Statement(s),async batch(list){sqlite.exec('BEGIN');try{const results=[];for(const s of list)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const objects=new Map();const bucket={async put(key,value){objects.set(key,new Uint8Array(await new Response(value).arrayBuffer()))},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(key){objects.delete(key)}};
const cookies={};let number=1;for(const [user,role] of [['staff','售后专员'],['reviewer','审核人员'],['buyer','采购人员'],['admin','管理员'],['reader','负责人']]){const raw=String(number++).repeat(64),session=await digest(raw);sqlite.prepare('INSERT INTO employees(id,employee_id,email,name,role,active,must_change,hash,salt,version,created_at,updated_at) VALUES(?,?,?,?,?,1,0,?,?,1,?,?)').run(user,user,user+'@example.test',user,role,'hash','salt',Date.now(),Date.now());sqlite.prepare('INSERT INTO sessions VALUES(?,?,1,?)').run(session,user,Date.now()+600000);cookies[user]='__Host-yifun_session='+raw;}
async function call(path,{user='staff',body,token,method,origin='https://test.local'}={}){const form=body instanceof FormData;const r=new Request('https://test.local/api/customer/'+path,{method:method||(body?'POST':'GET'),headers:{origin,...(user?{cookie:cookies[user]}:{}),...(token?{'X-Customer-Token':token}:{}),...(body&&!form?{'Content-Type':'application/json'}:{})},body:body?(form?body:JSON.stringify(body)):undefined});const response=await handleCustomerIntake(r,{db,bucket});return {status:response.status,data:response.headers.get('Content-Type')?.includes('json')?await response.json():await response.arrayBuffer()}}
assert.equal((await call('inbox',{user:null})).status,401);assert.equal((await call('inbox',{user:'buyer'})).status,403);assert.equal((await call('profiles',{body:{},origin:'https://evil.example'})).status,403);
const profile={company:'真实流程测试公司',contact:'客户A',email:'customer@example.test',phone:'+123',country:'UAE',language:'ar',salesOwner:'业务员',marketId:'MARKET-1'};
const c=await call('profiles',{body:profile});assert.equal(c.status,200);const cid=c.data.id;
const shop=await call('stores',{body:{customerId:cid,name:'Dubai Mall',orderNo:'ORDER-42',address:'Dubai address',contact:'门店负责人'}});assert.equal(shop.status,200);const sid=shop.data.id;
const link=await call('invites',{body:{customerId:cid,language:'en'}});assert.equal(link.status,200);const url=new URL(link.data.url),token=url.searchParams.get('token');assert.equal(url.pathname,'/request');assert(!sqlite.prepare('SELECT token_hash FROM customer_invites').get().token_hash.includes(token));
let portal=await call('portal?token='+token,{user:null});assert.equal(portal.status,200);assert.equal(portal.data.stores[0].name,'Dubai Mall');assert.equal(portal.data.requests.length,0);
const c2=(await call('profiles',{body:{...profile,company:'其他公司',marketId:'MARKET-2',email:'other@example.test'}})).data.id;const s2=(await call('stores',{body:{customerId:c2,name:'Other company store'}})).data.id;
const payload={submissionKey:crypto.randomUUID(),storeId:sid,contact:'客户A',email:'customer@example.test',phone:'+123',address:'Dubai address',language:'en',issues:[{product:'电机',issue:'不能启动',delivered:'2026-10-01'},{product:'灯带',issue:'灯带不亮'}]};
function form(p,withFile=false){const f=new FormData();f.set('payload',JSON.stringify(p));if(withFile)f.append('file_0',new File([new Uint8Array([137,80,78,71])],'photo.png',{type:'image/png'}));return f}
assert.equal((await call('submit',{user:null,token,body:form({...payload,storeId:s2})})).status,400);assert.equal((await call('submit',{user:null,token,body:form({...payload,issues:[{product:'device',issue:'issue',delivered:'2026-99-99'}]})})).status,400);
const submitted=await call('submit',{user:null,token,body:form(payload,true)});assert.equal(submitted.status,201);const rid=submitted.data.id;assert.equal(objects.size,1);
assert.equal((await call('submit',{user:null,token,body:form(payload,true)})).data.id,rid);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM customer_requests').get().n,1);assert.equal(objects.size,1);
assert.equal((await call('work-items')).data.items.length,0,'Customer requests cannot enter review before a specialist checks them');
assert.equal((await call('requests/'+rid+'/check',{user:'reviewer',body:{reviewerId:'reviewer',confirmed:true}})).status,403);
assert.equal((await call('requests/'+rid+'/check',{body:{reviewerId:'reviewer',confirmed:false}})).status,400);
assert.equal((await call('requests/'+rid+'/needs-info',{body:{note:'补充设备铭牌照片'}})).status,200);
portal=await call('portal?token='+token,{user:null});assert.equal(portal.data.requests[0].note,'补充设备铭牌照片');
const supplement={...payload,requestId:rid,submissionKey:crypto.randomUUID(),issues:[{product:'电机',issue:'不能启动',feedback:'补充：铭牌已核实'},{product:'灯带',issue:'灯带不亮'}]};
assert.equal((await call('submit',{user:null,token,body:form(supplement)})).status,201);
assert.equal((await call('requests/'+rid+'/check',{body:{reviewerId:'reviewer',confirmed:true,note:'内部检查备注不得给客户'}})).status,200);
let work=(await call('work-items',{user:'reviewer'})).data.items;assert.equal(work.length,2);assert(work.every(x=>x.stage==='审核'&&x.owner==='reviewer'&&x.trackingOwner==='staff'));
assert.equal((await call('requests/'+rid+'/check',{body:{reviewerId:'reviewer',confirmed:true}})).status,200);assert.equal((await call('work-items')).data.items.length,2,'Repeated handoff must not create duplicate tasks');
const internalForm=new FormData();internalForm.append('files',new File([new Uint8Array([137,80,78,71])],'internal-photo.png',{type:'image/png'}));const internalUpload=await call('work-items/'+work[0].id+'/files',{user:'reviewer',body:internalForm});assert.equal(internalUpload.status,200);assert.equal((await call('file/'+internalUpload.data.files[0].id+'?token='+token,{user:null})).status,403,'Internal photos must not be accessible through a customer link');assert.equal((await call('file/'+internalUpload.data.files[0].id,{user:'reviewer'})).status,200);
// Link-only storage must reject nested binary content and foreign file references.
assert.equal((await call('work-items',{user:'reviewer',body:{items:[{...work[0],review:{photo:'data:image/png;base64,AAAA'}}]}})).status,400);
assert.equal((await call('work-items',{user:'reviewer',body:{items:[{...work[0],attachments:[{id:'unknown',url:'/api/customer/file/unknown'}]}]}})).status,400);
const edited={...work[0],attachments:[...work[0].attachments,...internalUpload.data.files],stage:'工程下单',planned:'2026-10-25',review:{method:'内部方案'},production:{amountCents:88888}};
assert.equal((await call('work-items',{user:'buyer',body:{items:[edited]}})).status,403);
assert.equal((await call('work-items',{user:'reviewer',body:{items:[edited]}})).status,200);assert.equal((await call('work-items',{user:'reviewer',body:{items:[edited]}})).status,403);assert.equal((await call('work-items',{user:'admin',body:{items:[edited]}})).status,409,'Stale saves must not overwrite another employee');
portal=await call('portal?token='+token,{user:null});const publicJSON=JSON.stringify(portal.data);assert(!publicJSON.includes('内部检查备注'));assert(!publicJSON.includes('amountCents'));assert(!publicJSON.includes('内部方案'));assert.equal(portal.data.requests[0].work[0].planned,'2026-10-25');
const file=sqlite.prepare("SELECT id FROM customer_files WHERE object_key LIKE 'customer/%'").get();assert.equal((await call('file/'+file.id,{user:null})).status,401);assert.equal((await call('file/'+file.id+'?token='+token,{user:null})).status,200);
const link2=await call('invites',{body:{customerId:c2}});const token2=new URL(link2.data.url).searchParams.get('token');assert.equal((await call('file/'+file.id+'?token='+token2,{user:null})).status,403);assert.equal((await call('portal?token='+token2,{user:null})).data.requests.length,0);
const marketSync=await call('profiles',{body:{...profile,contact:'更新后的客户联系人'}});assert.equal(marketSync.data.id,cid,'Stable market ID must update the existing customer instead of making a duplicate');assert.equal((await call('portal?token='+token,{user:null})).data.customer.contact,'更新后的客户联系人');
await call('stores',{body:{id:sid,customerId:cid,name:'Renamed store',orderNo:'NEXT-ORDER-99'}});const historical=(await call('inbox')).data.requests.find(r=>r.id===rid);assert.equal(historical.order_no,'ORDER-42','Updating a store must preserve the original order on an existing service request');assert.equal((await call('portal?token='+token,{user:null})).data.stores[0].order_no,'NEXT-ORDER-99');
await call('revoke-links',{body:{customerId:cid}});assert.equal((await call('portal?token='+token,{user:null})).status,403);
const staffUpload=new FormData();staffUpload.append('files',new File([new Uint8Array([137,80,78,71])],'staff.png',{type:'image/png'}));
assert.equal((await call('staff-files',{user:null,body:staffUpload})).status,401);
const stored=await call('staff-files',{user:'buyer',body:staffUpload});assert.equal(stored.status,200);const staffFile=stored.data.files[0];
assert.equal((await call('file/'+staffFile.id,{user:'staff'})).status,200);
assert.equal((await call('file/'+staffFile.id+'?token='+token2,{user:null})).status,403,'Customer links cannot access staff workflow photos');
assert.equal((await call('file/'+staffFile.id,{user:null})).status,401);
const metadata=sqlite.prepare('SELECT * FROM staff_files WHERE id=?').get(staffFile.id);assert.equal(metadata.size,4);assert.equal(objects.get(metadata.object_key).length,4);assert(!JSON.stringify(metadata).includes('data:'));
assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);console.log('Customer intake passed: durable submission and files, store/profile autofill, customer isolation, scoped links, revocation, deduplication, supplement, specialist gate, reviewer handoff, cloud workflow persistence, employee permissions and private-field filtering.');
// Saving one review draft must persist it without dispatching the whole report.
const vm=await import('node:vm');const source=fs.readFileSync('app-fragment.html','utf8');const reviewSource=source.slice(source.indexOf('function saveReviewItem(form)'),source.indexOf('function dispatchReviewBatch('));
let persisted=0;const draft={id:'draft-cloud',stage:'审核',grade:'B',history:[],cloudRequestId:'request'};const error={textContent:''};
class FormDataMock extends Map{constructor(form){super(Object.entries(form.values))}}
const ctx={error,data:[draft],FormData:FormDataMock,departments:['售后部'],today:'2026-10-19',validDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(v),reviewEdits:new Map(),collapsedReviewItems:new Set(),render(){},notice(){},persist(){persisted++}};
vm.createContext(ctx);vm.runInContext(reviewSource+';saveReviewItem({dataset:{workId:"draft-cloud"},values:{method:"检查固定点",reviewer:"审核员",needOrder:"no",nextOwner:"专员",planned:"2026-10-25"},querySelector:()=>error});',ctx);assert.equal(error.textContent,'');assert.equal(draft.reviewDraft.ready,true);assert.equal(draft.stage,'审核');assert.equal(persisted,1,'A saved review draft must be queued for cloud persistence');
console.log('Customer review draft passed: save persists immediately; full dispatch still waits for all issue plans.');

// Closure generates exactly one private, reviewable solution draft atomically.
let closedWork=(await call('work-items',{user:'admin'})).data.items.find(x=>x.id===edited.id);
closedWork={...closedWork,stage:'已关闭',review:{method:'测试修复：客户A customer@example.test +8613812345678'},history:[{action:'现场处理：更换测试部件'}]};
assert.equal((await call('work-items',{user:'admin',body:{items:[closedWork]}})).status,200);
const learned=sqlite.prepare("SELECT * FROM knowledge_articles WHERE summary LIKE '由已关闭工单%'").all();assert.equal(learned.length,1);assert.equal(learned[0].status,'draft');assert(learned[0].body.includes('更换测试部件'));assert(!learned[0].body.includes('customer@example.test'));assert(!learned[0].body.includes('客户A'));assert(!learned[0].body.includes('13812345678'));
assert.equal((await call('work-items',{user:'admin',body:{items:[closedWork]}})).status,409);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM knowledge_articles').get().n,1);
closedWork.cloudVersion++;assert.equal((await call('work-items',{user:'admin',body:{items:[closedWork]}})).status,200);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM knowledge_articles').get().n,1);
console.log('Solution learning passed: atomic closure, deduplication, stale saves, private draft and contact redaction.');
