# 统一迁移状态板（2026-03-18）

## 北极星目标

- [ ] `apps/web` 继续作为 Astro 静态公开站，部署到 `crystallize.cc`
- [ ] `apps/admin` 成为唯一的 standalone 管理端前端，部署入口为 `admin.crystallize.cc`
- [ ] `apps/admin-worker` 成为唯一的管理端 API / 静态托管 / 认证边界
- [ ] admin `Save` 只写事实源，公开站只在显式 `Publish` 后更新
- [ ] admin 视觉风格严格继承 legacy `/admin/*`，迁移过程始终受 Playwright 基线约束
- [ ] 本地开发最终收敛为一套联合联调链路，而不是三套互相独立的 `dev:*` 命令

## 当前仓库结构真值

- `apps/web`：当前公开站真实运行时，公开构建链只读 `generated/*`；仓库内本地 SQLite/源图已删除，legacy `/admin/*` 代码仅剩未挂载的参考实现
- `apps/admin`：standalone 管理端前端已完成五个主页面迁移，视觉基线已建立，但运行仍依赖 worker API
- `apps/admin-worker`：已有 worker 入口、Basic Auth、local-dev CORS、`adminData` 读侧、`adminPersistence` 写侧，以及 character/commission CRUD、alias/suggestion 写入、source-image GET/POST 的 D1/R2 主路径；`source_images` 元数据表、seed/export 增量校验也已接入
- `packages/domain`：已承接共享类型与纯逻辑，是当前唯一进入主链路的共享包
- `packages/cloudflare`：仅有占位 env 类型，当前未被主链路引用，也尚未承接实际 worker 共享能力
- `packages/ui`：仅有占位导出，尚未吸收 admin/web 的共享 UI
- `packages/config`：仅有 README 占位，尚未承接 tsconfig / lint / build 共享配置

## 当前进度总览

- `已完成` Standalone admin 前端：`overview` / `create` / `edit` / `aliases` / `suggestion` 已全部迁入 `apps/admin`
- `部分完成` Admin worker 读路径：`/api/admin/health`、`/api/admin/bootstrap`、`/api/admin/aliases/bootstrap`、`/api/admin/suggestion` GET、`/api/admin/characters/:id/commissions` GET、`/api/admin/source-image/:fileName` 的 worker-native code path 已具备，且 `wrangler` 已声明 `DB` / `IMAGES` bindings；但 remote preview / production 资源仍未验真
- `部分完成` Admin worker 写路径：CRUD、alias、suggestion、source-image 的 worker-native D1/R2 主路径已齐，`assets/refresh` 已收口为 worker 原生兼容 no-op；当前剩余的是 deployed worker smoke check 与 legacy bridge 进一步缩边
- `部分完成` 远程 D1/R2 实际使用：production D1 migrations `0001` / `0002` 已应用，production R2 source images 已同步，`source_images` 已记录 `commission_file_name/object_key/mime_type/byte_size/sha256`，导出脚本已能按扩展名与 hash 增量复用；但 admin 端到端远程写链路与 deployed worker smoke check 仍未收口
- `已完成` Public web 事实源解耦：`apps/web` 渲染/构建链已改为消费 `apps/admin-worker/scripts/exportWebFactSource.ts` 生成的 `generated/*`，公开站 build 不再读取本地 SQLite 与 `data/images/*`
- `当前主攻` 云端事实源与 Publish：build-input contract 已落地，下一步主线转为 publish-status、锁与恢复策略，以及 deployed worker / admin 远端 smoke check
- `部分完成` 部署、认证、本地联调：域名路由、admin worker Basic Auth、独立 `dev:web` / `dev:admin` / `dev:worker` 已有，且仓库根已补齐 `deploy:web` / `deploy:admin` 与 Cloudflare Builds 友好命令；但尚无统一联调命令、完整 bindings/runbook，也还没在 Dashboard 上验真 push build/deploy

## 阶段状态

### 阶段 0：基础设施与基线

- [x] Astro 运行时迁入 `apps/web`
- [x] 建立 `apps/admin`、`apps/admin-worker`、`packages/domain`、`packages/ui`、`packages/cloudflare`、`packages/config`
- [x] 根脚本覆盖 `dev`、`build`、`lint`、`check`、`test`、`test:visual`
- [x] 根级 `vitest.config.ts` / `playwright.config.ts` 落地
- [x] committed Playwright 基线统一放在根 `test/visual/apps/*`
- [x] legacy admin 基线已覆盖 `overview` / `create` / `edit` / `aliases` / `suggestion`

### 阶段 1：standalone admin 页面对齐

- [x] standalone admin shell 已落地
- [x] `overview` / `create` / `edit` / `aliases` / `suggestion` 已迁入 `apps/admin`
- [ ] 现有顶层样式契约虽已迁入，但 standalone 设计与 legacy `/admin/*` 仍未完全 1:1 对齐
- [ ] legacy 已使用 shadcn/Radix `Select` / dropdown 的位置必须按原控件形态与交互复刻；当前 `AddCharacterForm`、`CommissionFormFields` 仍存在原生 `<select>` 漂移
- [ ] route 级视觉回归仍需覆盖真正的 standalone 对齐，而不只是保留 legacy 参考基线；`overview` 也需要 standalone visual coverage
- [ ] 仍缺独立 smoke test，当前 admin 自动化仍以视觉回归为主

### 阶段 2：admin worker 能力补齐

- [x] worker 入口、路由分发、Basic Auth、local-dev CORS 已落地
- [x] worker 已原生持有 `health` 与一组 binding-aware D1/R2 读路径
- [x] worker 已原生持有 CRUD 路由契约：命中、入参归一化、错误响应壳
- [x] `assets/refresh` 已从 legacy passthrough 收口为 worker 原生兼容 no-op
- [x] `apps/admin-worker/wrangler.jsonc` 已声明 `DB` / `IMAGES` bindings，并接入 D1 migration 目录与本地 bootstrap 脚手架
- [x] commission CRUD 已由 worker-native D1 persistence 接管，不再依赖 legacy backend
- [x] alias batch 写入与 suggestion 保存由 worker persistence 接管；已知 admin 写路由缺 binding 时直接失败
- [x] `source-image POST` 已由 worker-native R2 写路径接管
- [x] 写路径测试矩阵已覆盖 alias/suggestion/character/commission/source-image 的 worker-native 路径与缺 binding 报错语义

### 阶段 3：公开站事实源解耦

- [x] `packages/domain` 已承接一部分类型与纯逻辑
- [x] `apps/web` 的 build input contract 已定稿首版：覆盖 `generated/fact-source/content.json`、`generated/fact-source/source-images-manifest.json`、`generated/source-images/*`
- [x] `apps/admin-worker/scripts/exportWebFactSource.ts` 已可把远端 D1/R2 结果导出到 `apps/web/generated/*`
- [x] `apps/web/data/sqlite.ts` 已退出公开站 build 主路径，并从 `apps/web/data` 删除
- [x] `apps/web/data/commissionRecords.ts`、`creatorAliases.ts`、`characterAliases.ts`、`keywordAliases.ts`、`homeFeaturedSearchKeywords.ts` 已改为只读 generated fact-source content
- [x] `apps/web/src/lib/images/sourceImageRegistry.ts` 已改为只读 generated source-images manifest 与 `/generated/source-images/*`
- [x] `apps/web/src/lib/home/buildSitePayload.ts`、`apps/web/src/pages/search/*.ts`、`apps/web/src/pages/rss.xml.ts` 已通过下游 data module 间接消费 generated inputs
- [x] 已证明 `bun run build:web` 在不依赖本地 `apps/web/data/commissions.db` / `apps/web/data/images/*` 的情况下可通过

### 阶段 4：D1 / R2 / Publish 模型

- [x] 已生成 D1 migration SQL baseline（`apps/admin-worker/migrations/0001_admin_fact_source.sql`）
- [x] 已新增 `apps/admin-worker/migrations/0002_source_image_metadata.sql`，把源图扩展名/hash/大小元数据纳入 D1 `source_images`
- [x] 已定义当前 R2 object key 规则：沿用 source image 原文件名作为 object key
- [x] 已完成最后一次 SQLite -> D1、`data/images/*` -> R2 的迁移，并删除仓库内本地 bootstrap/check/sync 脚本与数据副本
- [x] 远端导出已支持按 `commission_file_name + object_key + byte_size + sha256` 增量复用生成图，不匹配时才重新下载并回写 D1 元数据
- [ ] 尚未建立 `dirty` / `publishing` / `published` / `failed` 状态流
- [ ] 尚未建立 publish 锁、重试与失败恢复机制

### 阶段 5：部署、认证、联调

- [x] `apps/web/wrangler.jsonc` 与 `apps/admin-worker/wrangler.jsonc` 已有域名路由骨架
- [x] `apps/admin-worker/src/index.ts` 已有 Basic Auth 与本地同源/CORS 处理
- [x] 根脚本已有 `dev:web` / `dev:admin` / `dev:worker`
- [x] 根脚本已补齐独立 deploy 入口：`bun run deploy:web` / `bun run deploy:admin`
- [x] 根脚本已补齐 Cloudflare Workers Builds 友好入口：`bun run build:web:cf` / `deploy:web:cf` / `build:admin:cf` / `deploy:admin:cf`
- [ ] D1 / R2 secrets、preview / production 差异与 remote 验证 runbook 仍未文档化；`apps/admin-worker/wrangler.jsonc` 已声明 bindings，但远程资源切换策略仍待定稿
- [ ] 尚无一条命令同时拉起 `apps/web` + `apps/admin` + `apps/admin-worker`
- [ ] `apps/admin` 当前 Playwright 仍通过 `ADMIN_API_BASE_URL=http://127.0.0.1:4173` 访问 legacy dev server，而不是 worker dev

### 阶段 6：遗留实现清理与收尾

- [ ] `apps/web/src/devAdmin/pages/*` 仍保留为未挂载参考代码
- [ ] `apps/web/server/devAdminAstro.ts` 仍保留为未接线参考代码
- [ ] `apps/web/server/adminApiHandler.ts` 仍是 legacy admin 真正写入执行者
- [ ] `apps/web/src/features/admin/*` 与 `apps/admin/src/*` 仍双实现并存
- [ ] README / AGENTS / runbook 尚未在 cutover 前后统一收口

## 当前遗留耦合

- [x] `apps/web/server/devAdminAstro.ts`：已从 `astro.config.ts` 断开，不再把 legacy `/admin/*` 注入 Astro dev
- [ ] `apps/web/server/adminApiHandler.ts`：仍保留为 legacy admin 写路径参考代码，但不再是默认运行链
- [ ] `apps/web/src/lib/admin/db.ts`：仍保留为 legacy 本地写路径参考代码，但仓库内本地 SQLite 已删除
- [ ] `apps/web/src/features/admin/imageUpload.ts`：仍保留为 legacy 本地图片写路径参考代码，但仓库内本地图源图已删除
- [x] `apps/web/data/sqlite.ts`：已删除
- [x] `apps/web/src/lib/images/sourceImageRegistry.ts`：已切到 generated source images
- [ ] `apps/web/src/devAdmin/pages/*`：继续保留 legacy admin 页面壳
- [ ] `apps/web/src/features/admin/*` 与 `apps/admin/src/*`：继续双实现并存，存在重复维护风险

## 当前主要风险 / 阻塞

- [ ] build-input hard cutover 已完成，但 publish state / current pointer 仍未建立；现在还不能把“远端事实源”直接等同于“对外发布闭环”
- [ ] `home-character-batches` / `home-timeline-batches` 的图片 payload 依赖 `getImage()`；因此最终 batch JSON 仍不能在 D1/R2 导出脚本里预生成，必须继续由 Astro build 基于 generated source images 推导
- [ ] `source_images` 元数据已经让导出变成增量，但这套 hash/扩展名契约必须持续由 worker 写路径、seed 脚本和导出脚本共同维护，不能再次漂移
- [ ] standalone admin 虽已完成页面迁移，但只要 `apps/web/src/features/admin/*` 和 legacy `/admin/*` 继续存在，就仍有双实现漂移风险
- [ ] standalone admin 当前已经出现“页面迁入完成但控件/设计未完全复刻”的信号；如果不把 shadcn/ui 与 legacy 交互细节列为硬性验收，视觉漂移会继续扩大
- [x] `assets/refresh` 已明确为 worker 兼容性 no-op；后续不得再次误用成“发布按钮”

## 下一步关口

1. 定义 publish bundle / current pointer / `Save` vs `Publish`，把“构建吃什么”与“哪一版对外生效”真正闭环起来
2. 给 deployed worker 与 standalone admin 补远端 smoke check，证明远端写入后的读取、构建、图片访问都能闭环
3. 收口 remote runbook、单命令联调，以及 preview / production 资源切换规则
4. 继续清理 `apps/web` legacy admin 与双实现组件
5. 回头收口 standalone admin 的视觉/交互 1:1 对齐

## 当前执行切片（2026-03-18 web build 远端事实源切换）

- [x] 梳理 `apps/web` 当前对本地 SQLite / `data/images/*` 的依赖链，明确底层入口文件与上层消费链
- [x] 定稿推荐主线为 `D1/R2 -> generated build inputs -> apps/web build`，而不是在页面层直接查 D1 / 直接读 R2 URL
- [x] 把这条主线的详细流程、边界、约束与验收写入 `tasks/roadmap.md` 与 `tasks/todo.md`
- [x] 定义 `content.json` 与 `source-images-manifest.json` 的精确字段契约，并沉淀到 `packages/domain/src/factSource.ts`
- [x] 新增远端导出脚本，把 D1/R2 结果落到 `apps/web/generated/*`
- [x] 让 `apps/web/data/*` 与 `sourceImageRegistry.ts` 切到 generated inputs
- [x] 直接拔掉本地 `apps/web/data/commissions.db` / `apps/web/data/images/*` 的 build 依赖并跑通 `bun run build:web`

## Review（2026-03-18 web build 远端事实源切换）

- [x] 已明确写出公开站当前真正卡住的位置是 `apps/web` 的 build input，而不是 admin worker 再多补几个 D1/R2 route
- [x] 已把 build-input contract 与 publish contract 拆成两层，避免再把“构建吃什么”和“哪一版对外生效”混成一个 snapshot 概念
- [x] 已明确记录：最终 batch JSON 与 RSS/search route 仍应由 Astro build 推导，不能在远端导出脚本里提前伪造
- [x] 已按用户约束收口为硬切换方案：不保留 local adapter、不保留本地数据过渡窗口，直接拔掉公开站的本地数据入口
- [x] `bun run --cwd packages/domain typecheck` 通过。
- [x] `bun run --cwd apps/admin-worker web:fact-source:export --output-root ./.wrangler/tmp/web-fact-source-export` 通过，产出 `12 characters / 16 creator aliases / 3 character aliases / 8 keyword aliases / 6 featured keywords / 123 source images / 0 missing`。
- [x] `bun run lint` 通过。

## 本轮执行切片（2026-03-18 D1 源图元数据增量导出）

- [x] 在 D1 新增 `source_images` 元数据表迁移，存储 `commission_file_name`、`object_key`、`mime_type`、`byte_size`、`sha256`
- [x] 让 worker 的 source-image 创建/替换路径在写 R2 后同步回写 D1 元数据
- [x] 让 `buildD1SeedSql.mjs` 把本地 bootstrap 图片的扩展名/hash/大小写进 seed SQL
- [x] 让 `exportWebFactSource.ts` 优先使用 D1 元数据判断本地 generated 图片是否可复用，不匹配时才重新下载并补写元数据
- [x] 跑通类型检查、测试、lint、双次导出、`check` 与 `build`

## Review（2026-03-18 D1 源图元数据增量导出）

- [x] `bun run --cwd apps/admin-worker typecheck` 通过。
- [x] `bunx vitest run -c vitest.config.ts apps/admin-worker/src/adminApi.test.ts` 通过（30 tests）。
- [x] `bun run lint` 通过。
- [x] 连续两次 `bun run web:fact-source:export` 都得到 `materializedImages=123 | downloadedImages=0 | reusedImages=123 | metadataUpserts=0 | missingImages=0`。
- [x] `bun run test` 通过（51 files / 184 tests）。
- [x] `bun run check` 通过（0 errors / 0 warnings）。
- [x] `bun run build` 通过。

## 本轮执行切片（2026-03-18 删除本地数据源）

- [x] 删除仓库内 `apps/web/data/commissions.db`
- [x] 删除仓库内 `apps/web/data/images/*`
- [x] 删除依赖本地 SQLite/源图的 bootstrap/check/sync 脚本入口与对应根脚本
- [x] 断开 `apps/web` 的 legacy dev admin 注入，避免本地开发继续命中本地数据入口
- [x] 删除以本地 SQLite/图片目录为前提的测试与测试工具
- [x] 跑通本轮删源后的 lint/test/check/build

## Review（2026-03-18 删除本地数据源）

- [x] `bun run lint` 通过。
- [x] `bun run test` 通过（44 files / 172 tests）。
- [x] `bun run build:admin` 通过。
- [x] `bun run check` 通过（0 errors / 0 warnings）。
- [x] `bun run build` 通过。
- [x] `bun run build` / `bun run check` 均在仓库内已无 `apps/web/data/commissions.db` 与 `apps/web/data/images/*` 的前提下完成。

## 本轮执行切片（2026-03-17 文档）

- [x] 在 README、AGENTS、apps/admin-worker/AGENTS 以及任务文档里同步记录 Admin 以 worker + D1/R2 为主、legacy 仅作回滚/bridge 的转换导向。
- [x] 在 `tasks/todo.md` 末尾新增本轮切片列表，确保有可勾选项来追踪这轮文档更新的完成状态。
- [x] 在 `tasks/lessons.md` 追加本轮用户纠偏经验，总结这次迁移记录需要明确标注 worker code path 与 legacy binding 状态的差异。

## 本轮执行切片（2026-03-17 admin dev 收口）

- [x] 把根脚本 `bun run dev:admin` 切到 `apps/admin` + 本地 `wrangler dev`（remote bindings） 的统一入口。
- [x] 移除 standalone admin worker 对 legacy `/api/admin/*` 的运行时 fallback；已知 admin 路由在缺 `DB` / `IMAGES` bindings 时直接失败。
- [x] 更新 worker contract tests，把“fallback 成功”改成“缺 binding 明确报错”。
- [x] 更新 README、AGENTS、`apps/admin/AGENTS.md`、`apps/admin-worker/AGENTS.md`，明确 `dev:admin` 与远程 D1/R2 是唯一默认主线。
- [x] 跑通本轮针对性验证并把结果补到 Review。

## Review（2026-03-17 admin dev 收口）

- [x] `bun run dev:admin` 已改为默认拉起 standalone admin + remote worker。
- [x] worker 已删除 `LEGACY_ADMIN_API_BASE_URL` 运行时依赖与对应 fallback 路径。
- [x] bootstrap / suggestion / source-image / CRUD 写路径在缺 binding 时会返回 503，而不是静默回落到 `apps/web`。
- [x] 任务文档已记录这次“远程 D1/R2 唯一路径”的切换方向。
- [x] `bun run dev:admin` 已切出 `wrangler dev --remote`，改为本地 `wrangler dev` + `remote: true` bindings，并确认 `GET /api/admin/health`、`/bootstrap`、`/aliases/bootstrap`、`/suggestion` 可正常返回。
- [x] 已通过 HTTP `POST /api/admin/characters` + 远程 D1 读回 + HTTP `DELETE /api/admin/characters/:id` 完成一次真实远程写入闭环验证。
- [x] `apps/admin-worker` 的 local-only bootstrap/check/sync 脚本入口已删除，`.wrangler/state` 本地持久态已清除。
- [x] 已验证：`bunx vitest run -c vitest.config.ts apps/admin-worker/src/adminApi.test.ts`、`bun run --cwd apps/admin-worker typecheck`、`bun run --cwd apps/admin typecheck`、`bun run build:admin`、`bun run lint`。

## 本轮执行切片（2026-03-18 本地联调地址对齐）

- [x] 把 standalone admin 在本机环境下回跳公开站的地址统一为 `http://localhost:4321`，避免 `localhost` / `127.0.0.1` 混用造成的 origin 漂移。
- [x] 把 legacy admin API dev server 默认起始端口收口回 `8787`，与当前 standalone admin / worker 联调约定保持一致。
- [x] 跑通本轮针对性验证并把结果补到 Review。

## Review（2026-03-18 本地联调地址对齐）

- [x] `bun run lint` 通过。
- [x] `bun run build:admin` 通过。
- [x] `bun run build` 通过。

## 本轮执行切片（2026-03-18 Cloudflare Builds 脚本收口）

- [x] 把根级长期维护脚本 `scripts/devAdminRemote.mjs` 改成 `scripts/devAdminRemote.ts`
- [x] 给仓库根补齐 `build:web:cf` / `deploy:web:cf` / `build:admin:cf` / `deploy:admin:cf`
- [x] 给仓库根补齐手动独立上线入口 `deploy:web` / `deploy:admin`
- [x] 把 Cloudflare Workers Builds 不读取 `wrangler` custom build、需在 Dashboard 单独配置命令 的真值写入 roadmap/todo/AGENTS
- [x] 跑通本轮针对性验证并把结果补到 Review

## Review（2026-03-18 Cloudflare Builds 脚本收口）

- [x] `bun run lint` 通过。
- [x] `bun run build:admin` 通过。
- [x] `bun run build` 通过。
