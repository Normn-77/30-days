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

/* FIX: Gunakan tanggal LOKAL, bukan UTC.
   toISOString() selalu UTC — di Surabaya (UTC+7) sebelum jam 07:00 pagi
   masih mengembalikan tanggal kemarin, sehingga centangan tersimpan
   di key yang salah dan tidak pernah ter-reset. */
function localDateKey(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayKey() {
  return localDateKey(new Date());
}

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateKey(d);
}

/* ── Habit Frequency Logic ──────────────── */
function isHabitDue(habit, dateStr) {
  if (!habit.freq) return true;

  /* FIX: new Date("YYYY-MM-DD") diparse sebagai UTC midnight,
     sehingga d.getDay() bisa salah satu hari di timezone lokal.
     Tambahkan T00:00:00 agar diparse sebagai waktu lokal. */
  const d = new Date(dateStr + 'T00:00:00');

  if (habit.freq.type === 'daily') return true;
  if (habit.freq.type === 'weekly') return habit.freq.value.includes(d.getDay());
  if (habit.freq.type === 'interval') {
    const start = new Date((habit.createdAt || dateStr).slice(0, 10) + 'T00:00:00');
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

/* ── Export / Import ─────────────────── */
function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    habits:   State.habits,
    schedule: State.schedule,
    checks:   State.checks,
    fontHeader: State.fontHeader
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `daily-planner-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Validasi minimal
      if (!data.habits || !data.schedule || !data.checks) {
        alert('❌ File tidak valid. Pastikan file dari export Daily Planner.');
        return;
      }

      const confirmed = confirm(
        `Import akan menimpa semua data saat ini:\n` +
        `• ${data.habits.length} kebiasaan\n` +
        `• ${data.schedule.length} jadwal\n` +
        `• Data check-in yang tersimpan\n\n` +
        `Lanjutkan?`
      );
      if (!confirmed) return;

      State.habits   = data.habits;
      State.schedule = data.schedule;
      State.checks   = data.checks;
      if (data.fontHeader) {
        State.fontHeader = data.fontHeader;
        localStorage.setItem(K_FONT, data.fontHeader);
      }
      lsSave();
      render();
      alert('✅ Data berhasil diimport!');
    } catch (err) {
      alert('❌ Gagal membaca file. Pastikan file JSON yang valid.');
    }
  };
  reader.readAsText(file);
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
