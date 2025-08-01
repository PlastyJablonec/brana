import React, { Component, ErrorInfo, ReactNode } from 'react';

interface IMqttErrorBoundaryProps {
  children: ReactNode;
  onMqttError?: (error: Error) => void;
}

interface IMqttErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  isRetrying: boolean;
}

class MqttErrorBoundary extends Component<IMqttErrorBoundaryProps, IMqttErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: IMqttErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      isRetrying: false 
    };
  }

  static getDerivedStateFromError(error: Error): IMqttErrorBoundaryState {
    // Check if it's an MQTT-related error
    const isMqttError = error.message.includes('MQTT') || 
                       error.message.includes('WebSocket') ||
                       error.message.includes('connection');
    
    if (isMqttError) {
      return { hasError: true, error, isRetrying: false };
    }

    // Re-throw non-MQTT errors to be handled by parent error boundary
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 MqttErrorBoundary caught MQTT error:', error, errorInfo);
    
    // Call optional MQTT error handler
    if (this.props.onMqttError) {
      this.props.onMqttError(error);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private handleRetry = (): void => {
    this.setState({ isRetrying: true });
    
    // Auto-retry after 3 seconds
    this.retryTimeout = setTimeout(() => {
      this.setState({ hasError: false, error: undefined, isRetrying: false });
    }, 3000);
  };

  private handleManualRetry = (): void => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    this.setState({ hasError: false, error: undefined, isRetrying: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isMqttConnectionError = this.state.error?.message.includes('not connected') ||
                                   this.state.error?.message.includes('WebSocket');

      return (
        <div style={{
          padding: '24px',
          background: 'var(--md-error-container)',
          color: 'var(--md-on-error-container)',
          borderRadius: '12px',
          margin: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>
            {isMqttConnectionError ? '📡' : '⚠️'}
          </div>
          
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: 500
          }}>
            {isMqttConnectionError ? 'Problém s připojením' : 'MQTT chyba'}
          </h3>
          
          <p style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            opacity: 0.8
          }}>
            {isMqttConnectionError 
              ? 'Nepodařilo se připojit k MQTT serveru. Zkontrolujte internetové připojení.'
              : 'Došlo k chybě v komunikaci s bránou.'
            }
          </p>

          {this.state.isRetrying ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--md-on-error-container)',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Znovu připojuji...
              <button
                onClick={this.handleManualRetry}
                style={{
                  background: 'transparent',
                  color: 'var(--md-on-error-container)',
                  border: '1px solid var(--md-on-error-container)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginLeft: '8px'
                }}
              >
                Zrušit
              </button>
            </div>
          ) : (
            <button
              onClick={this.handleRetry}
              style={{
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              🔄 Zkusit znovu
            </button>
          )}

          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MqttErrorBoundary;