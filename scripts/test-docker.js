const Docker = require('dockerode');

const docker = new Docker();

async function testDockerSetup() {
  console.log('Testing Docker container spawning...');
  
  try {
    // Test Docker connection
    const version = await docker.version();
    console.log('✅ Docker connection successful');
    console.log('Docker version:', version.Version);
    
    // Check if required images exist
    console.log('\n🔍 Checking for required images...');
    const requiredImages = ['xss_lab', 'csrf_lab'];
    
    for (const imageName of requiredImages) {
      try {
        await docker.getImage(imageName).inspect();
        console.log(`✅ Image '${imageName}' found`);
      } catch (error) {
        console.error(`❌ Image '${imageName}' not found. Please build it first.`);
        console.log(`   Build command: docker build -t ${imageName} <path-to-dockerfile>`);
        return;
      }
    }

    // Test creating and starting XSS container
    console.log('\n🚀 Testing XSS container creation...');
    const xssContainer = await docker.createContainer({
      Image: 'xss_lab',
      name: `test-xss-${Date.now()}`,
      ExposedPorts: {
        '80/tcp': {}
      },
      HostConfig: {
        PortBindings: {
          '80/tcp': [{ HostPort: '3001' }]
        },
        AutoRemove: true
      }
    });

    await xssContainer.start();
    console.log('✅ XSS test container started successfully');
    console.log('Container ID:', xssContainer.id);
    console.log('Access URL: http://localhost:3001');

    // Wait a bit then stop the XSS container
    console.log('\n⏳ Waiting 3 seconds before stopping XSS container...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await xssContainer.stop();
    console.log('✅ XSS test container stopped and removed');

    // Test creating and starting CSRF container
    console.log('\n🚀 Testing CSRF container creation...');
    const csrfContainer = await docker.createContainer({
      Image: 'csrf_lab',
      name: `test-csrf-${Date.now()}`,
      ExposedPorts: {
        '80/tcp': {}
      },
      HostConfig: {
        PortBindings: {
          '80/tcp': [{ HostPort: '3002' }]
        },
        AutoRemove: true
      }
    });

    await csrfContainer.start();
    console.log('✅ CSRF test container started successfully');
    console.log('Container ID:', csrfContainer.id);
    console.log('Access URL: http://localhost:3002');

    // Wait a bit then stop the CSRF container
    console.log('\n⏳ Waiting 3 seconds before stopping CSRF container...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await csrfContainer.stop();
    console.log('✅ CSRF test container stopped and removed');

    console.log('\n🎉 All Docker container tests passed successfully!');
    console.log('\nYour static Docker images are ready for the lab challenges.');

  } catch (error) {
    console.error('❌ Docker test failed:', error);
    process.exit(1);
  }
}

testDockerSetup();
