import { json, getBearerToken } from '../utils/auth.js';
import { mintLoginKey } from '../utils/token.js';

// 智能机器人专用：POST /api/bot/login
// Authorization: Bearer <BOT_SECRET> -> 换取 10 分钟有效的登录链接
export async function botLoginRouter(request, env) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const token = getBearerToken(request);
  if (!env.BOT_SECRET || token !== env.BOT_SECRET) return json({ error: 'unauthorized' }, 401);
  const key = await mintLoginKey(env);
  const origin = new URL(request.url).origin;
  return json({ key, url: origin + '/?key=' + key, expires_in: 600 });
}
