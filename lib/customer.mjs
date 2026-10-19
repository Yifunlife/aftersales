import rows from './customer-copy.json' with {type:'json'};
export const customerLanguages=['zh','en','ar'];
const extra=[
 ['客户查询预览','Customer portal preview','معاينة بوابة العملاء'],
 ['演示页面：仅含示例订单，不发送真实邮件。','Demo only: sample order, no real emails are sent.','صفحة تجريبية: طلب نموذجي فقط، ولن تُرسل رسائل بريد فعلية.'],
 ['查看验证入口','Preview email verification','معاينة التحقق بالبريد'],
 ['返回进度预览','Back to progress preview','العودة إلى معاينة التقدم'],
 ['邮箱已验证','Email verified','تم التحقق من البريد'],
 ['查看原文','View original','عرض النص الأصلي'],
 ['张专员','Zhang','تشانغ'],
 ['原始中文记录','Original Chinese update','التحديث الأصلي باللغة الصينية'],
 ['发送客户链接','Share customer link','مشاركة رابط العميل'],
 ['示例订单链接','Sample order link','رابط الطلب النموذجي'],
 ['选择客户语言后，复制链接或文案，通过微信、WhatsApp 或邮件发给客户。','Choose a language, then copy the link or message to share via WhatsApp, WeChat or email.','اختر اللغة، ثم انسخ الرابط أو الرسالة لمشاركتها عبر واتساب أو وي تشات أو البريد الإلكتروني.'],
 ['当前只演示发送流程。正式订单链接、授权邮箱和真实验证码尚未接入。','Sharing demo only. Live order links, authorized emails and real verification codes are not connected yet.','عرض تجريبي للمشاركة فقط. لم تُربط بعد روابط الطلبات الفعلية أو رسائل التحقق الحقيقية.'],
 ['发送内容预览','Message preview','معاينة الرسالة'],
 ['客户语言','Customer language','لغة العميل'],
 ['复制链接','Copy link','نسخ الرابط'],
 ['复制发送文案','Copy message','نسخ الرسالة'],
 ['预览客户页面','Preview customer page','معاينة صفحة العميل'],
 ['已复制，可以粘贴发送给客户。','Copied. Paste it into your preferred messaging app.','تم النسخ. يمكنك لصقه في تطبيق المراسلة.'],
 ['自动复制不可用，请手动选择上面的链接或文案复制。','Automatic copy is unavailable. Select and copy the link or message above.','النسخ التلقائي غير متاح. حدد الرابط أو الرسالة أعلاه وانسخه يدوياً.'],
 ['请先登录员工账号','Please sign in as an employee','يرجى تسجيل الدخول بحساب موظف'],
 ['登录工作台','Sign in to workspace','تسجيل الدخول إلى مساحة العمل'],
 ['返回员工工作台','Back to employee workspace','العودة إلى مساحة عمل الموظف'],
 ['订单','Order','الطلب'],
 ['只读示例订单','Read-only sample order','طلب نموذجي للعرض فقط'],
 ['加载中…','Loading…','جارٍ التحميل…'],
 ['你好，以下是售后查询演示链接，当前仅展示示例订单。打开后可体验邮箱验证与进度查询；演示验证码为 246810。','Hello, here is a demo service tracking link showing a sample order only. Open it to preview email verification and progress tracking. The demo code is 246810.','مرحباً، هذا رابط تجريبي لمتابعة الخدمة يعرض طلباً نموذجياً فقط. افتحه لمعاينة التحقق بالبريد ومتابعة التقدم. رمز العرض التجريبي هو 246810.'],
 ['时间均为中国标准时间 UTC+8','All times shown in China Standard Time, UTC+8','جميع الأوقات بتوقيت الصين، UTC+8']
];
const dictionary=new Map([...rows,...extra].map(r=>[r[0],r]));
export function translateCustomer(key,lang='en'){const row=dictionary.get(key);return lang==='zh'?key:row?.[lang==='ar'?2:1]||key;}
export function resolveCustomerLanguage(value){return customerLanguages.includes(value)?value:'en';}
export function customerLink(origin,lang){const url=new URL('/customer',origin);url.searchParams.set('lang',resolveCustomerLanguage(lang));url.searchParams.set('view','verify');return url.href;}
export function customerShareText(origin,lang){return translateCustomer('你好，以下是售后查询演示链接，当前仅展示示例订单。打开后可体验邮箱验证与进度查询；演示验证码为 246810。',lang)+'\n\n'+customerLink(origin,lang);}
export const customerTasks=[
 {id:'panel',name:'护板 P02 · 补发 1 套',status:'生产中',date:'预计 10 月 22 日发货',step:2,next:'完成尺寸与外观检查后，交仓库打包发货。',update:'护板已完成加工，正在进行出厂检查。',time:'10 月 19 日 10:20',issue:'护板运输破损，已确认补发一套。'},
 {id:'controller',name:'控制器 C05 · 更换 1 件',status:'已发货',date:'预计 10 月 21 日送达',step:3,next:'物流配送中，送达后售后专员会联系安装。',update:'替换控制器已交承运商，正在运输。',time:'10 月 18 日 16:40',issue:'设备无法启动，检测后确认更换控制器。'},
 {id:'motor',name:'电机 M01 · 远程调试',status:'已完成',date:'10 月 17 日已恢复使用',step:5,next:'本项已处理完成，如有异常可继续联系售后。',update:'已完成参数调试，客户确认设备正常运行。',time:'10 月 17 日 14:30',issue:'运行参数异常，已通过远程调试处理。'}
];
