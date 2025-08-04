import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Check if we have valid Firebase config
const hasValidConfig = !!(
  process.env.REACT_APP_FIREBASE_API_KEY && 
  process.env.REACT_APP_FIREBASE_PROJECT_ID &&
  !process.env.REACT_APP_FIREBASE_API_KEY.includes('your-api-key')
);

let firebaseConfig: any = {};
let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

if (hasValidConfig) {
  console.log('🔥 Firebase: Platná konfigurace nalezena, inicializuji Firebase...');
  
  firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
  };

  try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    
    // Google OAuth provider
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    
    console.log('✅ Firebase initialized successfully');
    
    // Test Firebase connection
    auth.onAuthStateChanged((user: any) => {
      if (user) {
        console.log('Firebase Auth: User logged in -', user.email);
      } else {
        console.log('Firebase Auth: No user logged in');
      }
    });
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    app = null;
    auth = null;
    db = null;
    googleProvider = null;
  }
} else {
  console.warn('⚠️ Firebase: Neplatná konfigurace - používám MOCK režim pro vývoj');
  console.warn('💡 Tip: Zkopíruj .env.example do .env a nastav správné Firebase hodnoty');
  
  // Mock Firebase objects for development
  const createMockAuth = () => ({
    currentUser: null,
    onAuthStateChanged: (callback: any) => {
      console.log('🔧 Mock Auth: onAuthStateChanged called');
      // Simulate no user logged in
      setTimeout(() => callback(null), 100);
      return () => {}; // unsubscribe function
    },
    signInWithEmailAndPassword: async (email: string, password: string) => {
      console.log('🔧 Mock Auth: signInWithEmailAndPassword called', { email });
      // Simulate successful login for testing
      return {
        user: {
          uid: 'mock-user-id',
          email: email,
          displayName: email.split('@')[0]
        }
      };
    },
    createUserWithEmailAndPassword: async (email: string, password: string) => {
      console.log('🔧 Mock Auth: createUserWithEmailAndPassword called', { email });
      // Simulate successful user creation
      return {
        user: {
          uid: `mock-user-${Date.now()}`,
          email: email,
          displayName: email.split('@')[0]
        }
      };
    },
    signInWithPopup: async (provider: any) => {
      console.log('🔧 Mock Auth: signInWithPopup called');
      throw new Error('Google OAuth není dostupný v MOCK režimu');
    },
    signOut: async () => {
      console.log('🔧 Mock Auth: signOut called');
      return Promise.resolve();
    }
  });

  const createMockFirestore = () => ({
    collection: (path: string) => ({
      add: async (data: any) => {
        console.log('🔧 Mock Firestore: Přidávám dokument do', path, data);
        return {
          id: `mock-doc-${Date.now()}`,
          data: () => data
        };
      },
      doc: (id: string) => ({
        get: async () => ({
          exists: true,
          id: id,
          data: () => ({
            email: 'mock@user.com',
            displayName: 'Mock User',
            role: 'admin',
            permissions: {
              gate: true,
              garage: true,
              camera: true,
              stopMode: true,
              viewLogs: true,
              manageUsers: true,
              requireLocation: false,
              allowGPS: true,
              requireLocationProximity: false
            }
          })
        }),
        update: async (data: any) => {
          console.log('🔧 Mock Firestore: Aktualizuji dokument', id, data);
          return Promise.resolve();
        },
        delete: async () => {
          console.log('🔧 Mock Firestore: Mažu dokument', id);
          return Promise.resolve();
        }
      }),
      get: async () => ({
        docs: [
          {
            id: `mock-user-1`,
            data: () => ({
              email: 'admin@mock.com',
              displayName: 'Mock Admin',
              role: 'admin',
              status: 'approved',
              authProvider: 'email',
              permissions: {
                gate: true,
                garage: true,
                camera: true,
                stopMode: true,
                viewLogs: true,
                manageUsers: true,
                requireLocation: false,
                allowGPS: true,
                requireLocationProximity: false
              },
              createdAt: { toDate: () => new Date() },
              lastLogin: { toDate: () => new Date() }
            })
          }
        ]
      }),
      where: () => ({
        get: async () => ({
          docs: []
        })
      })
    }),
    doc: (path: string) => ({
      get: async () => ({
        exists: true,
        data: () => ({})
      }),
      set: async (data: any) => {
        console.log('🔧 Mock Firestore: Nastavuji dokument', path, data);
        return Promise.resolve();
      }
    })
  });

  // Create mock objects
  auth = createMockAuth();
  db = createMockFirestore();
  
  // Mock Google provider  
  googleProvider = {
    addScope: (scope: string) => {
      console.log('🔧 Mock GoogleProvider: addScope called', scope);
    }
  };
  
  app = {
    name: 'mock-firebase-app',
    options: firebaseConfig
  };
}

export { auth, db, googleProvider };
export default app;