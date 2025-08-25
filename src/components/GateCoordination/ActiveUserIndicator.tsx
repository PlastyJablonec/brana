import React from 'react';
import { GateCoordinationStatus } from '../../hooks/useGateCoordination';
import './GateCoordination.css';

interface ActiveUserIndicatorProps {
  status: GateCoordinationStatus;
  className?: string;
}

export const ActiveUserIndicator: React.FC<ActiveUserIndicatorProps> = ({ 
  status, 
  className = '' 
}) => {
  const getIndicatorContent = () => {
    if (status.isActive) {
      return {
        icon: '🎮',
        text: 'Ovládáte bránu',
        subtext: 'Můžete použít tlačítka',
        className: 'active-user-indicator--active'
      };
    }

    if (status.isInQueue) {
      return {
        icon: '⏳',
        text: status.waitingTimeText,
        subtext: `${status.queueLength} čeká${status.queueLength === 1 ? '' : 'jí'} celkem`,
        className: 'active-user-indicator--queued'
      };
    }

    if (status.isBlocked && status.activeUser) {
      return {
        icon: '🔒',
        text: `Aktivní: ${status.activeUser}`,
        subtext: 'Můžete se zařadit do fronty',
        className: 'active-user-indicator--blocked'
      };
    }

    return {
      icon: '✅',
      text: 'Brána volná',
      subtext: 'Můžete ovládat',
      className: 'active-user-indicator--free'
    };
  };

  const indicator = getIndicatorContent();

  return (
    <div className={`active-user-indicator ${indicator.className} ${className}`}>
      <div className="active-user-indicator__icon">
        {indicator.icon}
      </div>
      <div className="active-user-indicator__content">
        <div className="active-user-indicator__text">
          {indicator.text}
        </div>
        <div className="active-user-indicator__subtext">
          {indicator.subtext}
        </div>
      </div>
    </div>
  );
};