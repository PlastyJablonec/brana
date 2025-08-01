import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase/config';
import DebugPanel from '../components/DebugPanel';

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
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <DebugPanel />
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div style={{ maxWidth: '28rem', width: '100%', zIndex: 10, position: 'relative' }}>
        {/* Logo and title */}
        <div className="text-center mb-12">
          <div className="mx-auto mb-8 relative">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 8v14h20V8L12 2zm8 18H4V9.5l8-5.33L20 9.5V20zm-2-8v6h-2v-6h2zm-4 0v6h-2v-6h2zm-4 0v6H8v-6h2z"/>
              </svg>
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent mb-3">
            Ovládání Brány
          </h1>
          <p className="text-slate-400 text-lg">
            Moderní systém pro správu přístupu
          </p>
        </div>
        
        <form className="card-glass space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-200 mb-3">
                Emailová adresa
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(''); // Clear error when user types
                  }}
                  className="input"
                  placeholder="vas@email.cz"
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    fontSize: '16px',
                    transition: 'all 0.3s ease',
                    width: '100%',
                    color: 'white'
                  }}
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 opacity-0 transition-opacity duration-300 pointer-events-none" 
                     style={{display: email ? 'block' : 'none', opacity: email ? 0.5 : 0}}></div>
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-200 mb-3">
                Heslo
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(''); // Clear error when user types
                  }}
                  className="input"
                  placeholder="••••••••"
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 50px 16px 20px',
                    fontSize: '16px',
                    transition: 'all 0.3s ease',
                    width: '100%',
                    color: 'white'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  style={{ padding: '8px' }}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 opacity-0 transition-opacity duration-300 pointer-events-none"
                     style={{display: password ? 'block' : 'none', opacity: password ? 0.5 : 0}}></div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              backdropFilter: 'blur(10px)'
            }}>
              <div className="text-sm text-red-300 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden"
            style={{
              background: loading ? 'rgba(59, 130, 246, 0.5)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #0ea5e9 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 24px',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              transform: loading ? 'none' : 'translateY(0)',
              boxShadow: loading ? 'none' : '0 10px 20px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 20px rgba(59, 130, 246, 0.3)';
              }
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                Přihlašování...
              </div>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Přihlásit se
              </span>
            )}
          </button>
        </form>
        
        <div className="text-center mt-8 space-y-3">
          <p className="text-sm text-slate-400">
            Přihlaste se pomocí svých Firebase údajů
          </p>
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            padding: '12px 16px',
            border: '1px solid rgba(148, 163, 184, 0.1)'
          }}>
            <p className="text-xs text-slate-300">
              💡 Potřebujete účet vytvořený administrátorem v Firebase
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;