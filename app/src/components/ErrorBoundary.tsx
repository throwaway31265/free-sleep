import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state to render fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Catch errors in the component tree
    this.setState({ errorInfo });

    // Optional: Log error to an external service
    this.logError(error, errorInfo);
  }

  logError(error: Error, errorInfo: ErrorInfo) {
    console.error('Logging error to service:', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Something went wrong.</h1>
          { process.env.NODE_ENV === 'development' && (
            <details style={ { whiteSpace: 'pre-wrap' } }>
              <summary>Error details</summary>
              <p>{ this.state.error?.toString() }</p>
              <pre>{ this.state.errorInfo?.componentStack }</pre>
            </details>
          ) }
        </div>
      );
    }

    return this.props.children;
  }
}
