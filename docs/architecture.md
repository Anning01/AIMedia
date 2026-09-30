# 架构说明

## 进程与通信

```text
Electron 主进程
  ├─ main.ts：窗口、菜单、文件选择、生命周期
  ├─ preload.ts：受限桌面接口
  ├─ React 渲染进程：同源 HTTP 请求和 SSE 订阅
  └─ worker.ts：独立 utility process
       └─ Express 本机服务
            ├─ 生成队列 → 文本、检索与图片服务
            ├─ 发布调度 → Webhook 接收端
            └─ SQLite + 本地媒体
```

主进程管理桌面行为，业务网络请求和数据库操作在独立服务进程中执行。生产模式由本机服务提供 `renderer/dist/` 静态资源；开发模式加载 Vite 页面。

应用是单实例，默认服务地址为 `http://127.0.0.1:8000`。端口被占用时，桌面应用自动选择可用端口，并通过 preload 将实际地址交给界面；设置页显示对外接入地址。

## 模块职责

| 路径 | 职责 |
| --- | --- |
| `electron/main.ts` | 窗口、菜单、受校验 IPC、数据文件夹选择、启动与退出 |
| `electron/preload.ts` | 仅暴露服务地址、导入数据和打开数据目录等桌面能力 |
| `electron/worker.ts` | 服务启动、端口回退、接入令牌持久化、导入和停止 |
| `electron/server/api.ts` | REST 路由、访问控制、上传与 SSE |
| `electron/server/schema.ts`、`store.ts` | 表结构、列升级、事务与持久化 |
| `electron/server/generation.ts`、`templates.ts` | 生成队列、流式响应、模板与候选稿 |
| `electron/server/research/` | Firecrawl 适配、原文说法提取、证据校验和核查报告 |
| `shared/research.ts` | 前后端共用的核查契约、状态文字和来源链接约束 |
| `electron/server/media.ts`、`media-access.ts` | 图片服务、媒体下载、文件访问与签名链接 |
| `electron/server/content.ts` | HTML 清洗、正文归一化和媒体排布 |
| `electron/server/publishing.ts` | 发布策略、Webhook、幂等键、重试及版本检查 |
| `electron/server/import-storage.ts` | 数据导入、一致快照、备份与媒体复制 |
| `electron/server/validation.ts`、`types.ts` | 输入校验、默认设置与共享服务类型 |
| `renderer/src/` | React 页面、编辑器、主题与交互提示 |

## 状态与持久化

SQLite 使用 WAL；通过 Node 内置的 `node:sqlite` 访问。任务的 `generation_status` 和 `publish_status` 相互独立。草稿版本不可变，任务持有当前活动版本的引用。

生成队列最多同时执行两个任务。生成事件持久化为自增 ID，SSE 支持 `Last-Event-ID` 续传；任务列表订阅 `/api/tasks/events`，文章详情订阅 `/api/generation-runs/:runId/events`。Agent 生成的是候选稿，用户接受前不会替换文章的活动草稿。

对话改稿先从 `base_html` 提取最多 6 条关键事实，逐条检索后由文字模型比对证据，再将报告交给改稿步骤。报告通过 `fact_check_completed` 状态事件持久化，绑定 run 和基准版本；来源身份、原文摘录和证据摘录由服务校验。搜索结果使用 [Firecrawl Search 的 Markdown 抓取能力](https://docs.firecrawl.dev/api-reference/endpoint/search)，仅有摘要不能升级为确定结论。文章输入上限为 30,000 字符，每页证据上下文最多 4,000 字符，不持久化整页抓取内容；报告会说明选取范围，不能作为全文真实性保证。

发布时根据账号或全局配置组合贴牌 HTML，不写回正文版本。Webhook 请求携带幂等键，发布计划和每次尝试分别记录。完整退出应用后，生成与发布停止；下次启动恢复可执行状态。

## 数据目录与导入

桌面默认使用 Electron 的用户数据目录，数据库、媒体、接入令牌和备份都位于其 `storage/` 子目录。独立 API 调试服务默认使用项目下的 `storage-node/`。

导入器支持 SQLite 数据库和 `tasks.json`、`accounts.json`、`config.json` 文件：

1. 对 SQLite 源库建立一致快照，读取数据与媒体记录。
2. 复制媒体并更新本地路径。
3. 在目标数据目录的 `backups/` 中备份当前数据库，再在事务中插入数据。
4. 保留已有同 ID 记录与已有配置，重复导入不重复创建事件。

源目录保持不变。找不到的媒体标记为失败，需要补齐或重新上传。导入的待执行生成与发布计划暂存为 `paused_import`，下次启动才恢复执行。`.env` 不属于导入内容。

## 访问边界

渲染进程启用 sandbox 和 context isolation，关闭 Node integration。IPC 校验调用窗口和来源；本机服务校验 Host、Origin 和令牌。

桌面会话令牌与外部接入令牌相互独立。接入令牌只允许文章接入接口；密钥默认不随设置接口返回。公网媒体下载校验协议、DNS 地址、重定向、类型和体积。本地媒体通过受控 API 读取，发布用签名链接提供媒体访问。
