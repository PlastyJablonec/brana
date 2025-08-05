#!/usr/bin/env node

/**
 * Vytvoří test pending uživatele pro ověření funkcionality admin interface
 */

const admin = require('firebase-admin');

console.log('🧪 Creating test pending user...\n');

async function createTestUser() {
  try {
    // Initialize Firebase
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: 'brana-a71fe'
      });
    }
    
    const db = admin.firestore();
    
    // Create test pending user
    const testUserId = `test-pending-${Date.now()}`;
    const testUserData = {
      email: 'test.pending@example.com',
      displayName: 'Test Pending User',
      nick: 'testuser',
      role: 'user',
      status: 'pending', // KLÍČOVÉ!
      authProvider: 'email',
      permissions: {
        gate: false,
        garage: false,
        camera: false,
        stopMode: false,
        viewLogs: false,
        manageUsers: false,
        requireLocation: false,
        allowGPS: false,
        requireLocationProximity: false
      },
      gpsEnabled: false,
      createdAt: admin.firestore.Timestamp.now(),
      lastLogin: admin.firestore.Timestamp.now(),
      requestedAt: admin.firestore.Timestamp.now()
    };
    
    await db.collection('users').doc(testUserId).set(testUserData);
    
    console.log('✅ Test pending user created successfully!');
    console.log(`📧 Email: ${testUserData.email}`);
    console.log(`👤 Name: ${testUserData.displayName}`);
    console.log(`🔄 Status: ${testUserData.status}`);
    console.log(`🆔 Document ID: ${testUserId}`);
    
    // Verify it was created
    console.log('\n🔍 Verifying user was created...');
    
    const pendingQuery = await db.collection('users')
      .where('status', '==', 'pending')
      .get();
    
    console.log(`📊 Total pending users now: ${pendingQuery.size}`);
    
    if (pendingQuery.size > 0) {
      console.log('\n📋 All pending users:');
      pendingQuery.forEach(doc => {
        const data = doc.data();
        console.log(`   • ${data.email} (${data.displayName})`);
      });
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Otevři aplikaci jako admin');
    console.log('2. Jdi na User Management');
    console.log('3. Měl by se zobrazit test pending uživatel');
    console.log('4. Zkus ho schválit nebo zamítnout');
    console.log('\n⚠️  Po testování smaž test uživatele pomocí:');
    console.log(`   node delete-test-user.js ${testUserId}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestUser();