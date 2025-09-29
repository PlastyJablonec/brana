import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryProvider } from './providers/QueryProvider';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import MqttErrorBoundary from './components/MqttErrorBoundary';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import { mqttService } from './services/mqttService';
import { locationService } from './services/locationService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import AppFooter from './components/AppFooter';
import UpdateNotification from './components/UpdateNotification';
import { IProtectedRouteProps } from './types';

// Lazy load components pro lepsi performance
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const Settings = lazy(() => import('./pages/Settings'));

const ProtectedRoute: React.FC<IProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Načítám uživatelská data..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is pending approval
  if (currentUser.status === 'pending') {
    return <PendingApprovalScreen user={currentUser} />;
  }

  // Check if user was rejected
  if (currentUser.status === 'rejected') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        textAlign: 'center'
      }}>
        <div className="md-card" style={{ maxWidth: '400px', padding: '32px' }}>
          <h2 style={{ color: 'var(--md-error)', marginBottom: '16px' }}>
            ❌ Přístup zamítnut
          </h2>
          <p style={{ marginBottom: '24px', color: 'var(--md-on-surface-variant)' }}>
            Váš požadavek o přístup byl administrátorem zamítnut.
            {currentUser.rejectedReason && (
              <>
                <br /><br />
                <strong>Důvod:</strong> {currentUser.rejectedReason}
              </>
            )}
          </p>
          <button 
            onClick={() => window.location.href = '/login'}
            style={{
              background: 'var(--md-primary)',
              color: 'var(--md-on-primary)',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px'
            }}
          >
            Zpět na přihlášení
          </button>
        </div>
      </div>
    );
  }

  // User is approved - allow access
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

  // Initialize MQTT and GPS globally when user is authenticated
  useEffect(() => {
    let isComponentMounted = true;

    const initializeServices = async (): Promise<void> => {
      if (!isComponentMounted) return;

      if (currentUser) {
        console.log('🔧 App: User logged in, initializing global services');
        
        // Initialize MQTT
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

        // Auto-save GPS location on login/refresh (no alerts)
        if (currentUser.permissions?.allowGPS && isComponentMounted) {
          console.log('📍 App: Auto-updating user GPS location...');
          try {
            const location = await locationService.getCurrentLocation();
            
            // Update user's location in Firestore silently
            const userDoc = doc(db, 'users', currentUser.id);
            await updateDoc(userDoc, {
              lastLocation: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                timestamp: new Date()
              }
            });
            
            console.log('📍 App: GPS location auto-saved:', locationService.formatLocationString(location));
          } catch (gpsError) {
            console.log('📍 App: GPS auto-save failed (no alert):', gpsError);
            // Silent failure - no user notification
          }
        }
      } else {
        console.log('🔧 App: User logged out, disconnecting services');
        mqttService.disconnect();
      }
    };

    initializeServices();

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
            <Suspense fallback={<LoadingSpinner message="Načítám správu uživatelů..." />}>
              <UserManagement />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingSpinner message="Načítám logy..." />}>
              <ActivityLogs />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingSpinner message="Načítám nastavení..." />}>
              <Settings />
            </Suspense>
          </ProtectedRoute>
        }
      />
      {/* Fallback route: redirect unknown paths based on auth state */}
      <Route path="*" element={currentUser ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
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
              <UpdateNotification />
            </Router>
          </ThemeProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
