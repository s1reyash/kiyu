/**
 * 🧒 Kiyu's Daily Activity Tracker V2 Logic
 * Includes: Real photo showcase, Cry Baby / tears tracker,
 * Milk & water hydration, Star Reward Store, and Telegram family sync.
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

// ─── App State ────────────────────────────────────────────────
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
  cries: [],
  water_glasses: 0,
  milk_glasses: 0,
  rewards: [
    { id: 'rew_1', title: 'Favorite Storytime', emoji: '📖', stars: 5, unlocked: false },
    { id: 'rew_2', title: 'Playground Trip', emoji: '🛝', stars: 15, unlocked: false },
    { id: 'rew_3', title: 'Yummy Ice Cream', emoji: '🍦', stars: 25, unlocked: false },
    { id: 'rew_4', title: 'New Plushie Friend', emoji: '🧸', stars: 50, unlocked: false }
  ]
};

let selectedCryReason = "Sleepy / Tired";

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
  const savedCries = localStorage.getItem(`kiyu_cries_${appState.date}`);
  const savedWater = localStorage.getItem(`kiyu_water_${appState.date}`);
  const savedMilk = localStorage.getItem(`kiyu_milk_${appState.date}`);
  const soundPref = localStorage.getItem('kiyu_sound_pref');

  if (soundPref !== null) {
    appState.soundEnabled = soundPref === 'true';
    updateSoundButton();
  }

  if (savedStars !== null) appState.stars = parseInt(savedStars, 10);
  if (savedStreak !== null) appState.streak = parseInt(savedStreak, 10);
  if (savedCries !== null) {
    try { appState.cries = JSON.parse(savedCries); } catch (e) {}
  }
  if (savedWater !== null) appState.water_glasses = parseInt(savedWater, 10);
  if (savedMilk !== null) appState.milk_glasses = parseInt(savedMilk, 10);

  // 2. Fetch server-side tracker.json
  let serverActivities = null;
  try {
    const res = await fetch('data/tracker.json?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data.history && data.history[appState.date]) {
        serverActivities = data.history[appState.date];
        if (serverActivities.cries && appState.cries.length === 0) {
          appState.cries = serverActivities.cries;
        }
        if (serverActivities.water_glasses !== undefined && savedWater === null) {
          appState.water_glasses = serverActivities.water_glasses;
        }
        if (serverActivities.milk_glasses !== undefined && savedMilk === null) {
          appState.milk_glasses = serverActivities.milk_glasses;
        }
      }
      if (data.total_stars !== undefined && savedStars === null) appState.stars = data.total_stars;
      if (data.streak_days !== undefined && savedStreak === null) appState.streak = data.streak_days;
      if (data.rewards) appState.rewards = data.rewards;
    }
  } catch (e) {
    console.log("Could not load data/tracker.json:", e);
  }

  // 3. Reconcile with savedState
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      appState.activities = parsed;
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
  localStorage.setItem(`kiyu_cries_${appState.date}`, JSON.stringify(appState.cries));
  localStorage.setItem(`kiyu_water_${appState.date}`, appState.water_glasses);
  localStorage.setItem(`kiyu_milk_${appState.date}`, appState.milk_glasses);
}

// ─── Rendering UI ────────────────────────────────────────────
function renderAll() {
  renderSlotList('morning', 'morningList', 'morningCounter');
  renderSlotList('afternoon', 'afternoonList', 'afternoonCounter');
  renderSlotList('evening', 'eveningList', 'eveningCounter');

  updateProgressRingAndStats();
  renderCryTracker();
  renderHydration();
  renderRewards();
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

// ─── Cry Baby & Mood Tracker Logic ───────────────────────────
function renderCryTracker() {
  const cryCount = appState.cries.length;
  const countEl = document.getElementById('cryCountDisplay');
  const iconEl = document.getElementById('cryStatIcon');
  const badgeEl = document.getElementById('cryStatusBadge');
  const listEl = document.getElementById('cryLogList');

  if (countEl) countEl.textContent = cryCount;

  if (cryCount === 0) {
    if (iconEl) iconEl.textContent = "😇";
    if (badgeEl) {
      badgeEl.className = "cry-status-badge";
      badgeEl.textContent = "😇 Tear-Free Angel!";
    }
    if (listEl) {
      listEl.innerHTML = `<div class="empty-cry-msg">No cries logged today! Kiyu is being a superstar champion! 🌟</div>`;
    }
  } else {
    if (iconEl) iconEl.textContent = "🥺";
    if (badgeEl) {
      badgeEl.className = "cry-status-badge has-cries";
      badgeEl.textContent = `${cryCount} ${cryCount === 1 ? 'Cry Moment' : 'Cry Moments'}`;
    }
    if (listEl) {
      listEl.innerHTML = appState.cries.map(c => `
        <div class="cry-log-item">
          <div class="cry-log-left">
            <span>😭</span>
            <span class="cry-reason-tag">${escapeHTML(c.reason)}</span>
            ${c.note ? `<span style="color:#64748B;">("${escapeHTML(c.note)}")</span>` : ''}
          </div>
          <span class="cry-time-tag">${c.time}</span>
        </div>
      `).join('');
    }
  }
}

function logCry(reason, note = '') {
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  appState.cries.unshift({
    id: `cry_${Date.now()}`,
    time,
    reason,
    note
  });
  persistState();
  renderCryTracker();
  triggerHaptic('medium');
  showToast(`😭 Logged cry moment: ${reason}`);
}

function markCalm() {
  appState.stars += 1;
  persistState();
  renderAll();
  triggerHaptic('success');
  playCelebrationSound();
  if (window.confetti) {
    window.confetti({ particleCount: 25, spread: 50 });
  }
  showToast(`😊 Calm & happy hour logged! (+1 ⭐)`);
}

// ─── Hydration Tracker (Milk & Water) ─────────────────────────
function renderHydration() {
  const milkEl = document.getElementById('milkCount');
  const waterEl = document.getElementById('waterCount');
  if (milkEl) milkEl.textContent = `${appState.milk_glasses} / 2`;
  if (waterEl) waterEl.textContent = `${appState.water_glasses} / 5`;
}

function updateMilk(delta) {
  appState.milk_glasses = Math.max(0, appState.milk_glasses + delta);
  if (delta > 0) {
    appState.stars += 1;
    triggerHaptic('success');
    showToast(`🥛 Milk glass logged! (+1 ⭐)`);
  }
  persistState();
  renderAll();
}

function updateWater(delta) {
  appState.water_glasses = Math.max(0, appState.water_glasses + delta);
  if (delta > 0) {
    triggerHaptic('light');
    showToast(`💧 Water glass logged! Stay healthy, Kiyu!`);
  }
  persistState();
  renderAll();
}

// ─── Reward Store (Star Shop) ────────────────────────────────
function renderRewards() {
  const grid = document.getElementById('rewardsGrid');
  const badge = document.getElementById('storeBalanceBadge');
  if (badge) badge.textContent = `⭐ ${appState.stars} Stars Available`;
  if (!grid) return;

  grid.innerHTML = appState.rewards.map(r => {
    const canClaim = appState.stars >= r.stars;
    return `
      <div class="reward-item ${canClaim ? 'claimable' : ''}">
        <span class="reward-emoji">${r.emoji}</span>
        <h4 class="reward-title">${escapeHTML(r.title)}</h4>
        <span class="reward-cost">⭐ ${r.stars} Stars</span>
        <button class="reward-claim-btn" onclick="claimReward('${r.id}', ${r.stars})" ${canClaim ? '' : 'disabled'}>
          ${canClaim ? 'Claim Treat! 🎉' : `Need ${r.stars - appState.stars} more`}
        </button>
      </div>
    `;
  }).join('');
}

window.claimReward = function(rewardId, cost) {
  if (appState.stars < cost) return;
  appState.stars -= cost;
  persistState();
  renderAll();
  triggerHaptic('success');
  playCelebrationSound();
  if (window.confetti) {
    window.confetti({ particleCount: 60, spread: 80 });
  }
  const reward = appState.rewards.find(r => r.id === rewardId);
  showToast(`🎉 Reward Claimed: "${reward.title}"! Enjoy, Kiyu!`);
};

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
            data: [0, 0, 0, 0, getCompletedCount(), 0, 0],
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
    { name: 'Mon', completed: false, val: '-' },
    { name: 'Tue', completed: false, val: '-' },
    { name: 'Wed', completed: false, val: '-' },
    { name: 'Thu', completed: false, val: '-' },
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
  const tearFree = appState.cries.length === 0;

  const trophies = [
    {
      id: 'tear_free',
      badge: '😇',
      title: 'Tear-Free Champion',
      desc: 'Spent the whole day calm and happy with zero tears',
      unlocked: tearFree
    },
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

  const filledBlocks = Math.round((percent / 100) * 10);
  const emptyBlocks = 10 - filledBlocks;
  const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  const dateFormatted = formatDisplayDate(appState.date);
  const cryText = appState.cries.length === 0 ? "0 (Tear-Free Angel! 😇)" : `${appState.cries.length} times logged`;

  return `🧒 Kiyu's Daily Progress Update
📅 ${dateFormatted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Progress: [${progressBar}] ${percent}% (${completed}/${total} Done)
⭐ Stars: ${appState.stars} Collected
🔥 Day Streak: ${appState.streak} Days
😭 Tears Today: ${cryText}
🥛 Milk: ${appState.milk_glasses}/2 glasses | 💧 Water: ${appState.water_glasses}/5 glasses

🌟 Great job today, Kiyu! Teddy & Tiger Cat are cheering for you! 🧸🐱`;
}

function shareToTelegram() {
  const summary = generateTelegramSummary();

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

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://s1reyash.github.io/kiyu/docs/')}&text=${encodeURIComponent(summary)}`;
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
      const crySec = document.getElementById('crySection');
      const hydrateSec = document.getElementById('hydrationSection');
      const graphsSec = document.getElementById('graphsSection');
      const rewardsSec = document.getElementById('rewardsSection');
      const badgesSec = document.getElementById('badgesSection');

      if (tab === 'allTab') {
        tasksSec.style.display = 'flex';
        crySec.style.display = 'flex';
        hydrateSec.style.display = 'flex';
        graphsSec.style.display = 'flex';
        rewardsSec.style.display = 'flex';
        badgesSec.style.display = 'flex';
      } else if (tab === 'checklistTab') {
        tasksSec.style.display = 'flex';
        crySec.style.display = 'none';
        hydrateSec.style.display = 'none';
        graphsSec.style.display = 'none';
        rewardsSec.style.display = 'none';
        badgesSec.style.display = 'none';
      } else if (tab === 'cryTrackerTab') {
        tasksSec.style.display = 'none';
        crySec.style.display = 'flex';
        hydrateSec.style.display = 'none';
        graphsSec.style.display = 'none';
        rewardsSec.style.display = 'none';
        badgesSec.style.display = 'none';
      } else if (tab === 'analyticsTab') {
        tasksSec.style.display = 'none';
        crySec.style.display = 'none';
        hydrateSec.style.display = 'none';
        graphsSec.style.display = 'flex';
        rewardsSec.style.display = 'none';
        badgesSec.style.display = 'none';
      } else if (tab === 'rewardTab') {
        tasksSec.style.display = 'none';
        crySec.style.display = 'none';
        hydrateSec.style.display = 'none';
        graphsSec.style.display = 'none';
        rewardsSec.style.display = 'flex';
        badgesSec.style.display = 'none';
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

  // Cry Modal controls
  const cryModal = document.getElementById('cryReasonModal');
  document.getElementById('logCryBtn')?.addEventListener('click', () => {
    cryModal.classList.add('open');
  });

  document.getElementById('closeCryModalBtn')?.addEventListener('click', () => {
    cryModal.classList.remove('open');
  });

  document.querySelectorAll('.reason-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCryReason = btn.getAttribute('data-reason');
    });
  });

  document.getElementById('submitCryBtn')?.addEventListener('click', () => {
    const note = document.getElementById('customCryNote').value.trim();
    logCry(selectedCryReason, note);
    cryModal.classList.remove('open');
    document.getElementById('customCryNote').value = '';
  });

  document.getElementById('markCalmBtn')?.addEventListener('click', markCalm);

  // Hydration buttons
  document.getElementById('plusMilkBtn')?.addEventListener('click', () => updateMilk(1));
  document.getElementById('minusMilkBtn')?.addEventListener('click', () => updateMilk(-1));
  document.getElementById('plusWaterBtn')?.addEventListener('click', () => updateWater(1));
  document.getElementById('minusWaterBtn')?.addEventListener('click', () => updateWater(-1));

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
    if (e.target === cryModal) cryModal.classList.remove('open');
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
