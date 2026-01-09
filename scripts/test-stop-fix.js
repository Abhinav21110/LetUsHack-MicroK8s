// Quick test to verify the stop container fix
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

async function testStopFix() {
  try {
    const cookies = await loginUser();

    // 1. Check initial status
    console.log('\n1️⃣ Checking initial container status...');
    let statusRes = await fetch(`${BASE_URL}/api/labs/status`, {
      headers: { 'Cookie': cookies }
    });
    let statusData = await statusRes.json();
    console.log('Initial status:', statusData.data.activeContainers.length, 'containers');

    // 2. Start a container
    console.log('\n2️⃣ Starting XSS container...');
    const startRes = await fetch(`${BASE_URL}/api/labs/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({ labType: 'xss' })
    });
    const startData = await startRes.json();
    
    if (startData.success) {
      console.log('✅ Container started:', startData.data.containerId);
      
      // 3. Check status after start
      console.log('\n3️⃣ Checking status after start...');
      statusRes = await fetch(`${BASE_URL}/api/labs/status`, {
        headers: { 'Cookie': cookies }
      });
      statusData = await statusRes.json();
      console.log('After start:', statusData.data.activeContainers.length, 'containers');
      
      // 4. Stop the container
      console.log('\n4️⃣ Stopping container...');
      const stopRes = await fetch(`${BASE_URL}/api/labs/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({ containerId: startData.data.containerId })
      });
      const stopData = await stopRes.json();
      console.log('Stop result:', stopData.success ? '✅ Success' : '❌ Failed');
      
      // 5. Check status after stop
      console.log('\n5️⃣ Checking status after stop...');
      statusRes = await fetch(`${BASE_URL}/api/labs/status`, {
        headers: { 'Cookie': cookies }
      });
      statusData = await statusRes.json();
      console.log('After stop:', statusData.data.activeContainers.length, 'containers');
      
      if (statusData.data.activeContainers.length === 0) {
        console.log('🎉 SUCCESS: Stop fix is working correctly!');
      } else {
        console.log('❌ ISSUE: Container still showing as active after stop');
        console.log('Active containers:', statusData.data.activeContainers);
      }
      
    } else {
      console.log('❌ Failed to start container:', startData.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testStopFix();
