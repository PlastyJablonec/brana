import React, { useState, useEffect } from 'react';
import { useGateCoordination } from '../hooks/useGateCoordination';
import { useAuth } from '../contexts/AuthContext';

interface DebugInfo {
  timestamp: string;
  type: 'CLICK' | 'STATE' | 'FIRESTORE' | 'ERROR' | 'INFO';
  message: string;
  data?: any;
}

export function ComplexDebugTool() {
  const { coordinationState, status, requestControl, joinQueue, leaveQueue } = useGateCoordination();
  const { currentUser } = useAuth();
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const log = (type: DebugInfo['type'], message: string, data?: any) => {
    const newLog: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data
    };
    
    setDebugLogs(prev => [...prev, newLog].slice(-100)); // Jen posledních 100
    
    // Také pošli do console
    console.log(`🔧 COMPLEX DEBUG [${type}]: ${message}`, data || '');
  };

  // Monitor coordination state changes
  useEffect(() => {
    if (coordinationState) {
      log('FIRESTORE', 'Coordination state changed', {
        activeUser: coordinationState.activeUser ? {
          userId: coordinationState.activeUser.userId,
          userDisplayName: coordinationState.activeUser.userDisplayName,
          email: coordinationState.activeUser.email
        } : null,
        gateState: coordinationState.gateState,
        queueLength: coordinationState.reservationQueue.length
      });
    }
  }, [coordinationState]);

  // Monitor status changes  
  useEffect(() => {
    if (currentUser) {
      log('STATE', `Status updated for ${currentUser.email}`, {
        isActive: status.isActive,
        isBlocked: status.isBlocked,
        isInQueue: status.isInQueue,
        position: status.position,
        activeUser: status.activeUser,
        waitingText: status.waitingTimeText
      });
    }
  }, [status, currentUser]);

  // Intercept gate clicks
  const handleTestGateClick = async () => {
    log('CLICK', 'Gate button clicked - testing coordination logic');
    
    if (!currentUser) {
      log('ERROR', 'No current user!');
      return;
    }

    log('INFO', 'Current user details', {
      id: currentUser.id,
      email: currentUser.email,
      displayName: currentUser.displayName
    });

    log('INFO', 'Coordination status before action', {
      isActive: status.isActive,
      isBlocked: status.isBlocked,
      isInQueue: status.isInQueue,
      canControl: status.canControl
    });

    // Simulace stejné logiky jako v handleGateControl
    if (status.isBlocked && !status.isInQueue) {
      log('CLICK', 'User is blocked - joining queue');
      const success = await joinQueue();
      log(success ? 'INFO' : 'ERROR', `Join queue result: ${success}`);
      return;
    }

    if (status.isInQueue) {
      log('CLICK', 'User is in queue - leaving queue'); 
      await leaveQueue();
      return;
    }

    if (!status.isActive) {
      log('CLICK', 'User not active - requesting control');
      const granted = await requestControl();
      log(granted ? 'INFO' : 'ERROR', `Request control result: ${granted}`);
      if (!granted) return;
    }

    log('CLICK', 'User should be able to control gate now');
  };

  const clearLogs = () => {
    setDebugLogs([]);
    log('INFO', 'Debug logs cleared');
  };

  const exportLogs = () => {
    const logText = debugLogs.map(log => 
      `[${log.timestamp}] ${log.type}: ${log.message} ${log.data ? JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      log('INFO', 'Logs copied to clipboard');
    });
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '80px', 
          right: '20px',
          zIndex: 1001,
          background: 'var(--md-tertiary)',
          color: 'white',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          border: 'none',
          fontSize: '20px',
          boxShadow: 'var(--md-elevation-3-shadow)'
        }}
        title="Complex Debug Tool"
      >
        🔬
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      width: '500px',
      height: '600px',
      zIndex: 1001,
      background: 'var(--md-surface)',
      border: '2px solid var(--md-tertiary)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      
      {/* Header */}
      <div style={{
        background: 'var(--md-tertiary)',
        color: 'white',
        padding: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>🔬 Complex Debug Tool</h3>
        <div>
          <button onClick={exportLogs} style={{
            background: 'transparent', border: '1px solid white', 
            color: 'white', borderRadius: '4px', padding: '4px 8px', 
            marginRight: '8px', fontSize: '12px'
          }}>
            📋 Copy
          </button>
          <button onClick={() => setIsVisible(false)} style={{
            background: 'transparent', border: '1px solid white',
            color: 'white', borderRadius: '4px', padding: '4px 8px'
          }}>
            ✕
          </button>
        </div>
      </div>

      {/* Status Panel */}
      <div style={{
        background: 'var(--md-surface-variant)',
        padding: '12px',
        fontSize: '12px',
        borderBottom: '1px solid var(--md-outline)'
      }}>
        <div><strong>User:</strong> {currentUser?.email || 'none'}</div>
        <div><strong>User ID:</strong> {currentUser?.id || 'none'}</div>
        <div><strong>Status:</strong> {status.waitingTimeText}</div>
        <div><strong>Active User:</strong> {status.activeUser || 'none'}</div>
        <div style={{ color: status.isBlocked ? 'var(--md-error)' : 'var(--md-success)' }}>
          <strong>Blocked:</strong> {status.isBlocked ? 'YES' : 'NO'}
        </div>
        <div><strong>Queue Position:</strong> {status.position}</div>
        <div><strong>Queue Length:</strong> {coordinationState?.reservationQueue.length || 0}</div>
      </div>

      {/* Action Buttons */}
      <div style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={handleTestGateClick} style={{
          background: 'var(--md-primary)', color: 'white',
          border: 'none', borderRadius: '8px', padding: '8px 12px',
          fontSize: '12px', cursor: 'pointer'
        }}>
          🧪 Test Gate Logic
        </button>
        <button onClick={clearLogs} style={{
          background: 'var(--md-secondary)', color: 'white',
          border: 'none', borderRadius: '8px', padding: '8px 12px',
          fontSize: '12px', cursor: 'pointer'
        }}>
          🗑️ Clear
        </button>
        <button onClick={exportLogs} style={{
          background: 'var(--md-tertiary)', color: 'white',
          border: 'none', borderRadius: '8px', padding: '8px 12px',
          fontSize: '12px', cursor: 'pointer'
        }}>
          📋 Export
        </button>
      </div>

      {/* Logs Area */}
      <div style={{
        flex: 1,
        background: 'var(--md-surface-container)',
        padding: '8px',
        overflow: 'auto',
        fontSize: '10px',
        fontFamily: 'monospace'
      }}>
        {debugLogs.map((log, index) => (
          <div key={index} style={{
            marginBottom: '4px',
            padding: '4px',
            borderRadius: '4px',
            background: 
              log.type === 'ERROR' ? 'var(--md-error-container)' :
              log.type === 'CLICK' ? 'var(--md-primary-container)' :
              log.type === 'FIRESTORE' ? 'var(--md-tertiary-container)' :
              log.type === 'STATE' ? 'var(--md-secondary-container)' :
              'transparent',
            color:
              log.type === 'ERROR' ? 'var(--md-on-error-container)' :
              log.type === 'CLICK' ? 'var(--md-on-primary-container)' :
              log.type === 'FIRESTORE' ? 'var(--md-on-tertiary-container)' :
              log.type === 'STATE' ? 'var(--md-on-secondary-container)' :
              'var(--md-on-surface)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            <span style={{ opacity: 0.7 }}>[{log.timestamp}] {log.type}:</span> {log.message}
            {log.data && (
              <pre style={{ margin: '4px 0', fontSize: '9px', opacity: 0.8 }}>
                {JSON.stringify(log.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
        
        {debugLogs.length === 0 && (
          <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>
            Žádné debug logy zatím...
          </div>
        )}
      </div>
    </div>
  );
}