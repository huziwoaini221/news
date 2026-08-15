import { json, readBody } from '../utils/auth.js';
import { listContacts, getContact, createContact, updateContact, deleteContact } from '../db/contacts.js';
import { notify } from '../services/notification.js';

export async function contactsRouter(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    if (method === 'GET' && path === '/api/contacts') {
      const q = url.searchParams.get('q') || '';
      return json({ contacts: await listContacts(env, { q }) });
    }

    if (method === 'POST' && path === '/api/contacts') {
      const body = await readBody(request);
      if (!body.name) return json({ error: 'name is required' }, 400);
      const contact = await createContact(env, body);
      const message = `👤 联系人已添加\n${contact.name}${contact.phone ? '\n📞 ' + contact.phone : ''}${contact.company ? '\n🏢 ' + contact.company : ''}`;
      ctx.waitUntil(notify(env, { source: 'contacts', eventType: 'contact_created', message, payload: contact }));
      return json({ contact }, 201);
    }

    const m = path.match(/^\/api\/contacts\/(\d+)$/);
    if (!m) return json({ error: 'not found' }, 404);
    const id = m[1];

    if (method === 'GET') {
      const contact = await getContact(env, id);
      return contact ? json({ contact }) : json({ error: 'not found' }, 404);
    }

    if (method === 'PATCH') {
      const body = await readBody(request);
      const contact = await updateContact(env, id, body);
      return contact ? json({ contact }) : json({ error: 'not found' }, 404);
    }

    if (method === 'DELETE') {
      const contact = await getContact(env, id);
      if (!contact) return json({ error: 'not found' }, 404);
      await deleteContact(env, id);
      ctx.waitUntil(notify(env, { source: 'contacts', eventType: 'contact_deleted', message: `🗑️ 联系人已删除\n${contact.name}`, payload: contact }));
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
