#!/usr/bin/env node

/**
 * Vytvoří test pending uživatele pro ověření funkcionalnosti
 * Usage: node create-test-user.js
 */

const admin = require('firebase-admin');

async function createTestUser() {
  try {
    // Initialize Firebase with service account
    if (admin.apps.length === 0) {
      const serviceAccount = require('/home/pi/programovani/ovladani-brany-v2/brana.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'brana-a71fe'  // Správný project ID pro tuto aplikaci
      });
    }
    
    const db = admin.firestore();
    
    // Test user data
    const testUserData = {
      email: `test-pending-${Date.now()}@example.com`,
      displayName: 'Test Pending User',
      photoURL: null,
      nick: 'test-pending',
      role: 'user',
      status: 'pending', // This is the key - pending status
      authProvider: 'google',
      permissions: {
        gate: false,
        garage: false,
        camera: false,
        stopMode: false,
        viewLogs: false,
        manageUsers: false,
        requireLocation: false,
        allowGPS: false,
        requireLocationProximity: false,
      },
      gpsEnabled: false,
      createdAt: admin.firestore.Timestamp.now(),
      lastLogin: admin.firestore.Timestamp.now(),
      requestedAt: admin.firestore.Timestamp.now(),
    };
    
    console.log('🆕 Creating test pending user...');
    console.log('📧 Email:', testUserData.email);
    console.log('👤 Display Name:', testUserData.displayName);
    console.log('🔄 Status:', testUserData.status);
    
    // Create user document
    const docRef = await db.collection('users').add(testUserData);
    
    console.log('✅ Test pending user created successfully!');
    console.log('🆔 User ID:', docRef.id);
    
    // Verify creation by checking pending users
    const pendingQuery = await db.collection('users')
      .where('status', '==', 'pending')
      .get();
    
    console.log(`📊 Total pending users in database: ${pendingQuery.size}`);
    
    pendingQuery.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`   - ${data.email} (${data.displayName}) - ID: ${doc.id}`);
    });
    
    console.log('\n🎯 Nyní zkontroluj UserApprovalPanel - měl by zobrazit tohoto uživatele!');
    console.log('🎯 A zkontroluj UserManagement - NEMĚL by ho zobrazit v hlavním seznamu!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestUser();