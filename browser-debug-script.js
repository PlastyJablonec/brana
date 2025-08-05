/**
 * Browser Debug Script
 * Kopíruj a vlož do konzole prohlížeče (F12 > Console)
 * v aplikaci gate-control (localhost:3000)
 */

console.log('🚀 Starting Browser Firebase Debug...');
console.log('=====================================');

// Ověř že Firebase je dostupný
if (typeof firebase === 'undefined') {
  console.error('❌ Firebase není dostupný v tomto contextu');
} else {
  console.log('✅ Firebase je dostupný');
}

// Debug funkce pro testování pending users
async function debugPendingUsers() {
  try {
    console.log('\n1️⃣ Testing Firebase connection...');
    
    // Ověř auth
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.error('❌ No user logged in');
      return;
    }
    console.log(`✅ Logged in as: ${currentUser.email}`);
    
    // Test Firestore connection
    const db = firebase.firestore();
    console.log('✅ Firestore connection established');
    
    console.log('\n2️⃣ Testing basic read permissions...');
    
    // Test 1: Can read users collection?
    try {
      const testQuery = await db.collection('users').limit(1).get();
      console.log(`✅ Can read users collection (${testQuery.size} docs)`);
    } catch (readError) {
      console.error('❌ Cannot read users collection:', readError.message);
      return;
    }
    
    console.log('\n3️⃣ Counting all users by status...');
    
    // Count all users
    const allUsers = await db.collection('users').get();
    console.log(`📊 Total users: ${allUsers.size}`);
    
    // Group by status
    const statusCounts = {};
    allUsers.forEach(doc => {
      const status = doc.data().status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('📊 Users by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    console.log('\n4️⃣ Testing pending users query...');
    
    // Test pending users query
    try {
      const pendingQuery = await db.collection('users')
        .where('status', '==', 'pending')
        .get();
      
      console.log(`📊 Pending users found: ${pendingQuery.size}`);
      
      if (pendingQuery.size > 0) {
        console.log('📋 Pending users details:');
        pendingQuery.forEach(doc => {
          const data = doc.data();
          console.log(`   • ${data.email} (${data.displayName})`);
          console.log(`     Requested: ${data.requestedAt?.toDate() || 'unknown'}`);
          console.log(`     Provider: ${data.authProvider || 'unknown'}`);
        });
      } else {
        console.log('⚠️  NO PENDING USERS FOUND!');
        
        // Check if there are any users with undefined status
        const undefinedStatusUsers = allUsers.docs.filter(doc => {
          const status = doc.data().status;
          return !status || status === null || status === undefined;
        });
        
        if (undefinedStatusUsers.length > 0) {
          console.log(`🔍 Found ${undefinedStatusUsers.length} users with undefined status:`);
          undefinedStatusUsers.forEach(doc => {
            const data = doc.data();
            console.log(`   • ${data.email} - status: ${data.status}`);
          });
        }
      }
    } catch (pendingError) {
      console.error('❌ Error querying pending users:', pendingError.message);
    }
    
    console.log('\n5️⃣ Testing current user admin status...');
    
    // Find current user in database
    const currentUserQuery = await db.collection('users')
      .where('email', '==', currentUser.email)
      .get();
    
    if (currentUserQuery.empty) {
      console.error('❌ Current user not found in database');
    } else {
      const userDoc = currentUserQuery.docs[0];
      const userData = userDoc.data();
      
      console.log('👤 Current user data:');
      console.log(`   Email: ${userData.email}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Status: ${userData.status}`);
      console.log(`   ManageUsers: ${userData.permissions?.manageUsers ? '✅' : '❌'}`);
      
      // Check admin qualification
      const isAdmin = userData.role === 'admin' && 
                     userData.status === 'approved' && 
                     userData.permissions?.manageUsers === true;
      
      console.log(`   Is Admin: ${isAdmin ? '✅' : '❌'}`);
    }
    
    console.log('\n6️⃣ Testing create/delete permissions...');
    
    // Test create permission
    const testDocRef = db.collection('users').doc(`test-${Date.now()}`);
    try {
      await testDocRef.set({
        test: true,
        createdAt: firebase.firestore.Timestamp.now()
      });
      console.log('✅ Can CREATE documents');
      
      // Test delete permission
      try {
        await testDocRef.delete();
        console.log('✅ Can DELETE documents');
      } catch (deleteError) {
        console.error('❌ Cannot DELETE documents:', deleteError.message);
      }
      
    } catch (createError) {
      console.error('❌ Cannot CREATE documents:', createError.message);
    }
    
    console.log('\n📊 DIAGNOSIS COMPLETE');
    console.log('====================');
    
    if (statusCounts.pending === 0 || !statusCounts.pending) {
      console.log('🎯 ROOT CAUSE: NO PENDING USERS EXIST');
      console.log('   Solutions:');
      console.log('   1. Create a test user with status="pending"');
      console.log('   2. Check user registration flow');
      console.log('   3. Verify new users get "pending" status');
    } else {
      console.log('🎯 PENDING USERS EXIST BUT APP CAN\'T SEE THEM');
      console.log('   Check:');
      console.log('   1. AuthContext getPendingUsers implementation');
      console.log('   2. UserApprovalPanel component');
      console.log('   3. Admin permissions verification');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Test UserApprovalPanel specifically
async function testUserApprovalPanel() {
  console.log('\n🔍 Testing UserApprovalPanel...');
  
  // Check if UserApprovalPanel is rendered
  const approvalPanel = document.querySelector('[data-testid="user-approval-panel"]') ||
                       document.querySelector('.md-card:has(h2:contains("Čekající uživatelé"))');
  
  if (approvalPanel) {
    console.log('✅ UserApprovalPanel found in DOM');
  } else {
    console.log('❌ UserApprovalPanel not found in DOM');
    console.log('   Check if you\'re on User Management page');
    console.log('   Check if current user has admin role');
  }
  
  // Try to trigger debug button if it exists
  const debugButton = document.querySelector('button:contains("🔧 Debug Firebase")');
  if (debugButton) {
    console.log('✅ Debug Firebase button found');
    console.log('   You can click it manually to run diagnostics');
  } else {
    console.log('❌ Debug Firebase button not found');
  }
}

// Export functions to global scope
window.debugPendingUsers = debugPendingUsers;
window.testUserApprovalPanel = testUserApprovalPanel;

// Instructions
console.log('\n📖 USAGE:');
console.log('========');
console.log('1. Make sure you\'re logged in as admin');
console.log('2. Run: debugPendingUsers()');
console.log('3. Run: testUserApprovalPanel()');
console.log('4. Check results above');
console.log('\n⚡ Quick start: debugPendingUsers()');