import html from '../lib/workspace.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
for(const [i,s] of scripts.entries())new vm.Script(s[1],{filename:'workspace-'+i});
assert(!html.includes('切换演示人员'));assert(!html.includes('let selected=\'admin\''));assert(html.includes('window.__EMPLOYEE__'));assert(html.includes('员工账号由云端验证'));
console.log('Workspace inline scripts parse; no demo role switching remains.');
