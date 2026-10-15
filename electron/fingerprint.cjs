'use strict';

/**
 * 登录窗口指纹硬化（比单纯改 UA 更完整）：
 *  - CDP 覆盖 User-Agent 及 Client Hints（brands/platform 与真实 Chrome 一致）
 *  - 主世界注入脚本：清理 webdriver、补全 chrome/plugins、伪装 WebGL/硬件参数
 *  - 只在登录/授权子窗口使用，不注入主应用
 */

const FINGERPRINT_SCRIPT = `(() => {
  const mark = '__wh_fp_sealed';
  if (window[mark]) return;
  try { Object.defineProperty(window, mark, { value: true, configurable: false }); } catch {}

  const ro = (obj, key, val) => {
    try {
      Object.defineProperty(obj, key, { get: () => val, configurable: true });
    } catch {}
  };

  // 1) 自动化标记
  ro(navigator, 'webdriver', undefined);
  ro(navigator, 'webdriverEnabled', undefined);
  for (const key of Object.getOwnPropertyNames(window)) {
    if (/^cdc_|__webdriver|^webdriver|selenium|__pw|playwright/i.test(key)) {
      try { delete window[key]; } catch {}
    }
  }

  // 2) 基础环境
  ro(navigator, 'vendor', 'Google Inc.');
  ro(navigator, 'platform', 'Win32');
  ro(navigator, 'language', 'zh-CN');
  ro(navigator, 'languages', ['zh-CN', 'zh', 'en']);
  ro(navigator, 'hardwareConcurrency', 8);
  ro(navigator, 'deviceMemory', 8);
  ro(navigator, 'maxTouchPoints', 0);
  ro(navigator, 'pdfViewerEnabled', true);

  // 3) plugins / mimeTypes 对齐真实 Chrome（5 个插件）
  try {
    const mkPlugin = (name, desc, file, suffixes) => ({
      name,
      description: desc,
      filename: file,
      length: 1,
      item: () => null,
      namedItem: () => null,
      [Symbol.iterator]: function* () { yield null; },
      [0]: {
        type: 'application/x-' + suffixes,
        suffixes,
        description: desc,
        enabledPlugin: null,
      },
    });
    const plugins = [
      mkPlugin('Chrome PDF Plugin', 'Portable Document Format', 'internal-pdf-viewer', 'pdf'),
      mkPlugin('Chrome PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', 'pdf'),
      mkPlugin('Native Client', '', 'internal-nacl-plugin', ''),
      mkPlugin('Chrome PDF Viewer', '', 'internal-pdf-viewer', 'pdf'),
      mkPlugin('Chromium PDF Viewer', '', 'internal-pdf-viewer', 'pdf'),
    ];
    Object.defineProperty(navigator, 'plugins', { get: () => plugins, configurable: true });
    Object.defineProperty(navigator, 'mimeTypes', { get: () => ({ length: 4, item: () => null, namedItem: () => null }), configurable: true });
  } catch {}

  // 4) window.chrome 补全（真实 Chrome 常见属性）
  if (!window.chrome) window.chrome = {};
  for (const key of ['app', 'csi', 'loadTimes', 'runtime', 'webview']) {
    if (!window.chrome[key]) {
      try { window.chrome[key] = key === 'loadTimes' || key === 'csi' ? function () { return {}; } : {}; } catch {}
    }
  }
  try { window.chrome.app = window.chrome.app || {}; } catch {}

  // 5) WebGL 渲染器伪装
  const RENDERER = 0x1f01;
  const VENDOR = 0x1f00;
  const EXT_RENDERER = 0x9245;
  const EXT_VENDOR = 0x9246;
  const gpuRenderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const gpuVendor = 'Google Inc. (NVIDIA)';
  const patchWebGL = (proto) => {
    if (!proto || proto.__wh_webgl) return;
    proto.__wh_webgl = true;
    const orig = proto.getParameter;
    proto.getParameter = function (param) {
      if (param === RENDERER || param === EXT_RENDERER) return gpuRenderer;
      if (param === VENDOR || param === EXT_VENDOR) return gpuVendor;
      return orig.apply(this, arguments);
    };
  };
  patchWebGL(WebGLRenderingContext.prototype);
  patchWebGL(WebGL2RenderingContext.prototype);

  // 6) 屏幕与视口
  try {
    Object.defineProperty(screen, 'width', { get: () => window.outerWidth || 1920, configurable: true });
    Object.defineProperty(screen, 'height', { get: () => window.outerHeight || 1080, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: () => window.outerWidth || 1920, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => window.outerHeight || 1040, configurable: true });
  } catch {}

  // 7) 网络信息伪装（可选，降低自动化特征）
  if (navigator.connection) {
    try {
      Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g', configurable: true });
      Object.defineProperty(navigator.connection, 'rtt', { get: () => 50, configurable: true });
      Object.defineProperty(navigator.connection, 'downlink', { get: () => 10, configurable: true });
    } catch {}
  }
})();`;

async function hardenLoginWebContents(webContents, userAgent) {
  if (!webContents || webContents.isDestroyed()) return false;
  const chromeVersion = String(process.versions.chrome || '130.0.6723.44');
  const major = chromeVersion.split('.')[0] || '130';
  let attached = false;
  try {
    const dbg = webContents.debugger;
    if (!dbg.isAttached()) {
      dbg.attach('1.3');
      attached = true;
    }
    await dbg.sendCommand('Page.enable');
    await dbg.sendCommand('Emulation.setUserAgentOverride', {
      userAgent,
      acceptLanguage: 'zh-CN,zh;q=0.9',
      platform: 'Windows',
      userAgentMetadata: {
        brands: [
          { brand: 'Google Chrome', version: major },
          { brand: 'Chromium', version: major },
          { brand: 'Not_A Brand', version: '24' },
        ],
        fullVersion: chromeVersion,
        platform: 'Windows',
        platformVersion: '10.0.0',
        architecture: 'x86_64',
        model: '',
        mobile: false,
      },
    });
    await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: FINGERPRINT_SCRIPT,
    });
    webContents.once('destroyed', () => {
      try {
        if (dbg.isAttached()) dbg.detach();
      } catch {}
    });
    return true;
  } catch (err) {
    console.warn('[fingerprint] harden failed:', err && err.message ? err.message : err);
    if (attached) {
      try {
        if (webContents.debugger.isAttached()) webContents.debugger.detach();
      } catch {}
    }
    return false;
  }
}

module.exports = { hardenLoginWebContents, FINGERPRINT_SCRIPT };
