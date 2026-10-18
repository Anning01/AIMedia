# 万稿汇 · AIMedia

**从热点选题到文章发布，一站完成 AI 写作、改文、去 AI 味与排版。**

万稿汇是一款开源的桌面内容创作工具，帮助自媒体作者把素材变成可发布的作品，减少找选题、改稿、排版和切换账号的重复操作。

- **找素材**：浏览热点、微信爆文，管理自己的文字和图片素材。
- **写文章、改文章**：输入主题或粘贴原文，AI 生成正文，再按需要编辑。
- **去 AI 味**：接入器灵改文服务，让表达更自然；先预览结果，满意再采用。
- **一键排版**：选择文章模板、配置配图，预览成品。
- **账号与发布**：集中管理平台账号、待发布作品和发布记录。
- **自动托管**：设置素材来源、目标账号和运行时间，按计划创作与发布。

[下载软件](https://github.com/Anning01/AIMedia/releases) · [问题反馈](https://github.com/Anning01/AIMedia/issues) · [器灵官网](https://toolsoul.daniu7.cn/) · [器灵开源组织](https://github.com/qilingAI)

## 下载

前往 **[GitHub Releases 下载页面](https://github.com/Anning01/AIMedia/releases)**，打开对应版本的 **Assets**，选择安装包：

| 你的电脑 | 选择的安装包 |
| --- | --- |
| Mac · Apple 芯片（M1 / M2 / M3 等） | 名称含 `mac-arm64` 的 `.dmg` |
| Mac · Intel 芯片 | 名称含 `mac-x64` 的 `.dmg` |
| Windows · 64 位 | 名称含 `win-x64-Setup` 的 `.exe` |

Mac 打开 DMG 后将应用拖入「应用程序」；Windows 双击安装程序，按提示安装。Mac 自签名版如被系统拦截，确认来源后在「系统设置 → 隐私与安全性」中允许打开。

> 1.0.1 已修复器灵一键授权的旧接口兼容问题，提供 Mac Apple Silicon / Intel 自签名版与 Windows x64 未签名版。Windows 首次运行可能出现 SmartScreen 提示，请确认下载来源。下载附件以 Releases 为准。

## 怎么使用

### 1. 配置 AI

打开「AI 配置」，选择一种方式：

- **推荐：器灵一键授权**。点击授权，在浏览器中登录器灵并确认，回到软件选择文本模型、保存即可。
- **使用自己的接口**。手动填写接口地址、模型名称和 API Key，测试连接后保存。支持 OpenAI 兼容的文本接口。

软件无需激活。AI 调用按所选服务商规则计费；API Key 保存在本机，请勿分享。

器灵模型支持时，「AI 配置 → 器灵服务」会显示 **思考模式** 选项。可选默认、开启或关闭，点击「保存模型与设置」生效；默认不发送思考模式参数，由系统自动决定。费用预估和实际生成使用同一设置，不支持切换的模型不显示开关。

### 2. 生成与编辑

在「资源管理」选中素材进入创作，或直接在「创作工坊」粘贴原文、输入主题。

1. 在 **「素材与生成」** 中设置字数、配图，点击「生成内容」。
2. 生成完成后进入 **「样式与编辑」**，修改正文、选择模板并预览。
3. 想减少 AI 味，在编辑器点击 **「去 AI / 降低 AI 痕迹」**，确认费用后处理，预览满意再采用。此功能需授权器灵。

历史作品可搜索、翻页，随时载入继续编辑。

### 3. 发布或托管

在「账号中心」登录平台账号，再到「内容发布」选择作品和账号发布，结果可在发布记录查看。需要定时执行时，在「自动托管」新建任务，设置来源、账号与时间后启动。

## 器灵 AI，让创作更省事

不想研究接口地址和模型配置？使用 **[器灵](https://toolsoul.daniu7.cn/)**，在万稿汇中一键授权，即可使用文本模型与去 AI 味服务。

我们也持续开源 AI 工具与 Agent Skills，欢迎关注 **[qilingAI 开源组织](https://github.com/qilingAI)**，一起使用、反馈和改进。

## 改文效果：挑战全网，用结果说话

万稿汇的「去 AI 味」接入与 **[qiling-humanize](https://github.com/qilingAI/qiling-humanize)** 相同的器灵改文服务。欢迎拿同一篇原文，与其他改写工具直接对比。

### 腾讯朱雀实测

同一篇文章，改前改后直接对比。以下为 [qiling-humanize 公开案例](https://github.com/qilingAI/qiling-humanize#腾讯朱雀实测)，两篇改文的检测结论均为 **「人工创作特征显著」**。

| 案例 | AI 特征：改前 → 改后 | 疑似 AI：改前 → 改后 | 人工特征：改前 → 改后 |
| --- | --- | --- | --- |
| 重新认识阅读 | 65.17% → **0%** | 34.83% → **0%** | 0% → **100%** |
| 青少年媒介素养 | 49.02% → **0%** | 50.98% → **20.98%** | 0% → **79.02%** |

#### 01 · 重新认识阅读

**AI 特征降至 0%，人工特征达到 100%。**

| 改写前 | 器灵改写后 |
| :---: | :---: |
| <a href="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/reading/before.png"><img src="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/reading/before.png" width="440" alt="重新认识阅读：改写前腾讯朱雀检测结果"></a> | <a href="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/reading/after.png"><img src="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/reading/after.png" width="440" alt="重新认识阅读：器灵改写后腾讯朱雀检测结果"></a> |

[阅读原文](https://github.com/qilingAI/qiling-humanize/blob/main/examples/reading/before.md) · [阅读改文](https://github.com/qilingAI/qiling-humanize/blob/main/examples/reading/after.md)

#### 02 · 青少年媒介素养

**AI 特征降至 0%，人工特征提升至 79.02%。**

| 改写前 | 器灵改写后 |
| :---: | :---: |
| <a href="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/media-literacy/before.png"><img src="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/media-literacy/before.png" width="440" alt="青少年媒介素养：改写前腾讯朱雀检测结果"></a> | <a href="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/media-literacy/after.png"><img src="https://raw.githubusercontent.com/qilingAI/qiling-humanize/main/examples/media-literacy/after.png" width="440" alt="青少年媒介素养：器灵改写后腾讯朱雀检测结果"></a> |

[阅读原文](https://github.com/qilingAI/qiling-humanize/blob/main/examples/media-literacy/before.md) · [阅读改文](https://github.com/qilingAI/qiling-humanize/blob/main/examples/media-literacy/after.md)

<sub>截图与数据由器灵提供，截图中朱雀模型更新时间为 2026-07-21。案例效果随文本与检测工具而异。点击截图可查看大图，亦可前往 <a href="https://matrix.tencent.com/ai-detect/ai_gen">腾讯朱雀</a> 自行复测。</sub>

## 加入微信交流群

交流写作、改文与排版经验，反馈问题，获取版本消息。欢迎一起把万稿汇做得更好。

<img src="docs/wechat.png">

## Star History

<p align="center">
  <a href="https://www.star-history.com/#Anning01/AIMedia&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Anning01/AIMedia&amp;type=Date&amp;theme=dark">
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Anning01/AIMedia&amp;type=Date">
      <img src="https://api.star-history.com/svg?repos=Anning01/AIMedia&amp;type=Date" width="920" alt="万稿汇 AIMedia GitHub Star 增长曲线">
    </picture>
  </a>
</p>

---

开源协议：[Apache-2.0](LICENSE)。喜欢这个项目，欢迎点个 Star。
