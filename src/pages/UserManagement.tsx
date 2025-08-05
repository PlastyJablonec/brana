import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import UserApprovalPanel from '../components/UserApprovalPanel';
import { auth, db } from '../firebase/config';
import { locationService } from '../services/locationService';
import { userService } from '../services/userService';
import { adminService } from '../services/adminService';
import { FirebaseDebug } from '../utils/firebaseDebug';
import { User } from '../types';

const UserManagement: React.FC = () => {
  const { currentUser, refreshUser, logout, getPendingUsers } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    nick: '',
    password: '',
    role: 'user' as const,
    permissions: {
      gate: false,
      garage: false,
      camera: false,
      stopMode: false,
      viewLogs: true,
      manageUsers: false,
      requireLocation: false,
      allowGPS: true,
      requireLocationProximity: false
    }
  });

  useEffect(() => {
    loadUsers();
    loadPendingCount();
    
    // Handle window resize for responsive design
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadPendingCount = async () => {
    try {
      if (currentUser?.role === 'admin') {
        const pendingUsers = await getPendingUsers();
        setPendingCount(pendingUsers.length);
      }
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // OPRAVA: Používat getApprovedUsers() místo filtrování getAllUsers()
      // Tím se zajistí, že main seznam obsahuje jen schválené uživatele
      // Pending uživatelé se zobrazují pouze v UserApprovalPanel
      const approvedUsers = await userService.getApprovedUsers();
      setUsers(approvedUsers);
      
      // Refresh pending count when users list is loaded
      await loadPendingCount();
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshGPS = async (userId: string) => {
    try {
      console.log('📍 UserManagement: Refreshing GPS for user:', userId);
      
      // Request current location
      const location = await locationService.getCurrentLocation();
      
      // Update user's location in Firestore
      const userDoc = db.collection('users').doc(userId);
      await userDoc.update({
        lastLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: new Date()
        }
      });
      
      console.log('📍 GPS updated successfully:', locationService.formatLocationString(location));
      
      // Reload users to show updated location
      await loadUsers();
    } catch (error: any) {
      console.error('📍 GPS refresh failed:', error);
      // No alert - just log the error
    }
  };

  const handleAddUser = async () => {
    console.log('🚀 handleAddUser started');
    console.log('📋 New user data:', newUser);
    console.log('👤 Current user:', currentUser);
    
    try {
      setLoading(true);
      console.log('⏳ Loading state set to true');
      
      // Validate input data
      if (!newUser.email || !newUser.displayName || !newUser.password) {
        throw new Error('Chybí povinné údaje (email, jméno nebo heslo)');
      }
      
      console.log('🔐 Creating Firebase Auth user...');
      // Create Firebase Auth user
      const userCredential = await auth.createUserWithEmailAndPassword(newUser.email, newUser.password);
      console.log('✅ Firebase Auth user created:', userCredential.user.uid);
      
      const userData = {
        uid: userCredential.user.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        photoURL: null, // No photo for manually created users
        nick: newUser.nick || '',
        role: newUser.role,
        status: 'approved', // Manual users are auto-approved by admin
        authProvider: 'email', // Manual registration via email
        permissions: newUser.permissions,
        gpsEnabled: newUser.permissions.allowGPS,
        createdAt: new Date(),
        lastLogin: new Date(),
        requestedAt: new Date(), // Same as creation time for manual users
        approvedAt: new Date(), // Auto-approved
        approvedBy: currentUser?.id || 'admin' // Current admin who created the user
      };
      
      console.log('📄 User document data:', userData);
      console.log('💾 Adding user document to Firestore...');
      
      // Add user document to Firestore with all required fields
      const docRef = await db.collection('users').add(userData);
      console.log('✅ Firestore document created with ID:', docRef.id);

      alert('✅ Uživatel byl úspěšně vytvořen!');
      console.log('✅ Manual user created successfully and auto-approved');

      setShowAddDialog(false);
      setShowPassword(false); // Reset password visibility
      setNewUser({
        email: '',
        displayName: '',
        nick: '',
        password: '',
        role: 'user',
        permissions: {
          gate: false,
          garage: false,
          camera: false,
          stopMode: false,
          viewLogs: true,
          manageUsers: false,
          requireLocation: false,
          allowGPS: true,
          requireLocationProximity: false
        }
      });
      
      console.log('🔄 Reloading users list...');
      await loadUsers();
      console.log('✅ Users list reloaded');
    } catch (error: any) {
      console.error('❌ Error adding user:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Full error object:', error);
      
      let errorMessage = 'Neznámá chyba při vytváření uživatele';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Uživatel s tímto emailem již existuje';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Heslo je příliš slabé (minimálně 6 znaků)';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Neplatný formát emailu';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ Chyba při vytváření uživatele: ' + errorMessage);
    } finally {
      console.log('🏁 handleAddUser finished, setting loading to false');
      setLoading(false);
    }
  };

  const handleUpdateUser = async (user: User) => {
    try {
      setLoading(true);
      console.log('✏️ UserManagement: Updating user:', user.id, user.displayName);
      
      // Ověř admin přístup
      const adminCheck = await adminService.verifyAdminAccess();
      if (!adminCheck.isAdmin || !adminCheck.user) {
        console.error('❌ UserManagement: Admin verification failed for update action:', adminCheck.error);
        alert('Chyba: Nemáte oprávnění pro úpravu uživatelů');
        return;
      }
      
      console.log('✅ UserManagement: Admin verified, proceeding with update...');
      
      const userDoc = db.collection('users').doc(user.id);
      await userDoc.update({
        displayName: user.displayName,
        nick: user.nick || '',
        role: user.role,
        permissions: user.permissions
      });
      
      console.log('✅ User updated successfully:', user.displayName);
      setEditingUser(null);
      await loadUsers();
      
      // If we updated the current user's permissions, refresh their session
      if (user.id === currentUser?.id) {
        console.log('🔧 UserManagement: Refreshing current user permissions...');
        await refreshUser();
      }
      
    } catch (error: any) {
      console.error('❌ Error updating user:', error);
      
      let errorMessage = 'Neznámá chyba při aktualizaci uživatele';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'Nemáte oprávnění pro úpravu uživatelů. Zkontrolujte Firebase přístup.';
      } else if (error.code === 'not-found') {
        errorMessage = 'Uživatel nebyl nalezen v databázi.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ Chyba při aktualizaci uživatele: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Najdi uživatele pro zobrazení v potvrzení
    const userToDelete = users.find(u => u.id === userId);
    const userName = userToDelete ? `${userToDelete.displayName} (${userToDelete.email})` : 'tohoto uživatele';
    
    if (!window.confirm(`Opravdu chcete smazat uživatele ${userName}?\n\nTato akce je nevratná!`)) {
      return;
    }
    
    try {
      setLoading(true);
      console.log('🗑️ UserManagement: Attempting to delete user:', userId, userName);
      
      // PŘIDÁNO: Spusť kompletní diagnostiku před mazáním
      console.log('🚀 Running Firebase diagnostics before delete...');
      await FirebaseDebug.runFullDiagnostic();
      
      // Ověř admin přístup
      const adminCheck = await adminService.verifyAdminAccess();
      if (!adminCheck.isAdmin || !adminCheck.user) {
        console.error('❌ UserManagement: Admin verification failed for delete action:', adminCheck.error);
        alert('Chyba: Nemáte oprávnění pro mazání uživatelů');
        return;
      }
      
      console.log('✅ UserManagement: Admin verified, proceeding with delete...');
      
      // Zakázat mazání sebe sama
      if (userId === currentUser?.id) {
        alert('❌ Nemůžete smazat sám sebe!');
        return;
      }
      
      // PŘIDÁNO: Otestuj delete permission před skutečným mazáním
      console.log('🧪 Testing delete permission with test document...');
      const testDocRef = db.collection('users').doc(`test-delete-${Date.now()}`);
      
      try {
        // Vytvoř test document
        await testDocRef.set({ test: true });
        console.log('✅ Test document created');
        
        // Zkus ho smazat
        await testDocRef.delete();
        console.log('✅ Test document deleted - permissions OK!');
      } catch (testError: any) {
        console.error('❌ Test delete failed:', testError);
        alert(`❌ Test delete failed: ${testError.message}\n\nFirebase Rules nejsou správně nastavené!`);
        return;
      }
      
      // Pokud test prošel, zkus skutečné mazání
      console.log('🎯 Proceeding with actual user deletion...');
      const userDoc = db.collection('users').doc(userId);
      await userDoc.delete();
      
      console.log('✅ User deleted successfully:', userId);
      alert('✅ Uživatel byl úspěšně smazán');
      
      // Obnovit seznam uživatelů
      await loadUsers();
      
    } catch (error: any) {
      console.error('❌ Error deleting user:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Neznámá chyba při mazání uživatele';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'Nemáte oprávnění pro mazání uživatelů. Zkontrolujte Firebase přístup.';
      } else if (error.code === 'not-found') {
        errorMessage = 'Uživatel nebyl nalezen v databázi.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ Chyba při mazání uživatele: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      admin: { name: 'Administrátor', color: 'text-accent-primary' },
      user: { name: 'Uživatel', color: 'text-success' },
      viewer: { name: 'Pozorovatel', color: 'text-warning' }
    };
    return roleMap[role as keyof typeof roleMap] || { name: role, color: 'text-secondary' };
  };

  if (!currentUser?.permissions.manageUsers) {
    return (
      <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
        {/* Header */}
        <div className="md-card md-card-elevated" style={{ marginBottom: '16px' }}>
          <div className="md-card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="md-card-title">Správa uživatelů</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ThemeToggle />
              <button 
                onClick={() => navigate('/dashboard')}
                className="btn-icon md-ripple"
                style={{ 
                  background: 'var(--md-surface-variant)', 
                  border: '1px solid var(--md-outline)',
                  borderRadius: '12px',
                  color: 'var(--md-on-surface-variant)',
                  boxShadow: 'var(--md-elevation-1-shadow)'
                }}
              >
                <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Access Denied */}
        <div className="md-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <svg style={{ width: '64px', height: '64px', color: 'var(--md-error)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.248 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="md-card-title" style={{ color: 'var(--md-error)', marginBottom: '8px' }}>Přístup odmítnut</h2>
          <p className="md-card-subtitle">Nemáte oprávnění k správě uživatelů.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
      {/* Header with Material Design */}
      <div className="md-card md-card-elevated" style={{ marginBottom: '16px' }}>
        <div className="md-card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="md-card-title" style={{ margin: 0 }}>Správa uživatelů</h1>
              {currentUser?.role === 'admin' && pendingCount > 0 && (
                <div style={{
                  background: 'var(--md-warning)',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  animation: 'pulse 2s ease-in-out infinite'
                }}>
                  ⏳ {pendingCount} čeká na schválení
                </div>
              )}
            </div>
            <p className="md-card-subtitle">
              Spravujte uživatele a jejich oprávnění v systému
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button 
              onClick={() => navigate('/dashboard')}
              className="btn-icon md-ripple"
              style={{ 
                background: 'var(--md-surface-variant)', 
                border: '1px solid var(--md-outline)',
                borderRadius: '12px',
                color: 'var(--md-on-surface-variant)',
                boxShadow: 'var(--md-elevation-1-shadow)'
              }}
            >
              <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* User Approval Panel - only for admins */}
      {currentUser?.role === 'admin' && (
        <div style={{ marginBottom: '16px' }}>
          <UserApprovalPanel />
        </div>
      )}

      {/* Add User Button + Debug Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button 
          onClick={async () => {
            console.log('🔧 Running Firebase Debug Diagnostic...');
            await FirebaseDebug.runFullDiagnostic();
            alert('🔧 Debug diagnostic complete! Check console for details.');
          }}
          className="md-fab md-fab-extended md-ripple"
          style={{
            background: 'var(--md-warning)',
            color: 'white'
          }}
        >
          🔧 Debug Firebase
        </button>
        
        <button 
          onClick={() => {
            console.log('🆕 Opening Add User dialog');
            console.log('📊 Current newUser state before opening:', newUser);
            setShowAddDialog(true);
          }}
          className="md-fab md-fab-extended md-ripple"
          style={{
            background: 'var(--md-primary)',
            color: 'var(--md-on-primary)'
          }}
        >
          <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
          </svg>
          Přidat uživatele
        </button>
      </div>

      {/* Users List */}
      <div className="md-card">
        {loading ? (
          <div style={{ padding: '64px 32px', textAlign: 'center' }}>
            <div className="loading" style={{ margin: '0 auto 16px' }}></div>
            <p className="md-card-subtitle">Načítám uživatele...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '64px 32px', textAlign: 'center' }}>
            <svg style={{ width: '64px', height: '64px', color: 'var(--md-on-surface-variant)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="md-card-title" style={{ marginBottom: '8px' }}>Žádní uživatelé</h3>
            <p className="md-card-subtitle">Přidejte první uživatele do systému</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
            {users.map((user) => (
              <div key={user.id} className="md-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 className="md-card-title" style={{ fontSize: '1rem', marginBottom: '4px' }}>
                      {user.displayName}
                      {user.nick && (
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: '500', 
                          color: 'var(--md-primary)', 
                          marginLeft: '8px' 
                        }}>
                          ({user.nick})
                        </span>
                      )}
                    </h3>
                    <p className="md-card-subtitle" style={{ marginBottom: '8px' }}>
                      {user.email}
                    </p>
                    
                    {/* Role Badge */}
                    <div style={{ 
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      backgroundColor: user.role === 'admin' ? 'var(--md-primary)' : 
                                     user.role === 'user' ? 'var(--md-success)' : 'var(--md-warning)',
                      color: 'white',
                      marginBottom: '12px'
                    }}>
                      {getRoleDisplay(user.role).name}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setEditingUser(user)}
                      className="btn-icon md-ripple"
                      style={{
                        background: 'var(--md-surface-variant)',
                        border: '1px solid var(--md-outline)',
                        borderRadius: '8px',
                        color: 'var(--md-primary)',
                        width: '36px',
                        height: '36px'
                      }}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="btn-icon md-ripple"
                      disabled={user.id === currentUser?.id || loading}
                      style={{
                        background: (user.id === currentUser?.id || loading) ? 'var(--md-surface-variant)' : 'var(--md-surface-variant)',
                        border: '1px solid var(--md-outline)',
                        borderRadius: '8px',
                        color: (user.id === currentUser?.id) ? 'var(--md-on-surface-variant)' : 'var(--md-error)',
                        width: '36px',
                        height: '36px',
                        opacity: (user.id === currentUser?.id || loading) ? 0.5 : 1,
                        cursor: (user.id === currentUser?.id || loading) ? 'not-allowed' : 'pointer'
                      }}
                      title={user.id === currentUser?.id ? 'Nemůžete smazat sám sebe' : 'Smazat uživatele'}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Permissions */}
                <div style={{ marginBottom: '8px' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginBottom: '6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Oprávnění
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {user.permissions.gate && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-success)',
                        color: 'white'
                      }}>Brána</span>
                    )}
                    {user.permissions.garage && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-success)',
                        color: 'white'
                      }}>Garáž</span>
                    )}
                    {user.permissions.camera && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-success)',
                        color: 'white'
                      }}>Kamera</span>
                    )}
                    {user.permissions.stopMode && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-warning)',
                        color: 'white'
                      }}>STOP</span>
                    )}
                    {user.permissions.manageUsers && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-primary)',
                        color: 'white'
                      }}>Admin</span>
                    )}
                    {currentUser?.permissions.manageUsers && user.permissions.requireLocation && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-warning)',
                        color: 'white'
                      }}>Lokace</span>
                    )}
                    {currentUser?.permissions.manageUsers && user.permissions.allowGPS && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-success)',
                        color: 'white'
                      }}>GPS</span>
                    )}
                    {currentUser?.permissions.manageUsers && user.permissions.requireLocationProximity && (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 500,
                        backgroundColor: 'var(--md-error)',
                        color: 'white'
                      }}>Vzdálenost</span>
                    )}
                  </div>
                </div>
                
                {/* Last Login */}
                <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                  Poslední přihlášení: {user.lastLogin ? user.lastLogin.toLocaleDateString('cs-CZ') : 'Nikdy'}
                </p>
                
                {/* GPS Location Info - only for admins */}
                {currentUser?.permissions.manageUsers && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: 'var(--md-surface-variant)',
                    borderRadius: '8px',
                    border: '1px solid var(--md-outline)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginBottom: 0, fontWeight: 500 }}>
                        📍 GPS Lokace
                      </p>
                      <button
                        onClick={() => handleRefreshGPS(user.id)}
                        className="btn-icon md-ripple"
                        style={{
                          background: 'var(--md-primary)',
                          color: 'var(--md-on-primary)',
                          border: 'none',
                          borderRadius: '6px',
                          width: '24px',
                          height: '24px',
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Aktualizovat GPS lokaci"
                      >
                        🔄
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--md-on-surface-variant)' }}>
                        Požaduje lokaci: {user.permissions?.requireLocation ? '✅ Ano' : '❌ Ne'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--md-on-surface-variant)' }}>
                        GPS povoleno: {user.permissions?.allowGPS ? '✅ Ano' : '❌ Ne'}
                      </span>
                      
                      {user.lastLocation ? (
                        <>
                          <span style={{ fontSize: '0.7rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
                            📍 Poslední pozice: {user.lastLocation.latitude.toFixed(6)}°, {user.lastLocation.longitude.toFixed(6)}°
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--md-on-surface-variant)' }}>
                            ⏱️ Čas: {user.lastLocation.timestamp.toLocaleString('cs-CZ')}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--md-on-surface-variant)' }}>
                            🎯 Přesnost: ±{Math.round(user.lastLocation.accuracy)}m
                          </span>
                          <a 
                            href={`https://maps.google.com/maps?q=${user.lastLocation.latitude},${user.lastLocation.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--md-primary)',
                              textDecoration: 'none',
                              marginTop: '4px',
                              display: 'inline-block'
                            }}
                            onMouseOver={(e) => (e.target as HTMLAnchorElement).style.textDecoration = 'underline'}
                            onMouseOut={(e) => (e.target as HTMLAnchorElement).style.textDecoration = 'none'}
                          >
                            🗺️ Zobrazit na mapě
                          </a>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--md-on-surface-variant)', fontStyle: 'italic', marginTop: '4px' }}>
                          ❌ Žádná GPS lokace není uložena
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add User Dialog */}
      {showAddDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div className="md-card" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="md-card-header">
              <h3 className="md-card-title">Přidat nového uživatele</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', margin: '8px 0 0' }}>
                Pole označená <span style={{ color: 'var(--md-error)' }}>*</span> jsou povinná
              </p>
            </div>
            
            <div className="md-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                  Email <span style={{ color: 'var(--md-error)', fontSize: '1rem' }}>*</span>
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    console.log('📧 Email changed to:', e.target.value);
                    setNewUser({...newUser, email: e.target.value});
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: `1px solid ${!newUser.email ? 'var(--md-error)' : 'var(--md-outline)'}`,
                    backgroundColor: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  placeholder="uzivatel@email.com"
                  onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                  onBlur={(e) => e.target.style.borderColor = !newUser.email ? 'var(--md-error)' : 'var(--md-outline)'}
                />
                {!newUser.email && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--md-error)', marginTop: '4px', marginBottom: 0 }}>
                    Email je povinný
                  </p>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                  Jméno <span style={{ color: 'var(--md-error)', fontSize: '1rem' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => {
                    console.log('👤 Display Name changed to:', e.target.value);
                    setNewUser({...newUser, displayName: e.target.value});
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: `1px solid ${!newUser.displayName ? 'var(--md-error)' : 'var(--md-outline)'}`,
                    backgroundColor: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  placeholder="Jan Novák"
                  onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                  onBlur={(e) => e.target.style.borderColor = !newUser.displayName ? 'var(--md-error)' : 'var(--md-outline)'}
                />
                {!newUser.displayName && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--md-error)', marginTop: '4px', marginBottom: 0 }}>
                    Jméno je povinné
                  </p>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>Nick (volitelné)</label>
                <input
                  type="text"
                  value={newUser.nick}
                  onChange={(e) => setNewUser({...newUser, nick: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--md-outline)',
                    backgroundColor: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  placeholder="janik"
                  onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                  Heslo <span style={{ color: 'var(--md-error)', fontSize: '1rem' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newUser.password}
                    onChange={(e) => {
                      console.log('🔐 Password changed, length:', e.target.value.length);
                      setNewUser({...newUser, password: e.target.value});
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 48px 12px 16px',
                      fontSize: '1rem',
                      borderRadius: '12px',
                      border: `1px solid ${!newUser.password ? 'var(--md-error)' : 'var(--md-outline)'}`,
                      backgroundColor: 'var(--md-surface)',
                      color: 'var(--md-on-surface)',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    placeholder="••••••••"
                    onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                    onBlur={(e) => e.target.style.borderColor = !newUser.password ? 'var(--md-error)' : 'var(--md-outline)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--md-on-surface-variant)',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                    title={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                  >
                    {showPassword ? (
                      <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                      </svg>
                    ) : (
                      <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z"/>
                      </svg>
                    )}
                  </button>
                </div>
                {!newUser.password && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--md-error)', marginTop: '4px', marginBottom: 0 }}>
                    Heslo je povinné (minimálně 6 znaků)
                  </p>
                )}
                {newUser.password && newUser.password.length < 6 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--md-error)', marginTop: '4px', marginBottom: 0 }}>
                    Heslo musí mít minimálně 6 znaků
                  </p>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--md-outline)',
                    backgroundColor: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
                >
                  <option value="viewer">Pozorovatel</option>
                  <option value="user">Uživatel</option>
                  <option value="admin">Administrátor</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '12px', fontWeight: 500 }}>Oprávnění</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries({
                    gate: 'Ovládání brány',
                    garage: 'Ovládání garáže',
                    camera: 'Webkamera',
                    stopMode: 'STOP režim',
                    viewLogs: 'Zobrazení logů',
                    manageUsers: 'Správa uživatelů',
                    ...(currentUser?.permissions.manageUsers && {
                      requireLocation: 'Vyžadovat lokaci',
                      allowGPS: 'GPS lokace',
                      requireLocationProximity: 'Omezení vzdáleností'
                    })
                  }).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newUser.permissions[key as keyof typeof newUser.permissions]}
                        onChange={(e) => setNewUser({
                          ...newUser,
                          permissions: {
                            ...newUser.permissions,
                            [key]: e.target.checked
                          }
                        })}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: '2px solid var(--md-outline)',
                          backgroundColor: 'var(--md-surface)',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--md-on-surface)' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    console.log('❌ Cancel button clicked - closing dialog');
                    setShowAddDialog(false);
                    setShowPassword(false);
                    setNewUser({
                      email: '',
                      displayName: '',
                      nick: '',
                      password: '',
                      role: 'user',
                      permissions: {
                        gate: false,
                        garage: false,
                        camera: false,
                        stopMode: false,
                        viewLogs: true,
                        manageUsers: false,
                        requireLocation: false,
                        allowGPS: true,
                        requireLocationProximity: false
                      }
                    });
                  }}
                  className="md-fab md-fab-extended md-ripple"
                  style={{
                    flex: 1,
                    background: 'var(--md-surface-variant)',
                    color: 'var(--md-on-surface-variant)',
                    border: '1px solid var(--md-outline)'
                  }}
                >
                  Zrušit
                </button>
                <button
                  onClick={(e) => {
                    console.log('🖱️🖱️🖱️ BUTTON CLICKED - EVENT FIRED!');
                    console.log('📝 Current newUser state:', JSON.stringify(newUser, null, 2));
                    console.log('📝 Form validation:', {
                      email: !!newUser.email,
                      displayName: !!newUser.displayName,
                      password: !!newUser.password,
                      isDisabled: !newUser.email || !newUser.displayName || !newUser.password,
                      emailValue: newUser.email,
                      displayNameValue: newUser.displayName,
                      passwordValue: newUser.password
                    });
                    console.log('🎯 Event target:', e.target);
                    console.log('🔧 Loading state:', loading);
                    
                    if (!newUser.email || !newUser.displayName || !newUser.password || newUser.password.length < 6) {
                      console.error('❌ FORM VALIDATION FAILED - missing required fields or weak password');
                      if (!newUser.email || !newUser.displayName || !newUser.password) {
                        alert('❌ Vyplň prosím všechna povinná pole (email, jméno, heslo)');
                      } else if (newUser.password.length < 6) {
                        alert('❌ Heslo musí mít minimálně 6 znaků');
                      }
                      return;
                    }
                    
                    console.log('✅ Form validation passed, calling handleAddUser...');
                    handleAddUser();
                  }}
                  disabled={!newUser.email || !newUser.displayName || !newUser.password || newUser.password.length < 6}
                  className="md-fab md-fab-extended md-ripple"
                  style={{
                    flex: 1,
                    background: (!newUser.email || !newUser.displayName || !newUser.password || newUser.password.length < 6) ? '#cccccc' : 'var(--md-primary)',
                    color: (!newUser.email || !newUser.displayName || !newUser.password || newUser.password.length < 6) ? '#666666' : 'var(--md-on-primary)',
                    opacity: (!newUser.email || !newUser.displayName || !newUser.password || newUser.password.length < 6) ? 0.6 : 1,
                    cursor: (!newUser.email || !newUser.displayName || !newUser.password || newUser.password.length < 6) ? 'not-allowed' : 'pointer',
                    border: '2px solid red' // TEMPORARY - to see if button is visible
                  }}
                >
                  {loading ? 'Vytváří se...' : 'Přidat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div className="md-card" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="md-card-header">
              <h3 className="md-card-title">Upravit uživatele</h3>
            </div>
            
            <div className="md-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>Jméno</label>
                <input
                  type="text"
                  value={editingUser.displayName}
                  onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--md-outline)',
                    backgroundColor: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  placeholder="Jan Novák"
                  onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>Nick (volitelné)</label>
                <input
                  type="text"
                  value={editingUser.nick || ''}
                  onChange={(e) => setEditingUser({...editingUser, nick: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--md-outline)',
                    backgroundColor: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  placeholder="janik"
                  onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--md-outline)',
                    backgroundColor: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
                >
                  <option value="viewer">Pozorovatel</option>
                  <option value="user">Uživatel</option>
                  <option value="admin">Administrátor</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '12px', fontWeight: 500 }}>Oprávnění</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries({
                    gate: 'Ovládání brány',
                    garage: 'Ovládání garáže',
                    camera: 'Webkamera',
                    stopMode: 'STOP režim',
                    viewLogs: 'Zobrazení logů',
                    manageUsers: 'Správa uživatelů',
                    ...(currentUser?.permissions.manageUsers && {
                      requireLocation: 'Vyžadovat lokaci',
                      allowGPS: 'GPS lokace',
                      requireLocationProximity: 'Omezení vzdáleností'
                    })
                  }).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editingUser.permissions[key as keyof typeof editingUser.permissions]}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          permissions: {
                            ...editingUser.permissions,
                            [key]: e.target.checked
                          }
                        })}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: '2px solid var(--md-outline)',
                          backgroundColor: 'var(--md-surface)',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--md-on-surface)' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={() => setEditingUser(null)}
                  className="md-fab md-fab-extended md-ripple"
                  style={{
                    flex: 1,
                    background: 'var(--md-surface-variant)',
                    color: 'var(--md-on-surface-variant)',
                    border: '1px solid var(--md-outline)'
                  }}
                >
                  Zrušit
                </button>
                <button
                  onClick={() => handleUpdateUser(editingUser)}
                  disabled={!editingUser.displayName}
                  className="md-fab md-fab-extended md-ripple"
                  style={{
                    flex: 1,
                    background: 'var(--md-primary)',
                    color: 'var(--md-on-primary)',
                    opacity: !editingUser.displayName ? 0.6 : 1
                  }}
                >
                  Uložit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
        `}
      </style>
    </div>
  );
};

export default UserManagement;