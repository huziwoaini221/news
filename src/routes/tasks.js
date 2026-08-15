import { json, readBody } from '../utils/auth.js';
import { listTasks, getTask, createTask, updateTask, deleteTask } from '../db/tasks.js';
import { notify } from '../services/notification.js';
import { formatShanghaiDateTime, normalizeIso } from '../utils/time.js';

export async function tasksRouter(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    if (method === 'GET' && path === '/api/tasks') {
      const filter = url.searchParams.get('filter') || 'all';
      return json({ tasks: await listTasks(env, { filter }) });
    }

    if (method === 'POST' && path === '/api/tasks') {
      const body = await readBody(request);
      if (!body.title) return json({ error: 'title is required' }, 400);
      const task = await createTask(env, {
        ...body,
        due_at: normalizeIso(body.due_at),
        reminder_at: normalizeIso(body.reminder_at),
      });
      const message = `📋 任务已添加\n${task.title}\n${task.due_at ? '⏰ ' + formatShanghaiDateTime(task.due_at) : ''}`;
      ctx.waitUntil(notify(env, { source: 'tasks', eventType: 'task_created', message, payload: task }));
      return json({ task }, 201);
    }

    const m = path.match(/^\/api\/tasks\/(\d+)$/);
    if (!m) return json({ error: 'not found' }, 404);
    const id = m[1];

    if (method === 'GET') {
      const task = await getTask(env, id);
      return task ? json({ task }) : json({ error: 'not found' }, 404);
    }

    if (method === 'PATCH') {
      const body = await readBody(request);
      const task = await updateTask(env, id, {
        ...body,
        due_at: body.due_at !== undefined ? normalizeIso(body.due_at) : undefined,
        reminder_at: body.reminder_at !== undefined ? normalizeIso(body.reminder_at) : undefined,
      });
      if (!task) return json({ error: 'not found' }, 404);
      if (task.status === 'completed') {
        ctx.waitUntil(notify(env, { source: 'tasks', eventType: 'task_completed', message: `✅ 任务完成\n${task.title}`, payload: task }));
      }
      return json({ task });
    }

    if (method === 'DELETE') {
      const task = await getTask(env, id);
      if (!task) return json({ error: 'not found' }, 404);
      await deleteTask(env, id);
      ctx.waitUntil(notify(env, { source: 'tasks', eventType: 'task_deleted', message: `🗑️ 任务已删除\n${task.title}`, payload: task }));
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
