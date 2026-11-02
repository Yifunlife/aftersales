export function roleList(person){let value=person?.roles;if(typeof value==='string'){try{value=JSON.parse(value)}catch{value=[]}}return [...new Set([person?.role,...(Array.isArray(value)?value:[])].filter(x=>typeof x==='string'&&x))]}
export function hasRole(person,allowed){return roleList(person).some(r=>(Array.isArray(allowed)?allowed:[allowed]).includes(r))}
export const roleSQL=(alias='employees')=>`EXISTS(SELECT 1 FROM json_each(${alias}.roles) WHERE value=?)`;
