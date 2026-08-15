import { sendWecom } from './wecom.js';

// 统一通知：写 notification_logs -> 调用企业微信 -> 回写结果
export async function notify(env, { source, eventType, message, payload }) {
  const created_at = new Date().toISOString();
  let logId = null;
  try {
    const res = await env.DB.prepare(
      `INSERT INTO notification_logs (source, event_type, payload, message, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    ).bind(source, eventType, JSON.stringify(payload || {}), message, created_at).run();
    logId = res.meta.last_row_id;
  } catch (e) {
    return { ok: false, log_id: null, error: 'log insert failed: ' + e.message };
  }

  try {
    const result = await sendWecom(env, message);
    if (result.ok) {
      await env.DB.prepare(
        `UPDATE notification_logs SET status = 'success', sent_at = ? WHERE id = ?`
      ).bind(new Date().toISOString(), logId).run();
      return { ok: true, log_id: logId };
    }
    throw new Error(`wecom errcode=${result.errcode} errmsg=${result.errmsg || ''}`);
  } catch (e) {
    await env.DB.prepare(
      `UPDATE notification_logs SET status = 'failed', error = ?, retry_count = retry_count + 1 WHERE id = ?`
    ).bind(String(e.message || e), logId).run();
    return { ok: false, log_id: logId, error: String(e.message || e) };
  }
}
