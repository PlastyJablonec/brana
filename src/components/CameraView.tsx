import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CameraViewProps {}

const CameraView: React.FC<CameraViewProps> = () => {
  const [lastSuccessfulLoad, setLastSuccessfulLoad] = useState<number>(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayText, setOverlayText] = useState('Načítání kamery...');
  const [timestampText, setTimestampText] = useState('--');
  const [isRealCamera, setIsRealCamera] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previousImageHashRef = useRef<string | null>(null);

  // Aktualizace současného času každých 100ms pro plynulé zobrazení  
  useEffect(() => {
    timeUpdateIntervalRef.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  // Funkce pro detekci změny obrazu pomocí hash pixelů
  const hasImageChanged = useCallback(async (img: HTMLImageElement): Promise<boolean> => {
    try {
      // Vytvoříme canvas pro porovnání pixelů
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Získáme data obrazu
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Vypočítáme hash pro rychlé porovnání (každý 40. pixel)
      let hash = 0;
      for (let i = 0; i < data.length; i += 40) {
        hash = ((hash << 5) - hash) + data[i];
        hash = hash & hash; // Convert to 32bit integer
      }
      
      const currentHash = hash.toString();
      
      if (previousImageHashRef.current !== currentHash) {
        previousImageHashRef.current = currentHash;
        console.log('📸 Detekována změna snímku - nový hash:', currentHash.substring(0, 8));
        return true;
      }
      
      console.log('📸 Stejný snímek - hash nezměněn:', currentHash.substring(0, 8));
      return false;
    } catch (error) {
      console.error('📸 Chyba při porovnávání obrazu:', error);
      return true; // při chybě předpokládáme změnu
    }
  }, []);

  const updateTimestampDisplay = useCallback(() => {
    if (lastSuccessfulLoad === 0) {
      setTimestampText('--');
      return;
    }
    
    const diff = currentTime - lastSuccessfulLoad;
    let newTimestamp = '';
    
    // Zobrazení podle reference kódu
    if (diff < 1000) {
      newTimestamp = 'Live';
    } else if (diff < 2000) {
      newTimestamp = 'Před 1s';
    } else if (diff < 60000) {
      newTimestamp = `Před ${Math.floor(diff / 1000)}s`;
    } else {
      const minutesAgo = Math.floor(diff / 60000);
      newTimestamp = `Před ${minutesAgo}m`;
    }
    
    setTimestampText(newTimestamp);
  }, [lastSuccessfulLoad, currentTime]);

  const refreshCamera = useCallback(async () => {
    const timestamp = Date.now();
    const isHttps = window.location.protocol === 'https:';
    
    let realUrl: string;
    
    if (isHttps) {
      // Use proxy on HTTPS
      realUrl = `/api/camera-proxy?t=${timestamp}&cache=${Math.random()}`;
      console.log('🌐 HTTPS detected - using camera proxy:', realUrl);
    } else {
      // Direct connection on HTTP
      const cameraBase = process.env.REACT_APP_CAMERA_URL || 'http://89.24.76.191:10180';
      realUrl = `${cameraBase}/photo.jpg?t=${timestamp}&cache=${Math.random()}`;
      console.log('🎥 HTTP detected - direct camera connection:', realUrl);
    }
    
    try {
      // Vytvoříme nový Image objekt pro testování
      const testImg = new Image();
      testImg.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        testImg.onload = async () => {
          try {
            // Kontrola, zda se obraz skutečně změnil
            const changed = await hasImageChanged(testImg);
            
            if (changed) {
              // Pouze při změně obsahu aktualizujeme timestamp a zobrazení
              const changeTime = Date.now();
              setLastSuccessfulLoad(changeTime);
              console.log('📸 ZMĚNA DETEKOVÁNA - aktualizace timestamp:', new Date(changeTime));
              
              // Aktualizuj zobrazený obrázek
              if (imgRef.current) {
                imgRef.current.src = realUrl;
              }
              setShowOverlay(false);
              setIsRealCamera(true);
            } else {
              console.log('📸 Žádná změna - timestamp se neaktualizuje');
            }
            
            resolve();
          } catch (error) {
            console.error('📸 Chyba při detekci změny:', error);
            reject(error);
          }
        };
        
        testImg.onerror = () => {
          console.error('📸 Chyba při načítání testovacího snímku');
          setOverlayText(isHttps ? 'Proxy kamera nedostupná' : 'Chyba načítání kamery');
          setIsRealCamera(false);
          reject(new Error('Failed to load image'));
        };
        
        testImg.src = realUrl;
      });
      
    } catch (error) {
      console.error('📸 Chyba v refreshCamera:', error);
      setOverlayText('Chyba kamery');
      setIsRealCamera(false);
    }
  }, [hasImageChanged]);


  // Aktualizuj timestamp displej při změnách
  useEffect(() => {
    updateTimestampDisplay();
  }, [updateTimestampDisplay]);

  // Nastav interval pro refresh kamery (každou sekundu)
  useEffect(() => {
    intervalRef.current = setInterval(refreshCamera, 1000); // Každou sekundu kontrola změn
    refreshCamera(); // Initial load
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshCamera]);

  return (
    <div className="camera-container" style={{ position: 'relative' }}>
      {/* Camera Image */}
      <img
        ref={imgRef}
        src="/placeholder-camera.svg"
        alt="Webkamera"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.3s'
        }}
      />
      
      {/* Camera Overlay */}
      {showOverlay && (
        <div 
          className="camera-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'var(--md-on-surface-variant)',
            fontSize: '0.9em',
            zIndex: 1
          }}
        >
          {overlayText}
        </div>
      )}
      
      {/* Camera Timestamp */}
      <div 
        className="camera-timestamp"
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.75em',
          fontFamily: 'monospace',
          zIndex: 2
        }}
      >
        {timestampText}
      </div>
      
      {/* Camera Gear - uvnitř camera-container */}
      <div 
        className="camera-gear"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          cursor: 'pointer',
          padding: '5px',
          borderRadius: '6px',
          transition: 'background-color 0.2s',
          zIndex: 2
        }}
        onClick={() => {
          const isHttps = window.location.protocol === 'https:';
          const cameraUrl = isHttps ? 'https://89.24.76.191:10180' : 'http://89.24.76.191:10180';
          window.open(cameraUrl, '_blank');
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Nastavení kamery"
      >
        <svg 
          style={{ width: '20px', height: '20px', fill: 'var(--md-on-surface-variant)' }} 
          viewBox="0 0 24 24"
        >
          <path d="M19.4,12c0-0.2,0-0.4,0-0.6c0-0.2,0-0.4,0-0.6l2.1-1.6c0.2-0.1,0.2-0.4,0.1-0.6l-2-3.5C19.5,5.5,19.2,5.4,19,5.5l-2.5,1 c-0.5-0.4-1-0.7-1.6-1l-0.4-2.7C14.5,2.2,14.3,2,14,2h-4C9.7,2,9.5,2.2,9.5,2.5L9.1,5.2C8.5,5.5,8,5.8,7.5,6.2l-2.5-1 C4.8,5.1,4.5,5.2,4.4,5.4l-2,3.5C2.3,9.1,2.3,9.4,2.5,9.5l2.1,1.6c0,0.2,0,0.4,0,0.6c0,0.2,0,0.4,0,0.6l-2.1,1.6 C2.3,14.9,2.3,15.2,2.4,15.4l2,3.5c0.1,0.2,0.4,0.3,0.6,0.2l2.5-1c0.5,0.4,1,0.7,1.6,1l0.4,2.7c0,0.3,0.2,0.5,0.5,0.5h4 c0.3,0,0.5-0.2,0.5-0.5l0.4-2.7c0.6-0.3,1.1-0.6,1.6-1l2.5,1c0.2,0.1,0.5,0,0.6-0.2l2-3.5c0.1-0.2,0.1-0.5-0.1-0.6L19.4,12z M12,15.5c-1.9,0-3.5-1.6-3.5-3.5s1.6-3.5,3.5-3.5s3.5,1.6,3.5,3.5S13.9,15.5,12,15.5z"/>
        </svg>
      </div>
      
      {/* Camera Controls */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)' }}>
          <div 
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: (showOverlay || !isRealCamera) ? 'var(--md-error)' : 'var(--md-success)' 
            }}
          ></div>
          <span>{showOverlay ? overlayText : (isRealCamera ? 'Kamera připojena' : 'Testovací režim')}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
          const isHttps = window.location.protocol === 'https:';
          const cameraUrl = isHttps ? 'https://89.24.76.191:10180' : 'http://89.24.76.191:10180';
          window.open(cameraUrl, '_blank');
        }}
            className="btn-icon md-ripple"
            style={{
              background: 'var(--md-surface-variant)',
              border: '1px solid var(--md-outline)',
              borderRadius: '8px',
              color: 'var(--md-on-surface-variant)',
              width: '32px',
              height: '32px'
            }}
            title="Otevřít kameru v novém okně"
          >
            <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
              <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
            </svg>
          </button>
          <button
            onClick={refreshCamera}  
            className="btn-icon md-ripple"
            style={{
              background: 'var(--md-surface-variant)',
              border: '1px solid var(--md-outline)',
              borderRadius: '8px',
              color: 'var(--md-on-surface-variant)',
              width: '32px',
              height: '32px'
            }}
            title="Obnovit kameru"
          >
            <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
              <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraView;