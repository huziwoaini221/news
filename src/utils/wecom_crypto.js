// 企业微信「智能机器人」URL 回调加解密（与自建应用回调同一套方案）
// 密钥：EncodingAESKey(43字符) -> base64解码 -> 32字节 AES-256-CBC key，IV=key前16字节
// 明文结构：16字节随机 + 4字节大端长度 + 消息体 + receiveId

function toBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function b64ToBytes(b64) {
  return toBytes(b64);
}

function toB64(bytes) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

// 返回 { msg, receiveId }
export async function wecomDecrypt(encryptedB64, aesKeyBytes) {
  const key = await crypto.subtle.importKey('raw', aesKeyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
  const iv = aesKeyBytes.slice(0, 16);
  const dec = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, toBytes(encryptedB64));
  let plain = new Uint8Array(dec);
  const pad = plain[plain.length - 1];
  plain = plain.slice(0, plain.length - pad);
  const len = (plain[16] << 24) | (plain[17] << 16) | (plain[18] << 8) | plain[19];
  const decoder = new TextDecoder();
  return {
    msg: decoder.decode(plain.slice(20, 20 + len)),
    receiveId: decoder.decode(plain.slice(20 + len)),
  };
}

export async function wecomEncrypt(xml, aesKeyBytes, receiveId) {
  const key = await crypto.subtle.importKey('raw', aesKeyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
  const iv = aesKeyBytes.slice(0, 16);
  const random = crypto.getRandomValues(new Uint8Array(16));
  const msg = new TextEncoder().encode(xml);
  const recv = new TextEncoder().encode(receiveId || '');
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, msg.length, false);
  const total = random.length + 4 + msg.length + recv.length;
  const padded = Math.ceil((total + 1) / 32) * 32;
  const buf = new Uint8Array(padded);
  buf.set(random, 0);
  buf.set(lenBytes, 16);
  buf.set(msg, 20);
  buf.set(recv, 20 + msg.length);
  buf.fill(padded - total, total);
  const enc = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, buf);
  return toB64(new Uint8Array(enc));
}

// msg_signature = SHA1(字典序拼接 [token, timestamp, nonce, encrypt])
export async function wecomSignature(token, timestamp, nonce, encrypt) {
  const str = [token, timestamp, nonce, encrypt].sort().join('');
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
