import { requireAuth } from './auth.js';
import {
  esc,
  exportDatabase,
  formatRole,
  getMigrationNotice,
  initDatabase,
  logActivity,
  persistDatabase,
  queryAll,
  queryOne,
  resetDatabase,
  run,
} from './db.js';

function renderDashboard() {
  const members = queryOne(`SELECT
    COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) AS active
    FROM team_members`);
  const tasks = queryOne(`SELECT
    COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN status = 'To do' THEN 1 ELSE 0 END), 0) AS todo,
    COALESCE(SUM(CASE WHEN status = 'Doing' THEN 1 ELSE 0 END), 0) AS doing,
    COALESCE(SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END), 0) AS done
    FROM tasks`);
  const deadlines = queryAll(`SELECT t.title, t.due_date, m.name AS member_name
    FROM tasks t LEFT JOIN team_members m ON m.id = t.member_id
    WHERE t.status != 'Done' AND date(t.due_date) <= date('now', '+7 days')
    ORDER BY date(t.due_date), t.id LIMIT 5`);
  const deadlineCount = queryOne(`SELECT COUNT(*) AS total FROM tasks
    WHERE status != 'Done' AND date(due_date) <= date('now', '+7 days')`).total;
  const activities = queryAll('SELECT description, created_at FROM activity_log ORDER BY id DESC LIMIT 5');
  const totalTasks = Number(tasks.total || 0);
  const todoPercentage = totalTasks ? Math.round((Number(tasks.todo || 0) / totalTasks) * 100) : 0;
  const doingPercentage = totalTasks ? Math.round((Number(tasks.doing || 0) / totalTasks) * 100) : 0;
  const donePercentage = totalTasks ? 100 - todoPercentage - doingPercentage : 0;
  const taskChart = document.getElementById('dashboard-task-chart');
  taskChart.style.setProperty('--todo', `${todoPercentage}%`);
  taskChart.style.setProperty('--doing', `${todoPercentage + doingPercentage}%`);
  taskChart.setAttribute('aria-label', `Task status: ${todoPercentage}% To do, ${doingPercentage}% Doing, ${donePercentage}% Done`);
  document.getElementById('dashboard-task-legend').innerHTML = [
    ['To do', tasks.todo, todoPercentage, 'legend-todo'],
    ['Doing', tasks.doing, doingPercentage, 'legend-doing'],
    ['Done', tasks.done, donePercentage, 'legend-done'],
  ].map(([label, count, taskPercentage, swatch]) => `
    <div><span class="legend-swatch ${swatch}"></span><span>${label}</span><strong>${Number(count || 0)} · ${taskPercentage}%</strong></div>
  `).join('');
  const stats = [
    ['Total members', members.total, 'All team members'],
    ['Active members', members.active, 'Currently active'],
    ['Total tasks', tasks.total, `${donePercentage}% complete`],
    ['To do', tasks.todo, 'Not started'],
    ['Doing', tasks.doing, 'In progress'],
    ['Done', tasks.done, 'Completed'],
  ];

  document.getElementById('dashboard-stats').innerHTML = stats.map(([label, value, detail]) => `
    <div class="col"><div class="dashboard-stat bg-light rounded p-3 h-100">
      <div class="small text-secondary">${label}</div>
      <div class="fs-4 fw-semibold">${Number(value || 0)}</div>
      <div class="small text-secondary">${detail}</div>
    </div></div>
  `).join('');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  document.getElementById('dashboard-deadline-count').textContent = `${Number(deadlineCount || 0)} tasks`;
  document.getElementById('dashboard-deadlines').innerHTML = deadlines.length ? `
    <ul class="list-group list-group-flush dashboard-list">${deadlines.map((task) => {
      const dueDate = new Date(`${task.due_date}T00:00:00`);
      const daysUntilDue = Math.ceil((dueDate - today) / 86400000);
      const dueLabel = daysUntilDue < 0 ? 'Overdue' : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days left`;
      const badgeClass = daysUntilDue < 0 ? 'text-bg-danger' : daysUntilDue === 0 ? 'text-bg-warning' : 'text-bg-light';
      const formattedDate = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(dueDate);
      return `<li class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center gap-3">
        <div class="min-w-0"><strong class="d-block text-truncate">${esc(task.title)}</strong><span class="small text-secondary">${esc(task.member_name || 'Unassigned')}</span></div>
        <div class="text-end flex-shrink-0"><span class="badge ${badgeClass}">${dueLabel}</span><time class="d-block small text-secondary mt-1">${formattedDate}</time></div>
      </li>`;
    }).join('')}</ul>` : '<p class="small text-secondary mb-0">No overdue tasks or upcoming deadlines in the next 7 days.</p>';

  document.getElementById('dashboard-activity-count').textContent = `${activities.length} recent`;
  document.getElementById('dashboard-activity').innerHTML = activities.length ? `
    <ul class="list-group list-group-flush dashboard-list">${activities.map((activity) => {
      const date = new Date(`${activity.created_at.replace(' ', 'T')}Z`);
      const timestamp = Number.isNaN(date.getTime()) ? activity.created_at : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
      return `<li class="list-group-item px-0 py-2"><span class="d-block">${esc(activity.description)}</span><time class="small text-secondary">${esc(timestamp)}</time></li>`;
    }).join('')}</ul>` : '<p class="small text-secondary mb-0">No recent activity yet. New changes will appear here.</p>';

  document.getElementById('dashboard-updated').textContent = `Updated ${new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
}

function render() {
  renderDashboard();
  const rows = queryAll(`
    SELECT m.*, COUNT(DISTINCT t.id) AS task_count
    FROM team_members m
    LEFT JOIN task_assignments ON task_assignments.member_id = m.id
    LEFT JOIN tasks t ON t.id = task_assignments.task_id
    GROUP BY m.id
    ORDER BY m.id
  `);
  const tbody = document.getElementById('team-table-body');
  const badge = document.getElementById('online-badge');
  const status = document.getElementById('status');
  badge.textContent = `${rows.filter((row) => row.status === 'Active').length} online`;
  status.textContent = getMigrationNotice() || 'Team data loaded from SQLite and persisted in IndexedDB.';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td data-label="" class="text-muted text-center py-3">No team members yet.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((member) => `
    <tr>
      <td data-label="Name"><a class="member-name text-decoration-none" href="profile.html?id=${member.id}">${esc(member.name)}</a></td>
      <td data-label="NIM">${esc(member.nim || '-')}</td>
      <td data-label="Role">${esc(formatRole(member.role))}</td>
      <td data-label="Status">${member.status === 'Active' ? '<span class="badge text-bg-success">Active</span>' : '<span class="badge text-bg-secondary">Inactive</span>'}</td>
      <td data-label="Tasks">${Number(member.task_count || 0)}</td>
      <td data-label="Action" class="text-end">
        <div class="team-actions d-flex justify-content-end flex-wrap gap-2">
          <a class="btn btn-outline-primary btn-sm" href="profile.html?id=${member.id}">Profile</a>
          <button class="btn btn-outline-secondary btn-sm" data-action="edit" data-id="${member.id}">Edit</button>
          <button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${member.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function addMember(form) {
  run('INSERT INTO team_members (name, nim, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)', [
    form.name.value.trim(), form.nim.value.trim() || null, form.email.value.trim() || null,
    form.phone.value.trim() || null, form.role.value, form.active.checked ? 'Active' : 'Inactive',
  ]);
  await persistDatabase();
  render();
}

function prepareMemberForm(member = null) {
  const form = document.getElementById('form-register');
  form.reset();
  form.elements.id.value = member?.id || '';
  form.name.value = member?.name || '';
  form.nim.value = member?.nim || '';
  form.email.value = member?.email || '';
  form.phone.value = member?.phone || '';
  form.role.value = member?.role || 'developer';
  form.active.checked = member ? member.status === 'Active' : true;
  document.getElementById('member-modal-label').textContent = member ? 'Edit Team Member' : 'Add Team Member';
  form.querySelector('[type="submit"]').textContent = member ? 'Save Changes' : 'Add Member';
}

async function saveMember(form) {
  const memberName = form.name.value.trim();
  const isEditing = Boolean(form.elements.id.value);
  const values = [
    memberName, form.nim.value.trim() || null, form.email.value.trim() || null,
    form.phone.value.trim() || null, form.role.value, form.active.checked ? 'Active' : 'Inactive',
  ];
  if (isEditing) {
    run('UPDATE team_members SET name = ?, nim = ?, email = ?, phone = ?, role = ?, status = ? WHERE id = ?', [...values, Number(form.elements.id.value)]);
  } else {
    run('INSERT INTO team_members (name, nim, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)', values);
  }
  logActivity(`${isEditing ? 'Updated' : 'Added'} team member: ${memberName}`);
  await persistDatabase();
  render();
}

function downloadDatabase() {
  const blob = new Blob([exportDatabase()], { type: 'application/vnd.sqlite3' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `taskflow-${new Date().toISOString().slice(0, 10)}.sqlite`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  try {
    await initDatabase();
    render();
  } catch (error) {
    document.getElementById('status').textContent = `Error: ${error.message}`;
    console.error(error);
  }

  document.getElementById('form-register')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.name.value.trim()) return;
    await saveMember(form);
    prepareMemberForm();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('member-modal')).hide();
  });

  document.getElementById('team-table-body')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'edit') {
      prepareMemberForm(queryOne('SELECT * FROM team_members WHERE id = ?', [Number(button.dataset.id)]));
      bootstrap.Modal.getOrCreateInstance(document.getElementById('member-modal')).show();
      return;
    }
    const member = queryOne('SELECT name FROM team_members WHERE id = ?', [Number(button.dataset.id)]);
    run('DELETE FROM team_members WHERE id = ?', [Number(button.dataset.id)]);
    logActivity(`Removed team member: ${member.name || 'Unknown'}`);
    await persistDatabase();
    render();
  });

  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    if (!confirm('Reset all data to default? All saved changes will be lost.')) return;
    await resetDatabase();
    logActivity('Reset team data to defaults');
    await persistDatabase();
    render();
    document.getElementById('status').textContent = 'Data reset to default.';
  });

  document.getElementById('btn-export')?.addEventListener('click', downloadDatabase);
  document.querySelector('[data-bs-target="#member-modal"]')?.addEventListener('click', () => prepareMemberForm());
});