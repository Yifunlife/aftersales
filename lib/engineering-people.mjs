// Only active engineering accounts can be selected; ambiguous names require administrator correction.
export async function engineeringPeople(db){
 const rows=(await db.prepare("SELECT name FROM employees WHERE active=1 AND role='工程人员' ORDER BY name,id").all()).results;
 return rows.map(r=>r.name).filter(name=>name&&rows.filter(r=>r.name===name).length===1);
}
export async function validateEngineeringAssignment(db,old,clean){
 if(old.stage!=='工程下单')return;
 const changed=old.stage!==clean.stage||JSON.stringify(old.engineering)!==JSON.stringify(clean.engineering)||old.orderGroup!==clean.orderGroup||old.orderAssignee!==clean.orderAssignee;
 if(!changed)return;
 const names=await engineeringPeople(db),e=clean.engineering;
 if(e?.confirmed&&(old.stage!==clean.stage||JSON.stringify(e)!==JSON.stringify(old.engineering))&&(!names.includes(e.engineer)||e.orderGroup!=='工程部'))throw Object.assign(new Error('请选择已启用的工程人员账号；同名账号请管理员先核对。'),{status:400});
 if((old.orderGroup!==clean.orderGroup||old.orderAssignee!==clean.orderAssignee)&&(!names.includes(clean.orderAssignee)||clean.orderGroup!=='工程部'))throw Object.assign(new Error('下单计划必须选择已启用的工程人员账号。'),{status:400});
}
