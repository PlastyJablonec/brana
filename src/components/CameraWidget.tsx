import React, { useState, useEffect, useRef } from 'react';

interface CameraWidgetProps {
  refreshInterval?: number;
  showTimestamp?: boolean;
  showSettings?: boolean;
  className?: string;
}

export const CameraWidget: React.FC<CameraWidgetProps> = ({
  refreshInterval = 1000,
  showTimestamp = true,
  showSettings = true,
  className = ''
}) => {
  const [lastSuccessfulLoad, setLastSuccessfulLoad] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timestampText, setTimestampText] = useState<string>('--');
  
  const imgRef = useRef<HTMLImageElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timestampIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use HTTPS API proxy to avoid Mixed Content issues
  const CAMERA_URL = '/api/camera-proxy';

  const updateTimestampDisplay = () => {
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
  };

  const refreshCamera = () => {
    const timestamp = Date.now();
    const url = `${CAMERA_URL}?t=${timestamp}&cache=${Math.random()}`;
    
    const newImg = new Image();
    newImg.onload = () => {
      if (imgRef.current) {
        imgRef.current.src = newImg.src;
        setIsLoading(false);
        setError(null);
        setLastSuccessfulLoad(Date.now());
        updateTimestampDisplay();
      }
    };
    newImg.onerror = () => {
      setIsLoading(false);
      setError('Chyba načítání kamery');
      setTimestampText('Offline');
    };
    newImg.src = url;
  };

  const openCameraControl = () => {
    window.open('http://89.24.76.191:10180', '_blank');
  };

  useEffect(() => {
    // Počáteční načtení
    refreshCamera();
    
    // Pravidelné obnovovení kamery
    refreshIntervalRef.current = setInterval(refreshCamera, refreshInterval);
    
    // Pravidelné aktualizování časového razítka
    timestampIntervalRef.current = setInterval(updateTimestampDisplay, 1000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (timestampIntervalRef.current) {
        clearInterval(timestampIntervalRef.current);
      }
    };
  }, [refreshInterval]);

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
        <img 
          ref={imgRef}
          src={CAMERA_URL} 
          alt="Webkamera"
          className="camera-image"
        />
        
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