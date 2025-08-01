const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json'); // You need to download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'brana-a71fe'
});

const auth = admin.auth();
const db = admin.firestore();

async function createUser(email, password, displayName) {
  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName
    });

    console.log('User created in Firebase Auth:', userRecord.uid);

    // Create user document in Firestore
    const userData = {
      email: email,
      displayName: displayName,
      role: 'admin',
      permissions: {
        gate: true,
        garage: true,
        camera: true,
        stopMode: true,
        viewLogs: true,
        manageUsers: true,
        requireLocation: false
      },
      gpsEnabled: false,
      createdAt: new Date(),
      lastLogin: null
    };

    await db.collection('users').doc(userRecord.uid).set(userData);
    console.log('User document created in Firestore');
    
    return userRecord.uid;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// Usage: node createUser.js email@example.com password123 "Display Name"
const email = process.argv[2];
const password = process.argv[3];
const displayName = process.argv[4] || 'Test User';

if (!email || !password) {
  console.log('Usage: node createUser.js <email> <password> [displayName]');
  process.exit(1);
}

createUser(email, password, displayName)
  .then((uid) => {
    console.log(`User created successfully with UID: ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create user:', error);
    process.exit(1);
  });