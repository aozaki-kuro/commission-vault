# 统一迁移状态板（2026-03-17）

## 北极星目标

- [ ] `apps/web` 继续作为 Astro 静态公开站，部署到 `crystallize.cc`
- [ ] `apps/admin` 成为唯一的 standalone 管理端前端，部署入口为 `admin.crystallize.cc`
- [ ] `apps/admin-worker` 成为唯一的管理端 API / 静态托管 / 认证边界
- [ ] admin `Save` 只写事实源，公开站只在显式 `Publish` 后更新
- [ ] admin 视觉风格严格继承 legacy `/admin/*`，迁移过程始终受 Playwright 基线约束
- [ ] 本地开发最终收敛为一套联合联调链路，而不是三套互相独立的 `dev:*` 命令

## 当前仓库结构真值

- `apps/web`：当前公开站真实运行时，同时继续承载 dev-only legacy `/admin/*`、本地 SQLite、`data/images/*`、legacy admin 数据层与本地图片写入逻辑
- `apps/admin`：standalone 管理端前端已完成五个主页面迁移，视觉基线已建立，但运行仍依赖 worker API
- `apps/admin-worker`：已有 worker 入口、Basic Auth、local-dev CORS、`adminData` 读侧模块、binding-aware 的 D1/R2 读路径与 CRUD 路由契约壳，以及 alias/suggestion 与 character CRUD 的 D1 写持久层；但 `wrangler` 里尚未接入真实 `DB` / `IMAGES` bindings，commission CRUD 与 `source-image POST` 仍依赖 legacy bridge 或 fallback
- `packages/domain`：已承接共享类型与纯逻辑，是当前唯一进入主链路的共享包
- `packages/cloudflare`：仅有占位 env 类型，当前未被主链路引用，也尚未承接实际 worker 共享能力
- `packages/ui`：仅有占位导出，尚未吸收 admin/web 的共享 UI
- `packages/config`：仅有 README 占位，尚未承接 tsconfig / lint / build 共享配置

## 当前进度总览

- `已完成` Standalone admin 前端：`overview` / `create` / `edit` / `aliases` / `suggestion` 已全部迁入 `apps/admin`
- `部分完成` Admin worker 读路径：`/api/admin/health`、`/api/admin/bootstrap`、`/api/admin/aliases/bootstrap`、`/api/admin/suggestion` GET、`/api/admin/characters/:id/commissions` GET、`/api/admin/source-image/:fileName` 的 worker-native code path 已具备，但当前 `wrangler` 仍未配置真实 `DB` / `IMAGES` bindings
- `部分完成` Admin worker 写路径：CRUD 路由命中、入参归一化、错误响应壳已在 worker；`alias batch`、`suggestion` 保存与 character CRUD 已可在存在 `DB` binding 时走 worker 原生持久层；commission CRUD 与 `source-image POST` 仍未原生化，`assets/refresh` 已收口为 worker 原生兼容 no-op
- `部分完成` Public web 事实源解耦：`packages/domain` 已承接一部分纯逻辑，但 `apps/web` 渲染/构建链仍直接读取本地 SQLite 与 `data/images/*`
- `未开始` 云端事实源与 Publish：尚未建立 D1 migration、R2 object key 规则、publish-status、锁与恢复策略
- `部分完成` 部署、认证、本地联调：域名路由、admin worker Basic Auth、独立 `dev:web` / `dev:admin` / `dev:worker` 已有，但尚无统一联调命令、完整 bindings/runbook，且根目录 `wrangler.jsonc` 不是当前 deploy 真值

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
- [x] 现有顶层样式契约已延续，未做视觉重设计
- [x] 已迁移页面均已具备 Playwright 视觉基线
- [ ] 仍缺独立 smoke test，当前 admin 自动化仍以视觉回归为主

### 阶段 2：admin worker 能力补齐

- [x] worker 入口、路由分发、Basic Auth、local-dev CORS 已落地
- [x] worker 已原生持有 `health` 与一组 binding-aware D1/R2 读路径
- [x] worker 已原生持有 CRUD 路由契约：命中、入参归一化、错误响应壳
- [x] `assets/refresh` 已从 legacy passthrough 收口为 worker 原生兼容 no-op
- [ ] commission CRUD 持久化执行层仍未原生化；character CRUD 已可在存在 `DB` binding 时优先走 worker-native persistence
- [x] alias batch 写入与 suggestion 保存已在存在 `DB` binding 时走 worker persistence，缺 binding 时再 fallback
- [ ] `source-image POST` 仍保留 legacy bridge 或 fallback
- [ ] 写路径测试矩阵已开始覆盖 alias/suggestion/character CRUD 原生路径，但 commission/source-image 仍未补齐

### 阶段 3：公开站事实源解耦

- [x] `packages/domain` 已承接一部分类型与纯逻辑
- [ ] `apps/web/data/sqlite.ts` 仍是公开站读取本地 SQLite 的入口
- [ ] `apps/web/src/lib/images/sourceImageRegistry.ts` 仍直接导入本地 `data/images/*`
- [ ] `apps/web/src/lib/home/buildSitePayload.ts`、`apps/web/src/pages/search/*.ts`、`apps/web/src/pages/rss.xml.ts` 仍直接建立在本地 records / aliases / images 之上
- [ ] 统一 snapshot contract 仍未定义

### 阶段 4：D1 / R2 / Publish 模型

- [ ] 尚未生成正式 D1 migration SQL
- [ ] 尚未定义稳定的 R2 object key 规则
- [ ] 尚未建立 SQLite -> D1、`data/images/*` -> R2 的一次性迁移路径
- [ ] 尚未建立 `dirty` / `publishing` / `published` / `failed` 状态流
- [ ] 尚未建立 publish 锁、重试与失败恢复机制

### 阶段 5：部署、认证、联调

- [x] `apps/web/wrangler.jsonc` 与 `apps/admin-worker/wrangler.jsonc` 已有域名路由骨架
- [x] `apps/admin-worker/src/index.ts` 已有 Basic Auth 与本地同源/CORS 处理
- [x] 根脚本已有 `dev:web` / `dev:admin` / `dev:worker`
- [ ] D1 / R2 bindings、secrets、preview / production 差异仍未文档化，也尚未真正配置到 `apps/admin-worker/wrangler.jsonc`
- [ ] 尚无一条命令同时拉起 `apps/web` + `apps/admin` + `apps/admin-worker`
- [ ] `apps/admin` 当前 Playwright 仍通过 `ADMIN_API_BASE_URL=http://127.0.0.1:4173` 访问 legacy dev server，而不是 worker dev

### 阶段 6：遗留实现清理与收尾

- [ ] `apps/web/src/devAdmin/pages/*` 仍保留
- [ ] `apps/web/server/devAdminAstro.ts` 仍保留
- [ ] `apps/web/server/adminApiHandler.ts` 仍是 legacy admin 真正写入执行者
- [ ] `apps/web/src/features/admin/*` 与 `apps/admin/src/*` 仍双实现并存
- [ ] README / AGENTS / runbook 尚未在 cutover 前后统一收口

## 当前遗留耦合

- [ ] `apps/web/server/devAdminAstro.ts`：继续把 legacy `/admin/*` 注入 Astro dev
- [ ] `apps/web/server/adminApiHandler.ts`：继续承担 commission CRUD 默认写入 fallback 与 source-image 处理；alias/suggestion/character CRUD 不再是首选执行路径
- [ ] `apps/web/src/lib/admin/db.ts`：继续承担本地 SQLite 读写与隐式 schema 自修复
- [ ] `apps/web/src/features/admin/imageUpload.ts`：继续承担本地文件系统图片写入/替换
- [ ] `apps/web/data/sqlite.ts`：继续承担公开站对本地 SQLite 的只读访问
- [ ] `apps/web/src/lib/images/sourceImageRegistry.ts`：继续承担公开站对本地 `data/images/*` 的直接导入
- [ ] `apps/web/src/devAdmin/pages/*`：继续保留 legacy admin 页面壳
- [ ] `apps/web/src/features/admin/*` 与 `apps/admin/src/*`：继续双实现并存，存在重复维护风险

## 当前主要风险 / 阻塞

- [ ] worker 现在已经不是空壳，但“读路径原生化”容易被误判成“迁移已完成”；真正困难仍在写路径持久层与 publish 闭环
- [ ] `apps/web` 仍直连本地 SQLite 与本地图像；只要这一点不拆，云端事实源与 publish 都只能停留在脚手架阶段
- [ ] standalone admin 虽已完成页面迁移，但只要 `apps/web/src/features/admin/*` 和 legacy `/admin/*` 继续存在，就仍有双实现漂移风险
- [x] `assets/refresh` 已明确为 worker 兼容性 no-op；后续不得再次误用成“发布按钮”

## 下一步关口

1. 继续完成 worker 写路径原生化设计收口：在已落地 alias/suggestion persistence 的基础上，推进 CRUD backend 与 `source-image POST` 的逐路由替换
2. 再定义公开站 snapshot contract：至少覆盖 `site payload`、`home-search-entries`、`rss`、`home-character-batches`、`home-timeline-batches`
3. 在 snapshot contract 稳定后，再推进 D1 / R2 / Publish：把 `Save` 和 `Publish` 拆成两步，而不是继续扩展 legacy refresh
4. 只有在 worker 原生写链路、snapshot contract、publish 状态机全部稳定后，才删除 `apps/web` legacy admin 与双实现组件
5. 详细执行顺序、模块级拆解与验收标准统一写入 `tasks/roadmap.md`

## 当前执行切片（2026-03-17）

- [x] 为 `apps/admin-worker` 增加 `character CRUD` 的 worker-native D1 persistence backend
- [x] 在存在 `DB` binding 时，让 worker 默认 CRUD backend 优先接管 `create` / `update` / `reorder` / `delete character`
- [x] 为 `character CRUD` 原生路径补 contract tests，并确认 legacy fallback 未回归
- [x] 同步更新迁移状态与 `apps/admin-worker` 变更记录

## Review（2026-03-17）

- [x] `tasks/todo.md` 已从历史堆叠清单收敛为状态板
- [x] 已按当前代码真值重写 `apps/web` / `apps/admin` / `apps/admin-worker` / `packages/*` 的成熟度说明
- [x] 已把 worker 已原生化的读路径与尚未原生化的写路径明确区分
- [x] 已把当前遗留耦合点收口为一组可跟踪文件，而不是抽象口号
- [x] 详细迁移路线、模块级拆解、默认决策与验收标准转移到 `tasks/roadmap.md`
- [x] `apps/admin-worker` 已原生接管 `assets/refresh` 兼容 no-op，legacy passthrough allowlist 缩减一项
- [x] `apps/admin-worker` 已新增独立写侧持久层模块，用于 alias/suggestion 的 worker-native D1 写入
- [x] alias batch 与 suggestion POST 已从 worker legacy passthrough 主路径中收紧，相关 contract tests 已补入
- [x] `apps/admin-worker` 已新增 `src/adminData.ts`，让 bootstrap / aliases / suggestion / character commissions / source-image GET 在存在 `DB` / `IMAGES` bindings 时走 worker-native 读侧
- [x] 已把 D1/R2 的“条件 code path”与“wrangler 已配置真实 bindings”重新拆开描述，避免把未来接线写成当前真值
- [x] `apps/admin-worker` 已新增 character CRUD 的 worker-native D1 persistence，并让默认 CRUD backend 在存在 `DB` binding 时优先接管角色增删改与排序
