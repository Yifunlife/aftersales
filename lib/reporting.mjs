// Internal reporting projection: no account credentials, invite tokens or file bytes.
const fields=['id','workNo','product','issue','reported','delivered','planned','actual','stage','owner','trackingOwner','sales','designer','engineer','installer','method','grade','cost','cause','issueType','country','contractDeadline','safetyLevel','executionMethod','costResponsibility'];
export async function reportingSnapshot(db){
 const results=await db.batch([
  db.prepare('SELECT id,market_id,company,country,sales_owner FROM customer_profiles ORDER BY id LIMIT 10001'),
  db.prepare('SELECT id,customer_id,market_id,name,order_no FROM customer_stores ORDER BY id LIMIT 10001'),
  db.prepare('SELECT id,customer_id,store_id,status,submitted_at FROM customer_requests ORDER BY id LIMIT 10001'),
  db.prepare('SELECT id,request_id,payload,version,updated_at FROM customer_work_items ORDER BY id LIMIT 10001')
 ]);
 if(results.some(r=>r.results.length>10000))throw new Error('Reporting snapshot exceeds supported size; no partial snapshot returned');
 return {schemaVersion:1,source:'yifun-aftersales',customers:results[0].results,stores:results[1].results,requests:results[2].results,items:results[3].results.map(r=>{
  const p=JSON.parse(r.payload);return {id:r.id,request_id:r.request_id,version:r.version,updated_at:r.updated_at,payload:Object.fromEntries(fields.filter(k=>typeof p[k]==='string').map(k=>[k,p[k]]))};
 })};
}
