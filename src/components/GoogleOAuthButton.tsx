import React, { useState } from 'react';

interface GoogleOAuthButtonProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  onClick: () => Promise<void>;
  disabled?: boolean;
}

const GoogleOAuthButton: React.FC<GoogleOAuthButtonProps> = ({ 
  onSuccess, 
  onError, 
  onClick, 
  disabled = false 
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;
    
    setLoading(true);
    try {
      await onClick();
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google přihlášení selhalo';
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        padding: '12px 16px',
        border: '2px solid var(--md-outline)',
        borderRadius: '12px',
        background: 'var(--md-surface)',
        color: 'var(--md-on-surface)',
        fontSize: '1rem',
        fontWeight: '500',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        transition: 'all 0.2s ease',
        opacity: disabled || loading ? 0.6 : 1,
        marginBottom: '16px'
      }}
      className="md-ripple"
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.borderColor = 'var(--md-primary)';
          e.currentTarget.style.backgroundColor = 'var(--md-primary-container)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.borderColor = 'var(--md-outline)';
          e.currentTarget.style.backgroundColor = 'var(--md-surface)';
        }
      }}
    >
      {loading ? (
        <>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid var(--md-primary)',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Přihlašuji...
        </>
      ) : (
        <>
          {/* Google Icon SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Pokračovat s Google
        </>
      )}
      
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </button>
  );
};

export default GoogleOAuthButton;