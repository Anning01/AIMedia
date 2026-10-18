import type { HostTaskItem } from "@/data/localStore";
export function taskState(task: HostTaskItem, executing = false) {
  if (executing || task.status === "执行中") return "executing";
  if (task.status === "已完成") return "completed";
  return task.enabled && task.status !== "已暂停" ? "running" : "paused";
}
export function isTaskEnabled(task: HostTaskItem) {
  const state = taskState(task);
  return state === "running" || state === "executing";
}
