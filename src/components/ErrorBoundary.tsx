import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
    console.error('[BarberLoo ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.href = '/';
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF6EA] text-[#111113] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[#5B0E14] text-[#F1E194] flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold text-[#FFF9E8]">
                Something went wrong
              </h2>
              <p className="text-xs text-[#8A8178] leading-relaxed">
                The application encountered an unexpected issue while rendering this view.
                You can return to the main catalog or refresh the page.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-[#111113] border border-[#F1E194]/15 text-left">
                <p className="text-[11px] font-mono-num text-red-300 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#FFF9E8] transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Return Home</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/25 text-[#F1E194] text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#241719] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
