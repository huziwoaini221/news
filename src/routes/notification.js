import { json, readBody } from '../utils/auth.js';
import { notify } from '../services/notification.js';

// 供外部应用（课时系统等）调用：POST /api/notify
// 只需带 API_SECRET 或 LESSON_SECRET，Webhook URL 对外不可见
export async function notificationRouter(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    if (method === 'GET' && path === '/api/notify/test') {
      const message = `🔔 通知服务测试\n\n✅ 连接正常\n⏰ ${new Date().toISOString()}`;
      const res = await notify(env, { source: 'system', eventType: 'test', message, payload: {} });
      return res.ok ? json({ ok: true, log_id: res.log_id }) : json({ ok: false, error: res.error }, 502);
    }

    if (method === 'POST' && path === '/api/notify') {
      const body = await readBody(request);
      if (!body.source || !body.message) {
        return json({ error: 'source and message are required' }, 400);
      }
      const res = await notify(env, {
        source: body.source,
        eventType: body.event_type || 'notify',
        message: body.message,
        payload: body.payload || {},
      });
      return res.ok ? json({ ok: true, log_id: res.log_id }) : json({ ok: false, error: res.error }, 502);
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
