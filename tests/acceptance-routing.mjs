import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('app-fragment.html','utf8'),code=source.slice(source.indexOf('function syncOperationRouting('),source.indexOf('function syncAcceptanceFields('));const context=vm.createContext({});vm.runInContext(code,context);
const field=()=>({value:'',required:true,disabled:false,label:{hidden:false},closest(){return this.label}});
for(const stage of ['客户验收','负责人复核']){const f={dataset:{stage},elements:{decision:{value:'pass'},planned:field(),nextOwner:field()}};context.syncOperationRouting(f);assert(f.elements.planned.label.hidden);assert(!f.elements.planned.required);assert(f.elements.planned.disabled);assert.equal(f.elements.nextOwner.required,stage==='客户验收');
f.elements.decision.value='return';context.syncOperationRouting(f);assert(!f.elements.planned.label.hidden);assert(f.elements.planned.required);assert(!f.elements.planned.disabled);assert(!f.elements.nextOwner.label.hidden);assert(f.elements.nextOwner.required);}
console.log('Acceptance and final review hide unnecessary dates on pass, require assignment and date on return.');
