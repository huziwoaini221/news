const AiBot = require('@wecom/aibot-node-sdk');
const fs = require('fs');
const path = require('path');

function loadConfig() {
  const cfg = {};
  const cfgPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(cfgPath)) {
    Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
  }
  return {
    botId: process.env.WECOM_BOT_ID || cfg.botId,
    botSecret: process.env.WECOM_BOT_SECRET || cfg.botSecret,
    phubBase: process.env.PHUB_BASE || cfg.phubBase || 'https://personal-hub.qihangmedical.workers.dev',
    phubBotSecret: process.env.PHUB_BOT_SECRET || cfg.phubBotSecret,
  };
}

const C = loadConfig();
if (!C.botId || !C.botSecret || !C.phubBotSecret) {
  console.error('缺少配置：请编辑 config.json（或环境变量 WECOM_BOT_ID / WECOM_BOT_SECRET / PHUB_BOT_SECRET）');
  process.exit(1);
}

const wsClient = new AiBot.WSClient({ botId: C.botId, secret: C.botSecret });

async function getLoginUrl() {
  const res = await fetch(C.phubBase + '/api/bot/login', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + C.phubBotSecret },
  });
  if (!res.ok) throw new Error('登录链接接口失败: HTTP ' + res.status);
  const data = await res.json();
  return data.url;
}

function normalize(text) {
  return String(text || '').replace(/@.*?\s/g, '').trim();
}

wsClient.on('message.text', async (frame) => {
  const content = normalize(frame.body?.text?.content);
  if (!content) return;
  const streamId = AiBot.generateReqId('stream');
  try {
    if (/登录|login/i.test(content)) {
      await wsClient.replyStream(frame, streamId, '正在生成登录链接...', false);
      const url = await getLoginUrl();
      await wsClient.replyStream(frame, streamId,
        '🔐 **Personal Hub 登录链接**（10 分钟内有效）\n\n' + url + '\n\n_点击链接自动登录，过期请重新发送「登录」_',
        true);
    } else if (/帮助|help/i.test(content)) {
      await wsClient.replyStream(frame, streamId,
        '可用命令：\n- **登录**：获取 Personal Hub 登录链接\n- **帮助**：显示此帮助',
        true);
    } else {
      await wsClient.replyStream(frame, streamId,
        '发送 **登录** 获取 Personal Hub 登录链接；发送 **帮助** 查看更多。',
        true);
    }
  } catch (e) {
    await wsClient.replyStream(frame, streamId, '❌ 生成失败：' + (e.message || e), true);
  }
});

wsClient.on('event.enter_chat', (frame) => {
  wsClient.replyWelcome(frame, {
    msgtype: 'text',
    text: { content: '你好，我是你的个人助理。发送「登录」获取 Personal Hub 登录链接。' },
  });
});

wsClient.on('authenticated', () => console.log('✅ 已连接企业微信智能机器人'));
wsClient.on('connected', () => console.log('🔗 WebSocket 已建立'));
wsClient.on('error', (e) => console.error('⚠️ ', e && e.message ? e.message : e));
wsClient.on('disconnected', (r) => console.log('❌ 已断开：' + r));
wsClient.on('reconnecting', (n) => console.log('🔄 第 ' + n + ' 次重连中...'));

wsClient.connect();

process.on('SIGINT', () => {
  wsClient.disconnect();
  process.exit(0);
});
