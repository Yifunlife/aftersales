import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app-fragment.html',import.meta.url),'utf8'),start=source.indexOf("$('#yw-file').addEventListener('change',async e=>{"),end=source.indexOf('async function downloadTemplate()',start);
const elements=new Map(),get=key=>{if(!elements.has(key))elements.set(key,{textContent:''});return elements.get(key)};
let handler,prepared=0;get('#yw-file').addEventListener=(type,fn)=>{handler=fn};
const context=vm.createContext({$:get,pending:[],csvRows:()=>[['项目名称']],prepareImport:()=>prepared++});
vm.runInContext(source.slice(start,end),context);
for(const size of [6*1024*1024,100*1024*1024]){await handler({target:{files:[{name:'售后.csv',size,text:async()=>''}]}});assert.equal(get('#yw-import-errors').textContent,'')}
assert.equal(prepared,2);
await handler({target:{files:[{name:'售后.csv',size:100*1024*1024+1,text:async()=>''}]}});
assert.match(get('#yw-import-errors').textContent,/超过100MB/);assert.equal(prepared,2);
console.log('Import accepts files through 100MiB and rejects larger files before parsing.');
