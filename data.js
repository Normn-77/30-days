/* ── Storage keys ─────────────────────── */
const K_H = 'dp3_habits';
const K_S = 'dp3_schedule';
const K_C = 'dp3_checks';
const K_FONT = 'dp3_font_header';

/* ── Default data ────────────────────── */
const DEFAULT_HABITS = [
  { id: 1, name: 'Meditasi pagi', freq: { type: 'daily' }, createdAt: new Date().toISOString() },
  { id: 2, name: 'Olahraga 30 menit', freq: { type: 'daily' }, createdAt: new Date().toISOString() },
  { id: 3, name: 'Baca buku', freq: { type: 'daily' }, createdAt: new Date().toISOString() }
];

const DEFAULT_SCHEDULE = [
  { id: 1,  time: '05:30', dur: 30,  title: 'Bangun & bersih diri' },
  { id: 2,  time: '06:00', dur: 30,  title: 'Meditasi pagi' },
  { id: 3,  time: '06:30', dur: 60,  title: 'Olahraga' },
  { id: 5,  time: '09:00', dur: 180, title: 'Deep work sesi 1' }
];

/* ── Load / save ─────────────────────── */
function lsGet(k) {
  try { return JSON.parse(localStorage.getItem(k)); }
  catch { return null; }
}

function lsSave() {
  localStorage.setItem(K_H, JSON.stringify(State.habits));
  localStorage.setItem(K_S, JSON.stringify(State.schedule));
  localStorage.setItem(K_C, JSON.stringify(State.checks));
}

/* ── State object ────────────────────── */
const State = {
  habits:   lsGet(K_H)   || DEFAULT_HABITS,
  schedule: lsGet(K_S)   || DEFAULT_SCHEDULE,
  checks:   lsGet(K_C)   || {},
  fontHeader: localStorage.getItem(K_FONT) || 'var(--serif)'
};

/* ── Font Helpers ────────────────────── */
function saveFontPreference(fontValue) {
  State.fontHeader = fontValue;
  localStorage.setItem(K_FONT, fontValue);
  applyFont();
}

function applyFont() {
  document.documentElement.style.setProperty('--header-font', State.fontHeader);
}

/* ── Date helpers ────────────────────── */
const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const DAYS_SH   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ── Habit Frequency Logic ──────────────── */
function isHabitDue(habit, dateStr) {
  if (!habit.freq) return true;

  const d = new Date(dateStr);
  
  if (habit.freq.type === 'daily') return true;
  if (habit.freq.type === 'weekly') return habit.freq.value.includes(d.getDay());
  if (habit.freq.type === 'interval') {
    const start = new Date(habit.createdAt || dateStr);
    start.setHours(0,0,0,0);
    d.setHours(0,0,0,0);
    const diffDays = Math.floor(Math.abs(d - start) / (1000 * 60 * 60 * 24));
    return diffDays % habit.freq.value === 0;
  }
  return true;
}

function isChecked(hid, dateStr) {
  return !!(State.checks[dateStr] && State.checks[dateStr][hid]);
}

function toggleCheck(hid) {
  const d = todayKey();
  if (!State.checks[d]) State.checks[d] = {};
  State.checks[d][hid] = !State.checks[d][hid];
  lsSave();
  render();
}

/* ── Streak calculator ───────────────── */
function getStreak(hid) {
  let streak = 0;
  const startOffset = isChecked(hid, todayKey()) ? 0 : 1;
  for (let i = startOffset; i < 400; i++) {
    if (isChecked(hid, daysAgoKey(i))) streak++;
    else break;
  }
  return streak;
}

function getBestStreak(hid) {
  let best = 0, cur = 0;
  for (let i = 0; i < 365; i++) {
    if (isChecked(hid, daysAgoKey(i))) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}

/* ── Completion rate helpers ─────────── */
function completionRate(hid, days) {
  let done = 0;
  for (let i = 0; i < days; i++) {
    if (isChecked(hid, daysAgoKey(i))) done++;
  }
  return days > 0 ? Math.round((done / days) * 100) : 0;
}

function dailyOverallRate(daysAgo) {
  if (!State.habits.length) return 0;
  const dk = daysAgoKey(daysAgo);
  const done = State.habits.filter(h => isChecked(h.id, dk)).length;
  return Math.round((done / State.habits.length) * 100);
}

/* ── Utilities ───────────────────────── */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function t2m(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmtDur(m) {
  if (m < 60) return m + ' mnt';
  const h = Math.floor(m / 60), r = m % 60;
  return r > 0 ? `${h}j ${r}m` : `${h} jam`;
}
