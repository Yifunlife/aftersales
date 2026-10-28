// Internal reporting projection: no account credentials, invite tokens or file bytes.
const fields=['id','workNo','product','issue','reported','delivered','planned','actual','stage','owner','trackingOwner','sales','designer','engineer','installer','method','grade','cost','cause','issueType','country','contractDeadline','safetyLevel','executionMethod','costResponsibility'];
const reportKey=async values=>'staff-report:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values)))),n=>n.toString(16).padStart(2,'0')).join('');
export async function reportingSnapshot(db){
 const results=await db.batch([
  db.prepare('SELECT id,market_id,company,country,sales_owner FROM customer_profiles ORDER BY id LIMIT 10001'),
  db.prepare('SELECT id,customer_id,market_id,name,order_no FROM customer_stores ORDER BY id LIMIT 10001'),
  db.prepare('SELECT id,customer_id,store_id,status,submitted_at FROM customer_requests ORDER BY id LIMIT 10001'),
  db.prepare('SELECT id,request_id,payload,version,updated_at FROM customer_work_items ORDER BY id LIMIT 10001'),
  db.prepare("SELECT id,payload,version,created_at,updated_at FROM staff_work_items WHERE json_extract(payload,'$.submitted')=1 AND json_extract(payload,'$.stage')!='登记草稿' ORDER BY id LIMIT 10001")
 ]);
 if(results.some(r=>r.results.length>10000))throw new Error('Reporting snapshot exceeds supported size; no partial snapshot returned');
 // Reporting-only parents satisfy the existing dashboard contract. Never infer CRM identity from names.
 const customers=[...results[0].results],stores=[...results[1].results],requests=[...results[2].results];
 const customerKeys=new Set(),storeKeys=new Set(),internal=[];
 for(const r of results[4].results){const p=JSON.parse(r.payload),key='staff-report:'+r.id,customerKey=await reportKey(['customer',p.customer||r.id]),storeKey=await reportKey(['store',customerKey,p.project||r.id,p.order||'']);
  // These aggregate internal reporting labels only; market_id stays null and never grants customer access.
  if(!customerKeys.has(customerKey)){customerKeys.add(customerKey);customers.push({id:customerKey,market_id:null,company:p.customer||'内部登记客户',country:p.country||'',sales_owner:p.sales||''});}
  if(!storeKeys.has(storeKey)){storeKeys.add(storeKey);stores.push({id:storeKey,customer_id:customerKey,market_id:null,name:p.project||'内部登记项目',order_no:p.order||''});}
  requests.push({id:key,customer_id:customerKey,store_id:storeKey,status:'in_review',submitted_at:r.created_at});
  internal.push({...r,request_id:key});
 }
 if([customers,stores,requests,[...results[3].results,...internal]].some(rows=>rows.length>10000))throw new Error('Reporting snapshot exceeds supported size; no partial snapshot returned');
 return {schemaVersion:1,source:'yifun-aftersales',customers,stores,requests,items:[...results[3].results,...internal].map(r=>{
  const p=JSON.parse(r.payload);return {id:r.id,request_id:r.request_id,version:r.version,updated_at:r.updated_at,payload:Object.fromEntries(fields.filter(k=>typeof p[k]==='string').map(k=>[k,p[k]]))};
 })};
}
