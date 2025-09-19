import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { adminService } from '../services/adminService';
import { User } from '../types';
import Dialog from './Dialog';

interface UserApprovalPanelProps {
  onUserActionComplete?: () => Promise<void>;
}

const UserApprovalPanel: React.FC<UserApprovalPanelProps> = ({ onUserActionComplete }) => {
  const { currentUser, getPendingUsers, approveUser, rejectUser } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ [userId: string]: string }>({});
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [loadMethod, setLoadMethod] = useState<string>('');
  const [adminVerified, setAdminVerified] = useState<boolean>(false);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      console.log('🔍 UserApprovalPanel: Loading pending users...');
      
      // Nejprve ověříme admin přístup
      const adminCheck = await adminService.verifyAdminAccess();
      console.log('🔍 UserApprovalPanel: Admin verification result:', adminCheck);
      
      if (!adminCheck.isAdmin) {
        console.error('❌ UserApprovalPanel: Admin verification failed:', adminCheck.error);
        setAdminVerified(false);
        
        if (adminCheck.error?.includes('permission-denied') || adminCheck.error?.includes('Firebase error')) {
          console.log('🚨 UserApprovalPanel: Zkouším fallback metodu načítání...');
          
          // Fallback: použij adminService s vlastními metodami
          const fallbackResult = await adminService.getPendingUsersWithFallback();
          console.log('🔍 UserApprovalPanel: Fallback result:', fallbackResult.method, fallbackResult.users.length);
          
          setPendingUsers(fallbackResult.users);
          setLoadMethod(`Fallback: ${fallbackResult.method}`);
          setAdminVerified(true); // Můžeme pokračovat s fallback
          return;
        }
        
        // Jiná chyba - nelze pokračovat
        setPendingUsers([]);
        setLoadMethod('Failed: Admin verification failed');
        return;
      }
      
      setAdminVerified(true);
      
      // Admin ověřen, zkusíme standardní načítání
      try {
        console.log('✅ UserApprovalPanel: Admin verified, loading via AuthContext...');
        const users = await getPendingUsers();
        console.log('🔍 UserApprovalPanel: AuthContext success:', users.length, users);
        setPendingUsers(users);
        setLoadMethod('Standard: AuthContext');
      } catch (contextError: any) {
        console.warn('⚠️ UserApprovalPanel: AuthContext failed, trying adminService fallback:', contextError);
        
        // Fallback na adminService
        const fallbackResult = await adminService.getPendingUsersWithFallback();
        console.log('🔍 UserApprovalPanel: AdminService fallback result:', fallbackResult.method, fallbackResult.users.length);
        
        setPendingUsers(fallbackResult.users);
        setLoadMethod(`Fallback: ${fallbackResult.method}`);
      }
      
    } catch (error) {
      console.error('❌ UserApprovalPanel: Critical error loading pending users:', error);
      setPendingUsers([]);
      setLoadMethod('Critical Error');
      setAdminVerified(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadPendingUsers();
    }
  }, [currentUser, loadPendingUsers]);

  const handleApprove = async (userId: string) => {
    try {
      setActionLoading(userId);
      await approveUser(userId);
      await loadPendingUsers(); // Refresh list
      
      // Obnovit parent komponentu
      if (onUserActionComplete) {
        await onUserActionComplete();
      }
      
      console.log('✅ User approved successfully');
      
      // Zobrazit úspěšný dialog
      setDialogState({
        isOpen: true,
        type: 'success',
        title: 'Uživatel schválen',
        message: 'Uživatel byl úspěšně schválen a má nyní přístup k aplikaci s výchozími oprávněními.'
      });
    } catch (error) {
      console.error('❌ Error approving user:', error);
      
      // Zobrazit chybový dialog
      setDialogState({
        isOpen: true,
        type: 'error',
        title: 'Chyba pri schvalování',
        message: 'Nepodařilo se schválit uživatele. Zkuste to prosím znovu.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      setActionLoading(userId);
      const reason = rejectReason[userId] || 'Nezadán důvod';
      await rejectUser(userId, reason);
      await loadPendingUsers(); // Refresh list
      setShowRejectDialog(null);
      setRejectReason(prev => ({ ...prev, [userId]: '' }));
      
      // Obnovit parent komponentu
      if (onUserActionComplete) {
        await onUserActionComplete();
      }
      
      console.log('❌ User rejected successfully');
      
      // Zobrazit úspěšný dialog
      setDialogState({
        isOpen: true,
        type: 'success',
        title: 'Uživatel zamítnut',
        message: 'Uživatel byl úspěšně zamítnut a nemá přístup k aplikaci.'
      });
    } catch (error) {
      console.error('❌ Error rejecting user:', error);
      
      // Zobrazit chybový dialog
      setDialogState({
        isOpen: true,
        type: 'error',
        title: 'Chyba při zamítání',
        message: 'Nepodařilo se zamítnout uživatele. Zkuste to prosím znovu.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (currentUser?.role !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="md-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--md-primary)',
          borderTop: '3px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p>Načítám čekající uživatele...</p>
      </div>
    );
  }

  if (pendingUsers.length === 0) {
    return (
      <div className="md-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          background: 'var(--md-success-container)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg style={{ width: '32px', height: '32px', fill: 'var(--md-on-success-container)' }} viewBox="0 0 24 24">
            <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
          </svg>
        </div>
        <h3 style={{ marginBottom: '8px', color: 'var(--md-on-surface)' }}>
          ✅ Žádní čekající uživatelé
        </h3>
        <p style={{ color: 'var(--md-on-surface-variant)', margin: 0 }}>
          Všichni uživatelé jsou schváleni nebo zamítnuti.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="md-card">
        <div className="md-card-header" style={{ padding: '24px 24px 16px' }}>
          <h2 style={{ 
            margin: 0, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            color: 'var(--md-on-surface)'
          }}>
            ⏳ Čekající uživatelé 
            <span style={{
              background: 'var(--md-warning-container)',
              color: 'var(--md-on-warning-container)',
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {pendingUsers.length}
            </span>
          </h2>
          <p style={{ 
            margin: '8px 0 0', 
            color: 'var(--md-on-surface-variant)',
            fontSize: '14px'
          }}>
            Noví uživatelé čekají na váše schválení
          </p>
          
          {/* Debug info */}
          {loadMethod && (
            <div style={{
              marginTop: '8px',
              padding: '6px 10px',
              background: adminVerified ? 'var(--md-success-container)' : 'var(--md-error-container)',
              color: adminVerified ? 'var(--md-on-success-container)' : 'var(--md-on-error-container)',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              🔧 Metoda: {loadMethod} {adminVerified ? '✅' : '❌'}
            </div>
          )}
        </div>

        <div className="md-card-content" style={{ padding: '0 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pendingUsers.map((user) => (
              <div key={user.id} style={{
                border: '1px solid var(--md-outline-variant)',
                borderRadius: '12px',
                padding: '20px',
                background: 'var(--md-surface-variant)'
              }}>
                <div className="approval-user-card">
                  {/* User Avatar */}
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        border: '2px solid var(--md-outline)'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'var(--md-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--md-on-primary)',
                      fontSize: '24px',
                      fontWeight: '600'
                    }}>
                      {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* User Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: '600',
                        color: 'var(--md-on-surface)'
                      }}>
                        {user.displayName}
                      </h3>
                      
                      <div style={{
                        padding: '4px 8px',
                        background: user.authProvider === 'google' ? '#4285F4' : 'var(--md-secondary)',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {user.authProvider === 'google' ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
                            </svg>
                            Google
                          </>
                        ) : (
                          <>📧 Email</>
                        )}
                      </div>
                    </div>

                    <p style={{
                      margin: '0 0 12px',
                      color: 'var(--md-on-surface-variant)',
                      fontSize: '14px'
                    }}>
                      {user.email}
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '8px',
                      fontSize: '12px',
                      color: 'var(--md-on-surface-variant)'
                    }}>
                      <div>
                        <strong>Požádal:</strong><br />
                        {user.requestedAt ? new Date(user.requestedAt).toLocaleDateString('cs-CZ', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: 'numeric'
                        }) : 'Neznámo'}
                      </div>
                      <div>
                        <strong>Role:</strong><br />
                        {user.role}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="approval-action-buttons">
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={actionLoading === user.id}
                      style={{
                        background: actionLoading === user.id ? 'var(--md-surface-variant)' : 'var(--md-success)',
                        color: actionLoading === user.id ? 'var(--md-on-surface-variant)' : 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: '100px',
                        justifyContent: 'center'
                      }}
                    >
                      {actionLoading === user.id ? (
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid currentColor',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      ) : (
                        <>
                          ✅ Schválit
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowRejectDialog(user.id)}
                      disabled={actionLoading === user.id}
                      style={{
                        background: 'var(--md-surface-variant)',
                        color: 'var(--md-error)',
                        border: '1px solid var(--md-error)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                        minWidth: '100px'
                      }}
                    >
                      ❌ Zamítnout
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px'
        }}>
          <div className="md-card" style={{ maxWidth: '400px', width: '100%' }}>
            <div className="md-card-content" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', color: 'var(--md-on-surface)' }}>
                Zamítnout uživatele
              </h3>
              
              <p style={{ margin: '0 0 16px', color: 'var(--md-on-surface-variant)' }}>
                Zadejte důvod zamítnutí (volitelné):
              </p>
              
              <textarea
                value={rejectReason[showRejectDialog] || ''}
                onChange={(e) => setRejectReason(prev => ({
                  ...prev,
                  [showRejectDialog]: e.target.value
                }))}
                placeholder="Např. Neověřená identita, nedostatečné oprávnění..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  border: '1px solid var(--md-outline)',
                  borderRadius: '8px',
                  resize: 'vertical',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}
              />
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowRejectDialog(null);
                    setRejectReason(prev => ({ ...prev, [showRejectDialog]: '' }));
                  }}
                  style={{
                    background: 'var(--md-surface-variant)',
                    color: 'var(--md-on-surface-variant)',
                    border: '1px solid var(--md-outline)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Zrušit
                </button>
                
                <button
                  onClick={() => handleReject(showRejectDialog)}
                  disabled={actionLoading === showRejectDialog}
                  style={{
                    background: 'var(--md-error)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: actionLoading === showRejectDialog ? 'not-allowed' : 'pointer'
                  }}
                >
                  {actionLoading === showRejectDialog ? 'Zamítám...' : 'Zamítnout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog pro zprávy */}
      <Dialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
      />

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .approval-user-card {
            display: flex;
            align-items: flex-start;
            gap: 16px;
          }
          
          .approval-action-buttons {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          @media (max-width: 768px) {
            .approval-user-card {
              flex-direction: column;
              align-items: center;
              text-align: center;
            }
            
            .approval-action-buttons {
              flex-direction: row;
              width: 100%;
              justify-content: center;
              gap: 12px;
            }
            
            .approval-action-buttons button {
              flex: 1;
              max-width: 120px;
            }
          }
        `}
      </style>
    </>
  );
};

export default UserApprovalPanel;