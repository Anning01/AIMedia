const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const seed = `const tasks=[['running','运行任务',true,'运行中'],['paused','暂停任务',false,'已暂停'],['executing','执行任务',true,'执行中'],['completed','完成任务',false,'已完成']].map(([id,name,enabled,status])=>({id,name,enabled,status,accountId:'ui-test-account',platform:'头条号',contentType:'article',sourceType:'material',sourceKey:'',templateId:'t1',imageSource:'auto',imageCount:1,perRunCount:1,frequency:'daily',startTime:'09:00',intervalMinutes:1440,publishMode:'draft',retry:true,nextRunAt:'2999-10-14T09:00:00Z',log:[],createdAt:'2026-10-13T09:00:00Z'}));store.saveHostTasks(tasks as any);\n`;
const fixture = fs
  .readFileSync("scripts/ui-test/fixture.tsx.template", "utf8")
  .split("// Test-only export comparison")[0]
  .replace("const which =", seed + "const which =");
fs.writeFileSync("scripts/ui-test/.tmp-task-controls.tsx", fixture);
fs.writeFileSync(
  "scripts/ui-test/.tmp-task-controls.html",
  fs
    .readFileSync("scripts/ui-test/fixture.html.template", "utf8")
    .replace(".tmp-fixture.tsx", ".tmp-task-controls.tsx"),
);
const cleanup = () => {
  for (const ext of ["html", "tsx"])
    fs.rmSync("scripts/ui-test/.tmp-task-controls." + ext, { force: true });
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const out = path.resolve(".tmp-task-controls-check");
fs.mkdirSync(out, { recursive: true });
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      partition: "task-controls-" + Date.now(),
      backgroundThrottling: false,
    },
  });
  const errors = [];
  win.webContents.on("console-message", (_e, level, text) => {
    if (level >= 2 && !text.includes("Electron Security Warning"))
      errors.push(text);
  });
  const js = (s) => win.webContents.executeJavaScript(s);
  const inspect = (id) =>
    js(
      `(()=>{const button=document.querySelector('[data-task-control="${id}"]');const row=button.closest('tr');const badge=row.querySelector('[data-task-state]');return {action:button.textContent.trim(),disabled:button.disabled,state:badge.dataset.taskState,color:getComputedStyle(badge).backgroundColor,controls:row.querySelectorAll('[data-task-control]').length,buttons:row.querySelectorAll('button').length,text:row.textContent};})()`,
    );
  const toggle = async (id) => {
    await js(`document.querySelector('[data-task-control="${id}"]').click()`);
    await pause(150);
  };
  try {
    await win.loadURL(
      "http://127.0.0.1:5173/scripts/ui-test/.tmp-task-controls.html",
    );
    await pause(1500);
    await js(
      `document.querySelector('.ui-nav')?.querySelector('button')?.click()`,
    );
    await js(
      `(()=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='自动托管');button.click();})()`,
    );
    await pause(200);
    const running = await inspect("running"),
      paused = await inspect("paused"),
      executing = await inspect("executing");
    assert.equal(running.action, "暂停");
    assert.equal(paused.action, "启动");
    assert.equal(executing.action, "执行中");
    assert(executing.disabled);
    assert((await inspect("completed")).disabled);
    assert.notEqual(
      running.color,
      paused.color,
      "running/paused visible colors",
    );
    assert.notEqual(executing.color, running.color);
    assert(paused.text.includes("已暂停调度"));
    for (const id of ["running", "paused", "executing", "completed"]) {
      const row = await inspect(id);
      assert.equal(row.controls, 1);
      assert.equal(row.buttons, 4, "one task toggle plus edit/log/delete");
    }
    assert(
      await js(`!document.querySelector('button[title="立即执行"]')`),
      "duplicate play removed",
    );
    await win
      .capturePage()
      .then((image) =>
        fs.writeFileSync(path.join(out, "task-states.png"), image.toPNG()),
      );
    await toggle("paused");
    assert.equal((await inspect("paused")).state, "running");
    assert.equal((await inspect("paused")).action, "暂停");
    let stored = await js(
      `(async()=>(await import('/src/data/localStore.ts')).listHostTasks())()`,
    );
    assert(stored.find((t) => t.id === "paused").enabled);
    assert.equal(
      stored.find((t) => t.id === "paused").nextRunAt,
      "2999-10-14T09:00:00Z",
      "start keeps schedule",
    );
    await toggle("paused");
    assert.equal((await inspect("paused")).state, "paused");
    stored = await js(
      `(async()=>(await import('/src/data/localStore.ts')).listHostTasks())()`,
    );
    assert(!stored.find((t) => t.id === "paused").enabled);
    assert.equal(stored.find((t) => t.id === "paused").log.length, 2);
    await toggle("executing");
    assert.equal((await inspect("executing")).state, "executing");
    assert(
      !(await js(
        `window.__calls.some(c=>c.name==='platformPublish'||c.name==='generateArticle')`,
      )),
      "toggle does not issue manual publish",
    );
    await toggle("running");
    assert.equal((await inspect("running")).state, "paused");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: distinct running/paused/executing badges; one start/pause control; executing disabled; schedule and persisted logs preserved; no remote execution",
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
