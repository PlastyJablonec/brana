import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CameraWidgetProps {
  refreshInterval?: number;
  showTimestamp?: boolean;
  showSettings?: boolean;
  className?: string;
}

const DEFAULT_REFRESH_MS = Number(process.env.REACT_APP_CAMERA_REFRESH_MS || 5000);
const HIDDEN_REFRESH_MS = Number(process.env.REACT_APP_CAMERA_REFRESH_HIDDEN_MS || 20000);

export const CameraWidget: React.FC<CameraWidgetProps> = ({
  refreshInterval = DEFAULT_REFRESH_MS,
  showTimestamp = true,
  showSettings = true,
  className = ''
}) => {
  const [lastSuccessfulLoad, setLastSuccessfulLoad] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timestampText, setTimestampText] = useState<string>('--');
  const [cameraUrl, setCameraUrl] = useState<string>('');
  
  const imgRef = useRef<HTMLImageElement>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timestampIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);
  // Optional direct camera URL (prefer HTTPS)
  const directCameraUrl = (process.env.REACT_APP_CAMERA_URL || '').trim();

  const baseRefreshMs = Math.max(500, refreshInterval);
  const hiddenRefreshMs = Math.max(baseRefreshMs, HIDDEN_REFRESH_MS);

  // Resolve base URL for camera image (STRICT: no runtime overrides)
  const getBaseUrl = useCallback((): string => {
    const isHTTPS = window.location.protocol === 'https:';
    const isVercel = window.location.hostname.includes('vercel.app');

    // Force proxy for HTTPS (especially Vercel) - ignore direct camera URL env
    if (isHTTPS || isVercel) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔒 Camera: Using HTTPS API proxy for security (base=/api/camera-proxy)');
      }
      return '/api/camera-proxy';
    }

    // HTTP localhost: prefer env, fallback to direct
    if (directCameraUrl) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('📹 Camera: Using REACT_APP_CAMERA_URL =', directCameraUrl);
      }
      return directCameraUrl;
    }

    console.warn('❌ Camera: Není nastavena REACT_APP_CAMERA_URL pro HTTP prostředí, použiji fallback');
    return 'http://89.24.76.191:10180/photo.jpg';
  }, [directCameraUrl]);

  const getFreshCameraUrl = useCallback((): string => {
    const baseUrl = getBaseUrl();
    return `${baseUrl}?t=${Date.now()}&cache=${Math.random()}`;
  }, [getBaseUrl]);

  const updateTimestampDisplay = useCallback(() => {
    if (lastSuccessfulLoad === 0) {
      setTimestampText('--');
      return;
    }
    
    const secondsAgo = Math.floor((Date.now() - lastSuccessfulLoad) / 1000);
    if (secondsAgo === 0) {
      setTimestampText('Nyní');
    } else if (secondsAgo < 60) {
      setTimestampText(`Před ${secondsAgo}s`);
    } else {
      const minutesAgo = Math.floor(secondsAgo / 60);
      setTimestampText(`Před ${minutesAgo}m`);
    }
  }, [lastSuccessfulLoad]);

  // Simple camera refresh with proper error handling
  const refreshCamera = useCallback(() => {
    if (inFlightRef.current) {
      // Prevent overlapping fetches (slow camera/network)
      return;
    }
    inFlightRef.current = true;
    const newUrl = getFreshCameraUrl();
    
    // Always update URL state first (for immediate visual feedback)
    setCameraUrl(newUrl);
    
    // Preload image to check if it loads successfully with timeout
    const newImg = new Image();
    const timeout = setTimeout(() => {
      setIsLoading(false);
      setError('Kamera nedostupná (timeout)');
      setTimestampText('Offline');
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ Camera: Load timeout after 10s');
      }
      inFlightRef.current = false;
    }, 10000); // 10s timeout for image load
    
    newImg.onload = () => {
      clearTimeout(timeout);
      setIsLoading(false);
      setError(null);
      setLastSuccessfulLoad(Date.now());
      updateTimestampDisplay();
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Camera: Image loaded successfully');
      }
      inFlightRef.current = false;
    };
    
    newImg.onerror = () => {
      clearTimeout(timeout);
      setIsLoading(false);
      setError('Kamera nedostupná');
      setTimestampText('Offline');
      if (process.env.NODE_ENV !== 'production') {
        console.log('❌ Camera: Image load failed');
      }
      inFlightRef.current = false;
    };
    
    newImg.src = newUrl;
  }, [getFreshCameraUrl, updateTimestampDisplay]);

  const scheduleNextRefresh = useCallback((delay: number) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshCamera();
      const nextDelay = document.hidden ? hiddenRefreshMs : baseRefreshMs;
      scheduleNextRefresh(nextDelay);
    }, delay);
  }, [baseRefreshMs, hiddenRefreshMs, refreshCamera]);

  const openCameraControl = () => {
    window.open('http://89.24.76.191:10180', '_blank');
  };

  useEffect(() => {
    // Initialize with first camera URL
    const initial = getFreshCameraUrl();
    if (process.env.NODE_ENV !== 'production') {
      console.log('📹 Camera: Initial resolved URL =', initial);
    }
    setCameraUrl(initial);
    
    // Initial load
    refreshCamera();
    scheduleNextRefresh(baseRefreshMs);

    // Set up interval for timestamp updates (cheap operation)
    timestampIntervalRef.current = setInterval(updateTimestampDisplay, 1000);
    
    // Cleanup function to prevent memory leaks
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (timestampIntervalRef.current) {
        clearInterval(timestampIntervalRef.current);
      }
    };
  }, [baseRefreshMs, getFreshCameraUrl, refreshCamera, scheduleNextRefresh, updateTimestampDisplay]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        scheduleNextRefresh(hiddenRefreshMs);
      } else {
        refreshCamera();
        scheduleNextRefresh(baseRefreshMs);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [baseRefreshMs, hiddenRefreshMs, refreshCamera, scheduleNextRefresh]);

  return (
    <div className={`camera-widget ${className}`}>
      <div className="camera-header">
        <h3>📹 Webkamera</h3>
        {showSettings && (
          <button 
            onClick={openCameraControl}
            className="camera-gear"
            title="Otevřít ovládání kamery"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M19.4,12c0-0.2,0-0.4,0-0.6c0-0.2,0-0.4,0-0.6l2.1-1.6c0.2-0.1,0.2-0.4,0.1-0.6l-2-3.5C19.5,5.5,19.2,5.4,19,5.5l-2.5,1 c-0.5-0.4-1-0.7-1.6-1l-0.4-2.7C14.5,2.2,14.3,2,14,2h-4C9.7,2,9.5,2.2,9.5,2.5L9.1,5.2C8.5,5.5,8,5.8,7.5,6.2l-2.5-1 C4.8,5.1,4.5,5.2,4.4,5.4l-2,3.5C2.3,9.1,2.3,9.4,2.5,9.5l2.1,1.6c0,0.2,0,0.4,0,0.6c0,0.2,0,0.4,0,0.6l-2.1,1.6 C2.3,14.9,2.3,15.2,2.4,15.4l2,3.5c0.1,0.2,0.4,0.3,0.6,0.2l2.5-1c0.5,0.4,1,0.7,1.6,1l0.4,2.7c0,0.3,0.2,0.5,0.5,0.5h4 c0.3,0,0.5-0.2,0.5-0.5l0.4-2.7c0.6-0.3,1.1-0.6,1.6-1l2.5,1c0.2,0.1,0.5,0,0.6-0.2l2-3.5c0.1-0.2,0.1-0.5-0.1-0.6L19.4,12z M12,15.5c-1.9,0-3.5-1.6-3.5-3.5s1.6-3.5,3.5-3.5s3.5,1.6,3.5,3.5S13.9,15.5,12,15.5z"/>
            </svg>
          </button>
        )}
      </div>
      
      <div className="camera-container">
        {cameraUrl ? (
          <img 
            ref={imgRef}
            src={cameraUrl}
            alt="Webkamera"
            className="camera-image"
          />
        ) : (
          <div className="camera-overlay">Kamera není nakonfigurovaná</div>
        )}
        
        {(isLoading || error) && (
          <div className="camera-overlay">
            {isLoading ? 'Načítání kamery...' : error}
          </div>
        )}
        
        {showTimestamp && (
          <div className="camera-timestamp">
            {timestampText}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraWidget;
