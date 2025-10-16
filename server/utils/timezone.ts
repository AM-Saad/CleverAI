/**
 * Timezone utility functions for handling user-specific time conversions
 * and ensuring accurate notification timing across different timezones
 */

/**
 * Get current time in user's timezone
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
 * @returns Date object adjusted to user's timezone
 */
export function getUserLocalTime(timezone: string): Date {
  try {
    const now = new Date()
    // Create a new date using the timezone string
    const userTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }))
    return userTime
  } catch (error) {
    console.error(`Invalid timezone: ${timezone}`, error)
    // Fallback to UTC if timezone is invalid
    return new Date()
  }
}

/**
 * Get current time formatted as HH:MM in user's timezone
 * @param timezone - IANA timezone identifier
 * @returns Time string in HH:MM format (24-hour)
 */
export function getUserLocalTimeString(timezone: string): string {
  try {
    const now = new Date()
    return now.toLocaleString("en-US", {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/:/g, ':')
  } catch (error) {
    console.error(`Error formatting time for timezone: ${timezone}`, error)
    // Fallback to UTC time
    return new Date().toTimeString().slice(0, 5)
  }
}

/**
 * Check if current time in user's timezone is within a specific time window
 * @param timezone - User's timezone
 * @param targetTime - Target time in HH:MM format (e.g., "09:00")
 * @param windowMinutes - Time window in minutes (default: 15)
 * @returns true if current time is within the window of target time
 */
export function isWithinTimeWindow(
  timezone: string,
  targetTime: string,
  windowMinutes: number = 15
): boolean {
  try {
    const now = getUserLocalTime(timezone)
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes()

    const [targetHour, targetMinute] = targetTime.split(':').map(Number)
    const targetTimeMinutes = targetHour * 60 + targetMinute

    // Check if current time is within the window
    const timeDiff = Math.abs(currentTimeMinutes - targetTimeMinutes)
    return timeDiff <= windowMinutes
  } catch (error) {
    console.error(`Error checking time window for timezone: ${timezone}`, error)
    return false
  }
}

/**
 * Check if current time is within quiet hours (handles midnight crossing)
 * @param timezone - User's timezone
 * @param quietHoursStart - Start time in HH:MM format (e.g., "22:00")
 * @param quietHoursEnd - End time in HH:MM format (e.g., "08:00")
 * @returns true if current time is within quiet hours
 */
export function isInQuietHours(
  timezone: string,
  quietHoursStart: string,
  quietHoursEnd: string
): boolean {
  try {
    const currentTime = getUserLocalTimeString(timezone)

    if (quietHoursStart <= quietHoursEnd) {
      // Same day range: 09:00 to 17:00
      return currentTime >= quietHoursStart && currentTime <= quietHoursEnd
    } else {
      // Cross midnight range: 22:00 to 08:00
      return currentTime >= quietHoursStart || currentTime <= quietHoursEnd
    }
  } catch (error) {
    console.error(`Error checking quiet hours for timezone: ${timezone}`, error)
    return false
  }
}

/**
 * Check if current time is within an allowed hours range (handles midnight crossing)
 * @param timezone - User's timezone
 * @param start - Start time in HH:MM (inclusive)
 * @param end - End time in HH:MM (inclusive)
 */
export function isWithinHoursRange(
  timezone: string,
  start: string,
  end: string
): boolean {
  try {
    const currentTime = getUserLocalTimeString(timezone)
    if (start <= end) {
      return currentTime >= start && currentTime <= end
    } else {
      // Cross-midnight window
      return currentTime >= start || currentTime <= end
    }
  } catch (error) {
    console.error(`Error checking hours range for timezone: ${timezone}`, error)
    return true // be permissive on error
  }
}

/**
 * Convert a time string to a specific timezone
 * @param time - Time in HH:MM format
 * @param fromTimezone - Source timezone
 * @param toTimezone - Target timezone
 * @returns Converted time string in HH:MM format
 */
export function convertTimeToTimezone(
  time: string,
  _fromTimezone: string,
  toTimezone: string
): string {
  try {
    const today = new Date().toISOString().split('T')[0] // Get today's date

    // Create a date in the source timezone
    const sourceDate = new Date(`${today}T${time}:00`)

    // Convert to target timezone
    const targetTime = sourceDate.toLocaleString("en-US", {
      timeZone: toTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    return targetTime
  } catch (error) {
    console.error(`Error converting time from ${_fromTimezone} to ${toTimezone}`, error)
    return time // Return original time if conversion fails
  }
}

/**
 * Get timezone offset in hours from UTC
 * @param timezone - IANA timezone identifier
 * @returns Offset in hours (can be fractional)
 */
export function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date()
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
    const localTime = new Date(utcTime + (getTimezoneOffsetMinutes(timezone) * 60000))
    return (localTime.getTime() - utcTime) / (1000 * 60 * 60)
  } catch (error) {
    console.error(`Error getting timezone offset for: ${timezone}`, error)
    return 0
  }
}

/**
 * Get timezone offset in minutes from UTC
 * @param timezone - IANA timezone identifier
 * @returns Offset in minutes
 */
function getTimezoneOffsetMinutes(timezone: string): number {
  try {
    const now = new Date()
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
    const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    return (local.getTime() - utc.getTime()) / (1000 * 60)
  } catch (_error) {
    console.error(`Error getting timezone offset minutes for: ${timezone}`, _error)
    return 0
  }
}

/**
 * Validate if a timezone string is valid
 * @param timezone - Timezone string to validate
 * @returns true if timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    // Test if we can format a date with this timezone
    new Date().toLocaleString('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/**
 * Get a human-readable description of when the next notification window will occur
 * @param timezone - User's timezone
 * @param targetTime - Target time in HH:MM format
 * @param _windowMinutes - Time window in minutes (unused but kept for API consistency)
 * @returns Human-readable description
 */
export function getNextNotificationWindow(
  timezone: string,
  targetTime: string,
  _windowMinutes: number = 15
): string {
  try {
    const now = getUserLocalTime(timezone)
    const [targetHour, targetMinute] = targetTime.split(':').map(Number)

    // Create target time for today
    const targetToday = new Date(now)
    targetToday.setHours(targetHour, targetMinute, 0, 0)

    // If target time has passed today, use tomorrow
    const targetDate = now > targetToday
      ? new Date(targetToday.getTime() + 24 * 60 * 60 * 1000)
      : targetToday

    const timeDiff = targetDate.getTime() - now.getTime()
    const hours = Math.floor(timeDiff / (1000 * 60 * 60))
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours < 1) {
      return `in ${minutes} minutes`
    } else if (hours < 24) {
      return `in ${hours} hours and ${minutes} minutes`
    } else {
      return `tomorrow at ${targetTime}`
    }
  } catch (error) {
    console.error(`Error calculating next notification window`, error)
    return 'soon'
  }
}
