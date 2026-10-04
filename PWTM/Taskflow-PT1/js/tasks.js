import { esc, initDatabase, logActivity, persistDatabase, queryAll, queryOne, run } from './db.js';

let members = [];

function populateMembers() {
  const options = members.map((member) => `
    <div class="form-check">
      <input class="form-check-input task-member-option" type="checkbox" value="${member.id}" id="task-member-${member.id}">
      <label class="form-check-label" for="task-member-${member.id}">${esc(member.name)}</label>
    </div>
  `).join('');
  const filterOptions = members.map((member) => `<option value="${member.id}">${esc(member.name)}</option>`).join('');
  document.getElementById('task-member-options').innerHTML = options || '<p class="small text-secondary mb-0">Add a team member before creating a task.</p>';
  document.getElementById('filter-member').innerHTML = `<option value="">All assignees</option>${filterOptions}`;
}

function selectedMemberIds() {
  return [...document.querySelectorAll('.task-member-option:checked')].map((input) => Number(input.value));
}

function updateSelectedMembers() {
  const selectedIds = new Set(selectedMemberIds());
  const selected = members.filter((member) => selectedIds.has(Number(member.id)));
  const toggle = document.getElementById('task-member-toggle');
  const error = document.getElementById('task-member-error');
  toggle.textContent = selected.length ? `${selected.length} member${selected.length === 1 ? '' : 's'} selected` : 'Select one or more members';
  document.getElementById('task-member-chips').innerHTML = selected.map((member) => `
    <span class="badge rounded-pill text-bg-primary task-assignee-chip">${esc(member.name)}
      <button type="button" class="btn-close btn-close-white" data-remove-member="${member.id}" aria-label="Remove ${esc(member.name)}"></button>
    </span>
  `).join('');
  if (selected.length) error.hidden = true;
  const invalid = !error.hidden && !selected.length;
  toggle.setAttribute('aria-invalid', String(invalid));
  toggle.classList.toggle('is-invalid', invalid);
}

function selectMembers(memberIds) {
  const selected = new Set(memberIds.map(Number));
  document.querySelectorAll('.task-member-option').forEach((input) => {
    input.checked = selected.has(Number(input.value));
  });
  updateSelectedMembers();
}

function resetTaskForm() {
  const form = document.getElementById('task-form');
  form.reset();
  form.elements.id.value = '';
  document.getElementById('task-member-error').hidden = true;
  selectMembers([]);
  document.getElementById('task-modal-label').textContent = 'Add Task';
  form.querySelector('[type="submit"]').textContent = 'Add Task';
}

function renderProgress() {
  const counts = queryOne(`SELECT
    COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN status = 'To do' THEN 1 ELSE 0 END), 0) AS todo,
    COALESCE(SUM(CASE WHEN status = 'Doing' THEN 1 ELSE 0 END), 0) AS doing,
    COALESCE(SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END), 0) AS done
    FROM tasks`);
  const total = Number(counts.total || 0);
  const done = Number(counts.done || 0);
  const percentage = total ? Math.round((done / total) * 100) : 0;
  const progressBar = document.getElementById('task-progress-bar');
  progressBar.style.width = `${percentage}%`;
  progressBar.parentElement.setAttribute('aria-valuenow', String(percentage));
  document.getElementById('task-progress-percent').textContent = `${percentage}%`;
  document.getElementById('task-progress-count').textContent = `${done} of ${total} tasks complete`;
  document.getElementById('task-progress-stats').innerHTML = [
    ['To do', counts.todo],
    ['Doing', counts.doing],
    ['Done', counts.done],
  ].map(([label, count]) => `<span>${label}: <strong>${Number(count || 0)}</strong></span>`).join('');
}

function render() {
  renderProgress();
  const status = document.getElementById('filter-status').value;
  const memberId = document.getElementById('filter-member').value;
  const filters = [];
  const params = [];
  if (status) { filters.push('t.status = ?'); params.push(status); }
  if (memberId) {
    filters.push('EXISTS (SELECT 1 FROM task_assignments AS filter_assignment WHERE filter_assignment.task_id = t.id AND filter_assignment.member_id = ?)');
    params.push(Number(memberId));
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = queryAll(`SELECT t.* FROM tasks t ${where} ORDER BY t.due_date IS NULL, t.due_date, t.id`, params);
  const assignments = queryAll(`SELECT task_assignments.task_id, team_members.id AS member_id, team_members.name AS member_name
    FROM task_assignments JOIN team_members ON team_members.id = task_assignments.member_id
    ORDER BY team_members.name`);
  const assignmentsByTask = new Map();
  assignments.forEach((assignment) => {
    if (!assignmentsByTask.has(Number(assignment.task_id))) assignmentsByTask.set(Number(assignment.task_id), []);
    assignmentsByTask.get(Number(assignment.task_id)).push(assignment);
  });
  const body = document.getElementById('task-table-body');
  body.innerHTML = rows.length ? rows.map((task) => {
    const taskMembers = assignmentsByTask.get(Number(task.id)) || [];
    const category = taskMembers.length > 1 ? 'Team Task' : taskMembers.length === 1 ? 'Personal Task' : 'Unassigned';
    const categoryClass = taskMembers.length > 1 ? 'text-bg-primary-subtle text-primary-emphasis' : 'text-bg-light';
    const memberBadges = taskMembers.length
      ? taskMembers.map((member) => `<span class="badge rounded-pill text-bg-light border">${esc(member.member_name)}</span>`).join(' ')
      : '<span class="small text-secondary">Unassigned</span>';
    return `<tr>
      <td data-label="Title"><strong class="d-block">${esc(task.title)}</strong>${task.description ? `<span class="small text-secondary">${esc(task.description)}</span>` : ''}</td>
      <td data-label="Category"><span class="badge rounded-pill ${categoryClass}">${category}</span></td>
      <td data-label="Assigned members"><div class="d-flex flex-wrap gap-1">${memberBadges}</div></td>
      <td data-label="Status">${esc(task.status)}</td>
      <td data-label="Due date">${esc(task.due_date || '-')}</td>
      <td data-label="Action" class="text-end"><button class="btn btn-outline-secondary btn-sm" data-edit-task="${task.id}">Edit</button> <button class="btn btn-outline-danger btn-sm" data-delete-task="${task.id}">Delete</button></td>
    </tr>`;
  }).join('') : '<tr><td data-label="" class="text-muted text-center py-3">No tasks found.</td></tr>';
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
  document.getElementById('task-member-options').addEventListener('change', updateSelectedMembers);
  document.getElementById('task-member-chips').addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-member]');
    if (!removeButton) return;
    const checkbox = document.getElementById(`task-member-${removeButton.dataset.removeMember}`);
    if (checkbox) checkbox.checked = false;
    updateSelectedMembers();
  });
  document.getElementById('task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const memberIds = selectedMemberIds();
    if (!memberIds.length) {
      document.getElementById('task-member-error').hidden = false;
      updateSelectedMembers();
      document.getElementById('task-member-toggle').focus();
      return;
    }
    const title = form.title.value.trim();
    const description = form.description.value.trim() || null;
    const isEditing = Boolean(form.elements.id.value);
    const legacyMemberId = memberIds.length === 1 ? memberIds[0] : null;
    const values = [title, description, legacyMemberId, form.status.value, form.due_date.value || null];
    let taskId;
    if (isEditing) {
      taskId = Number(form.elements.id.value);
      run('UPDATE tasks SET title = ?, description = ?, member_id = ?, status = ?, due_date = ? WHERE id = ?', [...values, taskId]);
    } else {
      run('INSERT INTO tasks (title, description, member_id, status, due_date) VALUES (?, ?, ?, ?, ?)', values);
      taskId = Number(queryOne('SELECT last_insert_rowid() AS id').id);
    }
    run('DELETE FROM task_assignments WHERE task_id = ?', [taskId]);
    memberIds.forEach((memberId) => run('INSERT INTO task_assignments (task_id, member_id) VALUES (?, ?)', [taskId, memberId]));
    const memberNames = members.filter((member) => memberIds.includes(Number(member.id))).map((member) => member.name).join(', ');
    logActivity(`${isEditing ? 'Updated' : 'Added'} task: ${title} (${memberNames})`);
    await persistDatabase();
    resetTaskForm();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('task-modal')).hide();
    render();
  });
  document.getElementById('task-table-body').addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit-task]');
    if (editButton) {
      const task = queryOne('SELECT * FROM tasks WHERE id = ?', [Number(editButton.dataset.editTask)]);
      const form = document.getElementById('task-form');
      form.elements.id.value = task.id;
      form.title.value = task.title;
      form.description.value = task.description || '';
      form.status.value = task.status;
      form.due_date.value = task.due_date || '';
      const memberIds = queryAll('SELECT member_id FROM task_assignments WHERE task_id = ?', [task.id]).map((assignment) => Number(assignment.member_id));
      document.getElementById('task-member-error').hidden = true;
      selectMembers(memberIds);
      document.getElementById('task-modal-label').textContent = 'Edit Task';
      form.querySelector('[type="submit"]').textContent = 'Save Changes';
      bootstrap.Modal.getOrCreateInstance(document.getElementById('task-modal')).show();
      return;
    }
    const button = event.target.closest('[data-delete-task]');
    if (!button) return;
    const task = queryOne('SELECT title FROM tasks WHERE id = ?', [Number(button.dataset.deleteTask)]);
    run('DELETE FROM tasks WHERE id = ?', [Number(button.dataset.deleteTask)]);
    logActivity(`Deleted task: ${task.title || 'Task'}`);
    await persistDatabase();
    render();
  });
  document.querySelector('[data-bs-target="#task-modal"]')?.addEventListener('click', () => {
    resetTaskForm();
  });
});