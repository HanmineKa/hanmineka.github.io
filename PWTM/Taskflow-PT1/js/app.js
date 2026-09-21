import {
  esc,
  exportDatabase,
  formatRole,
  getMigrationNotice,
  initDatabase,
  persistDatabase,
  queryAll,
  queryOne,
  resetDatabase,
  run,
} from './db.js';

function render() {
  const rows = queryAll(`
    SELECT m.*, COUNT(t.id) AS task_count
    FROM team_members m
    LEFT JOIN tasks t ON t.member_id = m.id
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
          <button class="btn btn-outline-danger btn-sm" data-action="hapus" data-id="${member.id}">Delete</button>
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
  const values = [
    form.name.value.trim(), form.nim.value.trim() || null, form.email.value.trim() || null,
    form.phone.value.trim() || null, form.role.value, form.active.checked ? 'Active' : 'Inactive',
  ];
  if (form.elements.id.value) {
    run('UPDATE team_members SET name = ?, nim = ?, email = ?, phone = ?, role = ?, status = ? WHERE id = ?', [...values, Number(form.elements.id.value)]);
  } else {
    run('INSERT INTO team_members (name, nim, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)', values);
  }
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
    run('DELETE FROM team_members WHERE id = ?', [Number(button.dataset.id)]);
    await persistDatabase();
    render();
  });

  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    if (!confirm('Reset semua data ke default? Perubahan yang tersimpan akan hilang.')) return;
    await resetDatabase();
    render();
    document.getElementById('status').textContent = 'Data reset to default.';
  });

  document.getElementById('btn-export')?.addEventListener('click', downloadDatabase);
  document.querySelector('[data-bs-target="#member-modal"]')?.addEventListener('click', () => prepareMemberForm());
});