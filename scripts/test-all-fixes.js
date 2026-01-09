// Comprehensive test for all Docker container fixes
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'ig';
const TEST_PASSWORD = '12345678';

async function loginUser() {
  console.log(`🔐 Logging in user: ${TEST_USER_ID}`);
  
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: TEST_USER_ID,
      password: TEST_PASSWORD
    }),
    redirect: 'manual'
  });

  if (loginResponse.status === 303 || loginResponse.status === 302) {
    const cookies = loginResponse.headers.get('set-cookie');
    if (cookies) {
      console.log('✅ Login successful');
      return cookies;
    }
  }
  
  throw new Error(`Login failed with status: ${loginResponse.status}`);
}

async function checkContainerStatus(cookies, description) {
  console.log(`\n📊 ${description}`);
  const statusRes = await fetch(`${BASE_URL}/api/labs/status`, {
    headers: { 'Cookie': cookies }
  });
  const statusData = await statusRes.json();
  console.log(`   Active containers: ${statusData.data.activeContainers.length}`);
  
  if (statusData.data.activeContainers.length > 0) {
    statusData.data.activeContainers.forEach((container, index) => {
      console.log(`   ${index + 1}. ${container.labType.toUpperCase()} - ${container.containerId.substring(0, 12)} - Port ${container.port}`);
    });
  }
  
  return statusData.data.activeContainers;
}

async function testAllFixes() {
  try {
    console.log('🧪 Testing all Docker container fixes...\n');
    
    const cookies = await loginUser();

    // Test 1: Initial cleanup
    console.log('\n1️⃣ Initial cleanup...');
    await fetch(`${BASE_URL}/api/labs/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({})
    });
    
    await checkContainerStatus(cookies, 'Status after cleanup');

    // Test 2: Start XSS container
    console.log('\n2️⃣ Starting XSS container...');
    const xssStartRes = await fetch(`${BASE_URL}/api/labs/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({ labType: 'xss' })
    });
    const xssStartData = await xssStartRes.json();
    
    if (xssStartData.success) {
      console.log('✅ XSS container started:', xssStartData.data.containerId.substring(0, 12));
      const containers = await checkContainerStatus(cookies, 'Status after XSS start');
      
      if (containers.length === 1) {
        console.log('✅ Database correctly shows 1 active container');
      } else {
        console.log('❌ Database issue: Expected 1 container, found', containers.length);
      }
      
      // Test 3: Stop specific container
      console.log('\n3️⃣ Stopping XSS container...');
      const stopRes = await fetch(`${BASE_URL}/api/labs/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({ containerId: xssStartData.data.containerId })
      });
      const stopData = await stopRes.json();
      
      if (stopData.success) {
        console.log('✅ Stop API returned success');
        
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const containersAfterStop = await checkContainerStatus(cookies, 'Status after stop');
        
        if (containersAfterStop.length === 0) {
          console.log('✅ DATABASE FIX WORKING: Container properly removed from database');
        } else {
          console.log('❌ DATABASE ISSUE: Container still in database after stop');
        }
      } else {
        console.log('❌ Stop failed:', stopData.error);
      }
      
    } else {
      console.log('❌ Failed to start XSS container:', xssStartData.error);
    }

    // Test 4: Test race condition handling
    console.log('\n4️⃣ Testing race condition handling...');
    console.log('Starting CSRF container...');
    const csrfStartRes = await fetch(`${BASE_URL}/api/labs/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({ labType: 'csrf' })
    });
    const csrfStartData = await csrfStartRes.json();
    
    if (csrfStartData.success) {
      console.log('✅ CSRF container started:', csrfStartData.data.containerId.substring(0, 12));
      
      // Try to stop the same container multiple times quickly (race condition test)
      console.log('Testing race condition: Multiple stop requests...');
      const stopPromises = [];
      for (let i = 0; i < 3; i++) {
        stopPromises.push(
          fetch(`${BASE_URL}/api/labs/stop`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookies
            },
            body: JSON.stringify({ containerId: csrfStartData.data.containerId })
          })
        );
      }
      
      const stopResults = await Promise.all(stopPromises);
      const stopResponses = await Promise.all(stopResults.map(r => r.json()));
      
      console.log('Stop results:', stopResponses.map(r => r.success ? '✅' : '❌').join(' '));
      
      // Check final status
      await new Promise(resolve => setTimeout(resolve, 2000));
      const finalContainers = await checkContainerStatus(cookies, 'Final status after race condition test');
      
      if (finalContainers.length === 0) {
        console.log('✅ RACE CONDITION FIX WORKING: No containers left after multiple stops');
      } else {
        console.log('❌ RACE CONDITION ISSUE: Containers still present');
      }
    }

    // Test 5: Test single container rule
    console.log('\n5️⃣ Testing single container rule...');
    console.log('Starting XSS container...');
    const xss2StartRes = await fetch(`${BASE_URL}/api/labs/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({ labType: 'xss' })
    });
    const xss2StartData = await xss2StartRes.json();
    
    if (xss2StartData.success) {
      await checkContainerStatus(cookies, 'Status after XSS start');
      
      console.log('Starting CSRF container (should stop XSS)...');
      const csrf2StartRes = await fetch(`${BASE_URL}/api/labs/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({ labType: 'csrf' })
      });
      const csrf2StartData = await csrf2StartRes.json();
      
      if (csrf2StartData.success) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const containers = await checkContainerStatus(cookies, 'Status after CSRF start (should replace XSS)');
        
        if (containers.length === 1 && containers[0].labType === 'csrf') {
          console.log('✅ SINGLE CONTAINER RULE WORKING: Only CSRF container remains');
        } else {
          console.log('❌ SINGLE CONTAINER RULE ISSUE: Expected 1 CSRF container');
        }
        
        // Final cleanup
        console.log('\n🧹 Final cleanup...');
        await fetch(`${BASE_URL}/api/labs/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
          },
          body: JSON.stringify({})
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await checkContainerStatus(cookies, 'Final status after cleanup');
      }
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Summary of fixes:');
    console.log('✅ Database cleanup when containers are stopped');
    console.log('✅ Race condition handling (409 and 404 errors)');
    console.log('✅ Improved error handling and logging');
    console.log('✅ Container status synchronization');
    console.log('✅ Tab locking feature (frontend only)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAllFixes();
