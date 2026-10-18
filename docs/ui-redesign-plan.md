# 全站页面改版方案（shadcn/ui + dashboard 模板）

## 目标

7 个导航页统一到 shadcn/ui 原语 + dashboard 模板的壳层语言：**信息层级清晰、主操作唯一、扫读优先、点开即用**。
验收口径：同一页面上「看一眼就知道该点哪」；常用操作 ≤2 次点击；不再出现四套并行的样式系统。

## 现状问题（已确认）

| 类别 | 证据 |
| --- | --- |
| 四套并行样式 | ① `@/components/shared/*` AntD 风味兼容层（`ui-*` 类，见 `workspace.css`）② `@/components/ui/*` 原生 shadcn（`publish-center`）③ 各 feature 自带 CSS（`publish-center.css`、`ai-config-field`、`creation-editor-offscreen`）④ 组件内联 style（`HelpWorkspace` `borderRadius:12`） |
| 图标 API 混淆 | `src/components/shared/icons.tsx` 把 `@radix-ui/react-icons` 包成 AntD 命名（`XxxOutlined`），全站以 AntD 名字调用 radix 图标 |
| 表单实现存疑 | `TaskEditor.tsx` 使用 `<Form.Item>`；需确认 `shared/inputs.tsx` 是否提供 Form 门面，还是直连 antd |
| 工作流碎片化 | 创作工坊有 10 个独立弹层/抽屉（AppearanceDrawer、ImagePicker、PublishDialog、CoverDialog、GenerationResultDialog、PromptSettingsDialog、StickerPreviewDialog、TemplatePreviewDialog、ArticlePreviewDialog、ImagePreviewDialog） |
| 滚动 hack | `CreationWorkflow` 手工滚动 `.app-content`，并有 `creation-editor-offscreen` 离屏类 |
| 隐藏页面 | `src/pages/NoteStudio.tsx`、`src/pages/ImageMaker.tsx` 不在导航（仅 `?page=note|image` 可达），但 `ui-check` 按九个页面验收——**保留并纳入改版**，不删除 |
| 密度不一致 | `TaskList` pageSize=10 + `Empty` + `Tag`；`AccountGrid`/`ResourceWorkspace` 又是卡片栅格，两种列表范式 |

## 壳层基准（AppShell）

- `PageKey`：`resource | accounts | article | publish | task | ai | help`。
- `TITLES`：每页 `{title, desc}` —— 保留，作为统一「页面头」的数据源。
- 硬断言（改动时不可破坏）：`nav[aria-label="主导航"]` 下的按钮文本（layout-check/screenshot 逐页点击）、`[data-slot="page-title"]` 文本等于导航项文本、折叠按钮 aria-label（展开侧边栏/收起侧边栏）、macOS 32px 拖拽条。
- 现有能力：侧栏折叠（`wangaohui:sidebar-collapsed`）、平台探测、`PLAIN_BUTTON`（未启用 preflight，原生 button 需显式去边框）。
- 改版要点：侧栏**分组导航**（内容生产 / 发布运营 / 系统）；页头右侧 `PageActions` 主操作槽（`src/layout/page-actions.tsx`）；活动态与状态色全部走 token。

## 三阶段执行

### 阶段 1：壳层与 token
1. `src/ui.css`：补齐语义 token——状态色 `--success/--warning/--danger/--info`（+ `-soft`，与 `.ui-tag`/`.ui-alert` 既有色号同源）、阴影 `--shadow-card/--shadow-pop`，`@theme inline` 一次性映射。
2. `src/layout/AppShell.tsx`：分组侧栏 + 页头操作槽；移除冗余的 `--accent/--primary` JS 注入（token 已在 CSS 定义）。
3. `src/workspace.css` 本阶段不动；`ui-*` 门面清理归入阶段 2。

### 阶段 2：共享层重写（保持导入路径不变）——✅ 已应用并通过运行验证（2026-10-14）
`src/components/shared/*` 对外 API 不变（`controls.tsx` 仍是 barrel），内部改为原生 shadcn：
- `layout.tsx` → Button/Badge/Separator 映射到 `@/components/ui/*`
- `display.tsx` → Card/Table/Avatar/List 映射到 shadcn，去掉 `ui-card` 等类
- `feedback.tsx` → Skeleton/Empty/Spin/Toast 用 shadcn + 统一空/加载/错误态
- `inputs.tsx` → Input/Select/Checkbox/Radio/Slider/Textarea/InputNumber 用 shadcn
- `navigation.tsx` → Menu(DropdownMenu)/Pagination 用 shadcn
- `dialogs.tsx` → AlertDialog/Dialog/Sheet
好处：所有页面零改动即获得新视觉，之后再逐页做布局级优化。
约束：`scripts/ui-check.cjs` 断言的 `[data-slot="tabs-indicator"]`、`.tab-panel-enter/.tab-panel-leave`、`.ui-field-error` 首错聚焦、`.segmented-tabs` 激活态透明等行为必须原样保留。

#### 阶段 2 明细：workspace.css 处置清单（读完全部门面 / 原语 / feature CSS 后定稿）

原则：**类名全部保留**（feature CSS 的后代选择器与 ui-check 断言都挂在 `.ui-*`/`data-slot` 上）；只做三件事——删「和原语打架的装饰覆盖」、把残留硬编码色换成 token、把圆角对齐 README 设计基准（控件 10 / 卡片 16 / 弹窗 20）。

| 规则 | 处置 |
| --- | --- |
| no-preflight 垫片（`[data-slot]` 边框宽度、`button` cursor、input 白底） | 保留，全是承重墙 |
| `.ui-card`（现 12px 圆角、去阴影） | 圆角改 `var(--radius-xl)`（16px）、加 `box-shadow: var(--shadow-card)`；`padding:0;gap:0` 保留（门面自带 header/body 结构，删了会双重留白） |
| `.ui-card-header` / `.ui-card-body` | 保留（`creation.css` 的高度链依赖这两个类） |
| `.ui-dialog`（现 12px） | 圆角改 `var(--radius-2xl)`（20px）；同步把 `ui/dialog.tsx`、`ui/alert-dialog.tsx` 的 `rounded-lg` 改 `rounded-2xl`，门面与原生弹窗同圆角 |
| `.ui-tag` / `.ui-alert` 各 tone（六处硬编码 hex） | 换 `var(--success/--warning/--danger/--info)(-soft)`，与 Tailwind 语义类同源 |
| `.ui-table th`（`#f7f8fa`） | 换 `var(--surface-subtle)`；`.ui-table` 其余结构保留 |
| `.ui-field` / `.ui-field-error` | 保留（首错聚焦断言挂在这里）；`#b52d36` 换 `var(--danger)` |
| `.ui-empty` / `.ui-divider` / `.ui-pagination` / `.ui-list-item` / `.ui-steps` / `.ui-timeline` / `.ui-descriptions` / `.ui-skeleton` / `.ui-spinner` | 保留；散落 hex 换 token |
| `.ui-choice-*`（可搜索 Select 弹层） | 保留（自定义交互，无 shadcn 对应物） |
| `[data-slot=tabs-trigger][data-state=active]{background:white}` | 保留（`.segmented-tabs` 在 ui.css 里覆盖为透明；ui-check 断言依赖该覆盖生效） |
| `.login-gate` / `.login-card` | 删（`LoginGate.tsx` 已删除，无引用） |
| `.article-workspace` / `.ui-col-sized` / `.ui-compact` | 保留（创作工坊布局与 Row/Col 栅格依赖） |

不动：`styles.css` 全部作品渲染规则、`CoverThumb` / `StickerBodyCard`、导出管线；`window.__runExportChecks()` 字节级比对必须继续通过。
补充发现（读原语后）：门面组件内部**已经**包着原生 shadcn 原语（`layout.tsx`→UIButton/Badge/Separator，`display.tsx`→UICard/UITable/UIAvatar，`inputs.tsx`→UIInput 等），所以阶段 2 是「删覆盖、留结构」，不是重写组件；`lightbox.tsx` 用裸 Radix Dialog 自持样式，不受 `.ui-dialog` 影响。

### 阶段 3：逐页优化（统一骨架）
统一骨架 = 页面头（标题+说明+主操作，主操作走 `PageActions`）→ 可选统计行 → 主看板卡（工具栏：左筛选、右操作）→ 表格/列表 → 分页 → 空/加载态。

1. **资源管理**：✅ 完整迁移（今日热点 / 微信爆文 / 我的素材 / 图片素材 / 我的图库五个分支全部用原生 shadcn + 新共享组件，零 `.ui-*`、零内联 style）；页面头主操作「刷新」✅ 已接入（`src/pages/ResourceLibrary.tsx:17-21`，经 `PageActions` 注册到壳层页头；点击调用 `useResourceLibrary.refresh()`，按当前 Tab 重新拉取当前列表）。
2. **账号中心**：卡片栅格 + 工具栏搜索；登录态用 Badge；主操作「添加账号」✅ 已提到页面头（2026-10-14）。
3. **创作工坊**（最大改动）：✅ 已落地为「步骤式单页 + 结果内联」（`CreationWorkflow` 的 `creation-step-stage` 两个步骤，生成结果内联在步骤 1；弹层只保留在「继续编辑」路径）。三项子项口径修正：
   - 离屏 hack **保留**：`creation-editor-offscreen` 被 `creation-check` 锁定（必须存在且 inert），同时承担步骤 1 编辑器状态保留，不删。
   - 手工滚动 **保留**：`CreationWorkflow.tsx:82` 在步骤切换时把 `.app-content` 滚到顶部并聚焦当前步骤按钮，是有意的切换行为，不是 hack。
   - 模板/封面/图片选择 **未改右侧 Sheet**：模板选择已是步骤 1 的内联面板（`creation-template-panel` 与「选择模板 极简墨黑」被 `creation-check` 锁定），右侧 Sheet 方案作废。
4. **内容发布**：✅ 已是基准页并与壳层对齐（标题/说明只由壳层渲染，无重复标题；统计行 `PublishStats` + Tabs + 门面 `Pagination`）；列宽与状态一致性由 `publish-check` 的三尺寸断言覆盖。
5. **自动托管**：统计行 `TaskStats` ✅ + 看板卡表格 ✅ + 页头「新建任务」✅；`TaskEditor` 长表单 ✅ 已分六节（基础信息 / 账号与平台 / 素材与模板 / 图片与数量 / 执行计划 / 失败处理，字段顺序未变，首错聚焦与默认值断言仍成立）。两项子项作废：**Tabs 不采纳**（只有一份任务列表，状态总览由统计行承担）；**行内操作收进 `DropdownMenu` 作废**（`task-controls-check` 锁定每行恰好 4 个按钮）。
6. **AI 配置**：✅ 已去掉 `ai-config-field` 私有类与 `ai-config.css` 引用（Tailwind + token；`.ai-config-page` 根类与「3 个输入框 / 无 combobox」断言保留；2026-10-14）。
7. **使用帮助**：✅ 已去掉内联 style（Card + Tailwind token 类，2026-10-14）。
8. **隐藏页面**：✅ `NoteStudio.tsx` / `ImageMaker.tsx` 已纳入统一骨架——自绘页头（22px 标题 + muted 说明，与 `AppShell.tsx:310` 同款类名）配共享工作区，零 `.ui-*` 门面类、零内联 style；仅由 ui-check fixture 按 `?page=note|image` 挂载，未加入主导航（按计划留给用户决定）。页头复刻壳层类名而未抽公共组件：两页不在壳层内，抽出来没有复用收益。

## 阶段 3 硬约束（检查脚本锁定，勿动）

- **内容发布**：`.publish-pagination` 必须保持门面 `Pagination`（`publish-check` 断言文本含 `2 / 3`、`共 22 条`）；不能换 `DataPagination`。
- **自动托管**：每行恰好 1 个 `[data-task-control]` + 4 个按钮（`task-controls-check`）；"行内操作收进 DropdownMenu"作废，维持 4 按钮。
- **创作工坊**：`creation-step-stage/step-button/template-panel/navigation/editor-stage/editor-offscreen`、`#creation-topic`、"返回素材/继续编辑/历史作品/添加模块/手机预览/推送草稿"等全部被 `creation-check` 锁定；结构改动必须与检查脚本同步演进。
- **历史对话框**：`.history-work-row`/`.history-pagination`/搜索 aria-label/删除·载入按钮文本被 `history-check` 锁定。
- 分页类文本（`2 / 3`、`共 N 条/篇`）是多个脚本的断言面，任何分页组件替换前先核对对应脚本。

## 验证

- 每个阶段结束：`npx tsc --noEmit` + `npm run check:ui`（需先启动 `npm run dev` 或 `npx vite`）。
- 相关页面改动追加跑：`check:creation` / `check:history` / `check:publish` / `check:task-controls` / `check:ai`。
- 截图比对：`.tmp-ui-check/screenshots/`（改动前先备份为 `screenshots-before/`）。
- 作品渲染层（`styles.css` 的 `.ae-*`/`.tv-*`/`.paper-*`、`CoverThumb`、`StickerBodyCard`、导出管线）不动；`window.__runExportChecks()` 的字节级比对必须继续通过。

### 验证记录（2026-10-14）

- `npx tsc --noEmit` ✅（exit 0）。
- `check:ui` ✅：九页 × 三尺寸溢出为 0；导出兼容字节比对通过（templates 12、canvas true、cover true）。
- `check:creation` / `check:history` / `check:publish` / `check:task-controls` / `check:ai` 全部 ✅（exit 0）。
- 最新截图 `.tmp-ui-check/screenshots/`（28 张），上一版备份 `.tmp-ui-check/screenshots-before/`。
- 注意：检查脚本务必**串行**运行；多路并行时 history / ai 出现资源竞争导致的假失败（串行复跑即过）。

- 复核（同日串行再跑）：`npx tsc --noEmit` exit 0；`check:ui` / `check:creation` / `check:history` / `check:publish` / `check:task-controls` / `check:ai` 全部 exit 0（日志 `.tmp-check-*.log`）。资源管理刷新按钮补加载态后再次串行复跑，结果同上。
- 静态审计：`src/pages` 与 `src/features` 的 TSX 中 `.ui-*` 门面类引用 0 处；`src/pages` 内联 style 0 处（`src/features` 仍有 331 处 `style={{`，多为动态尺寸/颜色绑定，保留）。

## 已确认口径

1. `shadcn-dashboard-landing-template` 不在仓库内 → 按其约定复刻（分组侧栏 + 页头 + 统计行 + 看板卡表格），不引入其源码。
2. 顺序：先阶段 1+2（一次改版全站外观），再逐页阶段 3。
3. `NoteStudio` / `ImageMaker` 保留并纳入改版；是否加入导航由用户决定。
