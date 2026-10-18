const assert = require("assert/strict");
const client = require("../electron/ai-client.cjs");
const original = client.requestChat;
(async () => {
  try {
    for (const mode of ["ok", "network", "bad-language", "abort"]) {
      const stages = [],
        calls = [],
        controller = new AbortController();
      client.requestChat = async (messages) => {
        calls.push(messages);
        if (mode === "network")
          throw Object.assign(new Error("模拟连接中断"), {
            retryable: false,
            code: "QILING_NETWORK",
          });
        if (mode === "abort") controller.abort();
        return mode === "bad-language"
          ? "This is not a Chinese article."
          : "# 测试标题\n\n## 第一节\n\n这是一篇用于验证单次生成的中文正文。\n\n- 第一项\n- 第二项";
      };
      delete require.cache[require.resolve("../electron/pipeline.cjs")];
      const { runPipeline } = require("../electron/pipeline.cjs");
      const promise = runPipeline(
        {
          sourceText: "新闻素材",
          words: 600,
          writingReference: "使用朴实自然的文风",
        },
        {
          AI_SERVICE: "qiling",
          AI_BASE_URL: "https://unused.invalid/reply",
          AI_API_PATH: "",
          AI_MODEL: "mock",
          AI_SIGNAL: controller.signal,
          AI_ON_PROGRESS: (stage) => stages.push(stage),
        },
      );
      if (mode === "ok") {
        const result = await promise;
        assert(result.chinese.includes("中文正文"));
        assert.deepEqual(
          result.blocks.map((b) => b.type),
          ["title", "h2", "p", "list"],
        );
        assert(calls[0][1].content.includes("600"));
        assert(calls[0][1].content.includes("朴实自然"));
        assert(
          stages.some((stage) => stage.message.includes("仅一次模型调用")),
        );
        assert(stages.some((stage) => stage.message.includes("本地排版")));
      } else await assert.rejects(promise);
      assert.equal(
        calls.length,
        1,
        "success, failure, or cancellation never starts an extra generation/translation/formatting request",
      );
    }
    const { articleBlocks } = require("../electron/article-text.cjs");
    assert.deepEqual(
      articleBlocks("标题\n正文段落。\n> 引用\n---").map((b) => b.type),
      ["title", "p", "quote", "divider"],
    );
    console.log(
      "PASS: one Chinese model call per article, style/length respected, local heading/list/quote formatting, failures/cancel never add paid calls. Offline mocks only.",
    );
  } finally {
    client.requestChat = original;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
