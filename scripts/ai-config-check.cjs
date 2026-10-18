const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const assert = require("assert/strict");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "wangaohui-ai-check-"));
app.setPath("userData", temporary);
const config = require("../electron/ai-config.cjs");
const { chatUrl, requestChat } = require("../electron/ai-client.cjs");
const { runPipeline } = require("../electron/pipeline.cjs");
require("../electron/ipc.cjs").registerIpc();
ipcMain.handle("app-version", () => "1.0.2");
// Keep this regression test offline; authorization transport has its own local HTTP test.
ipcMain.removeHandler("qiling-auth-start");
ipcMain.handle("qiling-auth-start", () => ({
  ok: true,
  status: "pending",
  interval: 3000,
}));
ipcMain.removeHandler("qiling-auth-poll");
ipcMain.handle("qiling-auth-poll", () => ({
  ok: true,
  status: "pending",
  interval: 3000,
}));
const calls = [];
const text = "测试文章\n\n这是用于验证配置的中文正文，内容和排版应当完整保留。";
let responseMode = "ok";
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  calls.push({ url: req.url, auth: req.headers.authorization, body });
  res.setHeader("Content-Type", "application/json");
  if (responseMode === "http-error") {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "invalid key test-secret" }));
    return;
  }
  if (
    body.messages?.some((message) => message.content === "slow-cancel-test")
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (responseMode === "invalid") {
    res.end("not-json");
    return;
  }
  if (responseMode === "empty") {
    res.end(JSON.stringify({ choices: [] }));
    return;
  }
  if (responseMode === "minimax-error") {
    res.end(
      JSON.stringify({
        base_resp: { status_code: 1004, status_msg: "invalid test-secret" },
      }),
    );
    return;
  }
  if (req.url.includes("/images/generations")) {
    res.end(JSON.stringify({ data: [{ b64_json: "dGVzdA==" }] }));
    return;
  }
  const system = body.messages?.[0]?.content || "";
  let content = "连接成功 OK";
  if (Array.isArray(system))
    content = JSON.stringify({
      images: [{ index: 1, layout: "居中", subject: "花瓶" }],
      overallStyle: "简约",
    });
  else if (system.includes("排版分块器"))
    content = JSON.stringify({
      blocks: [
        { type: "title", text: "测试文章" },
        {
          type: "p",
          text: "这是用于验证配置的中文正文，内容和排版应当完整保留。",
        },
      ],
    });
  else if (
    system.includes("机器翻译引擎") ||
    system.includes("你是中文内容编辑")
  )
    content = text;
  else if (!system.includes("连接测试助手") && system !== "test")
    content = "# テスト記事\n\nこれはテストです。";
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
});
const fixtureName = ".tmp-ai-config";
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import {Toaster} from '../../src/components/ui/sonner';
import {ConfirmationHost} from '../../src/components/shared/controls';
import App from '../../src/App';
import '../../src/ui.css';import '../../src/styles.css';import '../../src/workspace.css';
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,options)=>String(input).includes('159.75.139.210')?new Response(JSON.stringify({code:0,data:[],meta:{total:0,page:1,page_size:12}}),{headers:{'Content-Type':'application/json'}}):nativeFetch(input,options);
createRoot(document.getElementById('root')!).render(<><App/><Toaster/><ConfirmationHost/></>);`;
const fixturePath = path.resolve("scripts/ui-test", fixtureName);
fs.writeFileSync(fixturePath + ".tsx", fixture);
fs.writeFileSync(
  fixturePath + ".html",
  `<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="${fixtureName}.tsx"></script></body></html>`,
);
const out = path.resolve(".tmp-ai-check");
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  let win;
  let exitCode = 0;
  try {
    console.log("check: ready");
    assert(safeStorage.isEncryptionAvailable(), "system encryption available");
    console.log("check: encryption available");
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    const endpoint = baseUrl + "/text/reply/";
    const file = path.join(temporary, "ai-config.json");
    // Existing non-text settings remain readable, but text-only saves never require or replace them.
    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        settings: {
          provider: "custom",
          baseUrl: "",
          apiPath: "",
          model: "",
          vision: true,
          translationProvider: "youdao",
          imageProvider: "custom",
          imageBaseUrl: baseUrl + "/images/generations",
          imageModel: "test-image",
        },
        secrets: {
          imageApiKey: safeStorage
            .encryptString("image-secret")
            .toString("base64"),
        },
      }),
    );
    const draft = {
      baseUrl: endpoint,
      apiPath: "",
      model: "test-model",
      apiKey: "test-secret",
    };
    assert.equal(config.publicConfig().baseUrl, "");
    assert.equal(config.publicConfig().model, "");
    assert.throws(() => config.saveConfig({ ...draft, apiKey: "" }), /API Key/);
    assert.equal(
      chatUrl(endpoint, ""),
      endpoint,
      "full endpoint used verbatim",
    );
    assert.equal(
      chatUrl(baseUrl, "/v1/chat/completions"),
      baseUrl + "/chat/completions",
    );
    assert.equal(
      chatUrl(baseUrl + "/chat/completions", "/v1/chat/completions"),
      baseUrl + "/chat/completions",
    );
    assert.equal(
      chatUrl("https://api.deepseek.com", ""),
      "https://api.deepseek.com/v1/chat/completions",
    );
    assert.equal(
      chatUrl("https://api.deepseek.com/", ""),
      "https://api.deepseek.com/v1/chat/completions",
    );
    assert.equal(chatUrl(baseUrl, ""), baseUrl + "/chat/completions");
    assert.equal(chatUrl(baseUrl + "/", ""), baseUrl + "/chat/completions");
    assert.equal(
      chatUrl(baseUrl + "/chat/completions", ""),
      baseUrl + "/chat/completions",
    );
    assert.equal(
      chatUrl(baseUrl + "/text/chatcompletion_v2", ""),
      baseUrl + "/text/chatcompletion_v2",
    );
    const rootUrl = `http://127.0.0.1:${server.address().port}`;
    for (const configuredUrl of [
      rootUrl,
      baseUrl,
      baseUrl + "/chat/completions",
      endpoint,
    ]) {
      config.saveConfig({ ...draft, baseUrl: configuredUrl });
      const offset = calls.length;
      const result = await runPipeline(
        { sourceText: "测试自定义基础地址和完整接口", words: 300 },
        config.runtimeConfig(),
      );
      assert.equal(result.chinese, text);
      assert.equal(
        calls.length - offset,
        1,
        "one request only, no endpoint probing or paid retries",
      );
      assert.equal(
        calls.at(-1).url,
        configuredUrl === endpoint ? "/v1/text/reply/" : "/v1/chat/completions",
      );
      assert.equal(calls.at(-1).auth, "Bearer test-secret");
    }
    console.log("check: saving local configuration");
    config.saveConfig(draft);
    assert(
      !fs.readFileSync(file, "utf8").includes("test-secret"),
      "no plaintext text key on disk",
    );
    assert(
      !fs.readFileSync(file, "utf8").includes("image-secret"),
      "no plaintext image key on disk",
    );
    assert.equal(config.runtimeConfig().AI_API_KEY, "test-secret");
    const publicInfo = config.publicConfig();
    assert(publicInfo.hasApiKey && publicInfo.hasImageKey);
    assert(
      !JSON.stringify(publicInfo).includes("secret"),
      "read IPC returns flags only",
    );
    config.saveConfig({ ...draft, apiKey: "", imageApiKey: "" });
    assert.equal(
      config.runtimeConfig().AI_API_KEY,
      "test-secret",
      "blank retains key",
    );
    assert.throws(
      () => config.saveConfig({ ...draft, baseUrl: "file:///tmp/model" }),
      /HTTP/,
    );
    assert.throws(
      () =>
        config.saveConfig({
          ...draft,
          baseUrl: "https://user:key@example.com",
        }),
      /HTTP/,
    );
    assert.throws(
      () => config.saveConfig({ ...draft, apiPath: "//another.host/path" }),
      /路径/,
    );
    assert.equal(config.runtimeConfig().TRANSLATION_PROVIDER, "llm");
    assert.equal(
      config.runtimeConfig().IMAGE_API_KEY,
      "image-secret",
      "text-only save preserves existing image credentials",
    );
    assert.equal(config.runtimeConfig().IMAGE_MODEL, "test-image");
    const bytes = fs.readFileSync(file, "utf8");
    const testCfg = config.testConfig({ ...draft, model: "unsaved-model" });
    assert.equal(testCfg.AI_MODEL, "unsaved-model");
    assert.equal(
      fs.readFileSync(file, "utf8"),
      bytes,
      "connection test does not save",
    );
    const env = {
      key: "test-secret",
      url: chatUrl(baseUrl, "/chat/completions"),
      model: "test-model",
      timeout: 10,
    };
    for (const mode of ["http-error", "invalid", "empty", "minimax-error"]) {
      responseMode = mode;
      await assert.rejects(
        requestChat([{ role: "system", content: "test" }], env),
        (error) => !error.message.includes("test-secret"),
      );
    }
    responseMode = "ok";
    const callsBeforeArticle = calls.length;
    const article = await runPipeline(
      {
        provider: "deepseek",
        sourceText: "测试选题",
        inputMode: "title",
        qualityMode: "single",
        viralMode: false,
        translationProvider: "youdao",
      },
      config.runtimeConfig(),
    );
    assert.equal(
      calls.length - callsBeforeArticle,
      1,
      "one text call only, no translation or model formatting",
    );
    assert.equal(article.chinese, text);
    assert.equal(article.blocks.length, 2);
    assert(
      calls.every(
        (call) =>
          call.body.model === "test-model" &&
          call.auth === "Bearer test-secret",
      ),
      "active model overrides old provider and translation defaults",
    );
    fs.writeFileSync(file, "{broken");
    assert.throws(() => config.saveConfig(draft), /无法读取/);
    assert.equal(
      fs.readFileSync(file, "utf8"),
      "{broken",
      "corrupt config is not silently overwritten",
    );
    fs.writeFileSync(file, bytes);

    win = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      webPreferences: {
        preload: path.resolve("electron/preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        partition: "ai-config-" + Date.now(),
        backgroundThrottling: false,
      },
    });
    const diagnostics = [];
    win.webContents.on("console-message", (_event, level, message) => {
      if (level >= 2 && !message.includes("Electron Security Warning"))
        diagnostics.push(message);
    });
    const js = (source) => win.webContents.executeJavaScript(source);
    const click = async (label) => {
      assert(
        await js(
          `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.click();return true;})()`,
        ),
        "button " + label,
      );
      await wait(180);
    };
    const input = async (label, value) => {
      await js(
        `(()=>{const e=document.querySelector('input[aria-label=${JSON.stringify(label)}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await wait(50);
    };
    await win.loadURL(
      "http://127.0.0.1:5173/scripts/ui-test/" + fixtureName + ".html",
    );
    await wait(1000);
    assert(!(await js("document.body.innerText")).includes("授权码"));
    assert(
      !(await js(
        `Object.keys(window.wangaohui).some(key=>key.startsWith('sdk')||key.startsWith('credit'))`,
      )),
      "bridge no longer exports activation/credit methods",
    );
    await click("AI 配置");
    assert(
      await js(
        `document.querySelectorAll('.ai-config-page input').length === 3`,
      ),
      "only three manual text fields",
    );
    assert(
      await js(`!document.querySelector('.ai-config-page [role=combobox]')`),
      "no provider presets",
    );
    assert(
      !(
        await js(`document.querySelector('.ai-config-page').innerText`)
      ).includes("图片生成"),
      "no image configuration",
    );
    assert.equal(
      await js(`document.querySelector('input[aria-label="接口地址"]').value`),
      endpoint,
    );
    await input("接口地址", "");
    await click("保存配置");
    assert((await js("document.body.innerText")).includes("请填写接口地址"));
    await input("接口地址", endpoint);
    assert.equal(
      await js(`document.querySelector('input[aria-label="模型名称"]').value`),
      "test-model",
    );
    assert.equal(
      await js(`document.querySelector('input[aria-label="API Key"]').value`),
      "",
    );
    await input("模型名称", "");
    await click("保存配置");
    assert((await js("document.body.innerText")).includes("请填写模型名称"));
    await input("模型名称", "edited-model");
    await click("资源管理");
    await click("AI 配置");
    assert.equal(
      await js(`document.querySelector('input[aria-label="模型名称"]').value`),
      "edited-model",
      "unsaved draft survives navigation",
    );
    await click("测试连接");
    assert((await js("document.body.innerText")).includes("连接成功"));
    assert.equal(calls.at(-1).body.model, "edited-model");
    assert.equal(
      config.runtimeConfig().AI_MODEL,
      "test-model",
      "test remains unsaved",
    );
    await click("保存配置");
    assert((await js("document.body.innerText")).includes("配置已保存"));
    assert.equal(config.runtimeConfig().AI_MODEL, "edited-model");
    await win.reload();
    await wait(700);
    await click("AI 配置");
    assert.equal(
      await js(`document.querySelector('input[aria-label="模型名称"]').value`),
      "edited-model",
      "saved model reloads",
    );
    const chat = await js(
      `window.wangaohui.llmChat({system:'test',user:'hello',provider:'deepseek'})`,
    );
    assert(chat.ok);
    await js(
      `window.__progress=[];window.wangaohui.onGenerationProgress(progress=>window.__progress.push(progress));void 0;`,
    );
    const generated = await js(
      `window.wangaohui.generateArticle({provider:'deepseek',sourceText:'测试选题',inputMode:'title',qualityMode:'single',viralMode:false,translationProvider:'youdao'})`,
    );
    assert(generated.ok, generated.error);
    assert(
      await js(
        `window.__progress.some(progress=>progress.message.includes('仅一次模型调用')) && window.__progress.some(progress=>progress.stage==='layout')`,
      ),
      "IPC delivers actual pipeline stages",
    );
    await js(
      `window.__cancelResult=null;window.wangaohui.llmChat({system:'test',user:'slow-cancel-test',requestId:'cancel-check'}).then(result=>window.__cancelResult=result);void 0;`,
    );
    await wait(150);
    assert(
      (
        await js(
          `window.wangaohui.cancelGeneration({requestId:'cancel-check'})`,
        )
      ).ok,
    );
    await wait(150);
    assert.equal(await js(`window.__cancelResult.code`), "QILING_CANCELLED");
    const afterStop = await js(
      `window.wangaohui.llmChat({system:'test',user:'must-not-submit',requestId:'cancel-check'})`,
    );
    assert(!afterStop.ok);
    assert.equal(afterStop.code, "QILING_CANCELLED");
    assert(
      !calls.some((call) =>
        call.body.messages?.some(
          (message) => message.content === "must-not-submit",
        ),
      ),
      "cancelled business request cannot start a later stage",
    );

    assert.equal(generated.blocks.length, 2);
    assert.equal(calls.at(-1).body.model, "edited-model");
    const images = await js(
      `window.wangaohui.generateImage({prompt:'test',provider:'seedream',size:'3:4'})`,
    );
    assert(images.ok);
    assert.equal(calls.at(-1).body.size, "1024x1536");
    assert.equal(calls.at(-1).body.model, "test-image");
    assert.equal(calls.at(-1).auth, "Bearer image-secret");
    const analysis = await js(
      `window.wangaohui.analyzeNoteImages({images:['data:image/png;base64,dGVzdA==']})`,
    );
    assert(analysis.ok, analysis.error);
    assert.equal(analysis.compositions[0], "构图：居中；主体：花瓶");
    await click("一键授权");
    assert(
      await js(
        `!![...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.includes('取消等待'))`,
      ),
    );
    const externalBefore = calls.length;
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await wait(160);
      assert(
        await js(
          `document.querySelector('[role=dialog]').getBoundingClientRect().right<=innerWidth`,
        ),
      );
      await win
        .capturePage()
        .then((img) =>
          fs.writeFileSync(
            path.join(out, "quick-" + width + ".png"),
            img.toPNG(),
          ),
        );
    }
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await wait(180);
    assert(await js(`!document.querySelector('[role=dialog]')`));
    assert.equal(
      calls.length,
      externalBefore,
      "authorization dialog makes no AI model request",
    );
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await wait(160);
      assert(
        await js(`document.documentElement.scrollWidth<=innerWidth+2`),
        "page fits window",
      );
      await js(
        `document.querySelector('input[aria-label="模型名称"]').scrollIntoView({block:'center'})`,
      );
      await win
        .capturePage()
        .then((img) =>
          fs.writeFileSync(
            path.join(out, "config-" + width + ".png"),
            img.toPNG(),
          ),
        );
    }
    assert.deepEqual(diagnostics, []);
    console.log(
      "PASS: encrypted local configuration, validation, blank key retention, manual text-only form, custom endpoint errors, one-call Chinese generation and local formatting, real IPC, vision/images, navigation persistence, authorization waiting dialog, three window sizes.",
    );
  } catch (error) {
    console.error(error);
    if (win)
      await win
        .capturePage()
        .then((img) =>
          fs.writeFileSync(path.join(out, "failure.png"), img.toPNG()),
        );
    exitCode = 1;
  } finally {
    server.close();
    for (const ext of ["html", "tsx"])
      fs.rmSync(fixturePath + "." + ext, { force: true });
    fs.rmSync(temporary, { recursive: true, force: true });
    app.exit(exitCode);
  }
});
