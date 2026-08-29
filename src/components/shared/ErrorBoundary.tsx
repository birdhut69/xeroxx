import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafePrint ErrorBoundary] Caught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetToHome = () => {
    sessionStorage.clear();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 text-center">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#d1d7db] space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 border border-red-200 flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-[#111b21]">Something went wrong</h3>
              <p className="text-xs text-[#667781] leading-relaxed">
                SafePrint protected your session. No files were written to disk.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0] text-left">
                <p className="text-[11px] font-mono text-red-600 truncate">
                  {this.state.error.message || 'Unknown runtime error'}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>

              <button
                onClick={this.handleResetToHome}
                className="py-2.5 px-4 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-bold flex items-center justify-center gap-1.5 border border-[#d1d7db] cursor-pointer"
              >
                <Home className="w-4 h-4 text-[#54656f]" />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
