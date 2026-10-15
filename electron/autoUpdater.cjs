const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const DEFAULT_RELEASE_URL = 'https://github.com/Anning01/AIMedia/releases';
const STARTUP_CHECK_DELAY_MS = 30 * 1000;
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MAX_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const INSTALL_RETRY_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20 * 1000;

let initialized = false;
let checking = false;
let downloadedInfo = null;
let installTimer = null;
let checkTimer = null;

function updateFeedUrlFromReleaseUrl(releaseUrl) {
  const raw = String(releaseUrl || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname.toLowerCase() !== 'gitee.com') return raw;
    if (/\/releases\/?$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/releases\/?$/i, '/releases/download/latest');
    } else {
      url.pathname = url.pathname.replace('/releases/tag/', '/releases/download/');
    }
    return url.toString();
  } catch {
    return /\/releases\/?$/i.test(raw)
      ? raw.replace(/\/releases\/?$/i, '/releases/download/latest')
      : raw.replace('/releases/tag/', '/releases/download/');
  }
}

function releaseApiUrlFromReleaseUrl(releaseUrl) {
  const raw = String(releaseUrl || '').trim();
  if (!raw) return '';
  if (/^https:\/\/gitee\.com\/api\/v5\/repos\//i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.toLowerCase() !== 'gitee.com') return '';
    const parts = url.pathname.split('/').filter(Boolean);
    const releasesIndex = parts.indexOf('releases');
    const tagIndex = parts.indexOf('tag');
    const downloadIndex = parts.indexOf('download');
    const owner = parts[0];
    const repo = parts[1];
    const tag = tagIndex >= 0
      ? parts[tagIndex + 1]
      : downloadIndex >= 0 ? parts[downloadIndex + 1] : 'latest';
    if (!owner || !repo || releasesIndex < 2) return '';
    return `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`;
  } catch {
    return '';
  }
}

function extractVersion(value) {
  return String(value || '').match(/(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/)?.[1] || '';
}

function decodeFileNameFromUrl(value) {
  try {
    return decodeURIComponent(String(value || '').split(/[?#]/)[0].split('/').pop() || '');
  } catch {
    return String(value || '').split(/[?#]/)[0].split('/').pop() || '';
  }
}

function assetFileName(asset) {
  return String(asset?.name || decodeFileNameFromUrl(asset?.browser_download_url || '') || '');
}

function isWindowsInstallerAsset(asset) {
  const name = assetFileName(asset);
  return /\.exe$/i.test(name) && !/\.exe\.blockmap$/i.test(name);
}

function isLatestYmlAsset(asset) {
  const name = assetFileName(asset).toLowerCase();
  return name === 'latest.yml' || /\/latest\.yml(?:[?#].*)?$/i.test(String(asset?.browser_download_url || ''));
}

function compareVersions(a, b) {
  const left = String(a || '0.0.0').split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  const right = String(b || '0.0.0').split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length, 3);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff) return diff;
  }
  return 0;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? require('https') : require('http');
    const request = client.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'WanGaoHui AutoUpdater',
        Accept: 'application/json, text/plain, */*',
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
        if (response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${text.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(text || '{}'));
        } catch (error) {
          reject(new Error(`JSON parse failed: ${error.message}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('request timeout')));
    request.on('error', reject);
  });
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? require('https') : require('http');
    const request = client.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'WanGaoHui AutoUpdater',
        Accept: 'text/plain, application/octet-stream, */*',
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
        if (response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${text.slice(0, 200)}`));
          return;
        }
        resolve(text);
      });
    });
    request.on('timeout', () => request.destroy(new Error('request timeout')));
    request.on('error', reject);
  });
}

async function fallbackCheckGiteeRelease(releaseUrl) {
  const apiUrl = releaseApiUrlFromReleaseUrl(releaseUrl);
  if (!apiUrl) return null;
  const release = await requestJson(apiUrl);
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const installer = assets.find(isWindowsInstallerAsset);
  const latestYmlAsset = assets.find(isLatestYmlAsset);
  const latestYmlText = latestYmlAsset?.browser_download_url
    ? await requestText(latestYmlAsset.browser_download_url).catch(() => '')
    : '';
  const hasLatestYml = Boolean(latestYmlAsset);
  const latestVersion = extractVersion(installer?.name)
    || extractVersion(decodeFileNameFromUrl(installer?.browser_download_url || ''))
    || extractVersion(latestYmlText.match(/(?:^|\n)\s*version\s*:\s*['"]?([^'"\r\n]+)/i)?.[1])
    || extractVersion(release?.tag_name);
  const currentVersion = app.getVersion();
  if (!latestVersion) {
    return {
      ok: false,
      currentVersion,
      error: '没有识别到远端安装包版本',
      message: '检查更新失败：没有识别到远端安装包版本',
    };
  }
  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return {
      ok: true,
      hasUpdate: false,
      currentVersion,
      latestVersion,
      hasLatestYml,
      message: '当前已经是最新版本',
    };
  }
  return {
    ok: false,
    hasUpdate: true,
    currentVersion,
    latestVersion,
    hasLatestYml,
    message: hasLatestYml
      ? '发现新版本，但标准更新器下载失败，请稍后重试'
      : '发现新版本，但缺少 latest.yml，请上传更新配置文件',
  };
}

function nextCheckDelay() {
  return Math.floor(Math.random() * (MAX_CHECK_INTERVAL_MS - MIN_CHECK_INTERVAL_MS + 1)) + MIN_CHECK_INTERVAL_MS;
}

function send(win, channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function initAutoUpdater(mainWindow, options = {}) {
  if (initialized) return;
  initialized = true;

  const getReleaseUrl = () => String(options.getReleaseUrl?.() || DEFAULT_RELEASE_URL);
  const logger = options.logger || console;
  const log = (message) => {
    logger.info?.(`[auto-updater] ${message}`);
    send(mainWindow, 'update-log', { time: new Date().toISOString(), msg: message });
  };
  const isBusy = () => {
    try {
      return Boolean(options.isBusy?.());
    } catch {
      return false;
    }
  };
  const beforeInstall = () => {
    try {
      options.beforeInstall?.();
    } catch {
      /* ignore */
    }
  };
  const refreshFeedUrl = () => {
    const feedUrl = updateFeedUrlFromReleaseUrl(getReleaseUrl());
    if (feedUrl) {
      const parsed=new URL(feedUrl);
      if(parsed.hostname==='github.com'){const [owner,repo]=parsed.pathname.split('/').filter(Boolean);autoUpdater.setFeedURL({provider:'github',owner,repo,private:false});}
      else autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
    }
    return feedUrl;
  };

  const manualMac = process.platform === "darwin";
  autoUpdater.autoDownload = !manualMac;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/octet-stream,*/*',
  };

  function scheduleInstall(delay = 5000) {
    if (!downloadedInfo) return;
    if (installTimer) clearTimeout(installTimer);
    installTimer = setTimeout(() => {
      if (isBusy()) {
        log('update downloaded, install waits for running jobs');
        scheduleInstall(INSTALL_RETRY_MS);
        return;
      }
      log(`installing update ${downloadedInfo.version || ''}`);
      beforeInstall();
      autoUpdater.quitAndInstall(true, true);
    }, delay);
  }

  async function checkForUpdates(reason) {
    if (checking) return { ok: true, checking: true, message: '正在检查更新' };
    if (!app.isPackaged) {
      log(`${reason} update check skipped in development`);
      return { ok: true, currentVersion: app.getVersion(), hasUpdate: false, message: '开发环境已跳过更新检查' };
    }
    if (isBusy()) {
      log(`${reason} update check skipped because app is busy`);
      return { ok: true, skipped: true, message: '当前有任务运行，稍后自动检查更新' };
    }
    checking = true;
    const feedUrl = refreshFeedUrl();
    log(`${reason} update check started${feedUrl ? `: ${feedUrl}` : ''}`);
    try {
      const result = await autoUpdater.checkForUpdates();
      const currentVersion = app.getVersion();
      const latestVersion = result?.updateInfo?.version || currentVersion;
      if(manualMac && latestVersion!==currentVersion)send(mainWindow,'update-status',{status:'manual',version:latestVersion});
      return {
        ok: true,
        currentVersion,
        latestVersion,
        hasUpdate: latestVersion !== currentVersion,
        message: latestVersion !== currentVersion
          ? '发现新版本，正在后台下载，下载完成后会自动安装'
          : '当前已经是最新版本',
      };
    } catch (error) {
      const rawMessage = error?.message || String(error);
      log(`${reason} update check failed: ${rawMessage}`);
      const fallback = await fallbackCheckGiteeRelease(feedUrl).catch((fallbackError) => {
        log(`${reason} fallback update check failed: ${fallbackError?.message || fallbackError}`);
        return null;
      });
      if (fallback) return { ...fallback, updaterError: rawMessage };
      return {
        ok: false,
        currentVersion: app.getVersion(),
        error: rawMessage,
        message: rawMessage ? `检查更新失败：${rawMessage}` : '检查更新失败',
      };
    } finally {
      checking = false;
    }
  }

  function scheduleNextCheck(delay = nextCheckDelay()) {
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      checkForUpdates('scheduled').finally(() => scheduleNextCheck());
    }, delay);
  }

  autoUpdater.on('checking-for-update', () => {
    log('checking for update');
    send(mainWindow, 'update-status', { status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    log(`update available ${info.version || ''}${manualMac ? ', manual download required' : ', downloading'}`);
    send(mainWindow, 'update-status', { status: manualMac ? 'manual' : 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', (info) => {
    log(`no update available ${info.version || ''}`);
    send(mainWindow, 'update-status', { status: 'not-available', version: info.version });
  });
  autoUpdater.on('download-progress', (progress) => {
    send(mainWindow, 'update-download-progress', {
      percent: Math.floor(progress.percent || 0),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    downloadedInfo = info || {};
    log(`update downloaded ${downloadedInfo.version || ''}`);
    send(mainWindow, 'update-status', { status: 'downloaded', version: downloadedInfo.version });
    scheduleInstall();
  });
  autoUpdater.on('error', (error) => {
    log(`update error: ${error?.message || error}`);
    send(mainWindow, 'update-status', { status: 'error', error: error?.message || String(error) });
  });

  ipcMain.handle('update-check', () => checkForUpdates('manual'));
  ipcMain.handle('update-install', async () => {
    if (!downloadedInfo) return { ok: false, error: '更新包还没有下载完成' };
    beforeInstall();
    autoUpdater.quitAndInstall(true, true);
    return { ok: true };
  });
  ipcMain.handle('app-version', () => app.getVersion());

  setTimeout(() => {
    checkForUpdates('startup').finally(() => scheduleNextCheck());
  }, STARTUP_CHECK_DELAY_MS);

  mainWindow?.on('closed', () => {
    if (checkTimer) clearTimeout(checkTimer);
    if (installTimer) clearTimeout(installTimer);
  });

  log('auto updater initialized');
}

module.exports = { initAutoUpdater, updateFeedUrlFromReleaseUrl };
