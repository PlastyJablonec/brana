import React from 'react';
import { useAuthUser } from '../../hooks/useAuthUser';
import { useMqttStatus, useMqttCommand } from '../../hooks/useMqttQuery';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { DashboardPresentation } from './DashboardPresentation';
import ErrorBoundary from '../ErrorBoundary';

export const DashboardContainer: React.FC = () => {
  // Custom hooks for data management
  const { currentUser, logout } = useAuthUser();
  const mqttStatus = useMqttStatus();
  const mqttCommand = useMqttCommand();
  const locationPermission = useLocationPermission();

  // Loading state - combine all loading states
  const isLoading = mqttStatus.isLoading || mqttCommand.isPending;

  // Error handling
  const error = mqttStatus.error || locationPermission.error;

  // Command handlers
  const handleGateCommand = async () => {
    if (!currentUser?.email) return;
    
    try {
      await mqttCommand.mutateAsync({
        command: 'gate',
        userEmail: currentUser.email
      });
    } catch (error) {
      console.error('🚨 Gate command failed:', error);
    }
  };

  const handleGarageCommand = async () => {
    if (!currentUser?.email) return;
    
    try {
      await mqttCommand.mutateAsync({
        command: 'garage',
        userEmail: currentUser.email
      });
    } catch (error) {
      console.error('🚨 Garage command failed:', error);
    }
  };

  const handleStopCommand = async () => {
    if (!currentUser?.email) return;
    
    try {
      await mqttCommand.mutateAsync({
        command: 'stop',
        userEmail: currentUser.email
      });
    } catch (error) {
      console.error('🚨 Stop command failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('🚨 Logout failed:', error);
    }
  };

  return (
    <ErrorBoundary>
      <DashboardPresentation
        // User data
        currentUser={currentUser}
        onLogout={handleLogout}
        
        // MQTT data
        gateStatus={mqttStatus.data?.gateStatus || 'Neznámý stav'}
        garageStatus={mqttStatus.data?.garageStatus || 'Neznámý stav'}
        mqttConnected={mqttStatus.data?.isConnected || false}
        
        // Location data
        locationPermission={locationPermission.hasPermission}
        locationError={locationPermission.error?.message}
        currentLocation={locationPermission.location}
        
        // Loading and error states
        isLoading={isLoading}
        error={error}
        
        // Command handlers
        onGateCommand={handleGateCommand}
        onGarageCommand={handleGarageCommand}
        onStopCommand={handleStopCommand}
        
        // Command states
        isGateCommandPending={mqttCommand.isPending && mqttCommand.variables?.command === 'gate'}
        isGarageCommandPending={mqttCommand.isPending && mqttCommand.variables?.command === 'garage'}
        isStopCommandPending={mqttCommand.isPending && mqttCommand.variables?.command === 'stop'}
      />
    </ErrorBoundary>
  );
};