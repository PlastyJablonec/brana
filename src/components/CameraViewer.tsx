import React, { useState, useEffect, useRef, useCallback } from 'react';
import './CameraViewer.css';

interface CameraViewerProps {
  cameraId?: string;
  backendUrl?: string;
  showControls?: boolean;
  showStatus?: boolean;
  className?: string;
  onError?: (error: string) => void;
  onStatusChange?: (status: CameraStatus) => void;
}

interface CameraStatus {
  id: string;
  status: 'online' | 'offline' | 'error' | 'connecting';
  lastSeen?: Date;
  error?: string;
  clientCount?: number;
}

export const CameraViewer: React.FC<CameraViewerProps> = ({
  cameraId = 'main-camera',
  backendUrl = 'http://localhost:3001',
  showControls = true,
  showStatus = true,
  className = '',
  onError,
  onStatusChange
}) => {
  const [status, setStatus] = useState<CameraStatus | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [streamMode, setStreamMode] = useState<'mjpeg' | 'snapshot'>('mjpeg');
  const [refreshInterval, setRefreshInterval] = useState<number>(1000);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<HTMLImageElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  const maxRetries = 5;
  const retryDelay = 2000;

  // API URLs
  const getStreamUrl = () => `${backendUrl}/api/camera/${cameraId}/stream`;
  const getSnapshotUrl = () => `${backendUrl}/api/camera/${cameraId}/snapshot?t=${Date.now()}`;
  const getStatusUrl = () => `${backendUrl}/api/camera/${cameraId}/status`;

  // Aktualizuj status kamery
  const updateStatus = useCallback(async () => {
    try {
      const response = await fetch(getStatusUrl());
      const data = await response.json();
      
      if (data.success && data.status) {
        setStatus(data.status);
        onStatusChange?.(data.status);
        
        if (data.status.status === 'online') {
          setError(null);
          retryCountRef.current = 0;
        } else if (data.status.error) {
          setError(data.status.error);
        }
      }
    } catch (err) {
      console.error('Failed to fetch camera status:', err);
    }
  }, [cameraId, backendUrl, onStatusChange]);

  // MJPEG stream handler
  const initMjpegStream = useCallback(() => {
    if (!streamRef.current) return;

    const img = streamRef.current;
    const streamUrl = getStreamUrl();
    
    console.log(`🎥 Inicializuji MJPEG stream: ${streamUrl}`);
    
    img.onload = () => {
      setIsConnected(true);
      setError(null);
      retryCountRef.current = 0;
      console.log('✅ MJPEG stream connected');
    };

    img.onerror = () => {
      setIsConnected(false);
      const errorMsg = `MJPEG stream nedostupný (pokus ${retryCountRef.current + 1}/${maxRetries})`;
      setError(errorMsg);
      onError?.(errorMsg);
      console.error('❌ MJPEG stream error');
      
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Retry MJPEG stream (${retryCountRef.current}/${maxRetries})`);
          img.src = streamUrl + `?retry=${retryCountRef.current}`;
        }, retryDelay);
      }
    };

    img.src = streamUrl;
  }, [cameraId, backendUrl, onError]);

  // Snapshot mode handler  
  const refreshSnapshot = useCallback(async () => {
    if (!imgRef.current) return;

    try {
      const img = imgRef.current;
      const snapshotUrl = getSnapshotUrl();
      
      // Preload image to check if it loads
      const tempImg = new Image();
      tempImg.onload = () => {
        if (imgRef.current) {
          imgRef.current.src = snapshotUrl;
          setIsConnected(true);
          setError(null);
          retryCountRef.current = 0;
        }
      };
      
      tempImg.onerror = () => {
        setIsConnected(false);
        const errorMsg = `Snapshot nedostupný (pokus ${retryCountRef.current + 1}/${maxRetries})`;
        setError(errorMsg);
        onError?.(errorMsg);
        
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
        }
      };
      
      tempImg.src = snapshotUrl;
      
    } catch (err) {
      console.error('Snapshot error:', err);
      setError('Chyba při načítání snímku');
    }
  }, [cameraId, backendUrl, onError]);

  // Spusť stream nebo snapshot mode
  const startCamera = useCallback(() => {
    if (streamMode === 'mjpeg') {
      initMjpegStream();
    } else {
      refreshSnapshot();
      // Nastavit interval pro snapshot mode
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(refreshSnapshot, refreshInterval);
    }
  }, [streamMode, initMjpegStream, refreshSnapshot, refreshInterval]);

  // Zastavit kameru
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.src = '';
    }
    
    if (imgRef.current) {
      imgRef.current.src = '';
    }
    
    setIsConnected(false);
    retryCountRef.current = 0;
  }, []);

  // Restart kamery
  const restartCamera = useCallback(() => {
    console.log('🔄 Restarting camera...');
    stopCamera();
    setTimeout(startCamera, 1000);
  }, [stopCamera, startCamera]);

  // Effect pro spuštění kamery
  useEffect(() => {
    startCamera();
    
    // Pravidelně aktualizuj status
    const statusInterval = setInterval(updateStatus, 5000);
    
    return () => {
      stopCamera();
      clearInterval(statusInterval);
    };
  }, [startCamera, stopCamera, updateStatus]);

  // Cleanup při unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className={`camera-viewer ${className}`}>
      {/* Header s ovládáním */}
      {showControls && (
        <div className="camera-controls">
          <div className="camera-title">
            <h3>📹 Kamera {cameraId}</h3>
          </div>
          
          <div className="camera-mode-controls">
            <label>
              <input
                type="radio"
                value="mjpeg"
                checked={streamMode === 'mjpeg'}
                onChange={(e) => setStreamMode(e.target.value as 'mjpeg')}
              />
              MJPEG Stream
            </label>
            
            <label>
              <input
                type="radio"
                value="snapshot"
                checked={streamMode === 'snapshot'}
                onChange={(e) => setStreamMode(e.target.value as 'snapshot')}
              />
              Snapshot Mode
            </label>
          </div>
          
          {streamMode === 'snapshot' && (
            <div className="snapshot-controls">
              <label>
                Refresh interval (ms):
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                />
              </label>
            </div>
          )}
          
          <div className="camera-actions">
            <button onClick={restartCamera} className="btn-restart">
              🔄 Restart
            </button>
            
            <button onClick={stopCamera} className="btn-stop">
              ⏹️ Stop
            </button>
          </div>
        </div>
      )}

      {/* Status panel */}
      {showStatus && status && (
        <div className={`camera-status status-${status.status}`}>
          <span className="status-indicator"></span>
          <span>Status: {status.status}</span>
          {status.clientCount !== undefined && (
            <span>Klienti: {status.clientCount}</span>
          )}
          {status.lastSeen && (
            <span>Poslední: {new Date(status.lastSeen).toLocaleTimeString()}</span>
          )}
        </div>
      )}

      {/* Camera display */}
      <div className="camera-container">
        {streamMode === 'mjpeg' ? (
          <img
            ref={streamRef}
            alt="Camera MJPEG Stream"
            className="camera-image"
            style={{ display: isConnected ? 'block' : 'none' }}
          />
        ) : (
          <img
            ref={imgRef}
            alt="Camera Snapshot"
            className="camera-image"
            style={{ display: isConnected ? 'block' : 'none' }}
          />
        )}
        
        {/* Error/Loading overlay */}
        {(!isConnected || error) && (
          <div className="camera-overlay">
            {error ? (
              <div className="error-message">
                ❌ {error}
                <button onClick={restartCamera} className="retry-btn">
                  Zkusit znovu
                </button>
              </div>
            ) : (
              <div className="loading-message">
                🔄 Připojování ke kameře...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraViewer;