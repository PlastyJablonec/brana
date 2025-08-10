import React, { useState, useEffect } from 'react';
import { updateService, UpdateCheckResult } from '../services/updateService';

const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Subscribe na update notifikace
    const unsubscribe = updateService.onUpdateAvailable((result) => {
      console.log('🔔 UpdateNotification: Update available:', result);
      setUpdateInfo(result);
      setIsVisible(true);
    });

    // Start periodic checking
    updateService.startPeriodicCheck(15); // každých 15 minut

    return () => {
      unsubscribe();
      updateService.stopPeriodicCheck();
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      await updateService.forceRefresh();
    } catch (error) {
      console.error('Update failed:', error);
      setIsUpdating(false);
      // Error handling - user will see it in console, page should reload anyway
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setUpdateInfo(null);
  };

  const handleCheckNow = async () => {
    console.log('🔍 UpdateNotification: Manual update check');
    setIsUpdating(true);
    
    try {
      const result = await updateService.checkForUpdates();
      console.log('📊 Manual check result:', result);
      
      if (result.hasUpdate) {
        setUpdateInfo(result);
        setIsVisible(true);
      } else {
        // Zobraz krátkou info že není update
        setIsVisible(true);
        setUpdateInfo({
          hasUpdate: false,
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion
        });
        
        // Hide po 3 sekundách
        setTimeout(() => {
          setIsVisible(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Manual check failed:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isVisible || !updateInfo) {
    // Zobraz malé tlačítko pro manuální kontrolu
    return (
      <button
        onClick={handleCheckNow}
        disabled={isUpdating}
        className="btn-icon md-ripple"
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--md-surface-container)',
          border: '1px solid var(--md-outline)',
          color: 'var(--md-on-surface-variant)',
          boxShadow: 'var(--md-elevation-2-shadow)',
          zIndex: 1000,
          opacity: isUpdating ? 0.6 : 1
        }}
        title="Zkontrolovat aktualizace"
      >
        {isUpdating ? (
          <div style={{ width: '20px', height: '20px' }}>
            <div className="loading" style={{ width: '20px', height: '20px', margin: 0 }}></div>
          </div>
        ) : (
          <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
            <path d="M12 4V2A10 10 0 0 0 2 12H4A8 8 0 0 1 12 4Z"/>
            <path d="M20.83 12.13C20.83 12.13 20.83 12.13 20.83 12.13L22.63 10.33C22.78 10.18 22.78 9.93 22.63 9.78L20.83 8C20.68 7.85 20.43 7.85 20.28 8L18.48 9.8C18.33 9.95 18.33 10.2 18.48 10.35L20.28 12.13C20.43 12.28 20.68 12.28 20.83 12.13Z"/>
          </svg>
        )}
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div className="md-card md-card-elevated" style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: 'var(--md-surface-container)',
        border: '1px solid var(--md-outline)'
      }}>
        <div className="md-card-header">
          <h3 className="md-card-title" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            color: updateInfo.hasUpdate ? 'var(--md-primary)' : 'var(--md-on-surface)'
          }}>
            {updateInfo.hasUpdate ? (
              <>
                <svg style={{ width: '24px', height: '24px', fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M12 4V2A10 10 0 0 0 2 12H4A8 8 0 0 1 12 4Z"/>
                </svg>
                Nová verze k dispozici
              </>
            ) : (
              <>
                <svg style={{ width: '24px', height: '24px', fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                </svg>
                Aplikace je aktuální
              </>
            )}
          </h3>
        </div>
        
        <div className="md-card-content">
          {updateInfo.hasUpdate ? (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ 
                fontSize: '0.875rem', 
                lineHeight: 1.5, 
                color: 'var(--md-on-surface)',
                marginBottom: '12px'
              }}>
                Je dostupná nová verze aplikace s nejnovějšími funkcemi a opravami.
              </p>
              
              {updateInfo.currentVersion && updateInfo.latestVersion && (
                <div style={{ 
                  backgroundColor: 'var(--md-surface-container-low)',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  color: 'var(--md-on-surface-variant)'
                }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Aktuální:</strong> {updateService.formatCommitHash(updateInfo.currentVersion.commit)} 
                    {' '}({updateService.formatBuildTime(updateInfo.currentVersion.buildTime)})
                  </div>
                  <div>
                    <strong>Nová:</strong> {updateService.formatCommitHash(updateInfo.latestVersion.commit)}
                    {' '}({updateService.formatBuildTime(updateInfo.latestVersion.buildTime)})
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ 
              fontSize: '0.875rem', 
              color: 'var(--md-on-surface-variant)',
              marginBottom: '16px'
            }}>
              Používáte nejnovější verzi aplikace.
            </p>
          )}
        </div>
        
        <div className="md-card-actions" style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '8px' 
        }}>
          {updateInfo.hasUpdate ? (
            <>
              <button
                onClick={handleDismiss}
                className="md-button md-button-text md-ripple"
                disabled={isUpdating}
                style={{
                  color: 'var(--md-on-surface-variant)',
                  opacity: isUpdating ? 0.6 : 1
                }}
              >
                Později
              </button>
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="md-button md-button-filled md-ripple"
                style={{
                  backgroundColor: 'var(--md-primary)',
                  color: 'var(--md-on-primary)',
                  opacity: isUpdating ? 0.6 : 1
                }}
              >
                {isUpdating ? 'Aktualizuji...' : 'Aktualizovat nyní'}
              </button>
            </>
          ) : (
            <button
              onClick={handleDismiss}
              className="md-button md-button-filled md-ripple"
              style={{
                backgroundColor: 'var(--md-primary)',
                color: 'var(--md-on-primary)'
              }}
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;