import { buildUpdate } from '../utils/sql.js';

export async function getContact(env, id) {
  return env.DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
}

export async function listContacts(env, { q = '', limit = 500 } = {}) {
  let sql = 'SELECT * FROM contacts';
  const params = [];
  if (q) {
    sql += ' WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ? OR note LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY name ASC, id DESC LIMIT ?';
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results;
}

export async function createContact(env, data) {
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO contacts (name, phone, email, company, position, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.name,
    data.phone || '',
    data.email || '',
    data.company || '',
    data.position || '',
    data.note || '',
    now,
    now
  ).run();
  return getContact(env, res.meta.last_row_id);
}

export async function updateContact(env, id, data) {
  const upd = buildUpdate('contacts', id, data, ['name', 'phone', 'email', 'company', 'position', 'note']);
  if (upd) {
    await env.DB.prepare(upd.sql).bind(...upd.params).run();
  }
  return getContact(env, id);
}

export async function deleteContact(env, id) {
  await env.DB.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run();
}
