const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const seed = `store.clearArticleHistory();for(let i=0;i<21;i++)store.saveArticleHistoryItem({id:'pending-'+i,title:'待发布作品 '+String(i).padStart(2,'0'),time:new Date(Date.UTC(2026,9,13,9,i)).toISOString(),tag:'测试',kind:i%2?'sticker':'article',templateId:'t1',blocks:[{id:'b-'+i,type:'p',text:i%3===0?'正文检索词':'常规内容'}],status:'待发布'});
store.saveArticleHistoryItem({id:'action',title:'待发布操作测试',time:'2026-10-13T12:00:00Z',tag:'测试',blocks:[{id:'a',type:'p',text:'发布测试正文'}],status:'待发布'});
store.saveArticleHistoryItem({id:'failed-retry',title:'失败重试内容',time:'2026-10-13T10:00:00Z',tag:'测试',blocks:[{id:'r',type:'p',text:'重试正文'}],status:'发布失败'});
store.saveDraft({id:'retry-draft',platform:'公众号',title:'失败重试内容',content:'重试正文',html:'<p>重试正文</p>',status:'待发布',createdAt:'2026-10-13T10:00:00Z'});
for(let i=0;i<17;i++)store.saveQueueItem({id:'queue-'+i,title:'已处理作品 '+String(i).padStart(2,'0'),platform:['公众号','头条号','百家号','小红书'][i%4],account:'账号'+i%4,status:['已发布','已存草稿','失败'][i%3],error:i%3===2?'需要重试的登录错误':undefined,createdAt:new Date(Date.UTC(2026,9,13,8,i)).toISOString()});
store.saveQueueItem({id:'failed-retry',title:'失败重试内容',platform:'头条号',account:'验收账号',status:'失败',error:'模拟失败信息',createdAt:'2026-10-13T10:00:00Z'});\n`;
let fixture = fs
  .readFileSync("scripts/ui-test/fixture.tsx.template", "utf8")
  .split("// Test-only export comparison")[0];
fixture = fixture
  .replace("const which =", seed + "const which =")
  .replace(
    'if (name === "platformPublish") return { ok: true };',
    `if(name==='wechatRefreshSession')return {ok:true,token:'mock-token',cookies:'mock-cookie'};if(name==='platformPublish'){if((window as any).__publishThrow)throw new Error('模拟网络异常');return (window as any).__publishFail?{ok:false,error:'模拟失败信息'}:{ok:true};}`,
  );
fs.writeFileSync("scripts/ui-test/.tmp-publish.tsx", fixture);
fs.writeFileSync(
  "scripts/ui-test/.tmp-publish.html",
  fs
    .readFileSync("scripts/ui-test/fixture.html.template", "utf8")
    .replace(".tmp-fixture.tsx", ".tmp-publish.tsx"),
);
const cleanup = () => {
  for (const ext of ["html", "tsx"])
    fs.rmSync("scripts/ui-test/.tmp-publish." + ext, { force: true });
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const out = path.resolve(".tmp-publish-check");
fs.mkdirSync(out, { recursive: true });
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      partition: "publish-check-" + Date.now(),
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
      `(()=>{const el=[...document.querySelectorAll('[role=dialog] [data-slot=dialog-footer] button'),...document.querySelectorAll('button')].find(e=>!e.closest('[inert]')&&e.getClientRects().length&&(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)}));if(!el)return null;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
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
  const input = async (value) => {
    await js(
      `(()=>{const el=document.querySelector('input[aria-label="搜索发布内容"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await pause(100);
  };
  const tab = async (value) => {
    await js(
      `document.querySelector('.publish-board [role=tab][id$="-trigger-${value}"]')?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))`,
    );
    await pause(200);
  };
  const select = async (placeholder, value, dialog = false) => {
    await js(
      `document.querySelector('${dialog ? "[role=dialog] " : ".publish-filters "}[role=combobox][aria-label="${placeholder}"]')?.click()`,
    );
    await pause(100);
    const found = await js(
      `(()=>{const el=[...document.querySelectorAll('[role=option]')].find(e=>e.textContent===${JSON.stringify(value)});el?.click();return !!el;})()`,
    );
    assert(found, "missing option " + value);
    await pause(150);
  };
  const footer = () =>
    js(`document.querySelector('.publish-pagination').textContent`);
  const count = () =>
    js(`document.querySelectorAll('.publish-table tbody tr').length`);
  try {
    await win.loadURL(
      "http://127.0.0.1:5173/scripts/ui-test/.tmp-publish.html",
    );
    await pause(1600);
    await click("内容发布");
    assert.equal(await count(), 10);
    assert((await footer()).includes("共 22 条"));
    await click("下一页");
    assert((await footer()).includes("2 / 3"));
    await input("正文检索词");
    assert.equal(await count(), 7);
    assert((await footer()).includes("1 / 1"));
    await input("找不到的内容");
    assert((await js("document.body.innerText")).includes("未找到匹配"));
    await click("清除筛选");
    assert.equal(await count(), 10);
    await select("全部类型", "贴图");
    assert.equal(await count(), 10);
    assert((await footer()).includes("共 10 条"));
    await click("重置");
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await pause(200);
      assert(
        await js(
          `document.querySelector('.app-content').scrollWidth-document.querySelector('.app-content').clientWidth<=2`,
        ),
        "pending no overflow",
      );
      assert(
        await js(
          `document.querySelector('.publish-pagination').getBoundingClientRect().bottom<=innerHeight`,
        ),
        "pagination remains visible",
      );
      await win
        .capturePage()
        .then((image) =>
          fs.writeFileSync(
            path.join(out, width + "-pending.png"),
            image.toPNG(),
          ),
        );
    }
    await input("待发布作品 20");
    await click("删除 待发布作品 20");
    await click("取消");
    assert.equal(await count(), 1);
    await click("删除 待发布作品 20");
    await js(
      `document.querySelector('[role=alertdialog] button[data-variant=destructive]').click()`,
    );
    await pause(200);
    assert.equal(await count(), 0);
    await click("清除筛选");
    assert((await footer()).includes("共 21 条"));
    await tab("history");
    assert((await footer()).includes("共 18 条"));
    await input("登录错误");
    assert.equal(await count(), 5);
    await click("重置");
    await select("全部平台", "小红书");
    assert(
      (
        await js(`document.querySelector('.publish-table-area').textContent`)
      ).includes("小红书"),
    );
    await select("全部账号", "账号3");
    await select("全部状态", "已发布");
    assert((await footer()).includes("共 2 条"));
    await click("重置");
    await input("失败重试内容");
    await click("详情");
    assert(
      (
        await js(`document.querySelector('[role=dialog]').textContent`)
      ).includes("模拟失败信息"),
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await pause(200);
    await click("重试");
    assert(
      (
        await js(`document.querySelector('[role=dialog]').textContent`)
      ).includes("头条号"),
      "retry preselects platform",
    );
    await js("window.__publishThrow=true");
    await click("存草稿并发布");
    await pause(300);
    assert(
      (
        await js(`document.querySelector('.publish-table-area').textContent`)
      ).includes("模拟网络异常"),
    );
    await click("重试");
    await js("window.__publishThrow=false");
    await click("存草稿并发布");
    await pause(300);
    assert(
      (
        await js(`document.querySelector('.publish-table-area').textContent`)
      ).includes("已发布"),
    );
    assert.equal(
      await js(
        `(async()=>(await import('/src/data/localStore.ts')).loadArticleHistory().find(h=>h.id==='failed-retry').status)()`,
      ),
      "已发布",
    );
    await input("");
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await pause(200);
      assert(
        await js(
          `document.querySelector('.app-content').scrollWidth-document.querySelector('.app-content').clientWidth<=2`,
        ),
        "history no overflow",
      );
      await win
        .capturePage()
        .then((image) =>
          fs.writeFileSync(
            path.join(out, width + "-history.png"),
            image.toPNG(),
          ),
        );
    }
    await tab("pending");
    await input("待发布操作测试");
    await click("平台发布");
    await select("请选择", "头条号", true);
    await select("选择账号", "头条号 · 验收账号", true);
    await click("仅保存到草稿箱");
    await click("保存草稿");
    await pause(300);
    assert(
      (await js("document.body.innerText")).includes("未找到匹配"),
      "success removes pending",
    );
    assert.equal(
      await js(
        `(async()=>(await import('/src/data/localStore.ts')).loadArticleHistory().find(h=>h.id==='action').status)()`,
      ),
      "已存草稿",
    );
    await tab("history");
    await input("待发布操作测试");
    assert.equal(await count(), 1);
    assert(
      (
        await js(`document.querySelector('.publish-table-area').textContent`)
      ).includes("已存草稿"),
    );
    await js(`(async()=>{
      const store=await import('/src/data/localStore.ts');
      store.saveAccount({id:'wechat-draft-account',platform:'公众号',name:'草稿验收账号',authed:true,cookie:'mock-cookie',token:'mock-token'});
      store.saveArticleHistoryItem({id:'wechat-only',title:'公众号草稿限制验证',time:new Date().toISOString(),templateId:'t1',blocks:[{id:'w',type:'p',text:'草稿正文'}],status:'待发布'});
      const oldTask={id:'legacy-wechat',platform:'公众号',publishMode:'publish',enabled:false,nextRunAt:'2999-01-01T00:00:00Z',log:[]};
      localStorage.setItem('wangaohui:hostTasks',JSON.stringify([oldTask]));
      if(store.listHostTasks()[0].publishMode!=='draft')throw Error('old WeChat tasks must read as draft-only');
      store.saveHostTasks([oldTask]);
      if(JSON.parse(localStorage.getItem('wangaohui:hostTasks'))[0].publishMode!=='draft')throw Error('WeChat task writes must normalize old mode');
      const policy=await import('/src/utils/publishPolicy.ts');
      if(!policy.saveToDraftOnly('公众号','publish')||!policy.saveToDraftOnly('wechat','publish'))throw Error('legacy caller must remain draft-only');
      if(policy.saveToDraftOnly('头条号','publish'))throw Error('other platform behavior changed');
    })()`);
    await tab("pending");
    await click("刷新发布列表");
    await input("公众号草稿限制验证");
    await click("平台发布");
    assert(!(await js(`document.querySelector('[role=dialog]').textContent`)).includes("存草稿并发布"), "WeChat has no direct-publication choice");
    await select("选择账号", "公众号 · 草稿验收账号", true);
    await click("推送到草稿箱");
    await pause(250);
    assert.equal(await js(`window.__calls.filter(c=>c.name==='platformPublish').at(-1).args[0].saveDraftOnly`), true);
    assert.equal(await js(`window.__calls.filter(c=>c.name==='platformPublish').at(-1).args[0].platform`), "wechat");
    assert.equal(await js(`(async()=>(await import('/src/data/localStore.ts')).loadArticleHistory().find(h=>h.id==='wechat-only').status)()`), "已存草稿");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: pending/history search, type/platform/account/status filters, pagination and reset, delete confirmation, details, retry exception/recovery, draft state synchronization, three desktop sizes",
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
