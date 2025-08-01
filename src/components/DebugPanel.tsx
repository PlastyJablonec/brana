import React, { useState } from 'react';
import { auth, db } from '../firebase/config';

const DebugPanel: React.FC = () => {
  const [email, setEmail] = useState('admin@test.cz');
  const [password, setPassword] = useState('test123');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const createTestUser = async () => {
    setCreating(true);
    setMessage('');
    
    try {
      console.log('Creating user with email:', email);
      
      // Create user in Firebase Auth
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      if (!user) throw new Error('User not created');
      console.log('User created in Auth:', user.uid);
      
      // Create user document in Firestore
      const userData = {
        email: email,
        displayName: 'Test Admin',
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

      await db.collection('users').doc(user.uid).set(userData);
      console.log('User document created in Firestore');
      
      setMessage(`✅ Uživatel vytvořen: ${email} / ${password}`);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      setMessage(`❌ Chyba: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(148, 163, 184, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      minWidth: '300px'
    }}>
      <h3 style={{ color: 'white', margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
        🔧 Debug Panel
      </h3>
      
      <div style={{ marginBottom: '12px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '12px'
          }}
        />
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '12px'
          }}
        />
      </div>
      
      <button
        onClick={createTestUser}
        disabled={creating}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: creating ? '#374151' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: creating ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          fontWeight: '600'
        }}
      >
        {creating ? 'Vytvářím...' : 'Vytvořit test uživatele'}
      </button>
      
      {message && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: message.includes('✅') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${message.includes('✅') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '6px',
          fontSize: '11px',
          color: 'white'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default DebugPanel;