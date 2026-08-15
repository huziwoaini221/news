-- 0001_init.sql
-- 个人工具中枢 D1 初始化
-- 规则：所有时间字段统一存储 UTC ISO-8601；业务时区 Asia/Shanghai (UTC+8)

CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_at      TEXT,            -- UTC
    reminder_at TEXT,            -- UTC
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending / completed / cancelled
    created_at  TEXT NOT NULL,   -- UTC
    updated_at  TEXT NOT NULL    -- UTC
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_at     ON tasks (due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_reminder   ON tasks (reminder_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks (status);

CREATE TABLE IF NOT EXISTS calendar_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    start_at    TEXT,            -- UTC
    end_at      TEXT,            -- UTC
    location    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    reminder_at TEXT,            -- UTC
    status      TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled / cancelled
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events (start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_reminder ON calendar_events (reminder_at);

CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    company    TEXT NOT NULL DEFAULT '',
    position   TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (name);

CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount      REAL NOT NULL,
    category    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    occurred_at TEXT NOT NULL,   -- UTC
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions (occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);

CREATE TABLE IF NOT EXISTS notification_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,          -- tasks / calendar / contacts / finances / lessons / morning_report
    event_type  TEXT NOT NULL,
    payload     TEXT NOT NULL DEFAULT '',
    message     TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL,          -- success / failed
    retry_count INTEGER NOT NULL DEFAULT 0,
    error       TEXT,
    created_at  TEXT NOT NULL,
    sent_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_source ON notification_logs (source, created_at);

CREATE TABLE IF NOT EXISTS morning_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date TEXT NOT NULL UNIQUE,   -- '2026-08-15' (Asia/Shanghai)
    status      TEXT NOT NULL,          -- success / failed / skipped
    sent_at     TEXT,
    created_at  TEXT NOT NULL
);
