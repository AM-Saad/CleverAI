#!/usr/bin/env node
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

// Load environment variables
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [key, value] = line.split('=');
    envVars[key.trim()] = value.trim();
  }
});

console.log('🧪 Testing CleverAI Email System\n');

// Test configuration
console.log('📧 Email Configuration:');
console.log(`  RESEND_API_KEY: ${envVars.RESEND_API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`  RESEND_TEST_EMAIL: ${envVars.RESEND_TEST_EMAIL || '❌ Missing'}\n`);

// Test Resend API directly
async function testResendAPI() {
  console.log('🔍 Testing Resend API directly...');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${envVars.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'CleverAI <onboarding@resend.dev>',
        to: [envVars.RESEND_TEST_EMAIL],
        subject: 'CleverAI Email Test - Direct API',
        html: `
          <h2>🧪 CleverAI Email System Test</h2>
          <p>This is a direct API test to verify email functionality.</p>
          <p><strong>Status:</strong> ✅ Email system is working correctly!</p>
          <p><em>Timestamp: ${new Date().toISOString()}</em></p>
        `
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Direct API test successful!');
      console.log(`  Email ID: ${result.id}`);
      console.log(`  Sent to: ${envVars.RESEND_TEST_EMAIL}\n`);
      return true;
    } else {
      console.log('❌ Direct API test failed:');
      console.log(`  Status: ${response.status}`);
      console.log(`  Error: ${JSON.stringify(result, null, 2)}\n`);
      return false;
    }
  } catch (error) {
    console.log('❌ Direct API test failed with error:');
    console.log(`  ${error.message}\n`);
    return false;
  }
}

// Test local API endpoints
async function testLocalAPI() {
  console.log('🔍 Testing local API endpoints...');

  const testCases = [
    {
      name: 'Verification Email',
      endpoint: 'http://127.0.0.1:5173/api/auth/verification',
      payload: { email: 'test@example.com' }
    },
    {
      name: 'Password Reset Email',
      endpoint: 'http://127.0.0.1:5173/api/auth/password/forgot',
      payload: { email: 'test@example.com' }
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`  Testing ${testCase.name}...`);

      const response = await fetch(testCase.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.payload)
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`    ✅ ${testCase.name} - Success`);
        console.log(`    Message: ${result.message || 'No message'}`);
      } else {
        console.log(`    ⚠️ ${testCase.name} - Status ${response.status}`);
        console.log(`    Error: ${result.error || result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`    ❌ ${testCase.name} - Network Error: ${error.message}`);
    }
  }
  console.log();
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting email system tests...\n');

  // Test 1: Direct API
  const directApiSuccess = await testResendAPI();

  // Test 2: Local API (only if we have proper setup)
  await testLocalAPI();

  // Summary
  console.log('📊 Test Summary:');
  console.log(`  Direct Resend API: ${directApiSuccess ? '✅ Working' : '❌ Issues detected'}`);
  console.log(`  Local API Endpoints: Check results above`);

  if (directApiSuccess) {
    console.log('\n🎉 Email system appears to be working correctly!');
    console.log('   The Resend API is accessible and emails can be sent.');
    console.log('   Any local API issues may be due to database or authentication requirements.');
  } else {
    console.log('\n⚠️ Email system has issues that need to be addressed.');
  }
}

runTests().catch(console.error);
