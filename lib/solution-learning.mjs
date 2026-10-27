import {digest} from './accounts.mjs';
export async function learningStatement(db,work,actor,version,{table='customer_work_items'}={}){
 if(!['customer_work_items','staff_work_items'].includes(table))throw Error('Invalid work table');
 if(work.stage!=='已关闭')return null;
 const key=await digest('solution:'+work.id),id=key.slice(0,8)+'-'+key.slice(8,12)+'-4'+key.slice(13,16)+'-a'+key.slice(17,20)+'-'+key.slice(20,32);
 const privateValues=['customer','contact','email','phone','address','project','order','owner','sales','designer','engineer','installer','whatsapp'].map(k=>work[k]).filter(v=>typeof v==='string'&&v.length>=2).sort((a,b)=>b.length-a.length);
 const scrub=v=>{let s=typeof v==='string'?v.slice(0,5000):'';for(const value of privateValues)s=s.split(value).join('[已隐去]');return s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐去]').replace(/(?:\+?\d[\d ()-]{6,}\d)/g,'[号码已隐去]')};
 const product=scrub(work.product)||'待确认产品',body=['【人工处理后自动整理 · 待专员审核】','发布前请核实适用款号、操作步骤、个人信息和安全要求。此草稿不会被智能助手用于回答。','产品：'+product,'问题表现：'+(scrub(work.issue)||'待补充'),'原因：'+(scrub(work.cause)||'待补充'),'处理方法：'+(scrub(work.review?.method)||scrub(work.method)||'待补充'),'处理记录：'+(Array.isArray(work.history)?work.history.filter(h=>/^(现场处理|品质检验|部门处理|客户验收)：/.test(h.action||'')).map(h=>scrub(h.action)).join('\n').slice(0,8000):'待补充'),'完成结果：工单已关闭；请补充实际验证方法与适用条件。','安全提示：涉及拆机、电气或运动机构操作时，请由专业人员处理。'].join('\n\n'),now=Date.now();
 return db.prepare(`INSERT OR IGNORE INTO knowledge_articles(id,product_code,product_name,title,category,summary,body,links,status,language,version,updated_by,created_at,updated_at) SELECT ?,?,?,?,?,?,?,'[]','draft','zh',1,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM ${table} WHERE id=? AND version=?)`).bind(id,'',product.slice(0,160),('待审核解决方案 · '+product).slice(0,200),'repair','由已关闭工单自动生成，请核实后发布。',body,actor,now,now,work.id,version);
}
