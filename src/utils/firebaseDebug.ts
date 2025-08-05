import { auth, db } from '../firebase/config';

/**
 * Firebase Debug Utils - pro diagnostiku permission problémů
 */
export class FirebaseDebug {
  
  /**
   * Získá detailní informace o aktuálním uživateli
   */
  static async getCurrentUserDetails(): Promise<any> {
    try {
      console.log('🔍 FirebaseDebug: Getting current user details...');
      
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return { error: 'No Firebase user logged in' };
      }
      
      console.log('📋 Firebase Auth User:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified,
        displayName: firebaseUser.displayName,
        providerId: firebaseUser.providerId
      });
      
      // Získej auth token
      const token = await firebaseUser.getIdToken(true);
      console.log('🔑 Auth Token:', token ? 'EXISTS' : 'MISSING');
      
      // Najdi user document v Firestore
      const userQuery = await db.collection('users')
        .where('email', '==', firebaseUser.email)
        .get();
      
      if (userQuery.empty) {
        return {
          firebaseUser: {
            uid: firebaseUser.uid,
            email: firebaseUser.email
          },
          firestoreUser: null,
          error: 'User document not found in Firestore'
        };
      }
      
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      
      const result = {
        firebaseUser: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified
        },
        firestoreUser: {
          docId: userDoc.id,
          email: userData.email,
          role: userData.role,
          status: userData.status,
          permissions: userData.permissions
        },
        authToken: token ? 'EXISTS' : 'MISSING'
      };
      
      console.log('📊 Complete User Details:', result);
      return result;
      
    } catch (error: any) {
      console.error('❌ FirebaseDebug: Error getting user details:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Testuje základní Firestore operace
   */
  static async testFirestoreOperations(): Promise<any> {
    try {
      console.log('🧪 FirebaseDebug: Testing Firestore operations...');
      
      const results: any = {
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        errors: []
      };
      
      const testDocId = `test-${Date.now()}`;
      const testDocRef = db.collection('users').doc(testDocId);
      
      // Test 1: Can read?
      try {
        await db.collection('users').limit(1).get();
        results.canRead = true;
        console.log('✅ Can READ users collection');
      } catch (error: any) {
        results.errors.push(`READ failed: ${error.message}`);
        console.log('❌ Cannot READ users collection:', error.message);
      }
      
      // Test 2: Can create?
      try {
        await testDocRef.set({
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'user',
          status: 'pending',
          createdAt: new Date()
        });
        results.canCreate = true;
        console.log('✅ Can CREATE documents');
      } catch (error: any) {
        results.errors.push(`CREATE failed: ${error.message}`);
        console.log('❌ Cannot CREATE documents:', error.message);
        return results; // Pokud nemůže vytvořit, nemůže ani mazat
      }
      
      // Test 3: Can update?
      try {
        await testDocRef.update({
          displayName: 'Test User Updated'
        });
        results.canUpdate = true;
        console.log('✅ Can UPDATE documents');
      } catch (error: any) {
        results.errors.push(`UPDATE failed: ${error.message}`);
        console.log('❌ Cannot UPDATE documents:', error.message);
      }
      
      // Test 4: Can delete? (THE KEY TEST!)
      try {
        await testDocRef.delete();
        results.canDelete = true;
        console.log('✅ Can DELETE documents');
      } catch (error: any) {
        results.errors.push(`DELETE failed: ${error.message}`);
        console.log('❌ Cannot DELETE documents:', error.message);
      }
      
      console.log('📋 Firestore Operations Test Results:', results);
      return results;
      
    } catch (error: any) {
      console.error('❌ FirebaseDebug: Error testing operations:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Ověří admin oprávnění krok za krokem
   */
  static async verifyAdminPermissions(): Promise<any> {
    try {
      console.log('👑 FirebaseDebug: Verifying admin permissions...');
      
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return { error: 'No user logged in' };
      }
      
      // Najdi user v Firestore
      const userQuery = await db.collection('users')
        .where('email', '==', firebaseUser.email)
        .get();
      
      if (userQuery.empty) {
        return { error: 'User not found in Firestore' };
      }
      
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      
      const checks = {
        hasRole: userData.role === 'admin',
        hasStatus: userData.status === 'approved', 
        hasPermissions: !!userData.permissions,
        hasManageUsers: userData.permissions?.manageUsers === true
      };
      
      const isAdmin = checks.hasRole && checks.hasStatus && checks.hasPermissions && checks.hasManageUsers;
      
      const result = {
        userId: userDoc.id,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        permissions: userData.permissions,
        checks,
        isAdmin
      };
      
      console.log('👑 Admin Verification Result:', result);
      return result;
      
    } catch (error: any) {
      console.error('❌ FirebaseDebug: Error verifying admin:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Spustí kompletní diagnostiku
   */
  static async runFullDiagnostic(): Promise<void> {
    console.log('🚀 FirebaseDebug: Starting full diagnostic...');
    console.log('================================================');
    
    const userDetails = await this.getCurrentUserDetails();
    console.log('1️⃣ User Details:', userDetails);
    
    const adminVerification = await this.verifyAdminPermissions();
    console.log('2️⃣ Admin Verification:', adminVerification);
    
    const operationsTest = await this.testFirestoreOperations();
    console.log('3️⃣ Operations Test:', operationsTest);
    
    console.log('================================================');
    console.log('🏁 Full diagnostic complete!');
    
    // Summary
    if (operationsTest.canDelete) {
      console.log('✅ RESULT: Delete should work!');
    } else {
      console.log('❌ RESULT: Delete will NOT work!');
      console.log('🔧 Next steps:');
      console.log('   1. Check Firebase Rules are deployed');
      console.log('   2. Verify admin permissions');
      console.log('   3. Try simple test rules');
    }
  }
}

// Export pro použití v konzoli
(window as any).FirebaseDebug = FirebaseDebug;