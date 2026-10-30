import {sessionUser} from './accounts.mjs';
import {stageRoles} from './work-policy.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const stages=Object.keys(stageRoles).filter(s=>s!=='登记草稿');
export function notificationStatement(db,row,clean,actor,version){
 const old=row.payload?JSON.parse(row.payload):{};
 if(clean.stage==='登记草稿'||old.stage===clean.stage&&old.owner===clean.owner)return null;
 if(!['staff_work_items','customer_work_items'].includes(row.table))throw Error('Invalid work source');
 return db.prepare(`INSERT OR IGNORE INTO work_notifications(id,work_id,work_table,work_version,stage,owner,actor,work_no,status,next_at,created_at,snapshot) SELECT ?,?,?,?,?,?,?,?,CASE WHEN (SELECT enabled FROM notification_settings WHERE id='wecom')=1 THEN 'pending' ELSE 'paused' END,?,?,? WHERE EXISTS(SELECT 1 FROM ${row.table} WHERE id=? AND version=? AND updated_by=? AND json_extract(payload,'$.stage')=? AND json_extract(payload,'$.owner')=?)`).bind(crypto.randomUUID(),row.id,row.table,version,clean.stage,clean.owner||'',actor.id,clean.workNo||row.id,Date.now(),Date.now(),JSON.stringify({customer:clean.customer,project:clean.project,product:clean.product,issue:clean.issue,trackingOwner:clean.trackingOwner,owner:clean.owner,planned:clean.planned,from:old.stage||'登记',stage:clean.stage,result:clean.operationResult&&clean.operationResult.stage===old.stage?clean.operationResult.result:old.stage==='审核'?clean.review?.method:'请进入系统查看处理记录',actor:actor.name}),row.id,version,actor.id,clean.stage,clean.owner||'');
}
const configured=c=>!!(c?.corpId&&c?.agentId&&c?.secret);
function eligible(person,stage){return person.active===1&&(person.role==='管理员'||stageRoles[stage]?.includes(person.role))}
export async function notificationRecipients(db,job,payload){
 const members=(await db.prepare('SELECT e.id,e.name,e.role,e.active,m.wecom_userid FROM employees e LEFT JOIN notification_members m ON m.employee_id=e.id').all()).results;
 const exact=members.filter(e=>e.name===payload.owner&&e.active===1);
 if(exact.length>1)return {error:'负责人姓名对应多个账号，请管理员核实。'};
 if(exact.length===1&&!eligible(exact[0],payload.stage))return {error:'负责人账号不具备当前环节处理权限。'};
 if(exact.length===1)return exact[0].wecom_userid?{users:[exact[0].wecom_userid]}:{error:'负责人尚未绑定企业微信账号。'};
 // Department queues use explicitly configured recipients, never all staff or guessed accounts.
 if(!['待仓库接单','待部门分派','生产部','工厂','仓库','工程部','采购部','售后部'].includes(payload.owner))return {error:'负责人未对应到有效员工，请先核实负责人姓名。'};
 const routes=(await db.prepare('SELECT employee_id FROM notification_routes WHERE stage=?').bind(payload.stage).all()).results;
 const targets=members.filter(e=>routes.some(r=>r.employee_id===e.id)&&eligible(e,payload.stage));
 if(!targets.length||targets.some(e=>!e.wecom_userid))return {error:'该环节尚未配置有效的企业微信接单人。'};
 return {users:targets.map(e=>e.wecom_userid)};
}
let tokenCache=null;
async function token(config,fetcher,force=false){
 if(!force&&tokenCache?.key===config.corpId+':'+config.secret&&tokenCache.until>Date.now())return tokenCache.value;
 const u=new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken');u.searchParams.set('corpid',config.corpId);u.searchParams.set('corpsecret',config.secret);
 const r=await fetcher(u,{signal:AbortSignal.timeout(8000)}),b=await r.json();if(!r.ok||b.errcode||!b.access_token)throw fail('企业微信鉴权失败（代码 '+String(b.errcode||r.status)+'），请检查应用配置与可信IP。');
 tokenCache={key:config.corpId+':'+config.secret,value:b.access_token,until:Date.now()+Math.max(0,(Number(b.expires_in)||7200)-300)*1000};return b.access_token;
}
export async function sendWorkNotification(config,users,job,fetcher=fetch){
 const url=new URL('/workspace',config.publicUrl||'https://aftersales.shyiwan.com');url.searchParams.set('notification',job.id);
 const a=job.summary;
 const content=job.reminder?`【售后超时提醒｜24小时未处理】\n工单：${job.work_no}\n当前环节：${job.stage}\n接收人：${a.owner||'待部门接单'}\n售后跟进人：${a.trackingOwner||'待确认'}\n交接已满24小时，尚未发现接收人的处理记录，请及时处理或协调。\n查看工单与处理照片：\n${url.href}`:a?`【${job.audience==='tracking'?'售后进度更新｜你登记的工单':job.audience==='both'?'售后进度与待办':'售后待办｜请处理'}】\n工单：${job.work_no}\n客户／项目：${String(a.customer||'').slice(0,80)}／${String(a.project||'').slice(0,80)}\n产品／问题：${String(a.product||'').slice(0,80)}／${String(a.issue||'').slice(0,160)}\n本次流转：${a.from||'上一环节'} → ${job.stage}\n本次处理人：${a.actor}\n当前对接人：${a.owner||'待分派'}\n计划完成：${a.planned||'待安排'}\n处理方案或记录：${String(a.result||'请进入系统查看本环节记录').slice(0,200)}\n售后跟进人：${a.trackingOwner}（知悉进度，无需重复确认）\n${job.stage==='已关闭'?'工单已关闭。':job.audience==='tracking'?'本次为进度通知，无需重复确认。':'当前接收人请进入系统处理。'}\n查看工单与处理照片：\n${url.href}`:`售后工单待处理\n工单：${job.work_no}\n当前环节：${job.stage}\n请登录查看并处理：\n${url.href}`;
 for(let attempt=0;attempt<2;attempt++){
  const access=await token(config,fetcher,attempt===1),u=new URL('https://qyapi.weixin.qq.com/cgi-bin/message/send');u.searchParams.set('access_token',access);
  const r=await fetcher(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({touser:users.join('|'),msgtype:'text',agentid:Number(config.agentId),text:{content},safe:0,enable_duplicate_check:1,duplicate_check_interval:1800}),signal:AbortSignal.timeout(8000)}),b=await r.json();
  if([40014,42001].includes(b.errcode)&&attempt===0)continue;
  if(!r.ok||b.errcode||b.invaliduser||b.unlicenseduser)throw fail('企业微信发送未全部成功（代码 '+String(b.errcode||r.status)+'），请核实成员账号、应用可见范围及许可。');
  return String(b.msgid||'');
 }
 throw fail('企业微信令牌失效，请稍后重试。');
}
export async function drainNotifications(db,config,{fetcher=fetch,limit=10}={}){
 if(!configured(config)||!(await db.prepare("SELECT enabled FROM notification_settings WHERE id='wecom'").first())?.enabled)return {enabled:false};
 const now=Date.now(),jobs=(await db.prepare("SELECT * FROM work_notifications WHERE (status IN ('pending','retry') AND next_at<=?) OR (status='sending' AND lease_until<?) ORDER BY created_at LIMIT ?").bind(now,now,limit).all()).results;
 let sent=0;
 for(const job of jobs){
  const lease=crypto.randomUUID(),lock=await db.prepare("UPDATE work_notifications SET status='sending',lease_until=?,lease_token=?,attempts=attempts+1 WHERE id=? AND ((status IN ('pending','retry') AND next_at<=?) OR (status='sending' AND lease_until<?))").bind(Date.now()+120000,lease,job.id,now,now).run();if(!lock.meta.changes)continue;
  const finish=(status,detail='',msgid=null)=>db.prepare('UPDATE work_notifications SET status=?,detail=?,msgid=?,sent_at=?,next_at=?,lease_until=0 WHERE id=? AND lease_token=?').bind(status,detail,msgid,status==='sent'?Date.now():null,Date.now()+Math.min(3600000,60000*2**Math.min(job.attempts,6)),job.id,lease).run();
  try{
   if(!['staff_work_items','customer_work_items'].includes(job.work_table)){await finish('cancelled','工单来源无效。');continue}
   const row=await db.prepare(`SELECT payload FROM ${job.work_table} WHERE id=?`).bind(job.work_id).first(),p=row?JSON.parse(row.payload):null;
   const snapshot=job.snapshot?JSON.parse(job.snapshot):null;
   const newer=await db.prepare('SELECT id FROM work_notifications WHERE work_id=? AND work_version>? LIMIT 1').bind(job.work_id,job.work_version).first();
   if(!p){await finish('cancelled','工单已不存在。');continue}
   const current=!newer&&p.stage===job.stage&&p.owner===job.owner;
   const next=job.stage==='已关闭'||!current?{users:[]}:await notificationRecipients(db,job,p);
   const source=snapshot||p;
   const followers=(await db.prepare('SELECT e.name,m.wecom_userid FROM employees e LEFT JOIN notification_members m ON e.id=m.employee_id WHERE e.active=1 AND e.name=?').bind(source.trackingOwner||'').all()).results;
   const follower=followers.length===1?followers[0].wecom_userid:null;
   const users=[...new Set([...(next.users||[]),...(follower?[follower]:[])])];
   const problems=[next.error,...(!follower?['售后跟进人未唯一绑定企业微信账号。']:[])].filter(Boolean);
   job.summary=snapshot||{customer:p.customer,project:p.project,product:p.product,issue:p.issue,trackingOwner:p.trackingOwner,owner:p.owner,planned:p.planned,result:p.operationResult?.result||p.review?.method||'',actor:(await db.prepare('SELECT name FROM employees WHERE id=?').bind(job.actor).first())?.name||'工作人员'};
   let lastMsg=null;
   for(const userid of users){
    if(await db.prepare('SELECT job_id FROM notification_deliveries WHERE job_id=? AND userid=?').bind(job.id,userid).first())continue;
    job.audience=userid===follower?(next.users||[]).includes(userid)?'both':'tracking':'receiver';
    lastMsg=await sendWorkNotification(config,[userid],job,fetcher);
    await db.prepare('INSERT OR IGNORE INTO notification_deliveries VALUES(?,?,?,?)').bind(job.id,userid,Date.now(),lastMsg).run();
   }
   await finish(problems.length?'blocked':'sent',problems.length?problems.join('；')+' 已成功的收件人不会重复发送。':'企业微信已接受；不代表员工已读或接单。',lastMsg);if(!problems.length)sent++;
  }catch(e){await finish(job.attempts>=5?'failed':'retry',e.status?e.message:'网络暂时不可用，系统将重试。')}
 }
 await remindUnprocessed(db,config,fetcher);
 return {enabled:true,processed:jobs.length,sent};
}
export async function remindUnprocessed(db,config,fetcher=fetch){
 const jobs=(await db.prepare("SELECT * FROM work_notifications WHERE reminded_at IS NULL AND created_at<=? AND status NOT IN ('paused','cancelled') AND stage<>'已关闭' ORDER BY created_at LIMIT 20").bind(Date.now()-86400000).all()).results;
 for(const job of jobs){
  if(!['staff_work_items','customer_work_items'].includes(job.work_table))continue;
  const row=await db.prepare(`SELECT * FROM ${job.work_table} WHERE id=?`).bind(job.work_id).first(),p=row?JSON.parse(row.payload):null;
  const newer=await db.prepare('SELECT id FROM work_notifications WHERE work_id=? AND work_version>? LIMIT 1').bind(job.work_id,job.work_version).first();
  const done=()=>db.prepare('UPDATE work_notifications SET reminded_at=? WHERE id=?').bind(Date.now(),job.id).run();
  if(!p||newer||p.stage!==job.stage||p.owner!==job.owner){await done();continue}
  const recipients=await notificationRecipients(db,job,p);
  const followerRows=(await db.prepare('SELECT m.wecom_userid FROM employees e LEFT JOIN notification_members m ON m.employee_id=e.id WHERE e.active=1 AND e.name=?').bind(p.trackingOwner||'').all()).results;
  const follower=followerRows.length===1?followerRows[0].wecom_userid:null;
  // A later save by a designated receiver counts as having started handling this handoff.
  const actor=await db.prepare('SELECT e.name,m.wecom_userid FROM employees e LEFT JOIN notification_members m ON m.employee_id=e.id WHERE e.id=?').bind(row.updated_by).first();
  if(row.version>job.work_version&&actor&&(actor.name===p.owner||(recipients.users||[]).includes(actor.wecom_userid))){await done();continue}
  const users=[...new Set([...(recipients.users||[]),...(follower?[follower]:[])])];
  let failed=false;
  for(const userid of users){const key=job.id+':24h';if(await db.prepare('SELECT job_id FROM notification_deliveries WHERE job_id=? AND userid=?').bind(key,userid).first())continue;
   try{const msg=await sendWorkNotification(config,[userid],{...job,reminder:true,summary:{owner:p.owner,trackingOwner:p.trackingOwner}},fetcher);await db.prepare('INSERT OR IGNORE INTO notification_deliveries VALUES(?,?,?,?)').bind(key,userid,Date.now(),msg).run()}catch{failed=true}
  }
  if(!failed&&!recipients.error&&follower)await done();
 }
}
export async function handleNotifications(request,{db,config,jobSecret}){try{
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/notifications\/?/,''),method=request.method;
 if(path==='run'){
  if(method!=='POST'||!jobSecret||request.headers.get('x-yifun-job-key')!==jobSecret)return json({error:'Not found'},404);
  return json(await drainNotifications(db,config));
 }
 const user=await sessionUser(request,db);if(!user||!user.active)throw fail('请先登录。',401);if(user.must_change)throw fail('请先修改临时密码。',403);
 if(method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))throw fail('请从本站页面提交。',403);
 if(path.startsWith('open/')&&method==='GET'){
  const job=await db.prepare('SELECT * FROM work_notifications WHERE id=?').bind(path.slice(5)).first();if(!job)throw fail('提醒不存在。',404);
  if(!['staff_work_items','customer_work_items'].includes(job.work_table))throw fail('提醒不存在。',404);
  const row=await db.prepare(`SELECT payload FROM ${job.work_table} WHERE id=?`).bind(job.work_id).first();if(!row)throw fail('工单不存在。',404);const p=JSON.parse(row.payload);
  if(!['管理员','负责人'].includes(user.role)&&!stageRoles[p.stage]?.includes(user.role)&&!(user.role==='售后专员'&&p.trackingOwner===user.name))throw fail('当前岗位不能处理此工单。',403);
  return json({workId:job.work_id,stage:p.stage});
 }
 if(user.role!=='管理员')throw fail('仅管理员可以管理交接提醒。',403);
 if(path===''&&method==='GET')return json({configured:configured(config),enabled:!!(await db.prepare("SELECT enabled FROM notification_settings WHERE id='wecom'").first())?.enabled,stages,stageRoles,employees:(await db.prepare('SELECT e.id,e.employee_id,e.name,e.role,e.active,m.wecom_userid FROM employees e LEFT JOIN notification_members m ON e.id=m.employee_id ORDER BY e.role,e.name').all()).results,routes:(await db.prepare('SELECT * FROM notification_routes').all()).results,jobs:(await db.prepare('SELECT id,work_no,stage,owner,status,detail,attempts,created_at,sent_at FROM work_notifications ORDER BY created_at DESC LIMIT 100').all()).results});
 const raw=await request.text();if(raw.length>20000)throw fail('内容过长。',413);let b;try{b=JSON.parse(raw)}catch{throw fail('提交格式错误。')}
 if(path==='settings'&&method==='POST'){
  if(b.enabled===true&&!configured(config))throw fail('请先完成服务器端企业微信应用配置。');
  await db.batch([db.prepare("UPDATE notification_settings SET enabled=?,updated_at=? WHERE id='wecom'").bind(b.enabled===true?1:0,Date.now()),db.prepare('INSERT INTO account_audit(id,actor,target,action,at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,'wecom',b.enabled===true?'启用企业微信交接提醒':'暂停企业微信交接提醒',Date.now())]);return json({ok:true});
 }
 if(path==='member'&&method==='POST'){
  const target=await db.prepare('SELECT id FROM employees WHERE id=? AND active=1').bind(b.employeeId).first();if(!target)throw fail('请选择启用的员工。');const userid=String(b.userid||'').trim();if(!/^[a-zA-Z0-9_@.\-]{1,64}$/.test(userid))throw fail('请填写企业微信通讯录里的成员账号，不能填写手机号或昵称。');
  const conflict=await db.prepare('SELECT employee_id FROM notification_members WHERE wecom_userid=? AND employee_id<>?').bind(userid,target.id).first();if(conflict)throw fail('该企业微信账号已绑定另一位员工。',409);
  await db.batch([db.prepare('INSERT INTO notification_members(employee_id,wecom_userid,updated_at) VALUES(?,?,?) ON CONFLICT(employee_id) DO UPDATE SET wecom_userid=excluded.wecom_userid,updated_at=excluded.updated_at').bind(target.id,userid,Date.now()),db.prepare('INSERT INTO account_audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,target.id,'绑定企业微信通知账号',Date.now())]);return json({ok:true});
 }
 if(path==='route'&&method==='POST'){
  if(!stages.includes(b.stage)||!Array.isArray(b.employeeIds)||b.employeeIds.length>20)throw fail('请选择有效环节和最多20位接单人。');
  for(const id of new Set(b.employeeIds)){const e=await db.prepare('SELECT e.*,m.wecom_userid FROM employees e LEFT JOIN notification_members m ON e.id=m.employee_id WHERE e.id=?').bind(id).first();if(!e||!eligible(e,b.stage)||!e.wecom_userid)throw fail('接单人需要启用、绑定企业微信并具备该环节处理权限。');}
  await db.batch([db.prepare('DELETE FROM notification_routes WHERE stage=?').bind(b.stage),...[...new Set(b.employeeIds)].map(id=>db.prepare('INSERT INTO notification_routes VALUES(?,?)').bind(b.stage,id)),db.prepare('INSERT INTO account_audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,b.stage,'更新企业微信环节接单人',Date.now())]);return json({ok:true});
 }
 if(path==='retry'&&method==='POST'){
  if(!configured(config))throw fail('企业微信尚未配置。');
  await db.prepare("UPDATE work_notifications SET status='pending',attempts=0,next_at=? WHERE id=? AND status IN ('blocked','failed','paused')").bind(Date.now(),b.id).run();return json({ok:true});
 }
 throw fail('入口不存在。',404);
 }catch(e){return json({error:e.status?e.message:'通知服务暂时不可用，请稍后重试。'},e.status||500)}}
