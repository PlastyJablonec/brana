import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Validate Firebase config - DOČASNĚ VYPNUTO PRO MQTT TEST
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_ACTUAL')) {
  console.warn('🔥 Firebase: API Key není nastaven - pokračujeme v testovacím režimu');
  // alert('Firebase konfigurace chybí! Zkontroluj .env soubor a nastav správné Firebase hodnoty.');
}

if (!firebaseConfig.projectId) {
  console.warn('🔥 Firebase: Project ID není nastaven - pokračujeme v testovacím režimu');
  // alert('Firebase Project ID chybí v .env souboru!');
}

// Debug Firebase config
console.log('🔥 Initializing Firebase with config:', {
  apiKey: firebaseConfig.apiKey?.substring(0, 10) + '...',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  hasValidConfig: !!(firebaseConfig.apiKey && firebaseConfig.projectId && !firebaseConfig.apiKey.includes('YOUR_ACTUAL'))
});

try {
  firebase.initializeApp(firebaseConfig);
  console.log('🔥 Firebase initialized successfully');
} catch (error) {
  console.warn('🔥 Firebase initialization failed - pokračujeme v testovacím režimu:', error);
  // alert('Firebase se nepodařilo inicializovat! Zkontroluj konfiguraci.');
}
export const auth = firebase.auth();
export const db = firebase.firestore();
const app = firebase.app();

// Test Firebase connection
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('Firebase Auth: User logged in -', user.email);
  } else {
    console.log('Firebase Auth: No user logged in');
  }
});

export default app;