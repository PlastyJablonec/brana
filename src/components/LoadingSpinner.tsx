import React from 'react';
import { ILoadingSpinnerProps } from '../types';

const LoadingSpinner: React.FC<ILoadingSpinnerProps> = ({ 
  size = 'medium', 
  message = 'Načítám...' 
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { width: '20px', height: '20px', borderWidth: '2px' };
      case 'large':
        return { width: '48px', height: '48px', borderWidth: '3px' };
      default:
        return { width: '32px', height: '32px', borderWidth: '2px' };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--md-surface)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px'
    }}>
      <div 
        style={{
          ...sizeStyles,
          borderRadius: '50%',
          border: `${sizeStyles.borderWidth} solid var(--md-outline-variant)`,
          borderTop: `${sizeStyles.borderWidth} solid var(--md-primary)`,
          animation: 'spin 1s linear infinite'
        }}
      />
      {message && (
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: 'var(--md-on-surface-variant)',
          textAlign: 'center'
        }}>
          {message}
        </p>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;