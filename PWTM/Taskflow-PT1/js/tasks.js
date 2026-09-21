import { esc, initDatabase, persistDatabase, queryAll, run } from './db.js';

let members = [];

function populateMembers() {
  const options = members.map((member) => `<option value="${member.id}">${esc(member.name)}</option>`).join('');
  document.getElementById('task-member').innerHTML = `<option value="">Unassigned</option>${options}`;
  document.getElementById('filter-member').innerHTML = `<option value="">All assignees</option>${options}`;
}

function render() {
  const status = document.getElementById('filter-status').value;
  const memberId = document.getElementById('filter-member').value;
  const filters = [];
  const params = [];
  if (status) { filters.push('t.status = ?'); params.push(status); }
  if (memberId) { filters.push('t.member_id = ?'); params.push(Number(memberId)); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = queryAll(`SELECT t.*, m.name AS member_name FROM tasks t LEFT JOIN team_members m ON m.id = t.member_id ${where} ORDER BY t.due_date IS NULL, t.due_date, t.id`, params);
  const body = document.getElementById('task-table-body');
  body.innerHTML = rows.length ? rows.map((task) => `
    <tr><td data-label="Title">${esc(task.title)}</td><td data-label="Assignee">${esc(task.member_name || 'Unassigned')}</td><td data-label="Status">${esc(task.status)}</td><td data-label="Due date">${esc(task.due_date || '-')}</td><td data-label="Action" class="text-end"><button class="btn btn-outline-danger btn-sm" data-delete-task="${task.id}">Delete</button></td></tr>
  `).join('') : '<tr><td data-label="" class="text-muted text-center py-3">No tasks found.</td></tr>';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDatabase();
    members = queryAll('SELECT id, name FROM team_members ORDER BY name');
    populateMembers();
    render();
    document.getElementById('status').textContent = 'Tasks loaded from SQLite and persisted in IndexedDB.';
  } catch (error) { document.getElementById('status').textContent = `Error: ${error.message}`; console.error(error); }
  document.getElementById('filter-status').addEventListener('change', render);
  document.getElementById('filter-member').addEventListener('change', render);
  document.getElementById('task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    run('INSERT INTO tasks (title, member_id, status, due_date) VALUES (?, ?, ?, ?)', [form.title.value.trim(), form.member.value ? Number(form.member.value) : null, form.status.value, form.due_date.value || null]);
    await persistDatabase();
    form.reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('task-modal')).hide();
    render();
  });
  document.getElementById('task-table-body').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-task]');
    if (!button) return;
    run('DELETE FROM tasks WHERE id = ?', [Number(button.dataset.deleteTask)]);
    await persistDatabase();
    render();
  });
});