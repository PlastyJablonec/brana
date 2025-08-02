import React, { createContext, useContext, useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import { auth, db } from '../firebase/config';
import { IAuthContext, User } from '../types';

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

interface IAppUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: IUserPermissions;
  gpsEnabled: boolean;
  createdAt: Date;
  lastLogin: Date;
}

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

  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<void> => {
    try {
      console.log('📊 Fetching user data from Firestore for:', firebaseUser.uid);
      
      const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('✅ User found in Firestore:', userData?.email);
        
        const user: User = {
          id: firebaseUser.uid,
          email: userData?.email || firebaseUser.email || '',
          displayName: userData?.displayName || firebaseUser.displayName || firebaseUser.email || 'User',
          role: userData?.role || 'viewer',
          permissions: userData?.permissions || {
            gate: false,
            garage: false,
            camera: false,
            stopMode: false,
            viewLogs: true,
            manageUsers: false,
            requireLocation: false,
            allowGPS: true,
            requireLocationProximity: false,
          },
          gpsEnabled: userData?.gpsEnabled || false,
          createdAt: userData?.createdAt?.toDate() || new Date(),
          lastLogin: userData?.lastLogin?.toDate() || new Date(),
        };
        
        console.log('🔧 AuthContext: User data loaded from Firestore');
        setCurrentUser(user);
        
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
      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email || 'User',
        role: 'viewer',
        permissions: {
          gate: false,
          garage: false,
          camera: false,
          stopMode: false,
          viewLogs: true,
          manageUsers: false,
          requireLocation: false,
          allowGPS: true,
          requireLocationProximity: false,
        },
        gpsEnabled: false,
        createdAt: new Date(),
        lastLogin: new Date(),
      };
      
      console.log('🔧 AuthContext: Default user created');
      setCurrentUser(user);
      
      // Try to save to Firestore for future use
      try {
        await db.collection('users').doc(firebaseUser.uid).set({
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          permissions: user.permissions,
          gpsEnabled: user.gpsEnabled,
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
    
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await fetchUserData(firebaseUser);
        } catch (error) {
          console.error('❌ Failed to fetch user data, creating minimal user:', error);
          // Create minimal user as fallback
          const minimalUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            role: 'viewer',
            permissions: {
              gate: false,
              garage: false,
              camera: false,
              stopMode: false,
              viewLogs: true,
              manageUsers: false,
              requireLocation: false,
              allowGPS: true,
              requireLocationProximity: false,
            },
            gpsEnabled: false,
            createdAt: new Date(),
            lastLogin: new Date(),
          };
          console.log('⚠️ Using minimal user profile');
          setCurrentUser(minimalUser);
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
  }, []);

  const value: IAuthContext = {
    currentUser,
    loading,
    login,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};