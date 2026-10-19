// Old customer URLs now open the real, invitation-scoped customer workspace.
export const customerLanguages=['zh','en','ar'];
export function resolveCustomerLanguage(value){return customerLanguages.includes(value)?value:'en';}
export function legacyCustomerTarget(params={}){
 const query=new URLSearchParams();
 if(typeof params.lang==='string')query.set('lang',resolveCustomerLanguage(params.lang));
 if(typeof params.token==='string'&&/^[a-f0-9]{64}$/i.test(params.token))query.set('token',params.token);
 return '/request'+(query.size?'?'+query:'');
}
