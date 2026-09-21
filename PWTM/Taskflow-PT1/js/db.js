import { loadDbBytes, saveDbBytes } from './idb-helper.js';

let SQL = null;
let db = null;
let migrationNotice = '';

export async function initDatabase() {
  if (db) return db;
  if (typeof window.initSqlJs !== 'function') {
    throw new Error('sql.js is unavailable. Make sure the vendor file has loaded.');
  }

  SQL = await window.initSqlJs({ locateFile: (file) => `./js/vendor/${file}` });
  const savedBytes = await loadDbBytes();
  db = savedBytes ? new SQL.Database(new Uint8Array(savedBytes)) : await loadDefaultDatabase();
  migrateDatabase();
  await persistDatabase();
  return db;
}

async function loadDefaultDatabase() {
  const response = await fetch('./data/default-data.sqlite');
  if (!response.ok) throw new Error(`Failed to load the default database: ${response.status}`);
  return new SQL.Database(new Uint8Array(await response.arrayBuffer()));
}

function migrateDatabase() {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nim TEXT,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    tasks INTEGER NOT NULL DEFAULT 0
  )`);

  ensureColumn('nim', 'TEXT');
  ensureColumn('email', 'TEXT');
  ensureColumn('phone', 'TEXT');
  ensureColumn('status', "TEXT NOT NULL DEFAULT 'Active'");
  ensureColumn('tasks', 'INTEGER NOT NULL DEFAULT 0');
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    member_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'To do',
    due_date TEXT
  )`);

  const version = Number(db.exec('PRAGMA user_version')[0]?.values[0]?.[0] || 0);
  if (version < 2) {
    createLegacyTasks();
    db.run('PRAGMA user_version = 2');
  }
}

function ensureColumn(name, definition) {
  const columns = db.exec('PRAGMA table_info(team_members)')[0]?.values || [];
  if (!columns.some((column) => column[1] === name)) {
    db.run(`ALTER TABLE team_members ADD COLUMN ${name} ${definition}`);
  }
}

function createLegacyTasks() {
  const members = queryAll(`SELECT id, name, tasks FROM team_members WHERE COALESCE(tasks, 0) > 0`);
  for (const member of members) {
    const existing = queryOne('SELECT COUNT(*) AS total FROM tasks WHERE member_id = ?', [member.id]).total;
    const missing = Math.max(Number(member.tasks || 0) - Number(existing || 0), 0);
    for (let index = 1; index <= missing; index += 1) {
      db.run('INSERT INTO tasks (title, member_id, status) VALUES (?, ?, ?)', [`Task ${index}`, member.id, 'To do']);
    }
    if (missing > 0) migrationNotice = 'Legacy tasks were converted into placeholder data.';
  }
}

export async function resetDatabase() {
  db = await loadDefaultDatabase();
  migrateDatabase();
  await persistDatabase();
}

export async function persistDatabase() {
  await saveDbBytes(db.export());
}

export function exportDatabase() {
  return db.export();
}

export function getDatabase() {
  return db;
}

export function queryAll(sql, params = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

export function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || {};
}

export function run(sql, params = []) {
  db.run(sql, params);
}

export function getMigrationNotice() {
  return migrationNotice;
}

export function esc(value) {
  const element = document.createElement('div');
  element.textContent = value ?? '';
  return element.innerHTML;
}

export function formatRole(role) {
  const labels = {
    developer: 'Developer',
    designer: 'Designer',
    pm: 'Project Manager',
    'project-manager': 'Project Manager',
  };
  return labels[String(role || '').toLowerCase()] || role || '-';
}