import { shanghaiDayRange } from '../utils/time.js';
import { buildUpdate } from '../utils/sql.js';

export async function getTask(env, id) {
  return env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
}

export async function listTasks(env, { filter = 'all', limit = 500 } = {}) {
  let sql = 'SELECT * FROM tasks';
  const params = [];
  if (filter === 'today' || filter === 'tomorrow') {
    const offset = filter === 'tomorrow' ? 1 : 0;
    const { start, end } = shanghaiDayRange();
    sql += ' WHERE due_at IS NOT NULL AND due_at >= ? AND due_at < ?';
    params.push(new Date(start.getTime() + offset * 86400000).toISOString());
    params.push(new Date(end.getTime() + offset * 86400000).toISOString());
  } else if (filter === 'pending') {
    sql += " WHERE status = 'pending'";
  } else if (filter === 'completed') {
    sql += " WHERE status = 'completed'";
  }
  sql += ' ORDER BY due_at IS NULL, due_at ASC, created_at DESC LIMIT ?';
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results;
}

export async function createTask(env, data) {
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO tasks (title, description, due_at, reminder_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(
    data.title,
    data.description || '',
    data.due_at || null,
    data.reminder_at || null,
    now,
    now
  ).run();
  return getTask(env, res.meta.last_row_id);
}

export async function updateTask(env, id, data) {
  const upd = buildUpdate('tasks', id, data, ['title', 'description', 'due_at', 'reminder_at', 'status']);
  if (upd) {
    await env.DB.prepare(upd.sql).bind(...upd.params).run();
  }
  return getTask(env, id);
}

export async function deleteTask(env, id) {
  await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
}

export async function completeTask(env, id) {
  return updateTask(env, id, { status: 'completed' });
}
