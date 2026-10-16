# 🧒 Kiyu's Daily Activity Planner

> A cute, automated daily activity planner for Kiyu! Sends age-appropriate activity suggestions to a family Telegram group — 3 times a day, powered by GitHub Actions.

## ✨ Features

- 🌞 **3 daily messages**: Morning routine (7 AM), Afternoon play (12:30 PM), Evening wind-down (5 PM) IST
- 📅 **Weekday & weekend modes**: Different activity pools for school days vs weekends
- 🎲 **Smart randomization**: Picks 3 random activities per time slot
- 🔄 **No repetition**: Tracks history to avoid repeating activities for 3 days
- 🎨 **Fun & colorful**: Emoji-rich messages that make planning delightful
- 💰 **Zero cost**: Runs entirely on GitHub Actions free tier
- ⚙️ **Easy to customize**: Just edit `activities.json` — no code changes needed

## 📱 Sample Message

```
🌞 Good Morning, Kiyu!

📋 Morning Routine:

1. 🪥 Brush teeth & wash face
2. 🌱 Water the plants
3. 🎵 Sing a nursery rhyme

Have a wonderful day! 💛
📅 Friday, 16 Oct 2026
```

## 🚀 Setup Guide

### Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a name: e.g., `Kiyu Planner Bot`
4. Choose a username: e.g., `kiyu_planner_bot`
5. **Save the bot token** — you'll need it in Step 3

### Step 2: Get Your Group Chat ID

1. **Add your bot** to your family Telegram group
2. Send any message in the group
3. Open this URL in your browser (replace `<TOKEN>` with your bot token):
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. Look for `"chat":{"id":-XXXXXXXXXX}` — that negative number is your **Chat ID**

> 💡 **Tip**: If you don't see any updates, remove and re-add the bot to the group, then send another message.

### Step 3: Add GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

| Secret Name | Value |
|-------------|-------|
| `TELEGRAM_BOT_TOKEN` | The token from Step 1 (e.g., `123456:ABC-DEF...`) |
| `TELEGRAM_CHAT_ID` | The chat ID from Step 2 (e.g., `-1001234567890`) |

### Step 4: Push & Test

```bash
# Push the code to GitHub
git add .
git commit -m "🧒 Initial setup: Kiyu's Daily Planner"
git push

# Then go to GitHub → Actions tab → "Kiyu's Daily Planner"
# Click "Run workflow" → Choose a time slot → Run!
```

## 📁 Project Structure

```
├── .github/workflows/
│   └── daily-planner.yml     # GitHub Actions workflow (3 cron jobs)
├── scripts/
│   └── send_plan.sh          # Main script (bash + jq)
├── data/
│   ├── activities.json       # Activity pools (edit this to customize!)
│   └── history.json          # Auto-updated activity history
└── README.md
```

## ⚙️ Customization

### Adding / Removing Activities

Edit `data/activities.json`. Each activity has a `name` and `emoji`:

```json
{ "name": "Painting with watercolors", "emoji": "🎨" }
```

Activities are organized by:
- **Day type**: `weekday` or `weekend`
- **Time slot**: `morning`, `afternoon`, or `evening`

### Changing the Schedule

Edit the cron expressions in `.github/workflows/daily-planner.yml`:

| IST Time | UTC Cron |
|----------|----------|
| 7:00 AM | `30 1 * * *` |
| 12:30 PM | `0 7 * * *` |
| 5:00 PM | `30 11 * * *` |

> 🧮 **IST to UTC**: Subtract 5 hours 30 minutes from IST to get UTC.

### Changing Number of Activities

Edit `ACTIVITIES_PER_SLOT` in `scripts/send_plan.sh` (default: 3).

### Changing History Window

Edit `HISTORY_DAYS` in `scripts/send_plan.sh` (default: 3 days).

## 🧪 Testing Locally

```bash
# Dry run (prints message without sending)
export TELEGRAM_BOT_TOKEN="test"
export TELEGRAM_CHAT_ID="test"
export TIME_SLOT="morning"
export DRY_RUN="true"
bash scripts/send_plan.sh

# Actual send (requires real bot token and chat ID)
export TELEGRAM_BOT_TOKEN="your-real-token"
export TELEGRAM_CHAT_ID="your-real-chat-id"
export TIME_SLOT="afternoon"
export DRY_RUN="false"
bash scripts/send_plan.sh
```

## 📋 Schedule

| Time (IST) | Message | Content |
|------------|---------|---------|
| 7:00 AM | 🌞 Morning Routine | Getting ready, light activities before school |
| 12:30 PM | ☀️ Afternoon Play | Active play, learning activities after school |
| 5:00 PM | 🌙 Evening Wind-Down | Calm activities, storytime, bedtime prep |

## ❤️ Made with love for Kiyu
