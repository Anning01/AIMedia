const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wangaohui', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  qilingConnect: payload => ipcRenderer.invoke('qiling-connect',payload),
  qilingModels: payload => ipcRenderer.invoke('qiling-models',payload),
  qilingSelectModel: payload => ipcRenderer.invoke('qiling-model-select',payload),
  qilingAuthStart: payload => ipcRenderer.invoke('qiling-auth-start',payload),
  qilingAuthPoll: payload => ipcRenderer.invoke('qiling-auth-poll',payload),
  qilingAuthCancel: payload => ipcRenderer.invoke('qiling-auth-cancel',payload),
  qilingRemovePrice: payload => ipcRenderer.invoke('qiling-remove-price',payload),
  qilingRemoveGet: payload => ipcRenderer.invoke('qiling-remove-get',payload),
  qilingRemoveStart: payload => ipcRenderer.invoke('qiling-remove-start',payload),
  qilingRemovePoll: payload => ipcRenderer.invoke('qiling-remove-poll',payload),
  qilingRemovePause: payload => ipcRenderer.invoke('qiling-remove-pause',payload),
  qilingRemoveResume: payload => ipcRenderer.invoke('qiling-remove-resume',payload),
  qilingRemoveAdopt: payload => ipcRenderer.invoke('qiling-remove-adopt',payload),
  qilingOpenAccount: payload => ipcRenderer.invoke('qiling-open-account',payload),
  cancelGeneration: payload => ipcRenderer.invoke('generation-cancel',payload),
  onGenerationProgress: cb => {const handler=(_e,payload)=>cb(payload);ipcRenderer.on('generation-progress',handler);return()=>ipcRenderer.removeListener('generation-progress',handler);},
  generateArticle: (payload) => ipcRenderer.invoke('generate-article', payload),
  winMinimize: () => ipcRenderer.invoke('window-minimize'),
  winMaximize: () => ipcRenderer.invoke('window-maximize'),
  winClose: () => ipcRenderer.invoke('window-close'),
  appVersion: () => ipcRenderer.invoke('app-version'),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
  onUpdateStatus: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  onUpdateProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  onUpdateLog: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('update-log', handler);
    return () => ipcRenderer.removeListener('update-log', handler);
  },
  copyHtml: (html) => ipcRenderer.invoke('copy-html', html),
  testAiConfig: (payload) => ipcRenderer.invoke('test-ai-config', payload),
  saveAiConfig: (payload) => ipcRenderer.invoke('save-ai-config', payload),
  readAiConfig: () => ipcRenderer.invoke('read-ai-config'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  selectImages: (payload) => ipcRenderer.invoke('select-images', payload),
  saveImage: (payload) => ipcRenderer.invoke('image-save', payload),
  readImage: (payload) => ipcRenderer.invoke('image-read', payload),
  openImageDir: () => ipcRenderer.invoke('image-open-dir'),
  readImageHostConfig: () => ipcRenderer.invoke('read-imagehost-config'),
  saveImageHostConfig: (payload) => ipcRenderer.invoke('save-imagehost-config', payload),
  saveFile: (payload) => ipcRenderer.invoke('save-file', payload),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  setAutostart: (payload) => ipcRenderer.invoke('set-autostart', payload),
  generateImage: (payload) => ipcRenderer.invoke('generate-image', payload),
  cutoutImage: (payload) => ipcRenderer.invoke('cutout-image', payload),
  publishArticle: (payload) => ipcRenderer.invoke('publish-article', payload),
  llmChat: (payload) => ipcRenderer.invoke('llm-chat', payload),
  readNote: (payload) => ipcRenderer.invoke('read-note', payload),
  downloadNoteImages: (payload) => ipcRenderer.invoke('download-note-images', payload),
  downloadImage: (payload) => ipcRenderer.invoke('download-image', payload),
  analyzeNoteImages: (payload) => ipcRenderer.invoke('analyze-note-images', payload),
  platformLoginCreate: (payload) => ipcRenderer.invoke('platform-login-create', payload),
  platformLoginPoll: (payload) => ipcRenderer.invoke('platform-login-poll', payload),
  platformLoginCancel: (payload) => ipcRenderer.invoke('platform-login-cancel', payload),
  wechatSyncAccounts: (payload) => ipcRenderer.invoke('wechat-sync-accounts', payload),
  platformPublish: (payload) => ipcRenderer.invoke('platform-publish', payload),
  wechatRefreshSession: (payload) => ipcRenderer.invoke('wechat-refresh-session', payload),
  platformVerify: (payload) => ipcRenderer.invoke('platform-verify', payload),
  openAccountBackend: (payload) => ipcRenderer.invoke('open-account-backend', payload),
});
