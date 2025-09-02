import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CameraView from '../components/CameraView';
import ThemeToggle from '../components/ThemeToggle';
import ConnectionLoader from '../components/ConnectionLoader';
import MqttDebug from '../components/MqttDebug';
import { mqttService } from '../services/mqttService';
import { activityService } from '../services/activityService';
import { useGateTimer } from '../hooks/useGateTimer';
import { locationService } from '../services/locationService';
import { lastUserService } from '../services/lastUserService';
import { distanceService } from '../services/distanceService';
import { settingsService } from '../services/settingsService';
import { garageTimerService, GarageTimerStatus } from '../services/garageTimerService';
import { wakeLockService } from '../services/wakeLockService';
import { updateService } from '../services/updateService';
import LastGateActivity from '../components/LastGateActivity';
import { useGateCoordination } from '../hooks/useGateCoordination';
import { ReservationQueue } from '../components/GateCoordination/ReservationQueue';
import { gateCoordinationService } from '../services/gateCoordinationService';
import GateCoordinationDebug from '../components/debug/GateCoordinationDebug';

const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { timerState, startTravelTimer, startAutoCloseTimer, startExtendedAutoCloseTimer, startOpenElapsedTimer, stopTimer } = useGateTimer();
  const { 
    coordinationState, 
    status: gateCoordinationStatus, 
    isLoading: coordinationLoading,
    error: coordinationError,
    requestControl,
    releaseControl,
    joinQueue,
    leaveQueue,
    updateGateState,
    cleanupSessions,
    clearError: clearCoordinationError
  } = useGateCoordination();
  const [gateStatus, setGateStatus] = useState('Neznámý stav');
  const [garageStatus, setGarageStatus] = useState('Neznámý stav');
  const [garageTimerStatus, setGarageTimerStatus] = useState<GarageTimerStatus | null>(null);
  const [garageSettings, setGarageSettings] = useState({ movementTime: 15, enabled: true });
  const [mqttConnected, setMqttConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [wasAutoOpened, setWasAutoOpened] = useState(false); // Flag pro sledování auto-open eventu
  const [distanceFromGate, setDistanceFromGate] = useState<number | null>(null);
  const [isLocationProximityAllowed, setIsLocationProximityAllowed] = useState<boolean>(true);
  const [showMqttDebug, setShowMqttDebug] = useState(false);
  
  // NOVÉ: Stav pro potvrzovací slider zavírání brány
  const [showCloseConfirmSlider, setShowCloseConfirmSlider] = useState(false);
  const [closeSliderPosition, setCloseSliderPosition] = useState(0);
  const [isSliderDragging, setIsSliderDragging] = useState(false);

  // Connection loading states
  const [showConnectionLoader, setShowConnectionLoader] = useState(true);
  const [connectionSteps, setConnectionSteps] = useState<Array<{
    label: string;
    status: 'pending' | 'loading' | 'success' | 'error';
    description: string;
  }>>([
    { label: 'Autentifikace', status: 'success', description: 'Přihlášení ověřeno' },
    { label: 'MQTT protokol', status: 'loading', description: 'Připojuji se...' },
    { label: 'Kontrola aktualizací', status: 'pending', description: 'Ověřuji verzi...' }
  ]);

  // Helper function to update connection step status
  const updateConnectionStep = (stepIndex: number, status: 'pending' | 'loading' | 'success' | 'error', description?: string) => {
    setConnectionSteps(prev => prev.map((step, index) => {
      if (index === stepIndex) {
        return { ...step, status, ...(description && { description }) };
      }
      return step;
    }));
  };

  // NOVÉ: Mapování MQTT stavů brány na koordinační stavy
  const mapGateStatusToCoordination = useCallback((mqttStatus: string): 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'STOPPED' | null => {
    if (mqttStatus.includes('zavřen') || mqttStatus.includes('Zavřena')) return 'CLOSED';
    if (mqttStatus.includes('otevřen') || mqttStatus.includes('Otevřena')) return 'OPEN';
    if (mqttStatus.includes('Otevírá se') || mqttStatus.includes('otevírá')) return 'OPENING';
    if (mqttStatus.includes('Zavírá se') || mqttStatus.includes('zavírá')) return 'CLOSING';
    if (mqttStatus.includes('STOP režim') || mqttStatus.includes('stop')) return 'STOPPED';
    return null; // Neznámý stav
  }, []);

  // NOVÉ: Funkce pro ovládání close confirmation slideru
  const handleSliderStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsSliderDragging(true);
  }, []);

  const handleSliderMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isSliderDragging) return;
    
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setCloseSliderPosition(position);
    
    // Pokud uživatel dotáhne slider na konec (>90%), potvrď zavření
    if (position > 90) {
      handleConfirmClose();
    }
  }, [isSliderDragging]);

  const handleSliderEnd = useCallback(() => {
    setIsSliderDragging(false);
    // Pokud slider není na konci, vrať ho na začátek
    if (closeSliderPosition < 90) {
      setCloseSliderPosition(0);
    }
  }, [closeSliderPosition]);

  const handleConfirmClose = useCallback(async () => {
    if (!currentUser) return;
    
    console.log('🚪 SLIDER: Spouštím zavření brány přes slider...');
    
    // NOVÉ: Okamžitě skryj slider a aktualizuj stav brány pro všechny
    setShowCloseConfirmSlider(false);
    setCloseSliderPosition(0);
    setIsSliderDragging(false);
    
    // NOVÉ: Aktualizuj stav brány lokálně pro okamžité UI feedback
    updateGateState('CLOSING');
    
    // Proveď zavření brány
    try {
      setLoading(true);
      playSound('click');
      
      console.log('🚪 SLIDER: Odesílám MQTT příkaz pro zavření brány...');
      
      const userInfo = getUserIdentifier();
      
      // MQTT pro zavření brány
      await mqttService.publishGateCommand(currentUser.email || '');
      console.log('✅ SLIDER: MQTT příkaz pro bránu odeslán úspěšně');
      
      // Send user ID to Log/Brana/ID topic (like original HTML)
      const logMessage = `ID: ${userInfo}`;
      await mqttService.publishMessage('Log/Brana/ID', logMessage);
      console.log('✅ SLIDER: Log message odeslán:', logMessage);
      
      console.log('🚪 SLIDER: Close confirmed via slider - command sent successfully');
      playSound('success');
    } catch (error) {
      console.error('❌ Chyba při zavírání brány přes slider:', error);
      playSound('error');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const handleCancelCloseSlider = useCallback(() => {
    setShowCloseConfirmSlider(false);
    setCloseSliderPosition(0);
    setIsSliderDragging(false);
    playSound('click');
  }, []);

  // Check if all critical steps are completed (hide loader)
  const checkConnectionComplete = async () => {
    // Kritické kroky: Auth, MQTT (Stav brány odstraněn - není kritický)
    const criticalSteps = [0, 1]; // Auth, MQTT
    const allCriticalComplete = criticalSteps.every(index => 
      connectionSteps[index]?.status === 'success'
    );
    
    // Gate status check není potřebný - data přijdou postupně přes polling
    const hasRealGateStatus = true; // Vždy true, neblokujeme na gate status
    
    // Když jsou kritické kroky hotové, spusť update check
    if (allCriticalComplete && hasRealGateStatus && connectionSteps[2]?.status === 'pending') {
      console.log('🔄 Critical steps completed, starting update check...');
      updateConnectionStep(2, 'loading', 'Kontroluji novou verzi...');
      
      try {
        // const updateResult = await updateService.checkForUpdates(); // DOČASNĚ VYPNUTO
        const updateResult = { hasUpdate: false }; // Mock response
        
        if (updateResult.hasUpdate) {
          console.log('🎉 Update available, prompting user...');
          updateConnectionStep(2, 'error', 'Nová verze k dispozici');
          
          // Update notification se triggernuje automaticky přes Service Worker
          setTimeout(() => {
            setShowConnectionLoader(false);
          }, 1000);
          return;
        } else {
          console.log('✅ App is up to date');
          updateConnectionStep(2, 'success', 'Aktuální verze');
        }
      } catch (error) {
        console.error('❌ Update check failed:', error);
        updateConnectionStep(2, 'success', 'Přeskočeno'); // Nepřerušuj kvůli update check
      }
    }
    
    // Všechny kroky včetně update check hotové
    const allStepsComplete = connectionSteps.every(step => 
      step.status === 'success' || step.status === 'error'
    );
    
    if (allStepsComplete && hasRealGateStatus && showConnectionLoader) {
      console.log('🎯 All steps completed, hiding loader...');
      setTimeout(() => setShowConnectionLoader(false), 500);
    }
  };

  // Camera status callback (jen pro console, ne pro connection steps)
  const handleCameraStatusChange = useCallback((status: 'loading' | 'success' | 'error', message?: string) => {
    console.log('📸 Camera status changed:', status, message);
    // Kamera se už nesleduje v connection loaderu
  }, []);

  // Helper function to play sound feedback
  const playSound = (type: 'click' | 'success' | 'error') => {
    try {
      // Create audio context if it doesn't exist
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      let frequency: number;
      let duration: number;
      
      switch (type) {
        case 'click':
          frequency = 800;
          duration = 100;
          break;
        case 'success':
          frequency = 1000;
          duration = 200;
          break;
        case 'error':
          frequency = 400;
          duration = 300;
          break;
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
      
    } catch (error) {
      console.log('Sound playback not available:', error);
    }
  };

  // Helper function to get user identifier for MQTT messages
  const getUserIdentifier = (): string => {
    if (currentUser?.nick && currentUser.nick.trim()) {
      return currentUser.nick;
    }
    return currentUser?.displayName || currentUser?.email || 'Neznámý';
  };

  // Helper function to continuously check and update user distance from gate
  const updateDistanceFromGate = async () => {
    // If user doesn't have location proximity requirement, always allow
    if (!currentUser?.permissions?.requireLocationProximity) {
      setIsLocationProximityAllowed(true);
      setDistanceFromGate(null);
      return;
    }

    try {
      // Get current user location
      const userLocation = await locationService.getCurrentLocation();
      
      // Get gate settings
      const settings = await settingsService.getAppSettings();
      const gateLocation = {
        latitude: settings.location.gateLatitude,
        longitude: settings.location.gateLongitude
      };

      // Calculate distance
      const distance = distanceService.calculateDistance(
        userLocation, gateLocation
      );

      setDistanceFromGate(Math.round(distance));
      
      // Check if within allowed distance
      const maxDistance = settings.location.maxDistanceMeters;
      const allowed = distance <= maxDistance;
      setIsLocationProximityAllowed(allowed);

      console.log(`📍 Distance from gate: ${Math.round(distance)}m, allowed: ${allowed} (max: ${maxDistance}m)`);
      
    } catch (error) {
      console.error('Error checking location proximity:', error);
      setDistanceFromGate(null);
      setIsLocationProximityAllowed(false);
    }
  };

  // Helper function to check if user is within allowed distance for gate operations
  const checkLocationProximity = async (): Promise<{ allowed: boolean; message?: string }> => {
    // If user doesn't have location proximity requirement, allow operation
    if (!currentUser?.permissions?.requireLocationProximity) {
      return { allowed: true };
    }

    try {
      // Get current user location
      const userLocation = await locationService.getCurrentLocation();
      
      // Get gate settings
      const settings = await settingsService.getAppSettings();
      const gateLocation = {
        latitude: settings.location.gateLatitude,
        longitude: settings.location.gateLongitude
      };

      // Check if user is within allowed distance
      const distance = distanceService.calculateDistance(userLocation, gateLocation);
      const isWithinDistance = distance <= settings.location.maxDistanceMeters;

      if (isWithinDistance) {
        return { allowed: true };
      } else {
        const formattedDistance = distanceService.formatDistance(distance);
        const maxDistanceFormatted = distanceService.formatDistance(settings.location.maxDistanceMeters);
        return { 
          allowed: false, 
          message: `Jste příliš daleko od brány (${formattedDistance}). Maximální vzdálenost: ${maxDistanceFormatted}` 
        };
      }
    } catch (error) {
      console.error('📍 Dashboard: Location proximity check failed:', error);
      return { 
        allowed: false, 
        message: 'Nelze ověřit vaši polohu. Zkuste to znovu.' 
      };
    }
  };

  // MQTT Status Subscription (connection managed globally in App.tsx)
  useEffect(() => {
    console.log('🔧 Dashboard: Subscribing to MQTT status changes...');
    console.log('🔧 Dashboard: currentUser:', currentUser);
    console.log('🔧 Dashboard: Force triggering MQTT connection...');
    
    // FORCE MQTT connection if it hasn't started + DETAILED DEBUG
    if (currentUser) {
      console.log('🚀 Dashboard: Force connecting MQTT...');
      console.log('🔍 Dashboard: MQTT Service broker URL check...');
      
      // Log the exact URL that will be used
      const isHttps = window.location.protocol === 'https:';
      const hostname = window.location.hostname;
      console.log('🌐 Dashboard: Protocol:', window.location.protocol);
      console.log('🌐 Dashboard: Hostname:', hostname);
      console.log('🌐 Dashboard: isHttps:', isHttps);
      
      if (isHttps) {
        console.log('🔄 Dashboard: Will use HTTP MQTT proxy service');
      } else {
        if (hostname === 'localhost') {
          console.log('🏠 Dashboard: Will use LOCAL MQTT broker: ws://172.19.3.200:9001');
        } else {
          console.log('🌍 Dashboard: Will use EXTERNAL MQTT broker: ws://89.24.76.191:9001');
        }
      }
      
      mqttService.connect().then(() => {
        console.log('✅ Dashboard: MQTT connected successfully');
      }).catch((error) => {
        console.error('❌ Dashboard: MQTT connection failed:', error);
      });
    }
    
    // Get initial status immediately
    const initialStatus = mqttService.getStatus();
    console.log('🔧 Dashboard: Initial MQTT status:', initialStatus);
    setGateStatus(initialStatus.gateStatus);
    setGarageStatus(initialStatus.garageStatus);
    setMqttConnected(initialStatus.isConnected);

    // Update connection steps based on initial status
    if (initialStatus.isConnected) {
      updateConnectionStep(1, 'success', 'Připojeno');
      // Stav brány krok odstraněn - není potřebný pro connection loading
    } else {
      updateConnectionStep(1, 'loading', 'Připojuji se...');
    }

    // Subscribe to status changes (don't manage connection here)
    const unsubscribe = mqttService.onStatusChange((status) => {
      console.log('🔧 Dashboard: MQTT status changed:', status);
      console.log('🔧 Dashboard: Updating React state...');
      
      const prevGateStatus = gateStatus;
      setGateStatus(status.gateStatus);
      setGarageStatus(status.garageStatus); 
      setMqttConnected(status.isConnected);

      // NOVÉ: Aktualizuj stav brány v koordinační službě pro automatické otevření
      if (status.gateStatus !== prevGateStatus) {
        const coordinationState = mapGateStatusToCoordination(status.gateStatus);
        if (coordinationState) {
          console.log('🚨 DEBUG: Aktualizuji gate state pro koordinaci:', coordinationState);
          updateGateState(coordinationState);
          
          // NOVÉ: PODMÍNĚNÝ RESET koordinace když se brána zavře
          // JEN pokud není ve frontě nikdo (jinak nech auto-open běžet)
          if (coordinationState === 'CLOSED') {
            console.log('🔄 RESET CHECK: Brána zavřena - kontroluji zda resetovat koordinaci');
            
            // Delay aby se auto-open stihl spustit (spouští se při CLOSING)
            setTimeout(async () => {
              try {
                const { gateCoordinationService } = await import('../services/gateCoordinationService');
                const currentState = await gateCoordinationService.getCurrentState();
                
                // Reset jen pokud není fronta nebo už proběhlo auto-open
                if (!currentState || currentState.reservationQueue.length === 0) {
                  console.log('🔄 RESET: Žádná fronta - resetuji koordinaci');
                  resetCoordinationOnGateClosed().catch(err => console.warn('Reset coordination failed:', err));
                } else {
                  console.log('🔄 RESET: Fronta stále existuje - ponechávám koordinaci pro auto-open');
                }
              } catch (err) {
                console.warn('🔄 RESET: Chyba při kontrole fronty:', err);
              }
            }, 3000); // 3 sekundy delay - víc než auto-open (2s)
          }
        }
      }

      // Update connection steps
      if (status.isConnected) {
        updateConnectionStep(1, 'success', 'Připojeno');
        // Stav brány krok odstraněn - není potřebný pro connection loading
      } else {
        updateConnectionStep(1, 'error', 'Chyba připojení');
      }
      
      // Handle timer logic based on gate status changes
      const isMoving = status.gateStatus.includes('se...') || status.gateStatus.includes('Otevírá') || status.gateStatus.includes('Zavírá');
      const isOpen = status.gateStatus.includes('otevřen') || status.gateStatus.includes('Otevřena');
      const isClosed = status.gateStatus.includes('zavřen') || status.gateStatus.includes('Zavřena');
      const isStopMode = status.gateStatus.includes('STOP režim') || status.gateStatus === 'STOP režim';
      
      // Duplicitní mapping logic odstraněna - používá se mapGateStatusToCoordination výše
      
      if (isMoving) {
        // Spustí travel timer pouze pokud ještě neběží
        if (timerState.type !== 'travel' || !timerState.isActive) {
          console.log('🔧 Dashboard: Gate is moving, starting travel timer');
          startTravelTimer();
        }
      } else if (isOpen && !prevGateStatus.includes('otevřen')) {
        // Spustí auto-close timer pouze pokud ještě neběží
        if (timerState.type !== 'autoClose' || !timerState.isActive) {
          if (wasAutoOpened) {
            console.log('🔧 Dashboard: Gate opened via AUTO-OPEN, starting extended auto-close timer (8 min)');
            startExtendedAutoCloseTimer();
            setWasAutoOpened(false); // Reset flag
          } else {
            console.log('🔧 Dashboard: Gate opened normally, starting standard auto-close timer (4 min)');
            startAutoCloseTimer();
          }
          console.log('🔧 Dashboard: Gate status changed from', prevGateStatus, 'to', status.gateStatus);
        }
      } else if (isOpen && prevGateStatus.includes('otevřen')) {
        // Brána je stále otevřená - spustí auto-close timer pouze pokud žádný neběží
        if (!timerState.isActive) {
          console.log('🔧 Dashboard: Gate remains open, starting auto-close timer');
          startAutoCloseTimer();
        }
      } else if (isClosed) {
        console.log('🔧 Dashboard: Gate closed, stopping timers');
        stopTimer();
        
        // AUTO-RELEASE: Uvolni kontrolu když se brána zavře
        if (gateCoordinationStatus.isActive) {
          console.log('🔄 Dashboard: Auto-releasing control after gate closed');
          setTimeout(async () => {
            try {
              await releaseControl();
              console.log('✅ Dashboard: Control auto-released after gate closed');
            } catch (error) {
              console.warn('⚠️ Dashboard: Auto-release after close failed:', error);
            }
          }, 1000); // 1s delay to ensure gate is fully closed
        }
      } else if (isStopMode) {
        console.log('🛑 Dashboard: STOP režim detected from MQTT, stopping all timers');
        stopTimer();
      }
      
      console.log('🔧 Dashboard: React state updated - mqttConnected:', status.isConnected);
    });

    return () => {
      unsubscribe();
      // Connection is managed globally in App.tsx - don't disconnect here!
    };
  }, []);

  // NOVÉ: Handler pro automatické otevření brány z koordinační služby
  useEffect(() => {
    const handleAutoOpen = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { userId, userDisplayName } = customEvent.detail;
      console.log('🚪 AUTO-OPEN: Event přijat pro', userDisplayName);
      
      if (!currentUser?.permissions.gate) {
        console.warn('🚪 AUTO-OPEN: Uživatel nemá oprávnění pro ovládání brány');
        return;
      }

      if (!mqttConnected) {
        console.warn('🚪 AUTO-OPEN: MQTT není připojen');
        return;
      }

      try {
        console.log('🚪 AUTO-OPEN: Odesílám MQTT příkaz...');
        
        // Označím že brána byla otevřena auto-open
        setWasAutoOpened(true);
        
        await mqttService.publishGateCommand(currentUser.email || '');
        
        // Send user ID to Log/Brana/ID topic
        const logMessage = `ID: ${getUserIdentifier()}`;
        await mqttService.publishMessage('Log/Brana/ID', logMessage);
        console.log('🚪 AUTO-OPEN: Příkaz odeslán úspěšně');
        
      } catch (error) {
        console.error('🚪 AUTO-OPEN: Chyba při odesílání MQTT příkazu:', error);
      }
    };

    window.addEventListener('gate-auto-open', handleAutoOpen);
    
    return () => {
      window.removeEventListener('gate-auto-open', handleAutoOpen);
    };
  }, [currentUser, mqttConnected, mqttService]);

  // GPS permission request - only if required by user permissions
  useEffect(() => {
    const requestLocation = async () => {
      // Skip GPS if not required for this user
      if (!currentUser?.permissions?.requireLocation) {
        console.log('📍 Dashboard: GPS not required for this user, skipping');
        setLocationPermission(true); // Set as "allowed" so UI doesn't show error
        setLocationError('');
        // GPS na pozadí - nesleduje se v connection loaderu
        return;
      }

      // GPS na pozadí - nesleduje se v connection loaderu

      if (!locationService.isLocationSupported() || !locationService.isSecureContext()) {
        const reason = locationService.getLocationUnavailableReason();
        setLocationError(reason);
        setLocationPermission(false);
        // GPS error - na pozadí
        console.log('📍 Dashboard: GPS unavailable:', reason);
        return;
      }

      try {
        const hasPermission = await locationService.requestPermission();
        setLocationPermission(hasPermission);
        
        if (hasPermission) {
          console.log('📍 Dashboard: GPS permission granted, starting location tracking');
          // GPS loading - na pozadí
          await locationService.startWatching();
          
          // Získáme aktuální lokaci hned
          try {
            const currentLoc = await locationService.getCurrentLocation();
            setCurrentLocation(currentLoc);
            
            if (currentLoc.accuracy > 50000) {
              setLocationError('Fallback lokace (Praha centrum)');
              // GPS fallback - na pozadí
            } else {
              setLocationError('');
              // GPS success - na pozadí
            }
            
            // Update distance from gate for the first time
            await updateDistanceFromGate();
          } catch (error: any) {
            console.warn('📍 Dashboard: Could not get initial location:', error);
            setLocationError('GPS nedostupné');
            // GPS error - na pozadí
          }
        } else {
          console.log('📍 Dashboard: GPS permission denied');
          setLocationError('Oprávnění k lokaci bylo odepřeno');
          // GPS permission denied - na pozadí
        }
      } catch (error: any) {
        console.warn('📍 Dashboard: GPS permission error:', error);
        setLocationPermission(false);
        
        let errorMsg = 'Chyba při získávání GPS';
        if (error.message && error.message.includes('429')) {
          errorMsg = 'Google API limit překročen (desktop bez GPS)';
        } else if (error.code === 2) {
          errorMsg = 'GPS nedostupné (možná desktop bez GPS čipu)';
        } else {
          errorMsg = errorMsg + ': ' + (error.message || 'Neznámá chyba');
        }
        
        setLocationError(errorMsg);
        // GPS general error - na pozadí
      }
    };

    requestLocation();

    return () => {
      locationService.stopWatching();
    };
  }, []);

  // Check permissions and finalize connection steps
  useEffect(() => {
    if (currentUser) {
      // Oprávnění se už nesledují v connection loaderu
    }
  }, [currentUser]);

  // Monitor connection completion
  useEffect(() => {
    checkConnectionComplete();
  }, [connectionSteps]);

  // Periodically update distance from gate for location-restricted users
  useEffect(() => {
    if (!currentUser?.permissions?.requireLocationProximity) {
      return;
    }

    // Update distance immediately
    updateDistanceFromGate();

    // Then update every 5 seconds
    const interval = setInterval(() => {
      updateDistanceFromGate();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser?.permissions?.requireLocationProximity, currentLocation]);

  // Backup check for MQTT status every 5 seconds
  useEffect(() => {
    const statusCheck = setInterval(() => {
      const currentStatus = mqttService.getStatus();
      if (currentStatus.isConnected !== mqttConnected) {
        console.log('🔧 Dashboard: Status sync fix - updating from', mqttConnected, 'to', currentStatus.isConnected);
        setMqttConnected(currentStatus.isConnected);
        setGateStatus(currentStatus.gateStatus);
        setGarageStatus(currentStatus.garageStatus);
      }
    }, 5000);

    return () => clearInterval(statusCheck);
  }, [mqttConnected]);

  // NOVÉ: Callback pro automatické otevření při zavírání (chytré čekání)
  useEffect(() => {
    // Import pro gateCoordinationService
    const { gateCoordinationService } = require('../services/gateCoordinationService');
    
    gateCoordinationService.onAutoOpeningTriggered((userId: string) => {
      if (currentUser?.id === userId) {
        console.log('🔧 Dashboard: Automatické otevření spuštěno pro uživatele:', currentUser.displayName);
        // Automaticky otevři bránu po 2 sekundách
        setTimeout(async () => {
          try {
            console.log('🔧 Dashboard: Odesílám automatické otevření...');
            await mqttService.publishGateCommand(currentUser.email || '');
            
            // Loguj aktivitu
            await activityService.logActivity({
              user: currentUser.email || '',
              userDisplayName: currentUser.displayName || currentUser.email || 'Neznámý uživatel',
              action: 'Automatické otevření brány',
              device: 'gate',
              status: 'success',
              details: 'Brána automaticky otevřena kvůli čekajícímu uživateli'
            });
            
          } catch (error) {
            console.error('🔧 Dashboard: Chyba při automatickém otevření:', error);
          }
        }, 2000);
      }
    });
  }, [currentUser]);

  // NOVÉ: Real-time notifikace pro koordinaci mezi uživateli
  useEffect(() => {
    const { gateCoordinationService } = require('../services/gateCoordinationService');
    
    // Handler pro real-time změny stavu koordinace
    gateCoordinationService.onCoordinationStateChange((state: any) => {
      console.log('🔄 Dashboard: Koordinace změněna:', state);
      
      // Zobrazit notifikace o změnách
      if (state.activeUser && state.activeUser.userId !== currentUser?.id) {
        // Někdo jiný převzal ovládání
        const message = `🎮 ${state.activeUser.userDisplayName} nyní ovládá bránu`;
        console.log('📢 Notifikace:', message);
        
        // Zobrazit toast notifikaci (pokud je uživatel aktivní na stránce)
        if (!document.hidden) {
          // Dočasně zobrazit alert - později můžeme přidat toast systém
          // alert(message);
          console.log('📢 Real-time notifikace:', message);
        }
      }
      
      // Pokud je uživatel další v pořadí
      if (currentUser?.id && state.reservationQueue.length > 0) {
        const nextUser = state.reservationQueue[0];
        if (nextUser.userId === currentUser.id && !state.activeUser) {
          const message = 'ℹ️ Jste další na řadě pro ovládání brány!';
          console.log('📢 Notifikace:', message);
          playSound('success');
          
          // Zobrazit důležitou notifikaci
          if (!document.hidden) {
            // alert(message);
            console.log('📢 Real-time notifikace:', message);
          }
        }
      }
    });
    
    // Uklidíme registraci při unmount
    return () => {
      // gateCoordinationService cleanup je již řešen v useGateCoordination hooku
    };
  }, [currentUser]);

  // Auto-cleanup: Release control when user closes app or goes offline
  // KRITICKÁ OPRAVA: Disable immediate cleanup - interferuje s user registration
  // useEffect(() => {
  //   const immediateCleanup = async () => {
  //     try {
  //       console.log('🧹 Dashboard: Running immediate coordination cleanup on mount...');
  //       await cleanupSessions();
  //       console.log('✅ Dashboard: Immediate cleanup completed');
  //     } catch (error) {
  //       console.warn('⚠️ Dashboard: Immediate cleanup failed:', error);
  //     }
  //   };
  //   
  //   immediateCleanup();
  // }, []); // DISABLED - causes activeUser registration interference

  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('🔄 Dashboard: App closing - releasing gate control...');
      if (gateCoordinationStatus.isActive) {
        // Synchronous release (no await in beforeunload)
        releaseControl().catch(console.error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && gateCoordinationStatus.isActive) {
        console.log('🔄 Dashboard: App hidden - releasing gate control after delay...');
        // Release control after 5 minutes of being hidden
        setTimeout(() => {
          if (document.hidden) {
            releaseControl().catch(console.error);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gateCoordinationStatus.isActive, releaseControl]);

  // GPS location check every 30 seconds
  useEffect(() => {
    const locationCheck = setInterval(() => {
      if (locationPermission === true) {
        const cachedLocation = locationService.getCachedLocation();
        if (cachedLocation) {
          setCurrentLocation(cachedLocation);
          
          if (cachedLocation.accuracy > 50000) {
            setLocationError('Fallback lokace (Praha centrum)');
          } else {
            setLocationError('');
          }
        } else {
          setLocationError('GPS nedostupné');
        }
      }
    }, 30000);

    return () => clearInterval(locationCheck);
  }, [locationPermission]);

  // Periodic cleanup of stale coordination sessions - REDUCED FREQUENCY
  useEffect(() => {
    const cleanupInterval = setInterval(async () => {
      try {
        console.log('🧹 Dashboard: Running periodic coordination cleanup...');
        await cleanupSessions();
      } catch (error) {
        console.warn('⚠️ Dashboard: Periodic cleanup failed:', error);
      }
    }, 15 * 60 * 1000); // OPRAVA: Každých 15 minut místo 2 minut - méně interference

    return () => clearInterval(cleanupInterval);
  }, [cleanupSessions]);

  // Load garage settings and setup garage timer
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const appSettings = await settingsService.getAppSettings();
        setGarageSettings(appSettings.garage);
        console.log('🏠 Dashboard: Garage settings loaded:', appSettings.garage);
      } catch (error) {
        console.error('🏠 Dashboard: Failed to load garage settings:', error);
      }
    };

    loadSettings();

    // Setup garage timer service listener
    const unsubscribe = garageTimerService.onStatusChange((status) => {
      console.log(`🏠 Dashboard: Timer update: ${status.state} (${status.timeRemaining}s)`);
      setGarageTimerStatus(status);
    });

    return unsubscribe;
  }, []);

  // Initial P1 check - force garage to closed if MQTT says P1
  useEffect(() => {
    // Wait a bit for MQTT to initialize, then check if we have P1
    const checkInitialState = setTimeout(() => {
      const currentMqttStatus = mqttService.getStatus();
      console.log('🏠 Dashboard: Initial MQTT check:', currentMqttStatus);
      
      if (currentMqttStatus.garageStatus === 'Garáž zavřena') {
        console.log('🏠 Dashboard: Initial P1 detected, forcing garage timer to closed');
        garageTimerService.forceCloseState();
      }
    }, 2000); // Wait 2s for MQTT to initialize

    return () => clearTimeout(checkInitialState);
  }, []);

  // Wake Lock - keep screen on for PWA
  useEffect(() => {
    const enableWakeLock = async () => {
      try {
        const success = await wakeLockService.requestWakeLock();
        if (success) {
          console.log('💡 Dashboard: Wake lock activated - screen will stay on');
        } else {
          console.log('💡 Dashboard: Wake lock fallback methods activated');
        }
      } catch (error) {
        console.error('💡 Dashboard: Wake lock failed:', error);
      }
    };

    // Enable wake lock when dashboard loads
    enableWakeLock();

    // Re-enable wake lock when page becomes visible (user returns to app)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('💡 Dashboard: Page visible - re-enabling wake lock');
        enableWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLockService.cleanup();
      console.log('💡 Dashboard: Wake lock cleaned up');
    };
  }, []);

  // Handle P1 messages from MQTT - force garage to closed state
  useEffect(() => {
    if (garageStatus === 'Garáž zavřena') {
      console.log('🏠 Dashboard: P1 received, forcing garage timer to closed state');
      garageTimerService.forceCloseState();
    }
  }, [garageStatus]);

  // Handler pro opuštění fronty z ReservationQueue komponenty
  const handleLeaveQueue = useCallback(async () => {
    if (currentUser) {
      try {
        await leaveQueue();
        console.log('🚨 DEBUG: Uživatel opustil frontu přes ReservationQueue');
      } catch (error) {
        console.error('🚨 ERROR: Chyba při opouštění fronty:', error);
      }
    }
  }, [currentUser, leaveQueue]);

  // NOVÉ: Reset koordinace po zavření brány - vyčisti frontu + active user
  const resetCoordinationOnGateClosed = useCallback(async () => {
    try {
      console.log('🔄 RESET: Resetuji koordinaci po zavření brány...');
      
      // Import gateCoordinationService
      const { gateCoordinationService } = await import('../services/gateCoordinationService');
      const currentState = await gateCoordinationService.getCurrentState();
      
      if (currentState && (currentState.activeUser || currentState.reservationQueue.length > 0)) {
        console.log('🔄 RESET: Vymažu activeUser + frontu po zavření brány');
        
        // Force clear activeUser and queue - brána zavřena = reset
        await gateCoordinationService['coordinationDoc'].set({
          activeUser: null,
          reservationQueue: [],
          gateState: 'CLOSED',
          lastActivity: Date.now(),
          connectedUsers: currentState.connectedUsers || {} // Zachovej připojené uživatele
        });
        
        console.log('✅ RESET: Koordinace resetována po zavření brány');
      } else {
        console.log('🔄 RESET: Žádná koordinace k resetování');
      }
    } catch (error) {
      console.error('❌ RESET: Chyba při resetování koordinace:', error);
    }
  }, []);

  // DEBUGGING: Reset coordination state - temporary function
  const handleResetCoordination = useCallback(async () => {
    try {
      console.log('🔧 DEBUG: Spouštím cleanup coordination sessions...');
      await cleanupSessions();
      
      // FORCE reset - directly clear Firebase state
      console.log('🔧 DEBUG: Force clearing Firebase coordination state...');
      const { gateCoordinationService } = await import('../services/gateCoordinationService');
      const currentState = await gateCoordinationService.getCurrentState();
      if (currentState) {
        console.log('🔧 DEBUG: Current state before reset:', currentState);
        // Force clear activeUser and queue
        await gateCoordinationService['coordinationDoc'].set({
          activeUser: null,
          reservationQueue: [],
          gateState: 'CLOSED',
          lastActivity: Date.now(),
        });
        console.log('✅ DEBUG: Firebase coordination state forcibly cleared');
      }
      
      playSound('success');
      alert('Koordinační stav byl resetován. Obnovte stránku.');
    } catch (error) {
      console.error('❌ Chyba při resetování koordinace:', error);
      playSound('error');
    }
  }, [cleanupSessions]);

  // NOVÉ: Global event listeners for slider dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isSliderDragging) {
        handleSliderMove(e as any);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isSliderDragging) {
        handleSliderEnd();
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isSliderDragging) {
        handleSliderMove(e as any);
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isSliderDragging) {
        handleSliderEnd();
      }
    };

    if (isSliderDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove);
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isSliderDragging, handleSliderMove, handleSliderEnd]);

  const handleGateControl = async () => {
    // Play click sound
    playSound('click');
    
    if (!currentUser?.permissions.gate) {
      playSound('error');
      alert('Nemáte oprávnění k ovládání brány');
      return;
    }

    if (!mqttConnected) {
      playSound('error');
      alert('MQTT není připojen');
      return;
    }

    // Check location proximity if required (now handled by UI state)
    if (!isLocationProximityAllowed) {
      playSound('error');
      console.log('📍 Gate operation blocked by location proximity');
      return;
    }

    // OKAMŽITÉ UI FEEDBACK: Nastav loading state hned na začátku
    setLoading(true);

    // KRITICKÉ: Blokovat normální ovládání pokud uživatel musí použít slider
    if (gateCoordinationStatus.mustUseSlider) {
      playSound('error');
      console.log('🚫 Normální ovládání zablokováno - použijte slider pro zavření brány');
      alert('⚠️ Při čekající frontě použijte slider pro zavření brány');
      setLoading(false); // Reset loading state
      return;
    }

    // DEBUG: Zobraz stav koordinace
    console.log('🚨 DEBUG: handleGateControl - gateCoordinationStatus:', gateCoordinationStatus);
    console.log('🚨 DEBUG: isBlocked:', gateCoordinationStatus.isBlocked);
    console.log('🚨 DEBUG: isInQueue:', gateCoordinationStatus.isInQueue);
    console.log('🚨 DEBUG: isActive:', gateCoordinationStatus.isActive);

    // NOVÉ WORKFLOW: Inteligentní koordinace podle specifikace uživatele
    
    // Pokud jsem ve frontě
    if (gateCoordinationStatus.isInQueue) {
      // Pokud jsem první ve frontě → pokusit se o převzetí kontroly
      if (gateCoordinationStatus.position === 1 && gateCoordinationStatus.canStartControl) {
        console.log('🚨 DEBUG: Jsem první ve frontě a můžu převzít kontrolu...');
        // Opustit frontu a pokusit se o kontrolu
        await leaveQueue();
        // Pokračovat s kontrolou níže
      } else {
        // Jinak → opustit frontu
        console.log('🚨 DEBUG: Opouštím frontu...');
        await leaveQueue();
        playSound('success');
        setLoading(false); // Reset loading state
        return;
      }
    }
    
    // Pokud někdo aktivně ovládá a já nejsem ve frontě → zařadit do fronty
    if (gateCoordinationStatus.isBlocked && !gateCoordinationStatus.isInQueue) {
      console.log('🚨 DEBUG: Někdo aktivně ovládá, zařazuji se do fronty...');
      const success = await joinQueue();
      if (success) {
        playSound('success');
        // Místo alert použít toast notifikaci nebo console log
        console.log(`✅ Úspěšně zařazen do fronty. Aktivní uživatel: ${gateCoordinationStatus.activeUser}`);
      } else {
        playSound('error');
        console.log('❌ Nepodařilo se zařadit do fronty');
      }
      setLoading(false); // Reset loading state
      return;
    }

    // OPRAVA: Umožnit aktivnímu uživateli okamžité opakované ovládání brány
    // Pokud jsem již aktivní uživatel, přeskoč registraci a jdi rovnou na MQTT
    if (gateCoordinationStatus.isActive) {
      console.log('✅ DEBUG: Už jsem aktivní uživatel - pokračuji přímo s MQTT příkazem');
      // Přeskočit celou registrační logiku a jít rovnou na MQTT
    } else {
      // NOVÉ: Pokud nejsem aktivní, pokusit se o registraci (ignorovat canStartControl kolísání)
      console.log('🚨 DEBUG: Nikdo aktivně neovládá, začínám ovládat...');
      const controlGranted = await requestControl();
      if (!controlGranted) {
        playSound('error');
        setLoading(false);
        // Pokud se nepodařilo získat kontrolu, možná mezitím někdo jiný začal
        return;
      }
      
      // KRITICKÁ OPRAVA: Čekat na Firebase real-time callback potvrzení
      console.log('✅ DEBUG: requestControl() úspěšný, čekám na Firebase callback...');
      
      // Čekat max 2 sekundy na Firebase real-time callback
      let waitCount = 0;
      const maxWait = 20; // 20 x 100ms = 2 sekundy
      
      while (waitCount < maxWait) {
        // Počkat 100ms před další kontrolou
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
        
        // KRITICKÁ OPRAVA: Číst čerstvý stav přímo z Firebase (ne z React state)
        const currentCoordState = await gateCoordinationService.getCurrentState();
        if (currentCoordState && currentUser) {
          const userId = currentUser.id; // OPRAVA: User má property 'id', ne 'uid'
          
          // Zkontroluj, zda jsem aktivní uživatel v Firebase
          if (currentCoordState.activeUser && currentCoordState.activeUser.userId === userId) {
            console.log('✅ DEBUG: Firebase callback dorazil - jsem aktivní uživatel, pokračuji s MQTT');
            break;
          }
          
          // Zkontroluj, zda mě někdo předběhl
          if (currentCoordState.activeUser && currentCoordState.activeUser.userId !== userId) {
            console.log('❌ DEBUG: Firebase callback - někdo mě předběhl, končím');
            playSound('error');
            setLoading(false);
            return;
          }
        }
        
        console.log(`🔄 DEBUG: Wait loop ${waitCount}/${maxWait} - čekám na Firebase callback...`);
      }
      
      // Finální kontrola po čekání - znovu z Firebase
      const finalCoordState = await gateCoordinationService.getCurrentState();
      if (!finalCoordState?.activeUser || finalCoordState.activeUser.userId !== currentUser?.id) {
        console.log('❌ DEBUG: Timeout na Firebase callback - nejsem aktivní uživatel, končím');
        playSound('error');
        setLoading(false);
        return;
      }
    }

    // Po úspěšné kontrole (buď už jsem byl aktivní, nebo jsem se právě stal aktivním) pokračuj s MQTT
    console.log('🚀 DEBUG: Firebase synchronizace úspěšná - pokračuji s MQTT příkazem');

    // NOVÝ WORKFLOW: Zkontroluj zda musí uživatel použít slider pro zavření
    if (gateCoordinationStatus.mustUseSlider && 
        (gateStatus.includes('otevřen') || gateStatus.includes('Otevřena'))) {
      console.log('🚨 WORKFLOW DEBUG: mustUseSlider=true - zobrazuji slider pro potvrzení zavření');
      console.log('🚨 WORKFLOW DEBUG: Queue length:', gateCoordinationStatus.queueLength, 'Next user:', gateCoordinationStatus.activeUser);
      playSound('click');
      setShowCloseConfirmSlider(true);
      return;
    }

    // Pokud už jsem aktivní, pokračuj normálně s MQTT příkazem
    console.log('✅ DEBUG: Potvrzeno aktivní stav, pokračuji s MQTT příkazem...');

    // NOVÉ: Kontrola zda se brána už nepohybuje - zabránit konfliktům
    const isGateMoving = gateStatus.includes('se...') || gateStatus.includes('Otevírá') || gateStatus.includes('Zavírá');
    if (isGateMoving) {
      console.log('🚫 MQTT BLOCK: Brána se už pohybuje, blokuji další příkaz:', gateStatus);
      playSound('error');
      alert(`⚠️ Brána se právě ${gateStatus.includes('Otevírá') ? 'otevírá' : 'zavírá'}. Počkejte až dokončí pohyb.`);
      setLoading(false);
      return;
    }

    // Loading už je true z předchozího nastavení
    let mqttCommandSucceeded = false;
    
    try {
      console.log('🔧 Dashboard: Sending gate command...');
      
      // Step 1: Send MQTT commands (critical part)
      await mqttService.publishGateCommand(currentUser.email || '');
      
      // Send user ID to Log/Brana/ID topic (like original HTML)
      const logMessage = `ID: ${getUserIdentifier()}`;
      await mqttService.publishMessage('Log/Brana/ID', logMessage);
      console.log('🔧 Dashboard: User log sent to Log/Brana/ID:', logMessage);
      
      mqttCommandSucceeded = true; // MQTT commands succeeded
      console.log('✅ Dashboard: MQTT commands sent successfully');
      
      // NOVÉ: Okamžitě vypni loading po úspěšném MQTT - UI feedback
      setLoading(false);
      
    } catch (mqttError) {
      console.error('❌ Dashboard: MQTT command failed:', mqttError);
      
      // Log MQTT failure
      try {
        await activityService.logActivity({
          user: currentUser.email || '',
          userDisplayName: getUserIdentifier(),
          action: 'Pokus o ovládání brány',
          device: 'gate',
          status: 'error',
          details: `Chyba při MQTT příkazu: ${(mqttError as Error).message}`
        }, false); // Always include GPS location in logs
      } catch (logError) {
        console.error('Failed to log MQTT error:', logError);
      }
      
      playSound('error');
      alert('Chyba při odesílání příkazu');
      setLoading(false);
      return;
    }
    
    // Step 2: Log activity (non-critical - don't show error to user if this fails)
    const action = gateStatus.includes('zavřen') ? 'Otevření brány' : 'Zavření brány';
    
    try {
      await activityService.logActivity({
        user: currentUser.email || '',
        userDisplayName: getUserIdentifier(),
        action,
        device: 'gate',
        status: 'success',
        details: `Brána byla ${gateStatus.includes('zavřen') ? 'otevřena' : 'zavřena'} uživatelem`
      }, false); // Always include GPS location in logs
      
      console.log('📝 Dashboard: Activity logged successfully');
    } catch (activityError) {
      console.warn('⚠️ Dashboard: Activity logging failed (non-critical):', activityError);
    }
    
    // Step 3: Update last user service (non-critical)
    try {
      await lastUserService.logGateActivity(
        currentUser.email || '',
        getUserIdentifier(),
        action
      );
      
      console.log('📝 Dashboard: Last user service updated');
    } catch (lastUserError) {
      console.warn('⚠️ Dashboard: Last user service failed (non-critical):', lastUserError);
    }
    
    console.log('🎉 Dashboard: Gate command completed successfully');
    playSound('success');
    // Loading už byl vypnutý po MQTT příkazu pro rychlejší UI feedback
    
    // Step 4: Auto-release removed - users keep control until gate closes
    // This allows other users to join queue while gate is operating
    console.log('🔄 Dashboard: Auto-release disabled - user stays active until gate operation completes');
  };

  const handleGarageControl = async () => {
    // Play click sound
    playSound('click');
    
    if (!currentUser?.permissions.garage) {
      playSound('error');
      alert('Nemáte oprávnění k ovládání garáže');
      return;
    }

    if (!mqttConnected) {
      playSound('error');
      alert('MQTT není připojen');
      return;
    }

    // Check location proximity if required (now handled by UI state)
    if (!isLocationProximityAllowed) {
      playSound('error');
      console.log('📍 Garage operation blocked by location proximity');
      return;
    }

    setLoading(true);
    
    // Step 1: Send MQTT command
    try {
      console.log('🏠 Dashboard: Sending garage MQTT command...');
      await mqttService.publishGarageCommand(currentUser.email || '');
      
      // Log message for tracking
      const currentState = garageTimerStatus?.state || 'closed';
      const action = currentState === 'closed' ? 'Otevření garáže' : 'Zavření garáže';
      const logMessage = `${getUserIdentifier()}: ${action}`;
      await mqttService.publishMessage('Log/Brana/ID', logMessage);
      
      console.log('✅ Dashboard: Garage MQTT command sent successfully');
      
    } catch (mqttError) {
      console.error('❌ Dashboard: Garage MQTT command failed:', mqttError);
      playSound('error');
      alert('Chyba při odesílání příkazu');
      setLoading(false);
      return;
    }

    // Step 2: Start garage timer operation
    try {
      console.log(`🏠 Dashboard: Starting garage timer for ${garageSettings.movementTime}s`);
      await garageTimerService.startGarageOperation(
        currentUser.email || '', 
        garageSettings.movementTime
      );
      
      console.log('✅ Dashboard: Garage timer started successfully');
      
    } catch (timerError) {
      console.error('❌ Dashboard: Garage timer failed to start:', timerError);
      // Don't show error alert - MQTT command was sent successfully
    }

    // Step 3: Non-critical logging operations  
    const currentState = garageTimerStatus?.state || 'closed';
    const action = currentState === 'closed' ? 'Otevření garáže' : 'Zavření garáže';
    
    try {
      await activityService.logActivity({
        user: currentUser.email || '',
        userDisplayName: getUserIdentifier(),
        action,
        device: 'garage',
        status: 'success',
        details: `Garáž byla aktivována uživatelem`
      }, false);
      console.log('✅ Dashboard: Garage activity logged to Firestore');
    } catch (activityError) {
      console.warn('⚠️ Dashboard: Failed to log garage activity to Firestore (non-critical):', activityError);
    }
    
    try {
      await lastUserService.logGarageActivity(
        currentUser.email || '',
        getUserIdentifier(),
        action
      );
      console.log('✅ Dashboard: Garage last user service updated');
    } catch (lastUserError) {
      console.warn('⚠️ Dashboard: Failed to update garage last user service (non-critical):', lastUserError);
    }
    
    console.log('🎉 Dashboard: Garage command completed successfully');
    playSound('success');
    setLoading(false);
  };

  const handleStopMode = async () => {
    if (!currentUser?.permissions.stopMode) {
      alert('Nemáte oprávnění k STOP režimu');
      return;
    }

    if (!mqttConnected) {
      alert('MQTT není připojen');
      return;
    }

    setLoading(true);
    
    // CRITICAL: Stop all timers immediately when STOP is activated
    console.log('🛑 Dashboard: STOP activated - stopping all timers');
    stopTimer();
    
    let mqttCommandSucceeded = false;
    
    // Critical MQTT operations - must succeed for the command to work
    try {
      console.log('🔧 Dashboard: Sending STOP command...');
      await mqttService.publishStopCommand(currentUser.email || '');
      
      // Try to publish Log message as part of critical operations
      const logMessage = `${getUserIdentifier()}: STOP režim aktivován`;
      await mqttService.publishMessage('Log/Brana/ID', logMessage);
      
      mqttCommandSucceeded = true;
      console.log('✅ Dashboard: STOP MQTT command sent successfully');
      
    } catch (mqttError) {
      console.error('❌ Dashboard: STOP MQTT command failed:', mqttError);
      alert('Chyba při odesílání STOP příkazu');
      setLoading(false);
      return;
    }
    
    // Non-critical logging operations - should not cause error alerts
    if (mqttCommandSucceeded) {
      try {
        await activityService.logActivity({
          user: currentUser.email || '',
          userDisplayName: getUserIdentifier(),
          action: 'Aktivace STOP režimu',
          device: 'gate',
          status: 'success',
          details: `Příkaz: STOP režim aktivován`
        }, false); // Always include GPS location in logs
        console.log('✅ Dashboard: STOP activity logged to Firestore');
      } catch (activityError) {
        console.warn('⚠️ Dashboard: Failed to log STOP activity to Firestore (non-critical):', activityError);
        // Don't show error alert for non-critical logging failures
      }
      
      console.log('🎉 Dashboard: STOP command completed successfully');
    }
    
    setLoading(false);
  };

  const getStatusVariant = (status: string) => {
    if (status.includes('otevřen') || status.includes('Otevřena')) return 'success';
    if (status.includes('zavřen') || status.includes('Zavřena')) return 'error';
    if (status.includes('pohyb') || status.includes('...')) return 'warning';
    return 'error';
  };

  // Duplicitní mapGateStatusToCoordination odstraněna - používám verzi nahoře

  // Debug log during each render
  console.log('🔧 Dashboard render - mqttConnected:', mqttConnected, 'gateStatus:', gateStatus, 'garageStatus:', garageStatus);
  console.log('🔧 Dashboard render - user permissions:', currentUser?.permissions);
  console.log('🔧 Dashboard render - coordination status:', gateCoordinationStatus);

  return (
    <>
      {/* Connection Loader */}
      <ConnectionLoader 
        steps={connectionSteps} 
        isVisible={showConnectionLoader} 
        onShowDebug={() => setShowMqttDebug(true)}
      />
      
      {/* MQTT Debug Modal */}
      <MqttDebug isVisible={showMqttDebug} onClose={() => setShowMqttDebug(false)} />
      <style>
        {`
          @keyframes pulse {
            0%, 100% { 
              opacity: 1; 
              transform: scale(1);
            }
            50% { 
              opacity: 0.8; 
              transform: scale(1.05);
            }
          }
          
          @keyframes timer-blink {
            0%, 100% { 
              opacity: 1; 
              box-shadow: var(--md-elevation-4-shadow);
            }
            50% { 
              opacity: 0.7; 
              box-shadow: var(--md-elevation-2-shadow);
            }
          }
          
          .timer-blinking {
            animation: timer-blink 1.2s ease-in-out infinite !important;
          }
        `}
      </style>
      <div className="dashboard" style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
      
      {/* Top Header with Material Design */}
      <div className="md-card md-card-elevated" style={{ marginBottom: '16px' }}>
        <div className="md-card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="md-card-title" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Ovládání Brány</h1>
            {!mqttConnected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--md-error)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--md-error)' }}></div>
                <span>MQTT Odpojen</span>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            
            {/* Admin Toggle - Navigation Menu */}
            <button 
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="btn-icon md-ripple"
              style={{ 
                background: 'var(--md-surface-variant)', 
                border: '1px solid var(--md-outline)',
                borderRadius: '12px',
                color: 'var(--md-on-surface-variant)',
                boxShadow: 'var(--md-elevation-1-shadow)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{ width: '20px', height: '20px', fill: 'currentColor' }}>
                <path d="M19.4,12c0-0.2,0-0.4,0-0.6c0-0.2,0-0.4,0-0.6l2.1-1.6c0.2-0.1,0.2-0.4,0.1-0.6l-2-3.5C19.5,5.5,19.2,5.4,19,5.5l-2.5,1 c-0.5-0.4-1-0.7-1.6-1l-0.4-2.7C14.5,2.2,14.3,2,14,2h-4C9.7,2,9.5,2.2,9.5,2.5L9.1,5.2C8.5,5.5,8,5.8,7.5,6.2l-2.5-1 C4.8,5.1,4.5,5.2,4.4,5.4l-2,3.5C2.3,9.1,2.3,9.4,2.5,9.5l2.1,1.6c0,0.2,0,0.4,0,0.6c0,0.2,0,0.4,0,0.6l-2.1,1.6 C2.3,14.9,2.3,15.2,2.4,15.4l2,3.5c0.1,0.2,0.4,0.3,0.6,0.2l2.5-1c0.5,0.4,1,0.7,1.6,1l0.4,2.7c0,0.3,0.2,0.5,0.5,0.5h4 c0.3,0,0.5-0.2,0.5-0.5l0.4-2.7c0.6-0.3,1.1-0.6,1.6-1l2.5,1c0.2,0.1,0.5,0,0.6-0.2l2-3.5c0.1-0.2,0.1-0.5-0.1-0.6L19.4,12z M12,15.5c-1.9,0-3.5-1.6-3.5-3.5s1.6-3.5,3.5-3.5s3.5,1.6,3.5,3.5S13.9,15.5,12,15.5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Camera Section */}
      {currentUser?.permissions.camera && (
        <div className="md-card" style={{ marginBottom: '16px' }}>
          <div className="md-card-header">
            <h2 className="md-card-title" style={{ fontSize: '1.125rem' }}>Webkamera</h2>
          </div>
          <div className="md-card-content">
            <CameraView onCameraStatusChange={handleCameraStatusChange} />
          </div>
        </div>
      )}

      {/* Control Area with Material Design */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', marginTop: '24px' }}>
        
        {/* Gate Control - Material Design FAB */}
        {currentUser?.permissions.gate && (
          <div className="md-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 className="md-card-title" style={{ fontSize: '1rem', textAlign: 'center', margin: 0 }}>Brána</h3>
              
              {/* Location proximity information - PŘESUNUTO NAHORU */}
              {currentUser?.permissions?.requireLocationProximity && !isLocationProximityAllowed && (
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: 'var(--md-error)',
                  marginTop: '12px',
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: 'var(--md-error-container)',
                  borderRadius: '12px',
                  border: '1px solid var(--md-error)'
                }}>
                  {distanceFromGate ? (
                    <>
                      📍 Vzdálenost: {distanceFromGate}m
                      <br />
                      <span style={{ fontSize: '12px', color: 'var(--md-on-error-container)' }}>
                        Přijďte blíž k bráně pro ovládání
                      </span>
                    </>
                  ) : (
                    <>
                      📍 Ověřuji polohu...
                      <br />
                      <span style={{ fontSize: '12px', color: 'var(--md-on-error-container)' }}>
                        Pro ovládání je nutné být blíž k bráně
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* NOVÉ: Informační lišta o připojených uživatelích - VŽDY ZOBRAZ */}
              <div style={{
                background: gateCoordinationStatus.connectedUsers > 1 ? 'var(--md-tertiary-container)' : 'var(--md-surface-variant)',
                color: gateCoordinationStatus.connectedUsers > 1 ? 'var(--md-on-tertiary-container)' : 'var(--md-on-surface-variant)',
                padding: '8px 12px',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600',
                marginTop: '8px',
                textAlign: 'center'
              }}>
                👥 {gateCoordinationStatus.connectedUsers} {gateCoordinationStatus.connectedUsers === 1 ? 'uživatel připojen' : 'uživatelů připojeno'}
                {gateCoordinationStatus.activeUser && (
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8 }}>
                    🎮 Aktivní: {gateCoordinationStatus.activeUser}
                  </div>
                )}
              </div>
            </div>

            {/* SLIDE-TO-CLOSE slider NAHORU pro aktivní uživatele s frontou - VIDITELNÉ NA TELEFONU */}
            {gateCoordinationStatus.isActive && gateCoordinationStatus.mustUseSlider && (
              <div style={{ 
                marginBottom: '20px',
                background: 'linear-gradient(135deg, rgba(255,152,0,0.15) 0%, rgba(255,193,7,0.15) 100%)',
                border: '2px solid rgba(255,152,0,0.4)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 4px 12px rgba(255,152,0,0.2)'
              }}>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: 'rgba(255,152,0,1)',
                  marginBottom: '12px',
                  textAlign: 'center',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  ⚠️ Ve frontě čeká {gateCoordinationStatus.queueLength} {gateCoordinationStatus.queueLength === 1 ? 'uživatel' : 'uživatelé'}
                  <br />Pro zavření brány potřebujete potvrdit sliderem
                </div>
                
                <div 
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '60px',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '30px',
                    border: '3px solid rgba(255,152,0,0.4)',
                    cursor: isSliderDragging ? 'grabbing' : 'grab',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                  }}
                  onMouseDown={handleSliderStart}
                  onMouseMove={handleSliderMove}
                  onMouseUp={handleSliderEnd}
                  onMouseLeave={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchMove={handleSliderMove}
                  onTouchEnd={handleSliderEnd}
                >
                  {/* Progress background */}
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: '0',
                    width: `${closeSliderPosition}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, rgba(76,175,80,0.4) 0%, rgba(139,195,74,0.4) 100%)',
                    borderRadius: '30px',
                    transition: isSliderDragging ? 'none' : 'width 0.3s ease'
                  }} />
                  
                  <div style={{
                    position: 'absolute',
                    left: `calc(${closeSliderPosition}% - 26px + 6px)`,
                    top: '6px',
                    width: '48px',
                    height: '48px',
                    background: closeSliderPosition > 90 ? 
                      'linear-gradient(135deg, #4caf50, #8bc34a)' : 
                      'linear-gradient(135deg, #ff9800, #ffc107)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.4)',
                    color: 'white',
                    fontSize: '24px',
                    transition: isSliderDragging ? 'none' : 'all 0.3s ease',
                    transform: closeSliderPosition > 90 ? 'scale(1.1)' : 'scale(1)'
                  }}>
                    {closeSliderPosition > 90 ? '✅' : '🔒'}
                  </div>
                  
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: closeSliderPosition > 90 ? 
                      'rgba(76,175,80,0.9)' : 
                      'rgba(255,152,0,0.9)',
                    fontSize: '16px',
                    fontWeight: '700',
                    pointerEvents: 'none',
                    transition: 'color 0.3s ease',
                    textShadow: '0 1px 3px rgba(0,0,0,0.4)'
                  }}>
                    {closeSliderPosition > 90 ? 'Pusťte pro zavření!' : 'Táhněte pro zavření →'}
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={handleGateControl}
              disabled={loading || !mqttConnected || !isLocationProximityAllowed || gateStatus.includes('STOP režim')}
              className={`gate-button-modern ${(gateStatus.includes('se...') || loading) ? 'pulsing' : ''} ${timerState.type === 'autoClose' && timerState.countdown <= 60 ? 'timer-blinking' : ''} md-ripple`}
              style={{
                width: '280px',
                height: '280px',
                borderRadius: '50%',
                border: '8px solid var(--md-outline)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                fontSize: '16px',
                fontWeight: '600',
                background: !isLocationProximityAllowed ? 'var(--md-surface-variant)' :
                           gateStatus.includes('STOP režim') ? 'var(--md-error-container)' :
                           gateCoordinationStatus.isInQueue ? 'var(--md-tertiary)' :
                           gateCoordinationStatus.isBlocked ? 'var(--md-primary-container)' :
                           gateCoordinationStatus.mustUseSlider ? 'var(--md-tertiary-container)' :
                           gateStatus.includes('zavřen') ? 'var(--md-error)' : 
                           gateStatus.includes('otevřen') ? 'var(--md-success)' : 'var(--md-primary)',
                color: !isLocationProximityAllowed ? 'var(--md-on-surface-variant)' : 'white',
                boxShadow: !isLocationProximityAllowed ? 'none' : 'var(--md-elevation-4-shadow)',
                cursor: (loading || !mqttConnected || !isLocationProximityAllowed) ? 'not-allowed' : 'pointer',
                opacity: (loading || !mqttConnected || !isLocationProximityAllowed) ? 0.6 : 1,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'translateY(0px) scale(1)',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                if (!loading && mqttConnected && isLocationProximityAllowed && !gateStatus.includes('se...')) {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                  e.currentTarget.style.boxShadow = 'var(--md-elevation-5-shadow)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && mqttConnected && isLocationProximityAllowed) {
                  e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                  e.currentTarget.style.boxShadow = 'var(--md-elevation-4-shadow)';
                }
              }}
              onMouseDown={(e) => {
                if (!loading && mqttConnected && isLocationProximityAllowed) {
                  e.currentTarget.style.transform = 'translateY(2px) scale(0.98)';
                  e.currentTarget.style.boxShadow = 'var(--md-elevation-2-shadow)';
                }
              }}
              onMouseUp={(e) => {
                if (!loading && mqttConnected && isLocationProximityAllowed) {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                  e.currentTarget.style.boxShadow = 'var(--md-elevation-5-shadow)';
                }
              }}
              aria-label={`Ovládat bránu - aktuální stav: ${gateStatus}`}
            >
              <svg style={{ width: '48px', height: '48px', fill: 'currentColor', marginBottom: '8px' }} viewBox="0 0 24 24">
                <path d="M6,2V8H4V2H6M20,2V8H18V2H20M18,10V16C18,17.11 17.11,18 16,18H8C6.89,18 6,17.11 6,16V10H4V16C4,18.21 5.79,20 8,20H16C18.21,20 20,18.21 20,16V10H18M12,11.5C12.83,11.5 13.5,12.17 13.5,13S12.83,14.5 12,14.5 10.5,13.83 10.5,13 11.17,11.5 12,11.5Z"/>
              </svg>
              <div style={{ textAlign: 'center', lineHeight: '1.3' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
                  {(() => {
                    // PRIORITA 1: Když jsem aktivní uživatel - vždy zobraz stav brány
                    if (gateCoordinationStatus.isActive) {
                      if (gateCoordinationStatus.mustUseSlider) {
                        return `${gateStatus} ⚠️ Použijte slider`;
                      }
                      if (gateCoordinationStatus.queueLength > 0) {
                        return `${gateStatus} (${gateCoordinationStatus.queueLength} čeká)`;
                      }
                      return gateStatus;
                    }
                    
                    // PRIORITA 2: Když jsem ve frontě - zobrazit STAV BRÁNY + pozici 
                    if (gateCoordinationStatus.isInQueue) {
                      if (gateCoordinationStatus.position === 1) {
                        return `🎯 ${gateStatus} - ${gateCoordinationStatus.waitingTimeText}`;
                      }
                      return `⏳ ${gateStatus} - ${gateCoordinationStatus.waitingTimeText}`;
                    }
                    
                    // PRIORITA 3: Když někdo jiný ovládá - VŽDY nabídni frontu (PRVNÍ!)
                    if (gateCoordinationStatus.isBlocked) {
                      if (gateCoordinationStatus.isInQueue) {
                        // Už jsem ve frontě - umožni opuštění
                        return `⏳ ${gateCoordinationStatus.waitingTimeText} - Opustit frontu`;
                      } else {
                        // Nejsem ve frontě - nabídni zařazení
                        return '📋 Zařadit do fronty';
                      }
                    }
                    
                    // PRIORITA 4: Když můžu začít ovládat (nikdo není aktivní)
                    if (gateCoordinationStatus.canStartControl) {
                      if (gateCoordinationStatus.queueLength > 0) {
                        return `${gateStatus} (${gateCoordinationStatus.queueLength} čeká)`;
                      }
                      return gateStatus;
                    }
                    
                    // PRIORITA 5: Když se brána pohybuje - ukázat stav
                    if (gateStatus.includes('se...') || gateStatus === 'Brána otevřena') {
                      if (gateCoordinationStatus.queueLength > 0) {
                        return `${gateStatus} (${gateCoordinationStatus.queueLength} čeká)`;
                      }
                      return gateStatus;
                    }
                    
                    // Fallback
                    return gateStatus;
                  })()}
                </div>
                {(gateStatus.includes('se...') || loading) && (
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: 'rgba(255,255,255,0.9)',
                    animation: 'pulse-text 1s infinite alternate'
                  }}>
                    {loading ? 'Odesílám...' : 'Pohyb brány'}
                  </div>
                )}
                {/* Timer uvnitř tlačítka */}
                {timerState.isActive && (
                  <div 
                    style={{ 
                      fontSize: timerState.type === 'autoClose' ? '18px' : '16px', 
                      fontWeight: '800',
                      color: timerState.type === 'travel' ? '#ffeb3b' : '#ffffff',
                      marginTop: '8px',
                      textShadow: timerState.type === 'travel' ? 
                        '0 0 10px rgba(255, 235, 59, 0.8)' : 
                        '0 0 8px rgba(0, 0, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.6)'
                    }}
                  >
                    {timerState.displayText}
                  </div>
                )}
              </div>
            </button>
            
            {/* STOP tlačítko pro uživatele s stopMode oprávněním */}
            {currentUser?.permissions.stopMode && (
              <button
                onClick={handleStopMode}
                disabled={loading || !mqttConnected}
                className="md-button md-button-outlined md-ripple"
                style={{
                  width: '100%',
                  marginTop: '16px',
                  height: '48px',
                  background: 'var(--md-error-container)',
                  color: 'var(--md-on-error-container)',
                  border: '2px solid var(--md-error)',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (loading || !mqttConnected) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !mqttConnected) ? 0.6 : 1,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!loading && mqttConnected) {
                    e.currentTarget.style.background = 'var(--md-error)';
                    e.currentTarget.style.color = 'var(--md-on-error)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--md-elevation-3-shadow)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && mqttConnected) {
                    e.currentTarget.style.background = 'var(--md-error-container)';
                    e.currentTarget.style.color = 'var(--md-on-error-container)';
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
                aria-label="STOP - nouzové zastavení brány"
              >
                <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M18,18H6V6H18V18Z"/>
                </svg>
                STOP
              </button>
            )}
            
            
            {/* LastGateActivity dovnitř gate boxu pro úsporu místa */}
            {(() => {
              // DEBUG: Permission check
              console.log('🔍 DEBUG: currentUser.role =', currentUser?.role);
              console.log('🔍 DEBUG: currentUser.permissions.viewGateActivity =', currentUser?.permissions.viewGateActivity);
              console.log('🔍 DEBUG: currentUser.permissions =', currentUser?.permissions);
              return null;
            })()}
            
            {currentUser?.permissions.viewGateActivity ? (
              <div style={{ width: '100%', marginTop: '16px' }}>
                <LastGateActivity limit={3} />
              </div>
            ) : (
              <div style={{ color: 'orange', fontSize: '0.8em', marginTop: '8px' }}>
                DEBUG: viewGateActivity = {String(currentUser?.permissions.viewGateActivity)} (role: {currentUser?.role})
              </div>
            )}
            
            {/* NOVÝ WORKFLOW: Upozornění když někdo čeká ve frontě */}
            {gateCoordinationStatus.shouldShowQueueWarning && !showCloseConfirmSlider && (
              <div style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                background: 'var(--md-tertiary-container)',
                color: 'var(--md-on-tertiary-container)',
                borderRadius: '12px',
                border: '1px solid var(--md-tertiary)',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'center'
              }}>
                ⚠️ Ve frontě čeká {gateCoordinationStatus.queueLength} {gateCoordinationStatus.queueLength === 1 ? 'uživatel' : 'uživatelů'}
                <br />
                <span style={{ fontSize: '12px', opacity: 0.8 }}>
                  Pro zavření brány potřebujete potvrdit sliderem
                </span>
              </div>
            )}
            
            {/* NOVÉ: Close Confirmation Slider */}
            {showCloseConfirmSlider && (
              <div style={{
                width: '100%',
                marginTop: '16px',
                padding: '16px',
                background: 'var(--md-error-container)',
                borderRadius: '12px',
                border: '2px solid var(--md-error)'
              }}>
                <div style={{
                  textAlign: 'center',
                  marginBottom: '12px',
                  color: 'var(--md-on-error-container)',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  ⚠️ Ve frontě čeká {gateCoordinationStatus.queueLength} {gateCoordinationStatus.queueLength === 1 ? 'uživatel' : 'uživatelů'}
                  <br />
                  <span style={{ fontSize: '13px' }}>
                    Přetáhněte slider pro potvrzení zavření brány
                  </span>
                </div>
                
                {/* Slider Track */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '48px',
                  background: 'var(--md-surface-variant)',
                  borderRadius: '24px',
                  border: '2px solid var(--md-outline)',
                  marginBottom: '12px',
                  cursor: isSliderDragging ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
                onMouseMove={handleSliderMove}
                onMouseUp={handleSliderEnd}
                onMouseLeave={handleSliderEnd}
                onTouchMove={handleSliderMove}
                onTouchEnd={handleSliderEnd}
                >
                  {/* Slider Progress */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${closeSliderPosition}%`,
                    height: '100%',
                    background: closeSliderPosition > 90 ? 'var(--md-success)' : 'var(--md-error)',
                    borderRadius: '24px',
                    transition: isSliderDragging ? 'none' : 'all 0.2s ease',
                    pointerEvents: 'none'
                  }} />
                  
                  {/* Slider Thumb */}
                  <div style={{
                    position: 'absolute',
                    left: `calc(${closeSliderPosition}% - 20px)`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '40px',
                    height: '40px',
                    background: closeSliderPosition > 90 ? 'var(--md-success)' : 'var(--md-error)',
                    borderRadius: '50%',
                    border: '3px solid white',
                    cursor: isSliderDragging ? 'grabbing' : 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    color: 'white',
                    boxShadow: 'var(--md-elevation-3-shadow)',
                    transition: isSliderDragging ? 'none' : 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                  onMouseDown={handleSliderStart}
                  onTouchStart={handleSliderStart}
                  >
                    {closeSliderPosition > 90 ? '✓' : '🔒'}
                  </div>
                  
                  {/* Slider Text */}
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'var(--md-on-surface-variant)',
                    fontSize: '12px',
                    fontWeight: '600',
                    pointerEvents: 'none',
                    opacity: closeSliderPosition > 30 ? 0 : 1,
                    transition: 'opacity 0.2s ease'
                  }}>
                    {closeSliderPosition > 90 ? 'POTVRZENO' : 'Přetáhněte →'}
                  </div>
                </div>
                
                {/* Cancel Button */}
                <button
                  onClick={handleCancelCloseSlider}
                  className="md-button md-button-outlined md-ripple"
                  style={{
                    width: '100%',
                    height: '36px',
                    background: 'transparent',
                    color: 'var(--md-on-error-container)',
                    border: '1px solid var(--md-on-error-container)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  Zrušit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Garage Control - Material Design Card with FAB */}
        {currentUser?.permissions.garage && (
          <div className="md-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minWidth: '280px' }}>
            <h3 className="md-card-title" style={{ fontSize: '1rem', textAlign: 'center', margin: 0 }}>Garáž</h3>
            
            <button
              onClick={handleGarageControl}
              disabled={loading || !mqttConnected || !isLocationProximityAllowed}
              className={`md-fab md-fab-extended md-ripple ${(garageTimerStatus?.isActive || loading) ? 'pulsing' : ''}`}
              style={{
                minWidth: '180px',
                height: '56px',
                background: !isLocationProximityAllowed ? 'var(--md-surface-variant)' :
                           garageTimerStatus?.state === 'closed' ? 'var(--md-error)' : 
                           garageTimerStatus?.state === 'open' ? 'var(--md-success)' : 
                           garageTimerStatus?.isActive ? 'var(--md-tertiary)' : 'var(--md-secondary)',
                color: !isLocationProximityAllowed ? 'var(--md-on-surface-variant)' : 'white',
                opacity: (loading || !mqttConnected || !isLocationProximityAllowed) ? 0.6 : 1
              }}
              aria-label={`Ovládat garáž - ${garageTimerStatus ? garageTimerService.getDisplayText() : 'Garáž'}`}
            >
              <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M12 3L2 9v12h20V9L12 3zm8 16H4v-8l8-5.33L20 11v8zm-2-6v4h-2v-4h2zm-4 0v4h-2v-4h2zm-4 0v4H8v-4h2z"/>
              </svg>
              <span>
                {garageTimerStatus ? garageTimerService.getDisplayText() : 'Garáž - načítám...'}
              </span>
            </button>

            {/* Location proximity information for garage */}
            {currentUser?.permissions?.requireLocationProximity && !isLocationProximityAllowed && (
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '500', 
                color: 'var(--md-error)',
                marginTop: '8px',
                textAlign: 'center',
                padding: '12px',
                backgroundColor: 'var(--md-error-container)',
                borderRadius: '12px',
                border: '1px solid var(--md-error)'
              }}>
                {distanceFromGate ? (
                  <>
                    📍 Vzdálenost: {distanceFromGate}m
                    <br />
                    <span style={{ fontSize: '12px', color: 'var(--md-on-error-container)' }}>
                      Přijďte blíž k bráně pro ovládání garáže
                    </span>
                  </>
                ) : (
                  <>
                    📍 Ověřuji polohu...
                    <br />
                    <span style={{ fontSize: '12px', color: 'var(--md-on-error-container)' }}>
                      Pro ovládání garáže je nutné být blíž k bráně
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* NOVÉ: Reservation Queue - zobrazuje seznam čekajících uživatelů */}
        {coordinationState && coordinationState.reservationQueue.length > 0 && (
          <div style={{ marginTop: '16px', minWidth: '280px', maxWidth: '400px' }}>
            <ReservationQueue 
              coordinationState={coordinationState}
              onLeaveQueue={handleLeaveQueue}
              gateStatus={gateStatus}
            />
          </div>
        )}

      </div>
      
      {/* Overlay */}
      {showAdminPanel && (
        <div 
          className="overlay show" 
          onClick={() => setShowAdminPanel(false)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'block', opacity: 1, transition: 'opacity 0.3s ease-in-out' }}
        />
      )}
      
      {/* Admin Panel - Material Design */}
      <div 
        className={`admin-panel ${showAdminPanel ? 'open' : ''}`}
        style={{ 
          position: 'fixed', 
          top: 0, 
          right: showAdminPanel ? 0 : '-100%', 
          width: '100%', 
          maxWidth: '350px', 
          height: '100%',
          backgroundColor: 'var(--md-surface)', 
          boxShadow: 'var(--md-elevation-4-shadow)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
          zIndex: 1000, 
          padding: '24px', 
          paddingTop: '80px',
          display: 'flex', 
          flexDirection: 'column',
          borderLeft: '1px solid var(--md-outline)'
        }}
      >
        <h2 className="md-card-title" style={{ color: 'var(--md-primary)', marginBottom: '24px', fontSize: '1.25rem' }}>
          Navigace & Nastavení
        </h2>
        
        {/* Navigation Links */}
        <div style={{ marginBottom: '32px' }}>
          <h3 className="md-card-subtitle" style={{ marginBottom: '16px', fontSize: '0.875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            MENU
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {currentUser?.permissions.manageUsers && (
              <Link 
                to="/users" 
                onClick={() => setShowAdminPanel(false)}
                className="md-ripple"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: 'var(--md-on-surface)',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  transition: 'background-color 0.2s ease',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--md-surface-variant)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg style={{ width: '20px', height: '20px', fill: 'var(--md-on-surface-variant)' }} viewBox="0 0 24 24">
                  <path d="M16,4C18.21,4 20,5.79 20,8C20,10.21 18.21,12 16,12C13.79,12 12,10.21 12,8C12,5.79 13.79,4 16,4M16,14C20.42,14 24,15.79 24,18V20H8V18C8,15.79 11.58,14 16,14M6,6H2V4H6V6M6,10H2V8H6V10M6,14H2V12H6V14Z"/>
                </svg>
                Správa uživatelů
              </Link>
            )}
            
            {currentUser?.permissions.viewLogs && (
              <Link 
                to="/logs" 
                onClick={() => setShowAdminPanel(false)}
                className="md-ripple"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: 'var(--md-on-surface)',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  transition: 'background-color 0.2s ease',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--md-surface-variant)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg style={{ width: '20px', height: '20px', fill: 'var(--md-on-surface-variant)' }} viewBox="0 0 24 24">
                  <path d="M9,5V9H15V5H9M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3A2,2 0 0,1 19,5V8A2,2 0 0,1 17,10H16V11L13,14V22H11V14L8,11V10H7A2,2 0 0,1 5,8V5A2,2 0 0,1 7,3H17Z"/>
                </svg>
                Logy aktivit
              </Link>
            )}
            
            {currentUser?.permissions.manageUsers && (
              <Link 
                to="/settings" 
                onClick={() => setShowAdminPanel(false)}
                className="md-ripple"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: 'var(--md-on-surface)',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  transition: 'background-color 0.2s ease',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--md-surface-variant)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg style={{ width: '20px', height: '20px', fill: 'var(--md-on-surface-variant)' }} viewBox="0 0 24 24">
                  <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                </svg>
                Nastavení systému
              </Link>
            )}
          </div>
        </div>
        
        {/* User Info Card */}
        <div className="md-card" style={{ marginBottom: '24px' }}>
          <div className="md-card-content">
            <h3 className="md-card-subtitle" style={{ marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              PŘIHLÁŠENÝ UŽIVATEL
            </h3>
            <p className="md-card-title" style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>
              {getUserIdentifier()}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
              Role: {currentUser?.role}
            </p>
          </div>
        </div>
        
        {/* System Status */}
        <div className="md-card" style={{ marginBottom: '24px' }}>
          <div className="md-card-content">
            <h3 className="md-card-subtitle" style={{ marginBottom: '12px', fontSize: '0.875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              SYSTÉM
            </h3>
            
            {/* MQTT Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div 
                style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: mqttConnected ? 'var(--md-success)' : 'var(--md-error)' 
                }}
              ></div>
              <span style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                MQTT: {mqttConnected ? 'Připojeno' : 'Odpojeno'}
              </span>
            </div>
          </div>
        </div>
        
        {/* NOVÉ: Reservation Queue - pouze pokud existuje */}
        {coordinationState && coordinationState.reservationQueue.length > 0 && (
          <ReservationQueue 
            coordinationState={coordinationState}
            onLeaveQueue={handleLeaveQueue}
            gateStatus={gateStatus}
            className="mb-4"
          />
        )}
        
        {/* DEBUGGING: Temporary Reset Button */}
        {currentUser?.role === 'admin' && (
          <button 
            onClick={handleResetCoordination}
            className="md-button md-button-outlined md-ripple"
            style={{ 
              backgroundColor: 'var(--md-warning-container)', 
              color: 'var(--md-on-warning-container)',
              border: '1px solid var(--md-warning)',
              width: '100%', 
              marginBottom: '16px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            🔧 Reset Koordinace (Debug)
          </button>
        )}
        
        {/* Logout Button */}
        <button 
          onClick={logout}
          className="md-fab md-fab-extended md-ripple"
          style={{ 
            backgroundColor: 'var(--md-error)', 
            color: 'var(--md-on-primary)',
            width: '100%', 
            marginTop: 'auto',
            justifyContent: 'center'
          }}
        >
          <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
            <path d="M17,7L15.59,8.41L18.17,11H8V13H18.17L15.59,15.59L17,17L22,12L17,7M4,5H12V3H4A2,2 0 0,0 2,5V19A2,2 0 0,0 4,21H12V19H4V5Z"/>
          </svg>
          Odhlásit se
        </button>
      </div>
    </div>
    
    {/* Debug komponenta pro vývojáře */}
    <GateCoordinationDebug show={process.env.NODE_ENV === 'development'} />
    
    </>
  );
};

export default Dashboard;