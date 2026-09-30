import { createHash } from "node:crypto";
import type { Store } from "./store.js";
import { HttpError, now, type Row } from "./types.js";
import { id } from "./store.js";

type Approval = { id: string; kind: string; task_id: string | null; payload_hash: string; status: string; expires_at: number; error: string | null };
const hash = (payload: Row) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export function createApproval(store: Store, kind: string, taskId: string | null, payload: Row) {
  return store.insert<Approval>("approval_requests", { id: id(), kind, task_id: taskId, payload_hash: hash(payload), status: "awaiting_approval",
    expires_at: Date.now() + 10 * 60_000, error: null, created_at: now(), updated_at: now() });
}

/** Atomically consumes approval before any paid or external call, preventing double submit. */
export function beginApproval(store: Store, approvalId: string, kind: string, taskId: string | null, payload: Row) {
  return store.transaction(() => {
    const approval = store.get<Approval>("approval_requests", approvalId);
    if (!approval || approval.kind !== kind || approval.task_id !== taskId || approval.status !== "awaiting_approval" ||
        approval.expires_at <= Date.now() || approval.payload_hash !== hash(payload))
      throw new HttpError(409, "确认已过期、已使用或内容发生变化，请重新确认");
    return store.update<Approval>("approval_requests", approval.id, { status: "running", error: null })!;
  });
}

export function finishApproval(store: Store, approvalId: string, error?: unknown) {
  store.update("approval_requests", approvalId, { status: error ? "failed" : "completed", error: error ? String(error) : null });
}
