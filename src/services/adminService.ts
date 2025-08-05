import { auth, db } from '../firebase/config';
import { User } from '../types';

/**
 * Admin Service - řešení problémů s admin autentifikací a oprávněními
 */
export class AdminService {
  
  /**
   * Ověří, že aktuální uživatel je skutečně admin s potřebnými oprávněními
   */
  async verifyAdminAccess(): Promise<{ isAdmin: boolean; user: User | null; error?: string }> {
    try {
      console.log('🔍 AdminService: Verifying admin access...');
      
      // 1. Zkontroluj Firebase Auth
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        console.log('❌ AdminService: No Firebase user logged in');
        return { isAdmin: false, user: null, error: 'Not logged in' };
      }
      
      console.log('✅ AdminService: Firebase user found:', firebaseUser.email);
      
      // 2. Zkontroluj auth token
      const token = await firebaseUser.getIdToken(true); // Force refresh
      console.log('✅ AdminService: Auth token refreshed:', token ? 'EXISTS' : 'MISSING');
      
      // 3. Zkusí načíst user data z Firestore
      const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
      
      if (!userDoc.exists) {
        console.log('❌ AdminService: User document not found in Firestore');
        return { isAdmin: false, user: null, error: 'User not in database' };
      }
      
      const userData = userDoc.data()!;
      const user: User = {
        id: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        nick: userData.nick,
        role: userData.role,
        status: userData.status,
        authProvider: userData.authProvider || 'email',
        permissions: userData.permissions || {},
        gpsEnabled: userData.gpsEnabled || false,
        createdAt: userData.createdAt?.toDate() || new Date(),
        lastLogin: userData.lastLogin?.toDate() || new Date(),
        requestedAt: userData.requestedAt?.toDate(),
        approvedAt: userData.approvedAt?.toDate(),
        approvedBy: userData.approvedBy,
        rejectedAt: userData.rejectedAt?.toDate(),
        rejectedBy: userData.rejectedBy,
        rejectedReason: userData.rejectedReason,
      };
      
      console.log('📊 AdminService: User data loaded:', {
        email: user.email,
        role: user.role,
        status: user.status,
        manageUsers: user.permissions?.manageUsers
      });
      
      // 4. Ověř admin oprávnění
      const isAdmin = user.role === 'admin' && 
                      user.status === 'approved' && 
                      user.permissions?.manageUsers === true;
      
      if (!isAdmin) {
        console.log('❌ AdminService: User is not admin or not approved');
        return { 
          isAdmin: false, 
          user, 
          error: `Role: ${user.role}, Status: ${user.status}, ManageUsers: ${user.permissions?.manageUsers}` 
        };
      }
      
      console.log('✅ AdminService: Admin access verified');
      return { isAdmin: true, user };
      
    } catch (error: any) {
      console.error('❌ AdminService: Error verifying admin:', error);
      return { 
        isAdmin: false, 
        user: null, 
        error: `Firebase error: ${error.code || error.message}` 
      };
    }
  }
  
  /**
   * Pokusí se načíst pending users s fallback metodami
   */
  async getPendingUsersWithFallback(): Promise<{ users: User[]; method: string }> {
    try {
      console.log('🔍 AdminService: Attempting to get pending users...');
      
      // Metoda 1: Standardní dotaz
      try {
        console.log('📋 AdminService: Method 1 - Standard query');
        const querySnapshot = await db.collection('users')
          .where('status', '==', 'pending')
          .get();
        
        const users = querySnapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            email: data.email,
            displayName: data.displayName,
            photoURL: data.photoURL,
            nick: data.nick,
            role: data.role,
            status: data.status,
            authProvider: data.authProvider || 'email',
            permissions: data.permissions || {},
            gpsEnabled: data.gpsEnabled || false,
            createdAt: data.createdAt?.toDate() || new Date(),
            lastLogin: data.lastLogin?.toDate() || new Date(),
            requestedAt: data.requestedAt?.toDate(),
            approvedAt: data.approvedAt?.toDate(),
            approvedBy: data.approvedBy,
            rejectedAt: data.rejectedAt?.toDate(),
            rejectedBy: data.rejectedBy,
            rejectedReason: data.rejectedReason,
          } as User;
        });
        
        console.log('✅ AdminService: Method 1 success -', users.length, 'pending users');
        return { users, method: 'standard' };
        
      } catch (standardError: any) {
        console.warn('⚠️ AdminService: Method 1 failed:', standardError.code);
        
        // Metoda 2: Načtení všech users a filtrování
        console.log('📋 AdminService: Method 2 - Get all and filter');
        const allSnapshot = await db.collection('users').get();
        const allUsers = allSnapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            email: data.email,
            displayName: data.displayName,
            photoURL: data.photoURL,
            nick: data.nick,
            role: data.role,
            status: data.status,
            authProvider: data.authProvider || 'email',
            permissions: data.permissions || {},
            gpsEnabled: data.gpsEnabled || false,
            createdAt: data.createdAt?.toDate() || new Date(),
            lastLogin: data.lastLogin?.toDate() || new Date(),
            requestedAt: data.requestedAt?.toDate(),
            approvedAt: data.approvedAt?.toDate(),
            approvedBy: data.approvedBy,
            rejectedAt: data.rejectedAt?.toDate(),
            rejectedBy: data.rejectedBy,
            rejectedReason: data.rejectedReason,
          } as User;
        });
        
        const pendingUsers = allUsers.filter((user: User) => user.status === 'pending');
        console.log('✅ AdminService: Method 2 success -', pendingUsers.length, 'pending users from', allUsers.length, 'total');
        return { users: pendingUsers, method: 'fallback' };
      }
      
    } catch (error: any) {
      console.error('❌ AdminService: All methods failed:', error);
      return { users: [], method: 'failed' };
    }
  }
  
  /**
   * Vytvoří emergency admin účet
   */
  async createEmergencyAdmin(email: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🚨 AdminService: Creating emergency admin account...');
      
      // Vytvoř Firebase Auth účet
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const firebaseUser = userCredential.user;
      
      if (!firebaseUser) {
        return { success: false, message: 'Failed to create Firebase user' };
      }
      
      // Vytvoř Firestore záznam s admin oprávněními
      await db.collection('users').doc(firebaseUser.uid).set({
        email: email,
        displayName: 'Emergency Admin',
        role: 'admin',
        status: 'approved', // Automatically approved
        authProvider: 'email',
        permissions: {
          gate: true,
          garage: true,
          camera: true,
          stopMode: true,
          viewLogs: true,
          manageUsers: true, // Key admin permission
          requireLocation: false,
          allowGPS: true,
          requireLocationProximity: false
        },
        createdAt: new Date(),
        approvedAt: new Date(),
        approvedBy: 'system',
        gpsEnabled: false
      });
      
      console.log('✅ AdminService: Emergency admin created successfully');
      return { success: true, message: `Emergency admin created: ${email}` };
      
    } catch (error: any) {
      console.error('❌ AdminService: Failed to create emergency admin:', error);
      return { success: false, message: error.message };
    }
  }
}

export const adminService = new AdminService();