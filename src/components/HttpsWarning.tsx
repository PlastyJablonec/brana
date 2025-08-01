import React from 'react';

const HttpsWarning: React.FC = () => {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  if (!isHttps) {
    return null; // Don't show on HTTP
  }

  const httpUrl = window.location.href.replace('https://', 'http://');
  
  return (
    <div style={{
      background: 'linear-gradient(90deg, #ff9800, #f57c00)',
      color: 'white',
      padding: '12px 16px',
      margin: '16px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
      lineHeight: '1.4'
    }}>
      <div style={{ fontSize: '24px' }}>⚠️</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
          Omezená funkcionalita na HTTPS
        </div>
        <div style={{ opacity: 0.9 }}>
          MQTT ovládání a kamera nejsou dostupné kvůli bezpečnostním omezením.
          <br />
          Pro plnou funkcionalnost použijte HTTP verzi.
        </div>
      </div>
      <a
        href={httpUrl}
        style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          textDecoration: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          fontWeight: 500,
          border: '1px solid rgba(255,255,255,0.3)',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.3)';
        }}
        onMouseOut={(e) => {
          (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.2)';
        }}
      >
        🔓 Přejít na HTTP
      </a>
    </div>
  );
};

export default HttpsWarning;