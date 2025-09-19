import React from 'react';

const UpdateNotification: React.FC = () => {
  // KOMPONENTA ZJEDNODUŠENA - updateService je nyní bezpečný
  return null; // Stále vypnuto pro jednoduchost
  
  /*
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Subscribe na update notifikace - už bez periodic check
    // const unsubscribe = updateService.onUpdateAvailable((result) => { // DOČASNĚ VYPNUTO
      console.log('🔔 UpdateNotification: Update available:', result);
      setUpdateInfo(result);
      setIsVisible(true);
    });

    return () => {
      unsubscribe();
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
        setUpdateInfo({ hasUpdate: false });
        
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
    return null; // Žádné floating tlačítko
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
              
              <div style={{ 
                backgroundColor: 'var(--md-surface-container-low)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                color: 'var(--md-on-surface-variant)'
              }}>
                <div>Service Worker detekoval novou verzi aplikace.</div>
              </div>
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
  */
};

export default UpdateNotification;