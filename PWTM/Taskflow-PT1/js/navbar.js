const links = [
  { href: 'index.html', label: 'Team' },
  { href: 'tasks.html', label: 'Tasks' },
  { href: 'profile.html', label: 'Profile' },
];

const here = location.pathname.split('/').pop() || 'index.html';
const navbar = document.getElementById('app-navbar');

if (navbar) {
  navbar.innerHTML = `
    <nav class="navbar navbar-expand-md rounded-4 px-3 my-3 bg-primary" data-bs-theme="dark">
      <a class="navbar-brand d-flex align-items-center gap-2 fw-bold" href="index.html">
        <img src="assets/logo.svg" alt="" width="32" height="32"> TaskFlow
      </a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav" aria-controls="nav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse justify-content-end" id="nav">
        <ul class="navbar-nav gap-md-2">
          ${links.map((link) => `
            <li class="nav-item">
              <a class="nav-link ${link.href === here ? 'active fw-semibold text-white' : ''}" href="${link.href}">${link.label}</a>
            </li>
          `).join('')}
        </ul>
      </div>
    </nav>`;
}