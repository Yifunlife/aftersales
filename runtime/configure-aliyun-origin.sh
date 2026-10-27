#!/bin/bash
set -euo pipefail
[ "$(id -u)" = 0 ]
HOSTNAME_ORIGIN=aftersales-origin.yifunlife.cn
CONF=/etc/nginx/conf.d/yifun-aftersales-origin.conf
CERT=/etc/letsencrypt/live/yifun-aftersales-origin
curl -fsS --max-time 10 http://127.0.0.1:3000/api/auth/status >/dev/null
# Preserve the pre-existing IP virtual host as default before adding another TLS server.
cp -a /etc/nginx/conf.d/yw-park-os.conf /var/backups/yifun-aftersales/central-before-origin-default.conf
python3 - <<'PYDEFAULT'
from pathlib import Path
p=Path('/etc/nginx/conf.d/yw-park-os.conf');s=p.read_text()
if 'listen 443 ssl default_server;' not in s:
    if s.count('listen 443 ssl;')!=1:raise SystemExit('Unexpected central TLS configuration; no change applied')
    p.write_text(s.replace('listen 443 ssl;','listen 443 ssl default_server;',1))
PYDEFAULT
getent ahostsv4 "$HOSTNAME_ORIGIN" | awk '{print $1}' | grep -qx 47.116.18.155
cat > "$CONF" <<'NGINX'
server {
  listen 80;
  server_name aftersales-origin.yifunlife.cn;
  server_tokens off;
  location ^~ /.well-known/acme-challenge/ {
    root /var/lib/yw-acme-webroot;
    default_type text/plain;
    try_files $uri =404;
  }
  location / { return 404; }
}
NGINX
nginx -t
systemctl reload nginx
/opt/yw-certbot/bin/certbot certonly --webroot -w /var/lib/yw-acme-webroot --cert-name yifun-aftersales-origin -d "$HOSTNAME_ORIGIN" --non-interactive
cat >> "$CONF" <<'NGINX'
server {
  listen 443 ssl;
  server_name aftersales-origin.yifunlife.cn;
  ssl_certificate /etc/letsencrypt/live/yifun-aftersales-origin/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yifun-aftersales-origin/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  server_tokens off;
  client_max_body_size 22m;
  access_log off;
  location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 180s;
    proxy_send_timeout 180s;
    proxy_buffering off;
  }
}
NGINX
nginx -t
systemctl reload nginx
curl -fsS --max-time 10 "https://$HOSTNAME_ORIGIN/__health"
curl -fsS --max-time 10 http://127.0.0.1:3000/api/auth/status >/dev/null
systemctl is-enabled yw-ip-cert-renew.timer
printf '\nIndependent TLS origin ready; existing renewal timer includes its certificate.\n'
