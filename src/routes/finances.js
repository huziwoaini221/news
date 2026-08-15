import { json, readBody } from '../utils/auth.js';
import {
  listTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction,
  summaryByType, summaryByCategory,
} from '../db/finances.js';
import { notify } from '../services/notification.js';
import { shanghaiDayRange, shanghaiMonthRange, shanghaiYearRange, normalizeIso } from '../utils/time.js';

function periodRange(period) {
  if (period === 'month') return shanghaiMonthRange();
  if (period === 'year') return shanghaiYearRange();
  return shanghaiDayRange();
}

export async function financesRouter(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    if (method === 'GET' && path === '/api/transactions/summary') {
      const period = url.searchParams.get('period') || 'month';
      const { start, end } = periodRange(period);
      const [byType, byCategory] = await Promise.all([
        summaryByType(env, { start: start.toISOString(), end: end.toISOString() }),
        summaryByCategory(env, { start: start.toISOString(), end: end.toISOString() }),
      ]);
      const byTypeMap = {};
      for (const r of byType) byTypeMap[r.type] = r;
      return json({
        period,
        start: start.toISOString(),
        end: end.toISOString(),
        income: byTypeMap.income ? Number(byTypeMap.income.total) : 0,
        expense: byTypeMap.expense ? Number(byTypeMap.expense.total) : 0,
        income_count: byTypeMap.income ? byTypeMap.income.cnt : 0,
        expense_count: byTypeMap.expense ? byTypeMap.expense.cnt : 0,
        categories: byCategory,
      });
    }

    if (method === 'GET' && path === '/api/transactions') {
      const period = url.searchParams.get('period');
      const params = { type: url.searchParams.get('type') || undefined };
      if (period) {
        const { start, end } = periodRange(period);
        params.start = start.toISOString();
        params.end = end.toISOString();
      } else {
        params.start = url.searchParams.get('start') || undefined;
        params.end = url.searchParams.get('end') || undefined;
      }
      return json({ transactions: await listTransactions(env, params) });
    }

    if (method === 'POST' && path === '/api/transactions') {
      const body = await readBody(request);
      if (!body.type || !['income', 'expense'].includes(body.type)) {
        return json({ error: 'type must be income or expense' }, 400);
      }
      if (body.amount === undefined || Number.isNaN(Number(body.amount))) {
        return json({ error: 'amount is required' }, 400);
      }
      const tx = await createTransaction(env, {
        ...body,
        occurred_at: normalizeIso(body.occurred_at) || new Date().toISOString(),
      });
      const category = tx.category || '未分类';
      const message = [
        '💰 记账成功',
        `${tx.type === 'income' ? '收入' : '支出'} ¥${Number(tx.amount).toFixed(2)}`,
        `${category}${tx.description ? '｜' + tx.description : ''}`,
      ].join('\n');
      ctx.waitUntil(notify(env, { source: 'finances', eventType: 'transaction_created', message, payload: tx }));
      return json({ transaction: tx }, 201);
    }

    const m = path.match(/^\/api\/transactions\/(\d+)$/);
    if (!m) return json({ error: 'not found' }, 404);
    const id = m[1];

    if (method === 'GET') {
      const tx = await getTransaction(env, id);
      return tx ? json({ transaction: tx }) : json({ error: 'not found' }, 404);
    }

    if (method === 'PATCH') {
      const body = await readBody(request);
      const tx = await updateTransaction(env, id, {
        ...body,
        occurred_at: body.occurred_at !== undefined
          ? (normalizeIso(body.occurred_at) || new Date().toISOString())
          : undefined,
      });
      return tx ? json({ transaction: tx }) : json({ error: 'not found' }, 404);
    }

    if (method === 'DELETE') {
      await deleteTransaction(env, id);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
