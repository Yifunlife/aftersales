# 阿里云售后正式部署

正式入口：https://aftersales.shyiwan.com/

员工和客户使用同一登录页，账号、密码及历史数据沿用原系统。手机和电脑使用同一网址。旧入口 `yifun-aftersales.yifunlife.workers.dev` 与 `aftersales.yifunlife.co` 通过 Cloudflare 转发到同一阿里云服务。

## 运行与数据

- ECS：上海 `i-uf6dg2whvp001cjr84l9`，公网47.116.18.155。
- 独立服务 `yifun-aftersales.service`，专用无登录用户 `yifun-aftersales`，开机启动；512MB内存上限、1核CPU上限。
- 程序 `/opt/yifun-aftersales/current`；仅监听127.0.0.1:3100和3101，外部通过nginx的HTTPS访问。
- 原中控 `yw-park-os.service` 继续监听3000。其原路由保持；443显式设置为 `default_server`，确保IP证书不受新增站点影响。
- 结构化数据保留在Cloudflare D1；图片、PDF、视频等保留在私有R2。ECS不保存上传文件；Workers AI通过专用认证接口调用。
- 资源域名 `aftersales-resources.yifunlife.co`，仅 `/__ali-resources` 接受密钥认证，其他路径404。密钥不进入浏览器、源代码和发布包。
- 运行配置 `/etc/yifun-aftersales/runtime.json`，root所有、专用服务组只读640。nginx公开站点通过服务器配置注入源站认证头，并覆盖客户端伪造的代理/IP头。
- 总看板绑定与每日分析任务继续使用同一D1，无需复制或替换业务数据。

## 域名和HTTPS

在账号已有企业备案域名 `shyiwan.com` 下仅新增两条A记录：`aftersales`、`aftersales-origin`，均指向47.116.18.155；官网、ERP、邮箱等原记录不变。

独立nginx配置 `/etc/nginx/conf.d/yifun-aftersales-shyiwan.conf`：公开入口 `aftersales.shyiwan.com`，私有源站 `aftersales-origin.shyiwan.com`。未携带源站密钥访问私有业务接口返回404。首页仅在正式企业域名显示备案链接。

证书名称 `yifun-aftersales-shyiwan`，覆盖上述两个域名。现有 `yw-ip-cert-renew.timer` 会续期证书，部署钩子在校验配置后reload nginx。ACME验证路径保留，证书验证不得关闭。

## 发布

1. 运行 `node check.mjs`，表单或导入定义变化时还需 `node tests/intake-sync.mjs`。
2. `DEPLOY_TARGET=node node scripts/run-framework.mjs build`，将 `runtime/start-node.mjs` 复制到 `dist/standalone/start-node.mjs`。
3. 将独立发布包上传并解压到 `/home/yw-deploy/yifun-aftersales/staging/candidate`。不将运行配置或数据库导出打入程序包。
4. 通过已授权的ECS Workbench管理会话执行 `runtime/install-aliyun.sh`。它保留上一版程序，不修改数据库、上传附件和中控应用。
5. 初次配置正式域名时执行 `runtime/configure-aliyun-public.sh`；以后普通程序更新不必重新申请证书或修改nginx。
6. 从外部验证正式入口、账号服务、私有源站拦截和中控IP HTTPS。
7. Cloudflare配置中 `ALI_ORIGIN_URL=https://aftersales-origin.shyiwan.com`。保留 `ALI_ORIGIN_ENABLED=false` 可先使用源站认证头私下验证；确认后设为true并构建发布Worker。

Cloudflare构建：`DEPLOY_TARGET=cloudflare node scripts/run-framework.mjs build`，再用Wrangler发布 `dist/server/wrangler.json`。不要把Node构建当作Worker包发布。

## 回退

将 `ALI_ORIGIN_ENABLED` 设为false并重新发布Worker，旧入口即恢复Cloudflare应用运行；或回退到已验证的Cloudflare运行版本。D1和R2使用同一资源，不恢复旧数据库覆盖新业务记录。

ECS程序版本保留在 `/opt/yifun-aftersales/releases`；安装备份保存上一版路径。nginx备份位于 `/var/backups/yifun-aftersales`。新增任何TLS虚拟主机前都必须保留中控IP站点为default_server。修复该选择可执行 `runtime/fix-default-tls.sh`，无需重启中控。

## 本次验证范围

2026-10-28完成Node/Cloudflare构建、流程及权限自动检查、表单双向同步检查；数据库导出在内存SQLite恢复后integrity_check=ok、foreign_key_check=0。

ECS实测绑定数据库读写、私有对象写读、AI调用均通过，测试行和对象已清理。外部HTTPS检查覆盖正式入口、旧入口、私有源站404与中控IP；桌面及390×844手机登录页面已检查。未使用客户真实密码做额外业务记录的写入测试。
