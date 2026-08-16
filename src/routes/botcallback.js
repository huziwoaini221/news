import { wecomDecrypt, wecomEncrypt, wecomSignature, b64ToBytes } from '../utils/wecom_crypto.js';
import { mintLoginKey } from '../utils/token.js';

function stripMention(s) {
  return s.replace(/^@[\s\S]*?\s/, '').trim();
}

// 智能机器人 URL 回调：GET=URL 验证（返回解密后的 echostr 明文），POST=消息回调+被动回复（JSON）
export async function botCallbackRouter(request, env, url) {
  const token = env.BOT_CALLBACK_TOKEN;
  const aesB64 = env.BOT_CALLBACK_AES_KEY;
  if (!token || !aesB64) return new Response('callback not configured', { status: 500 });
  let aesKey;
  try {
    aesKey = b64ToBytes(aesB64 + '=');
  } catch {
    return new Response('bad callback config', { status: 500 });
  }

  const timestamp = url.searchParams.get('timestamp') || '';
  const nonce = url.searchParams.get('nonce') || '';
  const msgSignature = url.searchParams.get('msg_signature') || '';

  // URL 有效性验证（GET）
  if (request.method === 'GET') {
    const echostr = url.searchParams.get('echostr') || '';
    const sig = await wecomSignature(token, timestamp, nonce, echostr);
    if (sig !== msgSignature) return new Response('signature error', { status: 403 });
    const { msg } = await wecomDecrypt(echostr, aesKey);
    return new Response(msg);
  }

  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!body || typeof body.encrypt !== 'string' || !body.encrypt) {
    return new Response('bad request', { status: 400 });
  }

  // 回调数据为 JSON {"encrypt": "msg_encrypt"}，receiveId 传空字符串
  const sig = await wecomSignature(token, timestamp, nonce, body.encrypt);
  if (sig !== msgSignature) return new Response('signature error', { status: 403 });
  const dec = await wecomDecrypt(body.encrypt, aesKey);

  let msg;
  try {
    msg = JSON.parse(dec.msg);
  } catch {
    return new Response('', { status: 200 });
  }
  const content = (msg.text && msg.text.content) || '';
  const fromUser = (msg.from && msg.from.userid) || '';
  const toUser = msg.aibotid || '';
  if (!content && !fromUser) return new Response('');

  let reply = '';
  if (/登录|login/i.test(stripMention(content))) {
    const key = await mintLoginKey(env);
    const loginUrl = 'https://hub.oneos.dpdns.org/?key=' + key;
    reply = 'Personal Hub 登录链接（10 分钟内有效）\n\n' + loginUrl + '\n\n过期后请重新发送「登录」';
  } else if (/帮助|help/i.test(stripMention(content))) {
    reply = '可用命令：\n- **登录**：获取 Personal Hub 登录链接\n- **帮助**：显示此帮助';
  } else if (content) {
    reply = '发送「登录」获取 Personal Hub 登录链接；发送「帮助」查看更多。';
  }

  if (!reply) return new Response('');

  const streamId = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, '0')).join('');
  const replyJson = JSON.stringify({ msgtype: 'stream', stream: { id: streamId, finish: true, content: reply } });
  const ts = String(Math.floor(Date.now() / 1000));
  const enc = await wecomEncrypt(replyJson, aesKey, '');
  const replySig = await wecomSignature(token, ts, nonce, enc);
  const out = JSON.stringify({ encrypt: enc, msgsignature: replySig, timestamp: Number(ts), nonce });
  return new Response(out, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
