# Twikoo → Artalk Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a Vercel/Netlify-hosted Twikoo comment backend with a self-hosted Artalk instance on a remote VPS, behind a Caddy reverse proxy with automatic HTTPS, and migrate all existing comment data without breaking page-to-comment mapping.

**Architecture:** Single VPS running `docker compose` with two services — `artalk` (built-in SQLite, no external DB) and `caddy` (TLS termination + reverse proxy on an internal network). Artalk data lives in a bind-mounted `./data/` volume. Twikoo comments are exported as JSON from the Vercel-hosted admin panel, converted to Artrans format via https://artransfer.netlify.app, and imported into Artalk via `artalk import`.

**Tech Stack:**

- Container images: `artalk/artalk-go:latest`, `caddy:2-alpine`
- Storage: Artalk built-in SQLite at `/data/artalk.db`, plus `/data/artalk-img/` for uploads
- TLS: Caddy with Let's Encrypt auto-renewal
- Data-transfer tool: Artransfer (web) → `.artrans` → `artalk import -p '{...}'`

**Assumptions:**

- User has root/sudo on the VPS with a public IPv4 address
- Docker Engine ≥ 24 and `docker compose` plugin are already installed on the VPS
- A subdomain (e.g. `comments.example.com`) has been decided and DNS is editable
- Existing Twikoo admin credentials are available for one final export
- No external DB is required — Artalk's default SQLite is sufficient (per user decision)

**Deployment path on VPS:** `/srv/artalk/` (adjust if user prefers elsewhere; all paths below assume this root)

---

## File Structure

On the VPS:

```
/srv/artalk/
├── docker-compose.yml    # 2-service stack (artalk + caddy)
├── .env                  # Secrets + per-host settings (chmod 600)
├── Caddyfile             # TLS + reverse proxy
├── data/                 # Artalk SQLite + uploaded images (bind mount)
├── caddy/
│   ├── data/             # Caddy cert & account data
│   └── config/           # Caddy runtime state
└── imports/              # Drop .artrans files here for migration (bind mount)
```

Each file has one responsibility:

| File                 | Responsibility                                                                 |
| -------------------- | ------------------------------------------------------------------------------ |
| `docker-compose.yml` | Service topology, volumes, network, restart policy                             |
| `.env`               | Host-specific variables (domain, app key, timezone) — never committed          |
| `Caddyfile`          | TLS cert + reverse proxy rules + header forwarding                             |
| `data/`              | All Artalk state — the single thing to back up                                 |
| `imports/`           | Scratch space for migration artefacts (read-only to artalk via separate mount) |

---

## Task 1: Create VPS working directory and .env skeleton

**Files:**

- Create: `/srv/artalk/.env`
- Create: `/srv/artalk/.gitignore` (defensive — in case the dir is later version-controlled)

- [ ] **Step 1: Create base directory structure on the VPS**

Run on VPS:

```bash
sudo mkdir -p /srv/artalk/{data,caddy/data,caddy/config,imports}
sudo chown -R "$USER":"$USER" /srv/artalk
cd /srv/artalk
```

Expected: `ls /srv/artalk` shows `caddy  data  imports`.

- [ ] **Step 2: Generate a random `ATK_APP_KEY`**

Run on VPS:

```bash
openssl rand -hex 32
```

Copy the 64-char hex output — you will paste it into `.env` in the next step.

Expected: 64 hex characters on stdout. Example: `9fa1...c8b2` (do not reuse the example).

- [ ] **Step 3: Write `.env`**

Create `/srv/artalk/.env` with the following content (substitute real values):

```env
# ========== Host-specific ==========
ARTALK_DOMAIN=comments.example.com
ACME_EMAIL=you@example.com
TZ=Asia/Shanghai

# ========== Artalk core ==========
ATK_LOCALE=zh-CN
ATK_SITE_DEFAULT=My Blog
ATK_SITE_URL=https://blog.example.com
# Space-separated list of origins allowed to embed Artalk (CORS)
ATK_TRUSTED_DOMAINS=https://blog.example.com https://comments.example.com

# ========== Security ==========
# Paste output of `openssl rand -hex 32` here — never commit
ATK_APP_KEY=<paste-64-hex-chars-here>

# ========== Database (SQLite, built-in, no external service) ==========
ATK_DB_TYPE=sqlite
ATK_DB_FILE=/data/artalk.db
```

- [ ] **Step 4: Lock down `.env` permissions**

Run on VPS:

```bash
chmod 600 /srv/artalk/.env
ls -l /srv/artalk/.env
```

Expected: `-rw------- 1 <user> <user>` on the `.env` line.

- [ ] **Step 5: Write a defensive `.gitignore`**

Create `/srv/artalk/.gitignore`:

```gitignore
.env
data/
caddy/data/
caddy/config/
imports/
*.artrans
*.json
```

- [ ] **Step 6: Commit to a local ops repo (optional)**

If the ops directory is tracked in git, run:

```bash
cd /srv/artalk
git init -q
git add .gitignore
git commit -m "chore: scaffold artalk deploy dir"
```

Skip if the VPS dir is not under version control.

---

## Task 2: Write `docker-compose.yml`

**Files:**

- Create: `/srv/artalk/docker-compose.yml`

- [ ] **Step 1: Write the compose file**

Create `/srv/artalk/docker-compose.yml` with exactly this content:

```yaml
name: artalk-stack

services:
  artalk:
    image: artalk/artalk-go:latest
    container_name: artalk
    restart: unless-stopped
    environment:
      TZ: ${TZ}
      ATK_LOCALE: ${ATK_LOCALE}
      ATK_SITE_DEFAULT: ${ATK_SITE_DEFAULT}
      ATK_SITE_URL: ${ATK_SITE_URL}
      ATK_TRUSTED_DOMAINS: ${ATK_TRUSTED_DOMAINS}
      ATK_APP_KEY: ${ATK_APP_KEY}
      ATK_DB_TYPE: ${ATK_DB_TYPE}
      ATK_DB_FILE: ${ATK_DB_FILE}
      ATK_HOST: 0.0.0.0
      ATK_PORT: '23366'
    volumes:
      - ./data:/data
      - ./imports:/imports:ro
    expose:
      - '23366'
    networks:
      - artalk-net
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:23366/api/v2/version']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  caddy:
    image: caddy:2-alpine
    container_name: artalk-caddy
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp'
    environment:
      ARTALK_DOMAIN: ${ARTALK_DOMAIN}
      ACME_EMAIL: ${ACME_EMAIL}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy/data:/data
      - ./caddy/config:/config
    networks:
      - artalk-net
    depends_on:
      artalk:
        condition: service_started

networks:
  artalk-net:
    driver: bridge
```

Design notes (why, not what):

- `expose` (not `ports`) on `artalk`: the backend is reachable only on the internal Docker network, never on the host. Only Caddy owns :80/:443.
- `imports` is mounted read-only into Artalk — the migration pipeline writes to the VPS host, the container can only read.
- Healthcheck pings Artalk's version endpoint so Compose will report container health accurately.
- `ATK_HOST=0.0.0.0` is required inside the container so Caddy can reach it across the bridge network.

- [ ] **Step 2: Verify compose file parses**

Run on VPS from `/srv/artalk`:

```bash
docker compose config --quiet && echo OK
```

Expected: `OK`. Any other output = YAML or variable-expansion error; fix before proceeding.

---

## Task 3: Write `Caddyfile`

**Files:**

- Create: `/srv/artalk/Caddyfile`

- [ ] **Step 1: Write the Caddyfile**

Create `/srv/artalk/Caddyfile`:

```caddy
{
	email {$ACME_EMAIL}
}

{$ARTALK_DOMAIN} {
	encode zstd gzip

	reverse_proxy artalk:23366 {
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
		header_up Host {host}
	}

	log {
		output file /data/access.log {
			roll_size 10mb
			roll_keep 5
		}
		format console
	}
}
```

Design notes:

- The service name `artalk` (not `localhost`) resolves via Docker's embedded DNS on the shared `artalk-net`.
- `X-Forwarded-For` is required so Artalk logs real visitor IPs instead of the Caddy container's bridge IP (per Artalk reverse-proxy docs).
- Log roll-over keeps access.log bounded; logs live in the Caddy data volume and survive restarts.

- [ ] **Step 2: Verify Caddy syntax**

Run on VPS from `/srv/artalk`:

```bash
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -e ARTALK_DOMAIN=example.com -e ACME_EMAIL=dev@example.com \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

Expected: `Valid configuration` on stdout (exit 0). Warnings about placeholder env vars are OK at this stage.

---

## Task 4: Point DNS and verify propagation

**Files:** None (external action).

- [ ] **Step 1: Create A/AAAA record**

In the user's DNS provider console, create:

- `A` record: `comments.example.com` → `<VPS IPv4>`
- (Optional) `AAAA` record: `comments.example.com` → `<VPS IPv6>`

Use the exact subdomain value you put in `ARTALK_DOMAIN` in `.env`.

- [ ] **Step 2: Wait for DNS propagation and verify**

Run on a non-VPS machine:

```bash
dig +short comments.example.com
```

Expected: the VPS IP address, nothing else. If empty or stale, wait up to the TTL and retry.

- [ ] **Step 3: Confirm :80 reachable from internet**

Run on VPS:

```bash
sudo ss -lntp | grep -E ':80|:443' || echo "ports not yet bound"
```

At this point, nothing should be listening — that's fine. The goal is to confirm no other process (old nginx, etc.) is squatting on :80/:443 before Caddy starts. If anything is listed, stop/disable it before Task 5.

---

## Task 5: First boot — bring up Artalk only

**Files:** None (operational).

- [ ] **Step 1: Pull images**

Run on VPS from `/srv/artalk`:

```bash
docker compose pull
```

Expected: both `artalk/artalk-go:latest` and `caddy:2-alpine` pulled successfully.

- [ ] **Step 2: Start only the artalk service**

Run on VPS:

```bash
docker compose up -d artalk
```

Expected: `Container artalk  Started`.

- [ ] **Step 3: Verify it initialized SQLite and is healthy**

Run on VPS:

```bash
docker compose ps artalk
ls -la /srv/artalk/data
```

Expected:

- `docker compose ps`: STATUS `Up ... (healthy)` within ~30s.
- `ls` on `data/`: file `artalk.db` (and optionally `artalk-img/`) exists with non-zero size.

If STATUS shows `unhealthy`, run `docker compose logs artalk | tail -50` and fix before continuing.

- [ ] **Step 4: Hit the version endpoint from inside the network**

Run on VPS:

```bash
docker compose exec artalk wget -qO- http://127.0.0.1:23366/api/v2/version
```

Expected: a JSON blob containing a `version` field. Non-JSON or connection refused = backend is not listening; check logs.

---

## Task 6: Bring up Caddy and obtain the TLS cert

**Files:** None (operational).

- [ ] **Step 1: Start caddy**

Run on VPS from `/srv/artalk`:

```bash
docker compose up -d caddy
docker compose logs -f caddy
```

Watch the logs for ~30s — you should see lines containing `certificate obtained successfully` and `serving initial configuration`.

Ctrl-C to stop tailing once the cert is obtained.

Gotcha: if you see `challenge did not pass` / `connection refused`, the most common causes are (a) DNS not yet propagated, (b) a firewall blocking :80 (Let's Encrypt HTTP-01 challenge needs :80 reachable from the internet), or (c) another process still bound to :80. Fix the cause before retrying — do not delete certs.

- [ ] **Step 2: Verify HTTPS from outside the VPS**

Run on a non-VPS machine:

```bash
curl -Is "https://comments.example.com/api/v2/version" | head -1
curl -s  "https://comments.example.com/api/v2/version"
```

Expected:

- First command: `HTTP/2 200`.
- Second command: JSON with `version` field.

- [ ] **Step 3: Verify real client IP is reaching Artalk**

Run on VPS:

```bash
docker compose logs artalk --tail 20
```

Look at recent access lines — the client IP should match the IP of the machine you just ran `curl` from, not the Caddy container's `172.x.x.x` bridge IP. If it shows the bridge IP, the `header_up X-Forwarded-For` directive in Caddyfile is missing or mis-spelled.

---

## Task 7: Create the initial admin user

**Files:** None (operational).

- [ ] **Step 1: Run interactive admin creation**

Run on VPS from `/srv/artalk`:

```bash
docker compose exec artalk artalk admin
```

Follow prompts: username, email, password. Use a password manager — this is your root account.

- [ ] **Step 2: Log in to the dashboard**

Open in browser: `https://comments.example.com/dashboard/`

Expected: login page renders with Artalk branding; submitting the credentials you just set succeeds and the dashboard home loads.

- [ ] **Step 3: Confirm the dashboard reports the right site URL**

In the dashboard, navigate to `Sites` → verify the default site name equals `ATK_SITE_DEFAULT` from `.env`, and that its URL matches `ATK_SITE_URL`. If not, edit in the UI (don't re-deploy).

---

## Task 8: Export Twikoo data from Vercel-hosted instance

**Files:**

- Create (locally, not on VPS): `~/artalk-migration/twikoo-export.json`

- [ ] **Step 1: Log in to the Twikoo admin**

Open your blog page that currently has Twikoo, click the settings/gear icon, enter the Twikoo admin password. The admin panel should open inline.

- [ ] **Step 2: Export all data as JSON**

In the Twikoo admin panel:

1. Go to `管理` → `导入导出` (Management → Import/Export) tab.
2. Source: `Twikoo`. Click `导出` / `Export`.
3. Save the downloaded file as `~/artalk-migration/twikoo-export.json` on your local workstation.

Expected: JSON file, size usually a few hundred KB for a small blog. Open it — the top-level should be an array of comment objects with fields like `url`, `nick`, `mail`, `comment`, `created`.

- [ ] **Step 3: Sanity-check the export**

Run locally:

```bash
jq '. | length' ~/artalk-migration/twikoo-export.json
jq '.[0] | keys' ~/artalk-migration/twikoo-export.json
```

Expected:

- First: integer count of comments (matches your Twikoo dashboard's total).
- Second: an array of keys including at least `url`, `nick`, `mail`, `comment`, `created`.

If either fails: the export may be paginated or wrapped in an envelope object — open the file, inspect, and adjust the conversion step accordingly (Artransfer handles both shapes).

---

## Task 9: Convert Twikoo JSON → Artrans

**Files:**

- Create (locally): `~/artalk-migration/comments.artrans`

- [ ] **Step 1: Upload to the Artransfer web tool**

In a browser, open: `https://artransfer.netlify.app`

1. Source format: `Twikoo`.
2. Target format: `Artrans`.
3. Click `Choose File` and pick `~/artalk-migration/twikoo-export.json`.
4. Click `Convert`.
5. Click `Download .artrans`, save as `~/artalk-migration/comments.artrans`.

- [ ] **Step 2: Verify Artrans file structure**

Run locally:

```bash
head -c 500 ~/artalk-migration/comments.artrans
wc -l ~/artalk-migration/comments.artrans
```

Expected:

- `head` output: JSON-array-shaped text, first entries containing fields like `"content"`, `"nick"`, `"email"`, `"page_key"`, `"page_url"`, `"created_at"`.
- `wc -l`: non-zero line count (Artrans is typically one JSON object per line, possibly wrapped in an outer `[...]`).

If the file is empty or HTML: the conversion tool failed silently — check the Twikoo export shape and retry.

---

## Task 10: Upload Artrans file to VPS and dry-run import

**Files:** None (operational).

- [ ] **Step 1: Copy the file to the VPS import directory**

Run locally:

```bash
scp ~/artalk-migration/comments.artrans <vps-user>@<vps-host>:/srv/artalk/imports/comments.artrans
```

- [ ] **Step 2: Confirm it is visible inside the container**

Run on VPS:

```bash
docker compose exec artalk ls -la /imports/
```

Expected: `comments.artrans` listed, size matches local file (`ls -la ~/artalk-migration/comments.artrans`).

- [ ] **Step 3: Take a pre-import backup of the SQLite DB**

Run on VPS:

```bash
cp /srv/artalk/data/artalk.db /srv/artalk/data/artalk.db.pre-import.$(date +%Y%m%d-%H%M%S)
ls -la /srv/artalk/data/artalk.db.pre-import.*
```

Expected: the timestamped backup file listed. This is the rollback point if import corrupts data.

---

## Task 11: Import the data into Artalk

**Files:** None (operational).

- [ ] **Step 1: Run `artalk import` inside the container**

Run on VPS from `/srv/artalk`. Replace `https://blog.example.com` with the real URL of the blog where the comments originally lived (same host you had Twikoo on).

```bash
docker compose exec artalk artalk import \
  -p '{"target_site_name":"My Blog","target_site_url":"https://blog.example.com","url_resolver":true}' \
  /imports/comments.artrans
```

Flag meanings (per Artalk transfer docs):

- `target_site_name`: must match an existing site name in Artalk dashboard (created in Task 7's implicit default).
- `target_site_url`: used by `url_resolver` to rebuild `page_key` values.
- `url_resolver: true`: normalises URL-based `page_key`s (strips query strings, unifies trailing slashes) — without this, `/post/1` and `/post/1/` become two different pages.

Expected: output ending with a summary like `imported N comments, skipped M` and exit code 0.

- [ ] **Step 2: Verify row count in the dashboard**

Open `https://comments.example.com/dashboard/` → `Comments`.

Expected: the total comment count equals the number you got from `jq '. | length'` in Task 8 Step 3 (minus any `skipped` count from Step 1 output).

- [ ] **Step 3: Spot-check a known page**

Pick a blog URL you know has comments (e.g. `https://blog.example.com/post/foo`). In the dashboard:

1. Filter by `page_key` containing `/post/foo`.
2. Verify the comment bodies, author names, and timestamps match what you see in the old Twikoo.

If timestamps are all "now" instead of original dates: the `created_at` field was not preserved during conversion — re-run Task 9 with the correct source format selection and re-import after restoring the pre-import backup.

---

## Task 12: Update the blog frontend to point to Artalk

**Files:** Depends on the blog codebase (outside this repo). This task is generic guidance; adapt file paths to the actual blog stack (Hexo / Hugo / Astro / VitePress etc.).

- [ ] **Step 1: Remove the Twikoo embed**

In the blog's post-layout template, delete the existing Twikoo block. It usually looks like:

```html
<div id="tcomment"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@1.6.x/dist/twikoo.all.min.js"></script>
<script>
  twikoo.init({ envId: '<vercel-fn-url>', el: '#tcomment' })
</script>
```

- [ ] **Step 2: Add the Artalk embed in the same spot**

Replace with:

```html
<div id="Comments"></div>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/artalk/2.9.1/Artalk.css" />
<script type="module">
  import Artalk from 'https://esm.sh/artalk@2.9.1'

  Artalk.init({
    el: '#Comments',
    pageKey: window.location.pathname,
    pageTitle: document.title,
    server: 'https://comments.example.com',
    site: 'My Blog',
  })
</script>
```

Pin `2.9.1` in both `<link>` and `import` to match your backend major version; bump both together when upgrading.

`pageKey: window.location.pathname` matches what `url_resolver: true` produced on import — this is what makes imported comments appear on the right pages. Do NOT use `window.location.href` here; it includes origin and query, which won't match the imported keys.

- [ ] **Step 3: Update CORS / trusted domains in `.env` if the blog origin differs from what you seeded**

Re-check `ATK_TRUSTED_DOMAINS` in `/srv/artalk/.env`. It must contain the exact origin(s) of the blog (scheme + host, no trailing slash), separated by spaces.

If you need to change it:

```bash
cd /srv/artalk
# edit .env
docker compose up -d artalk   # re-reads env on recreate
```

- [ ] **Step 4: Deploy the blog and smoke-test**

Deploy the blog per its normal pipeline. Then:

1. Open a post page in an incognito window.
2. Verify the Artalk UI renders (not a blank div or 403/CORS error).
3. Verify imported comments from Task 11 appear on the right page.
4. Post a new comment as an anonymous user → verify it appears immediately (or is pending if moderation is on).
5. Open the dashboard → verify the new comment is recorded and tied to the correct `page_key`.

If you see `Origin not allowed` in the browser console: `ATK_TRUSTED_DOMAINS` is wrong — see Step 3.

---

## Task 13: Decommission Twikoo

**Files:** External (Vercel / Netlify / MongoDB Atlas consoles).

Do not run this task until Task 12 has been live for at least 24 hours and you have confirmed no regressions.

- [ ] **Step 1: Take a final archive of Twikoo data**

Keep the JSON from Task 8 Step 2, plus re-export one more time to catch any late-arriving comments. Store both files in cold storage (e.g. private git repo, cloud backup).

- [ ] **Step 2: Tear down the Vercel/Netlify function**

In the Vercel or Netlify dashboard, delete the Twikoo project (or at minimum, remove its production domain).

- [ ] **Step 3: Delete the MongoDB Atlas cluster (if applicable)**

If Twikoo was backed by a dedicated MongoDB Atlas cluster, in the Atlas console: `Clusters` → your cluster → `Terminate`. Confirm you have the export from Step 1 first — this is irreversible.

- [ ] **Step 4: Remove the Twikoo DNS record (if any)**

If you had a custom subdomain pointing at the Vercel function (e.g. `twikoo.example.com`), delete the DNS record.

---

## Task 14: Backup & ops runbook

**Files:**

- Create: `/srv/artalk/backup.sh`
- Create: `/srv/artalk/RUNBOOK.md`

- [ ] **Step 1: Write the backup script**

Create `/srv/artalk/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Backs up the entire Artalk data directory to a timestamped tarball.
# Run from cron or manually; the SQLite file is safe to copy while Artalk
# is running thanks to SQLite's WAL mode, but `compose stop artalk` first
# for a stricter guarantee.

BACKUP_DIR="${BACKUP_DIR:-/srv/artalk/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/artalk-${STAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"
cd /srv/artalk
tar czf "${ARCHIVE}" data/

# Keep only the last 14 archives.
ls -1t "${BACKUP_DIR}"/artalk-*.tar.gz | tail -n +15 | xargs -r rm --

echo "backup ok: ${ARCHIVE}"
```

Set executable:

```bash
chmod +x /srv/artalk/backup.sh
```

- [ ] **Step 2: Smoke-test the backup**

Run on VPS:

```bash
/srv/artalk/backup.sh
ls -lh /srv/artalk/backups/
```

Expected: one `artalk-<timestamp>.tar.gz` file, non-trivial size.

- [ ] **Step 3: Schedule it (daily at 03:17)**

Run on VPS:

```bash
(crontab -l 2>/dev/null; echo "17 3 * * * /srv/artalk/backup.sh >> /var/log/artalk-backup.log 2>&1") | crontab -
crontab -l | grep artalk-backup
```

Expected: the line is listed. Check `/var/log/artalk-backup.log` tomorrow morning.

- [ ] **Step 4: Write a short runbook**

Create `/srv/artalk/RUNBOOK.md`:

```markdown
# Artalk VPS runbook

## Start / stop / restart

    docker compose up -d          # all
    docker compose restart artalk # just the backend (e.g. after .env edit)
    docker compose down           # everything, keep data

## Upgrade (artalk or caddy)

    docker compose pull
    docker compose up -d
    docker compose logs -f

## Restore from backup

    cd /srv/artalk
    docker compose down
    tar xzf backups/artalk-YYYYMMDD-HHMMSS.tar.gz
    docker compose up -d

## Create additional admin user

    docker compose exec artalk artalk admin

## Drop into artalk DB

    docker compose exec artalk sqlite3 /data/artalk.db
    # e.g. SELECT count(*) FROM atk_comments;

## Logs

    docker compose logs artalk --tail 200
    docker compose logs caddy  --tail 200
    tail -f caddy/data/access.log
```

- [ ] **Step 5: Final commit (if dir is versioned)**

```bash
cd /srv/artalk
git add docker-compose.yml Caddyfile backup.sh RUNBOOK.md .gitignore
git commit -m "feat: artalk stack + runbook + backup"
```

---

## Rollback plan

If anything between Task 11 and Task 13 goes wrong and you need to revert to Twikoo:

1. **Frontend rollback only** (Task 12 broke something, but Artalk data is fine): revert the blog's post template to the Twikoo snippet, redeploy. Artalk stays running silently — no harm.
2. **Data corruption after import** (Task 11 produced bad rows): stop Artalk, restore the pre-import DB backup you took in Task 10 Step 3, restart, re-run import with fixed parameters:
   ```bash
   docker compose stop artalk
   cp /srv/artalk/data/artalk.db.pre-import.<stamp> /srv/artalk/data/artalk.db
   docker compose start artalk
   ```
3. **Full abandonment**: re-enable the Vercel/Netlify function (don't run Task 13 until you're sure) and revert the frontend template.

---

## Known gotchas

- **`pageKey` mismatch**: Twikoo's `url` field stores the path at comment time. Artalk's `pageKey` is whatever you send from the frontend at render time. If your blog has changed URL schemes since Twikoo was first set up, even `url_resolver: true` won't save you — imported comments will map to dead pages. Before Task 11, grep the Twikoo export for old URL patterns (`jq -r '.[].url' twikoo-export.json | sort -u`) and, if you find stale ones, either fix them via `sed` before conversion or accept the orphans.
- **CORS errors after domain switch**: `ATK_TRUSTED_DOMAINS` is space-separated, not comma-separated. Comma-separated values parse as one giant origin and reject everything.
- **Let's Encrypt rate limits**: Caddy retries aggressively on cert failure. If you hit the 5-failures-per-hour LE limit during DNS debugging, stop Caddy entirely (`docker compose stop caddy`) until the DNS issue is fixed, then start it once — do not leave it loop-failing.
- **SQLite vs concurrent writes**: the default SQLite is fine for personal blogs. If you start getting `database is locked` errors in Artalk logs (>10 concurrent writers), that's the time to switch to PostgreSQL — not before. Switching is non-trivial (dump + restore), so premature switching is its own waste.
- **`docker compose exec artalk artalk admin` requires a TTY**: run it from an interactive SSH session, not from a script. If you must script admin creation, set `ATK_ADMIN_USERS` instead (see env-var docs).
