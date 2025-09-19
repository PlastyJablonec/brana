import React, { createContext, useContext, useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import { auth, db, googleProvider } from '../firebase/config';
import { IAuthContext, User } from '../types';
import { userService } from '../services/userService';

type FirebaseUser = firebase.User;

interface IUserPermissions {
  gate: boolean;
  garage: boolean;
  camera: boolean;
  stopMode: boolean;
  viewLogs: boolean;
  manageUsers: boolean;
  requireLocation: boolean;
  allowGPS: boolean;
  requireLocationProximity: boolean;
}

// interface IAppUser {
//   id: string;
//   email: string;
//   displayName: string;
//   role: 'admin' | 'user' | 'viewer';
//   permissions: IUserPermissions;
//   gpsEnabled: boolean;
//   createdAt: Date;
//   lastLogin: Date;
// }

const AuthContext = createContext<IAuthContext | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLogin, setIsInitialLogin] = useState(false);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      console.log('🔐 Attempting Firebase login with email:', email);
      setIsInitialLogin(true);
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      console.log('✅ Firebase login successful:', userCredential.user?.uid);
    } catch (error: any) {
      setIsInitialLogin(false);
      console.error('❌ Firebase login error:', error.code, error.message);
      throw new Error(`Login failed: ${error.message}`);
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      console.log('🔐 Attempting Google OAuth login...');
      setIsInitialLogin(true);
      
      const result = await auth.signInWithPopup(googleProvider);
      const firebaseUser = result.user;
      
      if (!firebaseUser) {
        throw new Error('Google authentication failed');
      }

      console.log('✅ Google OAuth successful:', firebaseUser.email);
      
      // Create or get user with Google data
      await userService.createGoogleUser(firebaseUser);
      
    } catch (error: any) {
      setIsInitialLogin(false);
      console.error('❌ Google OAuth error:', error.code, error.message);
      
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Přihlášení bylo zrušeno');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup blokován prohlížečem');
      } else {
        throw new Error(`Google přihlášení selhalo: ${error.message}`);
      }
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🚪 Logging out user...');
      await auth.signOut();
      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw new Error('Logout failed');
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (auth.currentUser) {
      console.log('🔄 AuthContext: Refreshing user data...');
      await fetchUserData(auth.currentUser);
    }
  };

  // Admin functions for user approval
  const approveUser = async (userId: string): Promise<void> => {
    if (!currentUser || !userService.isAdmin(currentUser)) {
      throw new Error('Insufficient permissions');
    }
    await userService.approveUser(userId, currentUser.id);
  };

  const rejectUser = async (userId: string, reason?: string): Promise<void> => {
    if (!currentUser || !userService.isAdmin(currentUser)) {
      throw new Error('Insufficient permissions');
    }
    await userService.rejectUser(userId, currentUser.id, reason);
  };

  const getPendingUsers = async (): Promise<User[]> => {
    console.log('🔍 AuthContext: getPendingUsers called');
    console.log('🔍 AuthContext: currentUser:', currentUser ? { email: currentUser.email, role: currentUser.role } : 'NULL');
    
    if (!currentUser || !userService.isAdmin(currentUser)) {
      console.error('❌ AuthContext: Insufficient permissions for getPendingUsers');
      throw new Error('Insufficient permissions');
    }
    
    console.log('✅ AuthContext: Admin verified, calling userService.getPendingUsers');
    return await userService.getPendingUsers();
  };

  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<void> => {
    try {
      console.log('📊 Fetching user data from Firestore for:', firebaseUser.uid);
      
      // Try to get user by email first (new userService approach)
      let user = await userService.getUserByEmail(firebaseUser.email || '');
      
      if (user) {
        console.log('✅ User found via userService:', user.email, 'Status:', user.status);
        
        // Update last login if this is initial login
        if (isInitialLogin) {
          console.log('🔧 AuthContext: Updating lastLogin for initial login');
          await userService.updateLastLogin(user.id);
          setIsInitialLogin(false);
        }
        
        setCurrentUser(user);
        return;
      }
      
      // Fallback: Check old document structure by uid
      const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('✅ User found in Firestore (legacy):', userData?.email);
        
        const legacyUser: User = {
          id: firebaseUser.uid,
          email: userData?.email || firebaseUser.email || '',
          displayName: userData?.displayName || firebaseUser.displayName || firebaseUser.email || 'User',
          photoURL: firebaseUser.photoURL || undefined,
          role: userData?.role || 'viewer',
          status: userData?.status || 'approved', // Legacy users are auto-approved
          authProvider: userData?.authProvider || 'email', // Legacy users are email
          permissions: userData?.permissions || {
            gate: false,
            garage: false,
            camera: false,
            stopMode: false,
            viewLogs: true,
            manageUsers: false,
            viewGateActivity: false,
            requireLocation: false,
            allowGPS: true,
            requireLocationProximity: false,
          },
          gpsEnabled: userData?.gpsEnabled || false,
          createdAt: userData?.createdAt?.toDate() || new Date(),
          lastLogin: userData?.lastLogin?.toDate() || new Date(),
        };
        
        console.log('🔧 AuthContext: User data loaded from Firestore (legacy)');
        setCurrentUser(legacyUser);
        
        // Only update lastLogin on actual login, not refresh
        if (isInitialLogin) {
          console.log('🔧 AuthContext: Updating lastLogin for initial login');
          await db.collection('users').doc(firebaseUser.uid).update({
            lastLogin: new Date()
          });
          setIsInitialLogin(false);
        }
        
        return;
      }
      
      // Fallback: Create user with minimal data
      console.log('📝 Creating default user profile for:', firebaseUser.email);
      const minimalUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email || 'User',
        photoURL: firebaseUser.photoURL || undefined,
        role: 'viewer',
        status: 'pending', // New users need approval
        authProvider: 'email', // Fallback auth provider
        permissions: {
          gate: false,
          garage: false,
          camera: false,
          stopMode: false,
          viewLogs: true,
          manageUsers: false,
          viewGateActivity: false,
          requireLocation: false,
          allowGPS: true,
          requireLocationProximity: false,
        },
        gpsEnabled: false,
        createdAt: new Date(),
        lastLogin: new Date(),
      };
      
      console.log('🔧 AuthContext: Default user created');
      setCurrentUser(minimalUser);
      
      // Try to save to Firestore for future use
      try {
        await db.collection('users').doc(firebaseUser.uid).set({
          email: minimalUser.email,
          displayName: minimalUser.displayName,
          role: minimalUser.role,
          permissions: minimalUser.permissions,
          gpsEnabled: minimalUser.gpsEnabled,
          createdAt: new Date(),
          lastLogin: new Date()
        });
        console.log('✅ New user saved to Firestore');
      } catch (saveError) {
        console.warn('⚠️ Could not save user to Firestore:', saveError);
      }
      
    } catch (error) {
      const fetchError = error instanceof Error ? error : new Error('Unknown fetch error');
      console.error('❌ Error in fetchUserData:', fetchError);
      throw fetchError;
    }
  };

  useEffect(() => {
    console.log('🔧 AuthContext: Setting up auth state listener');
    
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
      if (firebaseUser) {
        try {
          await fetchUserData(firebaseUser);
        } catch (error) {
          console.error('❌ Failed to fetch user data, creating minimal user:', error);
          // Create minimal user as fallback
          const fallbackUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || undefined,
            role: 'viewer',
            status: 'pending', // New users need approval
            authProvider: 'email', // Fallback auth provider
            permissions: {
              gate: false,
              garage: false,
              camera: false,
              stopMode: false,
              viewLogs: true,
              manageUsers: false,
              viewGateActivity: false,
              requireLocation: false,
              allowGPS: true,
              requireLocationProximity: false,
            },
            gpsEnabled: false,
            createdAt: new Date(),
            lastLogin: new Date(),
          };
          console.log('⚠️ Using fallback user profile');
          setCurrentUser(fallbackUser);
        }
      } else {
        console.log('🚪 User signed out');
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => {
      console.log('🔧 AuthContext: Cleaning up auth state listener');
      unsubscribe();
    };
  }, [fetchUserData]);

  const value: IAuthContext = {
    currentUser,
    loading,
    login,
    loginWithGoogle,
    logout,
    refreshUser,
    approveUser,
    rejectUser,
    getPendingUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};