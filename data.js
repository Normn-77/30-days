/* ── Storage keys ─────────────────────── */
const K_H = 'dp3_habits';
const K_S = 'dp3_schedule';
const K_C = 'dp3_checks';
const K_FONT = 'dp3_font_header';

/* ── Default data ────────────────────── */
const DEFAULT_HABITS = [
  { id: 1, name: 'Meditasi pagi',    freq: { type: 'daily' }, createdAt: localDateKey(new Date()) },
  { id: 2, name: 'Olahraga 30 menit',freq: { type: 'daily' }, createdAt: localDateKey(new Date()) },
  { id: 3, name: 'Baca buku',        freq: { type: 'daily' }, createdAt: localDateKey(new Date()) }
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
  habits:     lsGet(K_H)   || DEFAULT_HABITS,
  schedule:   lsGet(K_S)   || DEFAULT_SCHEDULE,
  checks:     lsGet(K_C)   || {},
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

/*
 * Selalu gunakan tanggal LOKAL, bukan UTC.
 * toISOString() selalu UTC — di WIB (UTC+7) sebelum jam 07:00 pagi
 * masih mengembalikan tanggal kemarin, sehingga centangan tersimpan
 * di key yang salah dan tidak pernah ter-reset.
 */
function localDateKey(date) {
  const d = date || new Date();
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayKey()      { return localDateKey(new Date()); }
function daysAgoKey(n)   { const d = new Date(); d.setDate(d.getDate() - n); return localDateKey(d); }

/*
 * Ambil bagian tanggal (YYYY-MM-DD) dari createdAt,
 * yang bisa berupa ISO string ("2026-04-18T...") atau sudah dalam format YYYY-MM-DD.
 */
function habitCreatedKey(habit) {
  return (habit.createdAt || '1970-01-01').slice(0, 10);
}

/* ── Habit Frequency Logic ──────────────── */
function isHabitDue(habit, dateStr) {
  if (!habit.freq) return true;

  /*
   * new Date("YYYY-MM-DD") diparse sebagai UTC midnight,
   * sehingga d.getDay() bisa salah satu hari di timezone lokal.
   * Tambahkan T00:00:00 agar diparse sebagai waktu lokal.
   */
  const d = new Date(dateStr + 'T00:00:00');

  if (habit.freq.type === 'daily')   return true;
  if (habit.freq.type === 'weekly')  return habit.freq.value.includes(d.getDay());
  if (habit.freq.type === 'interval') {
    const start = new Date(habitCreatedKey(habit) + 'T00:00:00');
    start.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
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
/*
 * FIX: Sebelumnya streak tidak memperhitungkan:
 *   1. createdAt — hari sebelum habit dibuat ikut dihitung
 *   2. isHabitDue — hari non-jadwal seharusnya dilewati, bukan memutus streak
 */
function getStreak(hid) {
  const habit = State.habits.find(h => h.id === hid);
  if (!habit) return 0;
  const createdKey  = habitCreatedKey(habit);
  const startOffset = isChecked(hid, todayKey()) ? 0 : 1;
  let streak = 0;

  for (let i = startOffset; i < 400; i++) {
    const dk = daysAgoKey(i);
    if (dk < createdKey) break;              // sebelum habit dibuat → stop
    if (!isHabitDue(habit, dk)) continue;   // bukan hari jadwal → lewati, jangan putus streak
    if (isChecked(hid, dk)) streak++;
    else break;
  }
  return streak;
}

function getBestStreak(hid) {
  const habit = State.habits.find(h => h.id === hid);
  if (!habit) return 0;
  const createdKey = habitCreatedKey(habit);
  let best = 0, cur = 0;

  // Iterasi dari hari paling lama ke hari ini
  for (let i = 364; i >= 0; i--) {
    const dk = daysAgoKey(i);
    if (dk < createdKey) continue;          // sebelum habit dibuat → skip
    if (!isHabitDue(habit, dk)) continue;   // bukan hari jadwal → lewati
    if (isChecked(hid, dk)) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}

/* ── Completion rate helpers ─────────── */
/*
 * FIX: completionRate sebelumnya membagi done/totalDays tanpa memperhatikan
 *   createdAt dan isHabitDue — habit baru selalu punya rate rendah karena
 *   hari-hari sebelum dibuat dihitung sebagai miss.
 */
function completionRate(hid, days) {
  const habit = State.habits.find(h => h.id === hid);
  if (!habit) return 0;
  const createdKey = habitCreatedKey(habit);
  let done = 0, total = 0;

  for (let i = 0; i < days; i++) {
    const dk = daysAgoKey(i);
    if (dk < createdKey)        continue;   // sebelum habit dibuat → skip
    if (!isHabitDue(habit, dk)) continue;   // bukan hari jadwal → skip
    total++;
    if (isChecked(hid, dk)) done++;
  }
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/*
 * FIX: dailyOverallRate sebelumnya membagi dengan SEMUA habit,
 *   termasuk habit yang belum dibuat pada hari tersebut.
 *   Sekarang hanya habit yang sudah ada dan dijadwalkan pada hari itu yang dihitung.
 */
function dailyOverallRate(daysAgo) {
  const dk = daysAgoKey(daysAgo);
  const dueHabits = State.habits.filter(h => {
    return habitCreatedKey(h) <= dk && isHabitDue(h, dk);
  });
  if (!dueHabits.length) return 0;
  const done = dueHabits.filter(h => isChecked(h.id, dk)).length;
  return Math.round((done / dueHabits.length) * 100);
}

/* ── Bersihkan data centang lama (> 400 hari) ──
 * Penting untuk penggunaan jangka panjang agar localStorage tidak membengkak.
 */
function cleanOldChecks() {
  const cutoff = daysAgoKey(400);
  let changed  = false;
  Object.keys(State.checks).forEach(dk => {
    if (dk < cutoff) { delete State.checks[dk]; changed = true; }
  });
  if (changed) lsSave();
}

/* ── Utilities ───────────────────────── */
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
