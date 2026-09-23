import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
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
    console.error("Erro capturado no ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto my-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center font-bold text-xl">
            !
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">
            {this.props.fallbackTitle || "Ocorreu um erro ao carregar esta vista"}
          </h2>
          <p className="text-xs text-slate-500 mb-4 font-mono break-words">
            {this.state.error?.message || "Não foi possível carregar os dados desta secção."}
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
