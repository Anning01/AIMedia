const { app, BrowserWindow, screen, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { registerIpc } = require('./ipc.cjs');
const { initAutoUpdater } = require('./autoUpdater.cjs');
const images = require('./images.cjs');

registerIpc();

let tray = null;
let mainWindow = null;

app.isQuitting = false;

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('万稿汇');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开万稿汇', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const preferred = { width: 1600, height: 1000 };
  // macOS 用系统原生红黄绿灯（hiddenInset），Windows / Linux 保留自绘标题栏。
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: Math.min(preferred.width, workArea.width),
    height: Math.min(preferred.height, workArea.height),
    minWidth: 960,
    minHeight: 700,
    title: '',
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fa',
    icon: path.join(__dirname, 'icon.png'),
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 16, y: 10 },
        }
      : { frame: false }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow = win;

  // 右上角 X：隐藏到系统托盘，不退出；退出只能通过托盘右键「退出」
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // 屏幕小于首选尺寸时直接最大化，避免内容显示不全
  if (workArea.width < preferred.width || workArea.height < preferred.height) {
    win.maximize();
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  images.init();
  createWindow();
  createTray();
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    initAutoUpdater(win, {
      getReleaseUrl: () => 'https://github.com/Anning01/AIMedia/releases',
    });
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // 关闭窗口后应用继续驻留系统托盘，由托盘「退出」结束进程
  app.isQuitting = true;
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
