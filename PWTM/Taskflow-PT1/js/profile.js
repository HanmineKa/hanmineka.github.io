import { esc, formatRole, initDatabase, queryAll, queryOne } from './db.js';

function initials(name) { return String(name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }

function percentage(value, total) { return total ? Math.round((value / total) * 100) : 0; }

function renderTaskSection(title, sectionId, tasks, memberId, isTeamTask) {
  const content = tasks.length ? `
    <ul class="list-group list-group-flush profile-task-list">${tasks.map((task) => {
      const collaborators = task.members.filter((person) => Number(person.id) !== Number(memberId));
      return `<li class="list-group-item px-0 py-3 d-flex justify-content-between align-items-start gap-3">
        <div class="flex-grow-1 min-w-0">
          <strong class="d-block profile-task-title">${esc(task.title)}</strong>
          ${task.description ? `<p class="small text-secondary mb-1 mt-1">${esc(task.description)}</p>` : ''}
          ${isTeamTask ? `<div class="d-flex flex-wrap align-items-center gap-1 mt-2"><span class="small text-secondary me-1">With</span>${collaborators.map((person) => `<span class="badge rounded-pill text-bg-light border">${esc(person.name)}</span>`).join('')}</div>` : ''}
        </div>
        <span class="badge text-bg-light flex-shrink-0">${esc(task.status)}</span>
      </li>`;
    }).join('')}</ul>` : `<p class="text-secondary mb-0">No ${isTeamTask ? 'team' : 'personal'} tasks assigned.</p>`;

  return `<section class="card border-0 shadow-sm mb-4" aria-labelledby="${sectionId}"><div class="card-body p-3 p-md-5"><div class="d-flex justify-content-between align-items-center gap-2 mb-2"><h2 id="${sectionId}" class="h4 mb-0">${title}</h2><span class="badge text-bg-light">${tasks.length}</span></div>${content}</div></section>`;
}

function renderProfile(member) {
  const tasks = queryAll(`SELECT tasks.* FROM tasks
    JOIN task_assignments ON task_assignments.task_id = tasks.id
    WHERE task_assignments.member_id = ?
    ORDER BY tasks.due_date IS NULL, tasks.due_date, tasks.id`, [member.id]);
  const taskIds = tasks.map((task) => Number(task.id));
  const assignmentRows = taskIds.length ? queryAll(`SELECT task_assignments.task_id, team_members.id, team_members.name
    FROM task_assignments JOIN team_members ON team_members.id = task_assignments.member_id
    WHERE task_assignments.task_id IN (${taskIds.map(() => '?').join(',')})
    ORDER BY team_members.name`, taskIds) : [];
  const membersByTask = new Map();
  assignmentRows.forEach((person) => {
    if (!membersByTask.has(Number(person.task_id))) membersByTask.set(Number(person.task_id), []);
    membersByTask.get(Number(person.task_id)).push(person);
  });
  const profileTasks = tasks.map((task) => ({ ...task, members: membersByTask.get(Number(task.id)) || [] }));
  const counts = { 'To do': 0, Doing: 0, Done: 0 };
  profileTasks.forEach((task) => { counts[task.status] = (counts[task.status] || 0) + 1; });
  const totalTasks = profileTasks.length;
  const todoPercentage = percentage(counts['To do'], totalTasks);
  const doingPercentage = percentage(counts.Doing, totalTasks);
  const donePercentage = totalTasks ? 100 - todoPercentage - doingPercentage : 0;
  const personalTasks = profileTasks.filter((task) => task.members.length === 1);
  const teamTasks = profileTasks.filter((task) => task.members.length > 1);
  const chartStyle = totalTasks
    ? `--todo: ${todoPercentage}%; --doing: ${todoPercentage + doingPercentage}%;`
    : '--todo: 0%; --doing: 0%;';
  document.title = `${member.name} | TaskFlow`;
  document.getElementById('profile-content').innerHTML = `
    <section class="card border-0 shadow-sm mb-4"><div class="card-body p-3 p-md-5"><div class="row align-items-center g-4"><div class="col-md-4 text-center"><div class="avatar rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center">${esc(initials(member.name))}</div></div><div class="col-md-8"><h1 class="h2 fw-bold mb-2">${esc(member.name)}</h1><p class="text-secondary mb-2">${esc(formatRole(member.role))}${member.nim ? ` · ${esc(member.nim)}` : ''}</p><span class="badge ${member.status === 'Active' ? 'text-bg-success' : 'text-bg-secondary'}">${esc(member.status)}</span></div></div><hr class="my-4"><h2 class="h5">Contact</h2><p class="mb-1">Email: ${member.email ? `<a href="mailto:${esc(member.email)}">${esc(member.email)}</a>` : '-'}</p><p class="mb-0">Phone: ${member.phone ? `<a href="https://wa.me/${encodeURIComponent(member.phone)}">${esc(member.phone)}</a>` : '-'}</p></div></section>
    <section class="card border-0 shadow-sm mb-4"><div class="card-body p-3 p-md-5"><h2 class="h4 mb-3">Task summary</h2><div class="task-overview"><div class="task-pie" style="${chartStyle} width: min(168px, 34vw); height: min(168px, 34vw); flex: 0 0 min(168px, 34vw); background: conic-gradient(#f4b942 0 var(--todo), #4c9aff var(--todo) var(--doing), #43aa8b var(--doing) 100%);" role="img" aria-label="Task status: ${todoPercentage}% To do, ${doingPercentage}% Doing, ${donePercentage}% Done"></div><div class="task-legend" aria-label="Task status percentages"><div><span class="legend-swatch legend-todo"></span><span>To do</span><strong>${todoPercentage}%</strong></div><div><span class="legend-swatch legend-doing"></span><span>Doing</span><strong>${doingPercentage}%</strong></div><div><span class="legend-swatch legend-done"></span><span>Done</span><strong>${donePercentage}%</strong></div></div></div><div class="row row-cols-2 row-cols-md-3 g-2 mt-3">${Object.entries(counts).map(([label, count]) => `<div class="col"><div class="stat-card bg-light rounded p-3"><div class="text-secondary small">${label}</div><strong class="fs-3">${count}</strong></div></div>`).join('')}</div></div></section>
    ${renderTaskSection('Personal Tasks', 'personal-tasks-title', personalTasks, member.id, false)}
    ${renderTaskSection('Team Tasks', 'team-tasks-title', teamTasks, member.id, true)}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('profile-content');
  try {
    await initDatabase();
    const id = new URLSearchParams(location.search).get('id');
    const member = id ? queryOne('SELECT * FROM team_members WHERE id = ?', [Number(id)]) : null;
    if (!member || !member.id) { content.innerHTML = '<div class="card border-0 shadow-sm"><div class="card-body p-3 p-md-5"><h1 class="h3">Member not found</h1><p class="text-secondary">Choose a member from the Team page to view their profile.</p><a class="btn btn-primary" href="index.html">Back to Team</a></div></div>'; return; }
    renderProfile(member);
  } catch (error) { content.innerHTML = `<div class="alert alert-danger">Error: ${esc(error.message)}</div>`; console.error(error); }
});