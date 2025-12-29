import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { registerServiceWorker } from './utils/serviceWorkerRegistration';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Standard Error Boundary for catching and displaying runtime logic errors.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can log the error to an error reporting service here.
    console.error("Critical System Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-red-900/20 border-2 border-red-500/50 p-8 rounded-3xl max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-widest mb-2">Application Error</h1>
            <p className="text-slate-400 mb-6 text-sm">The system encountered a critical error and needs to restart.</p>
            
            <div className="bg-black/50 p-4 rounded-xl text-left mb-6 overflow-auto max-h-40 border border-white/10">
              <code className="text-[10px] text-red-300 font-mono">
                {this.state.error?.message || "Unknown internal error"}
              </code>
            </div>

            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-5 h-5" /> REBOOT APP
            </button>
          </div>
        </div>
      );
    }

    // If there's no error, render the children as normal.
    return (this as any).props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for offline support
if (import.meta.env.PROD) {
  registerServiceWorker().then(registration => {
    if (registration) {
      console.log('[App] Service Worker registered - Offline support enabled');
    }
  });
}
