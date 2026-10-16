#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🏆 Kiyu's Daily Progress & Report Card Generator
# Computes daily completion, generates visual chart image,
# and sends progress report to the family Telegram group.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
TRACKER_FILE="$REPO_DIR/data/tracker.json"
HISTORY_FILE="$REPO_DIR/data/history.json"
DASHBOARD_URL="https://s1reyash.github.io/kiyu/"
KID_NAME="Kiyu"

# Environment variables
BOT_TOKEN="$(echo "${TELEGRAM_BOT_TOKEN:-}" | xargs)"
CHAT_ID="$(echo "${TELEGRAM_CHAT_ID:-}" | xargs)"
DRY_RUN="${DRY_RUN:-false}"

# ─── Validation ───────────────────────────────────────────────
if [[ "$DRY_RUN" != "true" ]]; then
  if [[ -z "$BOT_TOKEN" || -z "$CHAT_ID" ]]; then
    echo "❌ Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing"
    exit 1
  fi
fi

if [[ ! -f "$TRACKER_FILE" ]]; then
  echo "⚠️ Tracker file not found at $TRACKER_FILE, creating default..."
  echo '{"last_updated":"","streak_days":1,"total_stars":0,"history":{}}' > "$TRACKER_FILE"
fi

# ─── Today's Date in IST ──────────────────────────────────────
TODAY_ISO=$(TZ="Asia/Kolkata" date +%Y-%m-%d)
TODAY_DISPLAY=$(TZ="Asia/Kolkata" date "+%A, %d %b %Y")

echo "📅 Generating daily summary for $TODAY_DISPLAY ($TODAY_ISO)..."

# ─── Extract Today's Activities ────────────────────────────────
TODAY_DATA=$(jq -r --arg date "$TODAY_ISO" '.history[$date] // {}' "$TRACKER_FILE")

MORNING_ITEMS=$(echo "$TODAY_DATA" | jq -c '.morning // []')
AFTERNOON_ITEMS=$(echo "$TODAY_DATA" | jq -c '.afternoon // []')
EVENING_ITEMS=$(echo "$TODAY_DATA" | jq -c '.evening // []')

TOTAL_MORNING=$(echo "$MORNING_ITEMS" | jq 'length')
TOTAL_AFTERNOON=$(echo "$AFTERNOON_ITEMS" | jq 'length')
TOTAL_EVENING=$(echo "$EVENING_ITEMS" | jq 'length')

TOTAL_ITEMS=$((TOTAL_MORNING + TOTAL_AFTERNOON + TOTAL_EVENING))

# If no tracker activities logged yet today, fetch from history.json or default to 9
if [[ "$TOTAL_ITEMS" -eq 0 ]]; then
  echo "ℹ️ No tracker items found for today, checking history..."
  HIST_TODAY=$(jq -r --arg date "$TODAY_ISO" '[.recent_activities[] | select(.date == $date)]' "$HISTORY_FILE" 2>/dev/null || echo "[]")
  HIST_COUNT=$(echo "$HIST_TODAY" | jq 'length')
  if [[ "$HIST_COUNT" -gt 0 ]]; then
    TOTAL_ITEMS=$HIST_COUNT
  else
    TOTAL_ITEMS=9
  fi
fi

COMPLETED_MORNING=$(echo "$MORNING_ITEMS" | jq '[.[] | select(.completed == true)] | length')
COMPLETED_AFTERNOON=$(echo "$AFTERNOON_ITEMS" | jq '[.[] | select(.completed == true)] | length')
COMPLETED_EVENING=$(echo "$EVENING_ITEMS" | jq '[.[] | select(.completed == true)] | length')

TOTAL_COMPLETED=$((COMPLETED_MORNING + COMPLETED_AFTERNOON + COMPLETED_EVENING))

# Fallback assumption if not checked via dashboard yet: show activities with checklist markers
if [[ "$TOTAL_ITEMS" -gt 0 ]]; then
  PERCENT=$(( (TOTAL_COMPLETED * 100) / TOTAL_ITEMS ))
else
  PERCENT=0
fi

# ─── Build Unicode Progress Bar ───────────────────────────────
FILLED_BLOCKS=$(( (PERCENT + 5) / 10 ))
if [[ "$FILLED_BLOCKS" -gt 10 ]]; then FILLED_BLOCKS=10; fi
EMPTY_BLOCKS=$(( 10 - FILLED_BLOCKS ))

PROGRESS_BAR=""
for ((i=0; i<FILLED_BLOCKS; i++)); do PROGRESS_BAR="${PROGRESS_BAR}█"; done
for ((i=0; i<EMPTY_BLOCKS; i++)); do PROGRESS_BAR="${PROGRESS_BAR}░"; done

# ─── Format Slot Activity Lines ───────────────────────────────
format_slot_lines() {
  local items="$1"
  local slot_name="$2"
  local count=$(echo "$items" | jq 'length')
  if [[ "$count" -eq 0 ]]; then
    echo "  <i>No activities scheduled</i>"
    return
  fi
  for i in $(seq 0 $((count - 1))); do
    local name=$(echo "$items" | jq -r ".[$i].name")
    local emoji=$(echo "$items" | jq -r ".[$i].emoji // \"⭐\"")
    local done=$(echo "$items" | jq -r ".[$i].completed")
    if [[ "$done" == "true" ]]; then
      echo "  ✅ ${emoji} ${name}"
    else
      echo "  ⬜ ${emoji} ${name}"
    fi
  done
}

MORNING_TEXT=$(format_slot_lines "$MORNING_ITEMS" "morning")
AFTERNOON_TEXT=$(format_slot_lines "$AFTERNOON_ITEMS" "afternoon")
EVENING_TEXT=$(format_slot_lines "$EVENING_ITEMS" "evening")

# ─── Read Streak & Stars ──────────────────────────────────────
STREAK=$(jq -r '.streak_days // 1' "$TRACKER_FILE")
STARS=$(jq -r '.total_stars // 0' "$TRACKER_FILE")

# ─── Compose Telegram Caption / Message ───────────────────────
MESSAGE="🏆 <b>${KID_NAME}'s Daily Activity Report Card</b>
📅 <b>${TODAY_DISPLAY}</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 <b>Progress:</b> [<code>${PROGRESS_BAR}</code>] <b>${PERCENT}%</b> (${TOTAL_COMPLETED}/${TOTAL_ITEMS} done)
⭐ <b>Stars Collected:</b> ${STARS} ⭐
🔥 <b>Daily Streak:</b> ${STREAK} Days!

🌞 <b>Morning Routine:</b>
${MORNING_TEXT}

☀️ <b>Afternoon Play:</b>
${AFTERNOON_TEXT}

🌙 <b>Evening Wind-Down:</b>
${EVENING_TEXT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 <i>Wonderful effort today, ${KID_NAME}! Sweet dreams tonight! 💫</i>"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📨 Report Card Preview:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$MESSAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── QuickChart Visual Image Generation ───────────────────────
# Chart with green for completed and light gray for remaining
REMAINING=$((TOTAL_ITEMS - TOTAL_COMPLETED))
if [[ "$REMAINING" -lt 0 ]]; then REMAINING=0; fi

CHART_CONFIG=$(cat <<EOF
{
  "type": "doughnut",
  "data": {
    "labels": ["Completed", "Remaining"],
    "datasets": [{
      "data": [${TOTAL_COMPLETED}, ${REMAINING}],
      "backgroundColor": ["#1DD1A1", "#E2E8F0"],
      "borderWidth": 0
    }]
  },
  "options": {
    "plugins": {
      "legend": { "display": false },
      "doughnutlabel": {
        "labels": [
          { "text": "${PERCENT}%", "font": { "size": 38, "weight": "bold", "family": "sans-serif" }, "color": "#2D3436" },
          { "text": "${TOTAL_COMPLETED}/${TOTAL_ITEMS} Done", "font": { "size": 18, "weight": "600", "family": "sans-serif" }, "color": "#636E72" }
        ]
      }
    }
  }
}
EOF
)

ENCODED_CHART_CONFIG=$(echo "$CHART_CONFIG" | tr -d '\n' | jq -s -R -r @uri)
CHART_URL="https://quickchart.io/chart?w=500&h=320&bkg=%23ffffff&c=${ENCODED_CHART_CONFIG}"

REPLY_MARKUP=$(jq -c -n --arg url "$DASHBOARD_URL" '{
  "inline_keyboard": [
    [
      { "text": "📊 Open Full Progress & Charts", "url": $url }
    ]
  ]
}')

# ─── Send to Telegram ─────────────────────────────────────────
if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "🏃 Dry run mode — report card NOT sent to Telegram"
else
  echo ""
  echo "📤 Sending visual report card to Telegram..."

  # First try sending as photo with QuickChart
  PHOTO_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto" \
    --data-urlencode "chat_id=${CHAT_ID}" \
    --data-urlencode "photo=${CHART_URL}" \
    --data-urlencode "caption=${MESSAGE}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "reply_markup=${REPLY_MARKUP}")

  PHOTO_HTTP_CODE=$(echo "$PHOTO_RESPONSE" | tail -1)
  PHOTO_BODY=$(echo "$PHOTO_RESPONSE" | head -n -1)

  if [[ "$PHOTO_HTTP_CODE" == "200" ]]; then
    echo "✅ Visual report card photo sent successfully!"
  else
    echo "⚠️ Warning: sendPhoto failed (HTTP $PHOTO_HTTP_CODE): $PHOTO_BODY"
    echo "🔄 Falling back to standard text message..."

    MSG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
      "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${CHAT_ID}" \
      --data-urlencode "text=${MESSAGE}" \
      --data-urlencode "parse_mode=HTML" \
      --data-urlencode "reply_markup=${REPLY_MARKUP}")

    MSG_HTTP_CODE=$(echo "$MSG_RESPONSE" | tail -1)
    if [[ "$MSG_HTTP_CODE" == "200" ]]; then
      echo "✅ Text report card sent successfully!"
    else
      echo "❌ Failed to send text report card (HTTP $MSG_HTTP_CODE)"
      exit 1
    fi
  fi
fi

echo ""
echo "🎉 Daily report card complete!"
