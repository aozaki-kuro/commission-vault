# 决策：完成当前分支 + Cloudflare Access 认证

## 结论

继续推进 `feat/monorepo-cloudflare-admin`，用 **Cloudflare Access** 保护 admin。

理由：偶尔需要在非开发机上操作 → 线上 admin 有价值；CF Access 零代码、免费、简单。

---

## 现状（当前分支已完成的部分）

- `apps/admin` — Vite + React SPA ✅
- `apps/admin-worker` — CF Worker 托管 SPA + CRUD API ✅
- 独立域名 `admin.crystallize.cc` ✅
- **认证：已移除，待补** ❌

---

## 需要做的事

### 1. Cloudflare Access 配置（CF 控制台，无代码）

在 CF Zero Trust 控制台操作：

1. `Access → Applications → Add an application → Self-hosted`
2. Application domain: `admin.crystallize.cc`
3. Policy: Allow → Email → `你的邮箱`
4. 保存即生效，所有到 admin.crystallize.cc 的请求都会被拦截要求登录

无需改动任何代码。

### 2. 验证当前分支可部署状态

检查以下是否 OK：

- `apps/admin-worker/wrangler.jsonc` — D1/R2 binding 配置
- `bun run build:assets`（admin-worker 的构建）能否正确引用 `../admin/dist`
- D1 migration 是否已全部 apply（`wrangler d1 migrations apply`）

关键文件：

- `apps/admin-worker/wrangler.jsonc`
- `apps/admin-worker/src/index.ts`
- `apps/admin/vite.config.ts`

### 3. 部署

```bash
bun run deploy:admin   # 部署 admin SPA + Worker
```

---

## 验证

1. 访问 `admin.crystallize.cc` → 触发 CF Access 登录页
2. 用绑定邮箱登录 → 进入 admin SPA
3. 执行一次 CRUD 操作 → 确认 D1/R2 正常
4. 触发 web 重建（如有 webhook/CI）→ 确认数据同步

---

## 不需要做的事

- ~~重写认证逻辑~~ — CF Access 全包了
- ~~basic auth 代码~~ — 不需要
- ~~修改 apps/web~~ — 无影响
