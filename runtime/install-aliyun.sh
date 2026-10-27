#!/bin/bash
set -euo pipefail
# One-time root installation; never changes the central service or its data.
[ "$(id -u)" = 0 ] || { echo 'Run through the existing ECS administration console.'; exit 1; }
SOURCE=/home/yw-deploy/yifun-aftersales
NODE=/opt/yw-node/node-v24.19.0-linux-x64/bin/node
ROOT=/opt/yifun-aftersales
STAMP=$(date -u +%Y%m%d-%H%M%S)
NGINX=/etc/nginx/conf.d/yw-park-os.conf
BACKUP=/var/backups/yifun-aftersales/$STAMP
curl -fsS --max-time 10 http://127.0.0.1:3000/api/auth/status >/dev/null
[ -f "$SOURCE/staging/candidate/start-node.mjs" ]
[ -f "$SOURCE/shared/runtime.json" ]
[ -x "$NODE" ]
mkdir -p "$BACKUP" "$ROOT/releases" /etc/yifun-aftersales
cp -a "$NGINX" "$BACKUP/central-nginx.conf"
if ! id yifun-aftersales >/dev/null 2>&1; then useradd --system --home-dir /var/lib/yifun-aftersales --shell /sbin/nologin yifun-aftersales; fi
install -d -o yifun-aftersales -g yifun-aftersales -m 750 /var/lib/yifun-aftersales /var/cache/yifun-aftersales
cp -a "$SOURCE/staging/candidate" "$ROOT/releases/$STAMP"
chown -R root:root "$ROOT/releases/$STAMP"
find "$ROOT/releases/$STAMP" -type d -exec chmod 755 {} +
find "$ROOT/releases/$STAMP" -type f -exec chmod 644 {} +
install -o root -g yifun-aftersales -m 640 "$SOURCE/shared/runtime.json" /etc/yifun-aftersales/runtime.json
if [ -L "$ROOT/current" ]; then readlink -f "$ROOT/current" > "$BACKUP/previous-release"; fi
ln -sfn "$ROOT/releases/$STAMP" "$ROOT/current.next"
mv -Tf "$ROOT/current.next" "$ROOT/current"
cat > /etc/systemd/system/yifun-aftersales.service <<UNIT
[Unit]
Description=Yifun aftersales portal (independent from park central)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=yifun-aftersales
Group=yifun-aftersales
WorkingDirectory=$ROOT/current
Environment=NODE_ENV=production
Environment=DEPLOY_TARGET=node
Environment=PORT=3100
Environment=YIFUN_RUNTIME_CONFIG=/etc/yifun-aftersales/runtime.json
Environment=XDG_CACHE_HOME=/var/cache/yifun-aftersales
ExecStart=$NODE $ROOT/current/start-node.mjs
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
MemoryMax=512M
CPUQuota=100%
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/yifun-aftersales /var/cache/yifun-aftersales
UMask=0077
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now yifun-aftersales.service
for attempt in $(seq 1 20); do if curl -fsS --max-time 2 http://127.0.0.1:3100/__health >/dev/null; then break; fi; sleep 1; done
curl -fsS --max-time 5 http://127.0.0.1:3100/__health >/dev/null
python3 - "$NGINX" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
if 'location ^~ /_yifun-aftersales/' not in s:
    marker='  location / {'
    if s.count(marker)!=1:raise SystemExit('Unexpected central nginx configuration; no change applied')
    block='''  location ^~ /_yifun-aftersales/ {
    client_max_body_size 22m;
    proxy_pass http://127.0.0.1:3100/;
    proxy_http_version 1.1;
    proxy_set_header Host yifun-aftersales.yifunlife.workers.dev;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 180s;
    proxy_send_timeout 180s;
    proxy_buffering off;
  }
'''
    p.write_text(s.replace(marker,block+marker,1))
PY
if ! nginx -t; then cp -a "$BACKUP/central-nginx.conf" "$NGINX"; exit 1; fi
systemctl reload nginx
if ! curl -fsS --max-time 10 http://127.0.0.1:3000/api/auth/status >/dev/null; then cp -a "$BACKUP/central-nginx.conf" "$NGINX"; nginx -t && systemctl reload nginx; echo 'Central health failed; nginx restored'; exit 1; fi
systemctl is-active yifun-aftersales.service yw-park-os.service
printf 'Independent aftersales service installed. Central data untouched. Backup: %s\n' "$BACKUP"
