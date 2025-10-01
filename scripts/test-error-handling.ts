// Test script to verify centralized error handling works correctly
import FetchFactory, { APIError } from '../app/services/FetchFactory'
import type { $Fetch } from 'ofetch'

// Mock $fetch that simulates your server error response
const mockFetch = async (url: string, _options: unknown) => {
  console.log('🧪 Mock fetch called:', url)

  // Simulate the server error response you provided
  return {
    success: false,
    error: {
      code: "BAD_REQUEST",
      message: "Invalid query parameters",
      statusCode: 400,
      details: [
        {
          origin: "string",
          code: "invalid_format",
          format: "uuid",
          pattern: "/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/",
          path: ["folderId"],
          message: "Folder ID must be a valid UUID"
        }
      ]
    }
  }
}

async function testErrorHandling() {
  const ff = new FetchFactory(mockFetch as $Fetch, '/api')

  try {
    await ff.call('GET', '/materials?folderId=invalid-uuid')
  } catch (error) {
    console.log('✅ Caught error:', error)
    if (error instanceof APIError) {
      console.log('📋 Error details:')
      console.log('  - Message:', error.message)
      console.log('  - Code:', error.code)
      console.log('  - Status:', error.status)
      console.log('  - Name:', error.name)
    } else {
      console.log('❌ Error is not APIError instance:', typeof error)
    }
  }
}

// Run the test
testErrorHandling().then(() => {
  console.log('🏁 Test completed')
}).catch(console.error)
