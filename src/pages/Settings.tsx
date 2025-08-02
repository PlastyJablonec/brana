import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { settingsService, AppSettings } from '../services/settingsService';
import { activityService } from '../services/activityService';
import { lastUserService, LastUserInfo } from '../services/lastUserService';
import { locationService } from '../services/locationService';

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUser, setLastUser] = useState<LastUserInfo | null>(null);
  const [testingGPS, setTestingGPS] = useState(false);
  const [gpsTestResult, setGpsTestResult] = useState<string>('');

  useEffect(() => {
    const loadSettings = async () => {
      if (!currentUser?.permissions.manageUsers) return;
      
      try {
        setLoading(true);
        const appSettings = await settingsService.getAppSettings();
        
        // Zajistíme že lastUser existuje (pro starší nastavení)
        if (!appSettings.lastUser) {
          appSettings.lastUser = {
            showLastUser: true,
            allowedRoles: ['admin', 'user'],
            maxAgeHours: 24
          };
        }
        
        setSettings(appSettings);
        
        // Načteme také posledního uživatele brány
        const lastGateUser = await lastUserService.getLastUser('gate');
        setLastUser(lastGateUser);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [currentUser]);

  const handleSaveSettings = async () => {
    if (!settings || !currentUser) return;

    try {
      setSaving(true);
      await settingsService.saveAppSettings(settings);
      
      // Log the settings change
      await activityService.logActivity({
        user: currentUser.email,
        userDisplayName: currentUser.displayName,
        action: 'Změna nastavení systému',
        device: 'gate',
        status: 'success',
        details: `Nastavení bylo aktualizováno administrátorem`
      });

      alert('Nastavení bylo úspěšně uloženo!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Chyba při ukládání nastavení');
    } finally {
      setSaving(false);
    }
  };

  const testGPS = async () => {
    setTestingGPS(true);
    setGpsTestResult('');
    
    try {
      console.log('🔧 Settings: Starting GPS test...');
      
      // Nejdřív zkusíme zjistit proč GPS nefunguje
      console.log('🔧 Settings: Checking GPS availability...');
      console.log('🔧 Settings: navigator.geolocation:', !!navigator.geolocation);
      console.log('🔧 Settings: isSecureContext:', window.isSecureContext);
      console.log('🔧 Settings: protocol:', window.location.protocol);
      console.log('🔧 Settings: hostname:', window.location.hostname);
      
      const location = await locationService.getCurrentLocation();
      const isFallback = location.accuracy > 50000;
      const accuracyText = isFallback ? ' - FALLBACK (Praha centrum pro desktop)' : ` (přesnost: ${Math.round(location.accuracy)}m)`;
      setGpsTestResult(`✅ ${isFallback ? 'Fallback lokace' : 'GPS'} funguje! Lokace: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${accuracyText}`);
    } catch (error: any) {
      console.error('🔧 Settings: GPS test failed:', error);
      
      let errorMsg = '';
      if (error.code) {
        errorMsg = `❌ GPS chyba (kód ${error.code}): ${error.message}`;
      } else {
        errorMsg = `❌ GPS chyba: ${error.message || 'Neznámá chyba'}`;
      }
      
      setGpsTestResult(errorMsg);
    } finally {
      setTestingGPS(false);
    }
  };

  const useFallbackLocation = () => {
    const fallback = {
      latitude: 50.0755,
      longitude: 14.4378,
      accuracy: 99999,
      timestamp: Date.now()
    };
    
    setGpsTestResult(`✅ Fallback lokace nastavena: ${fallback.latitude.toFixed(6)}, ${fallback.longitude.toFixed(6)} (Praha centrum - automaticky pro desktop)`);
  };

  if (!currentUser?.permissions.manageUsers) {
    return (
      <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
        {/* Header */}
        <div className="md-card md-card-elevated" style={{ marginBottom: '16px' }}>
          <div className="md-card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="md-card-title">Nastavení systému</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ThemeToggle />
              <button 
                onClick={() => navigate('/dashboard')}
                className="btn-icon md-ripple"
                style={{ 
                  background: 'var(--md-surface-variant)', 
                  border: '1px solid var(--md-outline)',
                  borderRadius: '12px',
                  color: 'var(--md-on-surface-variant)',
                  boxShadow: 'var(--md-elevation-1-shadow)'
                }}
              >
                <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Access Denied */}
        <div className="md-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <svg style={{ width: '64px', height: '64px', color: 'var(--md-error)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.248 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="md-card-title" style={{ color: 'var(--md-error)', marginBottom: '8px' }}>Přístup odmítnut</h2>
          <p className="md-card-subtitle">Nemáte oprávnění ke správě nastavení.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
        <div style={{ padding: '64px 32px', textAlign: 'center' }}>
          <div className="loading" style={{ margin: '0 auto 16px' }}></div>
          <p className="md-card-subtitle">Načítám nastavení...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
        <div className="md-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <h2 className="md-card-title" style={{ color: 'var(--md-error)', marginBottom: '8px' }}>Chyba</h2>
          <p className="md-card-subtitle">Nelze načíst nastavení systému.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
      {/* Header */}
      <div className="md-card md-card-elevated" style={{ marginBottom: '16px' }}>
        <div className="md-card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h1 className="md-card-title" style={{ marginBottom: '4px' }}>Nastavení systému</h1>
            <p className="md-card-subtitle">
              Správa časů otevření/zavření a dalších parametrů
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button 
              onClick={() => navigate('/dashboard')}
              className="btn-icon md-ripple"
              style={{ 
                background: 'var(--md-surface-variant)', 
                border: '1px solid var(--md-outline)',
                borderRadius: '12px',
                color: 'var(--md-on-surface-variant)',
                boxShadow: 'var(--md-elevation-1-shadow)'
              }}
            >
              <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Gate Settings */}
      <div className="md-card" style={{ marginBottom: '16px' }}>
        <div className="md-card-header">
          <h2 className="md-card-title">Nastavení brány</h2>
        </div>
        
        <div className="md-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Timer Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                Čas pohybu brány (sekundy)
              </label>
              <input
                type="number"
                min="10"
                max="120"
                value={settings.gate.travelTime}
                onChange={(e) => setSettings({
                  ...settings,
                  gate: { ...settings.gate, travelTime: parseInt(e.target.value) || 31 }
                })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--md-outline)',  
                  backgroundColor: 'var(--md-surface)',
                  color: 'var(--md-on-surface)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
                Doba odpočítávání při pohybu brány
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                Čas auto-zavření (sekundy)
              </label>
              <input
                type="number"
                min="60"
                max="600"
                value={settings.gate.autoCloseTime}
                onChange={(e) => setSettings({
                  ...settings,
                  gate: { ...settings.gate, autoCloseTime: parseInt(e.target.value) || 240 }
                })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--md-outline)',
                  backgroundColor: 'var(--md-surface)',
                  color: 'var(--md-on-surface)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
                Odpočítávání po otevření ({Math.floor(settings.gate.autoCloseTime / 60)}:{(settings.gate.autoCloseTime % 60).toString().padStart(2, '0')})
              </div>
            </div>
          </div>

          {/* Toggle Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.gate.stopModeEnabled}
                onChange={(e) => setSettings({
                  ...settings,
                  gate: { ...settings.gate, stopModeEnabled: e.target.checked }
                })}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: '2px solid var(--md-outline)',
                  backgroundColor: 'var(--md-surface)',
                  cursor: 'pointer'
                }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface)', fontWeight: 500 }}>
                  STOP režim
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                  Povolení STOP režimu pro zastavení brány
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.gate.notificationsEnabled}
                onChange={(e) => setSettings({
                  ...settings,
                  gate: { ...settings.gate, notificationsEnabled: e.target.checked }
                })}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: '2px solid var(--md-outline)',
                  backgroundColor: 'var(--md-surface)',
                  cursor: 'pointer'
                }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface)', fontWeight: 500 }}>
                  Notifikace
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                  Odesílat notifikace o změnách stavu brány
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* GPS Information Card - only for admins */}
      {currentUser?.permissions.manageUsers && (
        <div className="md-card" style={{ marginBottom: '16px' }}>
          <div className="md-card-header">
            <h2 className="md-card-title">GPS Informace (Admin)</h2>
          </div>
        
        <div className="md-card-content">
          <div style={{ 
            padding: '16px', 
            backgroundColor: window.location.protocol === 'https:' ? 'var(--md-surface-variant)' : 'rgba(255, 152, 0, 0.1)', 
            borderRadius: '12px',
            border: `1px solid ${window.location.protocol === 'https:' ? 'var(--md-outline)' : 'var(--md-warning)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: window.location.protocol === 'https:' ? 'var(--md-success)' : 'var(--md-warning)'
              }}></div>
              <strong style={{ color: 'var(--md-on-surface)' }}>
                {window.location.protocol === 'https:' ? 'GPS je k dispozici' : 'GPS vyžaduje HTTPS'}
              </strong>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', margin: 0, marginBottom: '12px' }}>
              {window.location.protocol === 'https:' 
                ? 'Aplikace běží na zabezpečeném HTTPS protokolu, GPS lokace je dostupná.'
                : `Aktuálně běží na ${window.location.protocol}. Pro GPS je potřeba HTTPS nebo localhost.`
              }
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={testGPS}
                disabled={testingGPS}
                className="md-fab md-fab-extended md-ripple"
                style={{
                  background: 'var(--md-primary)',
                  color: 'var(--md-on-primary)',
                  fontSize: '0.875rem',
                  padding: '8px 16px',
                  height: 'auto',
                  minWidth: 'auto'
                }}
              >
                {testingGPS ? 'Testuji GPS...' : 'Test GPS'}
              </button>
              
              <button
                onClick={useFallbackLocation}
                className="md-fab md-fab-extended md-ripple"
                style={{
                  background: 'var(--md-warning)',
                  color: 'var(--md-on-primary)',
                  fontSize: '0.875rem',
                  padding: '8px 16px',
                  height: 'auto',
                  minWidth: 'auto'
                }}
              >
                Použít fallback
              </button>
              
              {gpsTestResult && (
                <span style={{ 
                  fontSize: '0.875rem', 
                  color: gpsTestResult.startsWith('✅') ? 'var(--md-success)' : 'var(--md-error)',
                  flex: 1,
                  wordBreak: 'break-word'
                }}>
                  {gpsTestResult}
                </span>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Location Settings */}
      <div className="md-card" style={{ marginBottom: '16px' }}>
        <div className="md-card-header">
          <h2 className="md-card-title">Nastavení polohy brány</h2>
        </div>
        
        <div className="md-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ 
            padding: '12px', 
            backgroundColor: 'var(--md-surface-variant)', 
            borderRadius: '8px',
            border: '1px solid var(--md-outline)'
          }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', margin: 0 }}>
              📍 Nastavte polohu brány a maximální vzdálenost pro uživatele s omezením přístupu podle vzdálenosti.
            </p>
          </div>

          {/* Gate Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                Zeměpisná šířka
              </label>
              <input
                type="number"
                step="0.000001"
                value={settings.location?.gateLatitude || 50.719252}
                onChange={(e) => setSettings({
                  ...settings,
                  location: { 
                    ...settings.location, 
                    gateLatitude: parseFloat(e.target.value) || 50.719252 
                  }
                })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--md-outline)',
                  backgroundColor: 'var(--md-surface)',
                  color: 'var(--md-on-surface)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                placeholder="50.719252"
                onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
                Latitude (např. 50.719252)
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                Zeměpisná délka
              </label>
              <input
                type="number"
                step="0.000001"
                value={settings.location?.gateLongitude || 15.162632}
                onChange={(e) => setSettings({
                  ...settings,
                  location: { 
                    ...settings.location, 
                    gateLongitude: parseFloat(e.target.value) || 15.162632 
                  }
                })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--md-outline)',
                  backgroundColor: 'var(--md-surface)',
                  color: 'var(--md-on-surface)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                placeholder="15.162632"
                onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
                Longitude (např. 15.162632)
              </div>
            </div>
          </div>

          {/* Max Distance */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
              Maximální vzdálenost (metry)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={settings.location?.maxDistanceMeters || ''}
              onChange={(e) => setSettings({
                ...settings,
                location: { 
                  ...settings.location, 
                  maxDistanceMeters: e.target.value === '' ? 15 : parseInt(e.target.value) || 15
                }
              })}
              style={{
                width: '200px',
                padding: '12px 16px',
                fontSize: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--md-outline)',
                backgroundColor: 'var(--md-surface)',
                color: 'var(--md-on-surface)',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              placeholder="15"
              onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
              Uživatelé s omezením vzdálenosti nemohou ovládat bránu ze vzdálenosti větší než {settings.location?.maxDistanceMeters || 15}m
            </div>
          </div>

          {/* Current Location Display */}
          <div style={{ 
            padding: '16px', 
            backgroundColor: 'var(--md-surface-container)', 
            borderRadius: '12px',
            border: '1px solid var(--md-outline)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <svg style={{ width: '16px', height: '16px', color: 'var(--md-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <strong style={{ fontSize: '0.875rem', color: 'var(--md-on-surface)' }}>
                Nastavená poloha brány
              </strong>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', fontFamily: 'monospace' }}>
              📍 {(settings.location?.gateLatitude || 50.719252).toFixed(6)}, {(settings.location?.gateLongitude || 15.162632).toFixed(6)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
              Maximální vzdálenost: {settings.location?.maxDistanceMeters || 15} metrů
            </div>
          </div>
        </div>
      </div>

      {/* Last User Settings */}
      <div className="md-card" style={{ marginBottom: '16px' }}>
        <div className="md-card-header">
          <h2 className="md-card-title">Poslední uživatel brány</h2>
        </div>
        
        <div className="md-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Current Last User Display */}
          {lastUser && (
            <div style={{ 
              padding: '16px', 
              backgroundColor: 'var(--md-surface-variant)', 
              borderRadius: '12px',
              border: '1px solid var(--md-outline)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <h3 style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--md-on-surface-variant)', 
                  fontWeight: 600,
                  margin: 0
                }}>
                  Poslední aktivita brány
                </h3>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--md-on-surface-variant)',
                  fontFamily: 'monospace'
                }}>
                  {lastUserService.formatLastUserTime(lastUser.timestamp)}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px' 
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--md-on-primary)',
                  fontSize: '1rem',
                  fontWeight: 600
                }}>
                  {lastUser.userDisplayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '1rem', 
                    color: 'var(--md-on-surface)', 
                    fontWeight: 500 
                  }}>
                    {lastUser.userDisplayName}
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: 'var(--md-on-surface-variant)' 
                  }}>
                    {lastUser.action}
                  </div>
                  {lastUser.location && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--md-on-surface-variant)',
                      fontFamily: 'monospace'
                    }}>
                      📍 {lastUser.location.latitude.toFixed(6)}, {lastUser.location.longitude.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.lastUser?.showLastUser || false}
                onChange={(e) => setSettings({
                  ...settings,
                  lastUser: { ...(settings.lastUser || {}), showLastUser: e.target.checked }
                })}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: '2px solid var(--md-outline)',
                  backgroundColor: 'var(--md-surface)',
                  cursor: 'pointer'
                }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface)', fontWeight: 500 }}>
                  Zobrazovat posledního uživatele
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                  Povolí zobrazení informací o posledním uživateli brány
                </div>
              </div>
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '8px', fontWeight: 500 }}>
                Maximální stáří záznamu (hodiny)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={settings.lastUser?.maxAgeHours || 24}
                onChange={(e) => setSettings({
                  ...settings,
                  lastUser: { ...(settings.lastUser || {}), maxAgeHours: parseInt(e.target.value) || 24 }
                })}
                style={{
                  width: '200px',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--md-outline)',
                  backgroundColor: 'var(--md-surface)',
                  color: 'var(--md-on-surface)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--md-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--md-outline)'}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>
                Jak staré záznamy zobrazovat (1-168 hodin)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          className="md-fab md-fab-extended md-ripple"
          style={{
            background: 'var(--md-surface-variant)',
            color: 'var(--md-on-surface-variant)',
            border: '1px solid var(--md-outline)'
          }}
        >
          Zrušit
        </button>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="md-fab md-fab-extended md-ripple"
          style={{
            background: 'var(--md-primary)',
            color: 'var(--md-on-primary)',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? 'Ukládám...' : 'Uložit nastavení'}
        </button>
      </div>
    </div>
  );
};

export default Settings;