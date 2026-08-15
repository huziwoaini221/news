const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function nowIso() {
  return new Date().toISOString();
}

// 北京时间（Asia/Shanghai, UTC+8，无夏令时）
// 任意 Date/ISO 字符串 -> 'YYYY-MM-DD'（上海时区日期）
export function formatShanghaiDate(d = new Date()) {
  const sh = new Date(new Date(d).getTime() + SHANGHAI_OFFSET_MS);
  return sh.toISOString().slice(0, 10);
}

// 任意 Date/ISO 字符串 -> 'YYYY-MM-DD HH:mm'（上海时区）
export function formatShanghaiDateTime(d = new Date()) {
  if (!d) return '';
  const sh = new Date(new Date(d).getTime() + SHANGHAI_OFFSET_MS);
  return sh.toISOString().slice(0, 16).replace('T', ' ');
}

// 某个上海日期（或今天）的 00:00 ~ 次日 00:00，对应的 UTC 区间
export function shanghaiDayRange(dateStr, now = new Date()) {
  let shMidnight;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    shMidnight = Date.UTC(y, m - 1, d);
  } else {
    const sh = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
    shMidnight = Date.UTC(sh.getUTCFullYear(), sh.getUTCMonth(), sh.getUTCDate());
  }
  return {
    start: new Date(shMidnight - SHANGHAI_OFFSET_MS),
    end: new Date(shMidnight - SHANGHAI_OFFSET_MS + DAY_MS),
  };
}

// 上海当前月的 UTC 区间
export function shanghaiMonthRange(now = new Date()) {
  const sh = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const start = new Date(Date.UTC(sh.getUTCFullYear(), sh.getUTCMonth(), 1) - SHANGHAI_OFFSET_MS);
  const end = new Date(Date.UTC(sh.getUTCFullYear(), sh.getUTCMonth() + 1, 1) - SHANGHAI_OFFSET_MS);
  return { start, end };
}

// 上海当前年的 UTC 区间
export function shanghaiYearRange(now = new Date()) {
  const sh = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const start = new Date(Date.UTC(sh.getUTCFullYear(), 0, 1) - SHANGHAI_OFFSET_MS);
  const end = new Date(Date.UTC(sh.getUTCFullYear() + 1, 0, 1) - SHANGHAI_OFFSET_MS);
  return { start, end };
}

// 上海本地输入（'YYYY-MM-DD[ HH:mm]'）-> UTC ISO
export function wallToUtcIso(wall) {
  if (!wall) return null;
  const m = String(wall).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +(h || 0), +(mi || 0)) - SHANGHAI_OFFSET_MS).toISOString();
}

// 统一入口：带时区信息（Z 或 ±HH:MM）的输入一律转成标准 UTC ISO；
// 否则视为上海本地时间（wall clock）转换，保证数据库内所有时间都是 UTC、可正确比较
export function normalizeIso(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) {
    const t = new Date(s);
    return isNaN(t.getTime()) ? null : t.toISOString();
  }
  return wallToUtcIso(s);
}
