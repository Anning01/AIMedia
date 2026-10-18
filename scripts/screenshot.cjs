const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'dist/index.html';
const outDir = process.argv[3] || process.cwd();

const PAGES = ['资源管理', '账号中心', '创作工坊', '内容发布', '自动托管', 'AI 配置', '使用帮助'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  if (target.startsWith('http')) {
    await win.loadURL(target);
  } else {
    await win.loadFile(target);
  }
  await sleep(2200);

  for (const page of PAGES) {
    try {
      await win.webContents.executeJavaScript(`
        (() => {
          const items = [...document.querySelectorAll('nav[aria-label="主导航"] button')];
          const el = items.find((i) => i.textContent.includes(${JSON.stringify(page)}));
          if (el) el.click();
          return !!el;
        })()
      `);
      await sleep(900);
      const img = await win.webContents.capturePage();
      const name = `${page}.png`;
      fs.writeFileSync(path.join(outDir, name), img.toPNG());
      console.log('saved:', name);
    } catch (err) {
      console.log('failed:', page, err.message);
    }
  }

  app.exit(0);
}

app.whenReady().then(run);
