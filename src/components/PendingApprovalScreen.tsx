import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

interface PendingApprovalScreenProps {
  user: User;
}

const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ user }) => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'var(--md-surface-container)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, var(--md-warning-container) 0%, var(--md-secondary-container) 100%)',
        opacity: 0.1
      }}></div>
      
      {/* Floating shapes */}
      <div style={{
        position: 'absolute',
        top: '15%',
        right: '10%',
        width: '120px',
        height: '120px',
        background: 'linear-gradient(45deg, var(--md-warning), var(--md-secondary))',
        borderRadius: '50% 40% 60% 30%',
        opacity: 0.1,
        animation: 'float 4s ease-in-out infinite'
      }}></div>

      <div className="md-card md-card-elevated" style={{ 
        maxWidth: '480px', 
        width: '100%', 
        zIndex: 10,
        textAlign: 'center'
      }}>
        <div className="md-card-content" style={{ padding: '48px 32px' }}>
          {/* Waiting Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 32px',
            background: 'var(--md-warning-container)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <svg style={{ width: '48px', height: '48px', fill: 'var(--md-on-warning-container)' }} viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,6A1.5,1.5 0 0,1 13.5,7.5A1.5,1.5 0 0,1 12,9A1.5,1.5 0 0,1 10.5,7.5A1.5,1.5 0 0,1 12,6M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
            </svg>
            
            {/* Animated pulse ring */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '3px solid var(--md-warning)',
              animation: 'pulse 2s ease-in-out infinite'
            }}></div>
          </div>

          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '16px',
            color: 'var(--md-on-surface)'
          }}>
            ⏳ Čekám na schválení
          </h1>

          <p style={{
            fontSize: '16px',
            color: 'var(--md-on-surface-variant)',
            marginBottom: '32px',
            lineHeight: '1.6'
          }}>
            Váš účet byl úspěšně vytvořen a čeká na schválení administrátorem.
            Budete informováni emailem, jakmile bude váš přístup povolen.
          </p>

          {/* User info card */}
          <div style={{
            background: 'var(--md-surface-variant)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px',
            border: '1px solid var(--md-outline-variant)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profil"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    border: '2px solid var(--md-outline)'
                  }}
                />
              ) : (
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--md-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--md-on-primary)',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'var(--md-on-surface)',
                  marginBottom: '4px'
                }}>
                  {user.displayName}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--md-on-surface-variant)'
                }}>
                  {user.email}
                </div>
              </div>
              
              <div style={{
                padding: '4px 12px',
                background: 'var(--md-warning-container)',
                color: 'var(--md-on-warning-container)', 
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                Čeká na schválení
              </div>
            </div>
          </div>

          {/* Status timeline */}
          <div style={{
            background: 'var(--md-surface-variant)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px',
              color: 'var(--md-on-surface)'
            }}>
              📋 Stav registrace
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--md-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg style={{ width: '14px', height: '14px', fill: 'white' }} viewBox="0 0 24 24">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--md-on-surface)' }}>
                    Účet vytvořen
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>
                    {user.requestedAt ? new Date(user.requestedAt).toLocaleDateString('cs-CZ') : 'Dnes'}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--md-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 2s ease-in-out infinite'
                }}>
                  <svg style={{ width: '14px', height: '14px', fill: 'white' }} viewBox="0 0 24 24">
                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,14H13V16H11V14M11,6H13V12H11V6Z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--md-on-surface)' }}>
                    Čeká na schválení administrátorem
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>
                    Budete informováni emailem
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.5 }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid var(--md-outline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg style={{ width: '14px', height: '14px', fill: 'var(--md-on-surface-variant)' }} viewBox="0 0 24 24">
                    <path d="M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2Z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--md-on-surface-variant)' }}>
                    Přístup povolen
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>
                    Čeká na schválení
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              className="md-ripple"
              style={{
                padding: '12px 24px',
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🔄 Obnovit stránku
            </button>
            
            <button
              onClick={handleLogout}
              className="md-ripple"
              style={{
                padding: '12px 24px',
                background: 'var(--md-surface-variant)',
                color: 'var(--md-on-surface-variant)',
                border: '1px solid var(--md-outline)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🚪 Odhlásit se
            </button>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(3deg); }
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
        `}
      </style>
    </div>
  );
};

export default PendingApprovalScreen;