import { buildUpdate } from '../utils/sql.js';

export async function getEvent(env, id) {
  return env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();
}

export async function listEvents(env, { start, end, limit = 500 } = {}) {
  let sql = 'SELECT * FROM calendar_events';
  const params = [];
  const where = [];
  if (start) { where.push('start_at >= ?'); params.push(start); }
  if (end) { where.push('start_at < ?'); params.push(end); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY start_at IS NULL, start_at ASC, created_at DESC LIMIT ?';
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results;
}

export async function createEvent(env, data) {
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO calendar_events (title, start_at, end_at, location, description, reminder_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`
  ).bind(
    data.title,
    data.start_at || null,
    data.end_at || null,
    data.location || '',
    data.description || '',
    data.reminder_at || null,
    now,
    now
  ).run();
  return getEvent(env, res.meta.last_row_id);
}

export async function updateEvent(env, id, data) {
  const upd = buildUpdate('calendar_events', id, data, ['title', 'start_at', 'end_at', 'location', 'description', 'reminder_at', 'status']);
  if (upd) {
    await env.DB.prepare(upd.sql).bind(...upd.params).run();
  }
  return getEvent(env, id);
}

export async function deleteEvent(env, id) {
  await env.DB.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run();
}
