/* ── Tab navigation ───────────────────── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    btn.classList.add('active');
  });
});

/* ── Sidebar ──────────────────────────── */
function renderSidebar() {
  const now = new Date();
  document.getElementById('sb-day').textContent  = now.getDate();
  document.getElementById('sb-rest').textContent = DAYS_ID[now.getDay()] + ', ' + MONTHS_ID[now.getMonth()];
}

/* ── TODAY tab ────────────────────────── */
function renderToday() {
  const now     = new Date();
  const hour    = now.getHours();
  const nowMins = hour * 60 + now.getMinutes();
  const greet   = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const dk      = todayKey();

  document.getElementById('today-title').textContent = greet;
  document.getElementById('today-sub').textContent   =
    DAYS_ID[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS_ID[now.getMonth()] + ' ' + now.getFullYear();

  const dueTodayHabits = State.habits.filter(h => isHabitDue(h, dk));
  const done  = dueTodayHabits.filter(h => isChecked(h.id, dk)).length;
  const total = dueTodayHabits.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('today-summary').innerHTML = `
    <div class="sum-card"><div class="sum-num">${done}</div><div class="sum-label">Selesai</div></div>
    <div class="sum-card"><div class="sum-num">${total - done}</div><div class="sum-label">Tersisa</div></div>
    <div class="sum-card"><div class="sum-num">${total > 0 ? pct + '%' : '—'}</div><div class="sum-label">Progress</div></div>
  `;

  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('pct-label').textContent     = pct + '%';

  const hl = document.getElementById('today-habits');
  if (!dueTodayHabits.length) {
    hl.innerHTML = '<div class="empty">Tidak ada kebiasaan yang dijadwalkan untuk hari ini.</div>';
  } else {
    hl.innerHTML = dueTodayHabits.map(h => {
      const chk    = isChecked(h.id, dk);
      const streak = getStreak(h.id);
      let freqLabel = '';
      if (h.freq && h.freq.type === 'weekly')   freqLabel = ' (Mingguan)';
      if (h.freq && h.freq.type === 'interval') freqLabel = ` (Tiap ${h.freq.value} hari)`;

      return `
        <div class="habit-item ${chk ? 'done' : ''}" onclick="toggleCheck(${h.id})">
          <div class="check-box"><svg class="check-svg" width="10" height="8" viewBox="0 0 10 8" fill="none"><polyline points="1,4 4,7 9,1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="habit-label">${esc(h.name)}<span style="font-size:11px; color:var(--text-3);">${freqLabel}</span></div>
          ${streak > 0 ? `<div class="streak-pill"><b>${streak}</b> streak</div>` : ''}
        </div>`;
    }).join('');
  }

  const sl     = document.getElementById('today-schedule');
  const sorted = [...State.schedule].sort((a, b) => t2m(a.time) - t2m(b.time));
  if (!sorted.length) {
    sl.innerHTML = '<div class="empty">Belum ada jadwal. Tambahkan di tab Jadwal.</div>';
  } else {
    sl.innerHTML = sorted.map(s => {
      const sm  = t2m(s.time);
      const em  = sm + s.dur;
      const cur = nowMins >= sm && nowMins < em;
      return `
        <div class="sched-item ${cur ? 'current-slot' : ''}">
          <div class="sched-time">${s.time}</div>
          <div class="sched-title">${esc(s.title)}</div>
          <div class="sched-dur">${fmtDur(s.dur)}</div>
          <div></div>
        </div>`;
    }).join('');
  }
}

/* ── SCHEDULE tab ─────────────────────── */
function renderSchedule() {
  const sorted = [...State.schedule].sort((a, b) => t2m(a.time) - t2m(b.time));
  const el = document.getElementById('schedule-list');
  if (!sorted.length) {
    el.innerHTML = '<div class="empty">Belum ada jadwal.</div>';
    return;
  }
  el.innerHTML = sorted.map(s => `
    <div class="sched-item">
      <div class="sched-time">${s.time}</div>
      <div class="sched-title">${esc(s.title)}</div>
      <div class="sched-dur">${fmtDur(s.dur)}</div>
      <button class="del-btn" onclick="delSchedule(${s.id})" title="Hapus">×</button>
    </div>
  `).join('');
}

document.getElementById('btn-add-sched').addEventListener('click', () => {
  const time  = document.getElementById('new-time').value;
  const dur   = parseInt(document.getElementById('new-dur').value);
  const title = document.getElementById('new-sched-title').value.trim();
  if (!time || !dur || !title) return;
  State.schedule.push({ id: Date.now(), time, dur, title });
  document.getElementById('new-sched-title').value = '';
  lsSave(); render();
});

document.getElementById('new-sched-title').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-add-sched').click();
});

function delSchedule(id) {
  State.schedule = State.schedule.filter(s => s.id !== id);
  lsSave(); render();
}

/* ── HABITS tab ───────────────────────── */
function renderHabitsTab() {
  let hdr = '<div></div>';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    hdr += `<div class="hgrid-day">${DAYS_SH[d.getDay()]}</div>`;
  }
  hdr += '<div></div>';
  document.getElementById('hgrid-header').innerHTML = hdr;

  const grid = document.getElementById('habits-grid');
  if (!State.habits.length) {
    grid.innerHTML = '<div class="empty">Belum ada kebiasaan.</div>';
    return;
  }

  grid.innerHTML = State.habits.map(h => {
    let dots = '';
    for (let i = 6; i >= 0; i--) {
      const dk    = daysAgoKey(i);
      const isDue = isHabitDue(h, dk);
      const done  = isChecked(h.id, dk);
      const today = i === 0;
      dots += `<div class="h-dot ${done ? 'filled' : ''} ${today ? 'is-today' : ''}"
        ${isDue && today ? `onclick="toggleCheck(${h.id})"` : ''} 
        style="${!isDue ? 'opacity: 0.2; cursor: default;' : ''}"
        title="${dk}"></div>`;
    }
    return `
      <div class="habit-row">
        <div class="hrow-name"><span>${esc(h.name)}</span></div>
        ${dots}
        <button class="del-btn" onclick="delHabit(${h.id})" title="Hapus" style="opacity:0.4;">×</button>
      </div>`;
  }).join('');
}

document.getElementById('new-habit-type').addEventListener('change', (e) => {
  const type = e.target.value;
  document.getElementById('new-habit-days').style.display     = type === 'weekly'   ? 'block' : 'none';
  document.getElementById('new-habit-interval').style.display = type === 'interval' ? 'block' : 'none';
});

document.getElementById('btn-add-habit').addEventListener('click', () => {
  const name = document.getElementById('new-habit-name').value.trim();
  const type = document.getElementById('new-habit-type').value;
  if (!name) return;

  let freqData = { type: 'daily', value: null };
  if (type === 'weekly') {
    const daysStr  = document.getElementById('new-habit-days').value;
    freqData.value = daysStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    freqData.type  = 'weekly';
  } else if (type === 'interval') {
    freqData.value = parseInt(document.getElementById('new-habit-interval').value) || 2;
    freqData.type  = 'interval';
  }

  // createdAt disimpan sebagai YYYY-MM-DD (lokal) agar konsisten dengan key system
  State.habits.push({ id: Date.now(), name, freq: freqData, createdAt: todayKey() });
  document.getElementById('new-habit-name').value = '';
  lsSave(); render();
});

document.getElementById('new-habit-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-add-habit').click();
});

function delHabit(id) {
  State.habits = State.habits.filter(h => h.id !== id);
  lsSave(); render();
}

/* ── STATS tab ────────────────────────── */
function renderStats() {
  if (!State.habits.length) {
    ['stats-summary','stats-bar-chart','stats-table','stats-heatmap'].forEach(id => {
      document.getElementById(id).innerHTML = '<div class="empty">Belum ada data kebiasaan.</div>';
    });
    return;
  }

  const bestStreak = State.habits.reduce((mx, h) => Math.max(mx, getBestStreak(h.id)), 0);
  const mostConsistent = State.habits.reduce((best, h) => {
    const r = completionRate(h.id, 30);
    return r > best.rate ? { name: h.name, rate: r } : best;
  }, { name: '', rate: -1 });

  let sum7 = 0;
  for (let i = 0; i < 7; i++) sum7 += dailyOverallRate(i);
  const avg7 = Math.round(sum7 / 7);

  document.getElementById('stats-summary').innerHTML = `
    <div class="sum-card"><div class="sum-num">${avg7}%</div><div class="sum-label">Rata-rata 7 hari</div></div>
    <div class="sum-card"><div class="sum-num">${bestStreak}</div><div class="sum-label">Streak terbaik</div></div>
    <div class="sum-card"><div class="sum-num" style="font-size:22px;line-height:1.2;margin-top:4px;">${esc(mostConsistent.name || '—')}</div><div class="sum-label">Paling konsisten (30h)</div></div>
  `;

  const bars = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(); d.setDate(d.getDate() - i);
    const pct = dailyOverallRate(i);
    bars.push({ day: DAYS_SH[d.getDay()], date: d.getDate(), pct });
  }

  document.getElementById('stats-bar-chart').innerHTML = `
    <div class="chart-bars">
      ${bars.map(b => `<div class="chart-col"><div class="chart-pct-lbl">${b.pct > 0 ? b.pct + '%' : ''}</div><div class="chart-bar-bg"><div class="chart-bar-fill" style="height:${b.pct}%"></div></div><div class="chart-day-lbl">${b.date}</div></div>`).join('')}
    </div>
  `;

  const rows = State.habits.map(h => {
    const r7   = completionRate(h.id, 7);
    const r30  = completionRate(h.id, 30);
    const cur  = getStreak(h.id);
    const best = getBestStreak(h.id);
    return `<tr><td>${esc(h.name)}</td><td class="right">${r7}%</td><td class="right">${r30}%</td><td class="right">${cur}</td><td class="right">${best}</td></tr>`;
  }).join('');

  document.getElementById('stats-table').innerHTML = `
    <table class="stats-table">
      <thead><tr><th>Kebiasaan</th><th class="right">7 Hari</th><th class="right">30 Hari</th><th class="right">Streak</th><th class="right">Best</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(); d.setDate(d.getDate() - i);
    const pct = dailyOverallRate(i);
    const lvl = pct === 0 ? '0' : pct < 40 ? 'low' : pct < 75 ? 'mid' : 'high';
    cells.push(`<div class="hmap-cell" data-pct="${lvl}" title="${pct}% selesai"></div>`);
  }
  document.getElementById('stats-heatmap').innerHTML = `<div class="heatmap-grid">${cells.join('')}</div>`;
}

/* ── SETTINGS logic ───────────────────── */
document.getElementById('setting-font-header').addEventListener('change', (e) => {
  saveFontPreference(e.target.value);
});

/* ── Master render ────────────────────── */
function render() {
  applyFont();
  renderSidebar();
  renderToday();
  renderSchedule();
  renderHabitsTab();
  renderStats();
  document.getElementById('setting-font-header').value = State.fontHeader;
}

/* ── Deteksi pergantian hari ──────────────
 *
 * Tujuan: Saat user membuka app setelah tengah malam,
 * halaman otomatis refresh ke tampilan hari baru
 * tanpa perlu reload manual.
 *
 * Dua mekanisme:
 *   1. visibilitychange — menangkap saat user kembali ke tab/app
 *      setelah lama tidak aktif (misalnya buka di pagi hari)
 *   2. setInterval setiap 60 detik — untuk kasus app terus terbuka
 *      melewati tengah malam
 */
let _lastRenderedDate = todayKey();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const currentDate = todayKey();
    if (currentDate !== _lastRenderedDate) {
      _lastRenderedDate = currentDate;
      render(); // Hari baru → render ulang semua (centang otomatis reset karena key berubah)
    }
  }
});

setInterval(() => {
  const currentDate = todayKey();
  if (currentDate !== _lastRenderedDate) {
    _lastRenderedDate = currentDate;
    render();
  } else {
    renderToday(); // Update saja tampilan hari ini (jadwal aktif, dll.)
  }
}, 60000);

/* ── Init ─────────────────────────────── */
cleanOldChecks(); // Hapus data centang > 400 hari untuk efisiensi jangka panjang
render();
