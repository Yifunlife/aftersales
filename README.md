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
