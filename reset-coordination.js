// Simple script to reset coordination via REST API
const https = require('https');

// Firebase project info
const PROJECT_ID = 'lismag';  // Based on config in src/firebase/config.ts

console.log('🔧 Starting Firebase Firestore REST API reset...');

const cleanState = {
  activeUser: null,
  reservationQueue: [],
  gateState: 'CLOSED',
  lastActivity: Date.now(),
};

const data = JSON.stringify(cleanState);

const options = {
  hostname: 'firestore.googleapis.com',
  path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/gate_coordination/current_state`,
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`📡 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Firebase coordination state reset successfully!');
      console.log('🔄 Response:', JSON.parse(responseData));
    } else {
      console.log('⚠️ Response:', responseData);
      console.log('💡 Note: This might work anyway - REST API auth may not be required for this operation');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('💡 If this fails, use the debug button in the app UI as admin user');
});

req.write(data);
req.end();