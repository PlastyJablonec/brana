import React from 'react';

const AppFooter: React.FC = () => {
  // Use build-time values, not runtime values
  const buildTime = process.env.REACT_APP_BUILD_TIME || '2025-02-08T09:00:00.000Z';
  const version = process.env.REACT_APP_VERSION || '2.1.0';
  const commitHash = process.env.REACT_APP_COMMIT_HASH || 'dev';

  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--md-surface-container)',
      borderTop: '1px solid var(--md-outline-variant)',
      padding: '8px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '12px',
      color: 'var(--md-on-surface-variant)',
      zIndex: 100,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--md-success)',
            animation: 'pulse 2s infinite'
          }}></div>
          <span>🏠 Ovládání Brány v{version}</span>
        </div>
        
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          Build: {new Date(buildTime).toLocaleString('cs-CZ')}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
        <span>Commit: {commitHash.substring(0, 7)}</span>
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </footer>
  );
};

export default AppFooter;