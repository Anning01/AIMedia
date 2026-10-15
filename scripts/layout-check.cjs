const { app, BrowserWindow } = require('electron');

const target = process.argv[2] || 'dist/index.html';
const PAGES = ['资源管理', '账号中心', '创作工坊', '内容发布', '自动托管', 'AI 配置', '使用帮助'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });

  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) errors.push(message);
  });

  if (target.startsWith('http')) {
    await win.loadURL(target);
  } else {
    await win.loadFile(target);
  }
  await sleep(2200);

  for (const page of PAGES) {
    await win.webContents.executeJavaScript(`
      (() => {
        const items = [...document.querySelectorAll('nav[aria-label="主导航"] button')];
        const el = items.find((i) => i.textContent.includes(${JSON.stringify(page)}));
        if (el) el.click();
        return !!el;
      })()
    `);
    await sleep(700);
    const result = await win.webContents.executeJavaScript(`
      (() => {
        const vw = window.innerWidth;
        const main = document.querySelector('.app-content');
        const overflows = [...document.querySelectorAll('*')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > vw + 2;
          })
          .slice(0, 5)
          .map((el) => el.className || el.tagName);
        return {
          header: document.querySelector('[data-slot="page-title"]')?.textContent ?? '',
          docScrollW: document.documentElement.scrollWidth,
          vw,
          mainOverflowX: main ? main.scrollWidth - main.clientWidth : 0,
          overflows,
          contentHeight: main ? main.scrollHeight : 0,
          viewportHeight: window.innerHeight,
        };
      })()
    `);
    console.log(JSON.stringify({ page, ...result }));
  }

  await sleep(300);
  console.log('console errors:', errors.length ? errors : 'none');
  app.exit(0);
}

app.whenReady().then(run);
