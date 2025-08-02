import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { activityService, ActivityLog } from '../services/activityService';

const ActivityLogs: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Load activities from DB
  useEffect(() => {
    const loadActivities = async () => {
      if (!currentUser?.permissions.viewLogs) return;
      
      try {
        setLoading(true);
        console.log('🔧 ActivityLogs: Loading activities from DB...');
        const logs = await activityService.getRecentActivities(100);
        setActivities(logs);
        console.log('🔧 ActivityLogs: Loaded', logs.length, 'activities');
      } catch (error) {
        console.error('🔧 ActivityLogs: Error loading activities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, [currentUser]);

  if (!currentUser?.permissions.viewLogs) {
    return (
      <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
        {/* Header */}
        <div className="md-card md-card-elevated" style={{ marginBottom: '16px' }}>
          <div className="md-card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="md-card-title">Logy aktivit</h1>
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
          <p className="md-card-subtitle">Nemáte oprávnění k zobrazení logů.</p>
        </div>
      </div>
    );
  }

  const filters = [
    { key: 'all', label: 'Vše', count: activities.length },
    { key: 'success', label: 'Úspěšné', count: activities.filter(l => l.status === 'success').length },
    { key: 'warning', label: 'Varování', count: activities.filter(l => l.status === 'warning').length },
    { key: 'error', label: 'Chyby', count: activities.filter(l => l.status === 'error').length },
  ];

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'success': return 'status-success';
      case 'warning': return 'status-warning';
      case 'error': return 'status-error';
      default: return 'status-error';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />;
      case 'warning':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.248 16.5c-.77.833.192 2.5 1.732 2.5z" />;
      case 'error':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />;
      default:
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
    }
  };

  const filteredLogs = selectedFilter === 'all' ? activities : activities.filter(log => log.status === selectedFilter);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '--:--:--';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const logDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const timeString = date.toLocaleTimeString('cs-CZ', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    if (logDate.getTime() === today.getTime()) {
      return `Dnes ${timeString}`;
    } else {
      return date.toLocaleString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
      {/* Header with Material Design */}
      <div className="md-card md-card-elevated" style={{ marginBottom: '16px' }}>
        <div className="md-card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h1 className="md-card-title" style={{ marginBottom: '4px' }}>Historie aktivit</h1>
            <p className="md-card-subtitle">
              Přehled všech akcí a událostí v systému
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

      {/* Filters */}
      <div className="md-card" style={{ marginBottom: '16px' }}>
        <div className="md-card-content" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSelectedFilter(filter.key)}
              className="md-ripple"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: selectedFilter === filter.key ? '2px solid var(--md-primary)' : '1px solid var(--md-outline)',
                backgroundColor: selectedFilter === filter.key ? 'var(--md-primary)' : 'var(--md-surface)',
                color: selectedFilter === filter.key ? 'var(--md-on-primary)' : 'var(--md-on-surface)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {filter.label}
              <span style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                backgroundColor: selectedFilter === filter.key ? 'rgba(255,255,255,0.2)' : 'var(--md-surface-variant)',
                color: selectedFilter === filter.key ? 'white' : 'var(--md-on-surface-variant)'
              }}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Logs */}
      <div className="md-card">
        <div className="md-card-header">
          <h2 className="md-card-title">Záznamy aktivit</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '64px 32px', textAlign: 'center' }}>
              <div className="loading" style={{ margin: '0 auto 16px' }}></div>
              <p className="md-card-subtitle">Načítám aktivity...</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={log.id} style={{ 
                padding: '16px', 
                borderBottom: index < filteredLogs.length - 1 ? '1px solid var(--md-outline-variant)' : 'none',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--md-surface-variant)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: log.status === 'success' ? 'var(--md-success)' : 
                                     log.status === 'warning' ? 'var(--md-warning)' : 'var(--md-error)',
                      color: 'white'
                    }}>
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {getStatusIcon(log.status)}
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--md-on-surface)', marginBottom: '4px' }}>
                        {log.action}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)' }}>
                        {log.userDisplayName || log.user} • {formatTime(log.timestamp)}
                        {log.location && (
                          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                            <a 
                              href={`https://maps.google.com/maps?q=${log.location.latitude},${log.location.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ 
                                color: 'var(--md-primary)', 
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                              onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
                            >
                              📍 Zobrazit na mapě
                              <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      backgroundColor: log.device === 'gate' ? 'var(--md-primary)' : 'var(--md-secondary)',
                      color: 'white'
                    }}>
                      {log.device === 'gate' ? 'Brána' : 'Garáž'}
                    </span>
                    <button 
                      className="btn-icon md-ripple"
                      style={{
                        background: 'var(--md-surface-variant)',
                        border: '1px solid var(--md-outline)',
                        borderRadius: '8px',
                        color: 'var(--md-on-surface-variant)',
                        width: '36px',
                        height: '36px'
                      }}
                      title={log.details}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredLogs.length === 0 && (
          <div style={{ padding: '64px 32px', textAlign: 'center' }}>
            <svg style={{ width: '64px', height: '64px', color: 'var(--md-on-surface-variant)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="md-card-subtitle">Žádné záznamy nenalezeny</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;