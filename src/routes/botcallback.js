import { wecomDecrypt, wecomEncrypt, wecomSignature, b64ToBytes } from '../utils/wecom_crypto.js';
import { mintLoginKey } from '../utils/token.js';

function extract(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</' + tag + '>'));
  return m ? m[1].trim() : '';
}

function stripMention(s) {
  return s.replace(/^@[\s\S]*?\s/, '').trim();
}

function buildTextReply(toUser, fromUser, content) {
  return '<xml>' +
    '<ToUserName><![CDATA[' + toUser + ']]></ToUserName>' +
    '<FromUserName><![CDATA[' + fromUser + ']]></FromUserName>' +
    '<CreateTime>' + Math.floor(Date.now() / 1000) + '</CreateTime>' +
    '<MsgType><![CDATA[text]]></MsgType>' +
    '<Content><![CDATA[' + content + ']]></Content>' +
    '</xml>';
}

// 智能机器人 URL 回调：GET=URL 验证，POST=消息回调+被动回复
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

  const bodyText = await request.text();

  // 兼容：若收到的是 JSON（部分场景），直接解析 content
  let content = null;
  let fromUser = null;
  let toUser = null;
  let receiveId = '';

  if (bodyText.trim().startsWith('{')) {
    try {
      const j = JSON.parse(bodyText);
      content = (j.text && j.text.content) || '';
      fromUser = j.from && j.from.userid;
      toUser = j.aibotid;
    } catch { /* ignore */ }
  } else {
    const m = bodyText.match(/<Encrypt><!\[CDATA\[([\s\S]*?)\]\]><\/Encrypt>/);
    if (!m) return new Response('bad request', { status: 400 });
    const sig = await wecomSignature(token, timestamp, nonce, m[1]);
    if (sig !== msgSignature) return new Response('signature error', { status: 403 });
    const dec = await wecomDecrypt(m[1], aesKey);
    content = extract(dec.msg, 'Content');
    fromUser = extract(dec.msg, 'FromUserName');
    toUser = extract(dec.msg, 'ToUserName');
    receiveId = dec.receiveId;
  }

  if (!content && fromUser == null) return new Response('');

  let reply = '';
  if (/登录|login/i.test(stripMention(content))) {
    const key = await mintLoginKey(env);
    const loginUrl = url.origin + '/?key=' + key;
    reply = buildTextReply(fromUser || '', toUser || '', '🔐 Personal Hub 登录链接（10 分钟内有效）\n\n' + loginUrl + '\n\n_过期请重新发送「登录」_');
  } else if (/帮助|help/i.test(stripMention(content))) {
    reply = buildTextReply(fromUser || '', toUser || '', '可用命令：\n- **登录**：获取 Personal Hub 登录链接\n- **帮助**：显示此帮助');
  } else if (content) {
    reply = buildTextReply(fromUser || '', toUser || '', '发送「登录」获取 Personal Hub 登录链接；发送「帮助」查看更多。');
  }

  if (!reply) return new Response('');

  const ts = String(Math.floor(Date.now() / 1000));
  const nonce2 = ts + String(Math.floor(Math.random() * 90000) + 10000);
  const enc = await wecomEncrypt(reply, aesKey, receiveId);
  const replySig = await wecomSignature(token, ts, nonce2, enc);
  const out = '<xml>' +
    '<Encrypt><![CDATA[' + enc + ']]></Encrypt>' +
    '<MsgSignature><![CDATA[' + replySig + ']]></MsgSignature>' +
    '<TimeStamp>' + ts + '</TimeStamp>' +
    '<Nonce>' + nonce2 + '</Nonce>' +
    '</xml>';
  return new Response(out, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
