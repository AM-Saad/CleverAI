#!/bin/bash

# Fix active hours to allow notifications anytime
echo "Disabling active hours restriction..."

curl -X PUT "http://localhost:5173/api/notifications/preferences" \
  -H "Content-Type: application/json" \
  -d '{
    "cardDueEnabled": true,
    "cardDueTime": "09:00",
    "cardDueThreshold": 5,
    "dailyReminderEnabled": false,
    "dailyReminderTime": "19:00",
    "timezone": "Africa/Cairo",
    "quietHoursEnabled": false,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "sendAnytimeOutsideQuietHours": true,
    "activeHoursEnabled": false,
    "activeHoursStart": "09:00",
    "activeHoursEnd": "23:59"
  }'

echo ""
echo "Now testing cron notification..."

# Trigger cron check
curl -X GET "http://localhost:5173/api/notifications/debug-cron"

echo ""
echo "Done! Check if you received a notification."
