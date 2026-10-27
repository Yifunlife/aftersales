import {digest,passwordHash,sessionUser} from './accounts.mjs';
const cookie='__Host-yifun_customer',life=8*3600000;
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function originGuard(request){const u=new URL(request.url);if(request.method!=='GET'&&((request.headers.get('origin')&&request.headers.get('origin')!==u.origin)||request.headers.get('sec-fetch-site')==='cross-site'))throw fail('请从本站页面提交。',403)}
export async function readJson(request,max=80000){if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('请使用本站表单。',415);const s=await request.text();if(s.length>max)throw fail('内容过长。',413);try{return JSON.parse(s)}catch{throw fail('提交格式错误。')}}
export const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>v.toString(16).padStart(2,'0')).join('');
function password(value){if(typeof value!=='string'||value.length<8||value.length>128)throw fail('密码请填写8至128位。');return value}
function username(value){const v=String(value||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._@-]{2,79}$/.test(v))throw fail('登录账号使用3至80位英文字母、数字、点、短横线或邮箱。');return v}
const profile=a=>({id:a.id,customerId:a.customer_id,username:a.username,company:a.company,active:!!a.active,mustChange:!!a.must_change,version:a.version});
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
export async function customerSession(request,db){const raw=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1);if(!/^[a-f0-9]{64}$/.test(raw||''))return null;return db.prepare('SELECT a.*,p.company,s.token AS session_token FROM customer_accounts a JOIN customer_profiles p ON p.id=a.customer_id JOIN customer_sessions s ON s.account_id=a.id WHERE s.token=? AND s.expires>? AND a.active=1 AND a.version=s.version').bind(await digest(raw),Date.now()).first()}
export async function customerPrincipal(request,db,token){
 if(token){if(!/^[a-f0-9]{64}$/.test(token))throw fail('客户链接无效或已过期。',403);const inv=await db.prepare('SELECT * FROM customer_invites WHERE token_hash=? AND active=1 AND expires>?').bind(await digest(token),Date.now()).first();if(!inv)throw fail('客户链接无效或已过期。',403);return inv}
 const a=await customerSession(request,db);if(!a)throw fail('请登录客户账号。',401);if(a.must_change)throw fail('请先修改初始密码。',403);return {id:a.invite_id,customer_id:a.customer_id,accountId:a.id};
}
export async function staffAccess(request,db,write=false){const u=await sessionUser(request,db);if(!u||!u.active)throw fail('请登录员工账号。',401);if(u.must_change)throw fail('请先修改临时密码。',403);if(!(write?['管理员','售后专员']:['管理员','负责人','售后专员','审核人员']).includes(u.role))throw fail('当前岗位无权管理此内容。',403);return u}
async function newSession(db,a){const raw=random(32);await db.prepare('INSERT INTO customer_sessions(token,account_id,version,expires) VALUES(?,?,?,?)').bind(await digest(raw),a.id,a.version,Date.now()+life).run();return `${cookie}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`}
async function limit(db,key,max){const now=Date.now(),hash=await digest('customer-login:'+key);const row=await db.prepare('SELECT * FROM login_limits WHERE key=?').bind(hash).first();if(row&&row.until>now&&row.attempts>=max)throw fail('尝试较频繁，请15分钟后重试。',429);await db.prepare('INSERT INTO login_limits(key,attempts,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN until<? THEN 1 ELSE attempts+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END').bind(hash,now+900000,now,now).run();return hash}
async function audit(db,actor,target,action){await db.prepare('INSERT INTO account_audit(id,actor,target,action,at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,target,action,Date.now()).run()}
export async function handleCustomerAuth(request,{db}){try{originGuard(request);const path=new URL(request.url).pathname,method=request.method;
 if(path==='/api/customer-auth/status'&&method==='GET'){const a=await customerSession(request,db);return json({user:a?profile(a):null})}
 if(path==='/api/customer-auth/login'&&method==='POST'){
  const b=await readJson(request,4000),name=String(b.username||'').trim().toLowerCase();if(!name||name.length>80||typeof b.password!=='string'||b.password.length>128)throw fail('账号或密码不正确。',401);
  const ip=request.headers.get('cf-connecting-ip')||'unknown';await limit(db,'ip:'+ip,40);const key=await limit(db,'account:'+name,5);
  const a=await db.prepare('SELECT a.*,p.company FROM customer_accounts a JOIN customer_profiles p ON p.id=a.customer_id WHERE a.username=?').bind(name).first();const hash=await passwordHash(b.password,a?.salt||'0'.repeat(32));if(!a||!a.active||!equal(hash,a.hash))throw fail('账号或密码不正确。',401);
  await db.prepare('DELETE FROM login_limits WHERE key=?').bind(key).run();await db.prepare('DELETE FROM customer_sessions WHERE expires<?').bind(Date.now()).run();return json({user:profile(a)},200,{'Set-Cookie':await newSession(db,a)});
 }
 if(path==='/api/customer-auth/logout'&&method==='POST'){await readJson(request,1000);const a=await customerSession(request,db);if(a)await db.prepare('DELETE FROM customer_sessions WHERE token=?').bind(a.session_token).run();return json({ok:true},200,{'Set-Cookie':`${cookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`})}
 if(path==='/api/customer-auth/password'&&method==='POST'){
  const a=await customerSession(request,db);if(!a)throw fail('请重新登录客户账号。',401);const b=await readJson(request,4000);if(!equal(await passwordHash(String(b.currentPassword||''),a.salt),a.hash))throw fail('当前密码不正确。',403);const p=password(b.password);if(equal(await passwordHash(p,a.salt),a.hash))throw fail('新密码不能和当前密码相同。');
  const salt=random(16),hash=await passwordHash(p,salt);const result=await db.batch([db.prepare('UPDATE customer_accounts SET hash=?,salt=?,must_change=0,version=version+1,updated_at=? WHERE id=? AND version=?').bind(hash,salt,Date.now(),a.id,a.version),db.prepare('DELETE FROM customer_sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM customer_accounts WHERE id=? AND version=? AND hash=?)').bind(a.id,a.id,a.version+1,hash)]);if(!result[0].meta.changes)throw fail('账号已被更新，请重新登录。',409);const next=await db.prepare('SELECT a.*,p.company FROM customer_accounts a JOIN customer_profiles p ON p.id=a.customer_id WHERE a.id=?').bind(a.id).first();return json({user:profile(next)},200,{'Set-Cookie':await newSession(db,next)});
 }
 if(path==='/api/customer-accounts'&&method==='GET'){
  await staffAccess(request,db);const cid=new URL(request.url).searchParams.get('customerId');if(!cid)throw fail('请选择客户。');const rows=(await db.prepare('SELECT a.id,a.customer_id,a.username,a.active,a.must_change,a.version,p.company FROM customer_accounts a JOIN customer_profiles p ON p.id=a.customer_id WHERE a.customer_id=? ORDER BY a.created_at').bind(cid).all()).results;return json({accounts:rows.map(profile)});
 }
 if(path==='/api/customer-accounts'&&method==='POST'){
  const u=await staffAccess(request,db,true),b=await readJson(request,5000),now=Date.now();
  if(b.op==='create'){
   const customer=await db.prepare('SELECT id FROM customer_profiles WHERE id=?').bind(b.customerId).first();if(!customer)throw fail('请先保存客户档案。');const name=username(b.username),salt=random(16),hash=await passwordHash(password(b.password),salt);if(await db.prepare('SELECT id FROM customer_accounts WHERE username=?').bind(name).first())throw fail('该登录账号已被使用。',409);
   if(await db.prepare('SELECT id FROM employees WHERE employee_id=? OR email=?').bind(name,name).first())throw fail('该账号已被员工使用，请更换客户账号。',409);
   const id=crypto.randomUUID(),iid=crypto.randomUUID();try{await db.batch([db.prepare('INSERT INTO customer_invites(id,customer_id,token_hash,active,expires,created_by,created_at) VALUES(?,?,?,1,?,?,?)').bind(iid,customer.id,await digest(random(32)),now+3650*86400000,u.id,now),db.prepare('INSERT INTO customer_accounts(id,customer_id,invite_id,username,hash,salt,active,must_change,version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,1,1,1,?,?,?)').bind(id,customer.id,iid,name,hash,salt,u.id,now,now)])}catch(e){if(/UNIQUE/i.test(e.message||''))throw fail('该登录账号已被使用。',409);throw e}await audit(db,u.id,id,'建立客户登录账号');return json({id},201);
  }
  if(!['update','reset','delete'].includes(b.op))throw fail('操作不存在。',404);const a=await db.prepare('SELECT * FROM customer_accounts WHERE id=?').bind(b.id).first();if(!a)throw fail('客户账号不存在。',404);if(a.version!==b.version)throw fail('账号已被更新，请刷新后再操作。',409);
  if(b.op==='delete'){
   const result=await db.batch([db.prepare('UPDATE customer_invites SET active=0 WHERE id=? AND EXISTS(SELECT 1 FROM customer_accounts WHERE id=? AND version=?)').bind(a.invite_id,a.id,a.version),db.prepare('DELETE FROM customer_accounts WHERE id=? AND version=?').bind(a.id,a.version)]);
   if(!result[1].meta.changes)throw fail('账号已被更新，请刷新。',409);
   await audit(db,u.id,a.id,'删除客户登录账号');return json({ok:true});
  }
  const salt=b.op==='reset'?random(16):a.salt,hash=b.op==='reset'?await passwordHash(password(b.password),salt):a.hash,name=b.op==='update'?username(b.username):a.username,active=b.op==='update'?(b.active===true?1:0):a.active;
  if(await db.prepare('SELECT id FROM customer_accounts WHERE username=? AND id<>?').bind(name,a.id).first())throw fail('该登录账号已被使用。',409);
  if(await db.prepare('SELECT id FROM employees WHERE employee_id=? OR email=?').bind(name,name).first())throw fail('该账号已被员工使用，请更换客户账号。',409);
  const result=await db.batch([db.prepare('UPDATE customer_accounts SET username=?,active=?,hash=?,salt=?,must_change=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(name,active,hash,salt,b.op==='reset'?1:a.must_change,now,a.id,a.version),db.prepare('DELETE FROM customer_sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM customer_accounts WHERE id=? AND version=?)').bind(a.id,a.id,a.version+1)]);if(!result[0].meta.changes)throw fail('账号已被更新，请刷新。',409);await audit(db,u.id,a.id,b.op==='reset'?'重置客户初始密码':'更新客户账号状态');return json({ok:true});
 }
 throw fail('接口不存在。',404);
 }catch(e){return json({error:e.status?e.message:'操作暂未成功，请稍后重试。'},e.status||500)}}
