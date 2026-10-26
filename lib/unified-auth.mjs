import {handleAccounts} from './accounts.mjs';
import {handleCustomerAuth,json,fail,originGuard,readJson} from './customer-auth.mjs';
// Select an account namespace before checking the password. Never fall through to
// another identity after a failed password or a disabled account.
export async function handleUnifiedLogin(request,options){try{
 originGuard(request);if(request.method!=='POST')throw fail('操作不存在。',405);
 const b=await readJson(request,4000),identifier=String(b.identifier||'').trim().toLowerCase();
 if(!identifier||identifier.length>254||typeof b.password!=='string'||b.password.length>128)throw fail('请填写账号和密码。');
 const staff=await options.db.prepare('SELECT id FROM employees WHERE employee_id=? OR email=?').bind(identifier,identifier).first();
 const customer=await options.db.prepare('SELECT id FROM customer_accounts WHERE username=?').bind(identifier).first();
 if(staff&&customer)throw fail('该账号名称重复，请联系管理员修改客户登录账号。',409);
 const kind=staff?'employee':'customer',url=new URL(request.url);url.pathname=staff?'/api/auth/login':'/api/customer-auth/login';
 const delegated=new Request(url,{method:'POST',headers:request.headers,body:JSON.stringify(staff?{identifier,password:b.password}:{username:identifier,password:b.password})});
 const response=await (staff?handleAccounts:handleCustomerAuth)(delegated,options);
 if(!response.ok)return response;
 const data=await response.json(),headers=new Headers(response.headers);
 headers.append('Set-Cookie',`${staff?'__Host-yifun_customer':'__Host-yifun_session'}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
 return new Response(JSON.stringify({...data,kind,next:staff?(data.user.mustChange?'/?tab=password':'/workspace'):(data.user.mustChange?'/customer-login?password=1':'/request')}),{status:200,headers});
 }catch(e){return json({error:e.status?e.message:'登录服务暂时不可用。'},e.status||500)}}
