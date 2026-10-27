# 阿里云独立部署

售后应用运行在独立 Node 服务中；Cloudflare D1、R2 和 Workers AI 继续保存结构化数据、文件和提供识别能力。应用迁移不会将图片复制进 ECS 系统盘。总看板服务绑定和每日分析任务继续使用同一数据库。

## 已完成

- Node 与 Cloudflare 两种构建目标。
- 员工工单和付款登记持久化，岗位字段投影、服务器流程规则、整单乐观锁。
- 独立资源接口通过随机密钥认证；浏览器不接触资源密钥或 SQL。
- 阿里云候选程序已上传、在回环地址启动验证；登录 HTML 可返回。
- 迁移前数据库导出完成；在内存 SQLite 中恢复后 integrity_check=ok、foreign_key_check=0。

## 2026-10-28 部署现状：已安装，正式切换已回退

- ECS 专用 yifun-aftersales 用户和服务已安装并开启开机启动；3100/3101 仅监听回环地址，内存上限512MB。中控进程继续运行在3000。
- 资源专用域名 aftersales-resources.yifunlife.co 已部署；ECS 实测 D1 绑定读写、R2 二进制写读和 AI 调用成功；测试数据已清理。
- 新公开入口 aftersales.yifunlife.co 已配置，旧 workers.dev 入口保留。
- Ali DNS 新增 aftersales-origin.yifunlife.cn A记录，未修改已有记录。其域名证书由既有 Certbot 续期任务维护。
- 私有预览曾通过，但正式切换后 Cloudflare 到源站返回525。已回退到 be880bb1-6b81-4b0c-8768-5dc3c5012427，ALI_ORIGIN_ENABLED=false；公开入口继续运行 Cloudflare 应用，不能声称阿里云已正式上线。
- **待立即修复**：新增 nginx TLS虚拟主机改变了默认证书选择，HTTPS直接访问服务器IP出现证书名称不匹配。中控程序和HTTP健康检查正常。`runtime/fix-default-tls.sh` 已准备并上传到 `/home/yw-deploy/yifun-aftersales/fix-default-tls.sh`；需从既有 Workbench root 会话执行。Mac 再次锁定，尚未执行。
- 修复默认站点后，重新核对公网IP证书、中控访问和源站TLS。只有多个独立连接验证通过后才能再次启用流量切换；不得关闭证书验证。

## 安装与切换顺序

1. `DEPLOY_TARGET=node node scripts/run-framework.mjs build` 生成 `dist/standalone`，将 `runtime/start-node.mjs` 放入独立包根目录。
2. 上传到 `/home/yw-deploy/yifun-aftersales/staging/candidate`，运行配置放在独立 shared/runtime.json；不要将密钥写入 Git 或程序包。
3. 资源 Worker 使用 aftersales-resources.yifunlife.co；运行配置 resourceUrl 指向该域名。在 ECS 上验证绑定 SQL、附件读取和 AI 接口。
4. 通过既有 ECS 管理控制台执行已审阅的 `runtime/install-aliyun.sh`。安装专用无登录用户、独立服务、512MB 内存上限、1核 CPU 上限；原中控继续监听 3000，售后仅监听 127.0.0.1:3100/3101。
5. 先显式保留中控 IP 站点为 TLS default_server，再执行 `runtime/configure-aliyun-origin.sh` 配置独立源站虚拟主机；测试配置后 reload，不重启中控服务或替换中控数据。首次安装曾添加的 `/_yifun-aftersales/` 路径暂时保留，不作为正式回源地址。
6. 从外部验证 origin TLS、源站密钥拦截、数据库登录状态和读写流程，ALI_ORIGIN_URL 使用 `https://aftersales-origin.yifunlife.cn`；先保持 ALI_ORIGIN_ENABLED=false，使用源站密钥私有验证，最后设为true并发布。Workers fetch不支持直接IP回源。保留公开登录网址和 cookie 域。
7. 验收员工/客户登录、工单提交和推进、私有附件、产品资料、总看板同步、手机页面；确认中控健康。

回退时将 ALI_ORIGIN_ENABLED 设为false并重新发布 Worker，或回退到已验证的Cloudflare运行版本，即恢复 Cloudflare 应用运行。数据库和文件使用同一资源，不需要覆盖回滚数据。nginx 原配置保存在服务器 `/var/backups/yifun-aftersales/<安装时间>/`。不要恢复旧数据库覆盖切换后的新业务记录。

## 验证

`node check.mjs`、`node tests/intake-sync.mjs`、Node 和 Cloudflare 构建。资源接口测试覆盖拒绝匿名、参数绑定、批处理、二进制附件和 AI 转换；流程测试覆盖越权字段、跳环节、生产顺序、签收、验收、审核关闭、付款重复/超额、隐藏字段保留。
