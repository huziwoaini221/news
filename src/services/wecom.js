// 企业微信群机器人 Webhook（markdown 消息）
export async function sendWecom(env, text) {
  if (!env.WECOM_WEBHOOK_URL) {
    return { ok: false, error: 'WECOM_WEBHOOK_URL is not configured' };
  }
  const res = await fetch(env.WECOM_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'markdown', markdown: { content: text } }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.errcode === 0) {
    return { ok: true, errcode: 0 };
  }
  return { ok: false, errcode: body.errcode, errmsg: body.errmsg, status: res.status };
}
