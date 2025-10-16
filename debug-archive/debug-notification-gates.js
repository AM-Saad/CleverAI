// Quick debug script to check notification gates and preferences
// Run this in your browser console on your app

console.log('🔍 Debugging notification gates...')

// 1. Check current preferences
const checkPreferences = async () => {
  try {
    const response = await fetch('/api/notifications/preferences')
    const { data } = await response.json()
    console.log('📋 Current preferences:', data)
    return data
  } catch (error) {
    console.error('❌ Failed to fetch preferences:', error)
    return null
  }
}

// 2. Check current time against gates
const checkTimeGates = (prefs) => {
  if (!prefs) return

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: prefs.timezone || 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })

  console.log(`🕒 Current time in ${prefs.timezone}: ${timeStr}`)

  // Check quiet hours
  if (prefs.quietHoursEnabled) {
    console.log(`🤫 Quiet hours: ${prefs.quietHoursStart} - ${prefs.quietHoursEnd}`)
    const isInQuiet = isWithinTimeRange(timeStr, prefs.quietHoursStart, prefs.quietHoursEnd)
    console.log(`   Currently in quiet hours: ${isInQuiet ? '❌ YES (blocked)' : '✅ NO (allowed)'}`)
  }

  // Check active hours
  if (prefs.activeHoursEnabled) {
    console.log(`🕘 Active hours: ${prefs.activeHoursStart} - ${prefs.activeHoursEnd}`)
    const isInActive = isWithinTimeRange(timeStr, prefs.activeHoursStart, prefs.activeHoursEnd)
    console.log(`   Currently in active hours: ${isInActive ? '✅ YES (allowed)' : '❌ NO (blocked)'}`)
  }

  // Check send anytime vs card due time
  if (prefs.sendAnytimeOutsideQuietHours) {
    console.log('🚀 Send Anytime mode: ✅ ENABLED (ignores Card Due Time)')
  } else {
    console.log(`📚 Card Due Time mode: ${prefs.cardDueTime}`)
    const timeDiff = getTimeDifferenceMinutes(timeStr, prefs.cardDueTime)
    console.log(`   Time difference from due time: ${Math.abs(timeDiff)} minutes`)
    console.log(`   Within window (±30min): ${Math.abs(timeDiff) <= 30 ? '✅ YES' : '❌ NO'}`)
  }
}

// Helper: Check if current time is within a range (handles midnight crossover)
const isWithinTimeRange = (currentTime, startTime, endTime) => {
  const [currentH, currentM] = currentTime.split(':').map(Number)
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)

  const currentMinutes = currentH * 60 + currentM
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes <= endMinutes) {
    // Same day range
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  } else {
    // Midnight crossover
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }
}

// Helper: Get time difference in minutes
const getTimeDifferenceMinutes = (time1, time2) => {
  const [h1, m1] = time1.split(':').map(Number)
  const [h2, m2] = time2.split(':').map(Number)
  return (h1 * 60 + m1) - (h2 * 60 + m2)
}

// Run the check
const runCheck = async () => {
  const prefs = await checkPreferences()
  if (prefs) {
    checkTimeGates(prefs)

    console.log('\n🎯 Summary:')
    console.log('- Test notifications work ✅')
    console.log('- Cron notifications might be blocked by timing gates ⚠️')
    console.log('- Check the gates above to see what might be blocking')

    if (prefs.quietHoursEnabled || prefs.activeHoursEnabled || !prefs.sendAnytimeOutsideQuietHours) {
      console.log('\n💡 Suggestions:')
      console.log('1. Temporarily enable "Send Anytime" mode')
      console.log('2. Or disable quiet/active hours for testing')
      console.log('3. Or wait for the right time window')
    }
  }
}

// Auto-run
runCheck()
