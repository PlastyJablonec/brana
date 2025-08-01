import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  // Debug permissions
  console.log('🔧 Navbar: currentUser?.permissions:', currentUser?.permissions);
  console.log('🔧 Navbar: viewLogs check:', currentUser?.permissions.viewLogs);
  console.log('🔧 Navbar: manageUsers check:', currentUser?.permissions.manageUsers);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
        </svg>
      )
    },
    ...(currentUser?.permissions.manageUsers ? [{ 
      path: '/users', 
      label: 'Uživatelé', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    }] : []),
    ...(currentUser?.permissions.viewLogs ? [{ 
      path: '/logs', 
      label: 'Logy', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }] : []),
  ];

  return (
    <>
      {/* Top Header - Desktop & Mobile */}
      <header className="top-header">
        <div className="container">
          <div className="header-content">
            <Link to="/dashboard" className="logo">
              <div className="logo-icon">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 8v14h20V8L12 2zm8 18H4V9.5l8-5.33L20 9.5V20zm-2-8v6h-2v-6h2zm-4 0v6h-2v-6h2zm-4 0v6H8v-6h2z"/>
                </svg>
              </div>
              <div className="logo-text">
                <div className="text-base font-semibold">Ovládání Brány</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="desktop-nav">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`desktop-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <div className="nav-icon">
                    {item.icon}
                  </div>
                  <span className="nav-label">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* User Info */}
            <div className="user-info">
              <div className="user-avatar">
                <span className="text-sm font-semibold text-white">
                  {(currentUser?.displayName || currentUser?.email || '').charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="logout-btn"
                aria-label="Odhlásit se"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <div className="nav-icon">
              {item.icon}
            </div>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
};

export default Navbar;