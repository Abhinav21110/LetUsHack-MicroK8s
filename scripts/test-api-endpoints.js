// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'ig';
const TEST_PASSWORD = '12345678';

// Login and get session cookie
async function loginUser() {
  console.log(`Logging in user: ${TEST_USER_ID}`);
  
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: TEST_USER_ID,
      password: TEST_PASSWORD
    }),
    redirect: 'manual' // Don't follow redirects automatically
  });

  if (loginResponse.status === 303 || loginResponse.status === 302) {
    // Login successful, extract cookies
    const cookies = loginResponse.headers.get('set-cookie');
    if (cookies) {
      console.log('✅ Login successful');
      return cookies;
    }
  }
  
  throw new Error(`Login failed with status: ${loginResponse.status}`);
}

async function testDockerEndpoints() {
  console.log('🧪 Testing Docker API endpoints...\n');
  
  // Login and get session cookies
  const cookies = await loginUser();

  try {
    // Test 1: Check Docker health
    console.log('\n1️⃣ Testing Docker health endpoint...');
    const healthRes = await fetch(`${BASE_URL}/api/labs/health`);
    const healthData = await healthRes.json();
    console.log('Health check result:', healthData);

    if (!healthData.data.dockerAvailable) {
      console.log('⚠️  Docker is not available. Please start Docker Desktop and try again.');
      return;
    }

    // Test 2: Check container status (should be empty initially)
    console.log('\n2️⃣ Testing container status endpoint...');
    const statusRes = await fetch(`${BASE_URL}/api/labs/status`, {
      headers: {
        'Cookie': cookies
      }
    });
    const statusData = await statusRes.json();
    console.log('Initial container status:', statusData);

    // Test 3: Start XSS challenge
    console.log('\n3️⃣ Testing XSS challenge start...');
    const xssStartRes = await fetch(`${BASE_URL}/api/labs/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({ labType: 'xss' })
    });
    const xssStartData = await xssStartRes.json();
    console.log('XSS start result:', xssStartData);

    if (xssStartData.success) {
      console.log(`✅ XSS container started successfully!`);
      console.log(`   Container ID: ${xssStartData.data.containerId}`);
      console.log(`   Access URL: ${xssStartData.data.url}`);

      // Wait a bit
      console.log('\n⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test 4: Check status again (should show active container)
      console.log('\n4️⃣ Checking container status after start...');
      const statusRes2 = await fetch(`${BASE_URL}/api/labs/status`, {
        headers: {
          'Cookie': cookies
        }
      });
      const statusData2 = await statusRes2.json();
      console.log('Container status after start:', statusData2);

      // Test 5: Try to start CSRF (should stop XSS first due to single container rule)
      console.log('\n5️⃣ Testing CSRF challenge start (should enforce single container rule)...');
      const csrfStartRes = await fetch(`${BASE_URL}/api/labs/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({ labType: 'csrf' })
      });
      const csrfStartData = await csrfStartRes.json();
      console.log('CSRF start result:', csrfStartData);

      if (csrfStartData.success) {
        console.log(`✅ CSRF container started successfully!`);
        console.log(`   Container ID: ${csrfStartData.data.containerId}`);
        console.log(`   Access URL: ${csrfStartData.data.url}`);

        // Wait a bit
        console.log('\n⏳ Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test 6: Stop the challenge
        console.log('\n6️⃣ Testing challenge stop...');
        const stopRes = await fetch(`${BASE_URL}/api/labs/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
          },
          body: JSON.stringify({ containerId: csrfStartData.data.containerId })
        });
        const stopData = await stopRes.json();
        console.log('Stop result:', stopData);

        if (stopData.success) {
          console.log('✅ Container stopped successfully!');
        }
      }
    }

    // Final status check
    console.log('\n7️⃣ Final container status check...');
    const finalStatusRes = await fetch(`${BASE_URL}/api/labs/status`, {
      headers: {
        'Cookie': cookies
      }
    });
    const finalStatusData = await finalStatusRes.json();
    console.log('Final container status:', finalStatusData);

    console.log('\n🎉 All API endpoint tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure your Next.js development server is running:');
      console.log('   npm run dev');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  testDockerEndpoints();
}

module.exports = { testDockerEndpoints };
