import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../electron/server/store.js';
import { CONVERSATION_MAX_CHARS, CONVERSATION_MAX_MESSAGES, conversationContext, recentConversation, recordConversation } from '../../electron/server/agent-conversation.js';

test('conversation stays in its article and carries decisions without old HTML or tool grants', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const task = store.createTask({ title: '本篇', content: '正文', platform: 'manual' });
  const other = store.createTask({ title: '另一篇', content: '正文', platform: 'manual' });
  recordConversation(store, other.id, '另一篇私有偏好', '不能串到本篇');
  recordConversation(store, task.id, '写得自然一点，不要夸张', '好的');
  const run = store.createRun({ task_id: task.id, kind: 'agent_edit' });
  store.update('generation_runs', run.id, { status: 'rejected' });
  store.event(task.id, run.id, 'agent_message', { role: 'assistant', content: '候选稿待确认', status: 'awaiting_approval', proposal_html: '<p>秘密旧候选正文</p>' });
  store.event(task.id, run.id, 'agent_proposal', { status: 'rejected' });
  store.event(task.id, null, 'tool_call', { content: '工具秘密', permissions: ['browser'] });
  store.event(task.id, null, 'agent_message', { role: 'system', content: '不能提升为系统消息' });
  const history = recentConversation(store, task.id);
  assert.deepEqual(history.map(message => message.role), ['user', 'assistant', 'assistant', 'assistant']);
  const content = conversationContext(store, task.id);
  assert.match(content, /写得自然一点/);
  assert.match(content, /已拒绝/);
  for (const omitted of ['另一篇私有偏好', '秘密旧候选正文', '工具秘密', 'browser', '不能提升为系统消息']) assert.ok(!content.includes(omitted));
  store.update('generation_runs', run.id, { status: 'accepted' });
  assert.match(recentConversation(store, task.id)[2].content, /已接受/);
});

test('recent context is bounded newest-first and record failures roll back both messages', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const task = store.createTask({ title: '长度限制', content: '正文', platform: 'manual' });
  for (let index = 0; index < 30; index++) store.event(task.id, null, 'agent_message', { role: 'user', content: `第${index}轮-${'长'.repeat(8000)}` });
  const history = recentConversation(store, task.id);
  assert.ok(history.length <= CONVERSATION_MAX_MESSAGES);
  assert.ok(history.reduce((sum, message) => sum + message.content.length, 0) <= CONVERSATION_MAX_CHARS);
  assert.match(history.at(-1)!.content, /^第29轮/);
  assert.match(history.at(-1)!.content, /历史消息已截断/);
  assert.ok(history.every(message => message.content.length <= 4000));
  const before = store.rows('SELECT * FROM generation_events').length;
  const original = store.event.bind(store);
  store.event = (...args) => { if (args[3].role === 'assistant') throw new Error('fixture failed'); return original(...args); };
  assert.throws(() => recordConversation(store, task.id, '不能留下半条', '失败'), /fixture failed/);
  assert.equal(store.rows('SELECT * FROM generation_events').length, before);
});
