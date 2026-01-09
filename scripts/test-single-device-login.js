#!/usr/bin/env node

/**
 * Test Single-Device Login
 * 
 * Simulates two login sessions and verifies session invalidation
 * Run with: node scripts/test-single-device-login.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function test() {
  console.log('========================================');
  console.log('  Single-Device Login Test');
  console.log('========================================\n');
  
  console.log(`Testing against: ${BASE_URL}\n`);
  console.log('Prerequisites:');
  console.log('  1. Server must be running (npm run dev)');
  console.log('  2. Test user must exist (test_user1)\n');
  console.log('─'.repeat(50));
  
  try {
    // Test 1: First login
    console.log('\n📝 Test 1: First device login...');
    const session1 = await login('test_user1', 'TestPass123!');
    if (!session1.success) {
      throw new Error('First login failed: ' + session1.error);
    }
    console.log('✅ Device 1 logged in successfully');
    console.log(`   Cookie: ${session1.cookie.substring(0, 50)}...`);
    
    // Test 2: Verify first session works
    console.log('\n📝 Test 2: Verify Device 1 can access dashboard...');
    const access1 = await accessDashboard(session1.cookie);
    if (!access1.success) {
      throw new Error('Device 1 cannot access dashboard: ' + access1.error);
    }
    console.log('✅ Device 1 dashboard access: OK');
    
    // Test 3: Second login (same user, different "device")
    console.log('\n📝 Test 3: Second device login (same user)...');
    const session2 = await login('test_user1', 'TestPass123!');
    if (!session2.success) {
      throw new Error('Second login failed: ' + session2.error);
    }
    console.log('✅ Device 2 logged in successfully');
    console.log(`   Cookie: ${session2.cookie.substring(0, 50)}...`);
    
    // Test 4: Verify first session is now invalid
    console.log('\n📝 Test 4: Verify Device 1 session is invalidated...');
    const access1Again = await accessDashboard(session1.cookie);
    if (access1Again.success) {
      throw new Error('❌ FAIL: Device 1 should be logged out but still has access!');
    }
    console.log('✅ Device 1 correctly invalidated (redirected to login)');
    
    // Test 5: Verify second session still works
    console.log('\n📝 Test 5: Verify Device 2 session is still valid...');
    const access2 = await accessDashboard(session2.cookie);
    if (!access2.success) {
      throw new Error('Device 2 should have access but got: ' + access2.error);
    }
    console.log('✅ Device 2 dashboard access: OK');
    
    console.log('\n' + '─'.repeat(50));
    console.log('✅ ALL TESTS PASSED!');
    console.log('─'.repeat(50));
    console.log('\n✨ Single-device login enforcement is working correctly!');
    console.log('   When a user logs in from Device 2, Device 1 is automatically logged out.\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.log('\nTroubleshooting:');
    console.log('  • Is the dev server running? (npm run dev)');
    console.log('  • Does test_user1 exist? (check test-users-credentials.txt)');
    console.log('  • Check server logs for errors\n');
    process.exit(1);
  }
}

async function login(userId, password) {
  try {
    const response = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, password }),
      redirect: 'manual'
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.message || response.statusText };
    }
    
    const cookie = response.headers.get('set-cookie');
    if (!cookie) {
      return { success: false, error: 'No cookie received' };
    }
    
    return { success: true, cookie };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function accessDashboard(cookie) {
  try {
    const response = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: cookie },
      redirect: 'manual'
    });
    
    // If redirected to login, session is invalid
    if (response.status === 307 || response.status === 302) {
      const location = response.headers.get('location');
      if (location && location.includes('/login')) {
        return { success: false, error: 'Redirected to login' };
      }
    }
    
    // 200 means we got the dashboard
    if (response.status === 200) {
      return { success: true };
    }
    
    return { success: false, error: `Unexpected status: ${response.status}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  test();
}

module.exports = { test, login, accessDashboard };
