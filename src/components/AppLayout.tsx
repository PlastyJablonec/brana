import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppFooter from './AppFooter';
import UpdateNotification from './UpdateNotification';

const AppLayout: React.FC = () => {
  const location = useLocation();

  console.log('🎯 AppLayout rendering with location:', location.pathname);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <AppFooter />
      <UpdateNotification />
    </div>
  );
};

export default AppLayout;