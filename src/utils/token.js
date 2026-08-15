// 短时登录令牌：HMAC-SHA256 签名，无状态
// 格式：v1.<base64url(JSON{exp})>.<base64url(sig)>

function toB64url(bytes) {
  let bin = '';
  new Uint8Array(bytes).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function mintLoginKey(env, ttlMs = 10 * 60 * 1000) {
  const msg = 'v1.' + toB64url(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + ttlMs })));
  const key = await hmacKey(env.API_SECRET || '');
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return msg + '.' + toB64url(sig);
}

export async function verifyLoginToken(token, secret) {
  try {
    const dot = token.lastIndexOf('.');
    if (token.slice(0, 3) !== 'v1.' || dot < 3) return false;
    const msg = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, fromB64url(sigB64), new TextEncoder().encode(msg));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(msg.slice(3))));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}
