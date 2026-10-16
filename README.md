# 🧒 Kiyu's Daily Activity & Progress Tracker V2

> A delightful, automated daily activity planner, mood & progress tracker for Kiyu! Sends age-appropriate activities to your family Telegram group, provides an interactive Telegram Mini App / Web Dashboard featuring Kiyu & his plushies (Teddy & Tiger Cat), tracks whether Kiyu cried or stayed calm, and syncs across all family members.

---

## ✨ What's New in V2

- 📸 **Kiyu's Real Photo Showcase**: Featuring Kiyu hugging his plushie buddies (Teddy 🧸 and Tiger Cat 🐱) on the dashboard!
- 😭 **Cry Baby & Mood Tracker**: Track whether Kiyu cried or stayed calm, log reasons (tired, hungry, toy sharing, tantrum), and celebrate "Tear-Free Angel" days!
- 🥛 **Milk & 💧 Water Hydration Tracker**: Tap glasses to track Kiyu's daily fluids.
- 🎁 **Star Reward Store**: Kiyu can redeem his hard-earned stars for rewards like *Extra Storytime* (5 ⭐), *Playground Trip* (15 ⭐), *Ice Cream* (25 ⭐), or a *New Plushie* (50 ⭐)!
- 👨‍👩‍👧 **Telegram Family Sync**: Any family member (Mom, Dad, Grandparents) can mark tasks or log mood right in the Telegram group using simple chat commands!
- 🏆 **Daily Report Card in Telegram**: Delivered at 8:35 PM IST with a visual doughnut chart image, progress bar, cry count, and hydration recap.
- 🔄 **Fresh Data Reset**: Clean slate starting from Day 1!

---

## 👨‍👩‍👧 Telegram Family Commands (Zero App Install Required!)

Anyone in the family Telegram group can send these quick commands:

| Command | Action | Example |
|---|---|---|
| `/done 1` | Mark activity 1 completed in current slot | `/done 1` or `/done 2` |
| `/cry <reason>` | Log a crying moment or meltdown | `/cry sleepy before nap` or `/cry wanted toys` |
| `/calm` or `/nocry` | Log a calm, tear-free hour (+1 ⭐) | `/calm` |
| `/water` | Log 1 glass of water | `/water` |
| `/milk` | Log 1 glass of milk (+1 ⭐) | `/milk` |
| `/progress` | Get instant report card in Telegram group | `/progress` |

*Whenever a family member sends a command, the bot confirms in the group so everyone stays in sync in real time!*

---

## 🌐 Live Dashboard & Telegram Mini App

Open the visual dashboard on any phone, tablet, or desktop:
👉 **[https://s1reyash.github.io/kiyu/docs/](https://s1reyash.github.io/kiyu/docs/)**

*(Also accessible directly inside Telegram by tapping the **`[ 📊 Open Kiyu Tracker & Mark Done ]`** button on any message).*

---

## 📁 Project Structure

```
├── assets/
│   └── kiyu.jpg              # Kiyu's real photo with Teddy & Tiger Cat
├── docs/                     # Interactive Web Dashboard & Telegram Mini App
│   ├── index.html            # Dashboard structure & UI
│   ├── style.css             # Playful styles, animations & responsive design
│   ├── app.js                # State management, Cry Baby tracker & Reward store
│   └── data/
│       └── tracker.json      # Synced daily activities, mood & hydration
├── scripts/
│   ├── send_plan.sh          # Picks activities & sends Telegram plan with button
│   ├── send_daily_summary.sh # Generates visual chart & posts daily report card
│   └── bot_sync.sh           # Listens for Telegram family commands (/done, /cry, etc.)
├── data/
│   ├── activities.json       # Activity pools (edit to customize!)
│   ├── tracker.json          # Daily progress & completion history
│   └── history.json          # 3-day repetition tracking
├── .github/workflows/
│   ├── daily-planner.yml     # 4 automated daily cron schedules + family sync
│   └── keepalive.yml         # Keeps GitHub Actions active forever
└── README.md
```

---

## ⏰ Daily Automated Schedule (IST)

| Time (IST) | Action | Details |
|---|---|---|
| **7:00 AM** | 🌞 Morning Routine | 3 morning habits + `[ 📊 Open Tracker ]` button |
| **12:32 PM** | ☀️ Afternoon Play | 3 creative/outdoor play tasks + `[ 📊 Open Tracker ]` button |
| **5:00 PM** | 🌙 Evening Wind-Down | 3 calming wind-down activities + `[ 📊 Open Tracker ]` button |
| **8:35 PM** | 🏆 Daily Report Card | Visual progress chart image + cry count & hydration recap |

---

## ❤️ Made with love for Kiyu
