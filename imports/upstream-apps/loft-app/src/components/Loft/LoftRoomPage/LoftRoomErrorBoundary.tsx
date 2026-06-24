import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class LoftRoomErrorBoundary extends React.Component<Props, State> {
  declare state: State;
  declare props: Props;
  declare setState: React.Component<Props, State>['setState'];

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LoftRoom Error Boundary caught an error:', error, errorInfo);
    this.setState({ hasError: true, error });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDev = (import.meta as any)?.env?.DEV;
      
      return (
        <div className="fixed inset-0 z-[500] bg-[var(--loft-bg)] flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-xl w-full space-y-8 relative z-10">
            <div className="loft-card loft-card--flat bg-[var(--loft-surface)] rounded-[2.5rem] p-12 text-center shadow-2xl text-main">
              <h2 className="text-2xl font-black text-main uppercase tracking-tighter mb-6">
                Loft had a problem loading
              </h2>
              <p className="text-main/70 text-sm md:text-base mb-8">
                Try refreshing. If this keeps happening, copy the details below.
              </p>
              
              {isDev && this.state.error && (
                <pre className="text-left text-xs bg-black/10 dark:bg-white/10 p-4 rounded-xl mb-8 overflow-auto max-h-48 text-main/80">
                  {this.state.error.message}
                  {this.state.error.stack && '\n\n' + this.state.error.stack}
                </pre>
              )}
              
              <button 
                onClick={this.handleReload}
                className="w-full bg-cafe text-white font-bold py-6 rounded-2xl text-[14px] uppercase tracking-[0.3em] shadow-lg shadow-cafe/30 hover:bg-cafe/90 transition-colors"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default LoftRoomErrorBoundary;
