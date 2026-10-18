const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const [svgPath, outPng, w, h] = process.argv.slice(2);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: Number(w),
    height: Number(h),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  await win.loadFile(svgPath);
  await sleep(700);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(outPng, img.toPNG());
  console.log('saved:', outPng);
  app.exit(0);
});
