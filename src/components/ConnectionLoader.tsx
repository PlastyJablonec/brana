import React from 'react';

interface ConnectionStep {
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  description?: string;
}

interface ConnectionLoaderProps {
  steps: ConnectionStep[];
  isVisible: boolean;
}

const ConnectionLoader: React.FC<ConnectionLoaderProps> = ({ steps, isVisible }) => {
  if (!isVisible) return null;

  const getStepIcon = (status: ConnectionStep['status']) => {
    switch (status) {
      case 'pending':
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: '2px solid var(--md-outline)',
            background: 'var(--md-surface-variant)'
          }} />
        );
      case 'loading':
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: '3px solid var(--md-primary)',
            borderTop: '3px solid transparent',
            animation: 'spin 1s linear infinite'
          }} />
        );
      case 'success':
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--md-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg style={{ width: '16px', height: '16px', fill: 'white' }} viewBox="0 0 24 24">
              <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
          </div>
        );
      case 'error':
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--md-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg style={{ width: '16px', height: '16px', fill: 'white' }} viewBox="0 0 24 24">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </div>
        );
    }
  };

  const getStepColor = (status: ConnectionStep['status']) => {
    switch (status) {
      case 'pending':
        return 'var(--md-on-surface-variant)';
      case 'loading':
        return 'var(--md-primary)';
      case 'success':
        return 'var(--md-success)';
      case 'error':
        return 'var(--md-error)';
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes pulse-connection {
            0%, 100% { 
              transform: scale(1);
              opacity: 1;
            }
            50% { 
              transform: scale(1.05);
              opacity: 0.8;
            }
          }

          .connection-loader {
            animation: fadeInUp 0.5s ease-out;
          }

          .connection-step {
            animation: fadeInUp 0.3s ease-out;
          }

          .connection-step.loading {
            animation: pulse-connection 2s ease-in-out infinite;
          }
        `}
      </style>
      
      {/* Full screen overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div className="connection-loader md-card md-card-elevated" style={{
          maxWidth: '400px',
          width: '90%',
          margin: '20px',
          background: 'var(--md-surface)',
          borderRadius: '20px',
          boxShadow: 'var(--md-elevation-5-shadow)'
        }}>
          <div className="md-card-content" style={{ padding: '32px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                margin: '0 auto 16px',
                background: 'var(--md-primary)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse-connection 2s ease-in-out infinite'
              }}>
                <svg style={{ width: '32px', height: '32px', fill: 'white' }} viewBox="0 0 24 24">
                  <path d="M12,2C17.52,2 22,6.48 22,12C22,17.52 17.52,22 12,22C6.48,22 2,17.52 2,12C2,6.48 6.48,2 12,2M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,6A6,6 0 0,1 18,12C18,14.21 16.94,16.19 15.28,17.29L13.86,15.87C14.56,15.19 15,14.23 15,13.17C15,11.5 13.67,10.17 12,10.17C10.33,10.17 9,11.5 9,13.17C9,14.23 9.44,15.19 10.14,15.87L8.72,17.29C7.06,16.19 6,14.21 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,1 16,12C16,13.25 15.44,14.37 14.57,15.1L13.15,13.68C13.64,13.25 14,12.68 14,12C14,11.17 13.33,10.5 12.5,10.5C11.67,10.5 11,11.17 11,12C11,12.68 11.36,13.25 11.85,13.68L10.43,15.1C9.56,14.37 9,13.25 9,12A3,3 0 0,1 12,9M12,11A1,1 0 0,1 13,12A1,1 0 0,1 12,13A1,1 0 0,1 11,12A1,1 0 0,1 12,11Z"/>
                </svg>
              </div>
              <h2 className="md-card-title" style={{ 
                fontSize: '1.5rem', 
                margin: '0 0 8px 0',
                color: 'var(--md-on-surface)'
              }}>
                Připojuji se k systému
              </h2>
              <p style={{ 
                margin: 0, 
                color: 'var(--md-on-surface-variant)',
                fontSize: '0.875rem'
              }}>
                Chvíli strpení, načítáme data...
              </p>
            </div>

            {/* Connection Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {steps.map((step, index) => (
                <div 
                  key={index}
                  className={`connection-step ${step.status}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: step.status === 'loading' ? 'var(--md-primary-container)' : 'transparent',
                    border: step.status === 'loading' ? '1px solid var(--md-primary)' : '1px solid transparent',
                    transition: 'all 0.3s ease',
                    minHeight: '40px'
                  }}
                >
                  {getStepIcon(step.status)}
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: getStepColor(step.status),
                      lineHeight: '1.2',
                      marginBottom: step.description ? '2px' : 0
                    }}>
                      {step.label}
                    </div>
                    {step.description && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--md-on-surface-variant)',
                        opacity: 0.8,
                        lineHeight: '1.2',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {step.description}
                      </div>
                    )}
                  </div>

                  {/* Progress indicator for current loading step */}
                  {step.status === 'loading' && (
                    <div style={{
                      width: '4px',
                      height: '24px',
                      background: 'var(--md-primary)',
                      borderRadius: '2px',
                      animation: 'pulse-connection 1.5s ease-in-out infinite'
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: '24px' }}>
              <div style={{
                width: '100%',
                height: '4px',
                background: 'var(--md-surface-variant)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  background: 'var(--md-primary)',
                  borderRadius: '2px',
                  width: `${(steps.filter(s => s.status === 'success').length / steps.length) * 100}%`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
              
              <div style={{
                marginTop: '8px',
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'var(--md-on-surface-variant)'
              }}>
                {steps.filter(s => s.status === 'success').length} z {steps.length} dokončeno
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConnectionLoader;