const { app, safeStorage } = require("electron");
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  http = require("http"),
  assert = require("assert/strict");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wgh-qiling-check-"));
app.setPath("userData", directory);
const config = require("../electron/ai-config.cjs");
const { createQilingApi } = require("../electron/qiling-api.cjs");
const { createQilingService } = require("../electron/qiling-service.cjs");
const { createQilingChat } = require("../electron/qiling-chat.cjs");
let clock = 0,
  authStatus = "pending",
  taskStatus = "processing",
  modelStatus = "succeeded",
  apiStatus = 200;
const calls = [],
  opened = [];
let networkDrop = true;
let estimatedFee = "0.01",
  emptyText = false;
let taskCount = 0;
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : null;
  calls.push({
    path: req.url,
    body,
    key: req.headers["x-api-key"],
    auth: req.headers.authorization,
    app: req.headers["x-qiling-app-key"],
  });
  if (
    req.url.endsWith("/chat/completions") &&
    body?.messages?.[0]?.content === "模拟网络重试" &&
    networkDrop
  ) {
    networkDrop = false;
    req.socket.destroy();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  let data = {};
  if (req.url.endsWith("/auth/api-key/requests"))
    data = {
      device_code: "secret-device-code",
      verification_url:
        "https://toolsoul.daniu7.cn/account/api-authorize?request=browser-code",
      interval: 3,
      expires_in: 600,
    };
  else if (req.url.endsWith("/auth/api-key/token")) {
    if (authStatus === "expired") {
      res.statusCode = 410;
      data = { detail: "过期" };
    } else if (authStatus === "limited") {
      res.statusCode = 429;
      res.setHeader("retry-after", "6");
      data = { detail: "限流" };
    } else
      data = {
        status: authStatus,
        ...(authStatus === "authorized"
          ? {
              api_key: "qk_test_user_key",
              base_url: "https://toolsoul.daniu7.cn",
              app_key: "",
            }
          : {}),
      };
  } else if (req.url.endsWith("/models"))
    data = {
      items: [
        {
          code: "dynamic-text",
          name: "动态文本",
          kind: "text",
          enabled: true,
          config: {
            max_output_tokens: 1200,
            input_price: "1.5",
            output_price: "2.1",
          },
        },
        {
          code: "second-text",
          name: "第二个文本",
          kind: "text",
          enabled: true,
          config: { max_output_tokens: 384000 },
        },
        { code: "no-image", name: "不展示图片", kind: "image", enabled: true },
        { code: "off", name: "已停用", kind: "text", enabled: false },
      ],
    };
  else if (req.url.endsWith("/models/estimate"))
    data = { estimated_fee: estimatedFee, currency: "CNY" };
  else if (req.url.endsWith("/endpoints"))
    data = {
      balance: "25.50",
      items: [
        {
          code: "remove_ai",
          effective_price: "0.25",
          free_quota: 2,
          enabled: true,
        },
      ],
    };
  else if (req.url.endsWith("/chat/completions")) {
    if (apiStatus !== 200) {
      res.statusCode = apiStatus;
      data = { detail: "余额不足 qk_test_user_key" };
    } else
      data = {
        id: 42,
        request_id: body.request_id,
        status: modelStatus,
        usage: emptyText
          ? {
              finish_reason: "length",
              output_tokens: 16384,
              reasoning_tokens: 16384,
            }
          : {},
        data: {
          content: emptyText ? "" : "器灵文本响应",
          reasoning_content: "这只是思考内容，不能作为正文",
        },
        billing: { fee: "0.00123" },
      };
  } else if (req.url.endsWith("/remove-ai"))
    data = {
      success: true,
      task_id: "task-" + ++taskCount,
      status: "processing",
      charged: "0.25",
      balance: "25.25",
    };
  else if (req.url.includes("/tasks/"))
    data = {
      task_id: req.url.split("/").at(-1),
      status: taskStatus,
      ...(taskStatus === "completed"
        ? { text: "处理后的候选文案" }
        : taskStatus === "failed"
          ? { message: "上游处理失败", error_code: "UPSTREAM_FAILED" }
          : {}),
    };
  else {
    res.statusCode = 404;
    data = { detail: "unknown route" };
  }
  res.end(JSON.stringify(data));
});
app.whenReady().then(async () => {
  let code = 0;
  try {
    assert(safeStorage.isEncryptionAvailable());
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const api = createQilingApi({
      base: `http://127.0.0.1:${server.address().port}`,
    });
    const custom = {
      baseUrl: "https://custom.invalid/reply",
      apiPath: "",
      model: "my-custom",
      apiKey: "custom-test-key",
    };
    config.saveConfig(custom);
    const create = () =>
      createQilingService({
        config,
        directory,
        api,
        now: () => clock,
        openExternal: (url) => opened.push(url),
        windowMs: 9000,
      });
    let service = create();
    const first = await service.startAuth(1);
    assert.equal(first.status, "pending");
    assert(!JSON.stringify(first).includes("device"));
    assert.deepEqual(calls.at(-1).body, { client_name: "万稿汇" });
    assert(opened[0].includes("browser-code"));
    assert(!opened[0].includes("secret-device"));
    service.cancelAuth(1);
    clock += 3000;
    assert.equal((await service.pollAuth(1)).status, "cancelled");
    assert(!calls.some((c) => c.path.endsWith("/token")));
    await service.startAuth(2);
    clock += 600001;
    assert.equal((await service.pollAuth(2)).status, "expired");
    for (const status of ["denied", "consumed", "expired"]) {
      authStatus = status;
      await service.startAuth(3);
      clock += 3000;
      assert.equal((await service.pollAuth(3)).status, status);
      const n = calls.length;
      clock += 3000;
      await service.pollAuth(3);
      assert.equal(calls.length, n, "terminal authorization stops polling");
    }
    authStatus = "limited";
    await service.startAuth(4);
    clock += 3000;
    assert.equal((await service.pollAuth(4)).status, "pending");
    const n = calls.length;
    clock += 3000;
    await service.pollAuth(4);
    assert.equal(calls.length, n, "429 backs off");
    authStatus = "authorized";
    clock += 3000;
    assert.equal((await service.pollAuth(4)).status, "authorized");
    const afterClaim = calls.length;
    await service.pollAuth(4);
    assert.equal(calls.length, afterClaim, "Key only claimed once");
    const savedBeforeCancel = fs.readFileSync(
      path.join(directory, "ai-config.json"),
      "utf8",
    );
    let releaseModels,
      enteredModels = false;
    const heldApi = {
      ...api,
      models: async (...args) => {
        const value = await api.models(...args);
        enteredModels = true;
        await new Promise((resolve) => (releaseModels = resolve));
        return value;
      },
    };
    const held = createQilingService({
      config,
      directory,
      api: heldApi,
      now: () => clock,
      openExternal: () => {},
    });
    await held.startAuth(9);
    clock += 3000;
    const claiming = held.pollAuth(9);
    while (!enteredModels)
      await new Promise((resolve) => setTimeout(resolve, 5));
    held.cancelAuth(9);
    releaseModels();
    assert.equal((await claiming).status, "cancelled");
    assert.equal(
      fs.readFileSync(path.join(directory, "ai-config.json"), "utf8"),
      savedBeforeCancel,
      "cancel during model validation never saves a claimed Key",
    );
    const oneClick = config.publicConfig();
    assert(oneClick.qilingConfigured);
    assert.equal(oneClick.qilingModel, "", "no automatic first model");
    const manual = await service.connect("qk_test_user_key");
    assert.deepEqual(
      manual.config,
      oneClick,
      "manual and authorization have identical config",
    );
    assert.equal(manual.models.length, 2);
    assert.equal(
      manual.models.find((model) => model.code === "second-text").maxTokens,
      100000,
      "large model is limited by public API, not 4096",
    );
    await assert.rejects(
      service.selectModel("dynamic-text", { maxTokens: 1201, maxFee: "0.5" }),
      /1–1200/,
    );
    await assert.rejects(
      service.selectModel("dynamic-text", { maxTokens: 1200, maxFee: "0" }),
      /费用/,
    );
    await assert.rejects(
      service.selectModel("dynamic-text", { maxTokens: 1200, maxFee: "NaN" }),
      /金额/,
    );

    await assert.rejects(service.selectModel("no-image"));
    await service.selectModel("dynamic-text", {
      maxTokens: 1200,
      maxFee: "0.50",
    });
    assert.equal(config.runtimeConfig().AI_MODEL, "dynamic-text");
    assert.equal(config.runtimeConfig().QILING_MAX_TOKENS, 1200);
    await service.selectModel("second-text", {
      maxTokens: 16384,
      maxFee: "0.50",
    });
    assert.equal(config.runtimeConfig().QILING_MAX_TOKENS, 16384);
    assert.equal(config.publicConfig().qilingMaxFee, "0.50");
    assert(config.publicConfig().qilingBudgetConfigured);

    assert.equal(config.runtimeConfig().AI_MODEL, "second-text");
    await service.selectModel("dynamic-text", {
      maxTokens: 1200,
      maxFee: "0.50",
    });
    const stored = fs.readFileSync(
      path.join(directory, "ai-config.json"),
      "utf8",
    );
    assert(!stored.includes("qk_test_user_key"));
    assert(!JSON.stringify(config.publicConfig()).includes("qk_test_user_key"));
    config.saveConfig({ ...custom, apiKey: "" });
    assert.equal(config.runtimeConfig().AI_SERVICE, "custom");
    assert.equal(config.runtimeConfig().AI_API_KEY, "custom-test-key");
    await service.selectModel("dynamic-text", {
      maxTokens: 1200,
      maxFee: "0.50",
    });
    const chat = createQilingChat({ directory, api }),
      env = {
        key: "qk_test_user_key",
        model: "dynamic-text",
        maxTokens: 1200,
        feeLimit: "0.50",
        requestId: "business-1",
      };
    const messages = [{ role: "user", content: "改写当前文案" }];
    const paidCount = () =>
      calls.filter((call) => call.path.endsWith("/chat/completions")).length;
    let paid = paidCount();
    estimatedFee = "0.500000001";
    await assert.rejects(
      chat(
        [{ role: "user", content: "超出预算的请求" }],
        { ...env, requestId: "over-budget" },
        0.3,
      ),
      (error) => error.code === "QILING_BUDGET",
    );
    assert.equal(paidCount(), paid, "over-budget quote prevents paid call");
    estimatedFee = "0.50";
    assert.equal(
      await chat(
        [{ role: "user", content: "与预算相等的请求" }],
        { ...env, requestId: "exact-budget" },
        0.3,
      ),
      "器灵文本响应",
    );
    estimatedFee = "invalid";
    paid = paidCount();
    await assert.rejects(
      chat(
        [{ role: "user", content: "预估异常" }],
        { ...env, requestId: "bad-quote" },
        0.3,
      ),
    );
    assert.equal(paidCount(), paid, "invalid quote fails closed");
    estimatedFee = "0.01";
    await assert.rejects(
      chat(
        [{ role: "user", content: "非法 Token" }],
        { ...env, maxTokens: 100001, requestId: "bad-token" },
        0.3,
      ),
      /Token/,
    );
    assert.equal(
      paidCount(),
      paid,
      "invalid output budget cannot call upstream",
    );
    assert.equal(
      await chat(
        [{ role: "user", content: "大于4096的输出预算" }],
        {
          ...env,
          model: "second-text",
          maxTokens: 16384,
          requestId: "larger-budget",
        },
        0.3,
      ),
      "器灵文本响应",
    );
    assert.equal(
      calls.at(-1).body.max_tokens,
      16384,
      "saved output budget is sent without a 4096 clamp",
    );
    assert(!("thinking" in calls.at(-1).body));
    emptyText = true;
    const emptyMessages = [{ role: "user", content: "空正文但有思考内容" }];
    await assert.rejects(
      chat(
        emptyMessages,
        { ...env, maxTokens: 16384, requestId: "empty-text" },
        0.3,
      ),
      (error) => error.code === "QILING_REVIEW",
    );
    paid = paidCount();
    await assert.rejects(
      chat(
        emptyMessages,
        { ...env, maxTokens: 32768, requestId: "higher-budget-after-empty" },
        0.3,
      ),
    );
    assert.equal(
      paidCount(),
      paid,
      "increasing budget never replays an unresolved paid call",
    );
    const emptyRecord = JSON.parse(
      fs.readFileSync(
        path.join(directory, "qiling-model-requests.json"),
        "utf8",
      ),
    ).find((row) => row.requestId.startsWith("empty-text-"));
    assert.equal(emptyRecord.status, "review");
    assert.equal(emptyRecord.maxTokens, 16384);
    assert.equal(emptyRecord.finishReason, "length");
    assert.equal(emptyRecord.reasoningTokens, 16384);
    emptyText = false;

    assert.equal(await chat(messages, env, 0.3), "器灵文本响应");
    assert.equal(calls.at(-1).body.max_tokens, 1200);
    assert(calls.at(-1).body.request_id.startsWith("business-1-"));
    assert(!calls.at(-1).auth);
    assert(!calls.at(-1).app);
    assert.equal(calls.at(-1).key, "qk_test_user_key");
    await assert.rejects(
      chat(
        [{ role: "user", content: "模拟网络重试" }],
        { ...env, requestId: "transport-retry" },
        0.3,
      ),
      (error) => error.code === "QILING_NETWORK",
    );
    const retried = calls.filter(
      (call) => call.body?.messages?.[0]?.content === "模拟网络重试",
    );
    assert.equal(
      retried.length,
      1,
      "network interruption stops; no automatic replay",
    );
    const aborter = new AbortController();
    aborter.abort();
    const beforeAbort = calls.length;
    await assert.rejects(
      chat(
        [{ role: "user", content: "用户停止后的请求" }],
        { ...env, signal: aborter.signal },
        0.3,
      ),
    );
    assert.equal(
      calls.length,
      beforeAbort,
      "cancelled run never submits another model request",
    );
    modelStatus = "unknown";
    await assert.rejects(
      chat(
        [{ role: "user", content: "未知结果" }],
        { ...env, requestId: "uncertain" },
        0.3,
      ),
      (e) => e.code === "QILING_REVIEW",
    );
    let size = calls.length;
    await assert.rejects(
      chat(
        [{ role: "user", content: "未知结果" }],
        { ...env, requestId: "auto-retry" },
        0.3,
      ),
    );
    assert.equal(calls.length, size, "unknown is never resubmitted");
    modelStatus = "review";
    await assert.rejects(
      chat(
        [{ role: "user", content: "待核对" }],
        { ...env, requestId: "review" },
        0.3,
      ),
    );
    modelStatus = "succeeded";
    apiStatus = 402;
    await assert.rejects(
      chat(
        [{ role: "user", content: "无余额" }],
        { ...env, requestId: "balance" },
        0.3,
      ),
      (e) =>
        e.code === "QILING_BALANCE" &&
        e.retryable === false &&
        !e.message.includes("qk_"),
    );
    apiStatus = 200;
    apiStatus = 503;
    const serverFailure = [{ role: "user", content: "服务器返回异常的原请求" }];
    await assert.rejects(
      chat(serverFailure, { ...env, requestId: "server-error" }, 0.3),
    );
    const serverFailedCount = calls.length;
    await assert.rejects(
      chat(serverFailure, { ...env, requestId: "server-auto-retry" }, 0.3),
    );
    assert.equal(
      calls.length,
      serverFailedCount,
      "server errors cannot trigger a new charged request",
    );
    apiStatus = 200;
    const journal = JSON.parse(
      fs.readFileSync(path.join(directory, "qiling-model-requests.json")),
    );
    assert(journal.some((row) => row.fee === "0.00123"));
    assert(!JSON.stringify(journal).includes("qk_test_user_key"));
    const price = await service.price();
    assert.equal(price.price, "0.25");
    assert.equal(price.balance, "25.50");
    await assert.rejects(
      service.startRemove({ text: "文".repeat(2001) }, 1),
      /2000/,
    );
    assert.equal(taskCount, 0);
    let job = await service.startRemove({ text: "当前文案" }, 1);
    assert.equal(job.state, "running");
    assert.equal(taskCount, 1);
    assert(!job.candidate);
    config.saveQiling({
      apiKey: "qk_changed_key",
      models: await api.models("qk_changed_key"),
      model: "dynamic-text",
      maxTokens: 1200,
      maxFee: "0.50",
    });
    clock += 3000;
    job = await service.pollRemove(job.id);
    assert.equal(job.state, "paused");
    assert(job.error.includes("Key 已变更"));
    config.saveQiling({
      apiKey: "qk_test_user_key",
      models: await api.models("qk_test_user_key"),
      model: "dynamic-text",
      maxTokens: 1200,
      maxFee: "0.50",
    });
    service.resumeRemove(job.id);

    clock += 3000;
    job = await service.pollRemove(job.id);
    assert.equal(job.parts[0].status, "processing");
    assert(!job.candidate, "200 processing never treated as completed");
    service.pauseRemove(job.id);
    size = calls.length;
    clock += 3000;
    await service.pollRemove(job.id);
    assert.equal(calls.length, size, "cancel stops polling");
    service.resumeRemove(job.id);
    clock += 10000;
    job = await service.pollRemove(job.id);
    assert.equal(job.state, "paused", "bounded waiting");
    assert.equal(taskCount, 1);
    service = create();
    assert.equal(
      service.getJob(job.id).parts[0].taskId,
      "task-1",
      "task persisted across restart",
    );
    service.resumeRemove(job.id);
    taskStatus = "completed";
    clock += 3000;
    job = await service.pollRemove(job.id);
    assert.equal(job.candidate, "处理后的候选文案");
    assert.equal(taskCount, 1, "resume only queries original task");
    service.adoptRemove(job.id);
    taskStatus = "failed";
    job = await service.startRemove({ text: "失败文案" }, 1);
    clock += 3000;
    job = await service.pollRemove(job.id);
    assert.equal(job.state, "failed");
    assert.equal(job.error, "上游处理失败");
    taskStatus = "processing";
    job = await service.startRemove(
      { text: "文".repeat(2001), allowSplit: true },
      1,
    );
    assert.equal(job.parts.length, 2);
    assert.equal(taskCount, 3, "only first long-text part submitted");
    service.pauseRemove(job.id);
    service.resumeRemove(job.id);
    taskStatus = "completed";
    clock += 3000;
    job = await service.pollRemove(job.id);
    assert.equal(taskCount, 3);
    clock += 3000;
    job = await service.pollRemove(job.id);
    assert.equal(taskCount, 4);
    clock += 3000;
    job = await service.pollRemove(job.id);
    if (job.state === "paused") {
      service.resumeRemove(job.id);
      clock += 3000;
      job = await service.pollRemove(job.id);
    }
    assert.equal(job.state, "completed");
    assert.equal(job.candidate, "处理后的候选文案处理后的候选文案");
    assert(
      calls
        .filter((c) => c.path.endsWith("/remove-ai"))
        .every((c) => Array.from(c.body.text).length <= 2000),
    );
    console.log(
      "PASS: generic one-click/manual Key equivalence, cancellation/expiry/denied/consumed/429, encrypted keys, dynamic text models and limits, custom config preserved, Qiling response and request journal, unknown/review stop, 402, async remove-AI failure/wait/cancel/restart/splitting. No live paid calls.",
    );
  } catch (error) {
    console.error(error);
    code = 1;
  } finally {
    server.close();
    fs.rmSync(directory, { recursive: true, force: true });
    app.exit(code);
  }
});
