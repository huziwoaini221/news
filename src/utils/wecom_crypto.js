// 企业微信「智能机器人」URL 回调加解密（PKCS7 填充块大小为 32，非标准 16）
// 密钥：EncodingAESKey(43字符) -> base64解码 -> 32字节 AES-256-CBC key，IV=key前16字节
// 明文结构：16字节随机 + 4字节大端长度 + 消息体 + receiveId（智能机器人场景 receiveId 为空）
// 注意：WebCrypto 的 AES-CBC 按标准 16 字节块做 PKCS7 校验，与企业微信的 32 边界填充不兼容，
// 因此解密时附加一个伪造密文块绕过校验，加密时丢弃末尾多余的填充块。

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

const BLOCK = 16;
const PAD_BLOCK = new Uint8Array(BLOCK).fill(0x10);

// 返回 { msg, receiveId }
export async function wecomDecrypt(encryptedB64, aesKeyBytes) {
  const key = await crypto.subtle.importKey('raw', aesKeyBytes, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
  const iv = aesKeyBytes.slice(0, 16);
  const ct = toBytes(encryptedB64);
  // 构造伪造块 fake，使 AES_DEC(fake) XOR 末尾密文块 = 全 0x10（合法 PKCS7-16）
  const last = ct.slice(ct.length - BLOCK);
  const t = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) t[i] = 0x10 ^ last[i];
  const fake = new Uint8Array((await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(BLOCK) }, key, t)).slice(0, BLOCK));
  const input = new Uint8Array(ct.length + BLOCK);
  input.set(ct, 0);
  input.set(fake, ct.length);
  const dec = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, input);
  // 手动去除企业微信 PKCS7-32 填充
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
  // WebCrypto 会额外追加一个 PKCS7-16 填充块，丢弃末尾 16 字节
  const all = new Uint8Array(enc);
  return toB64(all.slice(0, all.length - BLOCK));
}

// msg_signature = SHA1(字典序拼接 [token, timestamp, nonce, encrypt])
export async function wecomSignature(token, timestamp, nonce, encrypt) {
  const str = [token, timestamp, nonce, encrypt].sort().join('');
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
