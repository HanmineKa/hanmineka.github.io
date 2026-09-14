/**
 * app.js
 * ------
 * Inisialisasi sql.js, load database tim (dari IndexedDB kalau sudah
 * pernah pakai, atau dari default-data.sqlite kalau pertama kali),
 * render tabel Team Members, dan handle form "Add Team Member".
 *
 * Tidak ada enkripsi — data cuma untuk demo/tugas, tidak sensitif.
 *
 * TODO:
 *  - Download sql-wasm.js + sql-wasm.wasm ke js/vendor/
 *    (lihat js/vendor/README.md)
 */

import { saveDbBytes, loadDbBytes, clearDbBytes } from './idb-helper.js';

let SQL = null;
let db = null;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nim TEXT,
    email TEXT,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    tasks INTEGER NOT NULL DEFAULT 0
  );
`;

async function initApp() {
  setStatus('Loading sql.js...');

  SQL = await initSqlJsGlobal();

  const savedBytes = await loadDbBytes();

  if (savedBytes) {
    db = new SQL.Database(new Uint8Array(savedBytes));
    setStatus('Data loaded from local storage.');
  } else {
    db = await loadDefaultData();
    setStatus('Default data loaded.');
  }

  db.run(SCHEMA_SQL);
  ensureColumn('nim', 'TEXT');
  ensureColumn('email', 'TEXT');
  ensureColumn('status', "TEXT NOT NULL DEFAULT 'Active'");
  ensureColumn('tasks', 'INTEGER NOT NULL DEFAULT 0');

  render();
}

function initSqlJsGlobal() {
  if (typeof window.initSqlJs !== 'function') {
    throw new Error(
      'window.initSqlJs tidak ditemukan — pastikan js/vendor/sql-wasm.js ' +
      'sudah di-download. Lihat js/vendor/README.md.'
    );
  }
  return window.initSqlJs({
    locateFile: (file) => `./js/vendor/${file}`,
  });
}

async function loadDefaultData() {
  const res = await fetch('./data/default-data.sqlite');
  if (!res.ok) {
    throw new Error(`Gagal fetch default-data.sqlite: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const dbDefault = new SQL.Database(new Uint8Array(buf));
  dbDefault.run(SCHEMA_SQL);
  ensureColumnInDatabase(dbDefault, 'nim', 'TEXT');
  ensureColumnInDatabase(dbDefault, 'email', 'TEXT');
  ensureColumnInDatabase(dbDefault, 'status', "TEXT NOT NULL DEFAULT 'Active'");
  ensureColumnInDatabase(dbDefault, 'tasks', 'INTEGER NOT NULL DEFAULT 0');

  const existingRows = dbDefault.prepare('SELECT COUNT(*) AS total FROM team_members').step()
    ? dbDefault.exec('SELECT COUNT(*) AS total FROM team_members')[0].values[0][0]
    : 0;

  if (Number(existingRows) === 0) {
    dbDefault.run(
      'INSERT INTO team_members (name, nim, email, role, status, tasks) VALUES (?, ?, ?, ?, ?, ?)',
      ['Maehwa', '2411500001', 'maehwa@example.com', 'Developer', 'Active', 8]
    );
    dbDefault.run(
      'INSERT INTO team_members (name, nim, email, role, status, tasks) VALUES (?, ?, ?, ?, ?, ?)',
      ['Myosa', '2411500002', 'myosa@example.com', 'Designer', 'Active', 5]
    );
    dbDefault.run(
      'INSERT INTO team_members (name, nim, email, role, status, tasks) VALUES (?, ?, ?, ?, ?, ?)',
      ['Magnolia', '2411500003', 'magnolia@example.com', 'PM', 'Active', 11]
    );
  }

  return dbDefault;
}

async function persist() {
  const bytes = db.export();
  await saveDbBytes(bytes);
}

function queryAllMembers() {
  const stmt = db.prepare('SELECT * FROM team_members ORDER BY id');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function ensureColumnInDatabase(targetDb, columnName, columnDefinition) {
  const info = targetDb.prepare('PRAGMA table_info(team_members)');
  const columns = [];
  while (info.step()) {
    columns.push(info.getAsObject().name);
  }
  info.free();

  if (!columns.includes(columnName)) {
    targetDb.run(`ALTER TABLE team_members ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function ensureColumn(columnName, columnDefinition) {
  ensureColumnInDatabase(db, columnName, columnDefinition);
}

function render() {
  const rows = queryAllMembers();
  const tbody = document.getElementById('team-table-body');
  const badge = document.getElementById('online-badge');

  const activeCount = rows.filter((r) => r.status === 'Active').length;
  badge.textContent = `${activeCount} online`;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="text-muted text-center py-3">No team members yet.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((m) => {
      const statusBadge =
        m.status === 'Active'
          ? '<span class="badge text-bg-success">Active</span>'
          : '<span class="badge text-bg-secondary">Inactive</span>';

      return `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.nim || '-')}</td>
        <td>${escapeHtml(m.role)}</td>
        <td>${statusBadge}</td>
        <td>${m.tasks ?? 0}</td>
        <td class="text-end">
          <button class="btn btn-outline-danger btn-sm" data-action="hapus" data-id="${m.id}">
            Delete
          </button>
        </td>
      </tr>
    `;
    })
    .join('');
}

async function tambahMember(name, nim, email, role, active) {
  db.run(
    'INSERT INTO team_members (name, nim, email, role, status, tasks) VALUES (?, ?, ?, ?, ?, 0)',
    [name, nim, email, role, active ? 'Active' : 'Inactive']
  );
  await persist();
  render();
}

async function hapusMember(id) {
  db.run('DELETE FROM team_members WHERE id = ?', [id]);
  await persist();
  render();
}

async function resetKeDefault() {
  await clearDbBytes();
  db = await loadDefaultData();
  db.run(SCHEMA_SQL);
  await persist();
  render();
  setStatus('Data reset to default.');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
  console.log('[app]', msg);
}

// --- Event wiring ---

document.addEventListener('DOMContentLoaded', () => {
  initApp().catch((err) => {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  });

  document.getElementById('form-register')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const nim = form.nim.value.trim();
    const email = form.email.value.trim();
    const role = form.role.value;
    const active = form.active.checked;
    if (!name || !nim || !email) return;

    tambahMember(name, nim, email, role, active);
    form.reset();
    form.active.checked = true;
  });

  document.getElementById('team-table-body')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="hapus"]');
    if (btn) hapusMember(Number(btn.dataset.id));
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    if (confirm('Reset semua data ke default? Perubahan yang tersimpan akan hilang.')) {
      resetKeDefault();
    }
  });
});
