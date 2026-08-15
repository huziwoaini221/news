import { json, readBody } from '../utils/auth.js';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '../db/calendar.js';
import { notify } from '../services/notification.js';
import { formatShanghaiDateTime, shanghaiDayRange, normalizeIso } from '../utils/time.js';

export async function calendarRouter(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    if (method === 'GET' && path === '/api/events') {
      let { start, end } = Object.fromEntries(url.searchParams);
      if (!start && !end) {
        const day = url.searchParams.get('day') === 'week'
          ? { start: shanghaiDayRange().start, end: new Date(shanghaiDayRange().start.getTime() + 7 * 86400000) }
          : shanghaiDayRange();
        start = day.start.toISOString();
        end = day.end.toISOString();
      }
      return json({ events: await listEvents(env, { start, end }) });
    }

    if (method === 'POST' && path === '/api/events') {
      const body = await readBody(request);
      if (!body.title) return json({ error: 'title is required' }, 400);
      const event = await createEvent(env, {
        ...body,
        start_at: normalizeIso(body.start_at),
        end_at: normalizeIso(body.end_at),
        reminder_at: normalizeIso(body.reminder_at),
      });
      const message = `📅 日程已添加\n${event.title}\n${event.start_at ? '🕐 ' + formatShanghaiDateTime(event.start_at) : ''}${event.location ? '\n📍 ' + event.location : ''}`;
      ctx.waitUntil(notify(env, { source: 'calendar', eventType: 'event_created', message, payload: event }));
      return json({ event }, 201);
    }

    const m = path.match(/^\/api\/events\/(\d+)$/);
    if (!m) return json({ error: 'not found' }, 404);
    const id = m[1];

    if (method === 'GET') {
      const event = await getEvent(env, id);
      return event ? json({ event }) : json({ error: 'not found' }, 404);
    }

    if (method === 'PATCH') {
      const body = await readBody(request);
      const event = await updateEvent(env, id, {
        ...body,
        start_at: body.start_at !== undefined ? normalizeIso(body.start_at) : undefined,
        end_at: body.end_at !== undefined ? normalizeIso(body.end_at) : undefined,
        reminder_at: body.reminder_at !== undefined ? normalizeIso(body.reminder_at) : undefined,
      });
      return event ? json({ event }) : json({ error: 'not found' }, 404);
    }

    if (method === 'DELETE') {
      await deleteEvent(env, id);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
