import React, { useState, useEffect } from 'react';
import { useGateCoordination } from '../hooks/useGateCoordination';
import { useAuth } from '../contexts/AuthContext';

interface DebugLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export function CoordinationDebug() {
  const { coordinationState, status } = useGateCoordination();
  const { currentUser } = useAuth();
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const addLog = (message: string, type: DebugLog['type'] = 'info') => {
    const newLog: DebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    
    setDebugLogs(prev => {
      const updated = [...prev, newLog];
      // Zachovej jen posledních 50 logů
      return updated.slice(-50);
    });
  };

  // Sleduj změny coordinationState
  useEffect(() => {
    if (coordinationState) {
      addLog(`🔧 Coordination State Changed: 
        ActiveUser: ${coordinationState.activeUser ? 
          `${coordinationState.activeUser.userDisplayName} (${coordinationState.activeUser.email})` : 
          'none'}
        Queue: ${coordinationState.reservationQueue.length} users
        GateState: ${coordinationState.gateState}`, 'info');
    }
  }, [coordinationState]);

  // Sleduj změny status
  useEffect(() => {
    if (currentUser) {
      addLog(`🚨 Status Update for ${currentUser.email}:
        isActive: ${status.isActive}
        isBlocked: ${status.isBlocked}  
        isInQueue: ${status.isInQueue}
        position: ${status.position}
        waitingText: ${status.waitingTimeText}`, status.isBlocked ? 'error' : status.isActive ? 'success' : 'warning');
    }
  }, [status, currentUser]);

  const clearLogs = () => {
    setDebugLogs([]);
    addLog('🗑️ Debug logy vymazány', 'info');
  };

  const testCoordination = () => {
    addLog('🧪 Testování koordinace...', 'info');
    
    if (coordinationState && currentUser) {
      const details = {
        currentUserId: currentUser.id,
        currentUserEmail: currentUser.email,
        activeUserId: coordinationState.activeUser?.userId || 'none',
        activeUserEmail: coordinationState.activeUser?.email || 'none',
        shouldBeBlocked: coordinationState.activeUser !== null && coordinationState.activeUser.userId !== currentUser.id,
        actuallyBlocked: status.isBlocked
      };
      
      addLog(`📊 Coordination Test Results: ${JSON.stringify(details, null, 2)}`, 
        details.shouldBeBlocked === details.actuallyBlocked ? 'success' : 'error');
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="md-button md-button-outlined"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          background: 'var(--md-primary)',
          color: 'white',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          border: 'none',
          fontSize: '24px'
        }}
        title="Debug koordinace uživatelů"
      >
        🐛
      </button>
    );
  }

  return (
    <div 
      className="md-card" 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '400px',
        height: '500px',
        zIndex: 1000,
        background: 'var(--md-surface)',
        border: '2px solid var(--md-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div 
        className="md-card-header" 
        style={{
          background: 'var(--md-primary)',
          color: 'white',
          padding: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px' }}>🐛 Coordination Debug</h3>
        <div>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              background: 'transparent',
              border: '1px solid white',
              color: 'white',
              borderRadius: '4px',
              padding: '4px 8px',
              marginRight: '8px',
              fontSize: '12px'
            }}
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: 'transparent',
              border: '1px solid white',
              color: 'white',
              borderRadius: '4px',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="md-card-content" style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Akční tlačítka */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button onClick={testCoordination} className="md-button" style={{ fontSize: '12px' }}>
            🧪 Test
          </button>
          <button onClick={clearLogs} className="md-button md-button-outlined" style={{ fontSize: '12px' }}>
            🗑️ Clear
          </button>
        </div>

        {/* Status panel */}
        <div 
          style={{
            background: 'var(--md-surface-variant)', 
            padding: '8px', 
            borderRadius: '8px', 
            marginBottom: '12px',
            fontSize: '12px'
          }}
        >
          <div><strong>User:</strong> {currentUser?.email}</div>
          <div><strong>Status:</strong> {status.waitingTimeText}</div>
          <div><strong>Active User:</strong> {status.activeUser || 'none'}</div>
          <div style={{ color: status.isBlocked ? 'var(--md-error)' : 'var(--md-success)' }}>
            <strong>Blocked:</strong> {status.isBlocked ? 'YES' : 'NO'}
          </div>
        </div>

        {/* Log oblast */}
        <div 
          style={{
            flex: 1,
            background: 'var(--md-surface-container)',
            borderRadius: '8px',
            padding: '8px',
            overflow: 'auto',
            fontSize: '11px',
            fontFamily: 'monospace',
            border: '1px solid var(--md-outline)'
          }}
          ref={(el) => {
            if (el && autoScroll) {
              el.scrollTop = el.scrollHeight;
            }
          }}
        >
          {debugLogs.map((log, index) => (
            <div 
              key={index} 
              style={{
                marginBottom: '4px',
                padding: '4px',
                borderRadius: '4px',
                background: 
                  log.type === 'error' ? 'var(--md-error-container)' :
                  log.type === 'success' ? 'var(--md-success-container)' :
                  log.type === 'warning' ? 'var(--md-warning-container)' :
                  'transparent',
                color:
                  log.type === 'error' ? 'var(--md-on-error-container)' :
                  log.type === 'success' ? 'var(--md-on-success-container)' :
                  log.type === 'warning' ? 'var(--md-on-warning-container)' :
                  'var(--md-on-surface)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              <span style={{ opacity: 0.7 }}>[{log.timestamp}]</span> {log.message}
            </div>
          ))}
          
          {debugLogs.length === 0 && (
            <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>
              Žádné debug logy zatím...
              <br />
              Klikni "Test" pro kontrolu koordinace
            </div>
          )}
        </div>
      </div>
    </div>
  );
}