// Moderní PWA dashboard pro ovládání brány

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FirebaseAdapter } from './adapters/FirebaseAdapter';
import { UserManager } from './modules/user/UserManager';
import { mqttService } from './services/mqtt';
import SmartGateButton from './components/features/gate-control/SmartGateButton';
import { User as AppUser, GateStatus } from './types';
import { ThemeProvider } from './theme/ThemeProvider';

const DEFAULT_PERMISSIONS: AppUser['permissions'] = {
  gate: false,
  garage: false,
  camera: false,
  stopMode: false,
  viewLogs: false,
  manageUsers: false,
  viewGateActivity: false,
  requireLocation: true,
  allowGPS: false,
};

const ensurePermissions = (permissions?: Partial<AppUser['permissions']> | null): AppUser['permissions'] => ({
  ...DEFAULT_PERMISSIONS,
  ...permissions,
});

type PartialUser = Omit<AppUser, 'permissions' | 'role' | 'status'> & Partial<Pick<AppUser, 'permissions' | 'role' | 'status'>>;

const normalizeUser = (profile: PartialUser): AppUser => ({
  ...profile,
  permissions: ensurePermissions(profile.permissions),
  role: (profile.role ?? 'user') as AppUser['role'],
  status: (profile.status ?? 'pending') as AppUser['status'],
});

type AuthNotice = {
  type: 'info' | 'warning' | 'error';
  message: string;
} | null;

const STATUS_LABELS: Record<GateStatus, string> = {
  closed: 'Brána zavřena',
  opening: 'Brána se otevírá',
  open: 'Brána otevřená',
  closing: 'Brána se zavírá',
  stopped: 'Brána zastavena',
  stop_mode: 'Režim STOP',
  unknown: 'Stav neznámý',
};

const DASHBOARD_MENU = [
  { key: 'control' as const, label: 'Ovládání', icon: 'tune' },
  { key: 'settings' as const, label: 'Nastavení', icon: 'settings' },
  { key: 'logs' as const, label: 'Logy', icon: 'snippet_folder' },
];

const Dashboard: React.FC<{ user: AppUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const normalizedUser = useMemo(() => normalizeUser(user), [user]);
  const permissions = normalizedUser.permissions;
  const [mqttClient] = useState(() => mqttService as any);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'control' | 'settings' | 'logs'>('control');
  const [gateStatus, setGateStatus] = useState<GateStatus>('unknown');
  const [rawStatus, setRawStatus] = useState('');

  useEffect(() => {
    if (!permissions.gate && !permissions.garage) {
      setMqttConnected(false);
      return () => undefined;
    }

    mqttClient
      .connect()
      .then(() => setMqttConnected(true))
      .catch((error: any) => {
        setMqttConnected(false);
        console.error('❌ MQTT připojení selhalo:', error);
      });

    return () => {
      mqttClient.disconnect();
    };
  }, [mqttClient, permissions.garage, permissions.gate]);

  useEffect(() => {
    if (!mqttConnected) {
      setGateStatus('unknown');
      setRawStatus('');
    }
  }, [mqttConnected]);

  const connectionIcon = mqttConnected ? 'wifi' : 'wifi_off';
  const connectionLabel = mqttConnected ? 'MQTT připojeno' : 'MQTT odpojeno';
  const gateStatusLabel = STATUS_LABELS[gateStatus];

  const activeItem = useMemo(
    () => DASHBOARD_MENU.find((item) => item.key === activeView) ?? DASHBOARD_MENU[0],
    [activeView]
  );

  const handleStatusChange = ({ gateStatus, rawStatus }: { gateStatus: GateStatus; rawStatus: string }) => {
    setGateStatus(gateStatus);
    setRawStatus(rawStatus);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="neo-shell">
      <div className="neo-overlay" aria-hidden="true" />

      <header className="neo-header">
        <div className="neo-brand">
          <span className="neo-brand__logo">A</span>
          <div className="neo-brand__text">
            <span className="neo-brand__name">AURA Gate</span>
            <span className="neo-brand__tagline">Progressive Web App</span>
          </div>
        </div>

        <div className="neo-user-card">
          {normalizedUser.photoURL ? (
            <img
              src={normalizedUser.photoURL}
              alt={normalizedUser.displayName}
              referrerPolicy="no-referrer"
              className="neo-user-card__avatar"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="neo-user-card__avatar">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
          )}
          <div className="neo-user-card__meta">
            <span className="neo-user-card__name">{normalizedUser.displayName}</span>
            <span className="neo-user-card__email">{normalizedUser.email || 'neuvedeno'}</span>
            <div className="neo-user-card__tags">
              <span className="neo-chip neo-chip--subtle">
                <span className="material-symbols-outlined">badge</span>
                {normalizedUser.role}
              </span>
              <span className={`neo-chip neo-chip--subtle ${normalizedUser.status === 'approved' ? 'is-approved' : 'is-pending'}`}>
                <span className="material-symbols-outlined">verified_user</span>
                {normalizedUser.status}
              </span>
            </div>
          </div>
        </div>

        <div className="neo-header-actions">
          <div
            className={`neo-connection ${mqttConnected ? 'is-online' : 'is-offline'}`}
            title={connectionLabel}
            aria-label={connectionLabel}
          >
            <span className="material-symbols-outlined">{connectionIcon}</span>
          </div>

          <div className="neo-menu">
            <button
              type="button"
              className="neo-menu__button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            {menuOpen && (
              <div className="neo-menu__panel" role="menu">
                {DASHBOARD_MENU.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="neo-menu__item"
                    data-active={String(activeView === item.key)}
                    onClick={() => {
                      setActiveView(item.key);
                      closeMenu();
                    }}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
                <div className="neo-menu__separator" />
                <button
                  type="button"
                  className="neo-menu__item neo-menu__item--logout"
                  onClick={() => {
                    closeMenu();
                    onLogout();
                  }}
                >
                  <span className="material-symbols-outlined">logout</span>
                  <span>Odhlásit</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="neo-main">
        <div className="neo-grid">
          <section className="neo-card neo-card--primary neo-card--main">
            <div className="neo-card__header">
              <div>
                <span className="neo-card__eyebrow">Aktuální stav</span>
                <h2 className="neo-card__title">Posuvná brána</h2>
              </div>
              <span className="neo-chip neo-chip--status">
                <span className="material-symbols-outlined">{mqttConnected ? 'wifi' : 'signal_wifi_connected_no_internet_4'}</span>
                {mqttConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="neo-card__content">
              {activeView === 'control' ? (
                <SmartGateButton
                  user={{
                    id: normalizedUser.id,
                    displayName: normalizedUser.displayName,
                    permissions,
                    photoURL: normalizedUser.photoURL,
                  }}
                  mqttService={mqttClient}
                  mqttConnected={mqttConnected}
                  onStatusChange={handleStatusChange}
                />
              ) : (
                <div className="neo-placeholder">
                  <span className="material-symbols-outlined">construction</span>
                  <p>Sekce {activeItem.label} je v přípravě.</p>
                </div>
              )}
            </div>
          </section>

          <section className="neo-card">
            <div className="neo-card__header">
              <h3 className="neo-card__title">Profil</h3>
            </div>
            <div className="neo-meta">
              <span>Jméno</span>
              <span>{normalizedUser.displayName}</span>
            </div>
            <div className="neo-meta">
              <span>E-mail</span>
              <span>{normalizedUser.email || 'neuvedeno'}</span>
            </div>
            <div className="neo-meta">
              <span>Role</span>
              <span>{normalizedUser.role}</span>
            </div>
            <div className="neo-meta">
              <span>Stav účtu</span>
              <span>{normalizedUser.status}</span>
            </div>
          </section>

          <section className="neo-card">
            <div className="neo-card__header">
              <h3 className="neo-card__title">Oprávnění</h3>
            </div>
            <div className="neo-meta">
              <span>Ovládání brány</span>
              <span>{permissions.gate ? 'Povoleno' : 'Bez přístupu'}</span>
            </div>
            <div className="neo-meta">
              <span>STOP mód</span>
              <span>{permissions.stopMode ? 'Povoleno' : 'Zakázáno'}</span>
            </div>
            <div className="neo-meta">
              <span>Zobrazení logů</span>
              <span>{permissions.viewLogs ? 'Povoleno' : 'Zakázáno'}</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const LoginScreen: React.FC<{ loading: boolean; notice: AuthNotice; onLogin: () => void }> = ({ loading, notice, onLogin }) => (
  <div className="neo-shell neo-shell--login">
    <div className="neo-overlay" aria-hidden="true" />
    <div className="neo-login">
      <div className="neo-login__icon">
        <span className="material-symbols-outlined">door_front</span>
      </div>
      <h1 className="neo-login__title">Přihlaste se</h1>
      <p className="neo-login__subtitle">AURA Gate – chytré ovládání posuvné brány</p>

      {notice && (
        <div className={`neo-notice neo-notice--${notice.type}`}>
          {notice.message}
        </div>
      )}

      <button className="neo-login__button" onClick={onLogin} disabled={loading}>
        <span className="material-symbols-outlined">login</span>
        {loading ? 'Připojuji…' : 'Přihlásit přes Google'}
      </button>

      <p className="neo-login__hint">Použijte firemní Google účet. Přístup schvaluje administrátor.</p>
    </div>
  </div>
);

const AppUltraSimple: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<AuthNotice>(null);
  const [firebaseAdapter] = useState(() => new FirebaseAdapter());
  const [userManager] = useState(() => new UserManager(firebaseAdapter));

  const signOutAndExplain = useCallback(async (type: Exclude<AuthNotice, null>['type'], message: string) => {
    setNotice({ type, message });
    setUser(null);
    try {
      await firebaseAdapter.signOut();
    } catch (error) {
      console.warn('⚠️ Odhlášení selhalo při vysvětlení stavu uživatele:', error);
    }
  }, [firebaseAdapter]);

  const loadUserProfile = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await userManager.getCurrentUser();
      if (!profile) {
        await signOutAndExplain('error', 'Uživatelský účet nebyl nalezen. Kontaktujte administrátora.');
        return;
      }

      if (profile.status === 'pending') {
        await signOutAndExplain('warning', 'Váš účet čeká na schválení. Jakmile vás administrátor povolí, zkuste to prosím znovu.');
        return;
      }

      if (profile.status === 'rejected') {
        await signOutAndExplain('error', 'Váš přístup byl zamítnut. Pro více informací kontaktujte administrátora.');
        return;
      }

      const fbUser = firebaseAdapter.getCurrentFirebaseUser ? firebaseAdapter.getCurrentFirebaseUser() : null;
      const enrichedProfile = {
        ...profile,
        displayName: profile.displayName || fbUser?.displayName || fbUser?.email || profile.email || 'Uživatel',
        photoURL: profile.photoURL ?? fbUser?.photoURL ?? undefined,
        email: profile.email || fbUser?.email || '',
      };

      setNotice(null);
      setUser(normalizeUser(enrichedProfile));
    } catch (error) {
      console.error('❌ Chyba při načítání uživatele z Firestore:', error);
      const message = error instanceof Error ? error.message : 'Došlo k neočekávané chybě při načítání profilu.';
      await signOutAndExplain('error', message);
    } finally {
      setLoading(false);
    }
  }, [signOutAndExplain, userManager]);

  useEffect(() => {
    const unsubscribe = firebaseAdapter.onAuthStateChanged((firebaseUser: any) => {
      if (firebaseUser) {
        loadUserProfile();
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [firebaseAdapter, loadUserProfile]);

  const handleLogin = async () => {
    setNotice(null);
    setLoading(true);
    try {
      await firebaseAdapter.signInWithGoogle();
    } catch (error) {
      console.error('❌ Chyba při přihlášení:', error);
      const message = error instanceof Error ? error.message : 'Přihlášení selhalo. Zkuste to prosím znovu.';
      setNotice({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await firebaseAdapter.signOut();
      setUser(null);
      setNotice({ type: 'info', message: 'Byli jste odhlášeni.' });
    } catch (error) {
      console.error('❌ Chyba při odhlášení:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider>
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen loading={loading} notice={notice} onLogin={handleLogin} />
      )}
    </ThemeProvider>
  );
};

export default AppUltraSimple;
