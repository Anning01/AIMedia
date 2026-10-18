const { app, BrowserWindow } = require("electron");
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const name = ".tmp-qiling-ui",
  file = path.resolve("scripts/ui-test", name),
  out = path.resolve(".tmp-qiling-ui-check");
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync("scripts/ui-test/qiling.tsx.template", file + ".tsx");
fs.writeFileSync(
  file + ".html",
  `<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="${name}.tsx"></script></body></html>`,
);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  let win,
    code = 0;
  try {
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        partition: "qiling-ui-" + Date.now(),
        backgroundThrottling: false,
      },
    });
    const errors = [];
    win.webContents.on("console-message", (_e, level, msg) => {
      if (level >= 2 && !msg.includes("Electron Security Warning"))
        errors.push(msg);
    });
    const js = (s) =>
      win.webContents.executeJavaScript(s).catch((error) => {
        console.error("Failed test expression:", s);
        throw error;
      });
    const click = async (label) => {
      const point = await js(
        `(()=>{const e=[...document.querySelectorAll('button,[role=tab],[role=option]')].find(e=>e.getClientRects().length&&(e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)}));if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
      );
      assert(point, "click " + label);
      win.webContents.sendInputEvent({
        type: "mouseDown",
        button: "left",
        clickCount: 1,
        ...point,
      });
      win.webContents.sendInputEvent({
        type: "mouseUp",
        button: "left",
        clickCount: 1,
        ...point,
      });
      await wait(200);
    };
    const input = async (label, text) => {
      await js(
        `(()=>{const e=document.querySelector('input[aria-label=${JSON.stringify(label)}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await wait(80);
    };
    await win.loadURL(
      "http://127.0.0.1:5173/scripts/ui-test/" + name + ".html",
    );
    await wait(700);
    assert(await js(`document.querySelectorAll('input').length===3`));
    await click("一键授权");
    assert((await js("document.body.innerText")).includes("系统浏览器"));
    await click("取消等待");
    const polls = await js(
      `window.__calls.filter(c=>c.name==='qilingAuthPoll').length`,
    );
    await wait(3200);
    assert.equal(
      await js(`window.__calls.filter(c=>c.name==='qilingAuthPoll').length`),
      polls,
    );
    await click("器灵服务");
    await input("器灵 API Key", "qk_ui_only");
    await click("验证并接入");
    assert.equal(
      await js(
        `document.querySelector('input[aria-label="器灵 API Key"]').value`,
      ),
      "",
    );
    assert((await js("document.body.innerText")).includes("已配置"));
    await click("器灵文本模型");
    await click("动态文本 · text-live");
    assert.equal(await js(`document.querySelector('[role="radio"][data-state="checked"]').textContent.trim()`), "默认", "supported model defaults to provider behavior");
    await click("开启");
    assert.equal(await js(`document.querySelector('[role="radio"][data-state="checked"]').textContent.trim()`), "开启");
    assert.equal(
      await js(
        `document.querySelector('input[aria-label="最大输出量"]').value`,
      ),
      "16384",
    );
    await input("最大输出量", "24576");
    await input("单次预估费用上限", "0");
    await click("保存模型与设置");
    assert((await js("document.body.innerText")).includes("费用上限"));
    assert.equal(
      await js(
        `window.__calls.filter(call=>call.name==='qilingSelectModel').length`,
      ),
      0,
      "invalid budget never saved",
    );
    await input("单次预估费用上限", "0.15");
    await click("保存模型与设置");
    assert.equal(await js("window.__config.qilingMaxTokens"), 24576);
    assert.equal(await js("window.__config.qilingMaxFee"), "0.15");
    assert.equal(await js("window.__config.qilingModel"), "text-live");
    assert.equal(await js("window.__config.qilingThinkingMode"), "enabled");
    await click("器灵文本模型");
    await click("普通文本 · plain-text");
    assert.equal(await js(`document.querySelectorAll('[role="radiogroup"]').length`), 0, "unsupported models have no thinking choices");
    await click("保存模型与设置");
    assert.equal(await js("window.__config.qilingThinkingMode"), "");
    await click("器灵文本模型");
    await click("动态文本 · text-live");
    assert.equal(await js(`document.querySelector('[role="radio"][data-state="checked"]').textContent.trim()`), "默认");
    await click("保存模型与设置");
    assert.equal(await js("window.__config.qilingThinkingMode"), "");
    assert(await js(`!('thinkingMode' in window.__calls.filter(c=>c.name==='qilingSelectModel').at(-1).payload)`), "default sends no thinking selection");
    win.show();win.focus();await wait(100);
    await js(`document.querySelector('[role="radio"][data-state="checked"]').focus()`);
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Right" });
    await wait(80);
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Right" });
    await wait(100);
    assert.equal(await js(`document.querySelector('[role="radio"][data-state="checked"]').textContent.trim()`), "开启", "thinking choices work with keyboard");
    win.hide();
    await click("保存模型与设置");
    await click("自定义接口");
    assert.equal(
      await js(`document.querySelector('input[aria-label="模型名称"]').value`),
      "custom-model",
    );
    await click("保存配置");
    assert.equal(await js("window.__config.service"), "custom");
    await js("window.__authReady=true");
    await click("一键授权");
    await wait(3300);
    assert((await js("document.body.innerText")).includes("授权成功"));
    await click("完成");
    assert.equal(await js(`document.querySelector('[role="radio"][data-state="checked"]').textContent.trim()`), "开启", "explicit setting restored after reload");
    await click("默认");
    await click("保存模型与设置");
    assert.equal(await js("window.__config.qilingThinkingMode"), "", "default clears a previously saved explicit mode");
    await win.capturePage().then((img) => fs.writeFileSync(path.join(out, "thinking-mode.png"), img.toPNG()));
    for (const [width,height] of [[1024,768],[1280,800],[1440,900]]) {
      win.setSize(width,height);await wait(120);
      await js('window.scrollTo(0,0)');await wait(80);
      assert(await js(`document.documentElement.scrollWidth <= innerWidth+1`), "configuration fits window width");
      await win.capturePage().then((img) => fs.writeFileSync(path.join(out, `qiling-panel-${width}.png`), img.toPNG()));
    }
    await click("编辑页");
    await wait(200);
    const original = await js("window.__editor.removeAiText");
    assert(original.includes("原文正文"));
    assert.equal(
      await js(`window.__calls.filter(c=>c.name==='qilingRemoveStart').length`),
      0,
      "no automatic removeAI",
    );
    await click("去 AI / 降低 AI 痕迹");
    assert((await js("document.body.innerText")).includes("0.25 元 / 次"));
    await click("确认并处理");
    assert.equal(
      await js("window.__editor.removeAiText"),
      original,
      "submission does not replace editor",
    );
    await js(
      `window.__editor.startEdit(window.__editor.blocks.find(b=>b.type==='p'))`,
    );
    await wait(70);
    await js(`window.__editor.setEditValue('用户继续编辑的新正文')`);
    await wait(70);
    await js("window.__complete=true");
    await wait(3200);
    assert(
      (await js("window.__editor.removeAiText")).includes(
        "用户继续编辑的新正文",
      ),
      "async result preserves in-progress edit",
    );
    assert(
      await js(
        `document.querySelector('textarea[aria-label="去 AI 候选"]').value.includes('候选正文')`,
      ),
    );
    assert(
      await js(
        `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='采用候选').disabled`,
      ),
      "changed document requires explicit confirmation",
    );
    await win
      .capturePage()
      .then((img) =>
        fs.writeFileSync(path.join(out, "candidate.png"), img.toPNG()),
      );
    await js(`document.querySelector('[role=dialog] [role=checkbox]').click()`);
    await wait(100);
    await click("采用候选");
    assert((await js("window.__editor.removeAiText")).includes("候选正文"));
    assert.equal(
      await js(`window.__editor.blocks.filter(b=>b.type==='image').length`),
      1,
      "images preserved",
    );
    assert.equal(await js("window.__editor.templateId"), "t1");
    assert.equal(
      await js(`window.__calls.filter(c=>c.name==='qilingRemoveStart').length`),
      1,
      "one submission",
    );
    await click("去 AI / 降低 AI 痕迹");
    await click("关闭");
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await wait(100);
      await click("配置页");
      await click("器灵服务");
      await wait(100);
      assert(await js("document.documentElement.scrollWidth<=innerWidth+2"));
      await win
        .capturePage()
        .then((img) =>
          fs.writeFileSync(
            path.join(out, "config-" + width + ".png"),
            img.toPNG(),
          ),
        );
    }
    assert.equal(
      await js(
        `(async()=>{const {withRetry}=await import('/src/features/task-center/model.tsx');let attempts=0;try{await withRetry(async()=>{attempts++;throw Object.assign(new Error('review'),{retryable:false});});}catch{}return attempts;})()`,
      ),
      1,
      "uncertain paid task is never automatically retried",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: manual/custom config, authorization cancel/success, dynamic model selection, thinking defaults/persistence/keyboard/model capabilities, optional paid remove-AI confirmation, candidate preview, editing conflict guard, explicit adoption preserves images/template, three desktop sizes. Offline mocks only.",
    );
  } catch (error) {
    console.error(error);
    code = 1;
    if (win) {
      console.log(
        await win.webContents.executeJavaScript("document.body.innerText"),
      );
      await win
        .capturePage()
        .then((img) =>
          fs.writeFileSync(path.join(out, "failure.png"), img.toPNG()),
        );
    }
  } finally {
    for (const ext of ["tsx", "html"])
      fs.rmSync(file + "." + ext, { force: true });
    app.exit(code);
  }
});
