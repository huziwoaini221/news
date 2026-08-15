import { buildUpdate } from '../utils/sql.js';

export async function getTransaction(env, id) {
  return env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first();
}

export async function listTransactions(env, { start, end, type, category, limit = 300 } = {}) {
  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];
  if (start) { sql += ' AND occurred_at >= ?'; params.push(start); }
  if (end) { sql += ' AND occurred_at < ?'; params.push(end); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY occurred_at DESC, id DESC LIMIT ?';
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results;
}

export async function summaryByType(env, { start, end } = {}) {
  let sql = `SELECT type, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
             FROM transactions WHERE 1=1`;
  const params = [];
  if (start) { sql += ' AND occurred_at >= ?'; params.push(start); }
  if (end) { sql += ' AND occurred_at < ?'; params.push(end); }
  sql += ' GROUP BY type';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results;
}

export async function summaryByCategory(env, { start, end } = {}) {
  let sql = `SELECT type, category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
             FROM transactions WHERE 1=1`;
  const params = [];
  if (start) { sql += ' AND occurred_at >= ?'; params.push(start); }
  if (end) { sql += ' AND occurred_at < ?'; params.push(end); }
  sql += ' GROUP BY type, category ORDER BY total DESC';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results;
}

export async function createTransaction(env, data) {
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO transactions (type, amount, category, description, occurred_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.type,
    Number(data.amount),
    data.category || '',
    data.description || '',
    data.occurred_at || now,
    now,
    now
  ).run();
  return getTransaction(env, res.meta.last_row_id);
}

export async function updateTransaction(env, id, data) {
  const upd = buildUpdate('transactions', id, data, ['type', 'amount', 'category', 'description', 'occurred_at']);
  if (upd) {
    await env.DB.prepare(upd.sql).bind(...upd.params).run();
  }
  return getTransaction(env, id);
}

export async function deleteTransaction(env, id) {
  await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
}
