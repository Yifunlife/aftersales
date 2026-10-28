#!/bin/bash
set -euo pipefail
cp -a /etc/nginx/conf.d/yw-park-os.conf /var/backups/yifun-aftersales/central-before-default-tls-fix.conf
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/nginx/conf.d/yw-park-os.conf');s=p.read_text();s=s.replace('listen 443 ssl;', 'listen 443 ssl default_server;',1);p.write_text(s)
PY
nginx -t
systemctl reload nginx
sleep 1
curl -fsS --max-time 10 https://47.116.18.155/api/auth/status
printf '\nOriginal IP certificate restored as the explicit default.\n'
