/**
 * Test script to validate timing functionality
 */

import {
  getUserLocalTime,
  getUserLocalTimeString,
  isWithinTimeWindow,
  isInQuietHours,
  isValidTimezone
} from '../server/utils/timezone'

// Test timezone validation
console.log('🌍 Testing Timezone Validation:')
console.log('UTC:', isValidTimezone('UTC'))
console.log('America/New_York:', isValidTimezone('America/New_York'))
console.log('Invalid/Timezone:', isValidTimezone('Invalid/Timezone'))

// Test time functions
console.log('\n⏰ Testing Time Functions:')
const testTimezone = 'America/New_York'
console.log(`Current time in ${testTimezone}:`, getUserLocalTimeString(testTimezone))
console.log(`Current time object in ${testTimezone}:`, getUserLocalTime(testTimezone))

// Test time window checking
console.log('\n🎯 Testing Time Window Checking:')
const currentTime = getUserLocalTimeString(testTimezone)
console.log(`Current time: ${currentTime}`)
console.log(`Within 15min of 09:00:`, isWithinTimeWindow(testTimezone, '09:00', 15))
console.log(`Within 15min of ${currentTime}:`, isWithinTimeWindow(testTimezone, currentTime, 15))

// Test quiet hours
console.log('\n🤫 Testing Quiet Hours:')
console.log('In quiet hours (22:00-08:00):', isInQuietHours(testTimezone, '22:00', '08:00'))
console.log('In quiet hours (02:00-04:00):', isInQuietHours(testTimezone, '02:00', '04:00'))

console.log('\n✅ All timing tests completed!')
