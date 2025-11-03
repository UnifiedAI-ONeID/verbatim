import React, { Component, ErrorInfo, PropsWithChildren, ReactNode } from 'react';

// --- Type Aliases for ErrorBoundary ---
type ErrorBoundaryProps = PropsWithChildren<{}>;
type ErrorBoundaryState = { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null };

/**
 * A robust, self-contained component to catch JavaScript errors anywhere in its child component tree,
 * preventing the entire application from crashing. It provides recovery options for the user and
 * detailed diagnostic information for developers.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // FIX: Initialize state as a class property instead of in the constructor.
  // This modern syntax resolves the issue where TypeScript fails to recognize 'state' and other
  // component properties on 'this'.
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service and store details for display.
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Fallback UI with self-contained styles for resilience against theme/style provider failures.
      const styles: { [key: string]: React.CSSProperties } = {
        container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', color: '#e0e0e0' },
        box: { maxWidth: '600px', width: '100%', padding: '30px', border: '1px solid #444', borderRadius: '12px', backgroundColor: '#2a2a2a', textAlign: 'center' },
        title: { fontSize: '1.5rem', color: '#ff4136', margin: '0 0 15px 0' },
        message: { fontSize: '1rem', color: '#aaa', lineHeight: 1.6, margin: '0 0 25px 0' },
        buttonContainer: { display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' },
        button: { padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', borderRadius: '8px', border: 'none', fontWeight: '600' },
        primaryButton: { backgroundColor: '#007aff', color: 'white' },
        secondaryButton: { backgroundColor: '#444', color: 'white' },
        details: { marginTop: '25px', textAlign: 'left', borderTop: '1px solid #444', paddingTop: '15px' },
        summary: { cursor: 'pointer', fontWeight: 'bold', color: '#e0e0e0' },
        pre: { whiteSpace: 'pre-wrap', wordWrap: 'break-word', backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '8px', marginTop: '10px', color: '#aaa', maxHeight: '200px', overflowY: 'auto' }
      };

      return (
        <div style={styles.container}>
          <div style={styles.box}>
            <h2 style={styles.title}>Oops! Something went wrong.</h2>
            <p style={styles.message}>The application encountered an unexpected error. Please try one of the options below to continue.</p>
            <div style={styles.buttonContainer}>
              <button style={{ ...styles.button, ...styles.primaryButton }} onClick={this.handleTryAgain}>Try Again</button>
              <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => window.location.reload()}>Refresh Page</button>
              <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => window.history.back()}>Go Back</button>
            </div>
            <details style={styles.details}>
              <summary style={styles.summary}>Error Details</summary>
              <pre style={styles.pre}>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
