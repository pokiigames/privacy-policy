import {
  ACTIVE_NOW_MS,
  ACTIVE_TODAY_MS,
  AI_GUEST_PREFIX,
  ALL_TASK_IDS,
  DEFAULT_ADMIN_EMAIL,
  GAME_PATHS,
  taskTitle,
} from './config.js';

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function fmtDate(ms) {
  if (!ms) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

export function fmtRelative(ms) {
  if (!ms) return 'Never';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

export function userFromMap(id, data) {
  return {
    id,
    email: data.email || '',
    name: data.name || '',
    score: Number(data.score || 0),
    profilePictureUrl: data.profilePictureUrl || '',
    lastUpdated: Number(data.lastUpdated || Date.now()),
    rank: Number(data.rank || 0),
    gamesPlayed: Number(data.gamesPlayed || 0),
    gamesWon: Number(data.gamesWon || 0),
    playerCode: data.playerCode || '',
    lastLogin: Number(data.lastLogin || 0),
    isBanned: Boolean(data.isBanned),
    bannedUntil: Number(data.bannedUntil || 0),
  };
}

export function isBanned(user) {
  if (!user.isBanned) return false;
  return user.bannedUntil === 0 || user.bannedUntil > Date.now();
}

export function isAdminUser(user, emails) {
  const e = (user.email || '').toLowerCase().trim();
  return e && emails.has(e);
}

export function playerId(user) {
  return user.playerCode || user.id.slice(0, 8);
}

export function isAiGuest(guest) {
  return typeof guest === 'string' && guest.startsWith(AI_GUEST_PREFIX);
}

export function isAiRoom(data) {
  return data.isAiOpponent === true || isAiGuest(data.guest);
}

export { ALL_TASK_IDS, taskTitle };
