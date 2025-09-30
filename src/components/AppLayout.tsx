import React from 'react';
import { useLocation } from 'react-router-dom';
import AppFooter from './AppFooter';
import UpdateNotification from './UpdateNotification';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();

  console.log('🎯 AppLayout rendering with location:', location.pathname);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <AppFooter />
      <UpdateNotification />
    </div>
  );
};

export default AppLayout;