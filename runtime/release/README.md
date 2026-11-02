# Independent aftersales releases

A push to `main` builds and checks the Node standalone service in GitHub Actions. Its dedicated SSH key is forced through a root-owned gate supporting only `upload`, `deploy`, `status`, and `rollback`; it cannot open a shell or forward ports. The pinned SSH host key comes from the already trusted maintenance connection. No application, database or WeCom secrets are stored in GitHub.

The root controller can only install under `/opt/yifun-aftersales/releases`, change the `current`/`previous` links, and restart `yifun-aftersales.service`. It does not alter central-service files, runtime configuration, firewall rules or employee permissions. Artifacts reject traversal, symlinks, hardlinks, devices, duplicate paths and excessive expansion.

Pending D1 migrations run through the existing private resource bridge, one transaction per migration, with the migration marker in the same transaction. Migration files must be forward-compatible with the previous application version. Application rollback deliberately retains database migrations and business data; destructive schema changes require a separate reviewed rollout. An artifact missing database migration history is rejected.

Before activation the central service must be healthy. Afterwards both the aftersales account API and central service must remain healthy. If activation or health checks fail, the prior application release is restored automatically. Each successful operation is recorded in `/var/log/yifun-aftersales-release.log`.

## One-time administrator installation

Copy `controller.py`, `ssh-gate.py`, `install.sh`, and the dedicated CI **public** key named `ci-key.pub` into `/home/yw-deploy/yifun-aftersales/release-setup`. Review them and run `bash /home/yw-deploy/yifun-aftersales/release-setup/install.sh` through the existing server administration console. The installer grants `yw-deploy` only the three exact controller commands via sudo and appends the restricted CI public key without replacing existing maintenance keys.

GitHub repository secrets:

- `AFTERSALES_RELEASE_KEY`: dedicated CI private key, never the maintenance key.
- `AFTERSALES_RELEASE_HOSTS`: pinned existing server host key.

The old Cloudflare workflow is manual-only: that Worker serves the private resource bridge/front door. Ordinary application updates deploy the Aliyun Node service only.

## Operations

GitHub Actions → **Aftersales production** → Run workflow on `main`. Choose `deploy` or `rollback`. Alternatively, from the existing maintenance connection:

```sh
ssh yw-aliyun sudo -n /usr/local/bin/yifun-aftersales-release status
ssh yw-aliyun sudo -n /usr/local/bin/yifun-aftersales-release rollback
```

Rollback is available once this channel has completed its first release. It restores the application, not database contents. To remove this release channel, an administrator must remove its sudoers rule and CI key entry and delete the GitHub release secrets; existing maintenance login and the running application can remain intact.
