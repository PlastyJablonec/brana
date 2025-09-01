import React from 'react';
import { GateCoordination } from '../../services/gateCoordinationService';
import { useAuth } from '../../contexts/AuthContext';
import './GateCoordination.css';

interface ReservationQueueProps {
  coordinationState: GateCoordination | null;
  onLeaveQueue: () => Promise<void>;
  gateStatus?: string; // NOVÉ: Stav brány pro čekající uživatele
  className?: string;
}

export const ReservationQueue: React.FC<ReservationQueueProps> = ({ 
  coordinationState, 
  onLeaveQueue,
  gateStatus = 'Neznámý stav',
  className = '' 
}) => {
  const { currentUser } = useAuth();

  if (!coordinationState || coordinationState.reservationQueue.length === 0) {
    return null;
  }

  const isUserInQueue = currentUser && coordinationState.reservationQueue.some(
    user => user.userId === currentUser.id
  );

  return (
    <div className={`reservation-queue ${className}`}>
      <div className="reservation-queue__header">
        <h3>Fronta čekajících ({coordinationState.reservationQueue.length})</h3>
        {isUserInQueue && (
          <button 
            onClick={onLeaveQueue}
            className="reservation-queue__leave-btn"
            title="Opustit frontu"
          >
            ❌ Zrušit čekání
          </button>
        )}
      </div>
      
      {/* NOVÉ: Zobrazení stavu brány pro čekající uživatele */}
      <div className="reservation-queue__gate-status" style={{
        padding: '12px',
        marginBottom: '16px',
        borderRadius: '8px',
        background: gateStatus.includes('se...') 
          ? 'rgba(255, 193, 7, 0.2)' 
          : gateStatus.includes('otevřen') 
          ? 'rgba(76, 175, 80, 0.2)' 
          : 'rgba(158, 158, 158, 0.2)',
        border: `2px solid ${gateStatus.includes('se...') 
          ? 'rgba(255, 193, 7, 0.4)' 
          : gateStatus.includes('otevřen') 
          ? 'rgba(76, 175, 80, 0.4)' 
          : 'rgba(158, 158, 158, 0.4)'}`,
        textAlign: 'center',
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--md-on-surface)'
      }}>
        🚪 Stav brány: {gateStatus}
        {gateStatus.includes('se...') && (
          <div style={{
            fontSize: '14px',
            fontWeight: '500',
            marginTop: '4px',
            color: 'rgba(255, 193, 7, 1)',
            animation: 'pulse 1s infinite'
          }}>
            Pohyb brány...
          </div>
        )}
      </div>
      
      <div className="reservation-queue__list">
        {coordinationState.reservationQueue.map((user, index) => {
          const isCurrentUser = currentUser?.id === user.userId;
          const waitingTime = Math.floor((Date.now() - user.timestamp) / (1000 * 60));
          
          return (
            <div 
              key={user.sessionId} 
              className={`reservation-queue__item ${isCurrentUser ? 'reservation-queue__item--current' : ''}`}
            >
              <div className="reservation-queue__position">
                {index + 1}.
              </div>
              <div className="reservation-queue__user">
                <span className="reservation-queue__name">
                  {user.userDisplayName}
                  {isCurrentUser && ' (vy)'}
                </span>
                <span className="reservation-queue__time">
                  čeká {waitingTime} min
                </span>
              </div>
              <div className="reservation-queue__status">
                {index === 0 ? '🟢 Další' : '⏳ Čeká'}
              </div>
            </div>
          );
        })}
      </div>

      {coordinationState.activeUser && (
        <div className="reservation-queue__active">
          <div className="reservation-queue__active-label">Právě ovládá:</div>
          <div className="reservation-queue__active-user">
            🎮 {coordinationState.activeUser.userDisplayName}
          </div>
        </div>
      )}
    </div>
  );
};