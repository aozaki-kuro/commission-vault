# 统一迁移 Roadmap（2026-03-18）

`tasks/todo.md` 只维护状态与关口；本文件维护可执行的迁移路线、模块级拆解、默认决策与验收标准。

## 2026-03-18 真值更新

- 公开站 build cutover 已完成：`apps/web` 只消费 `apps/web/generated/*`，不再读取本地 SQLite 或 `data/images/*`
- 仓库内本地 `apps/web/data/commissions.db` 与 `apps/web/data/images/*` 已删除；依赖这些文件的 bootstrap/check/sync 脚本也已下线
- `apps/web` 本地 dev 不再注入 legacy `/admin/*`；后台开发主线只剩 `bun run dev:admin`
- 远端 D1 `source_images` 现已持有 `commission_file_name/object_key/mime_type/byte_size/sha256`，`exportWebFactSource.ts` 会按扩展名/hash 增量复用 generated 图片，不匹配才重拉
- 若本页后文仍出现“本地 SQLite / 本地图像 / bootstrap 脚本”描述，请将其视为已完成切片的历史记录，以本节为准

## 默认决策与假设

- 在用户关心“什么时候才能真正让公开站吃到远端事实源”时，下一阶段重点不再是继续补 admin 写路由，而是让 `apps/web` 的 build input 从本地 SQLite / `data/images/*` 切到 D1/R2 导出的 generated artifacts
- `apps/web` 不直接在页面层、route handler 或 loader 里查询 D1 表 / 远端 R2 URL；统一先把 D1/R2 真值物化为本地 generated build inputs，再让 Astro build 只读这些 artifacts
- 由于首页和 batch payload 图片链路依赖 `astro:assets` / `getImage()`，R2 source images 必须先落到 `apps/web` 的本地 generated 目录，不能只保留 object key 或远端 URL
- `apps/admin-worker` 继续持有 admin API contract；迁移期间允许逐路由替换执行后端，但不允许漂移现有请求/响应形状
- `apps/admin-worker/src/adminData.ts` 默认保持读侧模型，不继续膨胀成读写混合模块
- worker 写路径默认新增独立 persistence 层；推荐命名为 `apps/admin-worker/src/adminPersistence.ts`
- source image 的云端目标默认是 R2；本地文件系统写入不再作为公开站或主线 admin 的可接受路径，只保留给一次性 bootstrap / 清理脚本
- `assets/refresh` 默认保留为兼容 no-op，直到 Publish 模型落地前都不承担真实发布职责
- `apps/web` 未来默认读取稳定 snapshot bundle，而不是继续直接读取本地 SQLite / `data/images/*`
- `packages/cloudflare`、`packages/ui`、`packages/config` 当前按脚手架看待，不计入“已完成迁移成果”

## 1. 仓库现状盘点

### 1.1 顶层目录与职责

- `apps/`：可部署应用
  - `apps/web`：公开站 Astro 运行时与当前 legacy admin 宿主
  - `apps/admin`：standalone admin 前端
  - `apps/admin-worker`：standalone admin worker，负责 API、静态托管，并把生产认证边界交给 Cloudflare Zero Trust
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
- `apps/admin-worker`：部分完成。worker 入口、本地 CORS、`adminData` 读侧、`adminPersistence` 写侧、character/commission CRUD、alias/suggestion 写入、source-image GET/POST 已可站在 D1/R2 上，`wrangler` 也已接入真实 `DB` / `IMAGES` bindings；worker 不再内置 Basic Auth，production 认证边界改由 Cloudflare Zero Trust 承担；当前主缺口不再是 admin 路由能力，而是公开站构建仍未脱离本地 SQLite / `data/images/*`
- `packages/domain`：成熟并已在主链路使用，承担 admin/web 共享 DTO 与纯逻辑
- `packages/cloudflare`：脚手架。只有占位 env 类型，当前也未进入主链路，尚未承接真正的 auth / binding / helper
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
  - `bun run build:web:cf`
  - `bun run build:admin:cf`
  - `bun run deploy:web`
  - `bun run deploy:admin`
  - `bun run deploy:web:cf`
  - `bun run deploy:admin:cf`
  - `bun run lint`
  - `bun run check`
  - `bun run test`
  - `bun run test:visual`
- 根级测试入口：
  - `vitest.config.ts`
  - `playwright.config.ts`
- 当前部署边界：
  - `crystallize.cc` -> `apps/web`
  - `admin.crystallize.cc` -> `apps/admin-worker` + `apps/admin/dist`（前置 Cloudflare Zero Trust）
- 当前 deploy 真值：
  - 根脚本实际走 `apps/web/wrangler.jsonc` / `apps/admin-worker/wrangler.jsonc`
  - 根目录 `wrangler.jsonc` 目前不是 deploy/source-of-truth，只是遗留配置
  - 手动独立上线入口已明确：
    - 公开站：`bun run deploy:web`
    - Admin：`bun run deploy:admin`
  - Cloudflare Workers Builds 友好入口已明确：
    - 公开站 build：`bun run build:web:cf`
    - 公开站 deploy：`bun run deploy:web:cf`
    - Admin build：`bun run build:admin:cf`
    - Admin deploy：`bun run deploy:admin:cf`
  - 注意：Workers Builds 不读取 `wrangler` custom build；build/deploy 命令必须在 Cloudflare Dashboard 单独填写
- 当前本地联调边界：
  - `apps/web` dev 只服务公开站，不再注入 legacy `/admin/*`
  - `apps/admin` 通过 `ADMIN_API_BASE_URL` 调用 admin API
  - `apps/admin-worker` 可单独 `wrangler dev`
- 当前自动化缺口：
  - admin 现有自动化主要是 Playwright 视觉回归
  - 尚无独立 smoke / happy-path E2E 流程
  - 尚无统一三进程联调命令

### 1.4 当前数据事实源与图片事实源

- 公开站当前事实源：
  - 数据：`apps/web/generated/fact-source/content.json`
  - 图片：`apps/web/generated/source-images/*`
- 公开站读取入口：
  - `apps/web/data/generatedFactSource.ts`
  - `apps/web/src/lib/images/sourceImageRegistry.ts`
- legacy admin 当前写入入口：
  - `apps/web/src/lib/admin/db.ts`（显式失败的参考实现）
  - `apps/web/src/features/admin/imageUpload.ts`（显式失败的参考实现）
- worker 当前远端事实源入口：
  - `apps/admin-worker/wrangler.jsonc` 已声明真实 `DB` / `IMAGES` bindings
  - `apps/admin-worker/src/adminData.ts` 承接 D1/R2 读侧
  - `apps/admin-worker/src/adminPersistence.ts` 与 `apps/admin-worker/src/adminSourceImages.ts` 承接 D1/R2 写侧
  - `apps/admin-worker/scripts/exportWebFactSource.ts` 负责把远端 D1/R2 真值物化到 `apps/web/generated/*`

### 1.5 当前 legacy bridge 边界

- `apps/admin-worker/src/adminApi.ts`
  - 当前已原生处理一部分 GET 路由与 CRUD 路由壳
  - 默认 CRUD backend 会在存在 `DB` binding 时优先接管 character CRUD，其余 commission 写路径仍回落到 `createLegacyCrudBackend`
  - passthrough allowlist 仍包含以下 fallback 路径；当 `adminData`/native write 能处理时会先于它命中：
    - `/api/admin/bootstrap`
    - `/api/admin/aliases/bootstrap`
    - `/api/admin/aliases/batch`
    - `/api/admin/character-aliases/batch`
    - `/api/admin/keyword-aliases/batch`
    - `/api/admin/suggestion`
    - `/api/admin/source-image/*`
    - `/api/admin/commissions/:id/source-image`
- `apps/web/server/adminApiHandler.ts`
  - 当前仍是 legacy admin 写入执行者
  - 同时承担 source-image 本地文件写入与 refresh no-op 响应
- `apps/web/server/devAdminAstro.ts`
  - 当前仍把 legacy `/admin/*` 注入 Astro dev
- `apps/web/src/features/admin/*` 与 `apps/admin/src/*`
  - 当前仍双实现并存

## 2. 当前进度总览

### 2.1 Standalone admin 前端

- 状态：`部分完成`
- 当前真值：
  - `apps/admin` 已承接 `overview` / `create` / `edit` / `aliases` / `suggestion`
  - route 已迁入 standalone，但“页面存在”不等于“设计已 1:1 复刻”
  - Playwright visual 基线已经建立，但当前更偏“迁移参考”而不是“standalone 全面对齐证明”
  - 样式契约目标仍是 legacy `/admin/*`，当前已有控件级漂移
- 离完成还差什么：
  - route-by-route 对齐 legacy `/admin*` 的视觉与交互细节，而不只是大体布局
  - 把 legacy 已使用 shadcn/Radix `Select` / dropdown 的位置按原控件形态复刻；不要在 standalone 中退回原生 `<select>`
  - 为 standalone `overview` 补独立 visual regression，并把 create/edit/aliases/suggestion 的验收标准从“可用”收紧到“1:1 对齐 legacy”
  - 还没有独立 smoke 流程
  - 仍依赖 worker API 和 legacy backend 才能真正写入

### 2.1.1 当前已确认的设计漂移

- `apps/web/src/features/admin/AddCharacterForm.tsx`
  - legacy 这里使用 shadcn/Radix `Select`
- `apps/admin/src/components/create/AddCharacterForm.tsx`
  - standalone 这里退回成原生 `<select>`
- `apps/web/src/features/admin/components/CommissionFormFields.tsx`
  - legacy 的 character selector 使用 shadcn/Radix `Select`
- `apps/admin/src/components/create/CommissionFormFields.tsx`
  - standalone 的 character selector 退回成原生 `<select>`
- 结论：
  - 后续计划必须把“控件实现也要复刻 legacy”写成硬性验收，而不是只比对文案和大体排版

### 2.2 Admin worker 读路径

- 状态：`部分完成`
- 当前真值：
  - `apps/admin-worker/src/index.ts` 已提供同源/CORS 处理、静态资源托管；worker-side Basic Auth 已删除
  - `apps/admin-worker/src/adminData.ts` 已承接读侧聚合与 R2 source-image 读取
  - `apps/admin-worker/src/adminApi.ts` 已在有 `DB` / `IMAGES` bindings 时原生处理：
    - `/api/admin/health`
    - `/api/admin/bootstrap`
    - `/api/admin/aliases/bootstrap`
    - `/api/admin/suggestion` GET
    - `/api/admin/characters/:id/commissions` GET
    - `/api/admin/source-image/:fileName` GET
  - `apps/admin-worker/wrangler.jsonc` 已接入真实 `DB` / `IMAGES` bindings，production D1/R2 也已完成首次 bootstrap
  - `apps/admin-worker/src/adminApi.test.ts` 已覆盖 CRUD 壳与远端读路径
- 离完成还差什么：
  - deployed worker 的远端 smoke check 仍需继续收口
  - 读路径已经足够支撑下一阶段，当前更高优先级是把公开站 build 接到这套事实源结果上

### 2.3 Admin worker 写路径

- 状态：`部分完成`
- 当前真值：
  - worker 已持有 CRUD 请求命中、校验、归一化、错误响应壳
  - 在存在 `DB` binding 时，character CRUD、commission CRUD、alias batch、suggestion 保存已可走 worker-native persistence
  - `source-image POST` 已走 worker-native R2 写路径
  - `assets/refresh` 已收口为 worker 原生兼容 no-op，不再依赖 legacy passthrough
- 离完成还差什么：
  - deployed worker 的真实远端 smoke check
  - 进一步缩小 legacy bridge 只剩迁移/回滚用途
  - 这部分已经不是当前关键阻塞，当前主阻塞是公开站 build 仍未消费远端事实源结果

### 2.3.1 远程 D1 / R2 可用性里程碑

- `M0 当前真值`
  - worker 里已经有一部分 binding-aware D1/R2 code path
  - 但 `apps/admin-worker/wrangler.jsonc` 还没有真实 `DB` / `IMAGES` bindings
  - 所以 admin 现在不能算“在用远程 D1/R2”；真实事实源仍是本地 `apps/web/data/commissions.db` 与 `apps/web/data/images/*`
- `M1 接上 bindings 后，立刻可远程的能力`
  - 读：
    - `/api/admin/bootstrap`
    - `/api/admin/aliases/bootstrap`
    - `/api/admin/suggestion` GET
    - `/api/admin/characters/:id/commissions` GET
    - `/api/admin/source-image/:fileName` GET
  - 写：
    - alias batch
    - suggestion save
    - character CRUD
- `M2 admin 后台完整远程读写`
  - 还需要补完：
    - commission CRUD
    - `POST /api/admin/commissions/:id/source-image`
  - 到这一层，才能说 standalone admin 后台已经完整远程化
- `M3 公开站脱离本地事实源`
  - 还需要 snapshot contract + publish state machine
  - 到这一层，才能说整个系统不再依赖本地 SQLite / `data/images/*`

### 2.4 Public web 事实源解耦

- 状态：`已完成（build-input hard cutover）`
- 当前真值：
  - 文本事实源已从 `apps/web/data/generatedFactSource.ts` 进入，再被 `commissionRecords.ts`、`creatorAliases.ts`、`characterAliases.ts`、`keywordAliases.ts`、`homeFeaturedSearchKeywords.ts` 消费
  - 图片事实源已由 `apps/web/src/lib/images/sourceImageRegistry.ts` 读取 generated manifest，并映射到 `/generated/source-images/*`
  - `apps/web/src/lib/home/buildSitePayload.ts`、`apps/web/src/lib/pipeline/homeSearchEntries.ts`、`apps/web/src/lib/rss/feed.ts`、`apps/web/src/pages/search/*`、`apps/web/src/pages/rss.xml.ts` 已全部建立在 generated 输入之上
  - `bun run build:web` 现已直接反映远端 D1/R2 导出的事实源结果
- 核心判断：
  - 这一步不是“再给页面层加一个远端查询函数”，而是要把 `apps/web` 的 build input 改成 generated artifacts
  - 只要 `astro:assets` 还负责首页和 batch 图片优化，R2 source images 就必须先被下载到本地 generated 目录，再进入现有图片渲染链
- 离完成还差什么：
  - 这一层只剩 publish contract 尚未补齐；build-input cutover 本身已收口

### 2.4.1 Web Build 当前依赖图

- 文本链路：
  - `apps/web/data/sqlite.ts`
  - `apps/web/data/commissionRecords.ts` / `creatorAliases.ts` / `characterAliases.ts` / `keywordAliases.ts` / `homeFeaturedSearchKeywords.ts`
  - `apps/web/data/commissionData.ts`
  - `apps/web/src/lib/home/buildSitePayload.ts`
  - `apps/web/src/features/home/pages/HomePage.astro`、`apps/web/src/lib/pipeline/homeSearchEntries.ts`、`apps/web/src/lib/rss/feed.ts`、`apps/web/src/pages/search/*`、`apps/web/src/pages/rss.xml.ts`
- 图片链路：
  - `apps/web/src/lib/images/sourceImageRegistry.ts`
  - `apps/web/src/features/home/commission/CommissionEntries.astro`
  - `apps/web/src/features/home/server/homeCharacterBatchPayload.ts`
  - `apps/web/src/features/home/server/homeTimelineBatchPayload.ts`
  - 以上链路最终都要经过 `getImage()` 生成构建期图片产物
- 设计含义：
  - 只要先把最底层数据入口替换掉，上层首页 / 搜索 / RSS / batch 生成逻辑就可以最大程度保持不动
  - 这比直接重写 `buildSitePayload`、`rss`、`home-search-entries` 更稳，回归面也更小

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
  - 两个 app-local `wrangler.jsonc` 都已有域名路由骨架
  - admin worker 已去掉内置 Basic Auth；production 访问控制预期由 Cloudflare Zero Trust 承担
  - 主站与 admin 都已具备独立 `wrangler` 上线入口：
    - `bun run deploy:web`
    - `bun run deploy:admin`
  - 仓库根已补齐 Cloudflare Workers Builds 友好命令：
    - `bun run build:web:cf`
    - `bun run deploy:web:cf`
    - `bun run build:admin:cf`
    - `bun run deploy:admin:cf`
  - Cloudflare Dashboard 必须单独配置 build/deploy command，因为 Workers Builds 不读取 `wrangler` custom build
  - 三个独立 `dev:*` 命令已存在
  - `apps/admin` 与 `apps/web` 的 Playwright 开发服务器已可协同工作
- 离完成还差什么：
  - Cloudflare Dashboard 上的 Workers Builds 项目仍需实际配置并验真一次 push build/deploy
  - Cloudflare Zero Trust 的 production gate 仍需在 Dashboard 手工配置并验真
  - D1/R2 bindings 与 secrets 收口；这是 admin 后台开始真实远程读写的前置条件
  - preview / production 差异文档
  - 一条命令拉起完整开发栈
  - `apps/admin` 对 worker dev 的真实联调

## 3. 未完成项细化

### 3.1 Worker 写路径原生化

#### `apps/admin-worker/src/adminApi.ts`

- 当前：
  - 读路径部分 D1/R2 化
  - 默认 backend 已会在存在 `DB` binding 时优先切到 character CRUD 的 worker-native persistence
  - CRUD 壳已经在 worker，不再是原始白名单代理
  - 但这些 binding-aware 路径尚未通过 `wrangler` 真实接线
- 默认方案：
  - 保持 `adminApi.ts` 只负责路由、归一化、错误响应、backend 组装
  - 新增独立 persistence backend，不把 SQL / D1 / R2 写逻辑塞回 `adminApi.ts`
- 下一步：
  - 先把 `wrangler` 的真实 `DB` / `IMAGES` bindings 接上，让已经完成的远程路径进入主链路
  - 让 `createDefaultCrudBackend()` 在具备持久层 bindings 时优先走 worker persistence backend
  - route-by-route 继续替换 `createCommission` / `updateCommission` / `deleteCommission`，并补齐 `source-image POST`
  - 继续收紧 legacy fallback，只保留尚未原生化的 write 路由

#### `apps/admin-worker/wrangler.jsonc`

- 当前：
  - 只有 `ASSETS` 与 `LEGACY_ADMIN_API_BASE_URL`
  - 还没有真实 `DB` / `IMAGES` bindings
- 这意味着什么：
  - 当前即使 worker 代码里已经支持 D1/R2，也不会自动开始远程读写
  - “什么时候能读写远程数据库”的第一道门槛就在这里
- 下一步：
  - 为 preview / production 明确 D1 `database_id`
  - 为 preview / production 明确 R2 bucket
  - 补齐 secrets / 本地开发策略 / runbook
  - 接线完成后，先验证 M1 里列出的远程读写能力

#### `apps/admin-worker/src/adminData.ts`

- 当前：
  - 当前承接远端读模型：bootstrap、aliases、suggestion、character commissions、source image GET
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
  - 当前：存在 `DB` binding 时已迁入 worker persistence；缺 binding 时再 fallback
  - 下一步：在 `wrangler` 接线后收紧 runtime fallback 范围
- `suggestion` 保存
  - 当前：GET 可走 D1，POST 在存在 `DB` binding 时也已可走 worker persistence
  - 下一步：在 `wrangler` 接线后把 fallback 从“默认路径”降到“兼容兜底”
- `source-image` replace/upload
  - 当前：GET 可走 R2；POST 仍未原生化
  - 默认方案：worker 写 R2，legacy 本地文件写入仅作为 fallback
- `assets/refresh`
  - 当前：worker 已原生返回 compatibility no-op，legacy 只剩本地 dev 兼容实现
  - 默认方案：worker 保留同等 no-op，直到 Publish 成型前都不引入新语义
  - 后续切换：Publish 落地后再决定把 UI 上的 refresh affordance 改成显式 publish

### 3.2 Public web 解耦

#### 推荐主线：D1/R2 -> generated build inputs -> Astro build

- 第 1 层：D1 中的 characters/commissions/aliases/featured keywords 是结构化事实源，R2 中的 source images 是原图事实源
- 第 2 层：单独的导出步骤把远端事实源物化到 `apps/web/generated/fact-source/*` 与 `apps/web/generated/source-images/*`
- 第 3 层：`apps/web/data/*` 和 `apps/web/src/lib/images/sourceImageRegistry.ts` 只读取 generated artifacts
- 第 4 层：现有 `buildSitePayload`、home search、RSS、character/timeline batch 继续在 Astro build 内做站点级派生
- 第 5 层：后续 Publish 再把 Astro build 产物或 publish bundle 推到 R2/current pointer

#### build-input contract 默认方案

- generated 目录建议：
  - `apps/web/generated/fact-source/content.json`
  - `apps/web/generated/fact-source/source-images-manifest.json`
  - `apps/web/generated/source-images/<fileName>`
- `content.json` 最小字段：
  - `characters`: `CharacterRecord[]`
  - `creatorAliases`: `CreatorAliasEntry[]`
  - `characterAliases`: `CharacterAliasEntry[]`
  - `keywordAliases`: `KeywordAliasEntry[]`
  - `featuredSearchKeywords`: `string[]`
  - `meta`: 导出时间、源环境、可选 publish/source revision
- `source-images-manifest.json` 最小字段：
  - `files`: `fileName`、mime type、etag/checksum、size、lastModified
  - `missing`: 远端缺失或下载失败的文件列表
- 重要边界：
  - build-input contract 不是 `rss.xml`、`home-search-entries.json`、`home-character-batches/*` 这些最终站点输出
  - 这些最终输出仍由 `apps/web` 在 Astro build 阶段根据 generated inputs 推导，以保留现有 `getImage()`、lazy batch、locale route 与 DOM contract

#### 统一 snapshot / publish contract 默认方案

- build-input contract：
  - 只服务 `apps/web` 构建
  - 目标是替换本地 SQLite / `data/images/*`
- publish contract：
  - 只服务“哪一版站点对外可见”
  - 目标是保存 Astro build 后的站点产物与 current pointer
- 两层不要混写：
  - build-input 层解决“构建吃什么”
  - publish 层解决“哪一版对外生效”

#### `apps/web/data/sqlite.ts`

- 当前：
  - `apps/web` 公开站只读 SQLite 入口
  - 同时兼容 Bun `bun:sqlite` 与 Node `better-sqlite3`
- 下一步：
  - 让它退出公开站 build 主路径
  - 最多只保留为一次性 bootstrap / parity 工具输入
  - 不再作为首页、搜索、RSS、batch 的事实源入口

#### `apps/web/data/commissionRecords.ts`、`creatorAliases.ts`、`characterAliases.ts`、`keywordAliases.ts`、`homeFeaturedSearchKeywords.ts`

- 当前：
  - 这些模块仍直接或间接查询 SQLite
- 默认方案：
  - 保持现有导出 API 基本不变，只替换内部事实源
  - 新增 generated fact-source loader，让这些模块从 `apps/web/generated/fact-source/content.json` 读数据
- 下一步：
  - 先把公共 JSON loader 落下
  - 再逐个替换这些 data module 的内部实现
  - 上层 `buildSitePayload`、search、RSS、batch 先尽量不动

#### `apps/web/src/lib/images/sourceImageRegistry.ts`

- 当前：
  - 通过 `import.meta.glob('/data/images/*.{jpg,jpeg,png}')` 直接绑定本地图片
- 默认方案：
  - 改成 generated build input adapter
  - 图片文件从 `apps/web/generated/source-images/*` 读取，诊断信息从 `source-images-manifest.json` 读取
- 下一步：
  - 保持现有 stem 归一化 / fallback 匹配逻辑
  - 只替换 glob 根目录与缺图诊断入口
  - 不在这一步修改首页 / batch 图片组件的输出契约

#### `apps/web/src/lib/home/buildSitePayload.ts`

- 当前：
  - 从 data modules 组装页面输入
- 下一步：
  - 尽量保持现状不变
  - 只要下层 data modules 已切到 generated fact-source，它就会自然吃到远端结果
  - 如果后续需要进一步提速，再考虑引入预计算的 `site-payload.json`

#### `apps/web/src/lib/pipeline/homeSearchEntries.ts`

- 当前：
  - 仍从 data modules 推导 search entries
- 下一步：
  - 暂不预计算最终 `home-search-entries.json`
  - 先通过下层 generated fact-source 替换，让现有搜索派生逻辑复用原实现

#### `apps/web/src/lib/rss/feed.ts`

- 当前：
  - 仍从 data modules 生成 RSS 内容
- 下一步：
  - 暂不直接消费远端 `rss.xml`
  - 先通过 generated fact-source 让 Astro build 继续生成当前 RSS 输出

#### `apps/web/src/pages/search/home-search-entries.json.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 保持 route 形状不变
  - 让其通过 generated fact-source 间接吃到远端结果

#### `apps/web/src/pages/search/home-character-batches/[locale]/[status]/[batch].json.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 保持 route、payload 和 DOM contract 不变
  - 让其通过 generated fact-source + generated source images 间接吃到远端结果

#### `apps/web/src/pages/search/home-timeline-batches/[locale]/[batch].json.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 保持 route、payload 和 DOM contract 不变
  - 让其通过 generated fact-source + generated source images 间接吃到远端结果

#### `apps/web/src/pages/rss.xml.ts`

- 当前：
  - 仍在构建/请求时从本地数据生成输出
- 下一步：
  - 保持 route 形状不变
  - 让其通过 generated fact-source 间接吃到远端结果

#### `apps/admin-worker/scripts/exportWebFactSource.ts`（新增推荐）

- 目标：
  - 从远端 D1/R2 导出 `apps/web` 构建所需的 generated inputs
- 默认职责：
  - 读取 D1 中的 characters / commissions / aliases / featured keywords
  - 写出 `apps/web/generated/fact-source/content.json`
  - 从 R2 下载 source images 到 `apps/web/generated/source-images/*`
  - 写出 `apps/web/generated/fact-source/source-images-manifest.json`
- 明确不做：
  - 不生成最终的 `rss.xml`
  - 不生成最终的 `home-search-entries.json`
  - 不生成最终的 character/timeline batch JSON
  - 这些仍由 Astro build 生成

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
  - 保持 `assets/refresh` 为 worker 兼容 no-op，不再回退到 passthrough
- 验收信号：
  - CRUD / alias / suggestion / source-image POST 在不命中 legacy proxy 的情况下完成
  - `apps/admin-worker/src/adminApi.test.ts` 覆盖对应 happy path / validation / failure path
  - standalone admin 写入路径不再依赖 `apps/web/server/adminApiHandler.ts`
- 失败回滚点：
  - 路由级 fallback 仍可暂时切回 legacy backend
  - 每类路由独立提交，避免一次性替换全部写路径

### Phase B：Web Build 远端事实源切换（当前主线）

- 目标：
  - 让 `bun run build:web` 在不依赖 `apps/web/data/commissions.db` 与 `apps/web/data/images/*` 的情况下通过
- 输入前提：
  - remote D1/R2 parity 已完成第一次验证
  - admin worker 的远端读写已足够稳定
- 具体改动面：
  - 新增 `apps/admin-worker/scripts/exportWebFactSource.ts`
  - 新增 `apps/web/generated/fact-source/*` 与 `apps/web/generated/source-images/*` 约定
  - 新增 generated fact-source loader
  - 改造 `apps/web/data/commissionRecords.ts`、`creatorAliases.ts`、`characterAliases.ts`、`keywordAliases.ts`、`homeFeaturedSearchKeywords.ts`
  - 改造 `apps/web/src/lib/images/sourceImageRegistry.ts`
  - 把 `build:web` 接上“先导出 generated inputs，再 Astro build”的前置步骤
- 验收信号：
  - 首页、搜索、RSS、timeline/character batches 输出行为与现状一致
  - 直接断开本地 `apps/web/data/commissions.db` / `apps/web/data/images/*` 入口后，公开站构建仍可通过
  - `bun run check`
  - `bun run test`
  - `bun run build:web`
  - 变更到 home/search/nav/layout 时继续跑 `bun run test:visual`
- 失败回滚点：
  - 不回退到本地 SQLite / `data/images/*`
  - 如果 cutover 失败，就继续修 generated fact-source 导出链路与 loader，而不是恢复双轨运行

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
