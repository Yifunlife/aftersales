from pathlib import Path
import json,re,subprocess
project=Path(__file__).parent
source=Path('/Users/markfang/.codex/visualizations/2026/10/14/01a1381e-f0d9-7531-8f08-083b3f074969/after-sales-dashboard.html').read_text()
access=Path('/Users/markfang/Desktop/亦玩集团售后/output/account-login/before-access.js').read_text()
a=access.index("let selected='admin';");b=access.index('const person=',a)
access=access[:a]+"let selected='admin';\n"+access[b:]
a=access.index('function save(){');b=access.index('function renderManager()',a)
access=access[:a]+'function save(){}\n'+access[b:]
access=access.replace('const pages=',"root.dataset.authenticated='true';\nconst pages=",1)
access=access.replace('演示身份','演示岗位').replace('<span data-access-role></span>','<span class="account-person" data-account-person></span><span data-access-role></span>')
access=access.replace("account.querySelector('[data-access-role]').textContent=person().role;", "account.querySelector('[data-access-role]').textContent=person().role;account.querySelector('[data-account-person]').textContent=person().name+' · '+person().role;")
access=access.replace('本地权限演示，可切换身份验证分工。正式使用需由后台验证登录身份与每次操作。','岗位权限演示，不是员工登录。当前业务为示例数据，正式员工账号与共享数据库尚未接入。')
access=access.replace("'.yw-account,.yw-access-dialog'","'.yw-account,.yw-access-dialog,.mobile-app-bottomnav,.yw-mobile-account-sheet'")
source,n=re.subn(r'(<script id="yifun-personnel-access">)\s*.*?\s*(</script>)',lambda m:m[1]+'\n'+access+'\n'+m[2],source,flags=re.S)
assert n==1
source=source.replace('本机预览账号 · 不同浏览器的数据独立保存','在线岗位演示 · 业务修改仅在本次页面内生效')
source=source.replace('交互预览 · 录入数据在本次预览中生效，尚未连接正式数据库。','在线预览 · 使用示例数据；本次操作未写入正式共享数据库。')
source+='''
<style id="hosted-preview-notice">
#yw-after-sales .hosted-preview-notice{padding:9px 24px;border-bottom:1px solid #dce7f4;background:#f4f8fe;color:#52739b;font-size:13px;line-height:1.5;}
#yw-after-sales .hosted-preview-notice strong{color:#21467f;font-weight:600;}
#yw-after-sales .yw-account>[data-account-person]{display:none!important;}
#yw-after-sales .yw-mobile-account-sheet .yw-account>[data-account-person]{display:block!important;}
@media(max-width:760px){#yw-after-sales .hosted-preview-notice{font-size:12px;padding:8px 16px;}#yw-after-sales.mobile-nav-open>.shell>nav{top:108px;}}
</style>
<script>(()=>{const app=document.getElementById('yw-after-sales'),note=document.createElement('div');note.className='hosted-preview-notice';note.innerHTML='<strong>在线预览</strong> · 站点访问由平台保护；岗位切换仅用于演示，业务数据尚未接入共享数据库。';app.querySelector(':scope>header').after(note);})();</script>
'''
for style_id in ['account-login-flow','password-entry-style','login-diagnostics']:
    source=re.sub(r'<style id="'+style_id+r'">.*?</style>','',source,flags=re.S)
for forbidden in ['@hotmail.com','Yifun2026!','123456789','data-account-reset','yifun-open-password-entry','credentials.set(']:
    assert forbidden not in source,forbidden
(project/'app-fragment.html').write_text(source)
subprocess.run(['python3','/Users/markfang/.codex/plugins/cache/openai-bundled/visualize/1.0.50/skills/visualize/scripts/render.py',str(project/'app-fragment.html'),str(project/'dist/index.html'),'--title','亦玩集团售后服务工作台 · 在线预览','--force'],check=True)
p=project/'dist/index.html';html=p.read_text().replace('sandbox="allow-scripts"','sandbox="allow-forms allow-downloads allow-scripts"').replace('<html lang="en"','<html lang="zh-CN"')
html=html.replace('</head>','<style>:root{color-scheme:light!important;background:#fff!important}html,body{height:100dvh;overflow:hidden;background:#fff!important;margin:0!important}body{padding:0!important}iframe#codex-visualization{height:100dvh!important;min-height:100dvh;max-height:100dvh;width:100%;margin:0;}</style></head>',1)
p.write_text(html)
phone=Path('/Users/markfang/Desktop/亦玩集团售后/网页最新版/手机预览.html').read_text().replace('使用工号或邮箱登录','站点通过访问验证后，可切换演示岗位')
(project/'dist/mobile.html').write_text(phone)
manifest=project/'.openai/hosting.json';config=json.loads(manifest.read_text());config['static']={'directory':'dist'};manifest.write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
(project/'README.md').write_text('亦玩集团售后服务工作台在线预览。\n\n平台访问策略默认为站点所有者私有。岗位切换与人员管理均为流程演示，不是正式员工身份验证。当前订单与费用是示例数据，操作仅在当前浏览器页面内生效，未连接共享业务数据库。\n\n本发布包不含本地管理员邮箱、密码或密码验证记录，也不提供免验证密码重置入口。\n\n主入口 / ，手机外框预览 /mobile.html 。\n')
print('Hosted bundle ready: main page, phone preview, no local credentials or password-reset entry.')
