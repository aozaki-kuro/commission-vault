# Admin 独立部署迁移任务清单

分支：`feat/monorepo-cloudflare-admin`（原 `feat/admin-standalone`）
目标：admin → Cloudflare Workers（D1 + R2），主站不动，远程可管理 commission 数据。

**决策：线上 admin 值得做**（偶尔需非开发机访问），认证方案选 Cloudflare Access（零代码）。

---

## Step 1：初始化 monorepo 结构 ✅

- [ ] 根 `package.json` 添加 workspaces（apps/admin, apps/admin-worker, packages/\*）
- [ ] bun install 正常

## Step 2：数据库迁移 SQLite → Cloudflare D1 ✅

- [ ] D1 database 创建并 binding 配置完毕
- [ ] 数据已迁移至 D1
- [ ] 主站通过 fact-source export 脚本从 D1 拉数据构建

## Step 3：图片迁移 data/images/ → Cloudflare R2 ✅

- [ ] R2 bucket 创建并 binding 配置完毕
- [ ] 图片已上传至 R2

## Step 4：Admin Vite+React App 骨架 ✅

- [ ] `apps/admin/` — Vite + React 19 + TailwindCSS 4
- [ ] `apps/admin-worker/` — CF Worker（托管 SPA + API）
- [ ] 独立域名 `admin.crystallize.cc`，wrangler.jsonc 配置完毕

## Step 5：Admin API → Workers Handler ✅

- [ ] admin-worker 实现全部 CRUD 路由
- [ ] D1 + R2 binding 替换本地 SQLite/fs

## Step 6：React 组件迁移 ✅

- [ ] admin SPA 组件完成迁移

## Step 7：认证（Cloudflare Access） ← **当前步骤**

- [ ] CF Dashboard → Zero Trust → Access → Applications → Add Self-hosted app
- [ ] Application domain: `admin.crystallize.cc`
- [ ] Policy: Allow → Emails → 填入自己的邮箱
- [ ] 验证：访问 admin.crystallize.cc → 触发 Access 登录页

> 无需改代码，纯 CF 控制台配置。

## Step 8：部署 & 验证

- [ ] `bun run deploy:admin` 部署 admin-worker + SPA
- [ ] 验证 CF Access 拦截正常（未登录 → 登录页）
- [ ] 登录后进入 admin SPA，执行一次 CRUD 验证 D1/R2 正常
- [ ] `bun run deploy:web` 确认主站不受影响

## Step 9：GitHub Actions 自动重建

- [ ] 创建 `.github/workflows/rebuild.yml`
- [ ] 添加 Secrets：CLOUDFLARE_API_TOKEN
- [ ] Admin 写操作后触发 repository_dispatch → 主站重建
- [ ] 测试：admin 写入 → Actions 触发 → 主站更新

## Step 10：清理与合并

- [ ] Playwright 视觉回归：更新快照（如有）
- [ ] 删除遗留的 admin 代码（apps/web 中已返回 404 的 /admin 页面）
- [ ] PR review → merge to master
