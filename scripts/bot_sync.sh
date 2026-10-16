#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🤖 Kiyu Family Telegram Sync Listener
# Listens for family commands in the Telegram group:
#   /done 1, /done 2, /cry <reason>, /calm, /water, /milk, /progress
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
TRACKER_FILE="$REPO_DIR/data/tracker.json"
DOCS_TRACKER_FILE="$REPO_DIR/docs/data/tracker.json"
OFFSET_FILE="$REPO_DIR/data/.telegram_offset"

BOT_TOKEN="$(echo "${TELEGRAM_BOT_TOKEN:-}" | xargs)"
CHAT_ID="$(echo "${TELEGRAM_CHAT_ID:-}" | xargs)"

if [[ -z "$BOT_TOKEN" || -z "$CHAT_ID" ]]; then
  echo "❌ Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing"
  exit 1
fi

TODAY_ISO=$(TZ="Asia/Kolkata" date +%Y-%m-%d)
CURRENT_TIME=$(TZ="Asia/Kolkata" date "+%I:%M %p")

OFFSET=0
if [[ -f "$OFFSET_FILE" ]]; then
  OFFSET=$(cat "$OFFSET_FILE")
fi

echo "🔍 Checking Telegram group updates (offset: $OFFSET)..."

UPDATES=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${OFFSET}&limit=20")
OK=$(echo "$UPDATES" | jq -r '.ok // false')

if [[ "$OK" != "true" ]]; then
  echo "⚠️ Failed to get updates from Telegram"
  exit 1
fi

COUNT=$(echo "$UPDATES" | jq '.result | length')
echo "📬 Retrieved $COUNT updates"

if [[ "$COUNT" -eq 0 ]]; then
  echo "No new family messages."
  exit 0
fi

# Function to send reply to Telegram
send_reply() {
  local text="$1"
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${CHAT_ID}" \
    --data-urlencode "text=${text}" \
    --data-urlencode "parse_mode=HTML" > /dev/null || true
}

CHANGES_MADE=0

# Process each message
for i in $(seq 0 $((COUNT - 1))); do
  UPDATE_ID=$(echo "$UPDATES" | jq -r ".result[$i].update_id")
  OFFSET=$((UPDATE_ID + 1))
  
  MSG_TEXT=$(echo "$UPDATES" | jq -r ".result[$i].message.text // empty")
  FROM_NAME=$(echo "$UPDATES" | jq -r ".result[$i].message.from.first_name // \"Family\"")
  
  if [[ -z "$MSG_TEXT" ]]; then
    continue
  fi

  echo "💬 Message from $FROM_NAME: $MSG_TEXT"

  # Normalize command (lowercase)
  CMD=$(echo "$MSG_TEXT" | awk '{print tolower($1)}')

  # 1. /done command (e.g. /done 1, /done 2, /done all)
  if [[ "$CMD" =~ ^/done ]]; then
    ARG=$(echo "$MSG_TEXT" | awk '{print $2}')
    if [[ -z "$ARG" ]]; then ARG="1"; fi

    # Determine current slot based on IST hour
    HOUR=$(TZ="Asia/Kolkata" date +%-H)
    if [ "$HOUR" -lt 12 ]; then
      ACTIVE_SLOT="morning"
    elif [ "$HOUR" -lt 17 ]; then
      ACTIVE_SLOT="afternoon"
    else
      ACTIVE_SLOT="evening"
    fi

    if [[ "$ARG" =~ ^[0-9]+$ ]]; then
      IDX=$((ARG - 1))
      ITEM_NAME=$(jq -r --arg date "$TODAY_ISO" --arg slot "$ACTIVE_SLOT" --argjson idx "$IDX" \
        '.history[$date][$slot][$idx].name // empty' "$TRACKER_FILE")

      if [[ -n "$ITEM_NAME" ]]; then
        # Mark completed and add star
        UPDATED=$(jq --arg date "$TODAY_ISO" --arg slot "$ACTIVE_SLOT" --argjson idx "$IDX" \
          '.history[$date][$slot][$idx].completed = true | .total_stars += 1' "$TRACKER_FILE")
        echo "$UPDATED" > "$TRACKER_FILE"
        cp "$TRACKER_FILE" "$DOCS_TRACKER_FILE"
        CHANGES_MADE=1

        TOTAL_STARS=$(jq -r '.total_stars' "$TRACKER_FILE")
        send_reply "✅ <b>${FROM_NAME}</b> marked <b>${ITEM_NAME}</b> as completed! 🎉 (+1 ⭐)\n⭐ <b>Kiyu now has ${TOTAL_STARS} stars!</b>"
        echo "✅ Marked $ITEM_NAME completed"
      else
        send_reply "⚠️ Activity #${ARG} not found in today's ${ACTIVE_SLOT} slot. Check /progress"
      fi
    fi

  # 2. /cry command (e.g. /cry or /cry sleepy)
  elif [[ "$CMD" =~ ^/cry ]]; then
    REASON=$(echo "$MSG_TEXT" | cut -d' ' -f2-)
    if [[ "$REASON" == "/cry" || -z "$REASON" ]]; then
      REASON="Upset / Meltdown"
    fi

    # Append cry to today's history
    NEW_CRY=$(jq -c -n --arg time "$CURRENT_TIME" --arg reason "$REASON" --arg by "$FROM_NAME" \
      '{id: ("cry_" + (now|tostring)), time: $time, reason: $reason, logged_by: $by}')

    UPDATED=$(jq --arg date "$TODAY_ISO" --argjson cry "$NEW_CRY" \
      '.history[$date].cries = ((.history[$date].cries // []) + [$cry])' "$TRACKER_FILE")
    echo "$UPDATED" > "$TRACKER_FILE"
    cp "$TRACKER_FILE" "$DOCS_TRACKER_FILE"
    CHANGES_MADE=1

    CRY_COUNT=$(jq -r --arg date "$TODAY_ISO" '(.history[$date].cries // []) | length' "$TRACKER_FILE")
    send_reply "😭 <b>${FROM_NAME}</b> logged a cry moment: <i>\"${REASON}\"</i>\nToday's cry count: <b>${CRY_COUNT}</b>. Sending big cuddles to Kiyu! 🤗"
    echo "😭 Logged cry: $REASON"

  # 3. /calm or /nocry command
  elif [[ "$CMD" =~ ^/(calm|nocry) ]]; then
    UPDATED=$(jq '.total_stars += 1' "$TRACKER_FILE")
    echo "$UPDATED" > "$TRACKER_FILE"
    cp "$TRACKER_FILE" "$DOCS_TRACKER_FILE"
    CHANGES_MADE=1

    TOTAL_STARS=$(jq -r '.total_stars' "$TRACKER_FILE")
    send_reply "😇 <b>${FROM_NAME}</b> logged a peaceful, calm & tear-free hour! 🌟 (+1 ⭐)\n⭐ <b>Total Stars: ${TOTAL_STARS}</b>"
    echo "😇 Logged calm hour"

  # 4. /water command
  elif [[ "$CMD" =~ ^/water ]]; then
    UPDATED=$(jq --arg date "$TODAY_ISO" \
      '.history[$date].water_glasses = ((.history[$date].water_glasses // 0) + 1)' "$TRACKER_FILE")
    echo "$UPDATED" > "$TRACKER_FILE"
    cp "$TRACKER_FILE" "$DOCS_TRACKER_FILE"
    CHANGES_MADE=1

    WATER_CNT=$(jq -r --arg date "$TODAY_ISO" '.history[$date].water_glasses' "$TRACKER_FILE")
    send_reply "💧 <b>${FROM_NAME}</b> logged 1 glass of water! 🥤 (Total today: <b>${WATER_CNT}/5</b> glasses)"

  # 5. /milk command
  elif [[ "$CMD" =~ ^/milk ]]; then
    UPDATED=$(jq --arg date "$TODAY_ISO" \
      '.history[$date].milk_glasses = ((.history[$date].milk_glasses // 0) + 1) | .total_stars += 1' "$TRACKER_FILE")
    echo "$UPDATED" > "$TRACKER_FILE"
    cp "$TRACKER_FILE" "$DOCS_TRACKER_FILE"
    CHANGES_MADE=1

    MILK_CNT=$(jq -r --arg date "$TODAY_ISO" '.history[$date].milk_glasses' "$TRACKER_FILE")
    send_reply "🥛 <b>${FROM_NAME}</b> logged 1 glass of milk! 🥣 (+1 ⭐) (Total today: <b>${MILK_CNT}/2</b> glasses)"

  # 6. /progress command
  elif [[ "$CMD" =~ ^/progress ]]; then
    echo "📊 Running daily summary in response to /progress"
    bash "$SCRIPT_DIR/send_daily_summary.sh"
  fi
done

# Save updated offset
echo "$OFFSET" > "$OFFSET_FILE"

if [[ "$CHANGES_MADE" -eq 1 ]]; then
  echo "✅ Changes synced to tracker.json"
fi
