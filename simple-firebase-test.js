#!/usr/bin/env node

/**
 * Jednoduchý Firebase Test - rychlá diagnostika pending users problému
 */

const admin = require('firebase-admin');

console.log('🚀 Starting Firebase Diagnostics...\n');

async function runDiagnostics() {
  try {
    // Initialize Firebase Admin
    console.log('1️⃣ Initializing Firebase...');
    
    let app;
    if (admin.apps.length === 0) {
      app = admin.initializeApp({
        projectId: 'brana-a71fe'
      });
    } else {
      app = admin.app();
    }
    
    const db = admin.firestore();
    console.log('✅ Firebase initialized\n');

    // Test 1: Check connection
    console.log('2️⃣ Testing database connection...');
    const collections = await db.listCollections();
    console.log(`✅ Connection OK - Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`   - ${col.id}`));
    console.log();

    // Test 2: Count all users
    console.log('3️⃣ Counting users...');
    const allUsersSnapshot = await db.collection('users').get();
    console.log(`✅ Total users: ${allUsersSnapshot.size}`);
    console.log();

    // Test 3: Count pending users
    console.log('4️⃣ Counting PENDING users...');
    const pendingSnapshot = await db.collection('users')
      .where('status', '==', 'pending')
      .get();
    
    console.log(`📊 PENDING users: ${pendingSnapshot.size}`);
    
    if (pendingSnapshot.size > 0) {
      console.log('📋 Pending users details:');
      pendingSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.email} (${data.displayName}) - requested: ${data.requestedAt?.toDate() || 'unknown'}`);
      });
    } else {
      console.log('⚠️  NO PENDING USERS FOUND!');
    }
    console.log();

    // Test 4: Count approved users
    console.log('5️⃣ Counting APPROVED users...');
    const approvedSnapshot = await db.collection('users')
      .where('status', '==', 'approved')
      .get();
    console.log(`✅ Approved users: ${approvedSnapshot.size}`);
    console.log();

    // Test 5: Find admins
    console.log('6️⃣ Finding ADMIN users...');
    const adminSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .get();
    
    console.log(`👑 Admin users: ${adminSnapshot.size}`);
    adminSnapshot.forEach(doc => {
      const data = doc.data();
      const manageUsers = data.permissions?.manageUsers;
      console.log(`   - ${data.email} - manageUsers: ${manageUsers ? '✅' : '❌'} - status: ${data.status}`);
    });
    console.log();

    // Test 6: Create test pending user
    console.log('7️⃣ Creating test pending user...');
    const testUserId = `test-pending-${Date.now()}`;
    await db.collection('users').doc(testUserId).set({
      email: 'test-pending@example.com',
      displayName: 'Test Pending User',
      role: 'user',
      status: 'pending',
      requestedAt: admin.firestore.Timestamp.now(),
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
      }
    });
    console.log(`✅ Test user created with ID: ${testUserId}`);

    // Test 7: Verify test user appears in pending query
    console.log('8️⃣ Verifying test user appears in pending query...');
    const verifySnapshot = await db.collection('users')
      .where('status', '==', 'pending')
      .get();
    
    const testUserFound = verifySnapshot.docs.find(doc => doc.id === testUserId);
    if (testUserFound) {
      console.log('✅ Test user found in pending query!');
    } else {
      console.log('❌ Test user NOT found in pending query!');
    }
    console.log(`📊 Total pending users now: ${verifySnapshot.size}`);
    console.log();

    // Test 8: Clean up test user
    console.log('9️⃣ Cleaning up test user...');
    await db.collection('users').doc(testUserId).delete();
    console.log('✅ Test user deleted');
    console.log();

    // Summary
    console.log('📊 SUMMARY:');
    console.log('==========');
    console.log(`Total users: ${allUsersSnapshot.size}`);
    console.log(`Pending users: ${pendingSnapshot.size}`);
    console.log(`Approved users: ${approvedSnapshot.size}`);
    console.log(`Admin users: ${adminSnapshot.size}`);
    console.log();

    if (pendingSnapshot.size === 0) {
      console.log('🎯 ROOT CAUSE: NO PENDING USERS EXIST!');
      console.log('   - All users are already approved/rejected');
      console.log('   - New registrations might not be creating pending status');
      console.log('   - Check user registration flow');
    } else {
      console.log('🎯 POTENTIAL ISSUE: Pending users exist but app can\'t see them');
      console.log('   - Check Firebase Rules');
      console.log('   - Check admin permissions in app');
      console.log('   - Check AuthContext implementation');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

runDiagnostics();