import { notify } from './notification.js';
import { formatShanghaiDateTime } from '../utils/time.js';

// 由 MyPlace Cron 每 5 分钟调用一次
export async function checkReminders(env) {
  const now = new Date();
  const nowIso = now.toISOString();
  let sent = 0;

  // 任务提醒
  const tasks = await env.DB.prepare(
    `SELECT * FROM tasks WHERE reminder_at IS NOT NULL AND reminder_at <= ? AND status = 'pending'`
  ).bind(nowIso).all();

  for (const t of tasks.results || []) {
    const lines = ['🔔 任务提醒', t.title];
    if (t.due_at) lines.push(`截止：${formatShanghaiDateTime(t.due_at)}`);
    if (t.description) lines.push(`备注：${t.description}`);
    const res = await notify(env, { source: 'tasks', eventType: 'reminder', message: lines.join('\n'), payload: t });
    if (res.ok) {
      // 只提醒一次，成功后清除 reminder_at
      await env.DB.prepare(`UPDATE tasks SET reminder_at = NULL, updated_at = ? WHERE id = ?`).bind(nowIso, t.id).run();
    }
    sent += 1;
  }

  // 日程提醒
  const events = await env.DB.prepare(
    `SELECT * FROM calendar_events WHERE reminder_at IS NOT NULL AND reminder_at <= ? AND status = 'scheduled'`
  ).bind(nowIso).all();

  for (const ev of events.results || []) {
    const lines = ['📅 日程提醒', ev.title];
    if (ev.start_at) lines.push(`开始：${formatShanghaiDateTime(ev.start_at)}`);
    if (ev.location) lines.push(`地点：${ev.location}`);
    const res = await notify(env, { source: 'calendar', eventType: 'reminder', message: lines.join('\n'), payload: ev });
    if (res.ok) {
      await env.DB.prepare(`UPDATE calendar_events SET reminder_at = NULL, updated_at = ? WHERE id = ?`).bind(nowIso, ev.id).run();
    }
    sent += 1;
  }

  return { checked_at: nowIso, sent };
}
