import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/shared/Header';
import { TerminalDashboard } from './components/terminal/TerminalDashboard';
import { CustomerPortal } from './components/customer/CustomerPortal';
import { ToastProvider } from './components/shared/ToastContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { NetworkStatusBanner } from './components/shared/NetworkStatusBanner';
import { PWAInstallBanner } from './components/shared/PWAInstallBanner';
import { ShieldCheck, Lock, Flame, Key } from 'lucide-react';

import { LanguageProvider } from './context/LanguageContext';

type AppMode = 'TERMINAL' | 'CUSTOMER';

export const AppContent: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>('CUSTOMER');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('safeprint_admin_auth') === 'true';
  });
  const [serverOnline, setServerOnline] = useState(true);
  const [isCustomerSessionActive, setIsCustomerSessionActive] = useState(false);

  // Auto-detect mode on URL load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path.includes('/admin') || path.includes('/terminal')) {
      if (sessionStorage.getItem('safeprint_admin_auth') === 'true') {
        setCurrentMode('TERMINAL');
      } else {
        setCurrentMode('CUSTOMER');
      }
    } else {
      setCurrentMode('CUSTOMER');
    }
  }, []);

  // Health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/relay?action=health');
        const data = await res.json();
        setServerOnline(data.status === 'ONLINE');
      } catch {
        try {
          const res = await fetch('http://localhost:8080/api/health');
          await res.json();
          setServerOnline(true);
        } catch {
          setServerOnline(false);
        }
      }
    };
    checkHealth();
  }, []);

  const handleModeChange = useCallback((mode: AppMode) => {
    setCurrentMode(mode);
    if (mode === 'TERMINAL') {
      window.history.replaceState({}, '', '/admin');
    } else {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleAdminLogin = () => {
    setIsAdminAuthenticated(true);
    sessionStorage.setItem('safeprint_admin_auth', 'true');
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('safeprint_admin_auth');
  };

  // If customer is in an active chat session, CustomerPortal renders its own WhatsApp top bar
  const shouldShowOuterHeader = currentMode === 'TERMINAL' || !isCustomerSessionActive;

  return (
    <div className={`flex flex-col text-[#111b21] selection:bg-[#00a884] selection:text-white ${
      currentMode === 'TERMINAL' && isAdminAuthenticated
        ? 'h-[100dvh] overflow-hidden wa-web-backdrop p-0 lg:p-4'
        : 'h-[100dvh] overflow-hidden bg-[#f0f2f5]'
    }`}>
      {shouldShowOuterHeader && (
        <Header
          currentMode={currentMode}
          onModeChange={handleModeChange}
          serverOnline={serverOnline}
          isAdminAuthenticated={isAdminAuthenticated}
          onAdminLogin={handleAdminLogin}
          onAdminLogout={handleAdminLogout}
        />
      )}

      <main className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden max-w-[1720px] mx-auto">
        {currentMode === 'TERMINAL' && isAdminAuthenticated && <TerminalDashboard />}
        {currentMode === 'CUSTOMER' && (
          <CustomerPortal onSessionActiveChange={setIsCustomerSessionActive} />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ToastProvider>
          <NetworkStatusBanner />
          <PWAInstallBanner />
          <AppContent />
        </ToastProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
