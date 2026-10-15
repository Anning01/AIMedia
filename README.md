# AIMedia · 万稿汇

面向内容创作者的桌面工具，支持素材管理、AI 写作与改文、文章排版、贴图制作、多平台发布和定时托管。

新版桌面端采用 **Electron + React + TypeScript + shadcn/ui**。软件免激活，用户可自行配置文本 AI 接口；器灵是可选服务，使用第三方接口不需要器灵账号。

- [下载软件](https://github.com/Anning01/AIMedia/releases)
- [开发分支](https://github.com/Anning01/AIMedia/tree/develop)
- [构建记录与测试包](https://github.com/Anning01/AIMedia/actions)
- [问题反馈](https://github.com/Anning01/AIMedia/issues)

> `develop` 是新版开发分支，已替换作废的旧版本。本次整理不代表已发布新的正式安装包；正式下载以 Releases 中实际公开的版本为准。

## 主要功能

| 页面 | 可以做什么 |
| --- | --- |
| 资源管理 | 浏览热点与文章、管理文字素材和图片，选中素材进入创作 |
| 创作工坊 | 第一页填写素材并生成，第二页选模板、编辑和预览；历史作品支持搜索与分页 |
| 账号中心 | 添加发布平台账号，维护本机登录状态与发布设置 |
| 内容发布 | 管理待发布队列，按平台、账号和状态查看发布结果 |
| 自动托管 | 配置素材来源、账号和运行时间，启动、暂停并查看日志 |
| AI 配置 | 手动填写第三方文本接口，或接入器灵并选择文本模型 |
| 使用帮助 | 简洁的 Q&A 手风琴，点击问题查看答案 |

小红书复刻和独立贴图页面保留在源码中，目前没有新增主导航入口。平台的扫码登录与发布能力取决于平台规则、账号权限和登录状态。

## 开始使用

1. 从 [Releases](https://github.com/Anning01/AIMedia/releases) 下载适合自己系统和芯片的安装包。
2. 打开「AI 配置」，配置自己的文本服务，或使用器灵一键授权。
3. 在「创作工坊」输入主题或原始素材，点击生成；完成后选择模板、编辑正文。
4. 需要发布时，在「账号中心」添加账号，再使用「内容发布」。

### 自定义文本接口

填写三项内容：**接口地址、模型名称、API Key**。支持 OpenAI Chat Completions 兼容协议。

| 地址写法 | 处理方式 |
| --- | --- |
| `https://example.com` | 补全为 `/v1/chat/completions` |
| `https://example.com/v1` | 补全为 `/chat/completions` |
| 完整的对话接口 URL | 保持原路径，不重复拼接 |

不预置第三方供应商或模型名单。测试连接会真实调用你填写的服务，可能产生该服务的费用；保存配置本身不会生成内容。密钥输入框留空表示保留之前保存的密钥。

### 器灵（可选）

可在系统浏览器中完成一键授权，让软件取得默认 API Key；也可以手动粘贴自己的器灵 `qk_` Key。两种方式使用相同配置与调用客户端。

验证后实时获取已启用的**文本模型**，由用户明确选择并保存。输出 Token 和单次预估费用上限都可设置；Token 包含模型思考与最终正文，不等于文章字数。发起生成前会免费预估，超过保存的费用上限或无法取得有效预估时停止提交；实际费用以器灵结算为准。

- [使用记录](https://toolsoul.daniu7.cn/account/api-usage)
- [调用余额与充值](https://toolsoul.daniu7.cn/account/personal)
- [Key 管理](https://toolsoul.daniu7.cn/account/api-keys)
- [器灵正式 API 规范](https://toolsoul.daniu7.cn/api/v1/public/developer-openapi.json)

软件不恢复授权码门禁，也不在本机维护器灵套餐、订单或充值后台。

### 生成速度与费用

**默认文章生成 / 改文只调用一次文本模型，直接生成中文正文。** 标题、段落、列表与引用分块在本机处理，模板排版不额外调用 AI。不会自动生成付费大纲、日文中间稿、审稿或中文回译。

进行中会显示当前阶段与等待时间，可以停止等待并阻止后续处理。停止等待不等于取消上游费用；已提交而结果不明确的调用会保留请求号，不自动重新提交。切勿把「待核对」当成未扣费而重复点击生成。

「去 AI / 降低 AI 痕迹」是编辑器内的独立操作，只有用户确认当前费用后才提交。每次 1–2000 字，长文需确认分段及调用次数；任务提交后只查询原任务号。结果先作为候选预览，用户采用后才替换正文；编辑期间发生变化时会再次确认，保留图片和模板。

模型思考、网络与服务端排队都会影响耗时，软件不保证数秒完成，也不保证通过任何 AI 检测或获得特定流量。

## 本机数据与 API Key

- 新保存的 API Key 通过 Electron `safeStorage` 加密，存入系统应用数据目录的 `ai-config.json`，不存进源码。系统安全存储不可用时不会退回明文保存。
- 典型数据目录：macOS 为 `~/Library/Application Support/wangaohui/`，Windows 为 `%APPDATA%/wangaohui/`。具体以 Electron `app.getPath('userData')` 为准。
- 发布平台登录态、Cookie、素材、作品、任务和图片主要保存在本机；它们不等于全部已加密。不要分享应用数据目录、浏览器存储或日志。
- 为兼容旧安装，程序仍能读取本机 `config/ai.env`；旧明文文件不会被自动删除。仓库忽略整个 `config/`，安装包也不包含它。
- Git 和打包规则排除环境变量文件、API 配置、账户会话、日志、证书与私钥。提交与 CI 会运行密钥模式扫描，安装包另行检查 `app.asar`。
- 一键授权的 `device_code` 仅由主进程持有，不写入浏览器 URL。用户 API Key 不写入日志或前端公开配置。
- AI 文本会发给用户配置的服务商，资源管理会访问当前源码中配置的素材服务，平台发布会访问对应平台；开源版本没有把这些服务端一起打包。请只配置可信的接口。

扫描属于防误提交措施，不是泄漏永远不可能发生的保证。若真实 Key 曾提交过，请在服务商处吊销并换新；删掉当前文件不能撤回其他人已经获得的密钥。

## 本地开发

需要 **Node.js 22 LTS、npm、Git**。运行时不依赖 Python，也不需要相邻目录的私有 SDK。

```bash
git clone --branch develop git@github.com:Anning01/AIMedia.git
cd AIMedia
npm ci
npm run dev
```

常用命令：

```bash
npm run build           # TypeScript 检查与 Vite 生产构建
npm run check:secrets   # 扫描待提交文件中的密钥与本机敏感文件
npm run check:release   # 验证打包流程、签名要求与密钥扫描拦截
npm run check:pipeline  # 离线验证单次中文生成与本地排版
npm run check:qiling    # 本地模拟 HTTP：授权、预算、模型与异步去 AI
npm run check:ai        # Electron 隔离数据目录：配置与实际 IPC
npm run check:creation  # Electron 模拟生成、失败、停止、编辑与窗口布局
npm run check:ui        # 九个前端页面、问答交互和导出兼容性
```

涉及界面的检查需先在另一个终端运行 `npm run dev`。测试使用模拟服务与隔离存储，不应使用个人真实密钥进行自动验收。`article-pipeline-test.cjs` 是手动真实服务调试脚本，不属于离线测试，运行前请自行确认费用。

```bash
npm run check:history
npm run check:publish
npm run check:task-controls
npm run check:qiling-ui
```

这些检查覆盖历史分页与搜索、模拟发布、托管状态和器灵候选采用。环境设置了 `ELECTRON_RUN_AS_NODE=1` 时，需先移除该变量再运行 Electron。

## GitHub 打包与发布

工作流文件： [`.github/workflows/desktop.yml`](.github/workflows/desktop.yml)。

| 触发方式 | 行为 |
| --- | --- |
| PR 到 `develop` | 密钥扫描、类型检查、生产构建、离线管线测试 |
| 推送 `develop` | 上述检查 + Mac Intel / Apple Silicon 打包；Windows 证书就绪时才打签名包 |
| 推送 `v版本号` 标签 | 构建 Mac 和已签名 Windows 包，全部通过后创建 **Release 草稿** |

开发包从对应 Actions 运行的 Artifacts 下载，保留 14 天。正式安装包在维护者核对后将 Release 草稿手动发布，不会因一次 `develop` 推送直接公开新版本。

### macOS：ad-hoc 自签名

- 分别生成 Apple Silicon（arm64）与 Intel（x64）的 DMG 和 ZIP。
- 使用当前 electron-builder 25 的自定义签名钩子签署应用、Framework 和 Helper，构建后执行 `codesign` 完整性检查。
- **没有 Apple Developer ID，也没有 Apple 公证**，不能宣称通过了 Gatekeeper 验证。首次安装可能被系统拦截；确认下载来源后，按 macOS「隐私与安全性」提示允许打开，不建议关闭系统安全保护。
- 自签名 Mac 版发现更新后引导到 GitHub 手动下载，不自动安装一个无法验证受信任发布者的更新包。

本机 Mac 打包：

```bash
npm run dist:mac -- --arm64
npm run dist:mac -- --x64
```

### Windows：代码签名证书

生成 Windows x64 NSIS 安装包，并强制代码签名；不会把未签名包当成正式 Windows 版本。

当前 Windows 证书尚未准备，因此 `develop` 构建会显示原因并跳过 Windows 包；标签发布缺少凭据时失败，不创建不完整的正式 Release 草稿。

准备好可供 CI 使用的 PFX/P12 证书后，在仓库 **Settings → Secrets and variables → Actions** 配置：

| GitHub Secret | 内容 |
| --- | --- |
| `WIN_CSC_LINK` | PFX/P12 证书的 Base64 内容 |
| `WIN_CSC_KEY_PASSWORD` | 对应证书密码 |

不要把证书、私钥或密码提交进仓库，也不要作为普通 Artifact 上传。此流程不需要上传任何用户 AI API Key。若证书必须通过硬件令牌或云签名使用，需要按证书实际方案另行适配，不能直接当作可导出的 PFX 使用。

本机 Windows 打包：在当前终端通过安全方式设置上述环境变量，再运行 `npm run dist:win`。检查会验证应用和安装包的 Authenticode 签名。

### 发布新版本

1. 完成 `develop` 验收，将 `package.json` 与锁文件中的版本号更新为相同版本。
2. 确认 Windows 签名 Secrets 就绪。
3. 在待发布提交上创建并推送同名版本标签，例如版本号为 `1.0.3` 时：

```bash
git tag v1.0.3
git push origin v1.0.3
```

4. 等待 Actions 全部成功，检查 Release 草稿中的 DMG、ZIP、Windows 安装包与更新清单。
5. 编辑版本说明并手动发布草稿。标签必须与 `package.json` 的版本完全一致。

不要重新使用已发布版本号。Windows 自动更新从本仓库已公开的 GitHub Releases 获取签名安装包；Mac 自签名版本手动下载安装。

## 代码结构

```text
.github/workflows/  GitHub 构建与发布流程
build/              Mac ad-hoc 签名钩子和权限配置
electron/           主进程、IPC、AI 客户端、授权与本机任务
src/
  components/ui/    shadcn/ui 基础组件
  components/shared/跨页面共用组件
  features/         按业务拆分的界面、状态 hooks 与工具
  pages/            页面组合
  layout/           应用外壳与导航
scripts/            离线验证、界面检查与密钥/安装包检查
```

界面样式与文章、封面、贴图导出样式隔离，Tailwind 没有启用全局 preflight。请维护已导出内容的排版兼容性，避免将界面重置样式作用于成品。

## 许可

沿用此仓库的 [Apache-2.0 License](LICENSE)。第三方组件和字体遵守各自的许可证；开放源码不授予平台账号、素材、图片或模型服务的额外使用权。
