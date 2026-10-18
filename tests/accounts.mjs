import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {handleAccounts,sessionUser,passwordHash} from '../lib/accounts.mjs';
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
class Statement {
 constructor(sql,values=[]){this.sql=sql;this.values=values;}
 bind(...values){return new Statement(this.sql,values);}
 async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
 async all(){return {results:sqlite.prepare(this.sql).all(...this.values)};}
 async run(){return {meta:{changes:Number(sqlite.prepare(this.sql).run(...this.values).changes)}};}
}
const db={prepare(sql){return new Statement(sql)},async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const config={db,ownerEmail:'owner@example.test',identity:null};let cookie='';
async function call(path,data,{identity=null,session=cookie,origin='https://test.local',ip='127.0.0.1'}={}){const request=new Request('https://test.local/api/'+path,{method:data?'POST':'GET',headers:{cookie:session,origin,'cf-connecting-ip':ip,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const response=await handleAccounts(request,{...config,identity});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
const admin={name:'管理员',employeeId:'ADMIN01',password:'Fixture_admin_829!'};
assert.equal((await call('auth/status')).data.setupRequired,true);
assert.equal((await call('auth/bootstrap',admin)).status,403);
assert.equal((await call('auth/bootstrap',admin,{identity:{userId:'wrong',email:'wrong@example.test'}})).status,403);
let r=await call('auth/bootstrap',admin,{identity:{userId:'owner',email:'owner@example.test'}});assert.equal(r.status,201);cookie=r.cookie;const originalAdmin=cookie,adminId=r.data.user.id;
assert.equal((await call('auth/bootstrap',admin,{identity:{userId:'owner',email:'owner@example.test'}})).status,409);
assert.equal((await call('employees',{}, {origin:'https://evil.test'})).status,403);
assert.equal((await call('employees',{name:'采购甲',employeeId:'YW001',email:'buyer@example.test',role:'采购人员',password:'Fixture_buyer_829!'})).status,201);
assert.equal((await call('employees',{name:'重复',employeeId:'yw001',email:'other@example.test',role:'生产人员',password:'Fixture_buyer_829!'})).status,409);
let list=(await call('employees')).data.employees;assert.equal(list.length,2);assert(!JSON.stringify(list).includes('hash'));const buyer=list.find(u=>u.role==='采购人员');
r=await call('auth/login',{identifier:'BUYER@EXAMPLE.TEST',password:'Fixture_buyer_829!'});assert.equal(r.status,200);const temporary=r.cookie;
assert.equal((await call('employees',undefined,{session:temporary})).status,403);
r=await call('auth/password',{currentPassword:'Fixture_buyer_829!',password:'Fixture_newbuyer_9!'},{session:temporary});assert.equal(r.status,200);const buyerSession=r.cookie;assert.equal((await call('auth/status',undefined,{session:temporary})).data.user,null);
assert.equal((await call('employees',undefined,{session:buyerSession})).status,403);
assert.equal((await call('auth/status',undefined,{session:buyerSession})).data.user.mustChange,false);
assert.equal((await call('employees/'+adminId,{...list.find(u=>u.id===adminId),active:false})).status,409);
assert.equal((await call('employees/'+buyer.id,{...buyer,active:false})).status,200);assert.equal((await call('auth/status',undefined,{session:buyerSession})).data.user,null);
assert.equal((await call('auth/login',{identifier:'YW001',password:'Fixture_newbuyer_9!'})).status,401);
assert.equal((await call('employees/'+buyer.id,{...buyer,active:true})).status,200);
assert.equal((await call('employees/'+buyer.id+'/reset',{password:'Fixture_reset_829!'})).status,200);
assert.equal((await call('auth/login',{identifier:'yw001',password:'Fixture_newbuyer_9!'})).status,401);
r=await call('auth/login',{identifier:'YW001',password:'Fixture_reset_829!'});assert.equal(r.status,200);assert(r.data.user.mustChange);
for(let i=0;i<5;i++)assert.equal((await call('auth/login',{identifier:'missing',password:'bad'},{ip:'other'})).status,401);
assert.equal((await call('auth/login',{identifier:'missing',password:'bad'},{ip:'other'})).status,429);
assert.equal((await call('employees',undefined,{session:''})).status,401);
assert.equal((await call('auth/logout',{})).status,200);assert.equal((await call('auth/status',undefined,{session:originalAdmin})).data.user,null);
assert(sqlite.prepare('SELECT hash FROM employees').all().every(u=>/^[a-f0-9]{64}$/.test(u.hash)));
console.log('Passed: bootstrap identity, dual login, duplicate accounts, forced password change, session revocation, admin guards, deactivation, reset, CSRF, rate limits, no password disclosure, logout.');

// Isolated fresh database: trusted deployment configuration initializes once.
sqlite.exec('DELETE FROM account_audit; DELETE FROM sessions; DELETE FROM login_limits; DELETE FROM employees;');
const seedSalt='12'.repeat(16), seedHash=await passwordHash('TestConfiguredAdmin9!',seedSalt);
const seedConfig={...config,initialAdmin:{hash:seedHash,salt:seedSalt}};
let seeded=await handleAccounts(new Request('https://test.local/api/auth/status'),seedConfig);
assert.equal((await seeded.json()).setupRequired,false);
const stored=sqlite.prepare('SELECT * FROM employees').get();assert.equal(stored.email,'owner@example.test');assert.equal(stored.employee_id,null);assert.equal(stored.role,'管理员');
assert.equal((await call('auth/login',{identifier:'owner@example.test',password:'TestConfiguredAdmin9!'})).status,200);
await handleAccounts(new Request('https://test.local/api/auth/status'),{...seedConfig,initialAdmin:{hash:'ab'.repeat(32),salt:seedSalt}});
assert.equal(sqlite.prepare('SELECT hash FROM employees').get().hash,seedHash);
sqlite.exec('DELETE FROM account_audit; DELETE FROM sessions; DELETE FROM login_limits; DELETE FROM employees;');
assert.equal((await call('auth/bootstrap',{...admin,employeeId:'other@example.test'},{identity:{userId:'owner',email:'owner@example.test'}})).status,400);
assert.equal((await call('auth/bootstrap',{...admin,employeeId:'OWNER@EXAMPLE.TEST'},{identity:{userId:'owner',email:'owner@example.test'}})).status,201);
console.log('Passed: deployment admin provisioning is private and idempotent; verified email may open administrator account.');

cookie=(await call('auth/login',{identifier:'owner@example.test',password:admin.password})).cookie;
const pw='EmployeeFixture_19!';
for(const b of [{name:'邮箱甲',email:'emailonly@example.test'},{name:'邮箱乙',email:'emailtwo@example.test'},{name:'工号甲',employeeId:'ONLY001'},{name:'工号乙',employeeId:'ONLY002'}]){
 assert.equal((await call('employees',{...b,role:'生产人员',password:pw})).status,201);
 const identifier=b.email||b.employeeId;const login=await call('auth/login',{identifier,password:pw});assert.equal(login.status,200);
 assert.equal(login.data.user.employeeId,b.employeeId?.toLowerCase()||null);assert.equal(login.data.user.email,b.email||null);
}
assert.equal((await call('employees',{name:'空账号',role:'生产人员',password:pw})).status,400);
assert.equal((await call('employees',{name:'重复工号',employeeId:'only001',role:'生产人员',password:pw})).status,409);
assert.equal((await call('employees',{name:'重复邮箱',email:'EMAILONLY@example.test',role:'生产人员',password:pw})).status,409);
assert.equal((await call('employees',{name:'错邮箱',email:'bad@',role:'生产人员',password:pw})).status,400);
const emailEmployee=(await call('employees')).data.employees.find(u=>u.email==='emailonly@example.test');
assert.equal((await call('employees/'+emailEmployee.id,{...emailEmployee,email:'',employeeId:'CHANGED001'})).status,200);
assert.equal((await call('auth/login',{identifier:'emailonly@example.test',password:pw})).status,401);
assert.equal((await call('auth/login',{identifier:'changed001',password:pw})).status,200);
assert.equal((await call('employees/'+emailEmployee.id,{...emailEmployee,email:'',employeeId:''})).status,400);
console.log('Passed: multiple email-only and ID-only employees, no generated identifiers, uniqueness, validation and editing login identifiers.');
