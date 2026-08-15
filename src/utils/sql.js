// 根据允许的字段集合，动态生成 UPDATE SQL（仅更新传入字段）
export function buildUpdate(table, id, data, allowed) {
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(data[key] === null || data[key] === '' ? null : data[key]);
    }
  }
  if (sets.length === 0) return null;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  return {
    sql: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`,
    params,
  };
}
