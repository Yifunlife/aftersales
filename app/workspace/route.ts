import {env} from 'cloudflare:workers';
import {sessionUser} from '../../lib/accounts.mjs';
import html from '../../lib/workspace.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){const u=await sessionUser(request,env.DB);if(!u||u.must_change){const login=new URL('/',request.url),notification=new URL(request.url).searchParams.get('notification');if(/^[a-f0-9-]{36}$/.test(notification||''))login.searchParams.set('notification',notification!);return Response.redirect(login,303);}
const p={id:u.id,name:u.name,role:u.role,email:u.email,employeeId:u.employee_id,active:!!u.active};
const data=JSON.stringify(p).replace(/</g,'\\u003c');
return new Response(html.replace('<script>window.openai=',`<script>window.__EMPLOYEE__=${data};window.openai=`),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"frame-ancestors 'self'"}});}
