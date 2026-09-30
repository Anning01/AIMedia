# 接入指南

## 连接本机应用

打开 AI Media，在「设置 → 桌面应用」查看接入地址并复制接入令牌。默认地址为 `http://127.0.0.1:8000`，实际地址以界面为准。请求头填写：

```http
Authorization: Bearer <接入令牌>
Content-Type: application/json
```

接入令牌只允许 `/api/articles` 及文章查询、重试路径，不能用于管理设置或读取模型密钥。应用退出后，本机接口不可用。

## 提交文章

`POST /api/articles`：

```json
{
  "platform": "aimaster",
  "article": {
    "title": "文章标题",
    "contentList": ["第一段正文", "第二段正文"],
    "imageList": [
      {
        "src": "https://example.com/photo.jpg",
        "paragraphIndex": 0,
        "alt": "配图说明"
      }
    ]
  },
  "style": "professional",
  "publish_policy": "manual"
}
```

示例图片地址需替换成真实可访问的公网图片，纯文字文章可省略 `imageList`。可选字段 `target_account_id` 指定发布账号；`publish_policy` 支持 `manual`、`immediate`、`daily_slots`、`random_delay`。

服务保存文章、尝试导入源媒体并启动改写，响应包含任务、运行标识及媒体状态：

```json
{
  "task_id": "task-id",
  "status": "queued",
  "run_id": "run-id",
  "media": { "total": 1, "ready": 1, "failed": 0 }
}
```

媒体导入失败会记录在任务中，不代表文章丢失。提交前请完成应用的文本与图片设置；自动发布还需要有效的目标账号配置。

## 查询与重试

| 接口 | 用途 |
| --- | --- |
| `GET /api/articles?size=10` | 查询最近文章 |
| `GET /api/articles/:taskId` | 查询指定文章及改写结果 |
| `POST /api/articles/:taskId/retry` | 重试生成失败的文章 |

查询响应包含 `generation_status`、`publish_status`、`html`，也提供 `status`、`rewritten_content` 等接入字段。重试仅适用于生成失败状态；需要实时观察生成过程时可在桌面任务详情中查看。

## Webhook 发布

在「账号」中配置 Webhook 地址和发布策略，可按需设置凭证中的 `token`。发布时发送 JSON 内容，包含任务、账号、标题、HTML、媒体、来源、计划时间与幂等键，携带 `Idempotency-Key` 请求头。配置了账号 token 时会附加 `Authorization: Bearer <token>`。

接收端返回成功的 HTTP 状态后，应用记录为已发布；失败会保存尝试记录并按调度重试。接收端应按幂等键去重，避免重试造成重复内容。

向远程接收端发布含本地媒体的文章，需要在设置中填写接收端可访问的「外部访问地址」，并自行配置转发到本机服务。媒体通过带时限的签名链接提供下载；仅填写地址不会自动建立公网转发。具体媒体路径和签名由应用生成。

发布支持通用 Webhook，平台的登录授权和内容落地由接收端实现。
