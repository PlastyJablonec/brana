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

if (hasValidConfig || process.env.NODE_ENV === 'production') {
  console.log('🔥 Firebase: Platná konfigurace nalezena, inicializuji Firebase...');
  
  firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'brana-a71fe.firebaseapp.com',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'brana-a71fe',
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'brana-a71fe.firebasestorage.app',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || 'demo-app-id',
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'demo-measurement-id'
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
  console.error('❌ Firebase: Neplatná konfigurace!');
  console.error('💡 POVINNÉ: Zkopíruj .env.example do .env a nastav správné Firebase hodnoty');
  console.error('🔧 Kontroluj proměnné: REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_PROJECT_ID');
  
  // Application will not work without proper Firebase config
  throw new Error('Firebase konfigurace chybí nebo je neplatná! Nastav správné hodnoty v .env souboru.');
}

export { auth, db, googleProvider };
export default app;