'use client';
import {useEffect,useState} from 'react';
import CustomerAccountsPanel from './customer-accounts-panel';
import './service-portal.css';
export default function CustomerAccountManager(){
 const [data,D]=useState<any>(null),[customerId,C]=useState(''),[query,Q]=useState(''),[error,E]=useState('');
 async function load(){try{const r=await fetch('/api/customer/inbox',{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error);D(j);E('');if(j.customers.length===1)C(j.customers[0].id)}catch(e:any){E(e.message)}}
 useEffect(()=>{load()},[]);
 const customers=(data?.customers||[]).filter((c:any)=>[c.company,c.contact,c.email,c.market_id].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <div className="sp customer-account-manager"><section className="panel"><div className="bar"><div><h2>为客户建立登录账号</h2><p className="muted">先选择客户，再设置登录账号和至少8位的初始密码。客户首次登录需改密，只能访问自己公司的店铺和工单。</p></div><a className="button" href="/customer-workorders?tab=customers">新建／维护客户档案</a></div>{error&&<p className="notice error" role="alert">{error}</p>}{!data&&!error?<p>正在读取客户档案…</p>:<div className="fields"><label>搜索客户<input type="search" placeholder="客户名称、联系人或邮箱" value={query} onChange={e=>{Q(e.target.value);C('')}}/></label><label>选择客户<select aria-label="选择要建立账号的客户" value={customerId} onChange={e=>C(e.target.value)}><option value="">请选择客户</option>{customers.map((c:any)=><option key={c.id} value={c.id}>{c.company}{c.contact?' · '+c.contact:''}</option>)}</select></label></div>}{data&&!data.customers.length&&<p className="notice">还没有客户档案，请先点击“新建／维护客户档案”。</p>}</section>{customerId&&data&&<CustomerAccountsPanel key={customerId} customerId={customerId} canWrite={data.canWrite}/>}</div>
}
