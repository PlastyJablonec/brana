import { useState, useCallback, useRef, useEffect } from 'react';
import { IAsyncOperation } from '../types';

export function useAsyncOperation<T>(
  asyncFunction: () => Promise<T>,
  dependencies: React.DependencyList = []
): IAsyncOperation<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      setLoading(true);
      setError(null);
      
      const result = await asyncFunction();
      
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        setError(error);
        console.error('🚨 Async operation failed:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [asyncFunction, ...dependencies]);

  const reset = useCallback((): void => {
    if (isMountedRef.current) {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
}

// Specialized hook for MQTT operations
export function useMqttOperation<T>(
  operation: () => Promise<T>,
  dependencies: React.DependencyList = []
): IAsyncOperation<T> & { isConnected: boolean } {
  const asyncOp = useAsyncOperation(operation, dependencies);
  const [isConnected, setIsConnected] = useState(false);

  // Import mqttService here to avoid circular dependencies
  useEffect(() => {
    const checkConnection = () => {
      // Dynamically import to avoid issues
      import('../services/mqttService').then(({ mqttService }) => {
        setIsConnected(mqttService.isConnected());
      });
    };

    checkConnection();
    const interval = setInterval(checkConnection, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...asyncOp,
    isConnected
  };
}

// Hook for operations that need retry logic
export function useRetryableOperation<T>(
  asyncFunction: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000,
  dependencies: React.DependencyList = []
): IAsyncOperation<T> & { retryCount: number; canRetry: boolean } {
  const [retryCount, setRetryCount] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const executeWithRetry = useCallback(async (): Promise<T> => {
    let currentRetry = 0;
    let lastError: Error;

    while (currentRetry <= maxRetries) {
      try {
        if (isMountedRef.current) {
          setRetryCount(currentRetry);
        }
        
        const result = await asyncFunction();
        
        if (isMountedRef.current) {
          setRetryCount(0); // Reset on success
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        currentRetry++;
        
        if (currentRetry <= maxRetries && isMountedRef.current) {
          console.warn(`🔄 Operation failed, retry ${currentRetry}/${maxRetries} in ${retryDelay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw lastError!;
  }, [asyncFunction, maxRetries, retryDelay, ...dependencies]);

  const baseOperation = useAsyncOperation(executeWithRetry, [executeWithRetry]);

  return {
    ...baseOperation,
    retryCount,
    canRetry: retryCount < maxRetries && !baseOperation.loading
  };
}