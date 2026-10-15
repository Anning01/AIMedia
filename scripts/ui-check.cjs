const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const baselineFiles = ["articleHtml", "renderDesignPng"];
for (const name of baselineFiles) {
  let source = fs.readFileSync(path.resolve('scripts/ui-test/baseline-'+name+'.ts.template'),'utf8');
  source = source
    .replaceAll("'../data/", "'../../src/data/")
    .replaceAll("'./imageStore'", "'../../src/utils/imageStore'");
  fs.writeFileSync(
    path.resolve("scripts/ui-test/.baseline-" + name + ".ts"),
    source,
  );
}
for (const ext of ["html", "tsx"])
  fs.copyFileSync(
    path.resolve("scripts/ui-test/fixture." + ext + ".template"),
    path.resolve("scripts/ui-test/.tmp-fixture." + ext),
  );
const cleanup = () => {
  for (const name of baselineFiles)
    fs.rmSync(path.resolve("scripts/ui-test/.baseline-" + name + ".ts"), {
      force: true,
    });
  for (const ext of ["html", "tsx"])
    fs.rmSync(path.resolve("scripts/ui-test/.tmp-fixture." + ext), {
      force: true,
    });
};
const URL = "http://127.0.0.1:5173/scripts/ui-test/.tmp-fixture.html";
const pages = [
  "资源管理",
  "账号中心",
  "创作工坊",
  "内容发布",
  "自动托管",
  "AI 配置",
  "使用帮助",
];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const out = path.resolve(".tmp-ui-check/screenshots");
fs.mkdirSync(out, { recursive: true });
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      partition: "ui-check-" + Date.now(),
    },
  });
  const errors = [];
  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 2) errors.push(message);
  });
  const js = (s) => win.webContents.executeJavaScript(s);
  // 点击前确认目标没被浮层遮挡（对话框/下拉的进出场动画会让旧浮层多停留一瞬）。
  // 按钮既可按可见文字匹配，也可按 aria-label 匹配（图标按钮）。
  const hitPoint = (text) =>
    js(
      `(()=>{const target=${JSON.stringify(text)};const el=[...document.querySelectorAll('button')].find(e=>!e.closest('[inert]') && e.getClientRects().length>0 && (e.textContent.trim()===target || e.getAttribute('aria-label')===target));if(!el)return null;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();const x=Math.round(r.x+r.width/2),y=Math.round(r.y+r.height/2);const top=document.elementFromPoint(x,y);return {x,y,clear:!!top&&(top===el||el.contains(top))};})()`,
    );
  const click = async (text, settle = 220) => {
    let point = null;
    let found = false;
    for (let attempt = 0; attempt < 12 && !point; attempt += 1) {
      const hit = await hitPoint(text);
      if (!hit) break;
      found = true;
      if (hit.clear) point = hit;
      else await pause(60);
    }
    assert(found, "missing button " + text);
    assert(point, "button blocked by transient overlay: " + text);
    win.webContents.sendInputEvent({ type: "mouseMove", ...point });
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
    await pause(settle);
  };

  try {
    await win.loadURL(URL);
    await pause(1200);
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await pause(150);
      for (const page of pages) {
        await click(page);
        const result = await js(
          `(()=>{const main=document.querySelector('.app-content');return {page:document.querySelector('[data-slot="page-title"]')?.textContent,overflow:main.scrollWidth-main.clientWidth,body:document.body.scrollWidth-window.innerWidth};})()`,
        );
        assert.equal(result.page, page);
        assert(result.overflow <= 2, JSON.stringify({ width, ...result }));
        assert(result.body <= 2, JSON.stringify({ width, ...result }));
        await win
          .capturePage()
          .then((i) =>
            fs.writeFileSync(
              path.join(out, width + "-" + pages.indexOf(page) + ".png"),
              i.toPNG(),
            ),
          );
        console.log(JSON.stringify({ width, height, ...result }));
      }
    }
    // 帮助页：单条展开、键盘导航及页间状态保留。
    await click("使用帮助");
    assert.equal(await js(`document.querySelectorAll('[data-slot="accordion-trigger"]').length`), 8);
    assert.equal(await js(`document.querySelectorAll('[data-slot="accordion-trigger"][aria-expanded="true"]').length`), 0);
    await click("第一次使用，从哪里开始？");
    assert.equal(await js(`document.querySelectorAll('[data-slot="accordion-trigger"][aria-expanded="true"]').length`), 1);
    assert(await js(`document.querySelector('[data-slot="accordion-content"][data-state="open"]').textContent.includes('先配置 AI')`));
    await click("AI 怎么配置？");
    assert.equal(await js(`document.querySelectorAll('[data-slot="accordion-trigger"][aria-expanded="true"]').length`), 1);
    await js(`document.querySelectorAll('[data-slot="accordion-trigger"]')[1].focus()`);
    for (const key of ['Up', 'Return']) {
      win.webContents.sendInputEvent({type:'keyDown',keyCode:key});
      if (key === 'Return') win.webContents.sendInputEvent({type:'char',keyCode:'\r'});
      win.webContents.sendInputEvent({type:'keyUp',keyCode:key});
      await pause(200);
    }
    assert.equal(await js(`document.activeElement.textContent.trim()`), '第一次使用，从哪里开始？');
    assert(await js(`document.activeElement.getAttribute('aria-expanded')==='true'`));
    await click("去配置 AI");
    assert.equal(await js(`document.querySelector('[data-slot="page-title"]').textContent`), 'AI 配置');
    await click("使用帮助");
    assert(await js(`document.querySelector('[data-slot="accordion-trigger"]').getAttribute('aria-expanded')==='true'`), 'FAQ state retained after navigation');
    await click("第一次使用，从哪里开始？");
    assert.equal(await js(`document.querySelectorAll('[data-slot="accordion-trigger"][aria-expanded="true"]').length`), 0);
    await win.capturePage().then(i=>fs.writeFileSync(path.join(out,'help-closed.png'),i.toPNG()));
    await click("「去 AI」怎么用，会收费吗？");
    assert(await js(`document.querySelector('[data-slot="accordion-content"][data-state="open"]').textContent.includes('费用按器灵当前规则结算')`));
    await win.capturePage().then(i=>fs.writeFileSync(path.join(out,'help-open.png'),i.toPNG()));
    console.log('PASS: help Q&A accordion, exclusive disclosure, keyboard navigation, collapse, page links and state preservation');
    // 资源管理：标签栏滑动指示器 + 面板切换过渡动画
    await click("资源管理");
    const indicatorAtHot = await js(
      `document.querySelector('[data-slot="tabs-indicator"]')?.style.transform || ""`,
    );
    assert(indicatorAtHot, "tab indicator rendered");
    await click("微信爆文");
    const indicatorAtWechat = await js(
      `document.querySelector('[data-slot="tabs-indicator"]')?.style.transform || ""`,
    );
    assert(
      indicatorAtWechat && indicatorAtWechat !== indicatorAtHot,
      "tab indicator slides between triggers",
    );
    // 过渡中途取样：旧面板正在淡出、新面板正在滑入。
    await click("图片素材", 60);
    await pause(40);
    const transition = await js(
      `(()=>{const panels=[...document.querySelectorAll('[role=tabpanel]')];const active=[...document.querySelectorAll('[data-slot="tabs-trigger"]')].find(t=>t.dataset.state==='active'&&t.closest('.segmented-tabs'));return {entering:panels.some(p=>p.querySelector('.tab-panel-enter')),leaving:panels.some(p=>p.querySelector('.tab-panel-leave')),hidden:panels.filter(p=>p.hidden).length,bg:active?getComputedStyle(active).backgroundColor:null};})()`,
    );
    assert(transition.entering, "incoming tab panel animates in");
    assert(transition.leaving, "outgoing tab panel animates out");
    assert(
      transition.hidden >= 1,
      "inactive tab panels stay mounted but hidden",
    );
    assert(
      transition.bg === "rgba(0, 0, 0, 0)",
      "active tab stays transparent behind the sliding indicator",
    );
    await pause(400);
    await click("今日热点");
    await click("自动托管");
    await click("新建任务");
    await click("创建任务");
    assert(
      await js(`document.querySelectorAll('.ui-field-error').length>0`),
      "required validation",
    );
    assert(
      await js(
        `document.activeElement.id===document.querySelector('.ui-field input').id`,
      ),
      "first invalid field focus",
    );
    await click("取消");
    await click("新建任务");
    await js(
      `(()=>{const el=document.querySelector('[role=dialog] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'验收托管任务');el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await js(
      `document.querySelector('[role=dialog] [role=combobox][aria-label="平台"]')?.click()`,
    );
    await pause(100);
    await js(
      `(()=>{const el=[...document.querySelectorAll('[role=option]')].find(e=>e.textContent==='头条号');el?.click();})()`,
    );
    await pause(100);
    await js(
      `document.querySelector('[role=dialog] [role=combobox][aria-label="选择账号"]')?.click()`,
    );
    await pause(100);
    await js(
      `(()=>{const el=[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.includes('验收账号'));el?.click();})()`,
    );
    await pause(100);
    await click("创建任务");
    assert(
      (
        await js(
          `(async()=> (await import('/src/data/localStore.ts')).listHostTasks())()`,
        )
      ).some((t) => t.name === "验收托管任务" && t.perRunCount === 1),
      "task saved with defaults",
    );
    await js(
      `document.querySelector('button[aria-label="编辑任务"]')?.click()`,
    );
    await pause(150);
    assert(
      await js(
        `document.querySelector('[role=dialog] input').value==='验收托管任务'`,
      ),
      "task edit restored values",
    );
    await click("保存修改");
    await click("账号中心");
    await click("头条号");
    assert(
      (await js("document.body.innerText")).includes("验收账号"),
      "account list",
    );
    await click("内容发布");
    await click("平台发布");
    await js(
      `document.querySelector('[role="dialog"] [role="combobox"]').click()`,
    );
    await pause(100);
    await js(
      `document.querySelector('[role="option"][data-state="unchecked"]')?.click()`,
    );
    await pause(100);
    // Select the seeded platform and account through the same controls as the user.
    await js(
      `(()=>{const combos=document.querySelectorAll('[role="dialog"] [role="combobox"]');combos[0]?.click();})()`,
    );
    await pause(100);
    await js(
      `(()=>{const el=[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.includes('头条号'));el?.click();})()`,
    );
    await pause(100);
    await js(
      `document.querySelectorAll('[role="dialog"] [role="combobox"]')[1]?.click()`,
    );
    await pause(100);
    await js(
      `(()=>{const el=[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.includes('验收账号'));el?.click();})()`,
    );
    await pause(100);
    await click("仅保存到草稿箱");
    await click("保存草稿");
    await pause(300);
    assert(
      await js(`window.__calls.some(c=>c.name==='platformPublish')`),
      "mock publish invoked",
    );
    await click("创作工坊");
    const inputSelector = ".app-content textarea";
    await js(
      `(()=>{const el=document.querySelector(${JSON.stringify(inputSelector)});const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(el,'验收测试素材');el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await click("资源管理");
    await click("创作工坊");
    assert.equal(
      await js(`document.querySelector('.app-content textarea').value`),
      "验收测试素材",
      "preserved editor state",
    );
    await click("历史作品");
    await js(
      `(()=>{const el=[...document.querySelectorAll('[role=dialog] .ui-list-item')].find(e=>e.textContent.includes('验收文章'));el?.querySelector('[data-history-load]')?.click();})()`,
    );
    await pause(200);
    await click("主题生成器");
    assert(
      await js(
        `document.querySelector('[role=dialog]')?.getBoundingClientRect().right<=innerWidth`,
      ),
      "drawer bounds",
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await pause(250);
    assert(
      await js(`!document.querySelector('[role=dialog]')`),
      "Escape closes drawer",
    );
    await click("资源管理");
    await click("一键生成");
    assert.equal(
      await js(
        `document.querySelector('[data-slot="page-title"]').textContent`,
      ),
      "创作工坊",
    );
    assert(
      (
        await js(`document.querySelector('.app-content textarea').value`)
      ).includes("测试素材标题"),
      "resource to article",
    );
    await click("资源管理");
    await click("图片素材");
    await pause(400);
    await js(
      `document.querySelector('[data-testid="remote-image"] img')?.click()`,
    );
    await pause(150);
    await click("下一张");
    assert(
      (
        await js(`document.querySelector('[role=dialog]').textContent`)
      ).includes("2 / 2"),
      "group image navigation",
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await pause(180);
    for (const page of ["note", "image"]) {
      for (const [width, height] of [
        [1024, 768],
        [1280, 800],
        [1440, 900],
      ]) {
        win.setSize(width, height);
        await win.loadURL(URL + "?page=" + page);
        for(let attempt=0;attempt<80;attempt++){
          if(await js(`document.getElementById('root').textContent.length>20`))break;
          await pause(100);
        }
        const result = await js(
          `({overflow:document.documentElement.scrollWidth-innerWidth,content:document.getElementById('root').textContent.length})`,
        );
        assert(result.content > 20, page + " rendered");
        assert(result.overflow <= 2, page + " overflow");
        await win
          .capturePage()
          .then((i) =>
            fs.writeFileSync(
              path.join(out, page + "-" + width + ".png"),
              i.toPNG(),
            ),
          );
      }
    }
    assert(
      !errors.some(
        (e) =>
          e.includes("Uncaught") ||
          e.includes("Maximum update") ||
          e.includes("Error:"),
      ),
      errors.join("\n"),
    );
    await win.loadURL(URL + "?loggedOut=1");
    await pause(500);
    assert((await js("document.body.innerText")).includes("资源管理"), "open without activation");
    assert(!(await js("document.body.innerText")).includes("授权码"), "no license gate");
    console.log("Export checks:", await js("window.__runExportChecks()"));
    console.log(
      "PASS: nine pages, three sizes, task validation, editor persistence, resource handoff",
    );
    const unexpected = errors.filter(
      (e) => !e.includes("Electron Security Warning"),
    );
    assert.deepEqual(unexpected, [], "unexpected console diagnostics");
    console.log(
      "PASS: mock publishing, independent AI configuration, grouped image preview, drawer keyboard dismissal, export compatibility",
    );
    cleanup();
    app.exit(0);
  } catch (e) {
    console.error(e, errors);
    console.log(await js("document.body.innerText"));
    await win
      .capturePage()
      .then((i) => fs.writeFileSync(path.join(out, "failure.png"), i.toPNG()));
    cleanup();
    app.exit(1);
  }
});
