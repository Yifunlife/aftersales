export const roles=['管理员','负责人','售后专员','审核人员','工程人员','采购人员','生产人员','仓库人员','安装人员','财务人员'];
const cookieName='__Host-yifun_session', lifetime=8*3600*1000;
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const fromHex=s=>Uint8Array.from(s.match(/../g)||[],v=>parseInt(v,16));
export async function digest(v){return hex(await crypto.subtle.digest('SHA-256',enc.encode(v)));}
export async function passwordHash(password,salt){const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromHex(salt),iterations:100000},k,256));}
function equal(a,b){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
const profile=u=>({id:u.id,employeeId:u.employee_id,email:u.email,name:u.name,role:u.role,active:!!u.active,mustChange:!!u.must_change,createdAt:u.created_at});
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function validPassword(p){if(typeof p!=='string'||p.length<10||p.length>128)throw fail('密码请填写 10–128 位，建议使用字母、数字和符号。');return p;}
async function customerNameGuard(db,f){for(const name of [f.employeeId,f.email].filter(Boolean))if(await db.prepare('SELECT id FROM customer_accounts WHERE username=?').bind(name).first())throw fail('该账号已被客户使用，请更换工号或邮箱。',409);}
function fields(b){const employeeId=String(b.employeeId||'').trim().toLowerCase(),email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim(),role=b.role;
if(!employeeId&&!email)throw fail('工号或邮箱至少填写一项。');
if(employeeId&&!/^[a-z0-9_-]{2,32}$/.test(employeeId))throw fail('工号请使用 2–32 位字母、数字、短横线或下划线。');
if(email&&(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)))throw fail('请填写有效邮箱。');
if(!name||name.length>60||!roles.includes(role))throw fail('请填写姓名并选择有效岗位。');return {employeeId:employeeId||null,email:email||null,name,role};}
export async function sessionUser(request,db){const raw=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;
return db.prepare('SELECT e.*, s.token AS session_token FROM sessions s JOIN employees e ON e.id=s.user_id WHERE s.token=? AND s.expires>? AND e.active=1 AND e.version=s.version').bind(await digest(raw),Date.now()).first();}
async function newSession(db,u){const raw=random(32);await db.prepare('INSERT INTO sessions(token,user_id,version,expires) VALUES(?,?,?,?)').bind(await digest(raw),u.id,u.version,Date.now()+lifetime).run();return `${cookieName}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;}
async function record(db,actor,target,action){await db.prepare('INSERT INTO account_audit(id,actor,target,action,at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,target,action,Date.now()).run();}
async function body(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('请使用本站表单操作。',415);const t=await request.text();if(t.length>16000)throw fail('提交内容过长。',413);try{return JSON.parse(t);}catch{throw fail('提交内容格式错误。');}}
export async function handleAccounts(request,{db,ownerEmail,identity,initialAdmin}){try{
const path=new URL(request.url).pathname.replace(/^\/api\//,''),method=request.method;
if(method!=='GET'){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw fail('请从本站页面提交。',403);}
let setupRequired=!(await db.prepare('SELECT id FROM employees LIMIT 1').first());
// Deployment-only bootstrap: values come from secret runtime configuration, never request input.
if(setupRequired && initialAdmin && /^[a-f0-9]{64}$/.test(initialAdmin.hash||'') && /^[a-f0-9]{32}$/.test(initialAdmin.salt||'') && ownerEmail){
const id=crypto.randomUUID(),now=Date.now();
const result=await db.prepare('INSERT INTO employees(id,employee_id,email,name,role,active,must_change,hash,salt,version,created_at,updated_at) SELECT ?,?,?,?,?,1,0,?,?,1,?,? WHERE NOT EXISTS(SELECT 1 FROM employees)').bind(id,null,ownerEmail.toLowerCase(),'系统管理员','管理员',initialAdmin.hash,initialAdmin.salt,now,now).run();
if(result.meta.changes)await record(db,id,id,'后台开通管理员');
}
setupRequired=!(await db.prepare('SELECT id FROM employees LIMIT 1').first());
const ownerAllowed=!!ownerEmail&&!!identity?.userId&&identity.email.toLowerCase()===ownerEmail.toLowerCase();
let u=await sessionUser(request,db);
if(path==='auth/status'&&method==='GET')return json({user:u?profile(u):null,setupRequired,ownerSetupAllowed:ownerAllowed,roles});
if(path==='auth/bootstrap'&&method==='POST'){
if(!setupRequired)throw fail('管理员已建立，请登录。',409);if(!ownerAllowed)throw fail('请先验证站点所有者身份。',403);
const b=await body(request),identifier=String(b.employeeId||'').trim().toLowerCase();
if(identifier.includes('@')&&identifier!==ownerEmail.toLowerCase())throw fail('请填写已验证的管理员邮箱，或使用工号开通。');
const f=fields({...b,employeeId:identifier.includes('@')?null:identifier,email:identifier.includes('@')?identifier:null,role:'管理员'}),salt=random(16),hash=await passwordHash(validPassword(b.password),salt),id=crypto.randomUUID(),now=Date.now();
const r=await db.prepare('INSERT INTO employees(id,employee_id,email,name,role,active,must_change,hash,salt,version,created_at,updated_at) SELECT ?,?,?,?,?,1,0,?,?,1,?,? WHERE NOT EXISTS(SELECT 1 FROM employees)').bind(id,f.employeeId,f.email,f.name,f.role,hash,salt,now,now).run();if(!r.meta.changes)throw fail('管理员已建立，请登录。',409);
u=await db.prepare('SELECT * FROM employees WHERE id=?').bind(id).first();await record(db,id,id,'建立管理员');return json({user:profile(u)},201,{'Set-Cookie':await newSession(db,u)});}
if(path==='auth/login'&&method==='POST'){
const b=await body(request),identifier=String(b.identifier||'').trim().toLowerCase();if(!identifier||identifier.length>254||typeof b.password!=='string'||b.password.length>128)throw fail('请填写工号或邮箱及密码。');
const now=Date.now(),ip=request.headers.get('cf-connecting-ip')||'unknown',keys=[await digest('login:'+ip+':'+identifier),await digest('ip:'+ip)];
for(let i=0;i<keys.length;i++){const row=await db.prepare('SELECT * FROM login_limits WHERE key=?').bind(keys[i]).first();if(row&&row.until>now&&row.attempts>=(i?40:5))throw fail('尝试次数过多，请 15 分钟后重试。',429);}
for(const key of keys)await db.prepare('INSERT INTO login_limits(key,attempts,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN until<? THEN 1 ELSE attempts+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END').bind(key,now+900000,now,now).run();
u=await db.prepare('SELECT * FROM employees WHERE employee_id=? OR email=?').bind(identifier,identifier).first();
const check=await passwordHash(b.password,u?.salt||'0'.repeat(32));if(!u||!u.active||!equal(check,u.hash))throw fail('工号、邮箱或密码不正确，或账号已停用。',401);
await db.prepare('DELETE FROM login_limits WHERE key=?').bind(keys[0]).run();await db.prepare('DELETE FROM sessions WHERE expires<?').bind(now).run();return json({user:profile(u)},200,{'Set-Cookie':await newSession(db,u)});}
if(!u)throw fail('请先登录。',401);
if(path==='auth/logout'&&method==='POST'){await body(request);await db.prepare('DELETE FROM sessions WHERE token=?').bind(u.session_token).run();return json({ok:true},200,{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});}
if(path==='auth/password'&&method==='POST'){const b=await body(request);if(!equal(await passwordHash(String(b.currentPassword||''),u.salt),u.hash))throw fail('当前密码不正确。',401);const p=validPassword(b.password);if(equal(await passwordHash(p,u.salt),u.hash))throw fail('新密码不能和当前密码相同。');const salt=random(16),hash=await passwordHash(p,salt);await db.batch([db.prepare('UPDATE employees SET hash=?,salt=?,must_change=0,version=version+1,updated_at=? WHERE id=? AND version=?').bind(hash,salt,Date.now(),u.id,u.version),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id)]);const next=await db.prepare('SELECT * FROM employees WHERE id=?').bind(u.id).first();if(next.version!==u.version+1)throw fail('密码已被更改，请重新登录。',409);await record(db,u.id,u.id,'修改密码');return json({user:profile(next)},200,{'Set-Cookie':await newSession(db,next)});}
if(u.must_change)throw fail('请先修改临时密码。',403);
if(u.role!=='管理员')throw fail('仅管理员可以管理员工账号。',403);
if(path==='employees'&&method==='GET'){const r=await db.prepare('SELECT * FROM employees ORDER BY created_at').all();return json({employees:r.results.map(profile)});}
if(path==='audit'&&method==='GET'){const r=await db.prepare('SELECT a.action,a.at,e.name AS actor,t.name AS target FROM account_audit a LEFT JOIN employees e ON e.id=a.actor LEFT JOIN employees t ON t.id=a.target ORDER BY a.at DESC LIMIT 50').all();return json({events:r.results});}
if(path==='employees'&&method==='POST'){const b=await body(request),f=fields(b),salt=random(16),hash=await passwordHash(validPassword(b.password),salt),id=crypto.randomUUID(),now=Date.now();await customerNameGuard(db,f);await db.prepare('INSERT INTO employees(id,employee_id,email,name,role,active,must_change,hash,salt,version,created_at,updated_at) VALUES(?,?,?,?,?,1,1,?,?,1,?,?)').bind(id,f.employeeId,f.email,f.name,f.role,hash,salt,now,now).run();await record(db,u.id,id,'创建员工账号');return json({ok:true},201);}
const match=path.match(/^employees\/([a-f0-9-]+)(\/reset)?$/);if(match&&method==='POST'){const target=await db.prepare('SELECT * FROM employees WHERE id=?').bind(match[1]).first();if(!target)throw fail('员工不存在。',404);const b=await body(request);
if(match[2]){const salt=random(16),hash=await passwordHash(validPassword(b.password),salt);await db.batch([db.prepare('UPDATE employees SET hash=?,salt=?,must_change=1,version=version+1,updated_at=? WHERE id=?').bind(hash,salt,Date.now(),target.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(target.id)]);await record(db,u.id,target.id,'重置临时密码');}
else{const f=fields(b),active=b.active===true?1:0;await customerNameGuard(db,f);
const r=await db.prepare("UPDATE employees SET employee_id=?,email=?,name=?,role=?,active=?,version=version+1,updated_at=? WHERE id=? AND NOT(role='管理员' AND active=1 AND (?<>'管理员' OR ?=0) AND (SELECT COUNT(*) FROM employees WHERE role='管理员' AND active=1)<=1)").bind(f.employeeId,f.email,f.name,f.role,active,Date.now(),target.id,f.role,active).run();if(!r.meta.changes)throw fail('至少保留一位启用的管理员。',409);await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(target.id).run();await record(db,u.id,target.id,active?'更新员工及权限':'停用员工');}
return json({ok:true});}
throw fail('接口不存在。',404);
}catch(e){if(/UNIQUE constraint/i.test(String(e)))return json({error:'工号或邮箱已存在。'},409);if(e.status)return json({error:e.message},e.status);console.error('Account service error',e?.name);return json({error:'服务暂时不可用，请稍后重试。'},500);}}
