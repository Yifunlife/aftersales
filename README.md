# 亦玩集团售后工作台

员工账号使用服务端 D1 数据库。管理员在验证站点所有者身份后首次开通账号，再统一创建员工账号、临时密码和岗位。工号与邮箱至少填写一项；未填写的一项保存为空，不自动生成。员工首次登录必须改密。账号停用、权限变更和密码重置立即撤销旧会话。

入口 `/`：登录及员工账号管理。`/workspace`：登录后的岗位工作台，同时适配手机。`/mobile` 跳转至自适应工作台。

当前工作台订单、采购、生产、仓库、安装及财务记录仍为流程示例，未接入共享业务数据库。员工账号为云端持久账号，与演示业务数据区别处理。

账号密码仅存加盐 PBKDF2 摘要。会话使用 HttpOnly、Secure、SameSite Cookie。首次开通要求平台验证的站点所有者身份匹配服务端 AUTH_OWNER_EMAIL；禁止匿名重置管理员。

本地安装及构建沿用 Sites Vinext 工作流。修改 schema 后生成并检查 Drizzle migration。生产通过 Sites 发布，平台应用 D1 migrations。

## 客户查询页面

`/customer` 是中文、English、العربية 三语示例查询页面，桌面分栏、手机逐项展开；Arabic 使用 RTL，型号与订单号保持 LTR。语言选择保存在浏览器偏好中，不保存客户邮箱、验证码或留言。`/customer-share` 为已登录员工展示示例链接及发送文案，可复制或打开邮件草稿。工作台顶部、售后订单进度标题旁均有发送入口。

这两个页面当前仅使用固定示例订单，验证码 246810 为公开演示，不进行身份鉴权、不发送邮件、不提供实际订单信息。生产环境真实客户访问需要另行接入共享订单数据库、授权邮件和一次性验证码服务，不能使用当前示例页处理真实客户资料。

## 独立 Cloudflare 部署

GitHub 主仓库：https://github.com/Yifunlife/aftersales ，发布分支 `main`。

- Workers 运行工作台；D1 `yifun-aftersales-workspace` 只存账号、客户、工单和附件元数据。
- R2 `yifun-aftersales-files` 保存客户、员工手工录单、审核和现场处理的照片/视频。数据库只保存 object key、文件名、大小及受权限保护的访问链接，不保存 Base64、data URL 或 blob URL。
- 页面品牌图片使用 `/media/` 静态资源链接，由 Cloudflare 静态资源服务提供。
- 附件保持私有，通过 `/api/customer/file/:id` 验证员工会话或客户邀请后流式读取；不要将客户附件桶设为公开。
- 原来的 `yifun-aftersales-db` / `yifun-aftersales-attachments` 与原 Sites 数据不变；新环境不自动继承旧账号、旧工单或邀请链接。新版替换旧版 Worker 入口，旧库仅保留回退，不自动导入旧记录。

首次发布：`npm ci`，然后 `npm run deploy:cloudflare`。配置见 `wrangler.cloudflare.json`，D1 migrations 从 `drizzle/` 应用。云端管理员通过部署密钥 `AUTH_OWNER_EMAIL`、`INITIAL_ADMIN_HASH`、`INITIAL_ADMIN_SALT` 初始化；密码只存加盐 PBKDF2 摘要。直接 Workers 部署会过滤客户端伪造的平台身份头。

`.github/workflows/cloudflare.yml` 在 main 更新时验证、构建、应用迁移和发布。启用自动发布需在 GitHub 仓库 Secrets 添加 `CLOUDFLARE_API_TOKEN`，限本账号的 Workers Scripts Edit、D1 Edit、Workers R2 Storage Edit；不得提交令牌、密码、数据库导出或 R2 文件到 Git。

发布前运行 `node check.mjs`。表单字段变更还需 `npm run test:intake-sync`。生产数据库备份可使用 `wrangler d1 export DB --remote --config wrangler.cloudflare.json --output <私有备份路径>`；备份不进入仓库。大文件请使用附件上传或外部 http(s) 链接，现有单文件 10MB / 每次 20MB 限制仍有效。

独立售后网站提供名为 `AftersalesReporting` 的 Cloudflare 私有服务入口，仅供绑定它的集团总看板读取正式工单、项目映射和申请数量；不公开在 HTTP API 路由中，不导出账号、口令、邀请链接或文件内容。总看板每天上海时间 08:00、18:00 自动同步，并提供手动同步。售后系统是流程状态的唯一修改来源。

## 客户账号、代填与产品资料库

- 客户入口 `/customer-login`，登录后进入 `/request`。员工在“客户工单中心 → 客户档案 → 选择客户 → 客户登录账号”新增、停用或重置账号。客户名称与登录账号分开；首次登录和重置后必须改密。客户会话与员工会话隔离，密码只存加盐摘要，账号更新会撤销旧会话。
- “客户工单中心 → 专员代填”直接将客户问题和附件保存到云端，生成无需登录的进度链接。进度链接仅能读取对应申请及其客户附件，不能修改、创建申请或浏览其他申请。专员检查与审核员交接步骤仍需完成。原有客户填写邀请链接继续保留。
- `/knowledge-admin` 为“产品资料库”维护入口，管理员和售后专员可新增、更新、发布或下架；客户侧 `/help` 按款号、产品名称、问题关键词搜索玩法、维修说明和常见问题。每篇可配置外部HTTPS链接，并上传PDF、图片和视频；文件保存在R2，数据库只存元数据。客户仅看已发布最新版；下架后附件也不能访问。
- 手机、平板和桌面共用入口及云端数据，窄屏使用单列内容和客户底部导航。中文、English和Arabic客户界面保留语言选择；资料正文由维护人员按所选资料语言编写。
- 新增迁移为0004、0005，均为增量结构变更。发布前运行 `node check.mjs` 和 `node tests/intake-sync.mjs`；`tests/customer-self-service.mjs` 验证客户隔离、密码/会话生命周期、代填、只读链接、审核门槛、搜索、资料更新/下架、文件权限和版本冲突。

入口补充：工作台左侧“财务中心”下方增加“产品资料中心”；管理员和售后专员可维护，其他员工只看已发布资料。账号管理页的“客户账号”页签可直接选择客户建号、重置或停用。客户密码的建号、重置和自行改密规则统一为8–128位；员工密码规则保持现有设置。

## 智能售后（/assistant）

- 客户入口位于 `/request` 和 `/help`，员工工作台顶部也有“智能售后”。同一权限体系验证登录、首次改密和客户邀请链接；访客进度仍限制到原链接的单个申请。
- Workers AI binding `AI` 使用 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`。只检索当前已发布的产品资料，建议填写款号；按款号/名称/问题关键词选取最多五篇候选资料。没有匹配时请用户补充型号或转人工，不生成无依据的维修答案。不是全互联网搜索，也不是模型训练。
- 匹配资料的 PDF 在首次使用时通过 `AI.toMarkdown` 提取，文字缓存在私有 R2 `assistant-text/<immutable-file-id>.txt`，文件元数据仍在 D1。每次最多读取三份匹配 PDF，每份最多20万字；失败会明确提示查看原文件，不能读出的扫描件请补充正文说明。删除附件时一并清理文字缓存。未匹配产品的其他 PDF 不会全库扫描。
- 提供的正文/PDF片段总量有界，资料被视为不可信引用；回答仅以纯文本显示，原文链接由服务器生成。未发布/下架资料不作为答案依据。
- 查进度复用客户 portal 的授权与公开阶段映射，返回受限状态卡片，不把姓名、电话、费用或内部备注发送给模型。第一版聊天仅在当前页面内存保留，不存整段聊天记录。用户主动转报修时，自己的问题可临时带入同客户的表单草稿（10分钟有效），仍须核实型号、选店铺、上传照片并手动提交。
- 每个账号/邀请链接每小时30次、全站每天500次提问。使用现有 Cloudflare AI 账户额度与计费；不提供公开匿名模型代理。
- 云端 `customer_work_items` 工单保存为“已关闭”时，和工单更新在同一事务中自动生成一篇“待审核解决方案”草稿。按工单生成固定ID防重复，过期版本不能生成草稿；不会覆盖专员后续修改或已发布版本。只整理产品、故障、原因、处理方法和相关处理记录，并过滤已知客户/联系信息，需人工检查适用条件、隐私与安全后发布。历史演示/本地样例不参与此流程。

官方接口参考：[Workers AI 模型](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)、[PDF文字转换](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/usage/binding/)。
