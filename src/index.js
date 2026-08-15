import { checkAuth, json } from './utils/auth.js';
import { tasksRouter } from './routes/tasks.js';
import { calendarRouter } from './routes/calendar.js';
import { contactsRouter } from './routes/contacts.js';
import { financesRouter } from './routes/finances.js';
import { notificationRouter } from './routes/notification.js';
import { remindersRouter } from './routes/reminders.js';
import { morningRouter } from './routes/morning.js';
import { botLoginRouter } from './routes/bot.js';
import { botCallbackRouter } from './routes/botcallback.js';

const apiRoutes = [
  { prefix: '/api/tasks', handler: tasksRouter },
  { prefix: '/api/events', handler: calendarRouter },
  { prefix: '/api/contacts', handler: contactsRouter },
  { prefix: '/api/transactions', handler: financesRouter },
  { prefix: '/api/notify', handler: notificationRouter },
  { prefix: '/api/check-reminders', handler: remindersRouter },
  { prefix: '/api/morning-report', handler: morningRouter },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 鉴权探测（Web UI 登录用）
    if (path === '/api/ping') {
      return (await checkAuth(request, env)) ? json({ ok: true }) : json({ error: 'unauthorized' }, 401);
    }

    // 智能机器人专用：换取登录链接（BOT_SECRET 鉴权）
    if (path === '/api/bot/login') {
      return botLoginRouter(request, env);
    }

    // 智能机器人 URL 回调（自有签名/加解密，不走 checkAuth）
    if (path === '/api/bot/callback') {
      return botCallbackRouter(request, env, url);
    }

    for (const route of apiRoutes) {
      if (path.startsWith(route.prefix)) {
        if (!(await checkAuth(request, env))) {
          return json({ error: 'unauthorized' }, 401);
        }
        return route.handler(request, env, ctx, url);
      }
    }

    // 其余路径交给静态资源（Web UI）
    return env.ASSETS.fetch(request);
  },
};
