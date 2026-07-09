// Firebase config — see js/firebase-init.js for live credentials
export const DEFAULT_ADMIN_EMAIL = 'pal982565@gmail.com';
export const ACTIVE_NOW_MS = 5 * 60 * 1000;
export const ACTIVE_TODAY_MS = 24 * 60 * 60 * 1000;
export const AI_GUEST_PREFIX = 'ai_opponent_';

export const TASK_CATALOG = [
  { id: 5, title: 'Login 7 Day' },
  { id: 1, title: 'Task of CroomX1' },
  { id: 2, title: 'Task of CroomX2' },
  { id: 3, title: 'Task of CroomX3' },
  { id: 4, title: 'Task of CroomX4' },
];

export const ALL_TASK_IDS = TASK_CATALOG.map((t) => t.id);

export const GAME_PATHS = [
  { path: 'tic_tac_toe_games', label: 'Tic Tac Toe' },
  { path: 'game_2048_games', label: '2048' },
  { path: 'chess_games', label: 'Chess' },
];

export function taskTitle(id) {
  return TASK_CATALOG.find((t) => t.id === id)?.title || `Task ${id}`;
}
