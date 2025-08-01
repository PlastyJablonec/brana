import React, { createContext, useContext, useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import { User } from '../types';
import { auth, db } from '../firebase/config';
import { activityService } from '../services/activityService';
type FirebaseUser = firebase.User;

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLogin, setIsInitialLogin] = useState(false);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting Firebase login with email:', email);
      setIsInitialLogin(true); // Mark this as initial login
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      console.log('Firebase login successful:', userCredential.user?.uid);
    } catch (error: any) {
      setIsInitialLogin(false);
      console.error('Firebase login error:', error.code, error.message);
      throw error;
    }
  };

  const logout = async () => {
    await auth.signOut();
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      console.log('🔧 AuthContext: Refreshing user data...');
      await fetchUserData(firebaseUser);
    }
  };

  const fetchUserData = async (firebaseUser: FirebaseUser) => {
    try {
      console.log('Fetching user data from Firestore for:', firebaseUser.uid);
      
      // First try to get user from Firestore
      try {
        const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log('User found in Firestore:', userData?.email);
          
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
            },
            gpsEnabled: userData?.gpsEnabled || false,
            createdAt: userData?.createdAt?.toDate() || new Date(),
            lastLogin: userData?.lastLogin?.toDate() || new Date(),
          };
          
          console.log('🔧 AuthContext: User permissions loaded from Firestore:', user.permissions);
          console.log('🔧 AuthContext: viewLogs permission:', user.permissions.viewLogs);
          console.log('🔧 AuthContext: manageUsers permission:', user.permissions.manageUsers);
          setCurrentUser(user);
          
          // Only update lastLogin on actual login, not refresh
          if (isInitialLogin) {
            console.log('🔧 AuthContext: Updating lastLogin for initial login');
            await db.collection('users').doc(firebaseUser.uid).update({
              lastLogin: new Date()
            });
            
            // Log the login activity
            try {
              await activityService.logActivity({
                user: user.email,
                userDisplayName: user.displayName,
                action: 'Přihlášení do systému',
                device: 'gate', // Default device for login
                status: 'success',
                details: 'Uživatel se úspěšně přihlásil do systému'
              });
              console.log('🔧 AuthContext: Login activity logged');
            } catch (logError) {
              console.error('🔧 AuthContext: Failed to log login activity:', logError);
            }
            
            setIsInitialLogin(false);
          }
          
          return;
        }
      } catch (firestoreError) {
        console.warn('Firestore fetch failed, using default user:', firestoreError);
      }
      
      // Fallback: Create user with minimal permissions
      console.log('Creating default user profile for:', firebaseUser.email);
      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email || 'User',
        role: 'viewer', // Default to viewer, not admin!
        permissions: {
          gate: false,
          garage: false, 
          camera: false,
          stopMode: false,
          viewLogs: true,
          manageUsers: false,
          requireLocation: false,
          allowGPS: true,
        },
        gpsEnabled: false,
        createdAt: new Date(),
        lastLogin: new Date(),
      };
      
      console.log('🔧 AuthContext: Default user created with limited permissions:', user.permissions);
      console.log('🔧 AuthContext: Default viewLogs permission:', user.permissions.viewLogs);
      setCurrentUser(user);
      
      // Try to save to Firestore for future use
      try {
        await db.collection('users').doc(firebaseUser.uid).set(user);
        console.log('New user saved to Firestore');
      } catch (saveError) {
        console.warn('Could not save user to Firestore:', saveError);
      }
      
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      if (firebaseUser) {
        try {
          await fetchUserData(firebaseUser);
        } catch (error) {
          console.error('Failed to fetch user data, creating minimal user:', error);
          // Create minimal user with limited permissions - don't give admin by default!
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
            },
            gpsEnabled: false,
            createdAt: new Date(),
            lastLogin: new Date(),
          };
          console.log('Using minimal user profile with limited permissions:', minimalUser.permissions);
          setCurrentUser(minimalUser);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    firebaseUser,
    loading,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};