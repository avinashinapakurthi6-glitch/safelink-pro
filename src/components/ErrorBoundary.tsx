import React from 'react';
import { AlertTriangle, RefreshCw, Trash2, Shield } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SafeLink ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage clear failed:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center antialiased">
          <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="w-14 h-14 bg-red-600/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7 text-red-500 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-black uppercase tracking-wider font-display text-slate-100">
                  SafeLink Recovery Mode
                </h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected interface exception occurred. The safety system isolated the error to protect your device.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left overflow-x-auto text-[11px] font-mono text-red-300">
                <p className="font-bold text-red-400 mb-1">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <p className="text-[10px] text-slate-500 max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {this.state.error.stack.slice(0, 300)}...
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleResetCache}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Clears corrupted local cache and restarts"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
