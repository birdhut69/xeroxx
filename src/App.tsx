import React, { useState, useEffect } from 'react';
import { Header } from './components/shared/Header';
import { TerminalDashboard } from './components/terminal/TerminalDashboard';
import { CustomerPortal } from './components/customer/CustomerPortal';
import { DualDemoSimulator } from './components/simulator/DualDemoSimulator';
import { ToastProvider } from './components/shared/ToastContext';
import { ShieldCheck, Lock, Flame, RefreshCw, Key, HelpCircle } from 'lucide-react';

export const AppContent: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'TERMINAL' | 'CUSTOMER' | 'SIMULATOR'>('SIMULATOR');
  const [serverOnline, setServerOnline] = useState(true);

  // Auto-detect Customer Mode if QR URL params exist
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) {
      setCurrentMode('CUSTOMER');
    }

    // Ping health check
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ONLINE') setServerOnline(true);
      })
      .catch(() => {
        fetch('http://localhost:8080/api/health')
          .then((r) => r.json())
          .then(() => setServerOnline(true))
          .catch(() => setServerOnline(false));
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Universal SafePrint Header */}
      <Header
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        serverOnline={serverOnline}
      />

      {/* Main Mode View */}
      <main className="flex-1">
        {currentMode === 'TERMINAL' && <TerminalDashboard />}
        {currentMode === 'CUSTOMER' && <CustomerPortal />}
        {currentMode === 'SIMULATOR' && <DualDemoSimulator />}
      </main>

      {/* Security Architecture & Transparency Footer */}
      <footer className="glass-panel border-t border-slate-800/80 px-4 py-8 mt-12 no-print text-left">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>SafePrint Security Protocol</span>
            </div>
            <p className="leading-relaxed">
              Designed to end document theft at xerox & print shops. Documents are encrypted client-side, held only in RAM during print prep, and cryptographically shredded upon completion.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>Zero-Knowledge Handshake</span>
            </div>
            <p className="leading-relaxed font-mono text-[11px]">
              Session keys reside strictly in the QR code URL hash (<code className="text-cyan-300">#key=...</code>). Per RFC 3986, hash fragments are never sent to the relay server.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Cryptographic Destruction</span>
            </div>
            <p className="leading-relaxed">
              Upon printing, document byte arrays are actively zeroized with <code className="text-rose-300 font-mono">crypto.getRandomValues()</code> and committed to an immutable SHA-256 Merkle audit block.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 font-mono">
          <div>© 2026 SafePrint Ephemeral Technology • 100% In-Memory Architecture</div>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <span className="text-emerald-400 font-bold">✓ Zero Server Disk I/O</span>
            <span className="text-cyan-400 font-bold">✓ Web Crypto AES-256</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
