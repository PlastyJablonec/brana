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
      <div style={{ 
        padding: '8px 12px',
        backgroundColor: 'var(--md-surface-container-low)',
        borderRadius: '8px',
        border: '1px solid var(--md-outline-variant)',
        color: 'var(--md-on-surface-variant)',
        fontSize: '0.8rem'
      }}>
        🔍 DEBUG: Žádné aktivity (activities.length = {activities.length})
        <br />
        Čekám na MQTT Log/Brana/ID zprávy...
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '8px 12px',
      backgroundColor: 'var(--md-surface-container-low)',
      borderRadius: '8px',
      border: '1px solid var(--md-outline-variant)'
    }}>
      {/* Minimální header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px',
        marginBottom: '6px'
      }}>
        <svg style={{ width: '12px', height: '12px', fill: 'var(--md-on-surface-variant)' }} viewBox="0 0 24 24">
          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
        </svg>
        <span style={{ 
          fontSize: '0.75rem', 
          fontWeight: '500',
          color: 'var(--md-on-surface-variant)'
        }}>
          Poslední aktivity
        </span>
      </div>
      
      {/* Ultra kompaktní řada - vše na jednom řádku */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {activities.slice(0, 3).map((activity, index) => (
          <div
            key={`${activity.id}_${activity.timestamp.getTime()}_${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              backgroundColor: index === 0 ? 'var(--md-primary-container)' : 'var(--md-surface-container)',
              borderRadius: '12px',
              opacity: index === 0 ? 1 : 0.6
            }}
          >
            {/* Velmi malá tečka */}
            <div style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: activity.source === 'app' ? 'var(--md-primary)' : 'var(--md-tertiary)',
              flexShrink: 0
            }} />
            
            {/* Jen ID - velmi malý text */}
            <span style={{ 
              fontSize: '0.6875rem', 
              color: index === 0 ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)',
              fontWeight: index === 0 ? '500' : '400',
            }}>
              {activity.source === 'external' ? activity.id : activity.details}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LastGateActivity;