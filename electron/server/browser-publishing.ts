import { Store, id } from './store.js';
import { HttpError, now, type Account, type Schedule } from './types.js';

/** Any handoff after a possible publish click must be resolved before another fill. */
export function requiresOutcomeReview(store: Store, schedule: Schedule): boolean {
  if (schedule.status !== 'needs_handoff') return false;
  const latest = store.rows<{ stage: string }>('SELECT stage FROM publish_events WHERE schedule_id=? ORDER BY rowid DESC LIMIT 1', schedule.id)[0];
  return latest?.stage !== 'prepare';
}

export function resolveBrowserOutcome(store: Store, scheduleId: string, outcome: 'published' | 'not_published') {
  return store.transaction(() => {
    const schedule = store.get<Schedule>('publish_schedules', scheduleId);
    if (!schedule) throw new HttpError(404, '发布记录不存在');
    const account = store.get<Account>('accounts_v2', schedule.account_id);
    if (account?.adapter !== 'browser' || !requiresOutcomeReview(store, schedule))
      throw new HttpError(409, '该记录不需要核对发布结果，或核对已经完成');
    const status = outcome === 'published' ? 'published' : 'awaiting_browser';
    const message = outcome === 'published'
      ? '用户已在公众号平台确认发布成功（人工核对）'
      : '用户已在公众号平台确认未发布，允许重新填写；真实发布仍需再次确认';
    store.insert('publish_events', { id: id(), schedule_id: schedule.id, stage: 'manual_result', status,
      message, summary: { outcome, verified_by: 'user' }, created_at: now() });
    store.update('tasks', schedule.task_id, { publish_status: status });
    store.event(schedule.task_id, null, 'status', { publish_status: status, message });
    return store.update<Schedule>('publish_schedules', schedule.id, { status, last_error: outcome === 'published' ? null : message });
  });
}
