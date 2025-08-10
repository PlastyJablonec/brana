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

const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { timerState, startTravelTimer, startAutoCloseTimer, startOpenElapsedTimer, stopTimer } = useGateTimer();
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
  const [distanceFromGate, setDistanceFromGate] = useState<number | null>(null);
  const [isLocationProximityAllowed, setIsLocationProximityAllowed] = useState<boolean>(true);
  const [showMqttDebug, setShowMqttDebug] = useState(false);

  // Connection loading states
  const [showConnectionLoader, setShowConnectionLoader] = useState(true);
  const [connectionSteps, setConnectionSteps] = useState<Array<{
    label: string;
    status: 'pending' | 'loading' | 'success' | 'error';
    description: string;
  }>>([
    { label: 'Autentifikace', status: 'success', description: 'Přihlášení ověřeno' },
    { label: 'MQTT protokol', status: 'loading', description: 'Připojuji se...' },
    { label: 'Stav brány', status: 'pending', description: 'Čekám na data...' }
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

  // Check if all critical steps are completed (hide loader)
  const checkConnectionComplete = () => {
    // Jen kritické kroky: Auth, MQTT, Gate Status
    const criticalSteps = [0, 1, 2]; // Auth, MQTT, Gate Status
    const allCriticalComplete = criticalSteps.every(index => 
      connectionSteps[index]?.status === 'success'
    );
    
    // Dodatečná kontrola - skutečný stav brány (ne "Neznámý stav")
    const hasRealGateStatus = gateStatus !== 'Neznámý stav';
    
    if (allCriticalComplete && hasRealGateStatus && showConnectionLoader) {
      console.log('🎯 Critical steps completed, hiding loader fast...');
      setTimeout(() => setShowConnectionLoader(false), 500); // Rychlejší skrytí
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
    
    // Get initial status immediately
    const initialStatus = mqttService.getStatus();
    console.log('🔧 Dashboard: Initial MQTT status:', initialStatus);
    setGateStatus(initialStatus.gateStatus);
    setGarageStatus(initialStatus.garageStatus);
    setMqttConnected(initialStatus.isConnected);

    // Update connection steps based on initial status
    if (initialStatus.isConnected) {
      updateConnectionStep(1, 'success', 'Připojeno');
      if (initialStatus.gateStatus !== 'Neznámý stav') {
        updateConnectionStep(2, 'success', initialStatus.gateStatus);
      } else {
        updateConnectionStep(2, 'loading', 'Načítám...');
      }
    } else {
      updateConnectionStep(1, 'loading', 'Připojuji se...');
      updateConnectionStep(2, 'pending', 'Čekám...');
    }

    // Subscribe to status changes (don't manage connection here)
    const unsubscribe = mqttService.onStatusChange((status) => {
      console.log('🔧 Dashboard: MQTT status changed:', status);
      console.log('🔧 Dashboard: Updating React state...');
      
      const prevGateStatus = gateStatus;
      setGateStatus(status.gateStatus);
      setGarageStatus(status.garageStatus); 
      setMqttConnected(status.isConnected);

      // Update connection steps
      if (status.isConnected) {
        updateConnectionStep(1, 'success', 'Připojeno');
        if (status.gateStatus !== 'Neznámý stav') {
          updateConnectionStep(2, 'success', status.gateStatus);
        } else {
          updateConnectionStep(2, 'loading', 'Načítám...');
        }
      } else {
        updateConnectionStep(1, 'error', 'Chyba připojení');
        updateConnectionStep(2, 'pending', 'Čekám...');
      }
      
      // Handle timer logic based on gate status changes
      const isMoving = status.gateStatus.includes('se...') || status.gateStatus.includes('Otevírá') || status.gateStatus.includes('Zavírá');
      const isOpen = status.gateStatus.includes('otevřen') || status.gateStatus.includes('Otevřena');
      const isClosed = status.gateStatus.includes('zavřen') || status.gateStatus.includes('Zavřena');
      
      if (isMoving) {
        // Spustí travel timer pouze pokud ještě neběží
        if (timerState.type !== 'travel' || !timerState.isActive) {
          console.log('🔧 Dashboard: Gate is moving, starting travel timer');
          startTravelTimer();
        }
      } else if (isOpen && !prevGateStatus.includes('otevřen')) {
        // Spustí auto-close timer pouze pokud ještě neběží
        if (timerState.type !== 'autoClose' || !timerState.isActive) {
          console.log('🔧 Dashboard: Gate opened, starting auto-close timer');
          console.log('🔧 Dashboard: Gate status changed from', prevGateStatus, 'to', status.gateStatus);
          startAutoCloseTimer();
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
      }
      
      console.log('🔧 Dashboard: React state updated - mqttConnected:', status.isConnected);
    });

    return () => {
      unsubscribe();
      // Connection is managed globally in App.tsx - don't disconnect here!
    };
  }, []);

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

    setLoading(true);
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
    setLoading(false);
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

  // Debug log during each render
  console.log('🔧 Dashboard render - mqttConnected:', mqttConnected, 'gateStatus:', gateStatus, 'garageStatus:', garageStatus);
  console.log('🔧 Dashboard render - user permissions:', currentUser?.permissions);

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
            <h3 className="md-card-title" style={{ fontSize: '1rem', textAlign: 'center', margin: 0 }}>Brána</h3>
            
            <button
              onClick={handleGateControl}
              disabled={loading || !mqttConnected || !isLocationProximityAllowed}
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
                  {gateStatus}
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
                {/* Location proximity information */}
                {currentUser?.permissions?.requireLocationProximity && !isLocationProximityAllowed && distanceFromGate && (
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: 'var(--md-error)',
                    marginTop: '8px'
                  }}>
                    Vzdálenost: {distanceFromGate}m
                    <br />
                    <span style={{ fontSize: '12px' }}>Přijďte blíž k bráně</span>
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
    </>
  );
};

export default Dashboard;