import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Check if we have valid Firebase config
const hasValidConfig = !!(
  process.env.REACT_APP_FIREBASE_API_KEY &&
  process.env.REACT_APP_FIREBASE_PROJECT_ID &&
  !process.env.REACT_APP_FIREBASE_API_KEY.includes('your-api-key') &&
  !process.env.REACT_APP_FIREBASE_API_KEY.includes('demo-api-key')
);

let firebaseConfig: any = {};
let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

if (hasValidConfig || process.env.NODE_ENV === 'production') {
  console.log('🔥 Firebase: Platná konfigurace nalezena, inicializuji Firebase...');
  console.log('🔍 DEBUG: Environment variables:');
  console.log('  REACT_APP_FIREBASE_PROJECT_ID:', process.env.REACT_APP_FIREBASE_PROJECT_ID);
  console.log('  REACT_APP_FIREBASE_API_KEY:', process.env.REACT_APP_FIREBASE_API_KEY?.substring(0, 10) + '...');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  
  firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBaDmIBLtw4ck4eUJMmGScwPBPYuIv8QSU',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'brana-a71fe.firebaseapp.com',
    projectId: 'brana-a71fe', // HARDCODED to prevent demo-project-id fallback
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'brana-a71fe.firebasestorage.app',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '1080619570120',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:1080619570120:web:62c1ea8d1a78532672e6fd',
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-K8FRR55FR5'
  };

  console.log('🔍 DEBUG: Final Firebase config:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey.substring(0, 10) + '...'
  });

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
  console.error('❌ Firebase: Neplatná konfigurace!');
  console.error('💡 POVINNÉ: Zkopíruj .env.example do .env a nastav správné Firebase hodnoty');
  console.error('🔧 Kontroluj proměnné: REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_PROJECT_ID');
  
  // Application will not work without proper Firebase config
  throw new Error('Firebase konfigurace chybí nebo je neplatná! Nastav správné hodnoty v .env souboru.');
}

export { auth, db, googleProvider };
export default app;