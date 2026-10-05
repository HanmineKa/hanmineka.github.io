const ACCOUNTS_KEY = 'taskflow.accounts';
const SESSION_KEY = 'taskflow.session';
const HASH_ITERATIONS = 310000;

function readAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: HASH_ITERATIONS }, key, 256);
  return new Uint8Array(bits);
}

function passwordsMatch(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function getSafeNext(defaultPage = 'index.html') {
  const requested = new URLSearchParams(location.search).get('next');
  if (!requested) return defaultPage;
  const target = new URL(requested, location.href);
  const currentDirectory = new URL('.', location.href).pathname;
  const allowedPages = new Set(['index.html', 'tasks.html', 'profile.html']);
  if (target.origin !== location.origin || !target.pathname.startsWith(currentDirectory)) return defaultPage;
  if (!allowedPages.has(target.pathname.slice(currentDirectory.length))) return defaultPage;
  return `${target.pathname.slice(currentDirectory.length)}${target.search}${target.hash}`;
}

export function requireAuth() {
  if (getCurrentUser()) return true;
  const next = `${location.pathname.split('/').pop() || 'index.html'}${location.search}`;
  location.replace(`login.html?next=${encodeURIComponent(next)}`);
  return false;
}

export async function registerAccount(name, email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = readAccounts();
  if (accounts.some((account) => account.email === normalizedEmail)) {
    return { error: 'An account with this email already exists.' };
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  accounts.push({ name: name.trim(), email: normalizedEmail, salt: toBase64(salt), passwordHash: toBase64(passwordHash) });
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: name.trim(), email: normalizedEmail }));
  return { user: getCurrentUser() };
}

export async function loginAccount(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const account = readAccounts().find((candidate) => candidate.email === normalizedEmail);
  if (!account) return { error: 'Email or password is incorrect.' };

  const passwordHash = await hashPassword(password, fromBase64(account.salt));
  if (!passwordsMatch(passwordHash, fromBase64(account.passwordHash))) {
    return { error: 'Email or password is incorrect.' };
  }

  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: account.name, email: account.email }));
  return { user: getCurrentUser() };
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.replace('login.html');
}