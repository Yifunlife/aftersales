# 阿里云独立部署

售后应用运行在独立 Node 服务中；Cloudflare D1、R2 和 Workers AI 继续保存结构化数据、文件和提供识别能力。应用迁移不会将图片复制进 ECS 系统盘。总看板服务绑定和每日分析任务继续使用同一数据库。

## 已完成

- Node 与 Cloudflare 两种构建目标。
- 员工工单和付款登记持久化，岗位字段投影、服务器流程规则、整单乐观锁。
- 独立资源接口通过随机密钥认证；浏览器不接触资源密钥或 SQL。
- 阿里云候选程序已上传、在回环地址启动验证；登录 HTML 可返回。
- 迁移前数据库导出完成；在内存 SQLite 中恢复后 integrity_check=ok、foreign_key_check=0。

## 2026-10-28 尚未完成的切换条件

服务器访问 workers.dev 的 DNS 结果异常；使用正确解析结果时 TLS 连接仍被重置。因此不能把 workers.dev 资源地址作为 ECS 生产依赖，也没有开启 ALI_ORIGIN_URL。候选服务的数据库状态接口验证失败，不能视为正式上线。

需在已登录的管理控制台中配置可从 ECS 稳定访问的独立资源域名，并完成独立 systemd 服务和 nginx 路径安装。Mac 当前锁定，无法执行控制台步骤。现有 SSH 账号仅有中控的专用发布命令；不得借用它修改中控来绕过权限。

## 安装与切换顺序

1. `DEPLOY_TARGET=node node scripts/run-framework.mjs build` 生成 `dist/standalone`，将 `runtime/start-node.mjs` 放入独立包根目录。
2. 上传到 `/home/yw-deploy/yifun-aftersales/staging/candidate`，运行配置放在独立 shared/runtime.json；不要将密钥写入 Git 或程序包。
3. 为资源 Worker 配置可用的 HTTPS 域名；更新运行配置 resourceUrl。在 ECS 上验证绑定 SQL、附件读取和 AI 接口。
4. 通过既有 ECS 管理控制台执行已审阅的 `runtime/install-aliyun.sh`。安装专用无登录用户、独立服务、512MB 内存上限、1核 CPU 上限；原中控继续监听 3000，售后仅监听 127.0.0.1:3100/3101。
5. 脚本仅在原 nginx 配置新增 `/_yifun-aftersales/` 路径，保留原 root 和设备接口，测试配置后 reload；不重启中控服务，不替换中控数据。
6. 从外部验证 origin TLS、源站密钥拦截、数据库登录状态和读写流程，再设置 ALI_ORIGIN_URL 为 `https://47.116.18.155/_yifun-aftersales` 并发布 Worker。保留公开登录网址和 cookie 域。
7. 验收员工/客户登录、工单提交和推进、私有附件、产品资料、总看板同步、手机页面；确认中控健康。

回退时删除 ALI_ORIGIN_URL 并重新发布 Worker，即恢复 Cloudflare 应用运行。数据库和文件使用同一资源，不需要覆盖回滚数据。nginx 原配置保存在服务器 `/var/backups/yifun-aftersales/<安装时间>/`。不要恢复旧数据库覆盖切换后的新业务记录。

## 验证

`node check.mjs`、`node tests/intake-sync.mjs`、Node 和 Cloudflare 构建。资源接口测试覆盖拒绝匿名、参数绑定、批处理、二进制附件和 AI 转换；流程测试覆盖越权字段、跳环节、生产顺序、签收、验收、审核关闭、付款重复/超额、隐藏字段保留。
