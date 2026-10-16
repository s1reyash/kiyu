/**
 * 🧒 Kiyu's Daily Activity Tracker & Telegram Mini App Logic
 */

// ─── Constants & Configuration ────────────────────────────────
const KID_NAME = "Kiyu";
const CIRCLE_CIRCUMFERENCE = 414.69; // 2 * PI * 66

const CATEGORY_COLORS = {
  routine: '#FF9F43',
  creative: '#FF6B6B',
  physical: '#1DD1A1',
  learning: '#54A0FF',
  helping: '#5F27CD'
};

const CATEGORY_LABELS = {
  routine: '🪥 Habit & Routine',
  creative: '🎨 Creative & Art',
  physical: '🏃 Physical & Active',
  learning: '📚 Learning & Books',
  helping: '🤝 Helping & Kindness'
};

// ─── State ───────────────────────────────────────────────────
let appState = {
  date: getTodayIST(),
  stars: 0,
  streak: 1,
  soundEnabled: true,
  activities: {
    morning: [],
    afternoon: [],
    evening: []
  },
  history: {}
};

// ─── Telegram WebApp Setup ───────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#FFF9F2');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#FFF9F2');
  } catch (e) {
    console.log("Telegram WebApp initialization error:", e);
  }
}

function triggerHaptic(type = 'medium') {
  if (tg?.HapticFeedback) {
    try {
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else tg.HapticFeedback.impactOccurred(type);
    } catch (e) {}
  }
}

// ─── Audio Chime Synthesizer ─────────────────────────────────
function playCelebrationSound() {
  if (!appState.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
    });
  } catch (e) {
    console.log("Sound play error:", e);
  }
}

// ─── Date Utility (IST) ──────────────────────────────────────
function getTodayIST() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5)); // +5:30 IST
  return ist.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// ─── Initial Data Loading & Synchronization ──────────────────
async function initData() {
  document.getElementById('displayDate').textContent = formatDisplayDate(appState.date);

  // 1. Load persisted data from localStorage
  const savedState = localStorage.getItem(`kiyu_tracker_${appState.date}`);
  const savedStars = localStorage.getItem('kiyu_total_stars');
  const savedStreak = localStorage.getItem('kiyu_streak_days');
  const soundPref = localStorage.getItem('kiyu_sound_pref');

  if (soundPref !== null) {
    appState.soundEnabled = soundPref === 'true';
    updateSoundButton();
  }

  if (savedStars) appState.stars = parseInt(savedStars, 10);
  if (savedStreak) appState.streak = parseInt(savedStreak, 10);

  // 2. Fetch server-side tracker.json
  let serverActivities = null;
  try {
    const res = await fetch('data/tracker.json?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data.history && data.history[appState.date]) {
        serverActivities = data.history[appState.date];
      }
      if (data.total_stars && !savedStars) appState.stars = data.total_stars;
      if (data.streak_days && !savedStreak) appState.streak = data.streak_days;
    }
  } catch (e) {
    console.log("Could not load data/tracker.json:", e);
  }

  // 3. Reconcile with savedState
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      appState.activities = parsed;
      // If serverActivities has items for afternoon/evening not yet in localStorage, merge them
      if (serverActivities) {
        ['morning', 'afternoon', 'evening'].forEach(slot => {
          if (serverActivities[slot] && (!appState.activities[slot] || appState.activities[slot].length === 0)) {
            appState.activities[slot] = serverActivities[slot];
          }
        });
      }
    } catch (e) {}
  } else if (serverActivities) {
    appState.activities = serverActivities;
  } else {
    // Friendly fallback defaults
    appState.activities = getDefaultActivities();
  }

  // Ensure slots exist
  if (!appState.activities.morning || appState.activities.morning.length === 0) {
    appState.activities.morning = [
      { id: 'm1', name: "Breakfast helper", emoji: "🥣", category: "helping", completed: false },
      { id: 'm2', name: "Draw a smiley face", emoji: "😊", category: "creative", completed: false },
      { id: 'm3', name: "Water the plants", emoji: "🌱", category: "routine", completed: false }
    ];
  }
  if (!appState.activities.afternoon || appState.activities.afternoon.length === 0) {
    appState.activities.afternoon = [
      { id: 'a1', name: "Coloring & drawing", emoji: "🎨", category: "creative", completed: false },
      { id: 'a2', name: "Balloon games", emoji: "🎈", category: "creative", completed: false },
      { id: 'a3', name: "Outdoor cycling", emoji: "🚲", category: "physical", completed: false }
    ];
  }
  if (!appState.activities.evening || appState.activities.evening.length === 0) {
    appState.activities.evening = [
      { id: 'e1', name: "Storytime with family", emoji: "📚", category: "learning", completed: false },
      { id: 'e2', name: "Gentle coloring", emoji: "🖍️", category: "creative", completed: false },
      { id: 'e3', name: "Cuddle & chat about the day", emoji: "🤗", category: "helping", completed: false }
    ];
  }

  renderAll();
  initCharts();
}

function getDefaultActivities() {
  return {
    morning: [
      { id: 'm1', name: "Breakfast helper", emoji: "🥣", category: "helping", completed: false },
      { id: 'm2', name: "Draw a smiley face", emoji: "😊", category: "creative", completed: false },
      { id: 'm3', name: "Water the plants", emoji: "🌱", category: "routine", completed: false }
    ],
    afternoon: [
      { id: 'a1', name: "Coloring & drawing", emoji: "🎨", category: "creative", completed: false },
      { id: 'a2', name: "Balloon games", emoji: "🎈", category: "creative", completed: false },
      { id: 'a3', name: "Outdoor cycling", emoji: "🚲", category: "physical", completed: false }
    ],
    evening: [
      { id: 'e1', name: "Storytime with family", emoji: "📚", category: "learning", completed: false },
      { id: 'e2', name: "Gentle coloring", emoji: "🖍️", category: "creative", completed: false },
      { id: 'e3', name: "Cuddle & chat about the day", emoji: "🤗", category: "helping", completed: false }
    ]
  };
}

function persistState() {
  localStorage.setItem(`kiyu_tracker_${appState.date}`, JSON.stringify(appState.activities));
  localStorage.setItem('kiyu_total_stars', appState.stars);
  localStorage.setItem('kiyu_streak_days', appState.streak);
}

// ─── Rendering UI ────────────────────────────────────────────
function renderAll() {
  renderSlotList('morning', 'morningList', 'morningCounter');
  renderSlotList('afternoon', 'afternoonList', 'afternoonCounter');
  renderSlotList('evening', 'eveningList', 'eveningCounter');

  updateProgressRingAndStats();
  renderStreakGrid();
  renderTrophies();
}

function renderSlotList(slotKey, containerId, counterId) {
  const container = document.getElementById(containerId);
  const counterEl = document.getElementById(counterId);
  if (!container) return;

  const list = appState.activities[slotKey] || [];
  const completedCount = list.filter(item => item.completed).length;

  if (counterEl) {
    counterEl.textContent = `${completedCount}/${list.length}`;
  }

  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:12px; color:#A4B0BE; font-size:0.85rem;">No activities scheduled yet</div>`;
    return;
  }

  list.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = `activity-item ${item.completed ? 'completed' : ''}`;
    itemEl.onclick = () => toggleActivity(slotKey, index);

    const catColor = CATEGORY_COLORS[item.category || 'creative'] || '#FF6B6B';
    const catLabel = CATEGORY_LABELS[item.category || 'creative'] || 'Fun';

    itemEl.innerHTML = `
      <div class="activity-main-info">
        <div class="activity-emoji-badge">
          <span>${item.emoji || '⭐'}</span>
        </div>
        <div class="activity-meta">
          <span class="activity-name">${escapeHTML(item.name)}</span>
          <span class="category-tag" style="color: ${catColor}">
            <span>●</span> ${catLabel}
          </span>
        </div>
      </div>
      <button class="status-action-btn ${item.completed ? 'done' : ''}" type="button" aria-label="Toggle completed">
        <span class="btn-box">${item.completed ? '✓' : ''}</span>
        <span class="btn-text">${item.completed ? 'Done! ⭐' : 'Tap Done'}</span>
      </button>
    `;

    container.appendChild(itemEl);
  });
}

function toggleActivity(slotKey, index) {
  const item = appState.activities[slotKey][index];
  item.completed = !item.completed;

  if (item.completed) {
    appState.stars += 1;
    triggerHaptic('success');
    playCelebrationSound();

    // Trigger Confetti Burst
    if (window.confetti) {
      window.confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#FF9F43', '#FF6B6B', '#1DD1A1', '#54A0FF', '#FECA57']
      });
    }
    showToast(`🌟 Awesome! "${item.name}" marked complete! (+1 ⭐)`);
  } else {
    appState.stars = Math.max(0, appState.stars - 1);
    triggerHaptic('light');
    showToast(`Unchecked "${item.name}"`);
  }

  persistState();
  renderAll();
  updateCharts();

  // Check 100% completion celebration
  const allActivities = [
    ...(appState.activities.morning || []),
    ...(appState.activities.afternoon || []),
    ...(appState.activities.evening || [])
  ];
  const allCompleted = allActivities.length > 0 && allActivities.every(a => a.completed);
  if (allCompleted && item.completed) {
    celebratePerfectScore();
  }
}

function celebratePerfectScore() {
  if (window.confetti) {
    const end = Date.now() + 2500;
    const interval = setInterval(() => {
      if (Date.now() > end) return clearInterval(interval);
      window.confetti({
        startVelocity: 35,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random(), y: Math.random() - 0.2 }
      });
    }, 300);
  }
  showToast("🏆 WOW! Kiyu completed ALL activities today! Champion status! 🌟");
}

function updateProgressRingAndStats() {
  const allActivities = [
    ...(appState.activities.morning || []),
    ...(appState.activities.afternoon || []),
    ...(appState.activities.evening || [])
  ];

  const total = allActivities.length;
  const completed = allActivities.filter(a => a.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Update ring stroke
  const ring = document.getElementById('progressCircle');
  if (ring) {
    const offset = CIRCLE_CIRCUMFERENCE - (percent / 100) * CIRCLE_CIRCUMFERENCE;
    ring.style.strokeDashoffset = offset;
  }

  document.getElementById('progressPercentage').textContent = `${percent}%`;
  document.getElementById('completedRatio').textContent = `${completed}/${total}`;
  document.getElementById('totalStars').textContent = appState.stars;
  document.getElementById('currentStreak').textContent = `${appState.streak}`;

  const quickBar = document.getElementById('quickProgressBar');
  if (quickBar) quickBar.style.width = `${percent}%`;

  // Motivational quote logic
  const quoteEl = document.getElementById('heroMotivationalQuote');
  const subEl = document.getElementById('heroMotivationalSub');
  const ringSub = document.getElementById('ringSubText');

  if (percent === 0) {
    ringSub.textContent = "Let's Play!";
    quoteEl.textContent = `Rise and shine, ${KID_NAME}! 🌞`;
    subEl.textContent = "Tap any activity below to mark it done and earn stars!";
  } else if (percent < 50) {
    ringSub.textContent = "Great Start!";
    quoteEl.textContent = `Off to a flying start! 🚀`;
    subEl.textContent = `${completed} completed! Keep going, champion!`;
  } else if (percent < 100) {
    ringSub.textContent = "Almost There!";
    quoteEl.textContent = `More than halfway there! 🎈`;
    subEl.textContent = `Only ${total - completed} more activities for a perfect score!`;
  } else {
    ringSub.textContent = "Superstar!";
    quoteEl.textContent = `PERFECT SCORE! 🏆`;
    subEl.textContent = `${KID_NAME} achieved 100% today! Amazing job!`;
  }
}

// ─── Analytics & Charts (Chart.js) ───────────────────────────
let weeklyChart = null;
let categoryChart = null;

function initCharts() {
  const weeklyCtx = document.getElementById('weeklyTrendsChart')?.getContext('2d');
  const categoryCtx = document.getElementById('categoryDonutChart')?.getContext('2d');

  if (weeklyCtx) {
    weeklyChart = new Chart(weeklyCtx, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Completed',
            data: [7, 8, 6, 9, getCompletedCount(), 0, 0],
            backgroundColor: '#1DD1A1',
            borderRadius: 8,
            borderSkipped: false
          },
          {
            label: 'Target',
            data: [9, 9, 9, 9, getTotalCount(), 9, 9],
            backgroundColor: '#F1F2F6',
            borderRadius: 8,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2D3436',
            titleFont: { family: 'Plus Jakarta Sans', weight: '700' },
            bodyFont: { family: 'Plus Jakarta Sans' },
            cornerRadius: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Fredoka', size: 12, weight: '600' }, color: '#636E72' }
          },
          y: {
            grid: { color: '#F1F2F6' },
            ticks: { stepSize: 3, font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#A4B0BE' },
            max: 10
          }
        }
      }
    });
  }

  if (categoryCtx) {
    const catData = getCategoryBreakdown();
    categoryChart = new Chart(categoryCtx, {
      type: 'doughnut',
      data: {
        labels: ['Routine', 'Creative', 'Physical', 'Learning', 'Helping'],
        datasets: [{
          data: catData,
          backgroundColor: [
            CATEGORY_COLORS.routine,
            CATEGORY_COLORS.creative,
            CATEGORY_COLORS.physical,
            CATEGORY_COLORS.learning,
            CATEGORY_COLORS.helping
          ],
          borderWidth: 3,
          borderColor: '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2D3436',
            cornerRadius: 8
          }
        }
      }
    });

    renderCategoryLegend();
  }
}

function updateCharts() {
  if (weeklyChart) {
    weeklyChart.data.datasets[0].data[4] = getCompletedCount();
    weeklyChart.data.datasets[1].data[4] = getTotalCount();
    weeklyChart.update();
  }

  if (categoryChart) {
    categoryChart.data.datasets[0].data = getCategoryBreakdown();
    categoryChart.update();
  }
}

function getCompletedCount() {
  const all = [
    ...(appState.activities.morning || []),
    ...(appState.activities.afternoon || []),
    ...(appState.activities.evening || [])
  ];
  return all.filter(a => a.completed).length;
}

function getTotalCount() {
  const all = [
    ...(appState.activities.morning || []),
    ...(appState.activities.afternoon || []),
    ...(appState.activities.evening || [])
  ];
  return all.length || 9;
}

function getCategoryBreakdown() {
  const counts = { routine: 0, creative: 0, physical: 0, learning: 0, helping: 0 };
  const all = [
    ...(appState.activities.morning || []),
    ...(appState.activities.afternoon || []),
    ...(appState.activities.evening || [])
  ];
  all.forEach(item => {
    const cat = item.category || 'creative';
    if (counts[cat] !== undefined) {
      counts[cat] += item.completed ? 2 : 1;
    }
  });
  return [counts.routine, counts.creative, counts.physical, counts.learning, counts.helping];
}

function renderCategoryLegend() {
  const legendEl = document.getElementById('categoryLegend');
  if (!legendEl) return;
  legendEl.innerHTML = `
    <div class="legend-item"><span class="legend-color" style="background:${CATEGORY_COLORS.routine}"></span> Habit & Routine</div>
    <div class="legend-item"><span class="legend-color" style="background:${CATEGORY_COLORS.creative}"></span> Creative & Art</div>
    <div class="legend-item"><span class="legend-color" style="background:${CATEGORY_COLORS.physical}"></span> Physical Play</div>
    <div class="legend-item"><span class="legend-color" style="background:${CATEGORY_COLORS.learning}"></span> Learning & Books</div>
  `;
}

function renderStreakGrid() {
  const grid = document.getElementById('streakGrid');
  if (!grid) return;
  const days = [
    { name: 'Mon', completed: true, val: '8/9' },
    { name: 'Tue', completed: true, val: '7/9' },
    { name: 'Wed', completed: true, val: '9/9' },
    { name: 'Thu', completed: true, val: '8/9' },
    { name: 'Fri', completed: getCompletedCount() > 0, val: `${getCompletedCount()}/${getTotalCount()}` },
    { name: 'Sat', completed: false, val: 'Pending' },
    { name: 'Sun', completed: false, val: 'Pending' }
  ];

  grid.innerHTML = days.map(d => `
    <div class="streak-day-cell ${d.completed ? 'active-day' : ''}">
      <span class="day-cell-name">${d.name}</span>
      <span class="day-cell-icon">${d.completed ? '⭐' : '⚪'}</span>
      <span class="day-cell-stat">${d.val}</span>
    </div>
  `).join('');
}

// ─── Trophies & Milestones ───────────────────────────────────
function renderTrophies() {
  const grid = document.getElementById('trophiesGrid');
  if (!grid) return;

  const morningDone = (appState.activities.morning || []).every(a => a.completed) && (appState.activities.morning || []).length > 0;
  const creativeCount = getCategoryBreakdown()[1];
  const perfectDay = getCompletedCount() === getTotalCount() && getTotalCount() > 0;

  const trophies = [
    {
      id: 'early_bird',
      badge: '🪥',
      title: 'Morning Champion',
      desc: 'Completed all morning routine activities',
      unlocked: morningDone
    },
    {
      id: 'picasso',
      badge: '🎨',
      title: 'Little Picasso',
      desc: 'Finished coloring, drawing or art fun',
      unlocked: creativeCount >= 2
    },
    {
      id: 'streak_master',
      badge: '🔥',
      title: 'Streak Master',
      desc: 'Maintained activity tracking for 3+ days',
      unlocked: appState.streak >= 1
    },
    {
      id: 'superstar',
      badge: '🏆',
      title: 'Superstar Day',
      desc: 'Completed 100% of planned activities',
      unlocked: perfectDay
    }
  ];

  grid.innerHTML = trophies.map(t => `
    <div class="trophy-card ${t.unlocked ? 'unlocked' : 'locked'}">
      <div class="trophy-badge">
        <span>${t.badge}</span>
      </div>
      <h4 class="trophy-title">${t.title}</h4>
      <p class="trophy-desc">${t.desc}</p>
      <span class="trophy-status">${t.unlocked ? 'Unlocked 🌟' : 'In Progress'}</span>
    </div>
  `).join('');
}

// ─── Telegram Share Message Generator ────────────────────────
function generateTelegramSummary() {
  const total = getTotalCount();
  const completed = getCompletedCount();
  const percent = Math.round((completed / total) * 100);

  // Unicode Progress Bar
  const filledBlocks = Math.round((percent / 100) * 10);
  const emptyBlocks = 10 - filledBlocks;
  const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  const dateFormatted = formatDisplayDate(appState.date);

  const morningStats = `${(appState.activities.morning || []).filter(a => a.completed).length}/${(appState.activities.morning || []).length}`;
  const afternoonStats = `${(appState.activities.afternoon || []).filter(a => a.completed).length}/${(appState.activities.afternoon || []).length}`;
  const eveningStats = `${(appState.activities.evening || []).filter(a => a.completed).length}/${(appState.activities.evening || []).length}`;

  return `🧒 Kiyu's Daily Progress Update
📅 ${dateFormatted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress: [${progressBar}] ${percent}% (${completed}/${total} Done)
⭐ Stars earned: ${appState.stars}
🔥 Day streak: ${appState.streak} Days

🌞 Morning: ${morningStats} Done
☀️ Afternoon: ${afternoonStats} Done
🌙 Evening: ${eveningStats} Done

🌟 Great job today, Kiyu! Keep shining! 💛`;
}

function shareToTelegram() {
  const summary = generateTelegramSummary();

  // If inside Telegram WebApp
  if (tg && tg.sendData) {
    try {
      tg.sendData(JSON.stringify({
        action: 'daily_progress_update',
        date: appState.date,
        completed: getCompletedCount(),
        total: getTotalCount(),
        percent: Math.round((getCompletedCount() / getTotalCount()) * 100)
      }));
    } catch (e) {}
  }

  // Also open share URL
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://s1reyash.github.io/kiyu/')}&text=${encodeURIComponent(summary)}`;
  window.open(shareUrl, '_blank');
  showToast("📋 Report copied & opened in Telegram!");
}

// ─── Toast & Helpers ─────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function updateSoundButton() {
  const btn = document.getElementById('soundToggle');
  if (btn) btn.textContent = appState.soundEnabled ? '🔊' : '🔇';
}

// ─── Event Listeners ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initData();

  // View Filtering Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.getAttribute('data-tab');
      const tasksSec = document.getElementById('tasksSection');
      const graphsSec = document.getElementById('graphsSection');
      const badgesSec = document.getElementById('badgesSection');

      if (tab === 'allTab') {
        tasksSec.style.display = 'flex';
        graphsSec.style.display = 'flex';
        badgesSec.style.display = 'flex';
      } else if (tab === 'checklistTab') {
        tasksSec.style.display = 'flex';
        graphsSec.style.display = 'none';
        badgesSec.style.display = 'none';
      } else if (tab === 'analyticsTab') {
        tasksSec.style.display = 'none';
        graphsSec.style.display = 'flex';
        badgesSec.style.display = 'none';
      } else if (tab === 'trophyTab') {
        tasksSec.style.display = 'none';
        graphsSec.style.display = 'none';
        badgesSec.style.display = 'flex';
      }

      setTimeout(updateCharts, 50);
    });
  });

  // Sound toggle
  document.getElementById('soundToggle')?.addEventListener('click', () => {
    appState.soundEnabled = !appState.soundEnabled;
    localStorage.setItem('kiyu_sound_pref', appState.soundEnabled);
    updateSoundButton();
    showToast(appState.soundEnabled ? '🔊 Sound effects on' : '🔇 Sound muted');
  });

  // Share buttons
  document.getElementById('shareTelegramBtn')?.addEventListener('click', shareToTelegram);
  document.getElementById('telegramShareActionBtn')?.addEventListener('click', shareToTelegram);

  // Custom Activity Modal
  const modal = document.getElementById('customActivityModal');
  document.getElementById('addCustomActivityBtn')?.addEventListener('click', () => {
    modal.classList.add('open');
  });

  document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  document.getElementById('customActivityForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('customName').value.trim();
    const emoji = document.getElementById('customEmoji').value.trim() || '✨';
    const slot = document.getElementById('customSlot').value;
    const category = document.getElementById('customCategory').value;

    if (!name) return;

    if (!appState.activities[slot]) appState.activities[slot] = [];
    appState.activities[slot].push({
      id: `custom_${Date.now()}`,
      name,
      emoji,
      category,
      completed: false
    });

    persistState();
    renderAll();
    updateCharts();
    modal.classList.remove('open');
    document.getElementById('customActivityForm').reset();
    showToast(`✨ Added "${name}" to ${slot} slot!`);
  });
});
