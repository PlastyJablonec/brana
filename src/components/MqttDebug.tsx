import React, { useState, useEffect } from 'react';
import { mqttService } from '../services/mqttService';

interface DebugInfo {
  timestamp: string;
  event: string;
  details: string;
  status: 'info' | 'success' | 'warning' | 'error';
}

interface MqttDebugProps {
  isVisible: boolean;
  onClose: () => void;
}

const MqttDebug: React.FC<MqttDebugProps> = ({ isVisible, onClose }) => {
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const addDebugLog = (event: string, details: string, status: DebugInfo['status'] = 'info') => {
    setDebugLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      event,
      details,
      status
    }].slice(-20)); // Keep only last 20 logs
  };

  const testMqttConnection = async () => {
    setConnectionAttempts(prev => prev + 1);
    addDebugLog('MQTT Test', `Pokus ${connectionAttempts + 1} - Testování připojení...`, 'info');
    
    try {
      // Detect connection type
      const isHttps = window.location.protocol === 'https:';
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      addDebugLog('Environment', `HTTPS: ${isHttps}, Mobile: ${isMobile}`, 'info');
      if (connection) {
        addDebugLog('Network', `Type: ${connection.effectiveType || 'unknown'}, Downlink: ${connection.downlink || 'unknown'}Mbps`, 'info');
      }

      // Test WebSocket connection directly
      const wsUrl = 'ws://89.24.76.191:9001';
      addDebugLog('WebSocket', `Testování ${wsUrl}...`, 'info');
      
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        addDebugLog('WebSocket', 'Timeout - WebSocket se nepřipojil do 10s', 'error');
        setLastError('WebSocket timeout - možná blokováno operátorem');
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        addDebugLog('WebSocket', 'WebSocket připojen úspěšně!', 'success');
        ws.close();
        
        // Now test MQTT
        testMqttProtocol();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        addDebugLog('WebSocket', `WebSocket chyba: ${error}`, 'error');
        setLastError('WebSocket nelze navázat - možná blokováno firewallem');
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          addDebugLog('WebSocket', `WebSocket zavřen s kódem: ${event.code}`, 'warning');
        }
      };

    } catch (error) {
      addDebugLog('Error', `Obecná chyba: ${error}`, 'error');
      setLastError(error instanceof Error ? error.message : 'Neznámá chyba');
    }
  };

  const testMqttProtocol = async () => {
    try {
      addDebugLog('MQTT', 'Testování MQTT protokolu...', 'info');
      
      // Force disconnect first
      mqttService.disconnect();
      
      // Wait a bit then try to connect
      setTimeout(async () => {
        try {
          await mqttService.connect();
          addDebugLog('MQTT', 'MQTT připojen úspěšně!', 'success');
          
          // Test subscription
          const unsubscribe = mqttService.onStatusChange((status) => {
            addDebugLog('MQTT Status', `Obdržen status: ${status.gateStatus}`, 'success');
            unsubscribe();
          });
          
        } catch (error) {
          addDebugLog('MQTT', `MQTT chyba: ${error}`, 'error');
          setLastError(error instanceof Error ? error.message : 'MQTT připojení selhalo');
        }
      }, 1000);
      
    } catch (error) {
      addDebugLog('MQTT', `MQTT test chyba: ${error}`, 'error');
    }
  };

  const copyDiagnostics = () => {
    const diagnostics = [
      `=== MQTT Diagnostika ===`,
      `Čas: ${new Date().toLocaleString()}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      ``,
      `=== Logy ===`,
      ...debugLogs.map(log => `[${log.timestamp}] ${log.event}: ${log.details}`)
    ].join('\n');
    
    navigator.clipboard.writeText(diagnostics);
    addDebugLog('System', 'Diagnostika zkopírována do schránky', 'success');
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--md-surface)',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: 'var(--md-on-surface)' }}>🔧 MQTT Debug</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--md-on-surface)'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={testMqttConnection}
            style={{
              background: 'var(--md-primary)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginRight: '12px'
            }}
          >
            🧪 Test připojení
          </button>
          
          <button
            onClick={copyDiagnostics}
            style={{
              background: 'var(--md-secondary)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            📋 Kopírovat diagnostiku
          </button>
        </div>

        {lastError && (
          <div style={{
            background: 'var(--md-error-container)',
            color: 'var(--md-on-error-container)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <strong>Poslední chyba:</strong> {lastError}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <strong>Počet pokusů:</strong> {connectionAttempts}
        </div>

        <div style={{
          background: 'var(--md-surface-variant)',
          borderRadius: '8px',
          padding: '16px',
          maxHeight: '300px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '12px', fontWeight: 'bold' }}>Debug Log:</div>
          {debugLogs.length === 0 ? (
            <div style={{ color: 'var(--md-on-surface-variant)', fontStyle: 'italic' }}>
              Zatím žádné logy... Klikni na "Test připojení"
            </div>
          ) : (
            debugLogs.map((log, index) => (
              <div 
                key={index}
                style={{
                  marginBottom: '4px',
                  color: log.status === 'error' ? 'var(--md-error)' : 
                         log.status === 'success' ? 'var(--md-success)' :
                         log.status === 'warning' ? 'var(--md-warning)' : 
                         'var(--md-on-surface-variant)'
                }}
              >
                [{log.timestamp}] <strong>{log.event}:</strong> {log.details}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>
          💡 <strong>Časté problémy na mobilu:</strong><br/>
          • Operátor blokuje WebSocket (port 9001)<br/>
          • Firewall firemní sítě<br/>
          • Slabý signál mobilních dat<br/>
          • HTTPS mixed content policy
        </div>
      </div>
    </div>
  );
};

export default MqttDebug;