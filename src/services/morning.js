import { notify } from './notification.js';
import { formatShanghaiDate, formatShanghaiDateTime, shanghaiDayRange } from '../utils/time.js';

// 每日晨报：只汇总 Worker 自己管理的 任务/日历/财务，不读取课时数据
// 幂等：morning_reports.report_date 有 UNIQUE 约束
export async function runMorningReport(env) {
  const reportDate = formatShanghaiDate();
  const { start, end } = shanghaiDayRange();
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const nowIso = new Date().toISOString();

  const existing = await env.DB.prepare('SELECT * FROM morning_reports WHERE report_date = ?').bind(reportDate).first();
  if (existing) {
    return { skipped: true, report_date: reportDate, status: existing.status };
  }

  // 预占 report_date（UNIQUE 兜底，防并发/双触发器）
  let insert;
  try {
    insert = await env.DB.prepare(
      `INSERT INTO morning_reports (report_date, status, created_at) VALUES (?, 'sending', ?)`
    ).bind(reportDate, nowIso).run();
  } catch (e) {
    if (String(e.message || e).toUpperCase().includes('UNIQUE')) {
      return { skipped: true, report_date: reportDate, status: 'already_sent' };
    }
    throw e;
  }

  const [tasks, events, fin, overdue] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM tasks WHERE status = 'pending' AND due_at IS NOT NULL AND due_at >= ? AND due_at < ? ORDER BY due_at ASC`
    ).bind(startIso, endIso).all(),
    env.DB.prepare(
      `SELECT * FROM calendar_events WHERE status = 'scheduled' AND start_at IS NOT NULL AND start_at >= ? AND start_at < ? ORDER BY start_at ASC`
    ).bind(startIso, endIso).all(),
    env.DB.prepare(
      `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE occurred_at >= ? AND occurred_at < ? GROUP BY type`
    ).bind(new Date(start.getTime() - 86400000).toISOString(), startIso).all(),
    env.DB.prepare(
      `SELECT COUNT(*) AS c FROM tasks WHERE status = 'pending' AND due_at IS NOT NULL AND due_at < ?`
    ).bind(startIso).first(),
  ]);

  const lines = ['☀️ 早安', ''];

  if ((tasks.results || []).length) {
    lines.push('📋 今日任务');
    tasks.results.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.due_at ? formatShanghaiDateTime(t.due_at).slice(5) : ''} ${t.title}`);
    });
  } else {
    lines.push('📋 今日任务\n（无）');
  }
  lines.push('');

  if ((events.results || []).length) {
    lines.push('📅 今日安排');
    events.results.forEach((ev) => {
      lines.push(`- ${formatShanghaiDateTime(ev.start_at).slice(5)} ${ev.title}${ev.location ? ' @' + ev.location : ''}`);
    });
  } else {
    lines.push('📅 今日安排\n（无）');
  }

  const finMap = {};
  for (const r of fin.results || []) finMap[r.type] = r;
  if (finMap.income || finMap.expense) {
    lines.push('');
    lines.push('💰 昨日财务');
    if (finMap.income) lines.push(`收入 ¥${Number(finMap.income.total).toFixed(2)}`);
    if (finMap.expense) lines.push(`支出 ¥${Number(finMap.expense.total).toFixed(2)}`);
  }

  if (overdue && overdue.c > 0) {
    lines.push('');
    lines.push(`⚠️ 待处理\n${overdue.c} 项任务已过期`);
  }

  const message = lines.join('\n').replace(/\n{2,}/g, '\n').trim();

  const res = await notify(env, {
    source: 'morning_report',
    eventType: 'morning_report',
    message,
    payload: { report_date: reportDate },
  });

  if (res.ok) {
    await env.DB.prepare(`UPDATE morning_reports SET status = 'success', sent_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), insert.meta.last_row_id).run();
    return { ok: true, report_date: reportDate, status: 'success', log_id: res.log_id };
  }

  // 发送失败则删除占位，允许下一次 Cron 重试
  await env.DB.prepare(`DELETE FROM morning_reports WHERE id = ?`).bind(insert.meta.last_row_id).run();
  return { ok: false, report_date: reportDate, status: 'failed', error: res.error };
}
