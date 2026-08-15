import { json } from '../utils/auth.js';
import { runMorningReport } from '../services/morning.js';

// 由 MyPlace Cron 每日调用（幂等，多触发器安全）
export async function morningRouter(request, env) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const result = await runMorningReport(env);
    const status = result.ok ? 200 : result.skipped ? 200 : 502;
    return json({ ok: result.ok, ...result }, status);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
}
