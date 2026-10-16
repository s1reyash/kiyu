#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧒 Kiyu's Daily Activity Planner
# Picks random age-appropriate activities and sends them
# to a family Telegram group chat.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
ACTIVITIES_FILE="$REPO_DIR/data/activities.json"
HISTORY_FILE="$REPO_DIR/data/history.json"

HISTORY_DAYS=3           # Avoid repeating activities within this many days
ACTIVITIES_PER_SLOT=3    # Number of activities per message
KID_NAME="Kiyu"

# Environment variables (set by GitHub Actions)
BOT_TOKEN="$(echo "${TELEGRAM_BOT_TOKEN:-}" | xargs)"
CHAT_ID="$(echo "${TELEGRAM_CHAT_ID:-}" | xargs)"
SLOT="${TIME_SLOT:-morning}"
DRY_RUN="${DRY_RUN:-false}"

# ─── Validate inputs ──────────────────────────────────────────
if [[ "$DRY_RUN" != "true" ]]; then
  MISSING_SECRETS=0
  if [[ -z "$BOT_TOKEN" ]]; then
    echo "❌ Error: TELEGRAM_BOT_TOKEN secret is not set or empty in GitHub Repository Secrets!"
    echo "👉 Fix: Go to GitHub Repo -> Settings -> Secrets and variables -> Actions"
    echo "        Add repository secret: TELEGRAM_BOT_TOKEN (your bot token from @BotFather)"
    MISSING_SECRETS=1
  fi
  if [[ -z "$CHAT_ID" ]]; then
    echo "❌ Error: TELEGRAM_CHAT_ID secret is not set or empty in GitHub Repository Secrets!"
    echo "👉 Fix: Go to GitHub Repo -> Settings -> Secrets and variables -> Actions"
    echo "        Add repository secret: TELEGRAM_CHAT_ID (your family group chat ID, e.g. -100xxxxxxxxxx)"
    MISSING_SECRETS=1
  fi
  if [[ "$MISSING_SECRETS" -eq 1 ]]; then
    echo "💡 Note: GitHub Secret names are case-sensitive. Make sure they are exact."
    exit 1
  fi
fi

if [[ ! -f "$ACTIVITIES_FILE" ]]; then
  echo "❌ Error: Activities file not found at $ACTIVITIES_FILE"
  exit 1
fi

if [[ ! -f "$HISTORY_FILE" ]]; then
  echo "⚠️  History file not found, creating empty one..."
  echo '{"last_updated":"","recent_activities":[]}' > "$HISTORY_FILE"
fi

# Validate slot
if [[ "$SLOT" != "morning" && "$SLOT" != "afternoon" && "$SLOT" != "evening" ]]; then
  echo "❌ Error: Invalid time slot '$SLOT'. Must be morning, afternoon, or evening."
  exit 1
fi

echo "🕐 Time slot: $SLOT"
echo "📂 Activities file: $ACTIVITIES_FILE"
echo "📜 History file: $HISTORY_FILE"

# ─── Determine day type (weekday/weekend) ─────────────────────
# Use IST timezone for day calculation
DAY_OF_WEEK=$(TZ="Asia/Kolkata" date +%u)  # 1=Monday, 7=Sunday
if [[ "$DAY_OF_WEEK" -ge 6 ]]; then
  DAY_TYPE="weekend"
  echo "📅 Day type: Weekend (day $DAY_OF_WEEK)"
else
  DAY_TYPE="weekday"
  echo "📅 Day type: Weekday (day $DAY_OF_WEEK)"
fi

# Get today's date in IST for the message
TODAY_DATE=$(TZ="Asia/Kolkata" date "+%A, %d %b %Y")

# ─── Load slot metadata ───────────────────────────────────────
SLOT_DATA=$(jq -r ".${DAY_TYPE}.${SLOT}" "$ACTIVITIES_FILE")

SLOT_EMOJI=$(echo "$SLOT_DATA" | jq -r '.emoji')
SLOT_GREETING=$(echo "$SLOT_DATA" | jq -r '.greeting')
SLOT_TITLE=$(echo "$SLOT_DATA" | jq -r '.title')
SLOT_SIGN_OFF=$(echo "$SLOT_DATA" | jq -r '.sign_off')

echo "📋 Slot: $SLOT_GREETING ($SLOT_TITLE)"

# ─── Get all activities for this slot ──────────────────────────
ALL_ACTIVITIES=$(echo "$SLOT_DATA" | jq -c '.activities[]')
TOTAL_ACTIVITIES=$(echo "$ALL_ACTIVITIES" | wc -l | tr -d ' ')
echo "🎯 Total activities in pool: $TOTAL_ACTIVITIES"

# ─── Load recent activity history ─────────────────────────────
# Calculate the cutoff timestamp (HISTORY_DAYS ago)
if [[ "$(uname)" == "Darwin" ]]; then
  # macOS
  CUTOFF_DATE=$(date -v-${HISTORY_DAYS}d +%Y-%m-%d)
else
  # Linux (GitHub Actions)
  CUTOFF_DATE=$(date -d "${HISTORY_DAYS} days ago" +%Y-%m-%d)
fi

# Get recently used activity names (within HISTORY_DAYS)
RECENT_NAMES=$(jq -r --arg cutoff "$CUTOFF_DATE" \
  '[.recent_activities[] | select(.date >= $cutoff) | .name] | unique | .[]' \
  "$HISTORY_FILE" 2>/dev/null || echo "")

if [[ -n "$RECENT_NAMES" ]]; then
  RECENT_COUNT=$(echo "$RECENT_NAMES" | wc -l | tr -d ' ')
  echo "🔄 Recently used activities (last $HISTORY_DAYS days): $RECENT_COUNT"
else
  RECENT_COUNT=0
  echo "🔄 No recent activity history found"
fi

# ─── Filter out recent activities ─────────────────────────────
# Build a jq filter to exclude recently used activities
if [[ -n "$RECENT_NAMES" ]]; then
  # Create a JSON array of recent names for jq
  RECENT_JSON=$(echo "$RECENT_NAMES" | jq -R -s 'split("\n") | map(select(length > 0))')

  ELIGIBLE_ACTIVITIES=$(echo "$SLOT_DATA" | jq -c --argjson recent "$RECENT_JSON" \
    '[.activities[] | select(.name as $n | $recent | index($n) | not)]')
else
  ELIGIBLE_ACTIVITIES=$(echo "$SLOT_DATA" | jq -c '.activities')
fi

ELIGIBLE_COUNT=$(echo "$ELIGIBLE_ACTIVITIES" | jq 'length')
echo "✅ Eligible activities (after filtering): $ELIGIBLE_COUNT"

# If we've filtered too many, fall back to full pool
if [[ "$ELIGIBLE_COUNT" -lt "$ACTIVITIES_PER_SLOT" ]]; then
  echo "⚠️  Not enough eligible activities, using full pool"
  ELIGIBLE_ACTIVITIES=$(echo "$SLOT_DATA" | jq -c '.activities')
  ELIGIBLE_COUNT=$(echo "$ELIGIBLE_ACTIVITIES" | jq 'length')
fi

# ─── Pick random activities ───────────────────────────────────
# Use bash RANDOM to pick unique indices from the eligible pool
USED_INDICES=""
SELECTED="["
PICKED=0

while [[ "$PICKED" -lt "$ACTIVITIES_PER_SLOT" ]]; do
  IDX=$((RANDOM % ELIGIBLE_COUNT))
  if [[ ! " $USED_INDICES " =~ " $IDX " ]]; then
    USED_INDICES="$USED_INDICES $IDX"
    if [[ "$PICKED" -gt 0 ]]; then
      SELECTED="${SELECTED},"
    fi
    ITEM=$(echo "$ELIGIBLE_ACTIVITIES" | jq -c ".[$IDX]")
    SELECTED="${SELECTED}${ITEM}"
    PICKED=$((PICKED + 1))
  fi
done
SELECTED="${SELECTED}]"

echo ""
echo "🎲 Selected activities:"
echo "$SELECTED" | jq -r '.[] | "   \(.emoji) \(.name)"'

# ─── Build the Telegram message ───────────────────────────────
# Build activity lines
ACTIVITY_LINES=""
for i in $(seq 0 $((ACTIVITIES_PER_SLOT - 1))); do
  ACTIVITY_EMOJI=$(echo "$SELECTED" | jq -r ".[$i].emoji")
  ACTIVITY_NAME=$(echo "$SELECTED" | jq -r ".[$i].name")
  NUM=$((i + 1))
  ACTIVITY_LINES="${ACTIVITY_LINES}${NUM}. ${ACTIVITY_EMOJI} ${ACTIVITY_NAME}"
  if [[ $i -lt $((ACTIVITIES_PER_SLOT - 1)) ]]; then
    ACTIVITY_LINES="${ACTIVITY_LINES}
"
  fi
done

# Compose the full message
MESSAGE="${SLOT_EMOJI} ${SLOT_GREETING}, ${KID_NAME}!

📋 ${SLOT_TITLE}:

${ACTIVITY_LINES}

${SLOT_SIGN_OFF}
📅 ${TODAY_DATE}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📨 Message preview:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$MESSAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Inline Keyboard Markup ──────────────────────────────────
DASHBOARD_URL="https://s1reyash.github.io/kiyu/docs/"
REPLY_MARKUP=$(jq -c -n --arg url "$DASHBOARD_URL" '{
  "inline_keyboard": [
    [
      { "text": "📊 Open Kiyu Tracker & Mark Done", "url": $url }
    ]
  ]
}')

# ─── Send to Telegram ─────────────────────────────────────────
if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "🏃 Dry run mode — message NOT sent to Telegram"
else
  echo ""
  echo "📤 Sending message to Telegram..."

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${CHAT_ID}" \
    --data-urlencode "text=${MESSAGE}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "reply_markup=${REPLY_MARKUP}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "✅ Message sent successfully!"
  else
    echo "⚠️ Warning: Failed to send formatted message (HTTP $HTTP_CODE)"
    echo "Telegram response: $BODY"
    
    # Check for common Telegram errors
    if echo "$BODY" | grep -qi "chat not found"; then
      echo "👉 Common cause: The chat ID is invalid, or the bot has NOT been added as a member to the group!"
      echo "👉 Fix: Add the bot to your family Telegram group, or check if the chat ID includes the minus sign '-'."
    elif echo "$BODY" | grep -qi "Unauthorized"; then
      echo "👉 Common cause: The TELEGRAM_BOT_TOKEN is expired, invalid, or revoked."
      echo "👉 Fix: Get a new token from @BotFather (/token) and update TELEGRAM_BOT_TOKEN in GitHub secrets."
    elif echo "$BODY" | grep -qi "bot was kicked"; then
      echo "👉 Common cause: The bot was removed from the group."
      echo "👉 Fix: Add the bot back to the group."
    fi

    # Try again without parse_mode in case of HTML tag formatting issues
    echo "🔄 Retrying with plain text fallback..."
    RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST \
      "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${CHAT_ID}" \
      --data-urlencode "text=${MESSAGE}" \
      --data-urlencode "reply_markup=${REPLY_MARKUP}")
    HTTP_CODE2=$(echo "$RESPONSE2" | tail -1)
    BODY2=$(echo "$RESPONSE2" | head -n -1)
    if [[ "$HTTP_CODE2" == "200" ]]; then
      echo "✅ Message sent successfully (plain text fallback)!"
    else
      echo "❌ Failed to send message (HTTP $HTTP_CODE2)"
      echo "Telegram response: $BODY2"
      exit 1
    fi
  fi
fi

# ─── Update activity history ──────────────────────────────────
echo ""
echo "📝 Updating activity history..."

TODAY_ISO=$(TZ="Asia/Kolkata" date +%Y-%m-%d)

# Build new history entries for today's selected activities
NEW_ENTRIES=$(echo "$SELECTED" | jq -c --arg date "$TODAY_ISO" --arg slot "$SLOT" \
  '[.[] | {name: .name, date: $date, slot: $slot}]')

# Merge with existing history and prune old entries
UPDATED_HISTORY=$(jq --argjson new_entries "$NEW_ENTRIES" \
  --arg cutoff "$CUTOFF_DATE" \
  --arg now "$TODAY_ISO" \
  '{
    last_updated: $now,
    recent_activities: ([.recent_activities[] | select(.date >= $cutoff)] + $new_entries)
  }' "$HISTORY_FILE")

echo "$UPDATED_HISTORY" | jq '.' > "$HISTORY_FILE"

HISTORY_SIZE=$(jq '.recent_activities | length' "$HISTORY_FILE")
echo "✅ History updated ($HISTORY_SIZE activities tracked)"

# ─── Update tracker data for dashboard ────────────────────────
echo ""
echo "📊 Updating tracker data for dashboard..."
TRACKER_FILE="$REPO_DIR/data/tracker.json"
DOCS_TRACKER_FILE="$REPO_DIR/docs/data/tracker.json"

if [[ ! -f "$TRACKER_FILE" ]]; then
  echo '{"last_updated":"","streak_days":1,"total_stars":0,"history":{}}' > "$TRACKER_FILE"
fi

# Format SELECTED into tracker items with completed: false and category
TRACKER_ITEMS=$(echo "$SELECTED" | jq -c --arg slot "$SLOT" --arg date "$TODAY_ISO" \
  '[to_entries[] | {
    id: ($date + "-" + $slot + "-" + (.key|tostring)),
    name: .value.name,
    emoji: (.value.emoji // "⭐"),
    category: (.value.category // "creative"),
    completed: false
  }]')

# Update tracker.json for this date and slot
UPDATED_TRACKER=$(jq --arg date "$TODAY_ISO" --arg slot "$SLOT" --argjson items "$TRACKER_ITEMS" \
  '.last_updated = $date |
   .history[$date] = (.history[$date] // {}) |
   .history[$date][$slot] = $items' "$TRACKER_FILE")

echo "$UPDATED_TRACKER" | jq '.' > "$TRACKER_FILE"
mkdir -p "$(dirname "$DOCS_TRACKER_FILE")"
cp "$TRACKER_FILE" "$DOCS_TRACKER_FILE"
echo "✅ Tracker data synchronized ($SLOT slot)"

echo ""
echo "🎉 All done! Have a great day, $KID_NAME! 💛"

