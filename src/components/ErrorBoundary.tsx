import React, { Component, ErrorInfo, ReactNode } from 'react';

interface IErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface IErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'var(--md-error-container)',
          color: 'var(--md-on-error-container)',
          borderRadius: '12px',
          margin: '16px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            ⚠️
          </div>
          <h2 style={{
            margin: '0 0 16px 0',
            color: 'var(--md-on-error-container)',
            fontSize: '20px',
            fontWeight: 500
          }}>
            Něco se pokazilo
          </h2>
          <p style={{
            margin: '0 0 24px 0',
            color: 'var(--md-on-error-container)',
            opacity: 0.8,
            fontSize: '14px'
          }}>
            Aplikace narazila na neočekávanou chybu. Zkuste to znovu nebo kontaktujte správce.
          </p>
          {this.state.error && (
            <details style={{
              marginBottom: '24px',
              textAlign: 'left',
              background: 'rgba(0,0,0,0.1)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
                Technické detaily
              </summary>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {this.state.error.name}: {this.state.error.message}
                {this.state.error.stack && `\n\nStack trace:\n${this.state.error.stack}`}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              background: 'var(--md-primary)',
              color: 'var(--md-on-primary)',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '24px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              (e.target as HTMLElement).style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              (e.target as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            🔄 Zkusit znovu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;