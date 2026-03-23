# Admin 独立部署迁移计划：Vite+React → Cloudflare Workers

## Context

目标：从任意设备远程管理 commission 数据（目前 admin 是 dev-only 本地工具）。
策略：尽早拔掉本地数据源（SQLite 文件 + 本地磁盘图片），迁到 Cloudflare D1 + R2。

执行分支：`feat/admin-standalone`
任务跟踪：`tasks/migrate-cloudflare.md`（批准后创建）

---

## 当前架构

| 组件   | 现状                                                            |
| ------ | --------------------------------------------------------------- |
| 主站   | Astro `output: 'static'` → Cloudflare Pages（`crystallize.cc`） |
| 数据库 | SQLite 本地文件 `data/commissions.db`（6 张表）                 |
| 图片   | 本地 `data/images/`，Astro `<Image>` 构建时处理为 WebP          |
| Admin  | Dev-only，无认证，`server/adminApiHandler.ts` 直读写本地        |
| 部署   | `bun run deploy` → `wrangler deploy`                            |
| CI/CD  | 无 GitHub Actions                                               |

---

## Monorepo 结构（主站不动）

```
commission-index/             ← 主站保持根目录
  apps/
    admin/                    ← 新增 Vite+React admin SPA
      src/
      package.json
      vite.config.ts
      wrangler.jsonc           ← admin 独立配置（commission-admin）
  wrangler.jsonc               ← 主站不变（commission-index）
  package.json                 ← 添加 workspaces: ["apps/admin"]
  data/
    commissions.db             ← 迁移过程中保留，完成后归档
    images/                    ← 迁移过程中保留，完成后清空
```

**Wrangler 支持评估：** ✅ 完全支持。每个 app 独立 `wrangler.jsonc`，Cloudflare Dashboard 同一 repo 配置两个项目，各自监听各自路径。Bun workspaces 兼容（注意保持 Wrangler 版本一致）。

---

## 详细实施步骤（按顺序）

### Step 1：开新分支 + 初始化 monorepo

```bash
git checkout -b feat/admin-standalone
```

修改根 `package.json`，添加 bun workspaces：

```json
{ "workspaces": ["apps/admin"] }
```

---

### Step 2：数据库迁移 SQLite → Cloudflare D1 ⚡ 尽早执行

**目标：拔掉本地 SQLite 数据源，让主站构建读 D1。**

2a. 创建 D1 数据库：

```bash
wrangler d1 create commission-index-db
```

2b. 导出现有数据到 D1：

```bash
sqlite3 data/commissions.db .dump > /tmp/migration.sql
# 清理 SQLite 特有语法（BEGIN/COMMIT/sqlite_sequence）
wrangler d1 execute commission-index-db --remote --file=/tmp/migration.sql
```

2c. 修改 `wrangler.jsonc`，添加 D1 binding：

```jsonc
{
  "d1_databases": [
    { "binding": "DB", "database_name": "commission-index-db", "database_id": "..." }
  ]
}
```

2d. 修改 `data/sqlite.ts`：添加第三种模式——CI 环境通过 `wrangler d1 export --remote` 获取最新数据，生成临时 `.db` 文件供 Astro 构建读取（保持现有 queryAll 接口不变）。

2e. 验证：`bun run build` 确认主站构建正常读取 D1 数据。

**关键文件：**

- `data/sqlite.ts`
- `wrangler.jsonc`

---

### Step 3：图片迁移本地磁盘 → Cloudflare R2 ⚡ 尽早执行

**目标：拔掉本地 `data/images/` 依赖。**

3a. 创建 R2 bucket：

```bash
wrangler r2 bucket create commission-index-images
```

3b. 上传现有图片：

```bash
for f in data/images/*; do
  wrangler r2 object put commission-index-images/$(basename $f) --file=$f
done
```

3c. 添加 R2 binding 到 `wrangler.jsonc`：

```jsonc
{
  "r2_buckets": [{ "binding": "IMAGES", "bucket_name": "commission-index-images" }]
}
```

3d. 修改主站构建 pipeline（`package.json` build script 前加 sync 步骤）：

```bash
# 构建前从 R2 同步图片到 data/images/（保持 Astro <Image> 不变）
wrangler r2 object list commission-index-images --json | \
  jq -r '.[].key' | \
  xargs -I{} wrangler r2 object get commission-index-images/{} --file=data/images/{}
```

3e. 验证：从 R2 同步后 `bun run build` 正常，WebP 生成一致。

**关键文件：**

- `package.json`（build script）
- `wrangler.jsonc`

---

### Step 4：搭建 Admin Vite+React App 骨架

4a. 在 `apps/admin/` 初始化 Vite+React+TypeScript 项目：

```bash
cd apps/admin
bun create vite . --template react-ts
```

4b. 配置 Tailwind CSS 4.2（与主站一致）：

```bash
bun add -d @tailwindcss/vite
```

4c. 移植设计系统（保持与主站一致）：

- 复制 `src/styles/globals.css` → `apps/admin/src/styles/globals.css`（或软链接）
- 在 `apps/admin/index.html` 添加 Berkeley Mono font-face
- 复制 `public/fonts/BerkeleyMono-Regular.woff2` → `apps/admin/public/fonts/`
- 在 `apps/admin/index.html` `<head>` 加暗色模式脚本（从 `BaseLayout.astro` 复制）
- 安装 `@fontsource/ibm-plex-sans`

4d. 配置 `apps/admin/wrangler.jsonc`：

```jsonc
{
  "name": "commission-admin",
  "compatibility_date": "2026-02-05",
  "assets": { "directory": "./dist" },
  "routes": [{ "pattern": "admin.crystallize.cc", "custom_domain": true }],
  "d1_databases": [{ "binding": "DB", "database_name": "commission-index-db" }],
  "r2_buckets": [{ "binding": "IMAGES", "bucket_name": "commission-index-images" }]
}
```

4e. 配置 TypeScript path aliases（对齐现有 `#lib/*` 等）。

---

### Step 5：迁移 Admin API 到 Hono Workers Handler

5a. 安装 Hono：`bun add hono`

5b. 在 `apps/admin/src/api/` 创建 Hono app，复用现有 `server/adminApiHandler.ts` 的路由逻辑：

- 替换 `better-sqlite3` 调用 → D1 binding (`env.DB.prepare(...).all()`)
- 替换 `fs` 文件操作 → R2 binding (`env.IMAGES.put(key, body)`)
- `isDevelopment` 守卫移除（admin app 本身靠 CF Access 保护）

**关键现有文件（参考并重写）：**

- `server/adminApiHandler.ts`（569 行，所有路由逻辑）
- `src/features/admin/imageUpload.ts`（图片操作，改为 R2）
- `src/lib/admin/db.ts`（DB 层，改为 D1）

---

### Step 6：迁移 React 组件

6a. 将 `src/features/admin/` 下的所有 React 组件/hook 复制到 `apps/admin/src/features/`：

- `CommissionManager.tsx`
- `islands/AdminEditIsland.tsx` → 改为 `pages/EditPage.tsx`
- `islands/AdminCreateIsland.tsx` → 改为 `pages/CreatePage.tsx`
- `aliases/AliasesDashboard.tsx` → `pages/AliasesPage.tsx`
- `suggestion/SuggestionDashboard.tsx` → `pages/SuggestionPage.tsx`
- 所有 hooks、components、types、actions.client.ts

6b. API 基地址改为相对路径（same-origin，`/api/admin/...` 不变）。

6c. 配置 TanStack Router（file-based）：

```
apps/admin/src/routes/
  _layout.tsx        ← 公共 layout
  index.tsx          ← /
  create.tsx         ← /create
  edit.tsx           ← /edit
  aliases.tsx        ← /aliases
  suggestion.tsx     ← /suggestion
```

---

### Step 7：认证配置（Cloudflare Access）

7a. Cloudflare Dashboard → Zero Trust → Access → Applications
7b. 添加 Application，保护 `admin.crystallize.cc`
7c. 配置允许的 Identity Provider（Google 或 GitHub）
7d. 无需修改任何 app 代码

---

### Step 8：GitHub Actions 自动重建 Pipeline

8a. 创建 `.github/workflows/rebuild.yml`：

- 触发器：`repository_dispatch` (event: `admin-data-changed`)
- 步骤：checkout → bun install → R2 图片 sync → `bun run build` → `wrangler deploy`
- 需要 Secrets：`CLOUDFLARE_API_TOKEN`、`GITHUB_PAT`

8b. Admin Hono handler 在写操作成功后触发 dispatch：

```ts
// 写入 D1 成功后（非阻塞）
ctx.waitUntil(triggerRebuild(env.GITHUB_PAT))
```

---

### Step 9：验证与清理

9a. Playwright 视觉回归：更新 `admin-suggestion-dashboard-darwin.png` 快照（新 URL：`admin.crystallize.cc`）
9b. 主站构建验证：确认 D1 + R2 数据完整，无本地依赖
9c. 删除本地数据源（仅在所有验证通过后）：

- 归档 `data/commissions.db`（重命名或删除）
- 清空 `data/images/`
- 移除 `server/adminApiHandler.ts`、`server/adminApi.ts`、`server/devAdminAstro.ts`
- 移除 `astro.config.ts` 中的 `devAdminIntegration()`
- 移除 `src/features/admin/` 下主站用不到的组件

---

## 风险与缓解

| 风险             | 缓解                                                      |
| ---------------- | --------------------------------------------------------- |
| D1 数据迁移丢失  | 迁移前备份 `.db` 文件，验证 row count 一致后再清理        |
| R2 图片 sync 慢  | 首次 sync 完整，后续增量；CI 缓存图片列表                 |
| CF Access 误配   | 先在 `admin-staging.crystallize.cc` 测试，验证后切生产    |
| Workers 类型冲突 | 主站和 admin 保持相同 Wrangler 版本（当前 4.76.0）        |
| Hono D1 API 差异 | D1 是异步的（`await`），better-sqlite3 是同步的，全面替换 |

---

## 关键文件索引

**现有（需修改）：**

- `data/sqlite.ts` — 添加 D1 构建模式
- `wrangler.jsonc` — 添加 D1/R2 bindings
- `package.json` — 添加 workspaces + R2 sync 脚本
- `astro.config.ts` — 最终移除 `devAdminIntegration()`

**现有（参考 → 重写到 admin app）：**

- `server/adminApiHandler.ts` — 569 行，全部路由逻辑
- `src/features/admin/imageUpload.ts` — 图片操作
- `src/lib/admin/db.ts` — DB 层
- `src/features/admin/actions.client.ts` — HTTP action wrappers

**新增：**

- `apps/admin/` — 整个新 app
- `.github/workflows/rebuild.yml` — 自动重建
- `tasks/migrate-cloudflare.md` — 任务清单（批准后立即创建）
