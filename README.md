# 🧒 Kiyu's Daily Activity & Progress Tracker

> A delightful, automated daily activity planner and progress tracker for Kiyu! Sends age-appropriate activities to your family Telegram group, provides an interactive Telegram Mini App / Web Dashboard with charts and graphs, and delivers a visual evening report card with progress charts.

---

## ✨ Features

- 🌞 **3 Daily Plan Messages**: Morning routine (7:00 AM), Afternoon play (12:30 PM), Evening wind-down (5:00 PM) IST.
- 🏆 **Daily Progress Report Card**: Automated visual summary at 8:30 PM IST with an auto-generated visual doughnut chart image sent directly to Telegram!
- 📱 **Telegram Mini App & Tracker Dashboard**: Tap the **`[ 📊 Open Kiyu Tracker & Mark Done ]`** button on any message to open an interactive checklist right inside Telegram!
- 📊 **Visual Charts & Graphs**:
  - **Weekly Trend Graph**: Bar chart showing activity completions Monday through Sunday.
  - **Category Balance Doughnut**: Visual breakdown across Habits, Creative Art, Physical Play, Learning, and Helping.
  - **7-Day Consistency Streak**: Track daily completion streaks with glowing stars.
  - **Animated Circular Progress Dial**: Real-time completion gauge with celebratory confetti and sounds.
- 🏆 **Trophy Cabinet & Badges**: Unlock milestones like *Morning Champion*, *Little Picasso*, *Streak Master*, and *Superstar Day*!
- 🎲 **Smart Randomization & No Repetition**: Rotates activities without repetition for 3 days.
- 💰 **100% Free**: Runs completely on GitHub Actions + GitHub Pages with zero server costs.

---

## 📱 How It Works

```
Telegram Message (7:00 AM)
  ├── 🌞 Morning Routine activities
  └── 🔘 [ 📊 Open Kiyu Tracker & Mark Done ]
          │
          ▼ Tap to open in Telegram
  ┌─────────────────────────────────────────────────────────┐
  │ 🧒 Kiyu's Adventure Tracker                             │
  │ ⭐ 14 Stars   🔥 4 Day Streak   🎯 80% Completed        │
  │                                                         │
  │  [✓] 🪥 Brush teeth & wash face    (Ding! ✨ + Confetti) │
  │  [✓] 🥣 Breakfast helper                                │
  │  [ ] 🌱 Water the plants                                │
  │                                                         │
  │  📊 Weekly Trends Chart | 🎨 Category Balance Donut     │
  └─────────────────────────────────────────────────────────┘
          │
          ▼ 8:30 PM IST (Automated)
Telegram Evening Summary Card + Visual Chart Photo! 🏆
```

---

## 🚀 Live Dashboard

Your interactive progress dashboard is hosted on GitHub Pages:
👉 **[https://s1reyash.github.io/kiyu/](https://s1reyash.github.io/kiyu/)**

You can also open it from your phone's browser, bookmark it on your home screen, or open it directly inside Telegram!

---

## 📁 Project Structure

```
├── .github/workflows/
│   ├── daily-planner.yml     # GitHub Actions workflow (3 plans + 1 daily summary)
│   ├── deploy-pages.yml      # Automatic GitHub Pages deployment
│   └── keepalive.yml         # Keeps cron schedules active forever
├── docs/                     # Interactive Telegram Mini App & Web Dashboard
│   ├── index.html            # Dashboard structure & UI
│   ├── style.css             # Playful, modern styles & animations
│   ├── app.js                # State management, Chart.js, sound & confetti
│   └── data/
│       └── tracker.json      # Synced daily activity & completion tracking
├── scripts/
│   ├── send_plan.sh          # Picks activities & sends Telegram plan with button
│   └── send_daily_summary.sh # Generates visual chart & posts daily report card
├── data/
│   ├── activities.json       # Activity pools (edit this to customize!)
│   ├── tracker.json          # Daily progress & completion history
│   └── history.json          # 3-day repetition tracking
└── README.md
```

---

## ⏰ Schedule (IST)

| Time (IST) | Action | Details |
|------------|--------|---------|
| **7:00 AM** | 🌞 Morning Routine | Morning habit & routine activities + Tracker button |
| **12:30 PM** | ☀️ Afternoon Play | Creative, sensory & outdoor play after school |
| **5:00 PM** | 🌙 Evening Wind-Down | Calming stories, cuddles & bedtime prep |
| **8:30 PM** | 🏆 Daily Report Card | Visual completion chart image + stars & streak recap |

---

## 🧪 Testing Locally

```bash
# Test Daily Plan (dry run)
export TIME_SLOT="morning"
export DRY_RUN="true"
bash scripts/send_plan.sh

# Test Daily Summary & Visual Chart (dry run)
export DRY_RUN="true"
bash scripts/send_daily_summary.sh
```

---

## ❤️ Made with love for Kiyu
