import { ErrorReporter } from "./reporter";

// React types inlined to avoid dependency
type ReactNode = any;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  reporter?: ErrorReporter;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

let _sharedReporter: ErrorReporter | null = null;

export function setSharedReporter(reporter: ErrorReporter): void {
  _sharedReporter = reporter;
}

// Factory to avoid direct React import at module level
export function createErrorBoundary(React: any) {
  return class SoameeErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
  > {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
      return { hasError: true };
    }

    componentDidCatch(error: Error, info: { componentStack?: string }) {
      const reporter = this.props.reporter ?? _sharedReporter;
      reporter?.report({
        message: error.message,
        stack: error.stack ?? info.componentStack ?? undefined,
      });
    }

    render() {
      if (this.state.hasError) return this.props.fallback;
      return this.props.children;
    }
  };
}

export function useErrorReporter(reporter?: ErrorReporter) {
  const active = reporter ?? _sharedReporter;
  return {
    reportError: (error: Error, context?: { screen?: string }) => {
      active?.report({
        message: error.message,
        stack: error.stack,
        ...context,
      });
    },
  };
}

export { ErrorReporter } from "./reporter";
