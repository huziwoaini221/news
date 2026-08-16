import { notify } from './notification.js';
import {
  formatShanghaiDate,
  formatShanghaiDateTime,
  shanghaiDayRange,
  shanghaiMonthRange,
  shanghaiYearRange,
} from '../utils/time.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// wttr.in 英文天气描述 -> 中文（免费、无 key、支持中文地名定位）
const WTTR_ZH = {
  'Sunny': '晴', 'Clear': '晴',
  'Partly cloudy': '多云', 'Partly Cloudy': '多云', 'Partly cloudy ': '多云',
  'Cloudy': '阴', 'Overcast': '阴',
  'Mist': '雾', 'Fog': '雾', 'Freezing fog': '冻雾',
  'Light drizzle': '毛毛雨',
  'Light rain': '小雨', 'Light rain shower': '小雨', 'Light rain showers': '小雨',
  'Patchy rain nearby': '阵雨', 'Patchy light rain': '阵雨', 'Moderate rain': '中雨',
  'Moderate rain at times': '中雨', 'Heavy rain': '大雨', 'Heavy rain at times': '大雨',
  'Heavy rain shower': '大雨', 'Heavy rain showers': '大雨',
  'Light sleet': '雨夹雪', 'Light freezing rain': '冻雨',
  'Patchy light snow': '小雪', 'Light snow': '小雪', 'Moderate snow': '中雪',
  'Heavy snow': '大雪', 'Blowing snow': '大风雪',
  'Patchy light rain with thunder': '雷阵雨', 'Thundery outbreaks possible': '雷阵雨',
  'Moderate or heavy rain with thunder': '雷阵雨', 'Patchy light snow with thunder': '雷阵雪',
};

// 城市名归一化到地级市：江西省上饶市广丰区 -> 上饶；北京 -> 北京；广州 -> 广州
function weatherLocName(city) {
  let s = city.replace(/^[^省]*省/, '');
  s = s.replace(/^(.+市).*$/, '$1');
  return s.replace(/市$/, '');
}

// 无 WEATHER_CITY 或定位失败时返回 null（天气板块隐藏）
export async function fetchWeather(env) {
  const raw = String(env.WEATHER_CITY || '').trim();
  if (!raw) return null;
  const name = weatherLocName(raw);
  if (!name) return null;
  try {
    const res = await fetch('https://wttr.in/' + encodeURIComponent(name) + '?format=j1');
    if (!res.ok) return null;
    const j = await res.json();
    const cur = j.current_condition && j.current_condition[0];
    const today = j.weather && j.weather[0];
    if (!cur || !today) return null;
    const desc = (cur.weatherDesc && cur.weatherDesc[0] && cur.weatherDesc[0].value) || '';
    return {
      city: name,
      text: WTTR_ZH[desc] || desc,
      max: Math.round(Number(today.maxtempC) || 0),
      min: Math.round(Number(today.mintempC) || 0),
    };
  } catch {
    return null;
  }
}

function fmtMoney(r) {
  const map = {};
  for (const x of r.results || []) map[x.type] = Number(x.total);
  return `支出 ¥${(map.expense || 0).toFixed(2)} · 收入 ¥${(map.income || 0).toFixed(2)}`;
}

// 纯函数组装晨报文本，便于测试
export function buildMorningMessage({ reportDate, tasks, events, overdue, finYesterday, finMonth, finYear, weather }) {
  const [y, m, d] = reportDate.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const lines = [`☀️ ${m}月${d}日 周${wd} · 早安`];

  if (weather) {
    lines.push(`🏙️ ${weather.city} ${weather.text} ${weather.max}°/${weather.min}°`);
  }

  const tasksList = tasks || [];
  if (tasksList.length) {
    lines.push('', `📋 今日任务 ${tasksList.length} 项`);
    tasksList.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.due_at ? formatShanghaiDateTime(t.due_at).slice(11) : ''} ${t.title}`);
    });
  }

  const eventsList = events || [];
  if (eventsList.length) {
    lines.push('', `📅 今日日程 ${eventsList.length} 个`);
    eventsList.forEach((ev) => {
      lines.push(`- ${formatShanghaiDateTime(ev.start_at).slice(11)} ${ev.title}${ev.location ? ' @' + ev.location : ''}`);
    });
  }

  if (overdue && overdue.c > 0) {
    lines.push('', `⚠️ ${overdue.c} 项任务已过期`);
  }

  if ([finYesterday, finMonth, finYear].some((r) => (r.results || []).length)) {
    lines.push('', '💰 财务');
    lines.push(`昨日　${fmtMoney(finYesterday)}`);
    lines.push(`本月　${fmtMoney(finMonth)}`);
    lines.push(`今年　${fmtMoney(finYear)}`);
  }

  return lines.join('\n').replace(/\n{2,}/g, '\n').trim();
}

// 每日晨报：任务/日历/财务/天气，只汇总 Worker 自己管理的数据，不读取课时数据
// 幂等：morning_reports.report_date 有 UNIQUE 约束
export async function runMorningReport(env) {
  const reportDate = formatShanghaiDate();
  const now = new Date();
  const { start, end } = shanghaiDayRange(reportDate, now);
  const { start: yStart } = shanghaiDayRange(formatShanghaiDate(new Date(start.getTime() - 1000)), now);
  const month = shanghaiMonthRange(now);
  const year = shanghaiYearRange(now);
  const nowIso = now.toISOString();

  const existing = await env.DB.prepare('SELECT * FROM morning_reports WHERE report_date = ?').bind(reportDate).first();
  if (existing) {
    return { skipped: true, report_date: reportDate, status: existing.status };
  }

  // 预占 report_date（UNIQUE 兜底，防并发/双触发器）
  let insert;
  try {
    insert = await env.DB.prepare(
      `INSERT INTO morning_reports (report_date, status, created_at) VALUES (?, 'sending', ?)`
    ).bind(reportDate, nowIso).run();
  } catch (e) {
    if (String(e.message || e).toUpperCase().includes('UNIQUE')) {
      return { skipped: true, report_date: reportDate, status: 'already_sent' };
    }
    throw e;
  }

  const [tasks, events, finYesterday, finMonth, finYear, overdue, weather] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM tasks WHERE status = 'pending' AND due_at IS NOT NULL AND due_at >= ? AND due_at < ? ORDER BY due_at ASC`
    ).bind(start.toISOString(), end.toISOString()).all(),
    env.DB.prepare(
      `SELECT * FROM calendar_events WHERE status = 'scheduled' AND start_at IS NOT NULL AND start_at >= ? AND start_at < ? ORDER BY start_at ASC`
    ).bind(start.toISOString(), end.toISOString()).all(),
    env.DB.prepare(
      `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE occurred_at >= ? AND occurred_at < ? GROUP BY type`
    ).bind(yStart.toISOString(), start.toISOString()).all(),
    env.DB.prepare(
      `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE occurred_at >= ? AND occurred_at < ? GROUP BY type`
    ).bind(month.start.toISOString(), month.end.toISOString()).all(),
    env.DB.prepare(
      `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE occurred_at >= ? AND occurred_at < ? GROUP BY type`
    ).bind(year.start.toISOString(), year.end.toISOString()).all(),
    env.DB.prepare(
      `SELECT COUNT(*) AS c FROM tasks WHERE status = 'pending' AND due_at IS NOT NULL AND due_at < ?`
    ).bind(start.toISOString()).first(),
    fetchWeather(env),
  ]);

  const message = buildMorningMessage({
    reportDate,
    tasks: (tasks.results || []),
    events: (events.results || []),
    overdue,
    finYesterday,
    finMonth,
    finYear,
    weather,
  });

  const res = await notify(env, {
    source: 'morning_report',
    eventType: 'morning_report',
    message,
    payload: { report_date: reportDate },
  });

  if (res.ok) {
    await env.DB.prepare(`UPDATE morning_reports SET status = 'success', sent_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), insert.meta.last_row_id).run();
    return { ok: true, report_date: reportDate, status: 'success', log_id: res.log_id };
  }

  // 发送失败则删除占位，允许下一次 Cron 重试
  await env.DB.prepare(`DELETE FROM morning_reports WHERE id = ?`).bind(insert.meta.last_row_id).run();
  return { ok: false, report_date: reportDate, status: 'failed', error: res.error };
}
