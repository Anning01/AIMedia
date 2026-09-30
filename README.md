# AI Media Desktop

AI Media 是一个基于 **Electron、Node.js、React、TypeScript 和 SQLite** 的文章 Agent 桌面应用。它通过对话完成求实、改稿和配图，并把最终文章发布到目标平台。

任务、草稿版本和媒体保存在本机。安装包自带运行环境，使用应用不需要安装 Node.js；AI 生成和网络检索需要配置相应服务。

## 功能

- **对话式改稿**：Agent 对关键说法逐条搜索求实，展示结论、原句和来源摘录，再给出候选稿；用户接受后才生成新版本。每轮最多核查 6 条，不代表全文已被证实。
- **Skills**：内置新闻求实、标题优化、结构重写、公众号风格等常用 Skill，也可导入含 `SKILL.md` 和参考资料的目录，支持自动匹配、明确调用、工具权限、启停、更新和卸载。
- **文章配图**：先由 Agent 生成图片提示词，用户确认后再执行文生图或图生图；生成结果选中后才插入正文。
- **发布管理**：第一版支持微信公众号浏览器填写与逐次确认发布；每个账号使用独立、持久化的登录会话，Webhook 仅作为兼容方式保留。
- **富媒体编辑**：Tiptap 编辑器、文件上传、草稿保存和历史版本切换。
- **桌面管理**：数据导入、数据目录访问、接入令牌、深浅色主题及 GitHub Release 更新提示。

## 快速开始

开发环境要求 Node.js **22.16 或更高版本**，使用 Node.js 自带的 npm。在项目根目录执行：

```bash
npm ci
npm run dev
```

`npm ci` 会自动安装 `renderer/` 的锁定依赖。开发命令会编译 Electron 代码、启动 Vite 并打开桌面窗口。React 页面支持热更新，修改 `electron/` 后需重新启动开发命令。

首次打开后，在「设置」中填写：

| 配置 | 用途 |
| --- | --- |
| LLM 模型、API Base URL、API Key | 文章改写与 Skills 执行，支持 OpenAI 兼容的聊天接口 |
| Firecrawl API Key | 改写前的网络检索；不使用时可关闭检索 |
| 图片模型、API Base URL、API Key | 文生图和图片编辑，使用图片服务自己的地址及凭证 |
| 图片尺寸与质量 | 若服务不接受这两个参数，关闭「使用指定尺寸与质量」 |

配置后，在「文章」中新建内容并与 Agent 对话，或通过 [文章接入接口](docs/integrations.md) 提交内容。

开发时也可参考根目录 [`.env.example`](.env.example) 创建 `.env`。模型和搜索环境变量作为回退配置，设置页中保存的值优先；安装后的应用使用设置页配置。

## 项目结构

```text
.
├── electron/                 # 桌面运行层
│   ├── main.ts               # 窗口、菜单、权限与应用生命周期
│   ├── preload.ts            # 受限的桌面桥接接口
│   ├── worker.ts             # 独立 Node 服务进程
│   └── server/               # API、文章 Agent、Skills、媒体与发布
├── renderer/                 # React + TypeScript + Vite 界面
│   ├── src/components/       # 编辑器、桌面组件和 UI 基础组件
│   ├── src/pages/            # 文章、Skills、发布与设置
│   ├── src/lib/              # API、提示消息、媒体和主题工具
│   └── src/test/             # 前端测试环境；测试就近放在源码旁
├── tests/
│   ├── server/               # Node 服务、数据导入与接口测试
│   └── e2e/                  # Electron 操作与真实供应商验收
├── scripts/                  # 开发启动与打包构建脚本
├── docs/                     # 架构、开发、测试与接入文档
├── .env.example              # 开发环境配置示例
├── package.json              # 统一命令入口及 Electron 打包配置
└── tsconfig.json             # Electron 与 Node 测试类型检查
```

`dist/electron/` 和 `renderer/dist/` 是构建输出，`release/` 保存安装包，`artifacts/` 保存测试报告与截图；这些目录均不提交到版本库。

## 常用命令

所有命令均从项目根目录执行。

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动桌面开发环境 |
| `npm run build` | 类型检查并构建桌面与界面代码 |
| `npm start` | 启动已构建的应用，首次使用前先构建 |
| `npm test` | 运行 Node 和 React 测试 |
| `npm run test:workflow` | 使用本机模拟服务运行完整 Electron 流程，需先构建 |
| `npm run test:smoke` | 桌面基础操作与重启检查，需先构建 |
| `npm run test:wechat` | 在模拟公众号编辑页验收填写、二次确认和成功判断 |
| `npm run server` | 独立运行本机 API，用于接口调试 |
| `npm run pack` | 构建当前平台的应用目录 |

更多开发、环境变量与独立界面调试说明见 [开发指南](docs/development.md)，验收方式见 [测试指南](docs/testing.md)。

## 打包

```bash
npm run dist:mac -- --arm64    # Apple Silicon：DMG + ZIP
npm run dist:mac -- --x64      # Intel Mac：DMG + ZIP
npm run dist:win -- --x64      # Windows：NSIS 安装程序
npm run dist:linux -- --x64    # Linux：AppImage
```

产物输出到 `release/`。建议在目标操作系统上构建并验证安装和运行；正式分发需配置代码签名，macOS 还需公证。仓库未配置签名凭据。

安装包包含 Electron 运行环境、编译后的服务和界面资源，用户数据与 `.env` 不进入安装包。

## 数据与运行

桌面数据位于系统用户数据目录下的 `AI Media/storage/`，可通过「设置 → 桌面应用 → 打开数据文件夹」查看。macOS 默认位置为：

```text
~/Library/Application Support/AI Media/storage/
```

「导入数据」支持包含 `ai_media.db` 或任务、账号、配置 JSON 文件的数据目录，并复制关联媒体。导入前会备份当前数据库，同 ID 数据和已有配置保留当前值。详细约定见 [架构说明](docs/architecture.md)。

生成和定时发布由应用进程执行，完全退出应用或电脑睡眠后会暂停；重新启动会恢复可执行任务。macOS 关闭窗口后应用仍可在后台运行，使用「退出 AI Media」才会完全停止。

## 文档

- [架构说明](docs/architecture.md)：进程、模块职责、数据与访问边界
- [开发指南](docs/development.md)：配置、调试、依赖与构建约定
- [测试指南](docs/testing.md)：自动化测试、独立数据与真实服务验收
- [接入指南](docs/integrations.md)：文章 API、接入令牌与兼容发布方式
