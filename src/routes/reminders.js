import { json } from '../utils/auth.js';
import { checkReminders } from '../services/reminder.js';

// 由 MyPlace Cron 每 5 分钟调用
export async function remindersRouter(request, env) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const result = await checkReminders(env);
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
}
