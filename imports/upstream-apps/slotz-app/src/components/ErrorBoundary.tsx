import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SLOTZ error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-start justify-center bg-[var(--bg-primary)] px-4 py-16 text-center text-[var(--text-primary)]">
          <div role="alert" className="slotz-card w-full max-w-md p-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">SLOTZ</p>
            <h1 className="mb-3 text-2xl font-semibold tracking-tight text-[var(--text-secondary)]">
              We could not load this page
            </h1>
            <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">
              Please refresh this page. If the problem continues, use the booking link again from your confirmation email.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
