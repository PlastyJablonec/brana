import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CameraView from '../CameraView';
import ThemeToggle from '../ThemeToggle';
import { User, ICoordinates } from '../../types';

interface IDashboardPresentationProps {
  // User data
  currentUser: User | null;
  onLogout: () => Promise<void>;
  
  // MQTT data
  gateStatus: string;
  garageStatus: string;
  mqttConnected: boolean;
  
  // Location data
  locationPermission: boolean | null;
  locationError?: string;
  currentLocation?: ICoordinates | null;
  
  // Loading and error states
  isLoading: boolean;
  error: Error | null;
  
  // Command handlers
  onGateCommand: () => Promise<void>;
  onGarageCommand: () => Promise<void>;
  onStopCommand: () => Promise<void>;
  
  // Command states
  isGateCommandPending: boolean;
  isGarageCommandPending: boolean;
  isStopCommandPending: boolean;
}

export const DashboardPresentation: React.FC<IDashboardPresentationProps> = ({
  currentUser,
  onLogout,
  gateStatus,
  garageStatus,
  mqttConnected,
  locationPermission,
  locationError,
  currentLocation,
  isLoading,
  error,
  onGateCommand,
  onGarageCommand,
  onStopCommand,
  isGateCommandPending,
  isGarageCommandPending,
  isStopCommandPending,
}) => {
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Determine if commands should be enabled
  const canExecuteCommands = mqttConnected && !isLoading && currentUser;
  const hasLocationIssue = locationError || locationPermission === false;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--md-primary-container) 0%, var(--md-surface-container) 100%)',
      padding: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        background: 'var(--md-surface)',
        padding: '16px 20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--md-on-surface)'
          }}>
            🏠 Ovládání Brány
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '14px',
            color: 'var(--md-on-surface-variant)'
          }}>
            Vítejte, {currentUser?.displayName || 'Uživatel'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <ThemeToggle />
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            style={{
              background: 'var(--md-secondary-container)',
              color: 'var(--md-on-secondary-container)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ⚙️ Menu
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'var(--md-error-container)',
          color: 'var(--md-on-error-container)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <strong>⚠️ Chyba:</strong> {error.message}
        </div>
      )}

      {/* Connection Status */}
      <div style={{
        background: 'var(--md-surface)',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: mqttConnected ? 'var(--md-success)' : 'var(--md-error)',
            animation: mqttConnected ? 'pulse 2s infinite' : 'none'
          }}></div>
          <span style={{
            fontSize: '14px',
            color: 'var(--md-on-surface)',
            fontWeight: 500
          }}>
            MQTT: {mqttConnected ? 'Připojeno' : 'Odpojeno'}
          </span>
        </div>

        {hasLocationIssue && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: 'var(--md-error-container)',
            color: 'var(--md-on-error-container)',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            📍 {locationError || 'Poloha není dostupná'}
          </div>
        )}
      </div>

      {/* Admin Panel */}
      {showAdminPanel && (
        <div style={{
          background: 'var(--md-surface)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            color: 'var(--md-on-surface)'
          }}>
            ⚙️ Administrace
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              to="/users"
              style={{
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}
            >
              👥 Uživatelé
            </Link>
            <Link
              to="/logs"
              style={{
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}
            >
              📋 Logy
            </Link>
            <Link
              to="/settings"
              style={{
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}
            >
              ⚙️ Nastavení
            </Link>
            <button
              onClick={onLogout}
              style={{
                background: 'var(--md-error)',
                color: 'var(--md-on-error)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🚪 Odhlásit
            </button>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px',
        marginBottom: '80px' // Space for footer
      }}>
        {/* Gate Control */}
        <div style={{
          background: 'var(--md-surface)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            color: 'var(--md-on-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🚪 Brána
          </h2>
          
          <div style={{
            background: 'var(--md-surface-container)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--md-on-surface)'
            }}>
              {gateStatus}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onGateCommand}
              disabled={!canExecuteCommands || isGateCommandPending}
              style={{
                flex: 1,
                background: canExecuteCommands ? 'var(--md-primary)' : 'var(--md-surface-variant)',
                color: canExecuteCommands ? 'var(--md-on-primary)' : 'var(--md-on-surface-variant)',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                cursor: canExecuteCommands ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 500,
                opacity: isGateCommandPending ? 0.7 : 1
              }}
            >
              {isGateCommandPending ? '⏳ Odesílá...' : '🔄 Ovládat'}
            </button>
            
            <button
              onClick={onStopCommand}
              disabled={!canExecuteCommands || isStopCommandPending}
              style={{
                background: canExecuteCommands ? 'var(--md-error)' : 'var(--md-surface-variant)',
                color: canExecuteCommands ? 'var(--md-on-error)' : 'var(--md-on-surface-variant)',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: canExecuteCommands ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 500,
                opacity: isStopCommandPending ? 0.7 : 1
              }}
            >
              {isStopCommandPending ? '⏳' : '🛑'}
            </button>
          </div>
        </div>

        {/* Garage Control */}
        <div style={{
          background: 'var(--md-surface)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            color: 'var(--md-on-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🏠 Garáž
          </h2>
          
          <div style={{
            background: 'var(--md-surface-container)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--md-on-surface)'
            }}>
              {garageStatus}
            </div>
          </div>

          <button
            onClick={onGarageCommand}
            disabled={!canExecuteCommands || isGarageCommandPending}
            style={{
              width: '100%',
              background: canExecuteCommands ? 'var(--md-primary)' : 'var(--md-surface-variant)',
              color: canExecuteCommands ? 'var(--md-on-primary)' : 'var(--md-on-surface-variant)',
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              cursor: canExecuteCommands ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 500,
              opacity: isGarageCommandPending ? 0.7 : 1
            }}
          >
            {isGarageCommandPending ? '⏳ Odesílá...' : '🔄 Ovládat'}
          </button>
        </div>

        {/* Camera View */}
        <div style={{
          background: 'var(--md-surface)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          gridColumn: 'span 2'
        }}>
          <h2 style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            color: 'var(--md-on-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📹 Kamera
          </h2>
          <CameraView />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};