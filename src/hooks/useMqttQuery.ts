import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mqttService, IMqttStatus } from '../services/mqttService';
import { useEffect, useRef } from 'react';

// Query keys for consistent caching
export const MQTT_QUERY_KEYS = {
  status: ['mqtt', 'status'] as const,
  connection: ['mqtt', 'connection'] as const,
} as const;

// Hook for MQTT status with real-time updates
export function useMqttStatus() {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Query for current MQTT status
  const query = useQuery({
    queryKey: MQTT_QUERY_KEYS.status,
    queryFn: () => mqttService.getStatus(),
    staleTime: 1000, // Very short stale time for real-time data
    refetchInterval: 2000, // Refetch every 2 seconds as fallback
  });

  // Set up real-time subscription
  useEffect(() => {
    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Subscribe to status changes
    unsubscribeRef.current = mqttService.onStatusChange((status: IMqttStatus) => {
      console.log('🔄 MQTT status updated via subscription:', status);
      queryClient.setQueryData(MQTT_QUERY_KEYS.status, status);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [queryClient]);

  return query;
}

// Hook for MQTT connection status
export function useMqttConnection() {
  return useQuery({
    queryKey: MQTT_QUERY_KEYS.connection,
    queryFn: () => mqttService.isConnected(),
    staleTime: 500,
    refetchInterval: 1000,
  });
}

// Mutation for MQTT commands with optimistic updates
export function useMqttCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      command, 
      userEmail 
    }: { 
      command: 'gate' | 'garage' | 'stop'; 
      userEmail: string; 
    }) => {
      switch (command) {
        case 'gate':
          return await mqttService.publishGateCommand(userEmail);
        case 'garage':
          return await mqttService.publishGarageCommand(userEmail);
        case 'stop':
          return await mqttService.publishStopCommand(userEmail);
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    },
    onMutate: async ({ command }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: MQTT_QUERY_KEYS.status });

      // Snapshot previous value
      const previousStatus = queryClient.getQueryData<IMqttStatus>(MQTT_QUERY_KEYS.status);

      // Optimistically update status based on command
      if (previousStatus) {
        const optimisticStatus: IMqttStatus = { ...previousStatus };
        
        switch (command) {
          case 'gate':
            optimisticStatus.gateStatus = 'Otevírá se...';
            break;
          case 'garage':
            optimisticStatus.garageStatus = 'Garáž - otevírá se...';
            break;
          case 'stop':
            optimisticStatus.gateStatus = 'STOP režim';
            break;
        }
        
        queryClient.setQueryData(MQTT_QUERY_KEYS.status, optimisticStatus);
      }

      return { previousStatus };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousStatus) {
        queryClient.setQueryData(MQTT_QUERY_KEYS.status, context.previousStatus);
      }
      console.error(`🚨 MQTT ${variables.command} command failed:`, error);
    },
    onSuccess: (data, variables) => {
      console.log(`✅ MQTT ${variables.command} command sent successfully`);
      // Don't manually update - let the real-time subscription handle it
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: MQTT_QUERY_KEYS.status });
    },
  });
}

// Hook for MQTT connection management
export function useMqttConnectionManager() {
  const queryClient = useQueryClient();

  const connect = useMutation({
    mutationFn: () => mqttService.connect(),
    onSuccess: () => {
      console.log('✅ MQTT connected successfully');
      queryClient.invalidateQueries({ queryKey: MQTT_QUERY_KEYS.connection });
      queryClient.invalidateQueries({ queryKey: MQTT_QUERY_KEYS.status });
    },
    onError: (error) => {
      console.error('🚨 MQTT connection failed:', error);
    },
  });

  const disconnect = useMutation({
    mutationFn: () => {
      mqttService.disconnect();
      return Promise.resolve();
    },
    onSuccess: () => {
      console.log('✅ MQTT disconnected successfully');
      queryClient.invalidateQueries({ queryKey: MQTT_QUERY_KEYS.connection });
      queryClient.setQueryData(MQTT_QUERY_KEYS.status, {
        gateStatus: 'Neznámý stav',
        garageStatus: 'Neznámý stav',
        isConnected: false,
      } as IMqttStatus);
    },
  });

  return {
    connect,
    disconnect,
  };
}