#!/bin/bash
set -euo pipefail
[ "$(id -u)" = 0 ]
PUBLIC=aftersales.shyiwan.com
ORIGIN=aftersales-origin.shyiwan.com
CONF=/etc/nginx/conf.d/yifun-aftersales-shyiwan.conf
CERTNAME=yifun-aftersales-shyiwan
curl -fsS --max-time 10 https://47.116.18.155/api/auth/status >/dev/null
# Keep the original central IP certificate as the default TLS virtual host.
python3 - <<'PYDEFAULT'
from pathlib import Path
p=Path('/etc/nginx/conf.d/yw-park-os.conf');s=p.read_text()
if 'listen 443 ssl default_server;' not in s:
    if s.count('listen 443 ssl;')!=1:raise SystemExit('Unexpected central TLS configuration; no change applied')
    Path('/var/backups/yifun-aftersales/central-before-public-origin.conf').write_text(s)
    p.write_text(s.replace('listen 443 ssl;','listen 443 ssl default_server;',1))
PYDEFAULT
for host in "$PUBLIC" "$ORIGIN"; do getent ahostsv4 "$host" | awk '{print $1}' | grep -qx 47.116.18.155; done
umask 077
if [ ! -f "/etc/letsencrypt/live/$CERTNAME/fullchain.pem" ]; then
cat > "$CONF" <<'NGINX'
server {
 listen 80;
 server_name aftersales.shyiwan.com aftersales-origin.shyiwan.com;
 location ^~ /.well-known/acme-challenge/ { root /var/lib/yw-acme-webroot; default_type text/plain; try_files $uri =404; }
 location / { return 404; }
}
NGINX
nginx -t
systemctl reload nginx
/opt/yw-certbot/bin/certbot certonly --webroot -w /var/lib/yw-acme-webroot --cert-name "$CERTNAME" -d "$PUBLIC" -d "$ORIGIN" --non-interactive
fi
install -o root -g yifun-aftersales -m 640 /home/yw-deploy/yifun-aftersales/shared/runtime.json /etc/yifun-aftersales/runtime.json
python3 - <<'PY'
import json,re
from pathlib import Path
config=Path('/etc/yifun-aftersales/runtime.json')
c=json.loads(config.read_text())
c['publicHost']='aftersales.shyiwan.com'
c['publicHosts']=list(dict.fromkeys(c.get('publicHosts',[])+[c['publicHost']]))
config.write_text(json.dumps(c))
key=c['originSecret'];assert re.fullmatch('[a-f0-9]{64}',key)
cert='/etc/letsencrypt/live/yifun-aftersales-shyiwan/'
common='''
 ssl_protocols TLSv1.2 TLSv1.3;
 server_tokens off;
 client_max_body_size 22m;
 access_log off;
 add_header X-Yifun-Runtime aliyun-node always;
'''
proxy='''
  proxy_pass http://127.0.0.1:3100;
  proxy_http_version 1.1;
  proxy_set_header X-Forwarded-Proto https;
  proxy_read_timeout 180s;
  proxy_send_timeout 180s;
  proxy_buffering off;
'''
s='''server {
 listen 80;
 server_name aftersales.shyiwan.com aftersales-origin.shyiwan.com;
 server_tokens off;
 location ^~ /.well-known/acme-challenge/ { root /var/lib/yw-acme-webroot; default_type text/plain; try_files $uri =404; }
 location / { return 301 https://aftersales.shyiwan.com$request_uri; }
}
'''
for host,public in [('aftersales.shyiwan.com',True),('aftersales-origin.shyiwan.com',False)]:
 s+='server {\n listen 443 ssl;\n server_name '+host+';\n ssl_certificate '+cert+'fullchain.pem;\n ssl_certificate_key '+cert+'privkey.pem;\n'+common+' location / {\n'+proxy
 if public:
  s+='  proxy_set_header Host aftersales.shyiwan.com;\n  proxy_set_header X-Forwarded-Host aftersales.shyiwan.com;\n  proxy_set_header CF-Connecting-IP $remote_addr;\n  proxy_set_header X-Forwarded-For $remote_addr;\n  proxy_set_header X-Yifun-Origin-Key "'+key+'";\n'
 else:s+='  proxy_set_header Host $host;\n'
 s+=' }\n}\n'
p=Path('/etc/nginx/conf.d/yifun-aftersales-shyiwan.conf');p.write_text(s);p.chmod(0o600)
PY
nginx -t
systemctl restart yifun-aftersales.service
for attempt in $(seq 1 20); do if curl -fsS --max-time 2 http://127.0.0.1:3100/__health >/dev/null 2>&1; then break; fi; sleep 1; done
curl -fsS --max-time 5 http://127.0.0.1:3100/__health >/dev/null
systemctl reload nginx
sleep 1
curl -fsS --max-time 10 https://47.116.18.155/api/auth/status
curl -fsS --max-time 15 "https://$PUBLIC/api/auth/status"
systemctl is-active yw-park-os.service yifun-aftersales.service
printf '\nIndependent public aftersales site configured.\n'
