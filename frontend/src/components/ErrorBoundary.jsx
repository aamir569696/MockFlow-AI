import { Component } from 'react';

/**
 * ErrorBoundary — top-level render-crash safety net.
 *
 * React error boundaries must be class components. This one catches any render
 * or lifecycle error thrown by the subtree below it, logs it to the console for
 * debugging, and renders a calm, on-brand recovery screen instead of a blank
 * white page. The user can retry (reset the boundary) or reload the app.
 *
 * State stores are NOT touched here — a crash in the view layer should never
 * wipe the user's persisted workspace. Recovery is view-only.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface the crash for debugging; in production this is where a real
    // telemetry sink (Sentry, etc.) would receive the report.
    // eslint-disable-next-line no-console
    console.error('[MockFlow] Render error caught by ErrorBoundary:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error?.message?.toString?.() ?? 'An unexpected error occurred.';

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6
                      bg-gray-950 px-6 py-12 text-center text-gray-100">
        {/* Glow icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl
                        border border-red-900/40 bg-gray-900/80 ring-1 ring-red-900/20"
             style={{ boxShadow: '0 0 28px rgba(248,113,113,0.12)' }}>
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.4 14.5A1.5 1.5 0 003.24 21h17.52a1.5 1.5 0 001.3-2.56l-8.4-14.5a1.5 1.5 0 00-2.6 0z" />
          </svg>
        </div>

        <div className="flex max-w-md flex-col gap-2">
          <h1 className="text-lg font-bold text-white">Something went wrong</h1>
          <p className="text-sm leading-relaxed text-gray-500">
            The interface hit an unexpected error, but your workspace is safe —
            nothing was lost. Try again, or reload if it persists.
          </p>
          <code className="mt-2 max-h-24 overflow-y-auto break-words rounded-lg
                           border border-gray-800 bg-gray-900/60 px-3 py-2
                           font-mono text-[11px] text-red-300/90">
            {message}
          </code>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={this.handleReset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold
                       text-white transition-colors hover:bg-brand-500
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-brand-400"
          >
            Try again
          </button>
          <button
            onClick={this.handleReload}
            className="rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2
                       text-sm font-semibold text-gray-300 transition-colors
                       hover:border-gray-600 hover:text-white
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-gray-500"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
