import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/shared/Header';
import { TerminalDashboard } from './components/terminal/TerminalDashboard';
import { CustomerPortal } from './components/customer/CustomerPortal';
import { ToastProvider } from './components/shared/ToastContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { NetworkStatusBanner } from './components/shared/NetworkStatusBanner';
import { PWAInstallBanner } from './components/shared/PWAInstallBanner';
import { ShieldCheck, Lock, Flame, Key } from 'lucide-react';

type AppMode = 'TERMINAL' | 'CUSTOMER';

export const AppContent: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>('CUSTOMER');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('safeprint_admin_auth') === 'true';
  });
  const [serverOnline, setServerOnline] = useState(true);

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

  return (
    <div className={`flex flex-col text-[#111b21] selection:bg-[#00a884] selection:text-white ${
      currentMode === 'TERMINAL' && isAdminAuthenticated
        ? 'h-screen overflow-hidden wa-web-backdrop p-0 lg:p-4'
        : 'min-h-screen bg-[#f0f2f5]'
    }`}>
      <Header
        currentMode={currentMode}
        onModeChange={handleModeChange}
        serverOnline={serverOnline}
        isAdminAuthenticated={isAdminAuthenticated}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}
      />

      <main className={`flex-1 ${currentMode === 'TERMINAL' && isAdminAuthenticated ? 'min-h-0 flex flex-col max-w-[1720px] w-full mx-auto' : ''}`}>
        {currentMode === 'TERMINAL' && isAdminAuthenticated && <TerminalDashboard />}
        {currentMode === 'CUSTOMER' && <CustomerPortal />}
      </main>

      {/* Footer only on Customer Portal or unauthenticated mode */}
      {!(currentMode === 'TERMINAL' && isAdminAuthenticated) && (
        <footer className="bg-white border-t border-[#bec9c5]/30 px-4 py-6 mt-8 no-print text-left">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#6f7976]">
            <div>
              <div className="flex items-center gap-2 text-[#1d1c17] font-bold text-sm mb-1.5">
                <ShieldCheck className="w-4 h-4 text-[#00453d]" />
                <span>CipherPrint Ephemeral Protocol</span>
              </div>
              <p className="leading-relaxed">
                Eliminates document leakage at photocopy & print shops. Files are encrypted client-side in RAM,
                forwarded zero-disk to the printer, and destroyed immediately.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-[#1d1c17] font-bold text-sm mb-1.5">
                <Key className="w-4 h-4 text-[#006d2f]" />
                <span>Zero-Knowledge QR Handshake</span>
              </div>
              <p className="leading-relaxed font-mono text-[11px]">
                AES keys stay strictly in the QR URL fragment (<code className="text-[#00453d] bg-[#f2ede5] px-1 py-0.5 rounded">#key=...</code>).
                Per RFC standards, hash fragments never touch the relay server.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-[#1d1c17] font-bold text-sm mb-1.5">
                <Flame className="w-4 h-4 text-[#EF4444]" />
                <span>Cryptographic Destruction Proof</span>
              </div>
              <p className="leading-relaxed">
                Upon printing, document byte arrays are actively wiped with{' '}
                <code className="text-[#EF4444] font-mono bg-[#fef2f2] px-1 py-0.5 rounded">crypto.getRandomValues()</code> and committed to an immutable Merkle ledger block.
              </p>
            </div>
          </div>

          <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-[#bec9c5]/30 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#6f7976] font-mono">
            <div>© {new Date().getFullYear()} CipherPrint • 100% In-Memory Architecture</div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <span className="text-[#00453d] font-bold">✓ 0 KB Server Disk I/O</span>
              <span className="text-[#006d2f] font-bold">✓ Web Crypto AES-256-GCM</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <NetworkStatusBanner />
        <PWAInstallBanner />
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
