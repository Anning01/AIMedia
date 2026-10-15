# 万稿汇 AI 网关需求文档（历史方案）

> 此方案已停用。当前开源版本使用用户自定义 AI 接口，不接入器灵激活、SDK 登录或积分计费。器灵使用正式用户 API Key 提供可选文本模型与去 AI，一键授权只减少复制 Key 的步骤，当前实现见 README。

## 1. 背景与目标

万稿汇（wangaohui）目前的大模型密钥（DeepSeek、有道等）在客户端本地，无法统一计量、限流和防滥用。现决定：

- AI 网关放在**主站（器灵AI主站，ToolSoulAI）**，通过 toolsource-sdk 授权体系接入；
- 客户端只认主站 SDK 地址，本地密钥降级为「自托管模式」；
- 资源站（hotfeed）只负责内容数据，不再承担 AI 网关职责。

## 2. 架构

```text
万稿汇客户端(toolsource-sdk 登录 → sdk_token)
        ↓  /api/v1/sdk/ai/chat  /api/v1/sdk/ai/translate（Bearer sdk_token + app_key + device_id）
主站 ToolSoulAI（AI 网关：鉴权、配额、并发、限流、计价、用量）
        ├─ DeepSeek / MiniMax（文字生成）
        └─ 有道翻译
```

主站 SDK 会话（`sdk_token`）由主站自己签发，网关直接本地校验，不再反向调用 license/check。

## 3. 接口设计

### 3.1 生成对话

`POST /api/v1/sdk/ai/chat`

请求：

```json
{
  "app_key": "gzh-wgh",
  "device_id": "<设备ID>",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "model": ""
}
```

鉴权头：`Authorization: Bearer <sdk_token>`

返回：

```json
{
  "ok": true,
  "content": "...",
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "cost": 0,
    "latency_ms": 0
  }
}
```

### 3.2 翻译

`POST /api/v1/sdk/ai/translate`

```json
{
  "app_key": "gzh-wgh",
  "device_id": "<设备ID>",
  "text": "要翻译的文本",
  "source": "auto",
  "target": "zh-CHS"
}
```

网关内部调用有道接口必须与万稿汇客户端一致：

- URL：`https://openapi.youdao.com/api`
- 方法：`POST`，`Content-Type: application/x-www-form-urlencoded`
- 参数：`q`、`from=日语`、`to=中文`、`vocabId=`、`appKey`、`salt`（UUID）、`curtime`（Unix 秒）、`signType=v3`、`sign`
- 签名：`sign = sha256(appKey + input + salt + curtime + appSecret)`
  - `input = q`（q ≤ 20 字符）
  - `input = q.slice(0,10) + q.length + q.slice(-10)`（q > 20 字符）
- 返回：`errorCode === "0"` 且取 `translation` 数组拼 `\n`

### 3.3 管理接口（主站后台）

- `GET /api/v1/admin/ai-gateway/config`：模型/密钥（掩码）/计价/并发/限流配置
- `PATCH /api/v1/admin/ai-gateway/config`：保存配置
- `GET /api/v1/admin/ai-gateway/usage`：按天/授权/类型查用量
- `GET /api/v1/admin/ai-gateway/cost`：成本汇总（按天、按授权、总计）

## 4. 鉴权、配额与并发

| 项目 | 值（默认） |
|---|---|
| 鉴权 | `Authorization: Bearer sdk_token`，主站本地校验角色 `sdk_license` + app_key + device_id |
| 单授权并发 | 1（可配置 1~10） |
| 全局并发 | 20（可配置 1~200） |
| chat 限流 | 20 次/分钟/授权 |
| 翻译限流 | 60 次/分钟/授权 |
| 配额 | 以 SDK `entitlements.quota_total` 为上限，本地记用量；用完返回 429 |
| 超出并发 | 排队，最多等待 30 秒，超时返回繁忙 |

## 5. 数据表

```sql
CREATE TABLE IF NOT EXISTS ai_gateway_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER,
  app_key TEXT,
  user_id INTEGER,
  kind TEXT,                 -- chat / translate
  model TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  chars INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status TEXT,
  error TEXT,
  created_at TEXT
);
```

配置存主站 `system_settings`，key 前缀统一 `gateway.*`：

```text
gateway.chat.base_url
gateway.chat.api_key
gateway.chat.model
gateway.chat.price_per_1m
gateway.youdao.app_key
gateway.youdao.app_secret
gateway.translate.price_per_1k
gateway.limit.global_concurrency
gateway.limit.license_concurrency
gateway.limit.chat_rate_per_minute
gateway.limit.translate_rate_per_minute
```

## 6. 管理页面需求（主站后台）

1. **模型配置**：Chat Base URL / API Key（掩码）/ Model / 价格（元/百万 token）；有道 AppKey / AppSecret（掩码）/ 价格（元/千字符）；并发与限流参数。
2. **用量**：按授权/用户查看每天、每月调用次数、成功/失败、耗时。
3. **成本**：按天、按授权汇总成本，展示每个用户/授权花了多少钱。

## 7. 密钥与配置清单

> ⚠️ 以下为敏感信息，只允许放在服务端环境变量或主站 `system_settings`，**严禁提交到公开仓库/前端**。

```text
主站地址:            https://toolsoul.daniu7.cn
万稿汇 app_key:      gzh-wgh

DeepSeek:
  DEEPSEEK_API_KEY   = REDACTED_LOCAL_API_KEY
  DEEPSEEK_BASE_URL  = https://api.deepseek.com
  DEEPSEEK_MODEL     = deepseek-v4-flash

MiniMax:
  MINIMAX_API_KEY    = REDACTED_LOCAL_API_KEY
  MINIMAX_API_URL    = https://api.minimaxi.com/v1/text/chatcompletion_v2
  MINIMAX_MODEL      = MiniMax-M3

有道翻译:
  YOUDAO_APP_KEY     = 4e362ba7a78b6b09
  YOUDAO_APP_SECRET  = HGUDjw9M1lfRRqIPfldOGCT5sYIC7GZx

Tavily（抓取/解析）:
  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
  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
  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
  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
  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
  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

DashScope（视觉打标，仅资源站用）:
  DASHSCOPE_API_KEY  = sk-ws-H.RXPDEXD.T3G8.MEUCIA0OAkEzc_CbkIeplSQEhH-IHsFDaqhnsH-xEcFm8ijgAiEA0d1PL45axSqnixRIYEYKtTKJrlBK8e9qDkA70eVWAGo

Jina（备用解析）:
  jina_34a218c08c954832922bbc8049bc264cJX3Wemnv_hbp41sx0LCEzGiJTRtr
```

## 8. 客户端（万稿汇）改动

- `llmChat / generateArticle / 有道翻译` 底层改调主站网关；
- 请求携带 `sdk_token`（登录后由 toolsource-sdk 提供）+ `app_key=gzh-wgh` + `device_id`；
- 本地密钥只保留在「自托管模式」下使用；
- 自动托管每次执行也走网关扣配额。

## 9. 安全与部署注意事项

- 网关只接受主站签发的 `sdk_token`，不做任何透传/匿名访问；
- 管理接口仅主站 `platform_admin` 可访问；
- 密钥写入服务端环境变量或 `system_settings`，日志和错误信息脱敏；
- 部署前 `pip install httpx`（或重建镜像），数据库表自动创建；
- 建议给资源站配置 `API_TOKEN`，避免内部接口裸奔。
