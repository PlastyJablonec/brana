import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="btn-icon"
      style={{
        background: 'var(--md-surface)',
        border: '1px solid var(--md-outline)',
        borderRadius: 'var(--radius-xl)',
        color: 'var(--md-on-surface)',
        boxShadow: 'var(--md-elevation-1-shadow)',
        transition: 'all 0.2s ease',
        width: 'auto',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
      title={`Přepnout na ${theme === 'light' ? 'tmavý' : 'světlý'} režim`}
    >
      {theme === 'light' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      )}
      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
        {theme === 'light' ? 'Tmavý' : 'Světlý'}
      </span>
    </button>
  );
};

export default ThemeToggle;