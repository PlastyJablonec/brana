import React from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
}

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Zrušit',
  onConfirm,
  showCancel = false
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✅',
          iconColor: 'var(--md-success)',
          headerColor: 'var(--md-success)'
        };
      case 'error':
        return {
          icon: '❌',
          iconColor: 'var(--md-error)',
          headerColor: 'var(--md-error)'
        };
      case 'warning':
        return {
          icon: '⚠️',
          iconColor: 'var(--md-warning)',
          headerColor: 'var(--md-warning)'
        };
      default:
        return {
          icon: 'ℹ️',
          iconColor: 'var(--md-primary)',
          headerColor: 'var(--md-primary)'
        };
    }
  };

  const typeStyles = getTypeStyles();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
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
      <div className="md-card" style={{ 
        maxWidth: '480px', 
        width: '100%',
        background: 'var(--md-surface)',
        borderRadius: '16px',
        boxShadow: 'var(--md-elevation-3-shadow)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid var(--md-outline-variant)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            fontSize: '24px',
            color: typeStyles.iconColor
          }}>
            {typeStyles.icon}
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: typeStyles.headerColor
          }}>
            {title}
          </h3>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{
            margin: 0,
            fontSize: '16px',
            lineHeight: '1.5',
            color: 'var(--md-on-surface)',
            whiteSpace: 'pre-wrap'
          }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 24px 24px',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          {showCancel && (
            <button
              onClick={onClose}
              style={{
                background: 'var(--md-surface-variant)',
                color: 'var(--md-on-surface-variant)',
                border: '1px solid var(--md-outline)',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--md-secondary-container)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'var(--md-surface-variant)';
              }}
            >
              {cancelText}
            </button>
          )}
          
          <button
            onClick={handleConfirm}
            style={{
              background: typeStyles.headerColor,
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dialog;