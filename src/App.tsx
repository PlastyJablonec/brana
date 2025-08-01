import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryProvider } from './providers/QueryProvider';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import ActivityLogs from './pages/ActivityLogs';
import Settings from './pages/Settings';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import MqttErrorBoundary from './components/MqttErrorBoundary';
import { mqttService } from './services/mqttService';
import AppFooter from './components/AppFooter';
import { IProtectedRouteProps } from './types';

const ProtectedRoute: React.FC<IProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Načítám uživatelská data..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MqttErrorBoundary
      onMqttError={(error) => {
        console.error('🚨 MQTT Error in protected route:', error);
        // Could trigger a toast notification here
      }}
    >
      {children}
    </MqttErrorBoundary>
  );
};

const AppRoutes: React.FC = () => {
  const { currentUser, loading } = useAuth();

  // Initialize MQTT globally when user is authenticated
  useEffect(() => {
    let isComponentMounted = true;

    const initializeMqtt = async (): Promise<void> => {
      if (!isComponentMounted) return;

      if (currentUser) {
        console.log('🔧 App: User logged in, initializing global MQTT connection');
        try {
          await mqttService.connect();
          if (isComponentMounted) {
            console.log('✅ MQTT connection established successfully');
          }
        } catch (error) {
          if (isComponentMounted) {
            console.error('❌ Failed to connect to MQTT:', error);
            // Error will be handled by MqttErrorBoundary in components
          }
        }
      } else {
        console.log('🔧 App: User logged out, disconnecting MQTT');
        mqttService.disconnect();
      }
    };

    initializeMqtt();

    return () => {
      isComponentMounted = false;
      if (!currentUser) {
        mqttService.disconnect();
      }
    };
  }, [currentUser]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <ActivityLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App(): React.ReactElement {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('🚨 Global Error Boundary caught error:', error, errorInfo);
        // Here you could send error to logging service
      }}
    >
      <QueryProvider>
        <AuthProvider>
          <ThemeProvider>
            <Router>
              <AppRoutes />
              <AppFooter />
            </Router>
          </ThemeProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
