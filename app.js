import {
  auth,
  deleteUser,
  getAiRecords,
  getAllUsers,
  getDailyTasks,
  getDashboardStats,
  getMatches,
  getTopUsers,
  getUserById,
  googleProvider,
  isEmailAdmin,
  onAuthStateChanged,
  searchUsers,
  signInWithPopup,
  signOut,
  updateUser,
} from './api.js';
import { ALL_TASK_IDS } from './utils.js';
import { esc, fmtDate, fmtRelative, isBanned, playerId } from './utils.js';

const $ = (sel) => document.querySelector(sel);
const loginScreen = $('#login-screen');
const deniedScreen = $('#denied-screen');
const appShell = $('#app-shell');
const pageContent = $('#page-content');
const sidebar = $('#sidebar');
const deniedEmail = $('#denied-email');

let currentUser = null;
let isAdmin = false;

const routes = {
  dashboard: renderDashboard,
  users: renderUsers,
  'user-detail': renderUserDetail,
  tasks: renderTasks,
  matches: renderMatches,
  ai: renderAi,
};

function show(el) {
  loginScreen.classList.add('hidden');
  deniedScreen.classList.add('hidden');
  appShell.classList.add('hidden');
  el.classList.remove('hidden');
}

function setActiveNav() {
  const hash = location.hash.slice(2) || 'dashboard';
  const page = hash.split('/')[0];
  document.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

function navigate(page, param) {
  location.hash = param ? `#/${page}/${param}` : `#/${page}`;
}

async function route() {
  setActiveNav();
  const parts = (location.hash.slice(2) || 'dashboard').split('/');
  const page = parts[0];
  const param = parts[1];
  const fn = routes[page] || routes.dashboard;
  pageContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    await fn(param);
  } catch (e) {
    pageContent.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

function userListHtml(users, empty) {
  if (!users.length) return `<p class="empty">${empty}</p>`;
  return `<ul class="user-list">${users
    .slice(0, 20)
    .map(
      (u) => `
    <li>
      <div>
        <strong>${esc(u.name || 'Unnamed')}</strong>
        <div class="meta">${esc(playerId(u))} • ${fmtRelative(Math.max(u.lastUpdated, u.lastLogin))}</div>
      </div>
      <span class="badge badge-muted">${u.score}</span>
    </li>`,
    )
    .join('')}</ul>`;
}

async function renderDashboard() {
  const stats = await getDashboardStats();
  pageContent.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Dashboard</h2>
        <p class="subtitle">Updated ${fmtDate(stats.generatedAt)}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline btn-sm" onclick="location.reload()">↻ Refresh</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total users</div><div class="value">${stats.totalUsers}</div></div>
      <div class="stat-card"><div class="label">Online now (5 min)</div><div class="value green">${stats.activeNow}</div></div>
      <div class="stat-card"><div class="label">Active today</div><div class="value blue">${stats.activeToday}</div></div>
      <div class="stat-card"><div class="label">Inactive / banned</div><div class="value">${stats.inactiveUsers}</div></div>
    </div>
    <div class="stats-grid">
      <div class="panel"><h3>Online now</h3>${userListHtml(stats.online, 'No users online.')}</div>
      <div class="panel"><h3>Logged in today</h3>${userListHtml(stats.today, 'No users today.')}</div>
      <div class="panel"><h3>Inactive / banned</h3>${userListHtml(stats.inactive, 'No inactive users.')}</div>
    </div>`;
}

async function renderUsers() {
  let tab = 'all';
  let query = '';

  async function load() {
    const users = query.trim()
      ? await searchUsers(query)
      : tab === 'top'
        ? await getTopUsers()
        : await getAllUsers();

    $('#users-table-body').innerHTML =
      users.length === 0
        ? '<tr><td colspan="7" class="empty">No users found</td></tr>'
        : users
            .map(
              (u) => `
      <tr class="clickable" data-id="${esc(u.id)}">
        <td>${u.profilePictureUrl ? `<img class="avatar" src="${esc(u.profilePictureUrl)}" alt="">` : ''}${esc(u.name || 'Unnamed')}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(playerId(u))}</td>
        <td class="text-right">${u.score}</td>
        <td class="text-right">${u.rank || '—'}</td>
        <td>${fmtRelative(u.lastUpdated)}</td>
        <td>${isBanned(u) ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-success">Active</span>'}</td>
      </tr>`,
            )
            .join('');

    document.querySelectorAll('#users-table-body tr[data-id]').forEach((row) => {
      row.onclick = () => navigate('user-detail', row.dataset.id);
    });
  }

  pageContent.innerHTML = `
    <div class="page-header">
      <div><h2>Users</h2><p class="subtitle">Search by name, email, or player code</p></div>
      <div class="page-actions">
        <div class="toggle-group" id="users-tab">
          <button data-tab="all" class="active">All users</button>
          <button data-tab="top">Top scores</button>
        </div>
        <button class="btn btn-outline btn-sm" id="users-refresh">↻ Refresh</button>
      </div>
    </div>
    <input class="search-input" id="users-search" placeholder="Search players..." />
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Player</th><th>Email</th><th>Code</th>
          <th class="text-right">Score</th><th class="text-right">Rank</th>
          <th>Last active</th><th>Status</th>
        </tr></thead>
        <tbody id="users-table-body"></tbody>
      </table>
    </div>`;

  $('#users-tab').onclick = (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    tab = btn.dataset.tab;
    document.querySelectorAll('#users-tab button').forEach((b) => b.classList.toggle('active', b === btn));
    void load();
  };
  $('#users-search').oninput = (e) => {
    query = e.target.value;
    void load();
  };
  $('#users-refresh').onclick = () => void load();
  await load();
}

async function renderUserDetail(userId) {
  const user = await getUserById(userId);
  const banned = isBanned(user);

  pageContent.innerHTML = `
    <div class="page-header">
      <div><h2>User detail</h2><p class="subtitle">${esc(playerId(user))}</p></div>
      <button class="btn btn-outline btn-sm" onclick="history.back()">← Back</button>
    </div>
    <div class="panel">
      <div class="user-detail-header">
        ${user.profilePictureUrl ? `<img class="avatar-lg" src="${esc(user.profilePictureUrl)}" alt="">` : '<div class="avatar-lg"></div>'}
        <div>
          <h3>${esc(user.name || 'Unnamed')}</h3>
          <p class="subtitle">${esc(user.email)}</p>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Name</label><input class="form-input" id="f-name" value="${esc(user.name)}"></div>
        <div class="form-group"><label>Email</label><input class="form-input" id="f-email" value="${esc(user.email)}" disabled></div>
        <div class="form-group"><label>Score</label><input class="form-input" id="f-score" type="number" value="${user.score}"></div>
        <div class="form-group"><label>Rank</label><input class="form-input" id="f-rank" type="number" value="${user.rank}"></div>
        <div class="form-group"><label>Games played</label><input class="form-input" id="f-played" type="number" value="${user.gamesPlayed}"></div>
        <div class="form-group"><label>Games won</label><input class="form-input" id="f-won" type="number" value="${user.gamesWon}"></div>
      </div>
      <div class="switch-row">
        <div>
          <strong>Temporary ban</strong>
          <p class="subtitle" id="ban-label">${banned ? (user.bannedUntil > 0 ? `Banned until ${fmtDate(user.bannedUntil)}` : 'Permanently banned') : 'Player is active'}</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="f-ban" ${banned ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div id="ban-days-wrap" class="${banned ? '' : 'hidden'}">
        <div class="form-group"><label>Ban days (0 = permanent)</label><input class="form-input" id="f-ban-days" type="number" value="7"></div>
      </div>
      <div class="alert alert-info">Ban writes <code>isBanned</code> and <code>bannedUntil</code> to Firestore.</div>
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-save">Save changes</button>
        <button class="btn btn-danger" id="btn-delete">Delete user</button>
        <button class="btn btn-outline" onclick="navigate('users')">Cancel</button>
      </div>
      <div id="save-msg"></div>
    </div>`;

  const banToggle = $('#f-ban');
  const banDaysWrap = $('#ban-days-wrap');
  banToggle.onchange = () => banDaysWrap.classList.toggle('hidden', !banToggle.checked);

  $('#btn-save').onclick = async () => {
    const banOn = banToggle.checked;
    const days = Number($('#f-ban-days').value) || 0;
    const DAY = 86400000;
    try {
      await updateUser(userId, {
        name: $('#f-name').value,
        score: Number($('#f-score').value) || 0,
        rank: Number($('#f-rank').value) || 0,
        gamesPlayed: Number($('#f-played').value) || 0,
        gamesWon: Number($('#f-won').value) || 0,
        isBanned: banOn,
        bannedUntil: !banOn ? 0 : days <= 0 ? 0 : Date.now() + days * DAY,
      });
      navigate('users');
    } catch (e) {
      $('#save-msg').innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
    }
  };

  $('#btn-delete').onclick = async () => {
    if (!confirm(`Delete ${user.name}?`)) return;
    await deleteUser(userId);
    navigate('users');
  };
}

async function renderTasks() {
  let filter = 'all';

  async function load() {
    let rows = await getDailyTasks();
    if (filter === 'done') rows = rows.filter((r) => r.completedCount >= 4);
    if (filter === 'not') rows = rows.filter((r) => !r.allFiveComplete);

    $('#tasks-body').innerHTML =
      rows.length === 0
        ? '<tr><td colspan="5" class="empty">No rows match filter</td></tr>'
        : rows
            .map((r) => {
              const chips = r.tasks
                .map(
                  (t) =>
                    `<span class="task-chip ${t.completed ? 'done' : 'pending'}" title="${esc(t.taskName)}">${t.taskId}</span>`,
                )
                .join('');
              const badge = r.allFiveComplete
                ? '<span class="badge badge-success">All done</span>'
                : r.completedCount > 0
                  ? `<span class="badge badge-muted">${r.completedCount}/${ALL_TASK_IDS.length}</span>`
                  : '<span class="badge badge-muted">None</span>';
              return `<tr>
          <td><a href="#/user-detail/${r.user.id}">${esc(r.user.name || 'Unnamed')}</a><div class="meta">${esc(playerId(r.user))}</div></td>
          <td>${r.completedCount}/${ALL_TASK_IDS.length} ${badge}</td>
          <td>${esc(r.taskDate || '—')}</td>
          <td>${fmtDate(r.updatedAt)}</td>
          <td><div class="task-chips">${chips}</div></td>
        </tr>`;
            })
            .join('');
  }

  pageContent.innerHTML = `
    <div class="page-header">
      <div><h2>Daily tasks</h2><p class="subtitle">Today's completion report</p></div>
      <div class="page-actions">
        <div class="toggle-group" id="tasks-filter">
          <button data-f="all" class="active">All</button>
          <button data-f="done">Done (4+)</button>
          <button data-f="not">Not Done (&lt;5)</button>
        </div>
        <button class="btn btn-outline btn-sm" id="tasks-refresh">↻ Refresh</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Player</th><th>Progress</th><th>Task date</th><th>Updated</th><th>Tasks</th></tr></thead>
        <tbody id="tasks-body"></tbody>
      </table>
    </div>`;

  $('#tasks-filter').onclick = (e) => {
    const btn = e.target.closest('button[data-f]');
    if (!btn) return;
    filter = btn.dataset.f;
    document.querySelectorAll('#tasks-filter button').forEach((b) => b.classList.toggle('active', b === btn));
    void load();
  };
  $('#tasks-refresh').onclick = () => void load();
  await load();
}

async function renderMatches() {
  let aiOnly = false;

  async function load() {
    const records = await getMatches(aiOnly);
    $('#matches-body').innerHTML =
      records.length === 0
        ? '<tr><td colspan="8" class="empty">No matches today</td></tr>'
        : records
            .map(
              (r) => `<tr>
        <td>${esc(r.gameType)}</td>
        <td>${esc(r.roomCode)}</td>
        <td>${esc(r.hostName)}</td>
        <td>${esc(r.guestName)}${r.isAi ? ' <span class="badge badge-info">AI</span>' : ''}</td>
        <td class="text-right">${r.hostScore} - ${r.guestScore}</td>
        <td>${esc(r.winner || '—')}</td>
        <td class="text-right">${r.betAmount}</td>
        <td>${fmtDate(r.endedAt)}</td>
      </tr>`,
            )
            .join('');
  }

  pageContent.innerHTML = `
    <div class="page-header">
      <div><h2>Match records</h2><p class="subtitle">Today's completed matches</p></div>
      <div class="page-actions">
        <div class="toggle-group" id="match-tab">
          <button data-ai="0" class="active">Human vs Human</button>
          <button data-ai="1">AI matches</button>
        </div>
        <button class="btn btn-outline btn-sm" id="match-refresh">↻ Refresh</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Game</th><th>Room</th><th>Host</th><th>Guest</th><th class="text-right">Score</th><th>Winner</th><th class="text-right">Bet</th><th>Ended</th></tr></thead>
        <tbody id="matches-body"></tbody>
      </table>
    </div>`;

  $('#match-tab').onclick = (e) => {
    const btn = e.target.closest('button[data-ai]');
    if (!btn) return;
    aiOnly = btn.dataset.ai === '1';
    document.querySelectorAll('#match-tab button').forEach((b) => b.classList.toggle('active', b === btn));
    void load();
  };
  $('#match-refresh').onclick = () => void load();
  await load();
}

async function renderAi() {
  const records = await getAiRecords();
  const statusBadge = (s) => {
    if (s === 'ended') return '<span class="badge badge-muted">Ended</span>';
    if (s === 'in_match') return '<span class="badge badge-warn">In match</span>';
    return '<span class="badge badge-info">Waiting</span>';
  };

  pageContent.innerHTML = `
    <div class="page-header">
      <div><h2>AI control</h2><p class="subtitle">AI opponent rooms</p></div>
      <button class="btn btn-outline btn-sm" onclick="location.reload()">↻ Refresh</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Game</th><th>Room</th><th>AI name</th><th>Host</th><th>Status</th><th class="text-right">Bet</th><th>Joined</th></tr></thead>
        <tbody>
          ${
            records.length === 0
              ? '<tr><td colspan="7" class="empty">No AI rooms</td></tr>'
              : records
                  .map(
                    (r) => `<tr>
            <td>${esc(r.gameType)}</td>
            <td>${esc(r.roomCode)}</td>
            <td>${esc(r.aiName)}</td>
            <td>${esc(r.hostName)}</td>
            <td>${statusBadge(r.status)}</td>
            <td class="text-right">${r.betAmount}</td>
            <td>${fmtDate(r.joinedAt)}</td>
          </tr>`,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>`;
}

// Auth
$('#btn-google-signin').onclick = () => signInWithPopup(auth, googleProvider);
$('#btn-signout-denied').onclick = () => signOut(auth);
$('#btn-signout').onclick = () => signOut(auth);
$('#menu-btn').onclick = () => sidebar.classList.toggle('open');

window.navigate = navigate;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    show(loginScreen);
    return;
  }
  isAdmin = await isEmailAdmin(user.email);
  if (!isAdmin) {
    deniedEmail.textContent = user.email;
    show(deniedScreen);
    return;
  }

  show(appShell);
  $('#user-name').textContent = user.displayName || 'Admin';
  $('#user-email').textContent = user.email || '';
  if (user.photoURL) $('#user-avatar').src = user.photoURL;

  if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
  await route();
});

window.addEventListener('hashchange', () => {
  if (isAdmin) void route();
});

document.querySelectorAll('.nav a').forEach((a) => {
  a.onclick = (e) => {
    e.preventDefault();
    navigate(a.dataset.page);
    sidebar.classList.remove('open');
  };
});
