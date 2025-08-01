import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CameraView from '../components/CameraView';
import ThemeToggle from '../components/ThemeToggle';
import HttpsWarning from '../components/HttpsWarning';
import { mqttService } from '../services/mqttService';
import { activityService } from '../services/activityService';
import { useGateTimer } from '../hooks/useGateTimer';
import { locationService } from '../services/locationService';
import { lastUserService } from '../services/lastUserService';

const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { timerState, startTravelTimer, startAutoCloseTimer, startOpenElapsedTimer, stopTimer } = useGateTimer();
  const [gateStatus, setGateStatus] = useState('Neznámý stav');
  const [garageStatus, setGarageStatus] = useState('Neznámý stav');
  const [mqttConnected, setMqttConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  // MQTT Status Subscription (connection managed globally in App.tsx)
  useEffect(() => {
    console.log('🔧 Dashboard: Subscribing to MQTT status changes...');
    
    // Get initial status immediately
    const initialStatus = mqttService.getStatus();
    console.log('🔧 Dashboard: Initial MQTT status:', initialStatus);
    setGateStatus(initialStatus.gateStatus);
    setGarageStatus(initialStatus.garageStatus);
    setMqttConnected(initialStatus.isConnected);

    // Subscribe to status changes (don't manage connection here)
    const unsubscribe = mqttService.onStatusChange((status) => {
      console.log('🔧 Dashboard: MQTT status changed:', status);
      console.log('🔧 Dashboard: Updating React state...');
      
      const prevGateStatus = gateStatus;
      setGateStatus(status.gateStatus);
      setGarageStatus(status.garageStatus); 
      setMqttConnected(status.isConnected);
      
      // Handle timer logic based on gate status changes
      const isMoving = status.gateStatus.includes('se...') || status.gateStatus.includes('Otevírá') || status.gateStatus.includes('Zavírá');
      const isOpen = status.gateStatus.includes('otevřen') || status.gateStatus.includes('Otevřena');
      const isClosed = status.gateStatus.includes('zavřen') || status.gateStatus.includes('Zavřena');
      
      if (isMoving) {
        console.log('🔧 Dashboard: Gate is moving, starting travel timer');
        startTravelTimer();
      } else if (isOpen && !prevGateStatus.includes('otevřen')) {
        console.log('🔧 Dashboard: Gate opened, starting auto-close timer');
        startAutoCloseTimer();
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

  // GPS permission request
  useEffect(() => {
    const requestLocation = async () => {
      if (!locationService.isLocationSupported() || !locationService.isSecureContext()) {
        const reason = locationService.getLocationUnavailableReason();
        setLocationError(reason);
        setLocationPermission(false);
        console.log('📍 Dashboard: GPS unavailable:', reason);
        return;
      }

      try {
        const hasPermission = await locationService.requestPermission();
        setLocationPermission(hasPermission);
        
        if (hasPermission) {
          console.log('📍 Dashboard: GPS permission granted, starting location tracking');
          await locationService.startWatching();
          
          // Získáme aktuální lokaci hned
          try {
            const currentLoc = await locationService.getCurrentLocation();
            setCurrentLocation(currentLoc);
            
            if (currentLoc.accuracy > 50000) {
              setLocationError('Fallback lokace (Praha centrum)');
            } else {
              setLocationError('');
            }
          } catch (error: any) {
            console.warn('📍 Dashboard: Could not get initial location:', error);
            setLocationError('GPS nedostupné');
          }
        } else {
          console.log('📍 Dashboard: GPS permission denied');
          setLocationError('Oprávnění k lokaci bylo odepřeno');
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
      }
    };

    requestLocation();

    return () => {
      locationService.stopWatching();
    };
  }, []);

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

  const handleGateControl = async () => {
    if (!currentUser?.permissions.gate) {
      alert('Nemáte oprávnění k ovládání brány');
      return;
    }

    if (!mqttConnected) {
      alert('MQTT není připojen');
      return;
    }

    setLoading(true);
    try {
      console.log('🔧 Dashboard: Sending gate command...');
      await mqttService.publishGateCommand(currentUser.email || '');
      
      // Send user ID to Log/Brana/ID topic (like original HTML)
      const logMessage = `ID: ${currentUser.displayName || currentUser.email || 'Neznámý'}`;
      await mqttService.publishMessage('Log/Brana/ID', logMessage);
      console.log('🔧 Dashboard: User log sent to Log/Brana/ID:', logMessage);
      
      const action = gateStatus.includes('zavřen') ? 'Otevření brány' : 'Zavření brány';
      
      // Log the activity (GPS will be added automatically by activityService)
      await activityService.logActivity({
        user: currentUser.email || '',
        userDisplayName: currentUser.displayName || currentUser.email || '',
        action,
        device: 'gate',
        status: 'success',
        details: `Brána byla ${gateStatus.includes('zavřen') ? 'otevřena' : 'zavřena'} uživatelem`
      });
      
      // Update last user service
      await lastUserService.logGateActivity(
        currentUser.email || '',
        currentUser.displayName || currentUser.email || '',
        action
      );
      
      console.log('🔧 Dashboard: Gate activity logged');
    } catch (error) {
      console.error('Failed to send gate command:', error);
      
      // Log the failed activity
      try {
        await activityService.logActivity({
          user: currentUser.email || '',
          userDisplayName: currentUser.displayName || currentUser.email || '',
          action: 'Pokus o ovládání brány',
          device: 'gate',
          status: 'error',
          details: `Chyba při ovládání brány: ${(error as Error).message}`
        });
      } catch (logError) {
        console.error('Failed to log error activity:', logError);
      }
      
      alert('Chyba při odesílání příkazu');
    } finally {
      setLoading(false);
    }
  };

  const handleGarageControl = async () => {
    if (!currentUser?.permissions.garage) {
      alert('Nemáte oprávnění k ovládání garáže');
      return;
    }

    if (!mqttConnected) {
      alert('MQTT není připojen');
      return;
    }

    setLoading(true);
    try {
      console.log('🔧 Dashboard: Sending garage command...');
      await mqttService.publishGarageCommand(currentUser.email || '');
      
      const action = garageStatus.includes('zavřen') ? 'Otevření garáže' : 'Zavření garáže';
      
      // Log the activity (GPS will be added automatically by activityService)
      await activityService.logActivity({
        user: currentUser.email || '',
        userDisplayName: currentUser.displayName || currentUser.email || '',
        action,
        device: 'garage',
        status: 'success',
        details: `Garáž byla ${garageStatus.includes('zavřen') ? 'otevřena' : 'zavřena'} uživatelem`
      });
      
      // Update last user service for garage
      await lastUserService.logGarageActivity(
        currentUser.email || '',
        currentUser.displayName || currentUser.email || '',
        action
      );
      
      console.log('🔧 Dashboard: Garage activity logged');
    } catch (error) {
      console.error('Failed to send garage command:', error);
      
      // Log the failed activity
      try {
        await activityService.logActivity({
          user: currentUser.email || '',
          userDisplayName: currentUser.displayName || currentUser.email || '',
          action: 'Pokus o ovládání garáže',
          device: 'garage',
          status: 'error',
          details: `Chyba při ovládání garáže: ${(error as Error).message}`
        });
      } catch (logError) {
        console.error('Failed to log error activity:', logError);
      }
      
      alert('Chyba při odesílání příkazu');
    } finally {
      setLoading(false);
    }
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
    try {
      await mqttService.publishStopCommand(currentUser.email || '');
    } catch (error) {
      console.error('Failed to send stop command:', error);
      alert('Chyba při odesílání STOP příkazu');
    } finally {
      setLoading(false);
    }
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
    <div className="dashboard" style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
      {/* HTTPS Warning Banner */}
      <HttpsWarning />
      
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
            <CameraView />
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
              disabled={loading || !mqttConnected}
              className={`gate-button-modern ${(gateStatus.includes('se...') || loading) ? 'pulsing' : ''} md-ripple`}
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
                background: gateStatus.includes('zavřen') ? 'var(--md-error)' : 
                           gateStatus.includes('otevřen') ? 'var(--md-success)' : 'var(--md-primary)',
                color: 'white',
                boxShadow: 'var(--md-elevation-4-shadow)',
                cursor: (loading || !mqttConnected) ? 'not-allowed' : 'pointer',
                opacity: (loading || !mqttConnected) ? 0.6 : 1,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'translateY(0px) scale(1)',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                if (!loading && mqttConnected && !gateStatus.includes('se...')) {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                  e.currentTarget.style.boxShadow = 'var(--md-elevation-5-shadow)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && mqttConnected) {
                  e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                  e.currentTarget.style.boxShadow = 'var(--md-elevation-4-shadow)';
                }
              }}
              onMouseDown={(e) => {
                if (!loading && mqttConnected) {
                  e.currentTarget.style.transform = 'translateY(2px) scale(0.98)';
                  e.currentTarget.style.boxShadow = 'var(--md-elevation-2-shadow)';
                }
              }}
              onMouseUp={(e) => {
                if (!loading && mqttConnected) {
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
                {/* Timer uvnitř tlačítka */}
                {timerState.isActive && (
                  <div 
                    style={{ 
                      fontSize: '16px', 
                      fontWeight: '700',
                      color: timerState.type === 'travel' ? '#ffeb3b' : '#4caf50',
                      marginTop: '8px',
                      textShadow: timerState.type === 'travel' ? '0 0 10px rgba(255, 235, 59, 0.5)' : '0 0 10px rgba(76, 175, 80, 0.5)'
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
              disabled={loading || !mqttConnected}
              className={`md-fab md-fab-extended md-ripple ${(garageStatus.includes('se...') || loading) ? 'pulsing' : ''}`}
              style={{
                minWidth: '140px',
                height: '56px',
                background: garageStatus.includes('zavřen') ? 'var(--md-error)' : 
                           garageStatus.includes('otevřen') ? 'var(--md-success)' : 'var(--md-secondary)',
                opacity: (loading || !mqttConnected) ? 0.6 : 1
              }}
              aria-label={`Ovládat garáž - aktuální stav: ${garageStatus}`}
            >
              <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M12 3L2 9v12h20V9L12 3zm8 16H4v-8l8-5.33L20 11v8zm-2-6v4h-2v-4h2zm-4 0v4h-2v-4h2zm-4 0v4H8v-4h2z"/>
              </svg>
              <span>{garageStatus !== 'Neznámý stav' ? garageStatus : 'Garáž'}</span>
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
              {currentUser?.displayName || currentUser?.email}
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
            
            {/* GPS Status - only for admins */}
            {currentUser?.permissions.manageUsers && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: locationPermission === true 
                      ? 'var(--md-success)' 
                      : locationPermission === false 
                        ? 'var(--md-error)' 
                        : 'var(--md-warning)'
                  }}
                ></div>
                <span 
                  style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}
                  title={currentLocation 
                    ? `Lokace: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)} (přesnost: ${Math.round(currentLocation.accuracy)}m)`
                    : locationError || undefined}
                >
                  GPS: {locationPermission === true 
                    ? (currentLocation 
                        ? (currentLocation.accuracy > 50000 
                            ? 'Fallback Praha' 
                            : `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                          )
                        : 'Aktivní (získávám lokaci)')
                    : locationPermission === false 
                      ? (locationError ? 'Nedostupné' : 'Odepřeno')
                      : 'Načítám...'}
                </span>
              </div>
            )}
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
  );
};

export default Dashboard;