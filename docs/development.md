# 开发指南

## 安装与启动

要求 Node.js 22.16+ 和 npm。根目录与 `renderer/` 各自维护锁文件，根目录 `postinstall` 会安装界面依赖：

```bash
npm ci
npm run dev
```

桌面构建入口在 `scripts/build.mjs`，开发编排入口在 `scripts/dev.mjs`。React 文件保存后由 Vite 热更新，Electron 与服务代码修改后重新运行开发命令。

运行开发版前退出正在使用相同数据目录的桌面应用，避免单实例机制只唤起已有窗口。也可使用独立开发目录：

```bash
AI_MEDIA_DATA_DIR=./storage-node/development npm run dev
```

此时桌面数据库位于 `storage-node/development/storage/`，与默认用户数据分开。

## 配置

根目录 `.env.example` 提供开发环境示例。`.env` 由开发脚本和独立 API 服务读取，不会打包。

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | 文本服务凭证，保存的应用设置优先 |
| `OPENAI_BASE_URL` | 文本服务 API Base URL |
| `LLM_MODEL` | 文本模型名称 |
| `FIRECRAWL_API_KEY` | 网络检索凭证 |
| `AI_MEDIA_PORT` | 本机服务端口，默认 8000，0 为自动选择 |
| `AI_MEDIA_DATA_DIR` | 桌面模式覆盖用户数据根目录，其下使用 `storage/`；独立 API 模式直接作为数据目录 |
| `AI_MEDIA_API_TOKEN` | 仅独立 API 服务使用的访问令牌；未配置时生成并保存到 `api-token` |

图片服务在设置页配置模型、地址、凭证及可选的尺寸和质量参数。文本凭证与图片凭证独立。设置页中的已保存值优先于环境回退值，修改 `.env` 不会覆盖已有设置。

安装包使用用户数据目录中的设置，用户通过界面完成配置。

## 独立调试

只启动 Node API：

```bash
npm run server
```

默认数据目录为 `storage-node/`，访问令牌保存于其中的 `api-token`，接口请求使用 `Authorization: Bearer <令牌>`。独立服务端口占用会报错，可设置其他端口或设为 0。

单独开发 React 界面可运行 `npm run dev:renderer`，并参考 `renderer/.env.example` 配置服务地址。该模式不提供桌面桥接；需要身份认证及完整桌面行为时，使用 `npm run dev`。

## 开发约定

- 桌面权限与窗口能力放在 `electron/` 的入口文件；业务逻辑放在 `electron/server/`。
- React 页面放在 `renderer/src/pages/`，共享组件和工具分别放在 `components/` 与 `lib/`。
- 新功能按 `articles`、`agent`、`research`、`skills`、`media`、`publishing` 业务能力拆分，具体约束见根目录 `AGENTS.md`。
- 页面只组合功能组件，不直接承载 Firecrawl、模型、图片供应商或浏览器自动化实现。
- 重复的表单、状态、审批、来源、差异和媒体界面提取为共享组件；重复的业务规则提取为领域服务。
- 先复用现有实现和已安装依赖。没有真实复用需求时，不创建额外抽象或引入新依赖。
- 所有有成本或外部副作用的 Agent 操作使用统一审批机制，尤其是图片生成和真实发布。
- Node 回归测试放在 `tests/server/`；React 测试与组件或工具就近放置；跨进程流程放在 `tests/e2e/`。
- 新增根依赖时同步根锁文件，新增界面依赖时同步 `renderer/package-lock.json`。
- 生成文件写入 `dist/`、`renderer/dist/`、`release/` 或 `artifacts/`，不混入源码目录。

## SKILL.md

用户 Skill 可使用单个 `SKILL.md`，也可选择包含 `SKILL.md` 的文件夹安装。最小格式：

```md
---
name: 新闻核查
description: 核实新闻事实并保留来源
version: 1.0.0
permissions:
  - web_search
triggers:
  - 核实
  - 来源
---
只采用能够被可靠来源证实的信息，无法确认时明确说明。
```

- `name`、`description` 和正文说明必填。
- `version` 省略时使用 `1.0.0`，填写时必须是语义化版本。
- 可声明的权限为 `web_search`、`image_generation`、`image_edit`、`browser`。
- `triggers` 可选，用于可解释的自动匹配；也可在对话中输入 `$skill-key` 明确调用。
- 未声明的工具不会授权给该 Skill。
- 导入先预览名称、版本、指令和权限，用户确认后才安装。取消预览不改动数据。
- 同名 Skill 使用稳定标识；再次导入需确认替换，保留原有启停状态，不会重复创建。
- 安装确认绑定文件内容和现有版本，10 分钟过期；预览后发生修改时必须重新预览。
- YAML 支持多行说明、引号和注释；拒绝重复字段、非法权限、错误类型和非法版本，不静默忽略它们。
- 内置 Skill 不能被导入文件覆盖或卸载。

文件夹包只接受根目录 `SKILL.md` 以及 `references/` 下的 `.md`、`.txt`、`.json` 文件，最多 32 个、合计 512 KB；脚本、隐藏文件、越界路径和压缩包会被拒绝。执行时从 `SKILL.md` 开始，递归加载 Markdown 链接明确引用的包内资料，不获取外部链接。

已确认的包内容保存在本机数据库，并在数据目录的 `skills/` 下写入不可变版本副本，和应用代码分离。手动修改副本不会改变执行内容；更新需重新导入并确认。自动匹配按触发词、名称和用途确定性评分，明确选择或 `$skill-key` 优先，每轮最多 3 个，并在执行记录中显示顺序、原因、版本、权限和资料。每轮使用创建时的指令快照；执行前若 Skill 被停用、卸载或撤回权限，则停止新的模型或工具请求。

## 浏览器发布

- 每个浏览器发布账号使用独立的持久化 Electron Session，登录 Cookie 不与主界面或其他账号混用。
- 平台登录页由主进程创建沙箱窗口，关闭 Node.js 能力并拒绝网页权限请求。
- 公共账号管理只负责登录会话；自动填写、预览、成功判断和页面异常处理放进具体平台 adapter。第一版 adapter 为微信公众号，浏览器入口只接受 `https://mp.weixin.qq.com/` 官方域名，其他浏览器平台不能提交。
- 公众号只支持逐次手动确认：第一次确认锁定文章并填写浏览器，第二次确认才点击真实发布。扫码、验证码、二次验证、图片缺失或页面结构变化转为 `needs_handoff`。
- 仅在平台页面出现明确成功提示后记录 `published`。点击后的结果不明确、应用退出或页面异常不会自动重试，必须先人工检查公众号后台，防止重复发布。
- adapter 的语义定位及兼容选择器集中在 `electron/publishing/wechat.ts`，公共发布队列不复制平台规则。
- Webhook 仅作为兼容 adapter 保留，不作为新增平台的默认实现。

## 构建与分发

```bash
npm run build
npm start
```

构建先对界面和 Node 代码做类型检查，再生成 React 静态资源及三个桌面入口：`main.cjs`、`preload.cjs`、`worker.cjs`。electron-builder 的配置位于根 `package.json`。

`npm run pack` 生成当前平台的应用目录；`npm run dist:mac`、`dist:win`、`dist:linux` 生成安装包，参数示例见根 README。发布前在目标平台完成安装、首次配置、文章工作流及重启验证。
