#!/bin/bash
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Administrator installation required.'; exit 1; }
SOURCE=/home/yw-deploy/yifun-aftersales/release-setup
[ -f "$SOURCE/controller.py" ] && [ -f "$SOURCE/ssh-gate.py" ]
[ -f "$SOURCE/ci-key.pub" ]
[ "$(wc -l < "$SOURCE/ci-key.pub")" = 1 ]
/usr/bin/python3 -c 'import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text()) for p in sys.argv[1:]]' "$SOURCE/controller.py" "$SOURCE/ssh-gate.py"
install -o root -g root -m 755 "$SOURCE/controller.py" /usr/local/bin/yifun-aftersales-release
install -o root -g root -m 755 "$SOURCE/ssh-gate.py" /usr/local/bin/yifun-aftersales-ci
install -d -o yw-deploy -g yw-deploy -m 700 /home/yw-deploy/yifun-aftersales/incoming
RULE=$(mktemp)
trap 'rm -f "$RULE"' EXIT
printf '%s\n' 'yw-deploy ALL=(root) NOPASSWD: /usr/local/bin/yifun-aftersales-release deploy, /usr/local/bin/yifun-aftersales-release rollback, /usr/local/bin/yifun-aftersales-release status' > "$RULE"
/usr/sbin/visudo -cf "$RULE"
install -o root -g root -m 440 "$RULE" /etc/sudoers.d/yifun-aftersales-release
/usr/bin/python3 - <<'PY'
import pathlib,re,os
source=pathlib.Path('/home/yw-deploy/yifun-aftersales/release-setup/ci-key.pub').read_text().strip()
if not re.fullmatch(r'ssh-ed25519 [A-Za-z0-9+/=]+ aftersales-github-actions',source):raise ValueError('Unexpected CI key')
path=pathlib.Path('/home/yw-deploy/.ssh/authorized_keys')
text=path.read_text() if path.exists() else ''
# Replace only this release key's prior entry, preserving all existing maintenance access.
lines=[line for line in text.splitlines() if not line.endswith(' aftersales-github-actions')]
lines.append('restrict,command="/usr/local/bin/yifun-aftersales-ci" '+source)
path.write_text('\n'.join(lines)+'\n');os.chmod(path,0o600)
PY
chown yw-deploy:yw-deploy /home/yw-deploy/.ssh/authorized_keys
/usr/local/bin/yifun-aftersales-release status
printf '%s\n' 'Independent aftersales release channel installed. Existing services and private runtime configuration unchanged.'
