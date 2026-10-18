import fs from 'node:fs';import {spawnSync} from 'node:child_process';import os from 'node:os';import path from 'node:path';
const source=fs.readFileSync(new URL('app-fragment.html',import.meta.url),'utf8'),dist=fs.readFileSync(new URL('dist/index.html',import.meta.url),'utf8');
const scripts=[...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('application/json'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yifun-site-qa-'));try{for(let i=0;i<scripts.length;i++){const file=path.join(tmp,`script-${i}.js`);fs.writeFileSync(file,scripts[i][2]);const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw Error(`Script ${i}: ${r.stderr}`);}}finally{fs.rmSync(tmp,{recursive:true,force:true});}
for(const forbidden of ['@hotmail.com','Yifun2026!','credentials.set(','data-account-reset','yifun-account-store','yifun-open-password-entry'])if(source.includes(forbidden)||dist.includes(forbidden))throw Error('Private preview code in hosted artifact: '+forbidden);
for(const required of ['售后驾驶舱','售后工单中心','售后审核中心','工程下单中心','采购中心','生产中心','仓库与物流中心','安装中心','财务中心','mobile-app-bottomnav','data-access-switch','data-prod-cost','DEPT-'])if(!source.includes(required))throw Error('Missing functionality: '+required);
if(!dist.includes('allow-downloads'))throw Error('Downloads permission missing');
console.log(`PASS ${scripts.length} script syntax checks; nine modules, mobile shell, department costs and role preview retained; local credentials/reset paths excluded.`);
