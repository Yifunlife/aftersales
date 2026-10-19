import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {customerLanguages,legacyCustomerTarget,resolveCustomerLanguage} from '../lib/customer.mjs';
for(const lang of customerLanguages){const token='a'.repeat(64);const url=new URL(legacyCustomerTarget({lang,token}),'https://example.test');assert.equal(url.pathname,'/request');assert.equal(url.searchParams.get('lang'),lang);assert.equal(url.searchParams.get('token'),token);}
assert.equal(legacyCustomerTarget(),'/request');assert.equal(legacyCustomerTarget({token:'fake-order-id'}),'/request');assert.equal(resolveCustomerLanguage('unsupported'),'en');
const page=readFileSync(new URL('../app/customer/page.tsx',import.meta.url),'utf8');assert(page.includes('redirect(legacyCustomerTarget'));assert(!page.includes('246810'));assert(!page.includes('customerTasks'));
console.log('Legacy customer links open the real invitation-scoped portal without sample orders or demo verification.');
