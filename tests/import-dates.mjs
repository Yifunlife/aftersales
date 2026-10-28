import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app-fragment.html',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function excelImportRows('),source.indexOf('function loadXLSX('));
for(const date1904 of [false,true]){
 const sheet={A1:{t:'n',v:46321,z:'yyyy/m/d',w:'2026/10/26'},B1:{t:'n',v:123,z:'0'},C1:{t:'s',v:'原有文字'},'!ref':'A1:C1'};
 const X={SSF:{is_date:z=>z==='yyyy/m/d',parse_date_code:(value,options)=>{assert.equal(options.date1904,date1904);return {y:2026,m:10,d:26}}},utils:{sheet_to_json:(s,options)=>{assert.equal(options.header,1);return s}}};
 const result=vm.runInNewContext(code+";excelImportRows(X,wb,'记录')",{X,wb:{Sheets:{记录:sheet},Workbook:{WBProps:{date1904}}}});
 assert.equal(result.A1.v,'2026-10-26');assert.equal(result.A1.t,'s');assert.equal(result.A1.w,undefined);assert.equal(result.B1.v,123);assert.equal(result.C1.v,'原有文字');
}
console.log('Excel dates normalize custom slash displays, drop cached formatting, honor date system and retain other cells.');
