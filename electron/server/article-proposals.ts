import type { Store } from './store.js';
import { HttpError, type Run } from './types.js';

export function revisionSource(store: Store, taskId: string, runId: string) {
  const parent = store.get<Run>('generation_runs', runId);
  if (!parent || parent.task_id !== taskId || parent.kind !== 'agent_edit') throw new HttpError(404, '候选稿不存在');
  if (parent.status !== 'completed' || parent.base_html === null || !parent.partial_html.trim()) throw new HttpError(409, '只能继续修改完整且尚未处理的候选稿');
  store.checkDraftBase(taskId, parent.base_version_id);
  return parent;
}

/** Called in the same transaction that completes the replacement candidate. */
export function supersedeProposal(store: Store, run: Run) {
  if (!run.parent_run_id || !run.task_id) return;
  const parent = store.get<Run>('generation_runs', run.parent_run_id);
  if (!parent || parent.task_id !== run.task_id || parent.status !== 'completed') throw new HttpError(409, '上一版候选稿状态已变化，不能替换');
  store.update('generation_runs', parent.id, { status: 'superseded' });
  store.event(run.task_id, parent.id, 'agent_proposal', { status: 'superseded', replacement_run_id: run.id });
}

/** Decision, version check, immutable draft and audit event commit together. */
export function decideProposal(store: Store, taskId: string, runId: string, accept: boolean) {
  return store.transaction(() => {
    const run = store.get<Run>('generation_runs', runId);
    if (!run || run.task_id !== taskId || run.kind !== 'agent_edit')
      throw new HttpError(404, '改稿记录不存在');
    store.checkDraftBase(taskId);
    if (run.status !== 'completed') throw new HttpError(409, '候选稿未完成或已经处理');
    if (store.rows("SELECT id FROM generation_runs WHERE task_id=? AND status IN ('queued','running')", taskId).length)
      throw new HttpError(409, '新一轮修改正在处理，请等待完成后再决定');
    if (accept) {
      // Old runs lack a provable snapshot. Never guess which draft they replace.
      if (run.base_html === null || !run.partial_html.trim())
        throw new HttpError(409, '候选稿缺少可核对的基准，请放弃后重新改稿');
      store.checkDraftBase(taskId, run.base_version_id);
      store.insertDraftVersion(taskId, run.partial_html, 'agent', run.user_prompt);
    }
    const status = accept ? 'accepted' : 'rejected';
    store.update('generation_runs', runId, { status });
    store.event(taskId, runId, 'agent_proposal', { status });
    return store.task(taskId)!;
  });
}
