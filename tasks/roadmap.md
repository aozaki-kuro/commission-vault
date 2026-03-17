# 统一迁移 Roadmap（2026-03-17）

`tasks/todo.md` 只维护状态与关口；本文件维护可执行的迁移路线、模块级拆解、默认决策与验收标准。

## 默认决策与假设

- 本轮只做仓库盘点与迁移计划文档化，不修改运行时代码，不新增公共 API
- `apps/admin-worker` 继续持有 admin API contract；迁移期间允许逐路由替换执行后端，但不允许漂移现有请求/响应形状
- `apps/admin-worker/src/adminData.ts` 默认保持读侧模型，不继续膨胀成读写混合模块
- worker 写路径默认新增独立 persistence 层；推荐命名为 `apps/admin-worker/src/adminPersistence.ts`
- source image 的云端目标默认是 R2；本地文件系统写入只作为迁移期 fallback，不再扩展为长期方案
- `assets/refresh` 默认保留为兼容 no-op，直到 Publish 模型落地前都不承担真实发布职责
- `apps/web` 未来默认读取稳定 snapshot bundle，而不是继续直接读取本地 SQLite / `data/images/*`
- `packages/cloudflare`、`packages/ui`、`packages/config` 当前按脚手架看待，不计入“已完成迁移成果”

## 1. 仓库现状盘点

### 1.1 顶层目录与职责

- `apps/`：可部署应用
  - `apps/web`：公开站 Astro 运行时与当前 legacy admin 宿主
  - `apps/admin`：standalone admin 前端
  - `apps/admin-worker`：standalone admin worker，负责 auth、API、静态托管
- `packages/`：共享模块
  - `packages/domain`：共享类型与纯逻辑
  - `packages/cloudflare`：worker env / binding 占位
  - `packages/ui`：共享 UI 占位
  - `packages/config`：共享配置占位
- `tasks/`：迁移状态、roadmap、经验沉淀
- `test/`：根级 Playwright snapshot 与测试资产
- `coverage/`、`test-results/`、`playwright-report/`、`dist/`：生成产物，不是源码真值

### 1.2 各 app/package 当前成熟度

- `apps/web`：成熟。它仍是公开站生产源代码，同时继续持有 dev-only admin 页面、legacy admin API、SQLite 读写、本地图片读写与公开站构建链
- `apps/admin`：前端迁移已完成。五个主页面都在这里，视觉基线存在，但它还没有脱离 worker API 依赖
- `apps/admin-worker`：部分完成。worker 入口、Basic Auth、本地 CORS、远端读路径、CRUD 壳已存在；真正写持久层还没有从 legacy app 脱离
- `packages/domain`：成熟并已在主链路使用，承担 admin/web 共享 DTO 与纯逻辑
- `packages/cloudflare`：脚手架。只有占位 env 类型，尚未承接真正的 auth / binding / helper
- `packages/ui`：脚手架。没有实际共享 UI 被两个 app 复用
- `packages/config`：脚手架。只有 README，占位意图明确，内容未落地

### 1.3 当前测试 / 构建 / 部署入口

- 根级脚本：
  - `bun run dev`
  - `bun run dev:web`
  - `bun run dev:admin`
  - `bun run dev:worker`
  - `bun run build`
  - `bun run build:web`
  - `bun run build:admin`
  - `bun run lint`
  - `bun run check`
  - `bun run test`
  - `bun run test:visual`
- 根级测试入口：
  - `vitest.config.ts`
  - `playwright.config.ts`
- 当前部署边界：
  - `crystallize.cc` -> `apps/web`
  - `admin.crystallize.cc` -> `apps/admin-worker` + `apps/admin/dist`
- 当前本地联调边界：
  - `apps/web` dev 默认承载 legacy `/admin/*` 与 `/api/admin/*`
  - `apps/admin` 通过 `ADMIN_API_BASE_URL` 调用 admin API
  - `apps/admin-worker` 可单独 `wrangler dev`
- 当前自动化缺口：
  - admin 现有自动化主要是 Playwright 视觉回归
  - 尚无独立 smoke / happy-path E2E 流程
  - 尚无统一三进程联调命令

### 1.4 当前数据事实源与图片事实源

- 公开站当前事实源：
  - 数据：`apps/web/data/commissions.db`
  - 图片：`apps/web/data/images/*`
- 公开站本地读取入口：
  - `apps/web/data/sqlite.ts`
  - `apps/web/src/lib/images/sourceImageRegistry.ts`
- legacy admin 当前写入入口：
  - `apps/web/src/lib/admin/db.ts`
  - `apps/web/src/features/admin/imageUpload.ts`
- worker 当前远端读取入口：
  - D1 读：admin bootstrap / aliases / suggestion / character commissions
  - R2 读：source image GET

### 1.5 当前 legacy bridge 边界

- `apps/admin-worker/src/adminApi.ts`
  - 当前已原生处理一部分 GET 路由与 CRUD 路由壳
  - 默认 CRUD backend 仍是 `createLegacyCrudBackend`
  - passthrough allowlist 仍包含：
    - `/api/admin/bootstrap`
    - `/api/admin/aliases/bootstrap`
    - `/api/admin/aliases/batch`
    - `/api/admin/character-aliases/batch`
    - `/api/admin/keyword-aliases/batch`
    - `/api/admin/suggestion`
    - `/api/admin/source-image/*`
    - `/api/admin/commissions/:id/source-image`
    - `/api/admin/assets/refresh`
- `apps/web/server/adminApiHandler.ts`
  - 当前仍是 legacy admin 写入执行者
  - 同时承担 source-image 本地文件写入与 refresh no-op 响应
- `apps/web/server/devAdminAstro.ts`
  - 当前仍把 legacy `/admin/*` 注入 Astro dev
- `apps/web/src/features/admin/*` 与 `apps/admin/src/*`
  - 当前仍双实现并存

## 2. 当前进度总览

### 2.1 Standalone admin 前端

- 状态：`已完成`
- 当前真值：
  - `apps/admin` 已承接 `overview` / `create` / `edit` / `aliases` / `suggestion`
  - Playwright visual 基线已经建立
  - 样式契约继续对齐 legacy `/admin/*`
- 离完成还差什么：
  - 还没有独立 smoke 流程
  - 仍依赖 worker API 和 legacy backend 才能真正写入

### 2.2 Admin worker 读路径

- 状态：`部分完成`
- 当前真值：
  - `apps/admin-worker/src/index.ts` 已提供 Basic Auth、同源/CORS 处理、静态资源托管
  - `apps/admin-worker/src/adminApi.ts` 已在有 `DB` / `IMAGES` bindings 时原生处理：
    - `/api/admin/health`
    - `/api/admin/bootstrap`
    - `/api/admin/aliases/bootstrap`
    - `/api/admin/suggestion` GET
    - `/api/admin/characters/:id/commissions` GET
    - `/api/admin/source-image/:fileName` GET
  - `apps/admin-worker/src/adminApi.test.ts` 已覆盖 CRUD 壳与远端读路径
- 离完成还差什么：
  - 读路径仍与 passthrough allowlist 并存，fallback 边界需要继续收紧
  - remote/local 读路径的一致性测试需要继续扩大

### 2.3 Admin worker 写路径

- 状态：`部分完成`
- 当前真值：
  - worker 已持有 CRUD 请求命中、校验、归一化、错误响应壳
  - 默认持久化 backend 仍是 `createLegacyCrudBackend`
  - alias batch、suggestion 保存、source-image POST、`assets/refresh` 仍未原生化
- 离完成还差什么：
  - 真正的 D1/R2 写持久层
  - 写路径 contract tests / integration tests
  - route-by-route 去 bridge 方案

### 2.4 Public web 事实源解耦

- 状态：`部分完成`
- 当前真值：
  - `packages/domain` 已吸走一部分纯逻辑
  - `apps/web` 仍直接读取 SQLite、本地图像，并在构建时生成首页/search/rss/batch 输出
- 离完成还差什么：
  - 统一 snapshot contract
  - 公开站对本地 SQLite / 本地图像的直接依赖替换
  - 输出回归证明

### 2.5 云端事实源与 Publish

- 状态：`未开始`
- 当前真值：
  - D1/R2 只被 worker 读路径局部使用
  - 没有 publish-status、锁、重试、恢复
  - `Save` 与“公开站可见更新”仍未彻底拆开
- 离完成还差什么：
  - D1 migration
  - R2 key 规则
  - publish bundle 生成与 current pointer
  - publish state machine

### 2.6 部署、认证、本地联调

- 状态：`部分完成`
- 当前真值：
  - 两个域名路由骨架与 admin Basic Auth 已存在
  - 三个独立 `dev:*` 命令已存在
  - `apps/admin` 与 `apps/web` 的 Playwright 开发服务器已可协同工作
- 离完成还差什么：
  - D1/R2 bindings 与 secrets 收口
  - preview / production 差异文档
  - 一条命令拉起完整开发栈
  - `apps/admin` 对 worker dev 的真实联调

## 3. 未完成项细化

### 3.1 Worker 写路径原生化

#### `apps/admin-worker/src/adminApi.ts`

- 当前：
  - 读路径部分 D1/R2 化
  - 写路径默认仍是 `createLegacyCrudBackend`
  - CRUD 壳已经在 worker，不再是原始白名单代理
- 默认方案：
  - 保持 `adminApi.ts` 只负责路由、归一化、错误响应、backend 组装
  - 新增独立 persistence backend，不把 SQL / D1 / R2 写逻辑塞回 `adminApi.ts`
- 下一步：
  - 让 `createDefaultCrudBackend()` 在具备持久层 bindings 时优先走 worker persistence backend
  - route-by-route 替换 `createCharacter` / `updateCharacter` / `updateCharacterOrder` / `deleteCharacter` / `createCommission` / `updateCommission` / `deleteCommission`
  - alias batch、suggestion 保存、source-image POST、`assets/refresh` 从 passthrough allowlist 中逐个移除

#### `apps/admin-worker/src/adminData.ts`

- 当前：
  - 只覆盖远端读模型：bootstrap、aliases、suggestion、character commissions、source image GET、health
- 默认方案：
  - 保持读侧职责，不继续混入写 SQL
- 下一步：
  - 继续承担读侧聚合、投影、DTO 组装
  - 另拆 `apps/admin-worker/src/adminPersistence.ts`，专门承担 D1 写入
  - 如图片写入需要单独抽象，再拆 `apps/admin-worker/src/imageStore.ts`

#### `apps/web/server/adminApiHandler.ts`

- 当前：
  - 仍是 legacy admin 写入与 source-image 上传/替换的真正执行者
  - `assets/refresh` 当前返回兼容性 no-op 响应
- 下一步：
  - 在 worker 原生写链路稳定前继续保留为 fallback
  - 当 worker 写路径、图片写入、publish 接口都稳定后，将它降级为仅本地迁移兼容层
  - 最终与 `apps/web/server/devAdminAstro.ts` 一起删除

#### `apps/web/src/lib/admin/db.ts`

- 当前：
  - 本地 SQLite 读写核心
  - 还包含隐式 schema 自修复逻辑，例如列/表自动存在性处理
- 下一步：
  - 先把 schema、约束、字段归一化逻辑梳理成 migration 输入
  - 再把写路径逐步搬到 worker persistence 层
  - 最后把本地 SQLite 限定为迁移工具或本地快照来源，而不是长期线上真值

#### `apps/web/src/features/admin/imageUpload.ts`

- 当前：
  - 本地文件系统图片保存、替换、删除、读取逻辑都在这里
- 默认方案：
  - 云端主路径改为 worker -> R2
  - 本地文件系统写入仅保留为迁移期 fallback 或一次性导入工具
- 下一步：
  - 定义统一 image storage contract：save / replace / delete / read
  - 先实现 worker 侧 R2 adapter
  - 再决定本地 dev 是否保留 legacy adapter，还是通过本地 R2 模拟完成

#### alias / suggestion / source-image POST / `assets/refresh`

- `alias batch`
  - 当前：仍走 passthrough
  - 下一步：迁入 worker persistence，复用与 legacy 相同的 payload 形状
- `suggestion` 保存
  - 当前：GET 可走 D1，POST 仍未原生化
  - 下一步：把 featured keyword 写入迁入 worker persistence
- `source-image` replace/upload
  - 当前：GET 可走 R2；POST 仍未原生化
  - 默认方案：worker 写 R2，legacy 本地文件写入仅作为 fallback
- `assets/refresh`
  - 当前：legacy 已经是 no-op
  - 默认方案：worker 保留同等 no-op，直到 Publish 成型前都不引入新语义
  - 后续切换：Publish 落地后再决定把 UI 上的 refresh affordance 改成显式 publish

### 3.2 Public web 解耦

#### `apps/web/data/sqlite.ts`

- 当前：
  - `apps/web` 公开站只读 SQLite 入口
  - 同时兼容 Bun `bun:sqlite` 与 Node `better-sqlite3`
- 下一步：
  - 为公开站引入 snapshot loader interface
  - 让 `sqlite.ts` 退化为“本地 snapshot 生成输入”而不是直接渲染依赖

#### `apps/web/src/lib/images/sourceImageRegistry.ts`

- 当前：
  - 通过 `import.meta.glob('/data/images/*.{jpg,jpeg,png}')` 直接绑定本地图片
- 默认方案：
  - 将其定位为“本地构建 adapter”
  - 未来云端公开站改为读取发布时生成的 image manifest / resolved image metadata
- 下一步：
  - 明确 image manifest 需要包含的字段：`fileName`、resolved stem、尺寸/格式信息、可用性
  - 把公开站渲染链从“直接 glob”切到“先读 manifest，再解析”

#### `apps/web/src/lib/home/buildSitePayload.ts`

- 当前：
  - 直接从本地 records、creator aliases、timeline helpers 组装页面输入
- 下一步：
  - 改为读取统一 snapshot bundle 中的 `site-payload.json`
  - 保持页面层调用方式尽量不变，只替换 loader

#### `apps/web/src/lib/pipeline/homeSearchEntries.ts`

- 当前：
  - 仍从本地数据源推导 search entries
- 下一步：
  - 改为读取 snapshot bundle 中的 `home-search-entries.json` 或同等结构化输入

#### `apps/web/src/lib/rss/feed.ts`

- 当前：
  - 仍从本地数据源生成 RSS 内容
- 下一步：
  - 改为读取 snapshot bundle 中的 RSS 输入，或直接消费已发布的 `rss.xml`

#### `apps/web/src/pages/search/home-search-entries.json.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 切换为 snapshot-sourced 输出

#### `apps/web/src/pages/search/home-character-batches/[locale]/[status]/[batch].json.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 切换为 snapshot-sourced character batch payload

#### `apps/web/src/pages/search/home-timeline-batches/[locale]/[batch].json.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 切换为 snapshot-sourced timeline batch payload

#### `apps/web/src/pages/rss.xml.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 切换为 snapshot-sourced RSS 输出

#### 统一 snapshot contract 默认方案

- 发布产物默认组织为一组稳定 artifact，而不是让 `apps/web` 直接面向 D1/R2 原始表结构
- 推荐最小 bundle：
  - `snapshots/<publishId>/site-payload.json`
  - `snapshots/<publishId>/home-search-entries.json`
  - `snapshots/<publishId>/rss.xml`
  - `snapshots/<publishId>/home-character-batches/<locale>/<status>/<batch>.json`
  - `snapshots/<publishId>/home-timeline-batches/<locale>/<batch>.json`
  - `snapshots/<publishId>/images-manifest.json`
  - `snapshots/current.json`
- `apps/web` 只认 snapshot bundle，不认底层 D1 表和 R2 原始对象

### 3.3 Publish 模型

#### D1 schema 迁移

- 基线迁移对象：
  - `characters`
  - `commissions`
  - `creator_aliases`
  - `character_aliases`
  - `keyword_aliases`
  - `home_featured_search_keywords`
- 新增 publish 相关最小状态表：
  - `publish_state`
  - `publish_jobs` 或等价记录表
- 原则：
  - 先移植现有 SQLite schema 与约束
  - 再新增 publish 状态所需表，不在同一轮顺手扩业务模型

#### R2 object key 规则

- source image：
  - `images/source/<fileName>.jpg`
  - `images/source/<fileName>.jpeg`
  - `images/source/<fileName>.png`
- published bundle：
  - `snapshots/<publishId>/site-payload.json`
  - `snapshots/<publishId>/home-search-entries.json`
  - `snapshots/<publishId>/rss.xml`
  - `snapshots/<publishId>/home-character-batches/<locale>/<status>/<batch>.json`
  - `snapshots/<publishId>/home-timeline-batches/<locale>/<batch>.json`
  - `snapshots/<publishId>/images-manifest.json`
  - `snapshots/current.json`
- 约束：
  - `publishId` 必须单调可追溯
  - `current.json` 只在 publish 成功后切换
  - 失败 publish 不得覆盖当前 pointer

#### snapshot 生成责任归属

- 默认方案：
  - worker 负责读取 D1/R2 真值并生成 publish bundle
  - `apps/web` 只消费 publish bundle
- 不采用的方案：
  - 继续让 `apps/web` 在构建时直接读取 SQLite / 本地图像
  - 让 admin 前端自己生成 snapshot

#### publish-status / lock / retry / recovery

- 推荐状态机：
  - `dirty`
  - `publishing`
  - `published`
  - `failed`
- 行为约束：
  - `Save` 只把状态推到 `dirty`
  - `Publish` 才生成 bundle 并切换 `current.json`
  - `publishing` 状态期间必须有锁，拒绝并发 publish
  - `failed` 保留错误摘要，但不影响当前已发布版本
  - 重试只允许基于最新 `dirty` 状态重新发起，不直接覆盖成功版本

### 3.4 遗留清理

#### `apps/web/src/devAdmin/pages/*` 与 `apps/web/server/devAdminAstro.ts`

- 当前：
  - legacy admin 仍可在 dev 中直接工作
- 删除前置条件：
  - standalone admin 五个页面继续通过 visual 回归
  - worker 写路径原生化完成
  - publish / snapshot contract 已打通
- 删除时点：
  - Phase E，一次性移除

#### `apps/web/server/adminApiHandler.ts`

- 当前：
  - 仍是 legacy 写入执行者
- 删除前置条件：
  - worker 原生写链路覆盖 CRUD / alias / suggestion / source-image
  - `assets/refresh` 语义已收口
- 删除时点：
  - Phase E，和 dev admin 注入一起移除

#### `apps/web/src/features/admin/*` 与 `apps/admin/src/*`

- 当前：
  - 双实现并存
- 删除候选：
  - `apps/web/src/features/admin/islands/*`
  - `apps/web/src/features/admin/actions.client.ts`
  - `apps/web/src/features/admin/bootstrapFetch.ts`
  - `apps/web/src/features/admin/AdminSectionNav.astro`
  - 其余仅服务 legacy `/admin/*` 的组件、hooks、页面态逻辑
- 保留为共享候选：
  - 纯 helper，例如 duplicated commission hint / file name normalization / admin search metadata builder
  - 这些候选优先抽向 `packages/domain` 或未来的 `packages/ui`，而不是继续留在 `apps/web`
- 最终目标：
  - `apps/admin/src/*` 成为唯一 admin UI source of truth

#### README / AGENTS / runbook

- 当前：
  - README 仍以 `apps/web` dev-only admin 为主叙述
  - AGENTS 已部分说明新边界，但迁移后的最终状态尚未落定
- 下一步：
  - 在 legacy 删除完成后统一改写
  - 以 standalone admin + worker + publish bundle 为最终叙述

## 4. 顺序化执行计划

### Phase A：Worker 写路径原生化

- 目标：
  - 让 worker 真正拥有 admin API 的执行后端，而不只是 contract 壳
- 输入前提：
  - 现有 CRUD contract tests 通过
  - 远端读路径在 D1/R2 bindings 下可用
- 具体改动面：
  - 新增 `apps/admin-worker/src/adminPersistence.ts`
  - 将 `createDefaultCrudBackend()` 逐路由切到 worker persistence backend
  - 将 alias batch / suggestion POST / source-image POST 从 passthrough 移出
  - `assets/refresh` 统一改为 worker 兼容 no-op
- 验收信号：
  - CRUD / alias / suggestion / source-image POST 在不命中 legacy proxy 的情况下完成
  - `apps/admin-worker/src/adminApi.test.ts` 覆盖对应 happy path / validation / failure path
  - standalone admin 写入路径不再依赖 `apps/web/server/adminApiHandler.ts`
- 失败回滚点：
  - 路由级 fallback 仍可暂时切回 legacy backend
  - 每类路由独立提交，避免一次性替换全部写路径

### Phase B：Public web 快照输入抽象

- 目标：
  - 让 `apps/web` 面向 snapshot bundle，而不是 SQLite / 本地图像
- 输入前提：
  - worker 已能稳定读取事实源
  - snapshot contract 已定稿
- 具体改动面：
  - 新增 snapshot loader
  - 改造 `apps/web/src/lib/home/buildSitePayload.ts`
  - 改造 `apps/web/src/lib/pipeline/homeSearchEntries.ts`
  - 改造 `apps/web/src/lib/rss/feed.ts`
  - 改造 `apps/web/src/pages/search/*.ts` 与 `apps/web/src/pages/rss.xml.ts`
  - 将 `apps/web/src/lib/images/sourceImageRegistry.ts` 降级为本地 adapter 或被 manifest 替换
- 验收信号：
  - 首页、搜索、RSS、timeline/character batches 输出行为与现状一致
  - `bun run check`
  - `bun run test`
  - `bun run build:web`
  - 变更到 home/search/nav/layout 时继续跑 `bun run test:visual`
- 失败回滚点：
  - 保留 local snapshot adapter，让 web 可切回本地构建输入
  - snapshot loader 与旧 loader 并存一个过渡窗口

### Phase C：D1 / R2 / Publish 闭环

- 目标：
  - 把 `Save` 与 `Publish` 拆成两个动作，并建立云端事实源
- 输入前提：
  - worker 写路径原生化完成
  - snapshot bundle 结构稳定
- 具体改动面：
  - 生成 D1 migration SQL
  - 定义并固化 R2 key 规则
  - 新增 publish state / lock / current pointer
  - worker 提供 `publish` / `publish-status` / internal snapshot endpoints 或等价内部执行器
- 验收信号：
  - `Save` 后公开站不立即变化
  - `Publish` 成功后切换到新 bundle
  - `failed` 不破坏当前已发布版本
  - 并发 publish 被锁住
- 失败回滚点：
  - 仅在 publish 成功后切换 `snapshots/current.json`
  - `current.json` 是唯一对外切换点，失败时保持旧 pointer

### Phase D：部署、认证、联调

- 目标：
  - 打通 local / preview / production 的运行边界
- 输入前提：
  - worker 写路径与 publish 闭环可用
- 具体改动面：
  - 完善 `apps/admin-worker/wrangler.jsonc` 的 D1/R2 bindings 与 secrets
  - 固化 `local` / `preview` / `production` 环境差异
  - 让 `apps/admin` 可以对接 worker dev，而不是继续依赖 legacy dev server
  - 新增单命令联调入口
- 验收信号：
  - `crystallize.cc` 与 `admin.crystallize.cc` 路由边界清晰
  - admin Basic Auth 在 preview / production 可用
  - 本地可以一条命令拉起完整栈
- 失败回滚点：
  - 保留独立 `dev:web` / `dev:admin` / `dev:worker`
  - preview/prod 切换由环境变量和 bindings 控制，不在代码内硬编码

### Phase E：Legacy 删除与文档收口

- 目标：
  - 删除 legacy admin 与双实现残留，统一文档
- 输入前提：
  - Phase A-D 全部通过
  - standalone admin 视觉基线稳定
  - web build / test / visual 回归通过
- 具体改动面：
  - 删除 `apps/web/src/devAdmin/pages/*`
  - 删除 `apps/web/server/devAdminAstro.ts`
  - 删除 `apps/web/server/adminApiHandler.ts`
  - 删除 `apps/web/src/features/admin/*` 中只服务 legacy 的实现
  - 更新 README / AGENTS / runbook
- 验收信号：
  - `apps/web` 中不再存在 `/admin` 运行时耦合
  - `apps/admin/src/*` 成为唯一 admin UI source of truth
  - 文档只描述 standalone admin + worker + publish bundle 方案
- 失败回滚点：
  - 遗留删除集中在单独提交中完成，便于整段回退

## 5. 验证矩阵

### 文档改动

- 一致性自检：
  - `tasks/todo.md` 与 `tasks/roadmap.md` 阶段状态不冲突
  - 所有引用路径存在
  - 已完成项不再写成“下一步”
  - 未完成项都写清阻塞原因与前置条件

### worker 路由改动

- 必跑：
  - `bunx vitest run -c vitest.config.ts apps/admin-worker/src/adminApi.test.ts`
  - `bun run --cwd apps/admin-worker typecheck`
- 建议补充：
  - local bindings smoke
  - remote bindings smoke

### admin UI 改动

- 必跑：
  - `bunx playwright test -c playwright.config.ts --project=admin`
- 变更页面对应补充：
  - `apps/admin/test/visual/admin-create.spec.ts`
  - `apps/admin/test/visual/admin-edit.spec.ts`
  - `apps/admin/test/visual/admin-aliases.spec.ts`
  - `apps/admin/test/visual/admin-suggestion.spec.ts`
- 视觉真值仍以 `admin-legacy` 基线为迁移参考，直到 legacy 删除

### web 数据源改动

- 必跑：
  - `bun run check`
  - `bun run test`
  - `bun run build:web`
- 如变更 home/search/nav/layout shell：
  - `bun run test:visual`

### 部署 / 发布链改动

- 必跑：
  - `bun run --cwd apps/admin-worker dev`
  - `bun run build:admin`
  - `bun run build:web`
- 发布链 smoke：
  - Save -> state = `dirty`
  - Publish -> state = `publishing` -> `published`
  - failure -> state = `failed` 且 current pointer 不变

## 结束条件

- worker 既持有 admin API contract，也持有真实写持久层
- `apps/web` 不再直接依赖本地 SQLite / 本地图像
- `Save` 与 `Publish` 完全拆开
- legacy admin 与双实现删除
- README / AGENTS / runbook 与最终架构一致
