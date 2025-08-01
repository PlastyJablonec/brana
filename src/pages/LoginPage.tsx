import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase/config';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  // Test Firebase connection on component mount
  useEffect(() => {
    console.log('=== FIREBASE DEBUG INFO ===');
    console.log('Auth instance:', auth);
    console.log('Firebase config:', {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY?.substring(0, 10) + '...',
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
    });
    
    // Test Firebase connection
    auth.onAuthStateChanged((user) => {
      console.log('Firebase auth state changed:', user ? `User: ${user.email}` : 'No user');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Vyplňte všechna pole');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('=== LOGIN ATTEMPT ===');
      console.log('Email:', email);  
      console.log('Password length:', password.length);
      
      await login(email, password);
      console.log('Login function completed successfully');
      
    } catch (error: any) {
      console.error('=== LOGIN ERROR ===');
      console.error('Error object:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Detailnější error handling
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/invalid-email':
          setError('Nesprávný email nebo heslo. Zkontrolujte své údaje.');
          break;
        case 'auth/user-not-found':
          setError('Uživatel s tímto emailem neexistuje.');
          break;
        case 'auth/wrong-password':
          setError('Nesprávné heslo. Zkuste to znovu.');
          break;
        case 'auth/too-many-requests':
          setError('Příliš mnoho neúspěšných pokusů. Zkuste to za chvíli.');
          break;
        case 'auth/network-request-failed':
          setError('Problém se sítí. Zkontrolujte internetové připojení.');
          break;
        case 'auth/user-disabled':
          setError('Váš účet byl deaktivován. Kontaktujte administrátora.');
          break;
        case 'auth/invalid-api-key':
        case 'auth/app-not-authorized':
          setError('Chyba konfigurace aplikace. Kontaktujte administrátora.');
          break;
        default:
          setError(`Chyba při přihlášení: ${error.message || 'Neznámá chyba'}. Zkuste to znovu.`);
          console.error('Unhandled auth error:', error);
          break;
      }
    } finally {
      setLoading(false);
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
      {/* Material Design 3 Animated Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, var(--md-primary-container) 0%, var(--md-secondary-container) 50%, var(--md-tertiary-container) 100%)',
        opacity: 0.1
      }}></div>
      
      {/* Floating Geometric Shapes - 2025 Style */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '15%',
        width: '200px',
        height: '200px',
        background: 'linear-gradient(45deg, var(--md-primary), var(--md-tertiary))',
        borderRadius: '50% 40% 60% 30%',
        opacity: 0.1,
        animation: 'float 6s ease-in-out infinite',
        transform: 'rotate(0deg)'
      }}></div>
      
      <div style={{
        position: 'absolute',
        bottom: '20%',
        left: '10%',
        width: '150px',
        height: '150px',
        background: 'linear-gradient(135deg, var(--md-secondary), var(--md-error))',
        borderRadius: '30% 60% 40% 70%',
        opacity: 0.08,
        animation: 'float 8s ease-in-out infinite reverse',
        animationDelay: '2s'
      }}></div>

      <div className="md-card md-card-elevated" style={{ 
        maxWidth: '420px', 
        width: '100%', 
        zIndex: 10, 
        position: 'relative',
        padding: '0',
        overflow: 'hidden'
      }}>
        {/* Modern Header Section */}
        <div style={{
          textAlign: 'center',
          padding: '48px 32px 32px',
          background: 'linear-gradient(135deg, var(--md-primary) 0%, var(--md-tertiary) 100%)',
          color: 'var(--md-on-primary)',
          position: 'relative'
        }}>
          {/* App Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.3)'
          }}>
            <svg style={{ width: '40px', height: '40px', fill: 'white' }} viewBox="0 0 24 24">
              <path d="M12,3L2,12H5V20H19V12H22L12,3M12,8.75A1.25,1.25 0 0,1 13.25,10A1.25,1.25 0 0,1 12,11.25A1.25,1.25 0 0,1 10.75,10A1.25,1.25 0 0,1 12,8.75M12,6.5A3.5,3.5 0 0,0 8.5,10A3.5,3.5 0 0,0 12,13.5A3.5,3.5 0 0,0 15.5,10A3.5,3.5 0 0,0 12,6.5Z"/>
            </svg>
          </div>
          
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            marginBottom: '8px',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            🏠 Ovládání Brány
          </h1>
          <p style={{
            fontSize: '16px',
            opacity: 0.9,
            fontWeight: '400'
          }}>
            Zabezpečený přístup do systému
          </p>
          
          {/* Decorative Wave */}
          <div style={{
            position: 'absolute',
            bottom: '-2px',
            left: 0,
            width: '100%',
            height: '24px',
            background: 'var(--md-surface)',
            borderRadius: '24px 24px 0 0'
          }}></div>
        </div>
        
        {/* Form Section */}
        <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--md-on-surface)',
                marginBottom: '8px'
              }}>
                📧 Emailová adresa
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="vas@email.cz"
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    fontSize: '16px',
                    borderRadius: '12px',
                    border: `2px solid ${email ? 'var(--md-primary)' : 'var(--md-outline)'}`,
                    backgroundColor: 'var(--md-surface-variant)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--md-primary)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(103, 80, 164, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = email ? 'var(--md-primary)' : 'var(--md-outline)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {/* Focus indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '2px',
                  width: email ? '100%' : '0%',
                  background: 'var(--md-primary)',
                  transition: 'width 0.3s ease',
                  borderRadius: '1px'
                }}></div>
              </div>
            </div>
            
            {/* Password Field */}
            <div>
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--md-on-surface)',
                marginBottom: '8px'
              }}>
                🔒 Heslo
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '16px 50px 16px 20px',
                    fontSize: '16px',
                    borderRadius: '12px',
                    border: `2px solid ${password ? 'var(--md-primary)' : 'var(--md-outline)'}`,
                    backgroundColor: 'var(--md-surface-variant)',
                    color: 'var(--md-on-surface)',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--md-primary)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(103, 80, 164, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = password ? 'var(--md-primary)' : 'var(--md-outline)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                
                {/* Password visibility toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--md-on-surface-variant)',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--md-surface-variant)';
                    e.currentTarget.style.color = 'var(--md-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--md-on-surface-variant)';
                  }}
                >
                  {showPassword ? (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                
                {/* Focus indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '2px',
                  width: password ? '100%' : '0%',
                  background: 'var(--md-primary)',
                  transition: 'width 0.3s ease',
                  borderRadius: '1px'
                }}></div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: 'var(--md-error-container)',
              color: 'var(--md-on-error-container)',
              borderRadius: '12px',
              border: '1px solid var(--md-error)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <svg style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                {error}
              </div>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="md-fab md-fab-extended md-ripple"
            style={{
              width: '100%',
              marginTop: '24px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              background: loading ? 'var(--md-surface-variant)' : 'var(--md-primary)',
              color: loading ? 'var(--md-on-surface-variant)' : 'var(--md-on-primary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid currentColor',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '12px'
                }}></div>
                Přihlašování...
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Přihlásit se
              </div>
            )}
          </button>
        </form>
        
        {/* Footer Info */}
        <div style={{ padding: '24px 32px', textAlign: 'center' }}>
          <div style={{
            background: 'var(--md-surface-variant)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid var(--md-outline-variant)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <svg style={{ width: '16px', height: '16px', color: 'var(--md-primary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--md-on-surface)'
              }}>
                Zabezpečený přístup
              </span>
            </div>
            <p style={{
              fontSize: '13px',
              color: 'var(--md-on-surface-variant)',
              margin: 0,
              lineHeight: '1.4'
            }}>
              Přihlaste se pomocí účtu vytvořeného administrátorem
            </p>
          </div>
        </div>
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .md-card {
          animation: fadeIn 0.6s ease-out;
        }
        
        /* Focus ring improvements */
        input:focus {
          outline: none !important;
        }
        
        /* Ripple effect for button */
        .md-fab:hover {
          transform: translateY(-2px);
          box-shadow: var(--md-elevation-3-shadow);
        }
        
        .md-fab:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default LoginPage;