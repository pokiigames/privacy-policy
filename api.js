import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { get, getDatabase, ref } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';
import { app } from './firebase-init.js';
import {
  DEFAULT_ADMIN_EMAIL,
  GAME_PATHS,
} from './config.js';
import {
  ALL_TASK_IDS,
  isAdminUser,
  isAiRoom,
  isBanned,
  startOfToday,
  taskTitle,
  todayKey,
  userFromMap,
} from './utils.js';

export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const firestore = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const usersCol = collection(firestore, 'users');
const adminsDoc = doc(firestore, 'admins', 'admin_emails');

export { onAuthStateChanged, signInWithPopup, signOut, googleProvider };

export async function isEmailAdmin(email) {
  const normalized = (email || '').toLowerCase().trim();
  if (!normalized) return false;
  try {
    const snap = await getDoc(adminsDoc);
    if (!snap.exists()) return normalized === DEFAULT_ADMIN_EMAIL.toLowerCase();
    const emails = (snap.data().emails || []).map((e) => e.toLowerCase().trim());
    return emails.includes(normalized) || normalized === DEFAULT_ADMIN_EMAIL.toLowerCase();
  } catch {
    return normalized === DEFAULT_ADMIN_EMAIL.toLowerCase();
  }
}

async function resolveAdminEmails() {
  try {
    const snap = await getDoc(adminsDoc);
    if (!snap.exists()) return new Set([DEFAULT_ADMIN_EMAIL.toLowerCase()]);
    const emails = (snap.data().emails || [DEFAULT_ADMIN_EMAIL])
      .map((e) => e.toLowerCase().trim())
      .filter(Boolean);
    return new Set(emails.length ? emails : [DEFAULT_ADMIN_EMAIL.toLowerCase()]);
  } catch {
    return new Set([DEFAULT_ADMIN_EMAIL.toLowerCase()]);
  }
}

export async function getDashboardStats() {
  const now = Date.now();
  const adminEmails = await resolveAdminEmails();
  const snapshot = await getDocs(usersCol);

  const online = [];
  const today = [];
  const inactive = [];
  let total = 0;

  snapshot.docs.forEach((d) => {
    const user = userFromMap(d.id, d.data());
    if (isAdminUser(user, adminEmails)) return;
    total++;
    if (isBanned(user)) {
      inactive.push(user);
      return;
    }
    const loginRef = user.lastLogin > 0 ? user.lastLogin : user.lastUpdated;
    const onlineNow = now - user.lastUpdated <= 5 * 60 * 1000;
    const loggedToday = now - loginRef <= 24 * 60 * 60 * 1000;
    if (onlineNow) online.push(user);
    else if (loggedToday) today.push(user);
    else inactive.push(user);
  });

  const sort = (u) => Math.max(u.lastUpdated, u.lastLogin);
  online.sort((a, b) => sort(b) - sort(a));
  today.sort((a, b) => sort(b) - sort(a));
  inactive.sort((a, b) => sort(b) - sort(a));

  return {
    totalUsers: total,
    activeNow: online.length,
    activeToday: online.length + today.length,
    inactiveUsers: inactive.length,
    online,
    today,
    inactive,
    generatedAt: now,
  };
}

export async function getAllUsers() {
  const q = query(usersCol, orderBy('lastUpdated', 'desc'), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => userFromMap(d.id, d.data()));
}

export async function getTopUsers() {
  const q = query(usersCol, orderBy('score', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ ...userFromMap(d.id, d.data()), rank: i + 1 }));
}

export async function searchUsers(q) {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const users = await getAllUsers();
  return users.filter(
    (u) =>
      u.name.toLowerCase().includes(lower) ||
      u.email.toLowerCase().includes(lower) ||
      u.playerCode.toLowerCase().includes(lower),
  );
}

export async function getUserById(id) {
  const snap = await getDoc(doc(firestore, 'users', id));
  if (!snap.exists()) throw new Error('User not found');
  return userFromMap(snap.id, snap.data());
}

export async function updateUser(id, updates) {
  await updateDoc(doc(firestore, 'users', id), {
    ...updates,
    lastUpdated: Date.now(),
  });
}

export async function deleteUser(id) {
  await deleteDoc(doc(firestore, 'users', id));
}

function parseTasks(data) {
  const todayTasks = data.todayTasks || {};
  return ALL_TASK_IDS.map((taskId) => {
    const t = todayTasks[String(taskId)] || {};
    return {
      taskId,
      taskName: taskTitle(taskId),
      completed: Boolean(t.completed),
    };
  });
}

function buildTaskRow(docData, user, adminEmails) {
  if (isAdminUser(user, adminEmails)) return null;
  const today = todayKey();
  const taskDate = docData.dailyTaskDate || '';
  const updatedAt = Number(docData.dailyTaskUpdatedAt || 0);
  const entries = parseTasks(docData);
  const hasToday = entries.some((t) => t.completed);
  const legacy = (docData.dailyTasksCompleted || []).map(Number);
  const legacyCount = Number(docData.dailyTaskCount ?? legacy.length);
  const legacyAll = Boolean(docData.dailyTaskAllComplete ?? legacyCount >= ALL_TASK_IDS.length);

  const tasks =
    entries.some((t) => t.completed) || Object.keys(docData.todayTasks || {}).length
      ? entries
      : ALL_TASK_IDS.map((id) => ({
          taskId: id,
          taskName: taskTitle(id),
          completed: legacy.includes(id),
        }));

  const completedCount = tasks.filter((t) => t.completed).length;
  const isToday = taskDate === today || hasToday;
  const allFive =
    Object.keys(docData.todayTasks || {}).length > 0
      ? isToday && completedCount >= ALL_TASK_IDS.length
      : isToday && legacyAll;

  return {
    user,
    tasks,
    completedCount: isToday ? completedCount : 0,
    allFiveComplete: allFive,
    taskDate: taskDate || (hasToday ? today : ''),
    updatedAt: isToday ? updatedAt : 0,
  };
}

export async function getDailyTasks() {
  const adminEmails = await resolveAdminEmails();
  const snap = await getDocs(usersCol);
  return snap.docs
    .map((d) => buildTaskRow(d.data(), userFromMap(d.id, d.data()), adminEmails))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.allFiveComplete !== b.allFiveComplete) return a.allFiveComplete ? 1 : -1;
      if (a.completedCount !== b.completedCount) return b.completedCount - a.completedCount;
      return a.user.name.localeCompare(b.user.name);
    });
}

export async function getMatches(aiOnly) {
  const start = startOfToday();
  const records = [];

  for (const { path, label } of GAME_PATHS) {
    const snap = await get(ref(rtdb, path));
    if (!snap.exists()) continue;
    const rooms = snap.val();
    for (const [code, data] of Object.entries(rooms)) {
      const isAi = isAiRoom(data);
      if (aiOnly && !isAi) continue;
      if (!aiOnly && isAi) continue;
      if (data.gameEnded !== true) continue;
      const endedAt = Number(data.matchEndsAt ?? data.createdAt ?? 0);
      if (endedAt < start) continue;
      records.push({
        gameType: label,
        roomCode: code,
        hostName: data.hostName || 'Host',
        guestName: data.guestName || 'Guest',
        hostScore: Number(data.hostScore ?? data.hostWins ?? 0),
        guestScore: Number(data.guestScore ?? data.guestWins ?? 0),
        winner: data.winner || '',
        betAmount: Number(data.betAmount ?? 0),
        endedAt,
        isAi: isAi,
      });
    }
  }
  return records.sort((a, b) => b.endedAt - a.endedAt);
}

export async function getAiRecords() {
  const records = [];
  for (const { path, label } of GAME_PATHS) {
    const snap = await get(ref(rtdb, path));
    if (!snap.exists()) continue;
    const rooms = snap.val();
    for (const [code, data] of Object.entries(rooms)) {
      if (!isAiRoom(data)) continue;
      const ended = data.gameEnded === true;
      const started = data.gameStarted === true;
      records.push({
        gameType: label,
        roomCode: code,
        aiName: data.guestName || 'AI Bot',
        hostName: data.hostName || 'Host',
        joinedAt: Number(data.aiJoinedAt ?? data.createdAt ?? 0),
        status: ended ? 'ended' : started ? 'in_match' : 'waiting',
        betAmount: Number(data.betAmount ?? 0),
      });
    }
  }
  return records.sort((a, b) => b.joinedAt - a.joinedAt);
}
