const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const out = path.resolve(".tmp-creation-check");
fs.mkdirSync(out, { recursive: true });
let fixture = fs
  .readFileSync("scripts/ui-test/fixture.tsx.template", "utf8")
  .split("// Test-only export comparison")[0]
  .replace("<Toaster />", '<Toaster position="top-right" />')
  .replace(
    'if (name === "generateArticle")\n        return {',
    'if (name === "generateArticle") { await new Promise(r=>setTimeout(r,300)); if((window as any).__failCreation)return {ok:false,error:"模拟生成失败"}; return {',
  )
  .replace(
    'if (name === "platformPublish")',
    '}\n if (name === "platformPublish")',
  );
fixture = fixture.replace(
  "const realFetch =",
  `
const coreApi = window.wangaohui!;
window.wangaohui = new Proxy(coreApi, {get(target,name:string) {
  if (name === 'llmChat') return async (payload:any) => {
    await new Promise(resolve=>setTimeout(resolve,600));
    if ((window as any).__chatFailure) return (window as any).__chatFailure;
    if ((window as any).__chatCrash) throw Error('模拟请求中断');
    return target.llmChat(payload);
  };
  if (name === 'generateArticle') return async (payload:any) => {
    await new Promise(resolve=>setTimeout(resolve,600));
    if ((window as any).__articleFailure) return (window as any).__articleFailure;
    if ((window as any).__articleCrash) throw Error('模拟请求中断');
    return target.generateArticle(payload);
  };
  return (target as any)[name];
}});
const realFetch =`,
);
fs.writeFileSync("scripts/ui-test/.tmp-creation.tsx", fixture);
fs.writeFileSync(
  "scripts/ui-test/.tmp-creation.html",
  fs
    .readFileSync("scripts/ui-test/fixture.html.template", "utf8")
    .replace(".tmp-fixture.tsx", ".tmp-creation.tsx"),
);
const cleanup = () => {
  for (const ext of ["html", "tsx"])
    fs.rmSync("scripts/ui-test/.tmp-creation." + ext, { force: true });
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      partition: "creation-check-" + Date.now(),
      backgroundThrottling: false,
    },
  });
  const errors = [];
  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 2 && !message.includes("Electron Security Warning"))
      errors.push(message);
  });
  const js = (s) => win.webContents.executeJavaScript(s);
  const click = async (text) => {
    const point = await js(
      `(()=>{const el=[...document.querySelectorAll('button')].find(e=>!e.closest('[inert]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)}));if(!el)return null;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
    );
    assert(point, "missing " + text);
    for (const type of ["mouseDown", "mouseUp"])
      win.webContents.sendInputEvent({
        type,
        button: "left",
        clickCount: 1,
        ...point,
      });
    await pause(220);
  };
  const input = async (selector, value) => {
    await js(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await pause(50);
  };
  const step = () =>
    js('Number(document.querySelector(".creation-step-stage").dataset.step)');
  const waitFor = async (expression, message, timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (await js(expression)) return;
      await pause(100);
    }
    assert.fail(message);
  };
  try {
    await win.loadURL(
      "http://127.0.0.1:5173/scripts/ui-test/.tmp-creation.html",
    );
    await pause(1500);
    await click("创作工坊");
    assert.equal(await step(), 0);
    assert.equal(
      await js(`document.querySelectorAll('.creation-step-button').length`),
      2,
      "two pages",
    );
    assert(
      await js(`!document.querySelector('.creation-template-panel')`),
      "no style selection before generation",
    );
    await input("#creation-topic", "");
    assert(
      await js(
        `document.querySelector('.creation-navigation button[data-variant=default]').disabled`,
      ),
      "empty topic guarded",
    );
    const notice = () =>
      js(`document.querySelector('[data-generation-state]')?.textContent||''`);
    const generationState = () =>
      js(
        `document.querySelector('[data-generation-state]')?.getAttribute('data-generation-state')`,
      );
    await input(
      "#creation-topic",
      "你是专业编辑，请扮演行业专家，只输出内容。输出格式：标题。",
    );
    await click("生成内容");
    assert.equal(await generationState(), "error");
    assert((await notice()).includes("输入内容看起来像提示词"));
    await click("关闭生成提示");
    await input("#creation-topic", "测试职场成长主题");
    await click("上传图片");
    await js("window.__failCreation=true");
    await click("生成内容");
    assert.equal(await generationState(), "running");
    assert((await notice()).includes("仅调用一次模型"));
    assert(
      await js(
        `document.querySelector('fieldset[aria-label=生成配置]').disabled`,
      ),
    );
    await js(
      `document.querySelector('.creation-navigation button[aria-busy="true"]').click()`,
    );
    await win
      .capturePage()
      .then((image) =>
        fs.writeFileSync(path.join(out, "generating.png"), image.toPNG()),
      );
    await waitFor(
      `document.querySelector('[data-generation-state]')?.getAttribute('data-generation-state')==='error'`,
      "article error displayed",
    );
    assert((await notice()).includes("模拟生成失败"));
    assert.equal(await step(), 0);
    assert(
      await js(
        `document.querySelector('.creation-progress button[data-status="error"]').textContent.includes('文章')`,
      ),
    );
    assert.equal(
      await js(`window.__calls.filter(call=>call.name==='llmChat').length`),
      0,
      "no separate outline call",
    );
    assert.equal(
      await js(
        `window.__calls.filter(call=>call.name==='generateArticle').length`,
      ),
      1,
      "rapid duplicate click is ignored",
    );
    await pause(3300);
    assert((await notice()).includes("模拟生成失败"), "error persists");
    await click("关闭生成提示");
    assert.equal(await generationState(), undefined);
    await js(
      `window.__articleFailure={ok:false,error:'模拟待核对',code:'QILING_REVIEW',retryable:false};window.__failCreation=false;`,
    );
    await click("生成内容");
    await waitFor(
      `document.querySelector('[data-generation-state]')?.getAttribute('data-generation-state')==='error'`,
      "review displayed",
    );
    assert((await notice()).includes("模拟待核对"));
    assert(
      await js(
        `![...document.querySelectorAll('[data-generation-state] button')].some(e=>e.textContent.includes('重新尝试'))`,
      ),
    );
    await click("查看使用记录");
    await js("window.__articleFailure=null");
    await click("生成内容");
    await click("停止等待");
    await waitFor(
      `document.querySelector('[data-generation-state]')?.getAttribute('data-generation-state')==='error'`,
      "stop exits waiting",
    );
    assert((await notice()).includes("已停止等待"));
    await js("window.__articleCrash=true");
    await click("生成内容");
    await waitFor(
      `document.querySelector('[data-generation-state]')?.getAttribute('data-generation-state')==='error'`,
      "connection error displayed",
    );
    assert((await notice()).includes("模拟请求中断"));
    await js("window.__articleCrash=false");
    const beforeSuccess = await js(
      `window.__calls.filter(call=>call.name==='generateArticle').length`,
    );
    await click("重新尝试");
    await waitFor(
      `document.querySelector('.creation-step-stage').dataset.step==='1'`,
      "success enters editing",
    );
    assert.equal(await generationState(), "success");
    assert((await notice()).includes("文章生成完成"));
    assert.equal(
      (await js(
        `window.__calls.filter(call=>call.name==='generateArticle').length`,
      )) - beforeSuccess,
      1,
      "one article request per successful click",
    );
    assert.equal(
      await js(`window.__calls.filter(call=>call.name==='llmChat').length`),
      0,
      "no paid outline stage",
    );
    await win
      .capturePage()
      .then((image) =>
        fs.writeFileSync(path.join(out, "generated.png"), image.toPNG()),
      );
    const generatedBeforeClose = await js(
      `document.querySelector('.creation-editor-stage .article-paper').textContent`,
    );
    await click("关闭生成提示");
    assert.equal(await generationState(), undefined);
    assert.equal(
      await js(
        `document.querySelector('.creation-editor-stage .article-paper').textContent`,
      ),
      generatedBeforeClose,
    );
    assert(
      (
        await js(
          `document.querySelector('.creation-editor-stage .article-paper').textContent`,
        )
      ).includes("测试正文"),
      "generated body",
    );
    assert(
      await js(
        `!document.querySelector('.creation-navigation button[data-variant=default]')`,
      ),
      "no generation on second page",
    );
    await js(
      `document.querySelector('[aria-label="选择模板 极简墨黑"]').click()`,
    );
    await pause(150);
    assert(
      (
        await js(`document.querySelector('.creation-editor-stage').textContent`)
      ).includes("极简墨黑"),
      "live style selection",
    );
    await click("添加模块");
    await js(
      `[...document.querySelectorAll('[role=menuitem]')].find(el=>el.textContent==='正文')?.click()`,
    );
    await pause(120);
    await js(
      `(()=>{const el=document.querySelector('.creation-editor-stage [contenteditable=true]');el.textContent='编辑后的正文内容保留下来';el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await pause(100);
    await click("手机预览");
    assert(
      (
        await js(`document.querySelector('[role=dialog]').textContent`)
      ).includes("编辑后的正文内容保留下来"),
      "edited preview",
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await pause(200);
    await click("推送草稿");
    assert(
      (
        await js(`document.querySelector('[role=dialog]').textContent`)
      ).includes("推送到草稿箱"),
    );
    await click("取消");
    await click("返回素材");
    assert.equal(await step(), 0);
    assert.equal(
      await js(`document.querySelector('#creation-topic').value`),
      "测试职场成长主题",
    );
    assert(
      await js(`document.querySelector('.creation-editor-offscreen').inert`),
      "offscreen renderer inert",
    );
    await click("继续编辑");
    assert(
      (
        await js(`document.querySelector('.creation-editor-stage').textContent`)
      ).includes("编辑后的正文内容保留下来"),
      "editor retained",
    );
    await click("历史作品");
    await js(
      `(()=>{const item=[...document.querySelectorAll('[role=dialog] .ui-list-item')].find(el=>el.textContent.includes('验收文章'));item?.querySelector("[data-history-load]")?.click();})()`,
    );
    await pause(200);
    assert.equal(await step(), 1);
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await pause(200);
      for (const n of [0, 1]) {
        await js(
          `document.querySelectorAll('.creation-step-button')[${n}].click()`,
        );
        await pause(200);
        const result = await js(
          `(()=>{const main=document.querySelector('.app-content'),root=document.querySelector('.creation-workflow');return {width:innerWidth,overflow:main.scrollWidth-main.clientWidth,rootWidth:root.getBoundingClientRect().width,available:main.clientWidth-parseFloat(getComputedStyle(main).paddingLeft)-parseFloat(getComputedStyle(main).paddingRight),bottom:root.getBoundingClientRect().bottom,height:innerHeight};})()`,
        );
        assert(result.overflow <= 2, JSON.stringify(result));
        assert(
          Math.abs(result.rootWidth - result.available) < 3,
          "full width " + JSON.stringify(result),
        );
        assert(
          Math.abs(result.height - result.bottom - 20) < 4,
          "full height " + JSON.stringify(result),
        );
        await win
          .capturePage()
          .then((image) =>
            fs.writeFileSync(
              path.join(out, width + "-page-" + n + ".png"),
              image.toPNG(),
            ),
          );
      }
    }
    await click("返回素材");
    await click("贴图");
    await js(`window.__chatFailure={ok:false,error:'模拟贴图失败'};`);
    await click("重新生成");
    assert.equal(await generationState(), "running");
    assert((await notice()).includes("正在生成贴图文案"));
    await waitFor(
      `document.querySelector('[data-generation-state]')?.getAttribute('data-generation-state')==='error'`,
      "sticker error displayed",
    );
    assert((await notice()).includes("模拟贴图失败"));
    assert.equal(
      await generationState(),
      "error",
      "new result reopens a previously dismissed notice",
    );
    await js("window.__chatFailure=null");
    await click("重新尝试");
    await waitFor(
      `document.querySelector('.creation-step-stage').dataset.step==='1'`,
      "sticker generation advances",
      12000,
    );
    assert(
      (
        await js(
          `document.querySelector('.creation-template-panel').textContent`,
        )
      ).includes("首图模板"),
      "sticker styles on second page",
    );
    assert(
      (
        await js(`document.querySelector('.creation-editor-stage').textContent`)
      ).includes("贴图编辑器"),
      "sticker editor",
    );
    assert(
      await js(
        `document.querySelector('.creation-editor-stage .article-paper').getBoundingClientRect().width>0`,
      ),
      "render host retained",
    );
    assert.equal(await generationState(), "success");
    assert((await notice()).includes("贴图"));
    assert.deepEqual(errors, []);
    console.log(
      "PASS: two full-size pages; dismissible persistent validation/progress/error/success feedback, safe retry and article/sticker failure coverage; second-page live styles, editing, preview and publication; preserved state; article/sticker generation; three sizes",
    );
    cleanup();
    app.exit(0);
  } catch (error) {
    console.error(error, errors);
    console.log(await js("document.body.innerText"));
    await win
      .capturePage()
      .then((image) =>
        fs.writeFileSync(path.join(out, "failure.png"), image.toPNG()),
      );
    cleanup();
    app.exit(1);
  }
});
