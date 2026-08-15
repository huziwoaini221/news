import { verifyLoginToken } from './token.js';

export function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

// 允许 API_SECRET（主密钥）、LESSON_SECRET（课时系统专用密钥）或短时签名登录令牌
export async function checkAuth(request, env) {
  const token = getBearerToken(request);
  if (!token) return false;
  if (env.API_SECRET && token === env.API_SECRET) return true;
  if (env.LESSON_SECRET && token === env.LESSON_SECRET) return true;
  if (token.startsWith('v1.')) return verifyLoginToken(token, env.API_SECRET || '');
  return false;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function readBody(request) {
  return request.json().catch(() => ({}));
}
