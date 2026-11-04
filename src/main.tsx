import { ConfirmationHost } from "@/components/shared/controls";
import { Toaster } from "@/components/ui/sonner";
import React from "react";
import { initPersistentStore } from "@/data/persistentStore";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./ui.css";
import "./workspace.css";

// 启动时先加载磁盘上的关键数据（账号 / 素材库），并把老版本 localStorage 数据迁移过去
initPersistentStore();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster richColors position="top-right" />
    <ConfirmationHost />
  </React.StrictMode>,
);
