const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const vm = require("vm");
const ts = require("typescript");
const memory = new Map();
let fail = false;
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => {
    if (fail) throw Error("storage full");
    memory.set(key, value);
  },
};
const exported = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/data/localStore.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  { exports: exported, localStorage: storage },
);
for (let index = 0; index < 30; index++)
  exported.saveArticleHistoryItem({
    id: "unit-" + index,
    title: "标题" + index,
    time: "2026-10-13T09:00:00",
    tag: "",
    blocks: [],
    kind: index % 2 ? "sticker" : "article",
  });
assert.equal(exported.loadArticleHistory().length, 30, "no 12-record cap");
exported.saveArticleHistoryItem({
  id: "unit-0",
  title: "更新后的标题",
  time: "2026-10-13T09:00:00",
  tag: "",
  blocks: [],
});
assert.equal(exported.loadArticleHistory().length, 30, "same id updated");
fail = true;
assert.throws(() =>
  exported.saveArticleHistoryItem({ id: "too-large", blocks: [] }),
);
fail = false;
assert.equal(
  exported.loadArticleHistory().length,
  30,
  "failed storage preserves history",
);
assert.equal(exported.clearArticleHistory().length, 0);
const seed = `store.clearArticleHistory();for(let i=0;i<26;i++)store.saveArticleHistoryItem({id:'history-test-'+i,title:'历史作品 '+String(i).padStart(2,'0'),time:new Date(Date.UTC(2026,9,13,9,i)).toISOString(),tag:'测试',kind:i%2?'sticker':'article',templateId:'t1',blocks:[{id:'title-'+i,type:'title',text:'历史作品 '+i},{id:'body-'+i,type:'p',text:(i%4===0?'正文检索词':'普通内容')+' '+i}],status:'待发布'});\n`;
const source = fs
  .readFileSync("scripts/ui-test/fixture.tsx.template", "utf8")
  .split("// Test-only export comparison")[0]
  .replace("const which =", seed + "const which =");
fs.writeFileSync("scripts/ui-test/.tmp-history.tsx", source);
fs.writeFileSync(
  "scripts/ui-test/.tmp-history.html",
  fs
    .readFileSync("scripts/ui-test/fixture.html.template", "utf8")
    .replace(".tmp-fixture.tsx", ".tmp-history.tsx"),
);
const cleanup = () => {
  for (const ext of ["html", "tsx"])
    fs.rmSync("scripts/ui-test/.tmp-history." + ext, { force: true });
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const out = path.resolve(".tmp-history-check");
fs.mkdirSync(out, { recursive: true });
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      partition: "history-check-" + Date.now(),
      backgroundThrottling: false,
    },
  });
  const errors = [];
  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 2 && !message.includes("Electron Security Warning"))
      errors.push(message);
  });
  const js = (source) => win.webContents.executeJavaScript(source);
  const click = async (text) => {
    const point = await js(
      `(()=>{const el=[...document.querySelectorAll('button')].find(e=>!e.closest('[inert]')&&e.getClientRects().length&&(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)}));if(!el)return null;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
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
  const search = async (text) => {
    await js(
      `(()=>{const el=document.querySelector('input[aria-label="搜索历史作品"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await pause(150);
  };
  const count = () =>
    js(`document.querySelectorAll('.history-work-row').length`);
  const footer = () =>
    js(`document.querySelector('.history-pagination').textContent`);
  try {
    await win.loadURL(
      "http://127.0.0.1:5173/scripts/ui-test/.tmp-history.html",
    );
    await pause(1400);
    await click("创作工坊");
    await click("历史作品");
    assert.equal(await count(), 10);
    assert((await footer()).includes("共 26 篇"));
    const first = await js(
      `document.querySelector('.history-work-list').textContent`,
    );
    assert(
      first.includes("历史作品 25") && first.includes("历史作品 24"),
      "article and sticker combined, newest first",
    );
    await click("下一页");
    assert((await footer()).includes("2 / 3"));
    await click("下一页");
    assert.equal(await count(), 6);
    assert((await footer()).includes("3 / 3"));
    await search("  历史作品 25  ");
    assert.equal(await count(), 1);
    assert((await footer()).includes("1 / 1"), "search resets page");
    await search("正文检索词");
    assert.equal(await count(), 7, "search body");
    await search("不存在的关键词");
    assert.equal(await count(), 0);
    assert(
      (
        await js(`document.querySelector('.history-work-list').textContent`)
      ).includes("未找到匹配"),
    );
    await search("");
    assert.equal(await count(), 10);
    assert((await footer()).includes("1 / 3"));
    for (const [width, height] of [
      [1024, 768],
      [1440, 900],
    ]) {
      win.setSize(width, height);
      await pause(150);
      assert(
        await js(
          `(()=>{const r=document.querySelector('[role=dialog]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()`,
        ),
        "dialog fits",
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
    await click("下一页");
    await click("下一页");
    for (const id of [5, 4, 3, 2, 1, 0])
      await click("删除 历史作品 " + String(id).padStart(2, "0"));
    assert((await footer()).includes("2 / 2"), "deletion clamps last page");
    assert.equal(await count(), 10);
    await search("历史作品 25");
    await click("载入 历史作品 25");
    assert(
      await js(`!document.querySelector('[role=dialog]')`),
      "load closes dialog",
    );
    assert(
      (
        await js(`document.querySelector('.creation-editor-stage').textContent`)
      ).includes("贴图编辑器"),
      "load switches content type",
    );
    await click("历史作品");
    await search("");
    assert((await footer()).includes("共 20 篇"), "reopen shows all types");
    await click("清空全部");
    await click("取消");
    assert.equal(await count(), 10, "cancel keeps records");
    await search("历史作品 25");
    await click("清空全部");
    await js(
      `document.querySelector('[role=alertdialog] button[data-variant=destructive]')?.click()`,
    );
    await pause(250);
    assert.equal(await count(), 0);
    assert((await footer()).includes("共 0 篇"));
    assert.equal(
      await js(
        `(async()=>(await import('/src/data/localStore.ts')).loadArticleHistory().length)()`,
      ),
      0,
      "clear all not only search results",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: complete mixed history, 10 per page, title/body search, reset/clamp, cross-type load, confirmed full clear, persistence beyond 12, storage failure preservation",
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
