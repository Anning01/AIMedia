import { contextBridge, ipcRenderer } from "electron";
const apiBase =
  process.argv
    .find((arg) => arg.startsWith("--ai-media-origin="))
    ?.slice("--ai-media-origin=".length) || "";
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    isDesktop: true,
    apiBase,
    importData: () => ipcRenderer.invoke("desktop:import"),
    openDataDirectory: () => ipcRenderer.invoke("desktop:open-data"),
    openBrowserSession: (accountId: string, url: string, preserveExisting = false) =>
      ipcRenderer.invoke("desktop:open-browser-session", { accountId, url, preserveExisting }),
    prepareBrowserPublish: (scheduleId: string) => ipcRenderer.invoke("desktop:prepare-browser-publish", scheduleId),
    confirmBrowserPublish: (scheduleId: string) => ipcRenderer.invoke("desktop:confirm-browser-publish", scheduleId),
  }),
);
