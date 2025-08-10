import React, { useState, useEffect } from 'react';
import { gateActivityService, CombinedGateActivity } from '../services/gateActivityService';

interface LastGateActivityProps {
  limit?: number;
}

const LastGateActivity: React.FC<LastGateActivityProps> = ({ limit = 5 }) => {
  const [activities, setActivities] = useState<CombinedGateActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadActivities = async () => {
      try {
        console.log('🔧 LastGateActivity: Loading activities...');
        setLoading(true);
        setError('');
        const data = await gateActivityService.getCombinedGateActivities(limit);
        console.log('🔧 LastGateActivity: Loaded activities:', data);
        setActivities(data);
      } catch (err) {
        console.error('❌ LastGateActivity: Error loading gate activities:', err);
        setError('Chyba při načítání aktivit');
      } finally {
        setLoading(false);
      }
    };

    // Načti initial data
    loadActivities();

    // Subscribe na změny
    const unsubscribe = gateActivityService.onActivitiesChange((newActivities) => {
      console.log('🔔 LastGateActivity: Activities changed:', newActivities);
      setActivities(newActivities);
      setLoading(false);
    });

    console.log('🔧 LastGateActivity: Component mounted, subscribed to changes');
    return unsubscribe;
  }, [limit]);

  if (loading) {
    return (
      <div className="md-card" style={{ marginBottom: '16px' }}>
        <div className="md-card-header">
          <h3 className="md-card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg style={{ width: '18px', height: '18px', fill: 'currentColor' }} viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
            </svg>
            Poslední aktivita brány
          </h3>
        </div>
        <div className="md-card-content" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)' }}>
            Načítám aktivity...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="md-card" style={{ marginBottom: '16px' }}>
        <div className="md-card-header">
          <h3 className="md-card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg style={{ width: '18px', height: '18px', fill: 'currentColor' }} viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
            </svg>
            Poslední aktivita brány
          </h3>
        </div>
        <div className="md-card-content" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--md-error)' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="md-card" style={{ marginBottom: '16px' }}>
        <div className="md-card-header">
          <h3 className="md-card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg style={{ width: '18px', height: '18px', fill: 'currentColor' }} viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
            </svg>
            Poslední aktivita brány
          </h3>
        </div>
        <div className="md-card-content" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)' }}>
            Žádné aktivity zatím
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="md-card" style={{ marginBottom: '16px' }}>
      <div className="md-card-header">
        <h3 className="md-card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg style={{ width: '18px', height: '18px', fill: 'currentColor' }} viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
          </svg>
          Poslední aktivita brány
        </h3>
      </div>
      <div className="md-card-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                backgroundColor: index === 0 ? 'var(--md-surface-container-low)' : 'transparent',
                borderRadius: '8px',
                border: index === 0 ? '1px solid var(--md-outline-variant)' : 'none'
              }}
            >
              {/* Ikona podle zdroje */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: activity.source === 'app' ? 'var(--md-primary-container)' : 'var(--md-tertiary-container)',
                color: activity.source === 'app' ? 'var(--md-on-primary-container)' : 'var(--md-on-tertiary-container)',
                flexShrink: 0
              }}>
                {activity.source === 'app' ? (
                  // App ikona
                  <svg style={{ width: '12px', height: '12px', fill: 'currentColor' }} viewBox="0 0 24 24">
                    <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                  </svg>
                ) : (
                  // External ikona
                  <svg style={{ width: '12px', height: '12px', fill: 'currentColor' }} viewBox="0 0 24 24">
                    <path d="M19,3H5A2,2 0 0,0 3,5V9H5V5H19V19H5V15H3V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M10.08,15.58L11.5,17L16.5,12L11.5,7L10.08,8.41L12.67,11H3V13H12.67L10.08,15.58Z"/>
                  </svg>
                )}
              </div>
              
              {/* Obsah aktivity */}
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: index === 0 ? '500' : '400',
                  color: 'var(--md-on-surface)',
                  lineHeight: 1.3
                }}>
                  {gateActivityService.formatActivityDetails(activity)}
                </div>
                {index === 0 && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--md-primary)',
                    marginTop: '2px',
                    fontWeight: '500'
                  }}>
                    Nejnovější aktivita
                  </div>
                )}
              </div>
              
              {/* Čas */}
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--md-on-surface-variant)',
                textAlign: 'right',
                flexShrink: 0
              }}>
                {gateActivityService.formatActivityTime(activity.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LastGateActivity;