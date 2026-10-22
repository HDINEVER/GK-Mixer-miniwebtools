import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GKMixer ErrorBoundary] Caught runtime error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="gk-card my-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-coral/10 text-coral text-xl font-black">
            !
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">
            {this.props.fallbackTitle || '当前视图组件遇到渲染异常'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4 font-mono break-all">
            {this.state.error?.message || 'Unexpected render error'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="gk-btn-primary inline-flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2 text-xs font-black text-white shadow-sm hover:opacity-95 transition cursor-pointer"
          >
            <span>🔄 重置当前视图状态</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
