import { esc, formatRole, initDatabase, queryAll, queryOne } from './db.js';

function initials(name) { return String(name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }

function percentage(value, total) { return total ? Math.round((value / total) * 100) : 0; }

function renderProfile(member) {
  const tasks = queryAll('SELECT * FROM tasks WHERE member_id = ? ORDER BY due_date IS NULL, due_date, id', [member.id]);
  const colleagues = queryAll('SELECT id, name FROM team_members WHERE id != ? ORDER BY name', [member.id]);
  const counts = { 'To do': 0, Doing: 0, Done: 0 };
  tasks.forEach((task) => { counts[task.status] = (counts[task.status] || 0) + 1; });
  const totalTasks = Object.values(counts).reduce((total, count) => total + count, 0);
  const todoPercentage = percentage(counts['To do'], totalTasks);
  const doingPercentage = percentage(counts.Doing, totalTasks);
  const donePercentage = totalTasks ? 100 - todoPercentage - doingPercentage : 0;
  const chartStyle = totalTasks
    ? `--todo: ${todoPercentage}%; --doing: ${todoPercentage + doingPercentage}%;`
    : '--todo: 0%; --doing: 0%;';
  document.title = `${member.name} | TaskFlow`;
  document.getElementById('profile-content').innerHTML = `
    <section class="card border-0 shadow-sm mb-4"><div class="card-body p-3 p-md-5"><div class="row align-items-center g-4"><div class="col-md-4 text-center"><div class="avatar rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center">${esc(initials(member.name))}</div></div><div class="col-md-8"><h1 class="h2 fw-bold mb-2">${esc(member.name)}</h1><p class="text-secondary mb-2">${esc(formatRole(member.role))}${member.nim ? ` · ${esc(member.nim)}` : ''}</p><span class="badge ${member.status === 'Active' ? 'text-bg-success' : 'text-bg-secondary'}">${esc(member.status)}</span></div></div><hr class="my-4"><h2 class="h5">Contact</h2><p class="mb-1">Email: ${member.email ? `<a href="mailto:${esc(member.email)}">${esc(member.email)}</a>` : '-'}</p><p class="mb-0">Phone: ${member.phone ? `<a href="https://wa.me/${encodeURIComponent(member.phone)}">${esc(member.phone)}</a>` : '-'}</p></div></section>
    <section class="card border-0 shadow-sm mb-4"><div class="card-body p-3 p-md-5"><h2 class="h4 mb-3">Task summary</h2><div class="task-overview mb-4"><div class="task-pie" style="${chartStyle} width: min(168px, 34vw); height: min(168px, 34vw); flex: 0 0 min(168px, 34vw); background: conic-gradient(#f4b942 0 var(--todo), #4c9aff var(--todo) var(--doing), #43aa8b var(--doing) 100%);" role="img" aria-label="Task status: ${todoPercentage}% To do, ${doingPercentage}% Doing, ${donePercentage}% Done"></div><div class="task-legend" aria-label="Task status percentages"><div><span class="legend-swatch legend-todo"></span><span>To do</span><strong>${todoPercentage}%</strong></div><div><span class="legend-swatch legend-doing"></span><span>Doing</span><strong>${doingPercentage}%</strong></div><div><span class="legend-swatch legend-done"></span><span>Done</span><strong>${donePercentage}%</strong></div></div></div><div class="row row-cols-2 row-cols-md-3 g-2 mb-4">${Object.entries(counts).map(([label, count]) => `<div class="col"><div class="stat-card bg-light rounded p-3"><div class="text-secondary small">${label}</div><strong class="fs-3">${count}</strong></div></div>`).join('')}</div><h3 class="h5">Tasks</h3>${tasks.length ? `<ul class="list-group list-group-flush">${tasks.map((task) => `<li class="list-group-item px-0 d-flex justify-content-between gap-2"><span class="member-name">${esc(task.title)}</span><span class="badge text-bg-light">${esc(task.status)}</span></li>`).join('')}</ul>` : '<p class="text-secondary mb-0">No tasks assigned.</p>'}</div></section>
    <section class="card border-0 shadow-sm"><div class="card-body p-3 p-md-5"><h2 class="h5">Team</h2><div class="d-flex flex-wrap gap-2">${colleagues.length ? colleagues.map((person) => `<a class="badge text-bg-light border text-decoration-none" href="profile.html?id=${person.id}">${esc(person.name)}</a>`).join('') : '<span class="text-secondary">No other team members.</span>'}</div></div></section>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('profile-content');
  try {
    await initDatabase();
    const id = new URLSearchParams(location.search).get('id');
    const member = id ? queryOne('SELECT * FROM team_members WHERE id = ?', [Number(id)]) : null;
    if (!member || !member.id) { content.innerHTML = '<div class="card border-0 shadow-sm"><div class="card-body p-3 p-md-5"><h1 class="h3">Member tidak ditemukan</h1><p class="text-secondary">Pilih member dari halaman Team untuk melihat profil.</p><a class="btn btn-primary" href="index.html">Kembali ke Team</a></div></div>'; return; }
    renderProfile(member);
  } catch (error) { content.innerHTML = `<div class="alert alert-danger">Error: ${esc(error.message)}</div>`; console.error(error); }
});